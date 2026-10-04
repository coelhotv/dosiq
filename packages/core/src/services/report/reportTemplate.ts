/**
 * renderReportHtml — template HTML ÚNICO do relatório clínico (spec 097 FR-001/FR-002, INV-2).
 * Web imprime pelo navegador e mobile por `expo-print`; nenhum desenho de seção existe fora daqui.
 *
 * Regras (vinculantes):
 * - Todo texto passa por `escapeHtml` (PO-SEC-3). Nenhum `<script>` e nenhum atributo `on*`.
 * - Ordem e conteúdo das seções: `DESIGN_DECISOES.md` §3; seção sem dado não aparece (exceto
 *   tomadas, que diz "Nenhum registro no período" — FR-016).
 * - Motor único: o PDF sai do Chromium do servidor (`api/report.ts`, D-A2-2). O documento é contínuo;
 *   o Chromium quebra as páginas (`thead` repetido, blocos sem corte) e escreve o rodapé com
 *   "Página X de Y" a partir de `renderReportFooter`.
 * - Linha SaMD (INV-5): só fatos e contagens; nenhum juízo, alvo ou sugestão. Um acento (teal),
 *   âmbar só em "Para esta consulta"; toda codificação legível em preto e branco.
 */
import { getUserTime, parseISO } from '../../utils/dateUtils'
import { formatNumberPtBR } from '../../utils/doseUnit'
import { daysBetween, formatDayMonth, formatShortDate, shiftDay } from './reportFormat'
import { escapeAttr, escapeHtml as e } from './reportHtmlEscape'
import { renderBodyMapSvg } from './reportBodyMapSvg'
import { REPORT_LOGO_DATA_URI } from './reportLogo'
import type { ReportLadder, ReportMedicationRow, ReportModel } from './reportModel'
import type { ReportWindow } from './reportTypes'
import type { ChangeItem } from './reportSections/changes'
import type { VisitItem } from './reportSections/header'
import type { InjectionSiteCard } from './reportSections/injectionSites'
import type { DayCellState, IntakeRow } from './reportSections/intakes'
import type { MeasureBlock, MeasurePoint, MeasureStat, MeasuresSection } from './reportSections/measures'
import type { StockRow } from './reportSections/stock'

interface FlowTable {
  id: string
  open: string
  close: string
}

interface FlowItem {
  html: string
  table?: FlowTable
}

const SAMD_NOTE =
  'Registros feitos pelo paciente no app. Este documento descreve o que foi registrado; não é avaliação clínica nem recomendação.'

const CSS = `
:root{--ink:#1f2937;--mute:#6b7280;--line:#d1d5db;--teal:#0f766e;--amber:#fef3c7}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:#fff;color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:12px;line-height:1.35}
h1{font-size:22px;font-weight:700}
h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--teal);margin:14px 0 6px}
.mute{color:var(--mute)}.small{font-size:10px}.num{font-variant-numeric:tabular-nums}
.facts{display:flex;gap:4px 14px;flex-wrap:wrap;margin-top:6px;font-size:11px}
.box{background:var(--amber);border:1px solid #f59e0b;padding:6px 8px;margin-top:8px}
.box .vi{font-size:11px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:10px;text-transform:uppercase;color:var(--mute);border-bottom:1px solid var(--ink);padding:4px}
td{border-bottom:1px solid var(--line);padding:4px;vertical-align:top}
.chip{display:inline-block;border:1px solid var(--line);border-radius:8px;padding:0 5px;font-size:10px;margin:0 2px 2px 0}
.irow{margin:6px 0;padding-bottom:4px;border-bottom:1px solid var(--line)}
.irow.side{display:flex;gap:10px;align-items:center}
.irow.side .who{flex:0 0 42%}.irow.side .strips{flex:1 1 auto}
.strip{display:flex;flex-wrap:nowrap;gap:.2mm;margin-top:2px}
.c{flex:1 1 0;min-width:0;height:14px;border:.6px solid var(--teal)}
.c.full{background:var(--teal)}
.c.partial{background:linear-gradient(135deg,var(--teal) 50%,#fff 50%)}
.c.paused{border:none;border-top:2px solid var(--mute);height:8px;margin-top:3px}
.c.empty{border-color:transparent}
.ticks{display:flex;justify-content:space-between;font-size:9px;color:var(--mute)}
.legend{display:flex;flex-wrap:wrap;gap:3px 12px;align-items:center;font-size:10px;color:var(--mute);margin-top:4px}
.legend .k{display:inline-flex;align-items:center;gap:4px}
.legend .c{flex:none;display:inline-block;width:11px;height:11px;margin:0}
.legend .c.paused{height:6px;margin-top:5px}
.legend .c.empty{border:.6px dashed var(--line)}
.logo{height:9mm;width:auto;display:block;margin-bottom:4px}
.chg{display:flex;gap:10px;font-size:11px;padding:2px 0}.chg .day{flex:0 0 52px}
.ladder{margin:8px 0;padding-bottom:6px;border-bottom:1px solid var(--line)}
.steps{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.step{flex:1 1 0;min-width:110px;border-top:3px solid var(--line);padding-top:3px;font-size:10px}
.step.current{border-top-color:var(--teal)}.step.planned{border-top-style:dashed}
.step .med{font-size:9px;color:var(--ink)}
.wl{font-size:10px;margin-top:2px}
.nw{white-space:nowrap}
.over{font-size:10px;color:var(--mute)}
.mblock{margin:6px 0 10px}
.sites{display:flex;flex-wrap:wrap;gap:8px 4%}
.site{flex:0 0 48%;border-top:1px solid var(--line);padding-top:4px}
.bodymap{display:block;width:62mm;height:auto;margin:4px 0}
thead{display:table-header-group}
tr,.irow,.ladder,.box,.chg,.mblock,.site{break-inside:avoid;page-break-inside:avoid}
h2{break-after:avoid;page-break-after:avoid}`

