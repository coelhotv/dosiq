import { useEffect } from 'react'
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

import { useKeyboardVisible } from '@shared/hooks/useKeyboardVisible'
import { CmedPresentationStep } from '@medications/components/CmedPresentationStep'
import { MedicineSearchResultItem } from '@medications/components/MedicineSearchResultItem'
import { useMedicineSearchFlow } from '@medications/hooks/useMedicineSearchFlow'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
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

// 066 Slice E: o fluxo (busca → passo 2 → rascunho) mora em `useMedicineSearchFlow`; aqui só o layout do sheet.
export type { AnvisaSheetSelection } from '@medications/hooks/useMedicineSearchFlow'

// 066 Slice E: `entryPoint` diz de onde a busca abriu (`medicine_form` | `onboarding`) — `surface` segue o canal.
export function MedicineAnvisaSheet({ open, onClose, onSelect, onScan = null, entryPoint = 'medicine_form' }) {
  // States (R-010 — States → Memos → Effects → Handlers)
  const flow = useMedicineSearchFlow({ active: !!open, onSelect })
  const { query, setQuery, trimmed, results, hint, picked, presentationStep, presentationKey } = flow
  const keyboardVisible = useKeyboardVisible()

  // Effects
  useEffect(() => {
    if (open) logEvent(EVENTS.MEDICINE_SEARCH_OPENED, { surface: SURFACES.MOBILE, entry_point: entryPoint })
  }, [open, entryPoint])

  // Handlers
  function handleClose() {
    logEvent(EVENTS.MEDICINE_SEARCH_DISMISSED, {
      surface: SURFACES.MOBILE,
      had_query: trimmed.length > 0,
      step: picked ? 'presentation' : 'search',
    })
    flow.reset()
    onClose?.()
  }

  function renderItem({ item, index }) {
    return <MedicineSearchResultItem item={item} onPress={() => flow.handleSelect(item, index)} />
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      // Voltar do Android no passo 2 volta à busca, como o "‹" (C-C9); no passo 1 fecha.
      onRequestClose={picked ? flow.handleBack : handleClose}
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
          {presentationStep ? (
            <CmedPresentationStep key={presentationKey} {...presentationStep} />
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
})

export default MedicineAnvisaSheet
