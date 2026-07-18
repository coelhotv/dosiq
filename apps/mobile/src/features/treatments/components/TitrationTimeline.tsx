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
import { formatIntakeDose, parseISO, addDays, getTodayLocal, formatLocalDate, parseLocalDate } from '@dosiq/core'
import SectionCard from '@shared/components/ui/SectionCard'
import EvolutionBadge from '@treatments/components/EvolutionBadge'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { useTitrationTimeline } from '@treatments/hooks/useTitrationTimeline'
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
  doseLabel: string
  statusLine: string
  continua: boolean
  medicineId: string | null
}

// Projeta datas caminhando a partir da etapa vigente (PURO). Passadas usam started_at/ended_at
// reais; a vigente projeta o fim por started_at + duration_days; futuras acumulam a partir daí.
// Datas via parseISO/addDays do core (nunca `new Date('YYYY-MM-DD')` — timezone, regra da casa).
// `todayLocal` = dia local do dono (YYYY-MM-DD), computado FRESCO a cada render (não capturado em
// useState) — senão a tela aberta atravessando a meia-noite usaria "hoje" velho (AP-W15). O
// "N dias restantes" conta dias de CALENDÁRIO local (AP-240), não blocos absolutos de 24h.
function buildTimeline(steps: LadderStepWithMedicine[], todayLocal: string): TimelineStep[] {
  const ordered = [...steps].sort((a, b) => a.position - b.position)
  const currentIndex = ordered.findIndex((s) => s.status === 'current')
  const todayMs = parseLocalDate(todayLocal).getTime()

  // Ponto de partida da projeção das futuras = fim da etapa vigente (se finita).
  let projected: Date | null = null
  if (currentIndex !== -1) {
    const cur = ordered[currentIndex]
    if (cur.started_at && cur.duration_days && cur.duration_days > 0) {
      projected = addDays(parseISO(cur.started_at), cur.duration_days)
    }
  }

  return ordered.map((s, index): TimelineStep => {
    const medName = s.medicine?.name ?? 'Medicamento'
    const doseLabel = formatIntakeDose(s.dose, s.intake_unit, s.medicine)
    const continua = s.duration_days === null || s.duration_days === undefined

    if (s.status === 'completed') {
      const start = s.started_at ? parseISO(s.started_at) : null
      const end = s.ended_at ? parseISO(s.ended_at) : null
      const span = start && end ? `${fmtDay(start)} – ${fmtDay(end)}` : ''
      return { key: s.id, kind: 'past', medName, doseLabel, continua, medicineId: s.medicine?.id ?? null, statusLine: span ? `Concluída · ${span}` : 'Concluída' }
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
      return { key: s.id, kind: 'current', medName, doseLabel, continua, medicineId: s.medicine?.id ?? null, statusLine }
    }

    // future (upcoming / pending_confirmation): data prevista acumulada.
    let statusLine = continua ? 'contínua' : 'prevista'
    if (projected !== null) {
      statusLine = `prevista para ${fmtDay(projected)}`
      if (index > currentIndex && s.duration_days && s.duration_days > 0) {
        projected = addDays(projected, s.duration_days)
      }
    }
    if (continua) statusLine += ' · contínua'
    return { key: s.id, kind: 'future', medName, doseLabel, continua, medicineId: s.medicine?.id ?? null, statusLine }
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

interface Props {
  protocolId: string
  paused?: boolean
  doseOnly?: boolean
  // O detalhe já sabe (pelo embed titration_steps) se há escada ANTES do fetch próprio do timeline
  // resolver. Com o hint, reservamos o espaço com skeleton em vez de a seção "pipocar" depois.
  hasLadderHint?: boolean
}

export default function TitrationTimeline({ protocolId, paused = false, doseOnly = false, hasLadderHint = false }: Props) {
  const { steps, hasLadder, loading, refresh } = useTitrationTimeline(protocolId)
  // States/Memos antes de Effects (R-010).
  // `todayLocal` re-avaliado no focus (não capturado uma vez) — cobre a tela atravessando a
  // meia-noite ao voltar da navegação, sem projetar com "hoje" velho (AP-W15).
  const [todayLocal, setTodayLocal] = useState(getTodayLocal)
  const timeline = useMemo(() => buildTimeline(steps, todayLocal), [steps, todayLocal])
  // Refresh on focus: ao voltar do cadastro/edição da escada, a timeline reflete as mudanças
  // sem recarregar o app (o hook só carregava no mount). `void` — rejeição já tratada no hook.
  useFocusEffect(useCallback(() => { setTodayLocal(getTodayLocal()); void refresh() }, [refresh]))

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

      <View style={[styles.list, paused && styles.listPaused]}>
        {timeline.map((step, index) => {
          const next = timeline[index + 1]
          const showPrep =
            !doseOnly &&
            step.kind === 'current' &&
            next != null &&
            next.medicineId != null &&
            step.medicineId != null &&
            next.medicineId !== step.medicineId
          return (
            <View key={step.key}>
              <StepRow step={step} index={index} total={timeline.length} />
              {showPrep ? <PrepStockBanner medName={next!.medName} /> : null}
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