const LOGO = `<img class="logo" src="${REPORT_LOGO_DATA_URI}" alt="dosiq">`

/** Nome-base do arquivo (sem nome do paciente — RC-SEC-F4): `dosiq-relatorio-30d-2026-09-30`. */
export function reportFileBaseName(window: ReportWindow): string {
  return `dosiq-relatorio-${window.days}d-${window.to}`
}

function fullDate(day: string): string {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

function generatedLabel(iso: string, tz: string): string {
  const date = parseISO(iso)
  if (Number.isNaN(date.getTime())) return ''
  const local = getUserTime(date, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()} ${pad(local.getHours())}:${pad(local.getMinutes())}`
}

const short = (day: string | null) => e(formatShortDate(day) ?? '—')

/** Dose escapada; o equivalente "(≈ 0,5 mL)" não quebra no meio (smoke 097 A2). */
const dose = (label: string | null | undefined) => e(label ?? '—').replace(/\(≈ [^)]*\)/g, (m) => `<span class="nw">${m}</span>`)
const dm = (day: string | null) => e(formatDayMonth(day) ?? '—')

// ── §3.1 Cabeçalho ────────────────────────────────────────────────────────────
function renderHeader(model: ReportModel): string {
  const h = model.header
  const who = [h.patientName ? e(h.patientName) : null, h.age !== null ? `${h.age} anos` : null]
  const meta = [
    ...who,
    `${fullDate(h.window.from)} a ${fullDate(h.window.to)} (${h.window.days} dias)`,
    h.recordsFrom ? `<b>registros a partir de ${fullDate(h.recordsFrom)}</b>` : null,
    `gerado em ${e(generatedLabel(model.generatedAt, model.timezone))}`,
  ].filter(Boolean)
  const allergies = h.allergies.length ? e(h.allergies.join(', ')) : '<span class="mute">nenhuma registrada</span>'
  const blood = h.bloodType ? e(h.bloodType) : '<span class="mute">não informado</span>'
  return (
    `<header>${LOGO}<h1>Relatório de acompanhamento</h1>` +
    `<div class="mute">${meta.join(' · ')}</div>` +
    '<div class="facts">' +
    `<span><b>Alergias:</b> ${allergies}</span>` +
    `<span><b>Tipo sanguíneo:</b> ${blood}</span>` +
    `<span class="num"><b>Dias com dose:</b> ${h.daysWithDose.count} de ${h.daysWithDose.of}</span>` +
    `<span class="num"><b>Dias com medida:</b> ${h.daysWithMeasure.count} de ${h.daysWithMeasure.of}</span>` +
    '</div></header>'
  )
}

// ── §3.2 Para esta consulta ───────────────────────────────────────────────────
function visitLine(item: VisitItem): string {
  if (item.kind === 'receita') {
    const verb = item.status === 'vencida' ? 'venceu em' : 'vence em'
    return `Receita · ${e(item.name)} — ${verb} ${short(item.day)}`
  }
  if (item.kind === 'estoque') return `Estoque · ${e(item.name)} — acaba em ${short(item.day)}`
  const next = item.doseLabel ? ` (${dose(item.doseLabel)})` : ''
  return `Titulação · ${e(item.name)} — próxima etapa${next} prevista a partir de ${short(item.day)}`
}

function visitFlow(items: VisitItem[]): FlowItem[] {
  if (!items.length) return []
  const html = `<div class="box"><b>Para esta consulta</b>${items.map((i) => `<div class="vi num">${visitLine(i)}</div>`).join('')}</div>`
  return [{ html}]
}

// ── §3.3 Medicamentos em uso ──────────────────────────────────────────────────
const MED_TABLE: FlowTable = {
  id: 'medications',
  open:
    '<table><thead><tr><th>Medicamento</th><th>Dose</th><th>Quando</th><th>Dose no ciclo</th><th>Vigência</th><th>Situação</th></tr></thead><tbody>',
  close: '</tbody></table>',
}

function medicationRow(m: ReportMedicationRow): string {
  const end = m.endDate
    ? `${m.endStatus ? '<b>' : ''}até ${short(m.endDate)}${m.endStatus ? '</b>' : ''}`
    : '<span class="mute">contínuo</span>'
  const chips: string[] = []
  if (m.titrationChip) chips.push(m.titrationChip)
  if (m.pause) chips.push(`Pausa ${formatDayMonth(m.pause.from)}–${formatDayMonth(m.pause.to)}`)
  return (
    '<tr>' +
    `<td><b>${e(m.name)}</b>${m.detail ? `<div class="small mute">${e(m.detail)}</div>` : ''}</td>` +
    `<td class="num">${dose(m.dosePerIntake)}</td>` +
    `<td>${e(m.frequencyLabel)}${m.times.length ? `<div class="small mute num">${e(m.times.join(' · '))}</div>` : ''}</td>` +
    `<td class="num">${e(m.cycleDose)}</td>` +
    `<td class="num">${short(m.startDate)}<div class="small">${end}</div></td>` +
    `<td>${chips.map((c) => `<span class="chip">${e(c)}</span>`).join('')}</td>` +
    '</tr>'
  )
}

function medicationsFlow(rows: ReportMedicationRow[]): FlowItem[] {
  const title: FlowItem = { html: '<h2>Medicamentos em uso</h2>' }
  if (!rows.length) return [title, { html: '<p class="mute">Nenhum medicamento em uso no fim do período.</p>'}]
  return [title, ...rows.map((m) => ({ html: medicationRow(m), table: MED_TABLE }))]
}

// ── §3.4 Tomadas / §3.6 Encerrados ────────────────────────────────────────────
const CELL: Record<DayCellState, string> = { full: 'full', partial: 'partial', none: 'none', paused: 'paused', empty: 'empty' }

function strip(days: IntakeRow['days']): string {
  return `<div class="strip">${days.map((d) => `<span class="c ${CELL[d.state]}"></span>`).join('')}</div>`
}

function ticks(days: IntakeRow['days']): string {
  if (!days.length) return ''
  const first = days[0].day
  const last = days[days.length - 1].day
  const marks = days.length < 3 ? [...new Set([first, last])] : [first, days[Math.floor(days.length / 2)].day, last]
  return `<div class="ticks num">${marks.map((d) => `<span>${dm(d)}</span>`).join('')}</div>`
}

/** Faixa + escala de datas: a célula estica para preencher a linha (7 retângulos no 7 dias). */
function stripBox(days: IntakeRow['days']): string {
  return `<div class="sbox">${strip(days)}${ticks(days)}</div>`
}

function countLabel(row: IntakeRow): string {
  if (row.expected === 0) return 'sem dose prevista no período'
  const pct = row.percent !== null ? ` (${row.percent}%)` : ''
  return `${row.taken} de ${row.expected} ${row.expected === 1 ? 'dose' : 'doses'}${pct}`
}

function intakeRow(row: IntakeRow, periodDays: number, ended: boolean): string {
  const slots = row.bySlot.map((s) => `${e(s.slot)} ${s.taken}/${s.expected}`).join(' · ')
  // Encerrados: a data vem antes, como sobretítulo — o nome segue sendo o destaque (smoke 097 A2).
  const over = ended && row.endedOn ? `<div class="over num">encerrado em ${short(row.endedOn)}</div>` : ''
  const who =
    `<div class="who">${over}<b>${e(row.name)}</b> <span class="num">${countLabel(row)}</span>` +
    (slots ? `<div class="small mute num">${slots}</div>` : '') +
    '</div>'
  const attr = `data-protocol="${escapeAttr(row.protocolId)}"`
  if (periodDays <= 30) return `<div class="irow side" ${attr}>${who}<div class="strips">${stripBox(row.days)}</div></div>`
  return `<div class="irow" ${attr}>${who}${stripBox(row.days)}</div>`
}

const LEGEND_KEYS: [DayCellState, string][] = [
  ['full', 'todas as doses do dia'],
  ['partial', 'parte'],
  ['none', 'nenhuma'],
  ['paused', 'pausado'],
  ['empty', 'sem dose prevista'],
]

/** Legenda com as mesmas células da faixa (o desenho explica a si mesmo, inclusive em P&B). */
const LEGEND =
  '<div class="legend"><span>Um quadro por dia:</span>' +
  LEGEND_KEYS.map(([state, label]) => `<span class="k"><span class="c ${CELL[state]}"></span>${label}</span>`).join('') +
  '</div>'

function intakesFlow(model: ReportModel): FlowItem[] {
  const days = model.header.window.days
  const title: FlowItem = { html: '<h2>Tomadas no período</h2>' }
  if (!model.intakes.active.length) {
    return [title, { html: '<p class="mute">Nenhum registro no período.</p>'}]
  }
  return [
    title,
    ...model.intakes.active.map((r) => ({ html: intakeRow(r, days, false)})),
    { html: LEGEND},
  ]
}

function endedFlow(model: ReportModel): FlowItem[] {
  const rows = model.intakes.ended
  if (!rows.length) return []
  const days = model.header.window.days
  return [
    { html: '<h2>Tratamentos encerrados no período</h2>' },
    ...rows.map((r) => ({ html: intakeRow(r, days, true)})),
    { html: LEGEND },
  ]
}

// ── §3.5 Mudanças ─────────────────────────────────────────────────────────────
function changeText(c: ChangeItem): string {
  const name = e(c.name)
  switch (c.kind) {
    case 'started':
      return `${name}: início do tratamento`
    case 'titration_step':
      return `${name}: etapa ${c.step ?? ''} iniciada (de ${dose(c.fromDose)} para ${dose(c.toDose)})`
    case 'paused':
      // A data já está na coluna do dia e a duração aparece na faixa de tomadas (smoke 097 A2).
      return `${name}: tratamento pausado.`
    case 'ended':
      return `${name}: término do tratamento`
  }
}

function changesFlow(changes: ChangeItem[]): FlowItem[] {
  if (!changes.length) return []
  return [
    { html: '<h2>Mudanças no período</h2>' },
    ...changes.map((c) => ({ html: `<div class="chg"><span class="day num">${dm(c.day)}</span><span>${changeText(c)}</span></div>`})),
  ]
}

// ── §3.5b Escadas + peso por etapa (DS-7) ─────────────────────────────────────
function stepDates(s: ReportLadder['steps'][number]): string {
  if (s.state === 'completed') return `${dm(s.start)} a ${dm(s.end)}`
  if (s.state === 'current') return `desde ${dm(s.start)}`
  return s.start ? `prevista a partir de ${dm(s.start)}` : 'prevista, sem data'
}

const CHART_W = 520
const CHART_H = 110
const PAD_L = 34
const PAD_B = 14

/**
 * Eixo de datas dos gráficos: início, fim e marcas intermediárias a cada semana (até ~31 dias) ou a
 * cada duas semanas (acima disso). Marca intermediária colada no fim (< meio passo) é omitida para
 * os rótulos não se sobreporem (smoke 097 C).
 */
export function chartDateTicks(from: string, to: string): string[] {
  const span = daysBetween(from, to)
  if (span <= 0) return [from]
  const step = span <= 10 ? Math.max(1, Math.ceil(span / 4)) : span <= 31 ? 7 : 14
  const out = [from]
  for (let d = step; d < span; d += step) {
    if (span - d >= step / 2) out.push(shiftDay(from, d))
  }
  out.push(to)
  return out
}

function dateAxis(from: string, to: string, x: (day: string) => number): string {
  const ticks = chartDateTicks(from, to)
  return ticks
    .map((day, i) => {
      const anchor = i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'
      const xp = x(day)
      return (
        `<line x1="${xp.toFixed(1)}" y1="${CHART_H - PAD_B}" x2="${xp.toFixed(1)}" y2="${CHART_H - PAD_B + 3}" stroke="#9ca3af" stroke-width=".6"/>` +
        `<text x="${xp.toFixed(1)}" y="${CHART_H - 2}" font-size="9" fill="#6b7280" text-anchor="${anchor}">${dm(day)}</text>`
      )
    })
    .join('')
}

/** Uma linha por etapa: peso médio, pesagens e doses tomadas (fatos, sem diferença calculada). */
function weightLines(ladder: ReportLadder): string {
  const series = ladder.weightSeries
  if (!series) return ''
  const out = ladder.outsideSteps
  // A soma das etapas precisa fechar com a seção de tomadas: o que sobra aparece, não some.
  const rest = out ? `<div class="wl num">Fora das etapas registradas — Doses tomadas: ${out.taken} de ${out.expected}</div>` : ''
  return series.steps
    .map((s) => {
      const plural = s.count === 1 ? 'pesagem' : 'pesagens'
      const mean =
        s.meanKg !== null && s.count > 0
          ? `Peso médio ${e(formatNumberPtBR(Math.round(s.meanKg * 10) / 10))} kg · ${s.count} ${plural}`
          : 'sem pesagem'
      const clipped = s.clipped ? ' (no período)' : ''
      // Dose e datas já estão na escada logo acima: a linha traz só o que é dela (smoke 097 A2).
      const doses = s.expected > 0 ? `Doses tomadas: ${s.taken} de ${s.expected}` : 'sem dose prevista'
      return `<div class="wl num">Etapa ${s.index}${clipped} — ${mean} · ${doses}</div>`
    })
    .join('') + rest
}

/** Peso × etapa na gramática da 069-B: faixa neutra por etapa, pontos sem linha, sem média desenhada. */
function weightChart(ladder: ReportLadder, period: ReportWindow): string {
  const series = ladder.weightSeries
  if (!series) return ''
  // Eixo próprio: da 1ª etapa (recortada ao período) ao fim — a escada não fica espremida na ponta.
  const first = series.steps[0]?.start
  const window = first && first > period.from ? { ...period, from: first } : period
  const span = Math.max(1, daysBetween(window.from, window.to))
  const x = (day: string) => PAD_L + (Math.min(span, Math.max(0, daysBetween(window.from, day))) / span) * (CHART_W - PAD_L - 4)
  const kgs = series.points.map((p) => p.kg)
  const lo = Math.floor(Math.min(...kgs) - 1)
  const hi = Math.ceil(Math.max(...kgs) + 1)
  const plotH = CHART_H - PAD_B - 4
  const y = (kg: number) => 4 + ((hi - kg) / Math.max(1, hi - lo)) * plotH

  const bands = series.steps
    .map((s, i) => {
      const x0 = x(s.start)
      const x1 = x(s.end ?? window.to)
      const fill = i % 2 === 0 ? '#f3f4f6' : '#e5e7eb'
      // Rótulo só se couber na faixa (~5 px por caractere a 9 px); senão a dose fica nas linhas abaixo.
      const fits = x1 - x0 >= s.dose.length * 5 + 6
      return (
        `<rect x="${x0.toFixed(1)}" y="4" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${plotH}" fill="${fill}"/>` +
        (fits ? `<text x="${(x0 + 3).toFixed(1)}" y="13" font-size="9" fill="#374151">${e(s.dose)}</text>` : '')
      )
    })
    .join('')
  const dots = series.points
    .map((p) => `<circle cx="${x(p.day).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="2.5" fill="#0f766e"/>`)
    .join('')
  const axis =
    `<text x="0" y="12" font-size="9" fill="#6b7280">${e(formatNumberPtBR(hi))} kg</text>` +
    `<text x="0" y="${CHART_H - PAD_B}" font-size="9" fill="#6b7280">${e(formatNumberPtBR(lo))} kg</text>` +
    dateAxis(window.from, window.to, x)
  if (!ladder.weightChart) return `<div class="small"><b>Peso durante o tratamento</b></div>${weightLines(ladder)}`
  const svg = `<svg width="100%" viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="Peso durante o tratamento">${bands}${dots}${axis}</svg>`

  return `<div class="small"><b>Peso durante o tratamento</b></div>${svg}${weightLines(ladder)}`
}

