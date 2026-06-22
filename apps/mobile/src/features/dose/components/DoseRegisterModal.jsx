// DoseRegisterModal.jsx — modal nativo para registo de dose tomada
// UX: modal simples com protocolo pré-seleccionado + quantidade + confirmação
// R5-003: menor fricção possível — mínimo de toques
// R5-008: online-first — doseService retorna erro claro se offline

import { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import {
  getNow,
  formatActiveIngredientFormula,
  isLiquidMedicine,
  formatIntakeDose,
  isInjectable,
  INJECTION_SITES,
  getInjectionSiteAbsorption,
  getInjectionSiteLabel,
} from '@dosiq/core'
import { registerDose, getLastInjectionSite } from '../services/doseService'
import { AlertTriangle } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { useOnlineStatus } from '@shared/hooks/useOnlineStatus'

/**
 * @param {{
 *   visible: boolean,
 *   protocol: Object|null,       — protocolo seleccionado
 *   scheduledTime: string|null,  — horário agendado da dose
 *   medicineName: string,
 *   onClose: Function,
 *   onSuccess: Function,         — chamado após registo bem-sucedido
 * }} props
 */
/** Seletor de sítio de injeção (chips) — só renderizado p/ injetáveis (031/US1). */
function InjectionSitePicker({ value, onChange, disabled, lastInjectionSite }) {
  const absorption = getInjectionSiteAbsorption(value)
  // US3: selecionar = último global → alerta NÃO-bloqueante (dose confirma sempre).
  const repeated = value && lastInjectionSite && value === lastInjectionSite
  return (
    <View style={styles.siteSection}>
      <Text style={styles.label}>Local de aplicação (opcional)</Text>
      {lastInjectionSite && (
        <Text style={styles.siteLast}>
          Última aplicação: <Text style={styles.siteLastValue}>{getInjectionSiteLabel(lastInjectionSite)}</Text>
        </Text>
      )}
      <View style={styles.siteChips}>
        {INJECTION_SITES.map((site) => {
          const selected = value === site.value
          return (
            <Pressable
              key={site.value}
              style={[styles.siteChip, selected && styles.siteChipSelected]}
              onPress={() => onChange(selected ? null : site.value)}
              disabled={disabled}
            >
              <Text style={[styles.siteChipText, selected && styles.siteChipTextSelected]}>
                {site.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {repeated && (
        <View style={styles.siteAlert} accessibilityRole="alert">
          <AlertTriangle size={14} color={colors.status.warning} strokeWidth={2} />
          <Text style={styles.siteAlertText}>Mesmo local da última aplicação — considere rotacionar.</Text>
        </View>
      )}
      {absorption && <Text style={styles.siteHint}>{absorption}</Text>}
    </View>
  )
}

export default function DoseRegisterModal({
  visible,
  protocol,
  scheduledTime,
  instanceId = null,
  medicineName,
  onClose,
  onSuccess
}) {
  // States primeiro (R-010)
  const [quantity, setQuantity] = useState('')
  const [injectionSite, setInjectionSite] = useState(null)
  const [lastInjectionSite, setLastInjectionSite] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { isOnline } = useOnlineStatus()

  // US2: último sítio GLOBAL p/ exibir + alerta de repetição. Best-effort (null em erro).
  // Sem reset síncrono: o picker só renderiza p/ injetável e o fetch sobrescreve.
  useEffect(() => {
    let alive = true
    if (visible && isInjectable(protocol?.medicine)) {
      getLastInjectionSite().then((s) => { if (alive) setLastInjectionSite(s) })
    }
    return () => { alive = false }
  }, [visible, protocol])

  if (!protocol) return null

  const defaultQty = String(protocol.dosage_per_intake ?? 1)

  // Líquidos (022): dose na unidade de tomada (gotas/ml/UI via protocol.intake_unit);
  // hint converte p/ ml. Sólido mantém unidades + equivalência de princípio ativo.
  const medicine = protocol.medicine
  const isLiquid = isLiquidMedicine(medicine)
  // 031: sítio de injeção só p/ injetável (presentation==='injetavel'); opcional.
  const injectable = isInjectable(medicine)
  const intakeUnit = protocol.intake_unit || (isLiquid ? 'ml' : null)
  const qtyLabel = isLiquid
    ? `Quantidade (${intakeUnit})`
    : medicine?.dosage_unit === 'gotas'
      ? 'Quantidade (gotas)'
      : 'Quantidade (unidades)'

  async function handleConfirm() {
    if (!isOnline) {
      setError('Não é possível registar sem ligação à internet.')
      return
    }

    setLoading(true)
    setError(null)

    const qty = parseFloat((quantity ?? defaultQty).toString().replace(',', '.'))
    if (!qty || qty <= 0) {
      setError('Quantidade deve ser maior que zero.')
      setLoading(false)
      return
    }

    // Padrão do projecto: timestamps sempre em UTC (getNow().toISOString())
    const takenAt = getNow().toISOString()

    const result = await registerDose(
      {
        protocol_id: protocol.id,
        medicine_id: protocol.medicine_id,
        taken_at: takenAt,
        quantity_taken: qty,
        injection_site: injectable ? injectionSite : null,
      },
      // F4.3c: âncora direta na ocorrência da timeline (determinística); null → snap.
      { instanceId }
    )

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    // Limpar estado e notificar tela pai
    setQuantity('')
    setInjectionSite(null)
    setError(null)
    onSuccess()
  }

  function handleClose() {
    setQuantity('')
    setInjectionSite(null)
    setError(null)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.titleCol}>
              <Text style={styles.title}>Tomar dose</Text>
              <Text style={styles.medicineName}>{medicineName}</Text>
            </View>
            {scheduledTime && (
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{scheduledTime}</Text>
              </View>
            )}
          </View>

          <Text style={styles.label}>{qtyLabel}</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder={defaultQty}
            placeholderTextColor={colors.text.muted}
            keyboardType="decimal-pad"
            editable={!loading}
            selectTextOnFocus
          />
          {isLiquid ? (
            <Text style={styles.formulaHint}>
              ✨ {formatIntakeDose(quantity || defaultQty, intakeUnit, medicine)}
            </Text>
          ) : medicine?.dosage_per_pill ? (
            <Text style={styles.formulaHint}>
              ✨ {formatActiveIngredientFormula(quantity || defaultQty, medicine.dosage_per_pill, medicine.dosage_unit)}
            </Text>
          ) : null}

          {injectable && (
            <InjectionSitePicker
              value={injectionSite}
              onChange={setInjectionSite}
              disabled={loading}
              lastInjectionSite={lastInjectionSite}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>

            <Pressable
              style={[styles.confirmBtn, loading && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.confirmText}>Confirmar</Text>
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[6],
    gap: spacing[3],
    paddingBottom: spacing[8],
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  medicineName: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  timeBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  timeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  input: {
    backgroundColor: colors.bg.screen,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.text.primary,
  },
  formulaHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[700],
    marginTop: spacing[1],
  },
  error: {
    color: colors.status.error,
    fontSize: 13,
  },
  siteSection: {
    gap: spacing[2],
  },
  siteChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  siteChip: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.screen,
  },
  siteChipSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.primary[50],
  },
  siteChipText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  siteChipTextSelected: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  siteHint: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  siteLast: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  siteLastValue: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  siteAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.warningLight,
  },
  siteAlertText: {
    flex: 1,
    fontSize: 12,
    color: colors.status.warning,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
})
