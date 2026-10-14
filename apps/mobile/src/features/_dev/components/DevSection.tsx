// DevSection.tsx — blocos de UI do DevHub: uma seção por DOMÍNIO e um botão por gatilho.
//
// Convenção (docs/architecture/MOBILE_APP.md §DevHub): seção nova entra por domínio (Alarmes,
// Tratamento, Sessão, Layout…), nunca por número de spec; gatilho de spike sai quando a spec fecha.
// Botão que GRAVA em dados reais da conta logada declara `writesData` → marca 🔴 visível.

import type { ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { lightTap } from '@shared/utils/haptics'
import { colors, spacing } from '@shared/styles/tokens'

type DevSectionProps = {
  title: string
  /** Contexto curto do que a seção cobre (spec de origem, pré-condição). */
  note?: string
  children: ReactNode
}

export function DevSection({ title, note, children }: DevSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {children}
    </View>
  )
}

type DevButtonProps = {
  label: string
  onPress: () => void
  /** Grava em dados reais da conta logada (banco, escada, doses). */
  writesData?: boolean
}

export function DevButton({ label, onPress, writesData = false }: DevButtonProps) {
  return (
    <TouchableOpacity
      onPress={() => {
        lightTap()
        onPress()
      }}
      style={[styles.button, writesData && styles.buttonWrites]}
      accessibilityRole="button"
      accessibilityLabel={writesData ? `${label} (grava dados reais)` : label}
    >
      <Text style={styles.buttonText}>
        {writesData ? '🔴 ' : ''}
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export function DevNote({ children }: { children: ReactNode }) {
  return (
    <Text selectable style={styles.note}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  note: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: spacing[2],
    lineHeight: 16,
  },
  button: {
    backgroundColor: colors.bg.card,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonWrites: {
    borderColor: colors.status.error,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
})
