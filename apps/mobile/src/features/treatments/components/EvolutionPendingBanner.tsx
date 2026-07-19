// EvolutionPendingBanner.tsx — troca de etapa pendente, na tela do TRATAMENTO (spec 029 §7.2).
// Componente PURO de apresentação: sem rede, sem hook de dados, sem navegação própria — só props
// e callbacks. Vive DENTRO do card da timeline, ANTES da timeline na ordem de leitura.
//
// 🔴 APARECE EM QUALQUER DIA DE ESPERA, inclusive no dia 0. O gate antigo (`daysWaiting >= 1`)
// existia para não repetir no mesmo dia o aviso que o card do Hoje já dava — mas o "Ainda não"
// derruba o card do Hoje e NÃO escreve nada no servidor, então quem adiava de manhã ficava sem
// NENHUMA superfície para iniciar a etapa até o dia seguinte. Caso real e comum: "adiei porque a
// caneta não chegou; chegou à tarde".
//
// A separação certa é por INTENÇÃO, não por dia:
//   • Hoje = push (interrompe) → respeita o "Ainda não", some no dia 0.
//   • Tratamento = pull (o usuário foi lá de propósito) → é a fonte canônica de controle do
//     tratamento (ativar/pausar/editar). CTA aqui nunca é nag; esconder o controle é que é furo.
//
// 🔴 AÇÃO ÚNICA — `[Iniciar etapa N]`. O §7.2 original previa uma segunda saída, `[Ajustar
// duração]`, para "estender a etapa vigente sem forçar o avanço". Essa saída NUNCA foi
// implementável: a etapa vigente é congelada tanto no formulário (`FROZEN_STATUS` inclui
// `current`) quanto na escrita (`EDITABLE_STATUSES` = upcoming + pending_confirmation). O botão
// abria um form onde a única duração relevante não podia ser tocada — promessa que a tela não
// cumpria. Decisão do PO no smoke do F5: este banner é sobre AVANÇAR a etapa; editar a escada
// sempre esteve e continua disponível na edição do tratamento, que é o lugar dela.
// Não readicionar sem antes tornar a vigente editável de verdade.
//
// Dois tons, ambos derivados de `daysWaiting` — nunca props separadas, que poderiam dessincronizar:
//   • dia 0  → teal/mint, "pode começar hoje" — informativo, o prazo chegou agora.
//   • dia 1+ → amber contido, "aguardando desde …" — workflow atrasado, não perigo.
// Estado NUNCA só por cor — título e corpo carregam o rótulo textual junto do acento.

import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Clock } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

interface EvolutionPendingBannerProps {
  /** Número (1-based) da etapa aguardando início. */
  stepNumber: number
  /** Data de vencimento já formatada (ex.: "12 jul"), calculada fora do componente. */
  sinceLabel: string
  /** Dias corridos aguardando. `0` = venceu hoje (tom teal); `>= 1` = atrasada (tom amber). */
  daysWaiting: number
  /**
   * Medicamento da etapa que COMEÇA, já com concentração (`formatMedicineFullName`).
   * Numa escada o nome se repete em todas as etapas — só a concentração identifica qual é.
   */
  nextMedicineName: string
  /** Medicamento vigente, com concentração — os lembretes continuam nele até o usuário agir. */
  currentMedicineName: string
  /** "Iniciar etapa N" — avança a evolução para a etapa pendente. AÇÃO ÚNICA (ver cabeçalho). */
  onStart: () => void
}

export default function EvolutionPendingBanner({
  stepNumber,
  sinceLabel,
  daysWaiting,
  nextMedicineName,
  currentMedicineName,
  onStart,
}: EvolutionPendingBannerProps) {
  const isToday = daysWaiting === 0
  const daysLabel = daysWaiting === 1 ? '1 dia' : `${daysWaiting} dias`
  const title = isToday
    ? `Etapa ${stepNumber} pode começar hoje`
    : `Etapa ${stepNumber} aguardando desde ${sinceLabel} · ${daysLabel}`
  // Copy INSTRUTIVA, não afago: o texto anterior ("Sem pressa — a evolução é sua") era simpático
  // e não dizia o que fazer nem qual medicamento entra. Aqui o usuário precisa de 3 fatos: qual
  // medicamento passa a valer, qual continua valendo até lá, e que a troca só acontece se ELE
  // tocar no botão (o app nunca avança sozinho num medicine_switch — Decisões §7.2/§10).
  const body =
    `Quando o ${nextMedicineName} estiver com você, toque em "Iniciar etapa ${stepNumber}". ` +
    `Até lá os lembretes seguem no ${currentMedicineName} — nada muda sozinho.`

  return (
    <View
      style={[styles.banner, isToday ? styles.bannerToday : styles.bannerOverdue]}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${body}`}
    >
      <View style={styles.header}>
        <Clock
          size={17}
          color={isToday ? colors.brand.primary : colors.status.warning}
          strokeWidth={1.9}
        />
        <Text style={[styles.title, isToday ? styles.titleToday : styles.titleOverdue]}>
          {title}
        </Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.ctaPrimary,
            isToday ? styles.ctaPrimaryToday : styles.ctaPrimaryOverdue,
            pressed && styles.ctaPressed,
          ]}
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
  },
  bannerToday: {
    backgroundColor: colors.brand.mint,
    borderColor: colors.primary[100],
  },
  bannerOverdue: {
    backgroundColor: colors.status.warningLight,
    borderColor: colors.status.warningLight,
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
    fontFamily: typography.fontFamily.medium || 'System',
  },
  titleToday: {
    color: colors.brand.primary,
  },
  titleOverdue: {
    color: colors.status.warning,
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
  },
  ctaPrimaryToday: {
    backgroundColor: colors.brand.primary,
  },
  ctaPrimaryOverdue: {
    backgroundColor: colors.status.warning,
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
