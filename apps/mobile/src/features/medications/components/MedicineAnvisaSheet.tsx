import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Search, X } from 'lucide-react-native'
// TODO(040-strict): estes dois batem em TS2305 como named import (ver TreatmentsScreen.tsx)
import * as LucideIcons from 'lucide-react-native'

import MedicineIcon from '@shared/components/ui/MedicineIcon'
import { useMedicineDatabase } from '@shared/hooks/useMedicineDatabase'
import { useCmedIndex } from '@shared/hooks/useCmedIndex'
import { useKeyboardVisible } from '@shared/hooks/useKeyboardVisible'
import {
  rowsForAnvisaItem,
  groupByConcentration,
  countConcentrationChoices,
  medicineDraftFromRow,
  normalizeRegulatoryCategory,
  REGULATORY_CATEGORY_LABELS,
  type CmedIndex,
  type CmedMedicineDraft,
  type PickerConcentration,
} from '@dosiq/core'
import { CmedPresentationStep } from '@medications/components/CmedPresentationStep'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const { ScanBarcode, ChevronRight } = LucideIcons as any

// Bottom sheet modal de busca na base ANVISA. Reutilizável em formulários
// de criação/edição de medicamentos. Overlay leve com altura máxima 85%.
//
// 066 Slice C (busca 2C, revista no smoke — DESIGN_DECISOES C5): passo 1 = busca de hoje; ao tocar
// um nome com mais de uma concentração na CMED, o passo 2 pergunta a concentração
// (CmedPresentationStep). Uma escolha só pula o passo 2. Sem índice (offline, falha, versão) ou nome
// sem embalagem: preenche como hoje (INV-3).
// O índice só carrega DEPOIS do 1º toque num nome (C-C5: carregar ao abrir o sheet travava a
// digitação no LG K8) e sai da memória ao fechar o sheet (FR-023).
// 066 D1 (C-D1-2, smoke iOS 2026-10-17): `onScan` põe o código de barras no próprio sheet — o "Trocar"
// de um cadastro já preenchido oferece os dois caminhos, não só a busca.
// onSelect recebe { anvisaItem, cmedDraft? }. Eventos: TRACKING_PLAN §5.3 (sem nome/texto, R-042).

export interface AnvisaSheetSelection {
  anvisaItem: any
  cmedDraft?: CmedMedicineDraft
}

type PresentationOutcome = 'single' | 'picked' | 'not_listed' | 'back' | 'unavailable'

function optionsForItem(index: CmedIndex | null, item: any): PickerConcentration[] {
  if (!index || !item) return []
  const rows = rowsForAnvisaItem(index, item)
  return rows.length > 0 ? groupByConcentration(index, rows) : []
}

// Única escolha possível (1 concentração sem 2º nível de laboratório) ⇒ a linha dela.
function singleChoiceRow(options: PickerConcentration[]): number | undefined {
  return countConcentrationChoices(options) === 1 ? options[0].rowIdx : undefined
}

// 3ª linha do passo 1: laboratório da marca; sem laboratório, a categoria do item ("Genérico",
// "Específico"…) — o pipeline traz a categoria clínica real (C5.1 R-7).
function itemCaption(item: any): string | null {
  if (item.laboratory) return item.laboratory
  const category = normalizeRegulatoryCategory(item.regulatoryCategory)
  return category ? ((REGULATORY_CATEGORY_LABELS as Record<string, string>)[category] ?? category) : null
}

