import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { AlertTriangle } from 'lucide-react-native'
import { INJECTION_SITES, getInjectionSiteAbsorption, getInjectionSiteLabel } from '@dosiq/core'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

/**
 * Seletor de sítio de injeção (031/US1) — única cópia, usada no registro único, no lote e na
 * edição do histórico (071, extração E-5). Opcional e não-bloqueante: selecionar = último global
 * mostra alerta, nunca trava a dose (US3). Hint educacional de absorção (não-SaMD, ADR-062).
 * O container e o rótulo vêm do host (cada tela tem seu espaçamento).
 */
export default function InjectionSitePicker({
  value,
  onChange,
  disabled = false,
  lastInjectionSite = null,
  style = null,
  labelStyle = null,
}: {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  lastInjectionSite?: string | null
  style?: object | null
  labelStyle?: object | null
}) {
  const absorption = getInjectionSiteAbsorption(value)
  const repeated = !!value && !!lastInjectionSite && value === lastInjectionSite
  return (
    <View style={[styles.section, style]}>
      <Text style={[styles.label, labelStyle]}>Local de aplicação (opcional)</Text>
      {lastInjectionSite && (
        <Text style={styles.siteLast}>
          Última aplicação: <Text style={styles.siteLastValue}>{getInjectionSiteLabel(lastInjectionSite)}</Text>
        </Text>
      )}
      <View style={styles.siteChips}>
        {INJECTION_SITES.map((site) => {
          const isSel = value === site.value
          return (
            <Pressable
              key={site.value}
              style={[styles.siteChip, isSel && styles.siteChipSelected]}
              onPress={() => onChange(isSel ? null : site.value)}
              disabled={disabled}
            >
              <Text style={[styles.siteChipText, isSel && styles.siteChipTextSelected]}>
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

const styles = StyleSheet.create({
  section: {
    gap: spacing[2],
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  siteChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  siteChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  siteChipTextSelected: {
    color: colors.primary[700],
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
})
