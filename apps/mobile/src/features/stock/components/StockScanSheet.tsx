// StockScanSheet — resultado do "Ler a caixa" da aba Estoque quando ele não abre a compra direto
// (spec 066 D2 · FR-030, PO 2026-10-18). Espelha o `MedicineCandidatesSheet` do D1.
//
// `choose`: vários remédios da conta podem ser esta caixa — "Qual destes?" exige escolher um; o app
// nunca escolhe pela pessoa, e a escolha vale como a confirmação do similar (FR-027).
// `none`: o remédio ainda não está cadastrado — "Cadastrar com os dados da caixa" abre o cadastro
// preenchido (D1, que não cria compra) e "Cancelar" só fecha. Nada é gravado aqui (INV-1).

import { useState } from 'react'
import { Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 (ver TreatmentsScreen.tsx)
import * as LucideIcons from 'lucide-react-native'
import { formatStrength, type CmedMedicineDraft } from '@dosiq/core'
import PrimaryButton from '@shared/components/ui/PrimaryButton'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { selectionTap } from '@shared/utils/haptics'
import type { StockScanResolution } from '@stock/scan/purchaseScan'

const { X, ScanBarcode } = LucideIcons as any

const MATCH_LABEL = { identico: 'idêntico', similar: 'parecido' }

interface StockScanSheetProps {
  draft: CmedMedicineDraft
  resolution: Exclude<StockScanResolution<any>, { kind: 'one' }>
  onPick: (medicine: any) => void
  onRegister: () => void
  onClose: () => void
}

function medicineLabel(medicine: any): string {
  // dosage_per_pill chega do banco como numeric (pode vir string).
  const raw = medicine?.dosage_per_pill
  const dose = formatStrength(null, raw === null || raw === undefined || raw === '' ? null : Number(raw), medicine?.dosage_unit ?? null)
  return [medicine?.name, dose].filter(Boolean).join(' ')
}

// Marca (não genérico): o laboratório ajuda a pessoa a reconhecer qual cadastro é o dela. A categoria
// em si não aparece (PO 2026-10-18); genérico não mostra, o laboratório dele muda a cada compra.
function brandLaboratory(medicine: any): string | null {
  if (!medicine?.laboratory || medicine?.regulatory_category === 'Genérico') return null
  return medicine.laboratory
}

function ReadBox({ draft }: { draft: CmedMedicineDraft }) {
  const boxLine = [draft.displayLaboratory, draft.boxQuantity ? `caixa com ${draft.boxQuantity}` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <Text style={styles.section}>A caixa lida:</Text>
      <View style={styles.box}>
        <ScanBarcode size={18} color={colors.primary[700]} />
        <View style={styles.boxText}>
          <Text style={styles.boxTitle}>{[draft.name, draft.strengthLabel].filter(Boolean).join(' ')}</Text>
          {boxLine ? <Text style={styles.boxSub}>{boxLine}</Text> : null}
        </View>
      </View>
    </>
  )
}

function Choices({ candidates, selectedId, onSelect }) {
  return candidates.map(({ medicine, match }) => {
    const selected = medicine?.id === selectedId
    const lab = brandLaboratory(medicine)
    return (
      <Pressable
        key={medicine?.id}
        onPress={() => {
          selectionTap()
          onSelect(medicine?.id ?? null)
        }}
        style={[styles.option, selected && styles.optionSelected]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={[medicineLabel(medicine), lab, MATCH_LABEL[match]].filter(Boolean).join(', ')}
      >
        <View style={[styles.radio, selected && styles.radioOn]} />
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{medicineLabel(medicine)}</Text>
          {lab ? <Text style={styles.optionSub}>{lab}</Text> : null}
        </View>
        <Text style={styles.match}>{MATCH_LABEL[match]}</Text>
      </Pressable>
    )
  })
}

export function StockScanSheet({ draft, resolution, onPick, onRegister, onClose }: StockScanSheetProps) {
  // States
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const choosing = resolution.kind === 'choose'

  // Handlers
  function handleConfirm() {
    if (resolution.kind !== 'choose') return
    const chosen = resolution.candidates.find((c) => c.medicine?.id === selectedId)
    if (chosen) onPick(chosen.medicine)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {choosing ? 'Qual destes?' : 'Este remédio ainda não está cadastrado'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fechar">
            <X size={22} color={colors.text.primary} />
          </Pressable>
        </View>
        <Text style={styles.body}>
          {choosing
            ? 'A caixa combina com mais de um remédio da sua lista. Escolha o desta compra.'
            : 'Cadastre com os dados da caixa e depois registre a compra.'}
        </Text>

        <ReadBox draft={draft} />

        {resolution.kind === 'choose' ? (
          <>
            <Text style={styles.section}>Seus remédios:</Text>
            <Choices candidates={resolution.candidates} selectedId={selectedId} onSelect={setSelectedId} />
            <PrimaryButton label="Registrar compra" onPress={handleConfirm} disabled={!selectedId} style={styles.primary} />
          </>
        ) : (
          <PrimaryButton label="Cadastrar com os dados da caixa" onPress={onRegister} style={styles.primary} />
        )}
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" style={styles.secondary}>
          <Text style={styles.secondaryText}>Cancelar</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    maxHeight: '85%',
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  section: {
    marginTop: spacing[2],
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  boxText: {
    flex: 1,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  boxSub: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  optionSelected: {
    borderColor: colors.primary[500],
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.neutral[300],
  },
  radioOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500],
  },
  optionText: {
    flex: 1,
    paddingVertical: spacing[2],
  },
  optionTitle: {
    fontSize: 15,
    color: colors.text.primary,
  },
  optionSub: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  match: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  primary: {
    marginTop: spacing[3],
  },
  secondary: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[500],
  },
})
