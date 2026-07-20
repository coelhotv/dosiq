// TitrationTimeline.tsx — timeline da Evolução do tratamento no detalhe (spec 029 F4 / T020).
// Mock: titration-screens.jsx › EvoTimelineCard. UX ÚNICA: cada etapa lidera com o medicamento
// (a distinção dose_change/medicine_switch é dos serviços, nunca da UI). Estado NUNCA só por cor
// (§9): todo dot vem pareado com rótulo textual ("vigente"/"Concluída"/"prevista").
//
// A11y (§9): ordem de leitura = vigente → próxima → passadas (accessibilityElementsHidden não; a
// ordem visual é cronológica, mas cada etapa carrega rótulo composto legível isolado).

import { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import * as LucideIcons from 'lucide-react-native'
import { formatIntakeDose, formatMedicineFullName, parseISO, addDays, getTodayLocal, formatLocalDate, parseLocalDate, resolvePendingSwitch, resolveManualNextStep, resolveCurrentStep } from '@dosiq/core'
import SectionCard from '@shared/components/ui/SectionCard'
import EvolutionBadge from '@treatments/components/EvolutionBadge'
import EvolutionPendingBanner from '@treatments/components/EvolutionPendingBanner'
import EvolutionManualNextBanner from '@treatments/components/EvolutionManualNextBanner'
import EvolutionBrokenStepCard from '@treatments/components/EvolutionBrokenStepCard'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { useTitrationTimeline } from '@treatments/hooks/useTitrationTimeline'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import type { LadderStepWithMedicine } from '@treatments/services/titrationService'

const { Check, ArrowDownNarrowWide, Box } = LucideIcons as any

const MS_DAY = 24 * 60 * 60 * 1000
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmtDay(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]}`
}

interface TimelineStep {
  key: string
  kind: 'past' | 'current' | 'future'
  medName: string
  /** Nome + concentração ("Mounjaro 2,5 mg / 0,5 mL"). Para textos que precisam IDENTIFICAR o
   *  cadastro — nas linhas da timeline o nome puro basta, porque a dose aparece ao lado. */
  medFullName: string
  doseLabel: string
  statusLine: string
  continua: boolean
  medicineId: string | null
  /** Etapa ÓRFÃ (§7.3 / T026): o medicamento referenciado sumiu (excluído/arquivado). */
  broken: boolean
}

// Projeta datas caminhando a partir da etapa vigente (PURO). Passadas usam started_at/ended_at
// reais; a vigente projeta o fim por started_at + duration_days; futuras acumulam a partir daí.
// Datas via parseISO/addDays do core (nunca `new Date('YYYY-MM-DD')` — timezone, regra da casa).
// `todayLocal` = dia local do dono (YYYY-MM-DD), computado FRESCO a cada render (não capturado em
// useState) — senão a tela aberta atravessando a meia-noite usaria "hoje" velho (AP-W15). O
// "N dias restantes" conta dias de CALENDÁRIO local (AP-240), não blocos absolutos de 24h.
function buildTimeline(steps: LadderStepWithMedicine[], todayLocal: string): TimelineStep[] {
  const ordered = [...steps].sort((a, b) => a.position - b.position)
  // 🔴 A vigente vem de `resolveCurrentStep` (achado do RC6): `findIndex` pegaria a PRIMEIRA
  // `current`, e o banco não impede um resíduo numa posição anterior — a projeção das futuras e
  // o rótulo "aguardando você iniciar" sairiam ancorados na etapa errada, em silêncio.
  const currentStep = resolveCurrentStep(ordered)
  const currentIndex = currentStep ? ordered.findIndex((s) => s.id === currentStep.id) : -1
  const todayMs = parseLocalDate(todayLocal).getTime()

  // Ponto de partida da projeção das futuras = fim da etapa vigente (se finita).
  let projected: Date | null = null
  // F5.5: vigente CONTÍNUA = manutenção. Não há data de fim, logo nada é "previsto" — o que
  // vier depois só começa por decisão clínica + toque do usuário.
  let currentIsContinua = false
  if (currentIndex !== -1) {
    const cur = ordered[currentIndex]
    currentIsContinua = cur.duration_days == null
    if (cur.started_at && cur.duration_days && cur.duration_days > 0) {
      projected = addDays(parseISO(cur.started_at), cur.duration_days)
    }
  }

  return ordered.map((s, index): TimelineStep => {
    const medName = s.medicine?.name ?? 'Medicamento'
    const medFullName = formatMedicineFullName(s.medicine)
    const doseLabel = formatIntakeDose(s.dose, s.intake_unit, s.medicine)
    const continua = s.duration_days === null || s.duration_days === undefined
    // Órfã: o embed do medicamento voltou vazio (excluído/arquivado) — §7.3.
    const broken = s.medicine == null

    if (s.status === 'completed') {
      const start = s.started_at ? parseISO(s.started_at) : null
      const end = s.ended_at ? parseISO(s.ended_at) : null
      const span = start && end ? `${fmtDay(start)} – ${fmtDay(end)}` : ''
      return { key: s.id, kind: 'past', medName, medFullName, doseLabel, continua, broken, medicineId: s.medicine?.id ?? null, statusLine: span ? `Concluída · ${span}` : 'Concluída' }
    }

    if (s.status === 'current') {
      let statusLine = 'em curso'
      if (!continua && s.started_at && s.duration_days) {
        const end = addDays(parseISO(s.started_at), s.duration_days)
        // Dias de calendário local até o dia do fim (ambos ancorados na meia-noite local — AP-240).
        const endMs = parseLocalDate(formatLocalDate(end)).getTime()
        const daysLeft = Math.max(0, Math.round((endMs - todayMs) / MS_DAY))
        statusLine = daysLeft > 0 ? `${daysLeft} dias restantes · até ${fmtDay(end)}` : `até ${fmtDay(end)}`
      }
      return { key: s.id, kind: 'current', medName, medFullName, doseLabel, continua, broken, medicineId: s.medicine?.id ?? null, statusLine }
    }

    // future (upcoming / pending_confirmation): data prevista acumulada.
    //
    // F5.5: etapa cadastrada a partir de uma vigente CONTÍNUA não tem data nem automatismo —
    // "prevista" mentiria (sugere que o app vai virar sozinho). Ela espera o toque, e o rótulo
    // diz exatamente isso.
    if (currentIsContinua && s.status === 'pending_confirmation') {
      return {
        key: s.id, kind: 'future', medName, medFullName, doseLabel, continua, broken,
        medicineId: s.medicine?.id ?? null, statusLine: 'aguardando você iniciar',
      }
    }
    let statusLine = continua ? 'contínua' : 'prevista'
    if (projected !== null) {
      statusLine = `prevista para ${fmtDay(projected)}`
      if (index > currentIndex && s.duration_days && s.duration_days > 0) {
        projected = addDays(projected, s.duration_days)
      }
      // Só sufixa quando há data: sem projeção o rótulo JÁ é "contínua", e appendar produzia
      // "contínua · contínua" (achado do RC6). Pré-existente, mas a F5.5 tornou o caso comum —
      // vigente contínua ⇒ `projected` null ⇒ toda futura contínua caía na duplicata.
      if (continua) statusLine += ' · contínua'
    }
    return { key: s.id, kind: 'future', medName, medFullName, doseLabel, continua, broken, medicineId: s.medicine?.id ?? null, statusLine }
  })
}

function StepDot({ kind }: { kind: TimelineStep['kind'] }) {
  if (kind === 'past') {
    return (
      <View style={[styles.dot, styles.dotPast]}>
        <Check size={13} color={colors.status.successDark} strokeWidth={3} />
      </View>
    )
  }
  if (kind === 'current') {
    return (
      <View style={[styles.dot, styles.dotCurrent]}>
        <View style={styles.dotCurrentInner} />
      </View>
    )
  }
  return <View style={[styles.dot, styles.dotFuture]} />
}

/** "2026-06-24" → "24 jun". Dia local já resolvido — nunca `new Date('YYYY-MM-DD')` (R-020). */
function fmtLocalDay(localDay: string): string {
  return fmtDay(parseLocalDate(localDay))
}

interface Props {
  protocolId: string
  paused?: boolean
  /** §7.2: `[Iniciar etapa N]` do banner de vencida — recebe o id da etapa pendente. */
  onStartPendingStep?: (stepId: string) => void
  /** §7.3: `[Editar etapa N]` de uma etapa órfã. */
  onEditStep?: (stepId: string) => void
  // O detalhe já sabe (pelo embed titration_steps) se há escada ANTES do fetch próprio do timeline
  // resolver. Com o hint, reservamos o espaço com skeleton em vez de a seção "pipocar" depois.
  hasLadderHint?: boolean
}

export default function TitrationTimeline({
  protocolId,
  paused = false,
  hasLadderHint = false,
  onStartPendingStep,
  onEditStep,
}: Props) {
  const { steps, hasLadder, loading, refresh, timezone } = useTitrationTimeline(protocolId)

  // 🔴 A preferência vem do HOOK, não de prop. Antes era `doseOnly?: boolean` com default
  // `false` — e NENHUM call site passava, então o usuário dose-only da 044 lia "Você ainda não
  // tem estoque cadastrado dela" sobre um cadastro que, para ele, não existe. A copy §8 já dizia
  // "(omitido em dose-only)": o botão estava no painel e ninguém ligou o fio. Prop opcional com
  // default permissivo transforma esquecimento em texto errado, em silêncio — lendo a preferência
  // aqui dentro, não há call site que possa esquecer.
  // `ready` distingue "ainda não sei" de "sei que está ligado": sem ele o aviso pisca para quem
  // desligou o estoque (mesma razão do gate da tab bar em useStockTracking).
  const { enabled: stockEnabled, ready: stockReady } = useStockTracking()
  // States/Memos antes de Effects (R-010).
  // `todayLocal` re-avaliado no focus (não capturado uma vez) — cobre a tela atravessando a
  // meia-noite ao voltar da navegação, sem projetar com "hoje" velho (AP-W15).
  // Dia local NO FUSO DO DONO — não o do device (R-253/R-254).
  const [todayLocal, setTodayLocal] = useState(() => getTodayLocal(timezone))
  const timeline = useMemo(() => buildTimeline(steps, todayLocal), [steps, todayLocal])

  // §7.2 (T026): QUALQUER dia de espera, inclusive o dia 0. Esta tela é a fonte canônica de
  // controle do tratamento (ativar/pausar/editar) — o controle de iniciar a etapa não pode faltar
  // aqui. O gate antigo (`>= 1`) evitava duplicar o card do Hoje no mesmo dia, mas o "Ainda não"
  // derruba aquele card sem escrever nada no servidor: quem adiava de manhã ficava sem NENHUMA
  // saída até o dia seguinte. Nag é interromper (push); aqui o usuário veio de propósito (pull).
  // O "desde" vem do vencimento da etapa vigente, não de `updated_at` (ver `resolvePendingSwitch`).
  const pendingSwitch = useMemo(() => {
    const info = resolvePendingSwitch(steps, todayLocal, timezone)
    if (!info) return null
    const current = steps.find((s) => s.id === info.currentStepId)
    const pending = steps.find((s) => s.id === info.pendingStepId)
    // Nome + concentração nos DOIS: numa escada os dois cadastros costumam ter o mesmo nome, e
    // dizer "os lembretes seguem no Mounjaro" quando a etapa que entra TAMBÉM é Mounjaro não
    // informa nada. A concentração é o que distingue (achado do smoke do PO, F5).
    return {
      info,
      currentMedName: formatMedicineFullName(current?.medicine, 'dose atual'),
      nextMedName: formatMedicineFullName(pending?.medicine),
    }
  }, [steps, todayLocal, timezone])
  // §7.4 (F5.5): etapa cadastrada a partir de uma CONTÍNUA — pendência SEM PRAZO. Mutuamente
  // exclusiva com `pendingSwitch` por construção: `resolvePendingSwitch` exige vigente FINITA e
  // `resolveManualNextStep` exige vigente CONTÍNUA, então nunca há dois banners na tela.
  const manualNext = useMemo(() => {
    const info = resolveManualNextStep(steps)
    if (!info) return null
    const current = steps.find((s) => s.id === info.currentStepId)
    const pending = steps.find((s) => s.id === info.pendingStepId)
    return {
      info,
      currentMedName: formatMedicineFullName(current?.medicine, 'dose atual'),
      nextMedName: formatMedicineFullName(pending?.medicine),
    }
  }, [steps])

  // Refresh on focus: ao voltar do cadastro/edição da escada, a timeline reflete as mudanças
  // sem recarregar o app (o hook só carregava no mount). `void` — rejeição já tratada no hook.
  useFocusEffect(useCallback(() => { setTodayLocal(getTodayLocal(timezone)); void refresh() }, [refresh, timezone]))

  // Handlers
  /**
   * Confirma a etapa e RECARREGA A ESCADA — nesta ordem, e aqui dentro.
   *
   * 🔴 052 Slice C (smoke do PO, 2026-07-20): o banner continuava na tela depois da confirmação,
   * com o banco já correto. A escada é estado DESTE componente (`useTitrationTimeline`), que só
   * recarrega em focus ou quando o `protocolId` muda — e o `refresh()` do `onStartPendingStep`
   * é o do PROTOCOLO, outro estado. Nenhum dos dois gatilhos disparava: a tela não perdeu foco e
   * o protocolo é o mesmo.
   *
   * Antes do Slice C isso não aparecia porque a confirmação de um `medicine_switch` navegava
   * para o protocolo recém-criado — a troca de `protocolId` remontava a timeline e trazia a
   * escada nova. A navegação estava fazendo DOIS trabalhos (tirar o usuário da armadilha da
   * janela de 24h e, sem que ninguém tivesse decidido isso, invalidar esta cache). Com executor
   * único não há para onde navegar, e o segundo trabalho ficou órfão.
   *
   * Recarregar aqui torna a invalidação explícita e independente de navegação: quem é dono do
   * estado é quem o invalida depois da ação que o muta.
   */
  const handleStartStep = useCallback(async (stepId: string) => {
    await onStartPendingStep?.(stepId)
    await refresh()
  }, [onStartPendingStep, refresh])

  // Enquanto carrega: se o detalhe já sinalizou que há escada (hint), reserva o espaço com
  // skeleton (evita o pop-in); se não há escada, nada aparece (sem convite de cadastro — §2.4).
  if (loading) {
    return hasLadderHint ? (
      <SectionCard title="EVOLUÇÃO DO TRATAMENTO">
        <View style={styles.skeleton}>
          <View style={[styles.skelBar, styles.skelBarWide]} />
          <View style={styles.skelBar} />
          <View style={[styles.skelBar, styles.skelBarNarrow]} />
        </View>
      </SectionCard>
    ) : null
  }
  if (!hasLadder) return null

  return (
    <SectionCard title="EVOLUÇÃO DO TRATAMENTO">
      <View style={styles.headerRow}>
        <ArrowDownNarrowWide size={18} color={paused ? colors.text.secondary : colors.primary[600]} strokeWidth={2.4} />
        <View style={styles.headerSpacer} />
        <EvolutionBadge steps={steps} paused={paused} />
      </View>

      {/* §7.2 (T026): troca pendente. ANTES da timeline na ordem de leitura — é o que exige
          decisão. O tom sai de `daysWaiting` dentro do banner (teal no dia 0, amber a partir do
          dia 1). O app NUNCA estende a duração nos DADOS: a vigente é estendida só na execução,
          até o usuário escolher uma das duas saídas. */}
      {pendingSwitch != null && !paused ? (
        <EvolutionPendingBanner
          stepNumber={pendingSwitch.info.pendingPosition + 1}
          sinceLabel={fmtLocalDay(pendingSwitch.info.dueDay)}
          daysWaiting={pendingSwitch.info.daysWaiting}
          nextMedicineName={pendingSwitch.nextMedName}
          currentMedicineName={pendingSwitch.currentMedName}
          onStart={() => { void handleStartStep(pendingSwitch.info.pendingStepId) }}
        />
      ) : null}

      {/* §7.4 (F5.5): saída da manutenção. Teal sempre — nada está atrasado. Pausado esconde,
          igual ao banner de vencida: a evolução acompanha o tratamento. */}
      {manualNext != null && !paused ? (
        <EvolutionManualNextBanner
          stepNumber={manualNext.info.pendingPosition + 1}
          nextMedicineName={manualNext.nextMedName}
          currentMedicineName={manualNext.currentMedName}
          onStart={() => { void handleStartStep(manualNext.info.pendingStepId) }}
        />
      ) : null}

      <View style={[styles.list, paused && styles.listPaused]}>
        {timeline.map((step, index) => {
          const next = timeline[index + 1]
          const showPrep =
            stockReady &&
            stockEnabled &&
            step.kind === 'current' &&
            next != null &&
            next.medicineId != null &&
            step.medicineId != null &&
            next.medicineId !== step.medicineId

          // §7.3 (T026): etapa órfã vira card corrigível NO LUGAR da linha normal — mostrar
          // "Medicamento · " genérico seria esconder que a escada está quebrada. Nunca beco:
          // o botão nomeado leva à edição da etapa (Constituição IX).
          //
          // 🔴 Só etapa FUTURA (achado do RC6). `broken` é calculado para qualquer `kind`, mas
          // `EDITABLE_STATUSES` = upcoming + pending_confirmation, e `current`/`completed` são
          // congeladas no form (`FROZEN_STATUS`). Oferecer "Editar etapa N" numa passada ou na
          // vigente levaria a um form onde ela NÃO pode ser tocada — o beco que este card existe
          // para evitar. Órfã passada/vigente cai na linha normal, que já degrada para o rótulo
          // genérico via `medName`; não há o que consertar ali, e o histórico não se reescreve.
          if (step.broken && step.kind === 'future') {
            return (
              <EvolutionBrokenStepCard
                key={step.key}
                stepNumber={index + 1}
                medicineName={step.medName}
                onEdit={() => onEditStep?.(step.key)}
              />
            )
          }

          return (
            <View key={step.key}>
              <StepRow step={step} index={index} total={timeline.length} />
              {showPrep ? <PrepStockBanner medName={next!.medFullName} /> : null}
            </View>
          )
        })}
      </View>

      {paused ? (
        <Text style={styles.pausedNote}>
          A evolução acompanha o tratamento: pausou o tratamento, pausou a evolução. Ao retomar, ela
          continua de onde parou.
        </Text>
      ) : null}
    </SectionCard>
  )
}

function StepRow({ step, index, total }: { step: TimelineStep; index: number; total: number }) {
  const a11y = `Etapa ${index + 1}, ${step.kind === 'current' ? 'vigente' : step.kind === 'past' ? 'concluída' : 'prevista'}, ${step.medName}, ${step.doseLabel}. ${step.statusLine}`
  const isCurrent = step.kind === 'current'
  return (
    <View style={styles.row} accessible accessibilityLabel={a11y}>
      <View style={styles.rail}>
        <StepDot kind={step.kind} />
        {index < total - 1 ? <View style={[styles.railLine, step.kind === 'past' ? styles.railLineSolid : styles.railLineFuture]} /> : null}
      </View>
      <View style={[styles.rowBody, isCurrent && styles.rowBodyCurrent]}>
        {isCurrent ? <Text style={styles.currentEyebrow}>Etapa {index + 1} · vigente</Text> : null}
        <View style={styles.rowTitleWrap}>
          <Text style={[styles.rowTitle, isCurrent && styles.rowTitleCurrent]} numberOfLines={2}>
            {step.kind !== 'current' ? `Etapa ${index + 1} · ` : ''}
            {step.medName} · {step.doseLabel}
          </Text>
        </View>
        <Text style={[styles.rowStatus, isCurrent && styles.rowStatusCurrent]}>{step.statusLine}</Text>
      </View>
    </View>
  )
}

/** `medName` DEVE vir de `formatMedicineFullName` — "A próxima etapa usa Mounjaro" é verdade para
 *  todas as etapas de uma escada de Mounjaro e não ajuda ninguém a comprar a caneta certa. */
function PrepStockBanner({ medName }: { medName: string }) {
  return (
    <View style={styles.prep} accessibilityRole="text">
      <Box size={17} color={colors.status.warning} strokeWidth={1.9} />
      <View style={styles.prepBody}>
        <Text style={styles.prepTitle}>A próxima etapa usa {medName}</Text>
        <Text style={styles.prepHint}>Você ainda não tem estoque cadastrado dela.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[1] },
  headerSpacer: { flex: 1 },
  list: { paddingTop: spacing[2] },
  listPaused: { opacity: 0.55 },
  row: { flexDirection: 'row', gap: spacing[3] },
  rail: { alignItems: 'center', width: 26 },
  dot: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dotPast: { backgroundColor: colors.primary[100] }, // teal soft — etapa concluída
  dotCurrent: { backgroundColor: colors.primary[600] },
  dotCurrentInner: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.bg.card },
  // Futura = anel vazado sólido (RN não suporta dashed em borda arredondada — evita o WARN).
  dotFuture: { backgroundColor: colors.bg.card, borderWidth: 2, borderColor: colors.neutral[300] },
  railLine: { flex: 1, width: 2, marginVertical: 2, borderRadius: 1 },
  railLineSolid: { backgroundColor: colors.neutral[300] }, // concluída — traço cheio/escuro
  railLineFuture: { backgroundColor: colors.neutral[200] }, // futura — traço claro (era dashed)
  rowBody: { flex: 1, paddingBottom: spacing[4], gap: 3 },
  rowBodyCurrent: {
    backgroundColor: colors.primary[50],
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  currentEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowTitleWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  rowTitleCurrent: { fontSize: 16, fontWeight: '800' },
  rowStatus: { fontSize: 12, color: colors.text.secondary },
  rowStatusCurrent: { color: colors.text.secondary, marginTop: 2 },
  prep: {
    flexDirection: 'row',
    gap: spacing[2],
    marginLeft: 38,
    marginBottom: spacing[3],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.warningLight,
    borderWidth: 1,
    borderColor: colors.status.warningLight,
  },
  prepBody: { flex: 1 },
  prepTitle: { fontSize: 13, fontWeight: '700', color: colors.status.warning },
  prepHint: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  pausedNote: { fontSize: 12, color: colors.text.secondary, lineHeight: 18, paddingTop: spacing[2] },
  skeleton: { paddingTop: spacing[2], gap: spacing[3] },
  skelBar: { height: 14, borderRadius: 6, backgroundColor: colors.neutral[100], width: '70%' },
  skelBarWide: { width: '90%' },
  skelBarNarrow: { width: '45%' },
})