function laddersFlow(model: ReportModel): FlowItem[] {
  if (!model.ladders.length) return []
  const items: FlowItem[] = [
    {
      html: '<h2>Escadas de titulação</h2><div class="small mute">escada registrada no app; datas futuras são previstas</div>',
    },
  ]
  for (const ladder of model.ladders) {
    const steps = ladder.steps
      .map(
        (s) =>
          `<div class="step ${s.state}"><b>Etapa ${s.position}</b> · <span class="num">${dose(s.doseLabel)}</span>` +
          (s.medicineLabel ? `<div class="med num">${e(s.medicineLabel)}</div>` : '') +
          `<div class="num">${stepDates(s)}</div>` +
          `<div class="mute">${s.durationDays ? `${s.durationDays} dias` : 'contínua'}</div></div>`
      )
      .join('')
    const chart = weightChart(ladder, model.header.window)
    items.push({
      html: `<div class="ladder"><b>${e(ladder.name)}</b><div class="steps">${steps}</div>${chart}</div>`,
    })
  }
  return items
}

// ── §3.7 Medidas + cruzamento dose × medida (ADR-105) ─────────────────────────
const num = (n: number) => e(formatNumberPtBR(Math.round(n * 10) / 10))

/** "120" ou "120×80" (pressão: sistólica × diastólica). */
function statValue(main: number, sec: number | null | undefined): string {
  return sec === null || sec === undefined ? num(main) : `${num(main)}×${num(sec)}`
}

