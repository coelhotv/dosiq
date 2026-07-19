import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { BarChart3, ChevronRight } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

/**
 * EvolutionSwitchCard — CTA de troca de medicamento no Hoje (spec 029 F5 / T024 · Decisões §3).
 *
 * Posição: ABAIXO da Adesão, na área do priority dose card (§2.8) — é "ação para agora".
 *
 * 🎨 Borda `primarySoft`, NUNCA amber: amber é reservado ao "Confirmar agora" de pendências de
 * DOSE. Uma troca de etapa não é uma dose atrasada, e pintar as duas igual ensina o usuário a
 * ignorar as duas. Sem countdown, sem vermelho, sem urgência artificial (SaMD/ADR-062).
 *
 * Dois estados (R-239 — nudge, não nag):
 *   - `showCta` → card completo com `[Iniciar etapa]` `[Ainda não]` (§3.1)
 *   - senão     → 1 LINHA neutra, sem botões; tocar abre o tratamento (§3.2). A partir do dia 3
 *                 ganha a frase de contexto. Nada pisca, nada cobra, o push não se repete.
 *
 * A linha neutra NÃO ganha CTA: ela é o estado DEPOIS do "Ainda não" (ou do dia 0 vencido), e
 * devolver um botão de avanço desfaz a única coisa que o adiamento conquistou. O toque leva ao
 * tratamento — controle canônico da evolução — e o chevron existe para tornar isso visível.
 *
 * A11y: região, NÃO alerta (§9) — "Evolução do tratamento: etapa 2 começa hoje". O estado
 * pendente tem rótulo textual, não depende do ícone teal.
 */
interface EvolutionSwitchCardProps {
  /** Número da etapa que começa (1-based — a UI nunca mostra `position`). */
  stepNumber: number
  /** Nome do medicamento da etapa que começa. Nunca "caneta" (§0). */
  medicineName: string
  /** Dose já formatada em pt-BR (ex.: "0,5 mg"). Vazio esconde a pill. */
  doseLabel?: string
  /** Medicamento que SEGUE regendo os lembretes até a confirmação (frase do dia 3). */
  currentMedicineName: string
  /** Dia do vencimento, já formatado (ex.: "9 jul") — "desde {sinceLabel}". */
  sinceLabel: string
  /** Card completo com os 2 botões vs. linha neutra. */
  showCta: boolean
  /** Dia 3+: a linha neutra ganha a frase de contexto (§3.2). */
  showContext: boolean
  /** `[Iniciar etapa]` → confirma o switch (RPC). */
  onStart: () => void
  /** `[Ainda não]` → rebaixa para a linha neutra. NÃO escreve no servidor. */
  onPostpone: () => void
  /** Toque na linha neutra → abre o tratamento. */
  onOpen: () => void
}

export default function EvolutionSwitchCard({
  stepNumber,
  medicineName,
  doseLabel,
  currentMedicineName,
  sinceLabel,
  showCta,
  showContext,
  onStart,
  onPostpone,
  onOpen,
}: EvolutionSwitchCardProps) {
  // Estado pendente (§3.2): 1 linha neutra, sem botões.
  if (!showCta) {
    return (
      <Pressable
        style={({ pressed }) => [styles.pendingRow, pressed && styles.pressed]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Etapa ${stepNumber} aguardando você, ${medicineName}, desde ${sinceLabel}. Toque para abrir o tratamento e iniciar a etapa.`}
      >
        <View style={styles.pendingDot} />
        <View style={styles.pendingText}>
          <Text style={styles.pendingTitle}>Etapa {stepNumber} aguardando você</Text>
          <Text style={styles.pendingSubtitle}>
            {medicineName} · desde {sinceLabel}
          </Text>
          {/* "por aqui" era MENTIRA: esta linha não inicia nada — ela navega para o tratamento,
              que é onde o controle vive (§7.2). A linha continua SEM botão de propósito (§3.2 /
              R-239: depois do "Ainda não" o app não cobra de novo); o que faltava era a copy
              dizer para onde o toque leva, e o chevron tornar visível o toque que já existia
              (o accessibilityLabel abaixo já dizia — só quem enxerga ficava sem a pista). */}
          {showContext && (
            <Text style={styles.pendingContext}>
              Os lembretes seguem na {currentMedicineName}. Quando o medicamento novo chegar, abra
              o tratamento para iniciar a etapa.
            </Text>
          )}
        </View>
        <View style={styles.pendingChevron}>
          <ChevronRight size={18} color={colors.text.secondary} strokeWidth={2} />
        </View>
      </Pressable>
    )
  }

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`Evolução do tratamento: etapa ${stepNumber} começa hoje`}
    >
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <BarChart3 size={22} color={colors.brand.primary} strokeWidth={2} />
        </View>
        <View style={styles.text}>
          <Text style={styles.eyebrow}>Evolução do tratamento</Text>
          <Text style={styles.title}>Etapa {stepNumber} começa hoje</Text>
          <View style={styles.medicineRow}>
            <Text style={styles.medicine}>{medicineName}</Text>
            {!!doseLabel && (
              <View style={styles.dosePill}>
                <Text style={styles.dosePillText}>{doseLabel}</Text>
              </View>
            )}
          </View>
          {/* SaMD: executivo-factual da prescrição cadastrada — nunca "recomendada". */}
          <Text style={styles.subtitle}>Como prescrito pelo seu médico.</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={`Iniciar etapa ${stepNumber}, ${medicineName}`}
        >
          <Text style={styles.ctaPrimaryText}>Iniciar etapa</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.ctaNeutral, pressed && styles.pressed]}
          onPress={onPostpone}
          accessibilityRole="button"
          accessibilityLabel="Ainda não iniciar esta etapa"
        >
          <Text style={styles.ctaNeutralText}>Ainda não</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ≥48dp nos CTAs de confirmação (§9): paddingVertical 14 + lineHeight 20 ≈ 48.
const CTA_MIN_HEIGHT = 48

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    // primarySoft — NUNCA amber (reservado a pendências de dose).
    borderColor: colors.primary[100],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginHorizontal: 20,
    marginBottom: spacing[4],
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.brand.primary,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: typography.fontFamily.medium || 'System',
    color: colors.text.primary,
    marginBottom: 4,
    lineHeight: 22,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap', // Dynamic Type: quebra sem truncar a dose (§9)
    gap: spacing[2],
    marginBottom: 4,
  },
  medicine: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dosePill: {
    backgroundColor: colors.brand.mint,
    borderRadius: borderRadius.full,
    paddingVertical: 2,
    paddingHorizontal: spacing[2],
  },
  dosePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  ctaPrimary: {
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    minHeight: CTA_MIN_HEIGHT,
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  ctaNeutral: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    minHeight: CTA_MIN_HEIGHT,
    justifyContent: 'center',
  },
  ctaNeutralText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  pressed: { opacity: 0.85 },

  // Estado pendente: linha neutra, sem botões (§3.2).
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginHorizontal: 20,
    marginBottom: spacing[4],
    minHeight: 44,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
    marginTop: 6,
  },
  pendingText: { flex: 1 },
  // A linha alinha o conteúdo em flex-start (o texto pode ter 3 linhas); o chevron centraliza
  // sozinho para não ficar colado no topo.
  pendingChevron: { alignSelf: 'center' },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 20,
  },
  pendingSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  pendingContext: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginTop: 4,
  },
})
