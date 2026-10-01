import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as LucideIcons from 'lucide-react-native'
import { getInjectionSiteLabel } from '@dosiq/core'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import BodyMapSelector from './BodyMapSelector'

// d.ts local do lucide é parcial — mesmo padrão dos hosts
const { MapPin, ChevronDown, ChevronUp } = LucideIcons as any

/**
 * Bloco de sítio de injeção (031/US1) — única cópia, usada no registro único, no lote e na
 * edição do histórico (071, extração E-5). Accordion fechado por padrão e aberto na edição ou
 * no lote com uma única injeção marcada (071, D-2/D-5): o campo é opcional e não pode poluir quem
 * só confirma a dose. Fechado, o subtexto mostra o valor escolhido ou a última aplicação —
 * fechar nunca esconde o que foi registrado. Aberto: mapa corporal com última aplicação, alerta
 * não-bloqueante de repetição e hint de absorção (031/US2-US4, não-SaMD). O container vem do host.
 */
export default function InjectionSitePicker({
  value,
  onChange,
  disabled = false,
  lastInjectionSite = null,
  style = null,
  defaultOpen = false,
  faceWidth,
}: {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  lastInjectionSite?: string | null
  style?: object | null
  /** Abre expandido: edição (D-2) ou lote com exatamente 1 injeção marcada (D-5). */
  defaultOpen?: boolean
  faceWidth?: number
}) {
  // States
  const [open, setOpen] = useState(defaultOpen)

  const subtitle = value
    ? getInjectionSiteLabel(value)
    : lastInjectionSite
      ? `Última: ${getInjectionSiteLabel(lastInjectionSite)}`
      : 'Não informado'

  return (
    <View style={[styles.section, value && styles.sectionFilled, style]}>
      <Pressable
        style={styles.toggle}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Local de aplicação, opcional. ${subtitle}`}
        accessibilityState={{ expanded: open }}
        testID="injection-site-toggle"
      >
        <MapPin size={18} color={colors.primary[700]} strokeWidth={2} />
        <View style={styles.toggleText}>
          <Text style={styles.title}>
            Local de aplicação <Text style={styles.optional}>· opcional</Text>
          </Text>
          <Text style={[styles.subtitle, value && styles.subtitleFilled]}>{subtitle}</Text>
        </View>
        {open ? (
          <ChevronUp size={18} color={colors.text.secondary} strokeWidth={2} />
        ) : (
          <ChevronDown size={18} color={colors.text.secondary} strokeWidth={2} />
        )}
      </Pressable>
      {open && (
        <View style={styles.panel}>
          <BodyMapSelector
            value={value}
            onChange={onChange}
            lastUsedSite={lastInjectionSite}
            disabled={disabled}
            faceWidth={faceWidth}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  sectionFilled: {
    borderColor: colors.brand.primary,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[3],
  },
  toggleText: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  optional: { fontWeight: '400', color: colors.text.muted },
  subtitle: { fontSize: 12, color: colors.text.secondary },
  subtitleFilled: { color: colors.primary[700], fontWeight: '700' },
  panel: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
})