function statCells(stat: MeasureStat, sec: MeasureStat | null): string {
  return (
    `<td class="num">${stat.n}</td>` +
    `<td class="num">${statValue(stat.min, sec?.min)}</td>` +
    `<td class="num">${statValue(stat.median, sec?.median)}</td>` +
    `<td class="num">${statValue(stat.max, sec?.max)}</td>`
  )
}

const STAT_HEAD = '<th>n</th><th>Mínimo</th><th>Mediana</th><th>Máximo</th>'

/** Marcador por momento da glicemia (categórico, legível em P&B): ● jejum/antes de comer, ○ depois, ▲ ao deitar, ■ outro. */
type GlyMarker = 'fill' | 'open' | 'tri' | 'sq'
function glyMarker(context: string | null): GlyMarker {
  if (context === 'jejum' || context === 'pre_refeicao') return 'fill'
  if (context === 'pos_refeicao') return 'open'
  if (context === 'ao_deitar') return 'tri'
  return 'sq'
}

function markerSvg(kind: GlyMarker, cx: number, cy: number): string {
  const c = '#0f766e'
  if (kind === 'fill') return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.6" fill="${c}"/>`
  if (kind === 'open') return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.6" fill="#fff" stroke="${c}" stroke-width="1.1"/>`
  if (kind === 'tri') {
    return `<path d="M${cx.toFixed(1)},${(cy - 3).toFixed(1)} L${(cx + 3).toFixed(1)},${(cy + 2.4).toFixed(1)} L${(cx - 3).toFixed(1)},${(cy + 2.4).toFixed(1)} Z" fill="${c}"/>`
  }
  return `<rect x="${(cx - 2.2).toFixed(1)}" y="${(cy - 2.2).toFixed(1)}" width="4.4" height="4.4" fill="none" stroke="${c}" stroke-width="1.1"/>`
}

