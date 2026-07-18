// TitrationStepBuilder.tsx — builder "Nova etapa" do cadastro da escada (spec 029 F4 / T019).
// Mock: titration-screens.jsx › StepBuilder. UX ÚNICA (T019b): a etapa sempre lidera com o
// medicamento (mesmo sheet ANVISA do tratamento); o tipo dose_change/medicine_switch é DERIVADO
// pelos serviços comparando medicine_id (ADR-080) — nunca um toggle "tipo de transição" na UI.

import { View, Text, Pressable, Switch, StyleSheet } from 'react-native'
 
import * as LucideIcons from 'lucide-react-native'
import { formatDoseHint } from '@dosiq/core'
import FormInput from '@shared/components/form/FormInput'
import MedicineSelectorRow from '@treatments/components/MedicineSelectorRow'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const { Check, Layers } = LucideIcons as any

 
type Medicine = any

interface Props {
  positionLabel: string // "Nova etapa · 2" | "Editando etapa 3"
  medicine: Medicine | null
  doseRaw: string
  durationWeeksRaw: string
  continua: boolean
  doseSuffix: string
  canDuplicate: boolean
  error: string | null
  onOpenMedicineSheet: () => void
  onDoseChange: (raw: string) => void
  onDurationChange: (raw: string) => void
  onToggleContinua: (next: boolean) => void
  onDuplicate: () => void
  onCommit: () => void
}

export default function TitrationStepBuilder({
  positionLabel,
  medicine,
  doseRaw,
  durationWeeksRaw,
  continua,
  doseSuffix,
  canDuplicate,
  error,
  onOpenMedicineSheet,
  onDoseChange,
  onDurationChange,
  onToggleContinua,
  onDuplicate,
  onCommit,
}: Props) {
  // Hint de equivalência (§4.2 — padrão dos forms de dose). Só quando há medicamento + dose.
  const doseNum = Number(String(doseRaw).replace(',', '.'))
  const intakeUnit = doseSuffix === 'comprimido(s)' ? 'cp' : doseSuffix
  const hint =
    medicine && Number.isFinite(doseNum) && doseNum > 0
      ? formatDoseHint(doseNum, intakeUnit, medicine)
      : null

  return (
    <View style={styles.builder}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{positionLabel}</Text>
        {canDuplicate ? (
          <Pressable
            onPress={onDuplicate}
            style={styles.duplicateBtn}
            accessibilityRole="button"
            accessibilityLabel="Duplicar etapa anterior"
            hitSlop={8}
          >
            <Layers size={15} color={colors.primary[700]} strokeWidth={2.2} />
            <Text style={styles.duplicateText}>Duplicar etapa anterior</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Medicamento</Text>
        <MedicineSelectorRow medicine={medicine} onPress={onOpenMedicineSheet} error={null} />
      </View>

      <View style={styles.row}>
        <View style={styles.doseField}>
          {/* Unidade no label (§9 a11y: "dose por tomada, em miligramas") — segue o medicamento. */}
          <FormInput
            name="step_dose"
            label={doseSuffix ? `Dose por tomada · ${doseSuffix}` : 'Dose por tomada'}
            value={doseRaw}
            onChange={(_name: string, raw: string) => onDoseChange(raw)}
            placeholder="0"
            keyboardType="decimal-pad"
            maxLength={10}
            helperText={hint ? `✨ ${hint}` : undefined}
            required
          />
        </View>
        <View style={styles.durationField}>
          <FormInput
            name="step_duration"
            label="Duração · semanas"
            value={continua ? '' : durationWeeksRaw}
            onChange={(_name: string, raw: string) => onDurationChange(raw)}
            placeholder={continua ? '—' : '0'}
            keyboardType="number-pad"
            maxLength={3}
            disabled={continua}
          />
        </View>
      </View>

      <View style={styles.continuaRow}>
        <View style={styles.continuaText}>
          <Text style={styles.continuaTitle}>Etapa contínua</Text>
          <Text style={styles.continuaHint}>Sem fim — vale até o médico mudar a prescrição</Text>
        </View>
        <Switch
          value={continua}
          onValueChange={onToggleContinua}
          trackColor={{ false: colors.neutral[300], true: colors.primary[500] }}
          thumbColor={colors.bg.card}
          accessibilityLabel="Etapa contínua"
          accessibilityState={{ checked: continua }}
        />
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={onCommit}
        style={({ pressed }) => [styles.commitBtn, pressed && styles.commitBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Gravar etapa"
      >
        <Check size={18} color={colors.primary[700]} strokeWidth={2.4} />
        <Text style={styles.commitText}>Gravar etapa</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  builder: {
    // AP-163: RN não suporta borderStyle dashed com borderRadius (WARN "Unsupported dashed /
    // dotted border style"). Card sólido — a distinção de "área de rascunho" vem do bg + borda.
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    backgroundColor: colors.bg.card,
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  eyebrow: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  duplicateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing[1],
  },
  duplicateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary[700],
  },
  fieldGroup: {
    gap: spacing[2],
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  doseField: {
    flex: 2,
  },
  durationField: {
    flex: 1,
  },
  continuaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 44,
    paddingHorizontal: spacing[1],
  },
  continuaText: {
    flex: 1,
    gap: 2,
  },
  continuaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  continuaHint: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.status.error,
  },
  commitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  commitBtnPressed: {
    opacity: 0.85,
  },
  commitText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
  },
})
