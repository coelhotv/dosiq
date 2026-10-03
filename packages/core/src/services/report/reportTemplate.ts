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
import { daysBetween, formatDayMonth, formatShortDate } from './reportFormat'
import { escapeAttr, escapeHtml as e } from './reportHtmlEscape'
import { REPORT_LOGO_DATA_URI } from './reportLogo'
import type { ReportLadder, ReportMedicationRow, ReportModel } from './reportModel'
import type { ReportWindow } from './reportTypes'
import type { ChangeItem } from './reportSections/changes'
import type { VisitItem } from './reportSections/header'
import type { DayCellState, IntakeRow } from './reportSections/intakes'
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
.d180 .c{height:12px}
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
thead{display:table-header-group}
tr,.irow,.ladder,.box,.chg{break-inside:avoid;page-break-inside:avoid}
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
    h.dataWindow.from !== h.window.from ? `<b>registros a partir de ${fullDate(h.dataWindow.from)}</b>` : null,
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

/** `pad` completa a linha com células invisíveis: duas linhas, mesma largura de célula. */
function strip(days: IntakeRow['days'], pad = 0): string {
  const cells = days.map((d) => `<span class="c ${CELL[d.state]}"></span>`).join('')
  return `<div class="strip">${cells}${'<span class="c empty"></span>'.repeat(pad)}</div>`
}

function ticks(days: IntakeRow['days']): string {
  if (days.length < 2) return ''
  const mid = days[Math.floor(days.length / 2)].day
  return `<div class="ticks num"><span>${dm(days[0].day)}</span><span>${dm(mid)}</span><span>${dm(days[days.length - 1].day)}</span></div>`
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
  if (periodDays <= 30) return `<div class="irow side" ${attr}>${who}<div class="strips">${strip(row.days)}</div></div>`
  if (periodDays <= 90) return `<div class="irow" ${attr}>${who}${strip(row.days)}${ticks(row.days)}</div>`
  // Acima de 90 dias: duas faixas com metade dos dias cada e a mesma escala (uma célula por dia,
  // sempre — §3.4); a segunda é completada com células vazias se o total for ímpar.
  const half = Math.ceil(row.days.length / 2)
  const halves = [row.days.slice(0, half), row.days.slice(half)]
  return `<div class="irow d180" ${attr}>${who}${halves.map((h) => strip(h, half - h.length) + ticks(h)).join('')}</div>`
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
  const days = model.header.dataWindow.days
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
  const days = model.header.dataWindow.days
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
function weightChart(ladder: ReportLadder, dataWindow: ReportWindow): string {
  const series = ladder.weightSeries
  if (!series) return ''
  // Eixo próprio: da 1ª etapa (recortada ao período) ao fim — a escada não fica espremida na ponta.
  const first = series.steps[0]?.start
  const window = first && first > dataWindow.from ? { ...dataWindow, from: first } : dataWindow
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
    `<text x="${PAD_L}" y="${CHART_H - 2}" font-size="9" fill="#6b7280">${dm(window.from)}</text>` +
    `<text x="${CHART_W - 30}" y="${CHART_H - 2}" font-size="9" fill="#6b7280">${dm(window.to)}</text>`
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
    const chart = weightChart(ladder, model.header.dataWindow)
    items.push({
      html: `<div class="ladder"><b>${e(ladder.name)}</b><div class="steps">${steps}</div>${chart}</div>`,
    })
  }
  return items
}

// ── §3.8b Estoque (anexo, sem custo) ──────────────────────────────────────────
const STOCK_TABLE: FlowTable = {
  id: 'stock',
  open: '<table><thead><tr><th>Medicamento</th><th>Quantidade atual</th><th>Consumo por dia</th><th>Dura até</th></tr></thead><tbody>',
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
          `<tr><td>${e(s.name)}</td><td class="num">${e(s.quantityLabel)}</td><td class="num">${e(s.dailyIntakeLabel)}</td>` +
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
    ...stockFlow(model.stock),
  ])
  const title = reportFileBaseName(model.header.window)
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    `<title>${e(title)}</title><style>${CSS}</style></head><body>${renderHeader(model)}${body}</body></html>`
  )
}