const GLY_LEGEND: [GlyMarker, string][] = [
  ['fill', 'jejum ou antes de comer'],
  ['open', 'depois de comer'],
  ['tri', 'ao deitar'],
  ['sq', 'outro ou sem momento'],
]

/** Glicemia: pontos por dia, marcador pelo momento; sem faixa-alvo, meta ou linha ligando (INV-5). */
function glycemiaChart(points: MeasurePoint[], period: ReportWindow): string {
  const span = Math.max(1, daysBetween(period.from, period.to))
  const x = (day: string) => PAD_L + (Math.min(span, Math.max(0, daysBetween(period.from, day))) / span) * (CHART_W - PAD_L - 6)
  const values = points.map((p) => p.value)
  const lo = Math.floor(Math.min(...values) / 10) * 10 - 10
  const hi = Math.ceil(Math.max(...values) / 10) * 10 + 10
  const plotH = CHART_H - PAD_B - 4
  const y = (v: number) => 4 + ((hi - v) / Math.max(1, hi - lo)) * plotH
  const dots = points.map((p) => markerSvg(glyMarker(p.context), x(p.day), y(p.value))).join('')
  const axis =
    `<text x="0" y="12" font-size="9" fill="#6b7280">${num(hi)}</text>` +
    `<text x="0" y="${CHART_H - PAD_B}" font-size="9" fill="#6b7280">${num(lo)}</text>` +
    dateAxis(period.from, period.to, x) +
    `<line x1="${PAD_L}" y1="${CHART_H - PAD_B}" x2="${CHART_W - 4}" y2="${CHART_H - PAD_B}" stroke="#d1d5db" stroke-width=".6"/>`
  const legend =
    '<div class="legend">' +
    GLY_LEGEND.map(([k, label]) => `<span class="k"><svg width="9" height="9" viewBox="0 0 9 9">${markerSvg(k, 4.5, 4.5)}</svg>${label}</span>`).join('') +
    '</div>'
  return `<svg width="100%" viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="Glicemia no período">${dots}${axis}</svg>${legend}`
}