export function MedicineAnvisaSheet({ open, onClose, onSelect, onScan = null }) {
  // States (R-010 — States → Memos → Effects → Handlers)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<any>(null)
  const [needIndex, setNeedIndex] = useState(false)
  // Toque duplo num resultado (C-C9, LG): o 2º toque chega antes do re-render e duplicava a escolha.
  const selectingRef = useRef(false)
  const { search, isReady } = useMedicineDatabase()
  const keyboardVisible = useKeyboardVisible()
  const cmed = useCmedIndex({
    enabled: !!open && needIndex,
    onLoaded: (info) =>
      logEvent(EVENTS.MEDICINE_INDEX_LOADED, {
        surface: SURFACES.MOBILE,
        source: info.source,
        duration_ms: info.durationMs,
        status: info.status,
        row_count: info.rowCount,
      }),
  })

  // Memos
  const pickedOptions = useMemo(() => optionsForItem(cmed.index, picked), [cmed.index, picked])

  const trimmed = query.trim()
  const results = useMemo(() => {
    if (!isReady || trimmed.length < 2) return []
    return search(trimmed, 40)
  }, [search, trimmed, isReady])

  const hint = useMemo(() => {
    if (trimmed.length < 2) return 'Digite ao menos 2 caracteres'
    if (results.length === 0) return 'Nenhum resultado'
    return results.length === 1 ? '1 resultado' : `${results.length} resultados`
  }, [trimmed, results.length])

  // Effects
  useEffect(() => {
    if (open) logEvent(EVENTS.MEDICINE_SEARCH_OPENED, { surface: SURFACES.MOBILE, entry_point: 'medicine_form' })
  }, [open])

  // Nome tocado antes do índice ficar pronto: decide quando ele chega.
  useEffect(() => {
    if (!picked || cmed.status === 'idle' || cmed.status === 'preparing') return
    if (cmed.status !== 'ready' || pickedOptions.length === 0) finish(picked, 'unavailable')
    else {
      const single = singleChoiceRow(pickedOptions)
      if (single !== undefined) finish(picked, 'single', single)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, cmed.status, pickedOptions])

  // Handlers
  function finish(item, outcome: PresentationOutcome, rowIdx?: number) {
    const row = rowIdx !== undefined ? cmed.index?.rows[rowIdx] : undefined
    if (outcome === 'unavailable' && cmed.status === 'ready') {
      // SSOT CMED (2026-10-12): nome sem embalagem não deveria existir — rastro p/ investigar.
      console.warn('[MedicineAnvisaSheet] item sem embalagem CMED:', item?.name)
    }
    const draft = row ? medicineDraftFromRow(row) : undefined
    logEvent(EVENTS.MEDICINE_PRESENTATION_SELECTED, {
      surface: SURFACES.MOBILE,
      outcome,
      presentation_count: countConcentrationChoices(optionsForItem(cmed.index, item)),
      dose_ambiguous: draft?.doseAmbiguous ?? false,
    })
    onSelect?.(draft ? { anvisaItem: item, cmedDraft: draft } : { anvisaItem: item })
    selectingRef.current = false
    setPicked(null)
    setQuery('')
  }

  function handleClose() {
    logEvent(EVENTS.MEDICINE_SEARCH_DISMISSED, {
      surface: SURFACES.MOBILE,
      had_query: trimmed.length > 0,
      step: picked ? 'presentation' : 'search',
    })
    setQuery('')
    selectingRef.current = false
    setPicked(null)
    setNeedIndex(false)
    onClose?.()
  }

  function handleBack() {
    logEvent(EVENTS.MEDICINE_PRESENTATION_SELECTED, {
      surface: SURFACES.MOBILE,
      outcome: 'back',
      presentation_count: countConcentrationChoices(pickedOptions),
      dose_ambiguous: false,
    })
    selectingRef.current = false
    setPicked(null)
  }

  function handleSelect(item, index: number) {
    if (selectingRef.current) return
    selectingRef.current = true
    selectionTap()
    logEvent(EVENTS.MEDICINE_SEARCH_RESULT_SELECTED, {
      surface: SURFACES.MOBILE,
      result_rank: index + 1,
      query_length: trimmed.length,
      item_kind: item.laboratory ? 'brand' : 'substance',
    })
    setNeedIndex(true)
    if (cmed.status === 'ready') {
      const options = optionsForItem(cmed.index, item)
      if (options.length === 0) return finish(item, 'unavailable')
      const single = singleChoiceRow(options)
      if (single !== undefined) return finish(item, 'single', single)
    }
    setPicked(item)
  }

  function renderItem({ item, index }) {
    const isSupplement = item.type === 'suplemento'
    const iconColor = isSupplement
      ? colors.supplement[500]
      : colors.primary[500]
    const iconBg = isSupplement
      ? colors.supplement[50]
      : colors.primary[50]

    return (
      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        onPress={() => handleSelect(item, index)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={[styles.itemIcon, { backgroundColor: iconBg }]}>
          <MedicineIcon medicine={item} size={18} color={iconColor} strokeWidth={2} />
        </View>
        <View style={styles.itemText}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.activeIngredient ? (
            <Text style={styles.itemIngredient} numberOfLines={1}>
              {item.activeIngredient}
            </Text>
          ) : null}
          {itemCaption(item) ? (
            <Text style={styles.itemLab} numberOfLines={1}>
              {itemCaption(item)}
            </Text>
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      // Voltar do Android no passo 2 volta à busca, como o "‹" (C-C9); no passo 1 fecha.
      onRequestClose={picked ? handleBack : handleClose}
      // Android: cobre o stack inteiro (sem isso inputs do form parent vazam
      // por cima do overlay no Android 7/API 24).
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        // iOS: eleva o sheet acima do teclado. Android: 'undefined' é NO-OP sob
        // edgeToEdgeEnabled — adjustResize do AndroidManifest vira letra morta e o teclado
        // cobre o input sem 'height' (AP-288/R-303; reproduzido no smoke da 055 PR 1.4 —
        // o comentário antigo "adjustResize já reposiciona" estava errado).
        // Android só com o teclado aberto (C-C7): ao fechar, o 'height' não devolve a altura sob
        // edge-to-edge e a faixa de baixo do Modal transparente mostra a tab bar por trás do sheet.
        behavior={Platform.OS === 'ios' ? 'padding' : keyboardVisible ? 'height' : undefined}
      >
        {Platform.OS === 'android' ? (
          <View style={{ height: StatusBar.currentHeight ?? 0 }} />
        ) : null}
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          {picked ? (
            <CmedPresentationStep
              // Remonta quando o índice chega: o atalho "concentração única ⇒ laboratório" é do 1º render.
              key={cmed.status === 'ready' ? 'ready' : 'preparing'}
              title={picked.name}
              options={pickedOptions}
              preparing={cmed.status === 'idle' || cmed.status === 'preparing'}
              onPick={(rowIdx) => finish(picked, 'picked', rowIdx)}
              onSkip={() => finish(picked, 'not_listed')}
              onBack={handleBack}
            />
          ) : (
          <>
          <Text style={styles.title}>Base ANVISA</Text>

          <View style={styles.searchBox}>
            <Search size={18} color={colors.text.muted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Digite o nome ou princípio ativo"
              placeholderTextColor={colors.text.muted}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
              accessibilityLabel="Buscar medicamento"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Limpar"
              >
                <X size={18} color={colors.text.muted} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>

          {onScan && !trimmed ? (
            <Pressable
              style={({ pressed }) => [styles.scanRow, pressed && styles.scanRowPressed]}
              onPress={onScan}
              accessibilityRole="button"
              accessibilityLabel="Ler o código de barras"
            >
              <ScanBarcode size={20} color={colors.primary[700]} strokeWidth={2.5} />
              <Text style={styles.scanRowText}>Ler o código de barras</Text>
              <ChevronRight size={18} color={colors.primary[700]} />
            </Pressable>
          ) : null}

          <Text style={styles.hint}>{hint}</Text>

          <FlatList
            data={results}
            keyExtractor={(item, idx) => `${item.id ?? item.name}-${idx}`}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
          />
          </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 48,
    marginTop: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.neutral[100],
  },
  scanRowPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  scanRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[700],
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[5],
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: 44,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  hint: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  listContent: {
    paddingBottom: spacing[6],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing[3],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[3],
  },
  itemPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemIngredient: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemLab: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
})

export default MedicineAnvisaSheet
