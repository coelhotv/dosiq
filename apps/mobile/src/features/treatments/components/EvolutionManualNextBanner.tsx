// EvolutionManualNextBanner.tsx — etapa cadastrada a partir de uma etapa CONTÍNUA (spec 029 F5.5
// / Decisões §7.4). Componente PURO de apresentação: sem rede, sem hook de dados, sem navegação
// própria. Vive dentro do card da timeline, ANTES da timeline na ordem de leitura.
//
// 🔴 POR QUE NÃO É O `EvolutionPendingBanner`. Aquele é sobre uma pendência **VENCIDA**: toda a
// copy e os dois tons derivam de `daysWaiting` ("aguardando desde 12 jul · 3 dias", amber a partir
// do dia 1). Aqui **não existe prazo** — a etapa contínua é a manutenção, e o gatilho é um EVENTO
// CLÍNICO (o médico mudou a prescrição), não uma data. Não há "desde", não há atraso, não há
// número de dias. Enfiar um modo dentro do outro obrigaria a inventar um `daysWaiting` falso e
// arriscaria regredir o banner do F5. Dois estados de mundo diferentes ⇒ dois componentes.
//
// 🔴 SEMPRE TEAL, nunca âmbar: nada está atrasado. Âmbar comunicaria urgência que não existe e
// pressionaria o paciente a titular sem indicação médica (SaMD, ADR-062).
//
// 🔴 SÓ NA TELA DO TRATAMENTO (pull), nunca no Hoje (push): sem prazo não há o que interromper.
// O Hoje segue silencioso — `resolvePendingSwitch` devolve `null` com vigente contínua e NÃO foi
// alterada (R-239: sem card, sem push, sem nag).
//
// Estado nunca só por cor (§9): título e corpo carregam o rótulo textual junto do acento.

import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { CalendarPlus } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

interface EvolutionManualNextBannerProps {
  /** Número (1-based) da etapa cadastrada, aguardando o toque. */
  stepNumber: number
  /**
   * Medicamento da etapa que COMEÇA, já com concentração (`formatMedicineFullName`).
   * Numa escada o nome se repete em todas as etapas — só a concentração identifica qual é.
   */
  nextMedicineName: string
  /** Medicamento vigente (contínuo), com concentração — os lembretes seguem nele até o toque. */
  currentMedicineName: string
  /** "Iniciar etapa N" — chama a mesma RPC do §7.2 (`confirm_titration_switch`). */
  onStart: () => void
}

export default function EvolutionManualNextBanner({
  stepNumber,
  nextMedicineName,
  currentMedicineName,
  onStart,
}: EvolutionManualNextBannerProps) {
  const title = `Etapa ${stepNumber} cadastrada`
  // Três fatos, como no banner do §7.2: qual medicamento passa a valer, qual continua valendo até
  // lá, e que nada acontece sem o toque. Sem prazo e sem cobrança — "quando seu médico indicar".
  const body =
    `Comece quando seu médico indicar: toque em "Iniciar etapa ${stepNumber}" para passar ao ` +
    `${nextMedicineName}. Até lá os lembretes seguem no ${currentMedicineName} — nada muda sozinho.`

  return (
    <View style={styles.banner} accessibilityRole="summary" accessibilityLabel={`${title}. ${body}`}>
      <View style={styles.header}>
        <CalendarPlus size={17} color={colors.brand.primary} strokeWidth={1.9} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.ctaPrimary, pressed && styles.ctaPressed]}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={`Iniciar etapa ${stepNumber}`}
        >
          <Text style={styles.ctaPrimaryText}>Iniciar etapa {stepNumber}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing[3],
    marginBottom: spacing[3],
    gap: spacing[2],
    backgroundColor: colors.brand.mint,
    borderColor: colors.primary[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand.primary,
    fontFamily: typography.fontFamily.medium || 'System',
  },
  body: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  ctaPrimary: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  ctaPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  ctaPressed: {
    opacity: 0.85,
  },
})