function contextTable(block: MeasureBlock): string {
  const rows = block.byContext
    .map((g) => `<tr><td>${e(g.label)}</td>${statCells(g.stat, g.secondary)}</tr>`)
    .join('')
  return `<table><thead><tr><th>Momento (${e(block.unit)})</th>${STAT_HEAD}</tr></thead><tbody>${rows}</tbody></table>`
}

function measureBlock(block: MeasureBlock, model: ReportModel): string {
  const title = `<div><b>${e(block.label)}</b> <span class="mute num">· ${block.points.length} ${block.points.length === 1 ? 'medida' : 'medidas'}</span></div>`
  if (block.type === 'peso') {
    const rows = block.points.map((p) => `<tr><td class="num">${dm(p.day)} ${e(p.time)}</td><td class="num">${num(p.value)} kg</td></tr>`).join('')
    const inLadder = model.ladders.some((l) => l.weightChart)
      ? '<div class="small mute">Peso por etapa: ver "Escadas de titulação".</div>'
      : ''
    const table = `<table><thead><tr><th>Data</th><th>Peso</th></tr></thead><tbody>${rows}</tbody></table>`
    return `<div class="mblock">${title}${table}${inLadder}</div>`
  }
  if (block.type === 'pressao_arterial') {
    const rows = block.points
      .map(
        (p) =>
          `<tr><td class="num">${dm(p.day)} ${e(p.time)}</td><td>${e(p.contextLabel ?? '—')}</td>` +
          `<td class="num">${statValue(p.value, p.secondary)} mmHg</td></tr>`
      )
      .join('')
    const table = `<table><thead><tr><th>Data</th><th>Momento</th><th>Sistólica × diastólica</th></tr></thead><tbody>${rows}</tbody></table>`
    return `<div class="mblock">${title}${table}</div>`
  }
  // Glicemia: gráfico só com ≥ 3 medidas (DESIGN_DECISOES §3.7); tabela por momento sempre.
  const chart = block.chart ? glycemiaChart(block.points, model.header.window) : ''
  return `<div class="mblock">${title}${chart}${contextTable(block)}</div>`
}

