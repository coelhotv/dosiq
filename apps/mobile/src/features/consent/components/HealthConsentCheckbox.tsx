// HealthConsentCheckbox.tsx — opt-in DESTACADO de dados de saúde (spec 046, T006, mobile).
//
// Mesmo contrato de props do bloco web (HealthConsentBlock): checked/onChange/disabled/
// showError. LGPD art. 11 exige consentimento ESPECÍFICO e DESTACADO — por isso este componente
// tem borda/fundo próprios, nunca um checkbox solto no meio do SignupScreen.
//
// Copy VERBATIM de HEALTH_CONSENT_COPY (@dosiq/core) — a política publicada cita o mesmo texto.

import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { HEALTH_CONSENT_COPY } from '@dosiq/core'
import DocumentViewer from '@shared/components/ui/DocumentViewer'
import { EXTERNAL_URLS } from '../../../shared/constants'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

interface HealthConsentCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** exibido quando o usuário tenta submeter sem marcar */
  showError?: boolean
}

export default function HealthConsentCheckbox({
  checked,
  onChange,
  disabled = false,
  showError = false,
}: HealthConsentCheckboxProps) {
  // 097 B-1: a política abre no visualizador do app (antes saía para o navegador no meio do cadastro).
  const [policyOpen, setPolicyOpen] = useState(false)

  // 065 PR D / US9: `consent_health_declined` APOSENTADO (payload vazio, sem origem, 7
  // ocorrências/180d) — a família consent_prompt_*/consent_granted/consent_blocked_attempt mede o
  // custo do consentimento com contexto real. Ver CON-034 §5.
  const handleToggle = () => {
    if (disabled) return
    onChange(!checked)
  }

  const openPolicy = () => setPolicyOpen(true)

  return (
    <View style={[styles.container, showError && styles.containerError]}>
      <Text style={[styles.title, showError && styles.titleError]}>
        {HEALTH_CONSENT_COPY.title}
      </Text>

      <Pressable
        onPress={handleToggle}
        disabled={disabled}
        style={styles.row}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={HEALTH_CONSENT_COPY.label}
        hitSlop={4}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <View style={styles.boxDot} /> : null}
        </View>
        <Text style={styles.label}>{HEALTH_CONSENT_COPY.label}</Text>
      </Pressable>

      <Text style={styles.helper}>
        {HEALTH_CONSENT_COPY.helper}{' '}
        <Text style={styles.link} onPress={openPolicy}>
          Ver política de privacidade
        </Text>
      </Text>

      {showError ? (
        <Text style={styles.errorText}>
          Para continuar, é preciso autorizar o tratamento dos dados de saúde.
        </Text>
      ) : null}

      <DocumentViewer
        source={policyOpen ? { kind: 'web', url: EXTERNAL_URLS.PRIVACY_POLICY } : null}
        title="Política de privacidade"
        onClose={() => setPolicyOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
  },
  containerError: {
    borderColor: colors.status.error,
    backgroundColor: colors.status.errorLight,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold,
  },
  titleError: {
    color: colors.status.error,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.card,
  },
  boxChecked: {
    backgroundColor: colors.primary[600],
  },
  boxDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.text.inverse,
  },
  label: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  helper: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  link: {
    color: colors.primary[600],
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.status.error,
  },
})
