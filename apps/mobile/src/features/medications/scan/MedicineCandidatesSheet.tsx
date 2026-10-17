// MedicineCandidatesSheet — "É este que você já tem?" depois da leitura da caixa (spec 066 D1 · D-4,
// aceito pelo PO 2026-10-16). Sobretudo no genérico: sem a pergunta, cada compra de um laboratório
// diferente viraria um cadastro novo do mesmo remédio.
//
// O app nunca decide sozinho (FR-015): "Sim, é este" exige escolher um candidato e não cria nada;
// "Não, cadastrar como novo" segue para o form; ✕ sai sem gravar (INV-1). Sem candidato na lista do
// usuário, avisa `onNoCandidates` e não aparece. Os rótulos de semelhança são texto, sem cor (SaMD).

import { useEffect, useMemo, useState } from 'react'
import { Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 (ver TreatmentsScreen.tsx)
import * as LucideIcons from 'lucide-react-native'
import { formatStrength, type CmedMedicineDraft } from '@dosiq/core'
import PrimaryButton from '@shared/components/ui/PrimaryButton'
import { useMedicines } from '@medications/hooks/useMedicines'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { selectionTap } from '@shared/utils/haptics'
import { findScanCandidates } from './scanCandidates'

const { X, ScanBarcode } = LucideIcons as any

const MATCH_LABEL = { identico: 'idêntico', proximo: 'parecido' }

interface MedicineCandidatesSheetProps {
  draft: CmedMedicineDraft
  onUseExisting: (medicine: any) => void
  onCreateNew: () => void
  onNoCandidates: () => void
  onClose: () => void
}

function medicineLabel(medicine: any): string {
  // dosage_per_pill chega do banco como numeric (pode vir string).
  const raw = medicine?.dosage_per_pill
  const dose = formatStrength(null, raw === null || raw === undefined || raw === '' ? null : Number(raw), medicine?.dosage_unit ?? null)
  return [medicine?.name, dose].filter(Boolean).join(' ')
}

export function MedicineCandidatesSheet({
  draft,
  onUseExisting,
  onCreateNew,
  onNoCandidates,
  onClose,
}: MedicineCandidatesSheetProps) {
  // States
  const { data: medicines, loading } = useMedicines()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Memos
  const candidates = useMemo(() => findScanCandidates(draft, medicines ?? []), [draft, medicines])
  const settled = !loading || (medicines ?? []).length > 0
  const visible = settled && candidates.length > 0

  // Effects
  // FM-7: só conclui "sem candidato" com a lista carregada — lista ainda chegando não pula a pergunta.
  useEffect(() => {
    if (settled && candidates.length === 0) onNoCandidates()
  }, [settled, candidates.length, onNoCandidates])

  // Handlers
  function handleConfirm() {
    const chosen = candidates.find((c) => c.medicine?.id === selectedId)
    if (chosen) onUseExisting(chosen.medicine)
  }

  const boxLine = [draft.displayLaboratory, draft.boxQuantity ? `caixa com ${draft.boxQuantity}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar sem salvar" />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            É este que você já tem?
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fechar sem salvar">
            <X size={22} color={colors.text.primary} />
          </Pressable>
        </View>
        <Text style={styles.body}>
          Achamos um remédio parecido na sua lista. Assim você não fica com dois cadastros do mesmo remédio.
        </Text>

        <Text style={styles.section}>A caixa lida:</Text>
        <View style={styles.box}>
          <ScanBarcode size={18} color={colors.primary[700]} />
          <View style={styles.boxText}>
            <Text style={styles.boxTitle}>{[draft.name, draft.strengthLabel].filter(Boolean).join(' ')}</Text>
            {boxLine ? <Text style={styles.boxSub}>{boxLine}</Text> : null}
          </View>
        </View>

        <Text style={styles.section}>Seus remédios parecidos:</Text>
        {candidates.map(({ medicine, match }) => {
          const selected = medicine?.id === selectedId
          return (
            <Pressable
              key={medicine?.id}
              onPress={() => {
                selectionTap()
                setSelectedId(medicine?.id ?? null)
              }}
              style={[styles.option, selected && styles.optionSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${medicineLabel(medicine)}, ${MATCH_LABEL[match]}`}
            >
              <View style={[styles.radio, selected && styles.radioOn]} />
              <Text style={styles.optionText}>{medicineLabel(medicine)}</Text>
              <Text style={styles.match}>{MATCH_LABEL[match]}</Text>
            </Pressable>
          )
        })}

        <PrimaryButton label="Sim, é este" onPress={handleConfirm} disabled={!selectedId} style={styles.primary} />
        <Pressable onPress={onCreateNew} hitSlop={8} accessibilityRole="button" style={styles.secondary}>
          <Text style={styles.secondaryText}>Não, cadastrar como novo</Text>
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
  },
  title: {
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
    fontSize: 15,
    color: colors.text.primary,
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
    paddingVertical: spacing[2],
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[500],
  },
})