function crossTable(section: MeasuresSection): string {
  if (!section.cross.length) return ''
  const rows = section.cross
    .map((r) => {
      const measures = r.measures
        .map((m) =>
          // Uma medida só: o valor basta — mediana e faixa de um ponto repetem o mesmo número (smoke C).
          m.stat.n === 1
            ? `${e(m.label)}: ${statValue(m.stat.median, m.secondary?.median)} ${e(m.unit)} · 1 medida`
            : `${e(m.label)}: ${m.stat.n} · mediana ${statValue(m.stat.median, m.secondary?.median)} · ` +
            `${statValue(m.stat.min, m.secondary?.min)} a ${statValue(m.stat.max, m.secondary?.max)} ${e(m.unit)}`
        )
        .join('<br>')
      return `<tr><td>${e(r.period)}</td><td class="num">${r.dosesTaken}</td><td class="num">${measures}</td></tr>`
    })
    .join('')
  return (
    '<div class="mblock"><div><b>Doses e medidas por período do dia</b></div>' +
    '<div class="small mute">doses tomadas e medidas registradas em cada período, somadas no período do relatório</div>' +
    `<table><thead><tr><th>Período</th><th>Doses tomadas</th><th>Medidas (n · mediana · mínimo a máximo)</th></tr></thead><tbody>${rows}</tbody></table></div>`
  )
}

function measuresFlow(model: ReportModel): FlowItem[] {
  const section = model.measures
  if (!section) return []
  return [
    { html: '<h2>Medidas</h2>' },
    ...section.blocks.filter((b) => b.type === 'glicemia').map((b) => ({ html: measureBlock(b, model) })),
    ...(section.cross.length ? [{ html: crossTable(section) }] : []),
    ...section.blocks.filter((b) => b.type !== 'glicemia').map((b) => ({ html: measureBlock(b, model) })),
  ]
}

