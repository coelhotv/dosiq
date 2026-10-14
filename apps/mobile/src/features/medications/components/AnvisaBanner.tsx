// AnvisaBanner — topo do cadastro de medicamento: preenchimento pela lista oficial da ANVISA
// (spec 066 Slice C · DESIGN_DECISOES C5.3, validado pelo PO 2026-10-13).
//
// Vazio: card com selo "Lista oficial da ANVISA" + campo de busca falso (abre o sheet) + divisor
// "ou preencha à mão". Preenchido: o card encolhe para o selo de origem + "Trocar".
// O selo afirma a ORIGEM do dado, nunca qualidade (ADR-062). Na D1 o "Ler o código de barras"
// entra como 2º botão DENTRO deste mesmo card (`children`), com o mesmo peso da busca.
// Componente puro (sem state, sem effects).

import type { ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 (ver TreatmentsScreen.tsx)
import * as LucideIcons from 'lucide-react-native'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'
import { lightTap } from '@shared/utils/haptics'

const { Search, ShieldCheck } = LucideIcons as any

interface AnvisaBannerProps {
  onPress: () => void
  /** Rótulo do que foi preenchido pela busca (nome + concentração). Ausente = estado vazio. */
  filledLabel?: string | null
  /** Ações extras no mesmo card (D1: botão do código de barras). */
  children?: ReactNode
}

export function AnvisaBanner({ onPress, filledLabel = null, children = null }: AnvisaBannerProps) {
  const handlePress = () => {
    lightTap()
    onPress?.()
  }

  if (filledLabel) {
    return (
      <View style={[styles.card, styles.filledCard]}>
        <View style={styles.filledText}>
          <View style={styles.seal}>
            <ShieldCheck size={14} color={colors.primary[700]} strokeWidth={2.5} />
            <Text style={styles.sealText}>Preenchido pela lista da ANVISA</Text>
          </View>
          <Text style={styles.filledLabel} numberOfLines={2}>
            {filledLabel}
          </Text>
        </View>
        <Pressable onPress={handlePress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Trocar remédio">
          <Text style={styles.change}>Trocar</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.seal}>
          <ShieldCheck size={14} color={colors.primary[700]} strokeWidth={2.5} />
          <Text style={styles.sealText}>Lista oficial da ANVISA</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.fakeInput, pressed && styles.fakeInputPressed]}
          onPress={handlePress}
          accessibilityRole="search"
          accessibilityLabel="Buscar remédio pelo nome"
        >
          <Search size={20} color={colors.primary[700]} strokeWidth={2.5} />
          <Text style={styles.placeholder}>Buscar remédio pelo nome</Text>
        </Pressable>
        {children}
        <Text style={styles.support}>Preenche nome, concentração e apresentação com os dados oficiais.</Text>
      </View>
      <View style={styles.divider} accessibilityRole="text">
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou preencha à mão</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.sm,
  },
  filledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  filledText: {
    flex: 1,
    gap: spacing[1],
  },
  seal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  sealText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[700],
    letterSpacing: 0.2,
  },
  fakeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.neutral[100],
  },
  fakeInputPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  placeholder: {
    flex: 1,
    fontSize: 16,
    color: colors.text.secondary,
  },
  support: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  filledLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  change: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[500],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginVertical: spacing[4],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
})