// ── §3.8 Locais de aplicação (geometria do core, só número — NC-3) ───────────
function siteCard(card: InjectionSiteCard): string {
  const plural = card.total === 1 ? 'aplicação' : 'aplicações'
  const denominator = `<div class="small num">local informado em ${card.withSite} de ${card.total} ${plural}</div>`
  const counts = Object.fromEntries(card.counts.map((c) => [c.site, c.count]))
  const svg = renderBodyMapSvg(counts, escapeAttr(`Locais de aplicação de ${card.name}`))
  const list = card.counts.map((c) => `${e(c.label)}: ${c.count}`).join(' · ')
  return `<div class="site"><b>${e(card.name)}</b>${denominator}${svg}<div class="small num">${list}</div></div>`
}

function sitesFlow(cards: InjectionSiteCard[]): FlowItem[] {
  if (!cards.length) return []
  return [
    { html: '<h2>Locais de aplicação</h2>' },
    { html: `<div class="sites">${cards.map(siteCard).join('')}</div>` },
  ]
}

// ── §3.8b Estoque (anexo, sem custo) ──────────────────────────────────────────
const STOCK_TABLE: FlowTable = {
  id: 'stock',
  open: '<table><thead><tr><th>Medicamento</th><th>Quantidade atual</th><th>Consumo</th><th>Dura até</th></tr></thead><tbody>',
  close: '</tbody></table>',
}

function stockFlow(stock: StockRow[] | null): FlowItem[] {
  // `null` = rastreio desligado (044): a seção não existe. Lista vazia = nada a mostrar.
  if (!stock?.length) return []
  return [
    { html: '<h2>Estoque · anexo</h2>' },
    ...stock.map((s) => {
      const until = s.runsOutOn ? short(s.runsOutOn) : '<span class="mute">sem consumo</span>'
      return {
        html:
          `<tr><td>${e(s.label)}</td><td class="num">${e(s.quantityLabel)}</td><td class="num">${e(s.consumptionLabel)}</td>` +
          `<td class="num">${s.soon ? `<b>${until}</b>` : until}</td></tr>`,
        table: STOCK_TABLE,
      }
    }),
  ]
}

// ── §3.9 Rodapé (Chromium) + documento ───────────────────────────────────────
/**
 * Rodapé de toda página para o `footerTemplate` do Chromium. `pageNumber`/`totalPages` são
 * preenchidos pelo Chromium; todo texto passa pelo escape. O Chromium não herda o CSS do documento:
 * estilo inline.
 */
export function renderReportFooter(model: ReportModel): string {
  const w = model.header.window
  const left = ['dosiq', model.header.patientName ? e(model.header.patientName) : null, `${dm(w.from)} a ${dm(w.to)}`]
    .filter(Boolean)
    .join(' · ')
  return (
    '<div style="width:100%;padding:0 12mm;font-family:sans-serif;font-size:7px;color:#6b7280;display:flex;justify-content:space-between;gap:8px">' +
    `<span style="white-space:nowrap">${left}</span><span>${SAMD_NOTE}</span>` +
    '<span style="white-space:nowrap">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>'
  )
}

/** Junta o fluxo; linhas consecutivas da mesma tabela ficam numa tabela só (thead repetido pelo Chromium). */
function joinFlow(items: FlowItem[]): string {
  let out = ''
  let open = null as FlowTable | null
  for (const item of items) {
    if (item.table?.id !== open?.id) {
      if (open) out += open.close
      open = item.table ?? null
      if (open) out += open.open
    }
    out += item.html
  }
  return open ? out + open.close : out
}

/** Modelo → documento HTML completo para o Chromium. Puro. */
export function renderReportHtml(model: ReportModel): string {
  const body = joinFlow([
    ...visitFlow(model.forThisVisit),
    ...medicationsFlow(model.medications),
    ...intakesFlow(model),
    ...changesFlow(model.changes),
    ...laddersFlow(model),
    ...endedFlow(model),
    ...measuresFlow(model),
    ...sitesFlow(model.injectionSites),
    ...stockFlow(model.stock),
  ])
  const title = reportFileBaseName(model.header.window)
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    `<title>${e(title)}</title><style>${CSS}</style></head><body>${renderHeader(model)}${body}</body></html>`
  )
}
