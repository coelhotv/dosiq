// buildPatientContext.js — Builder canônico de contexto do paciente p/ o LLM (CON-028, ADR-074).
//
// FONTE ÚNICA web↔Telegram↔mobile. Consolida os antigos forks `contextBuilder.js` (web) e
// `buildServerContext` (Telegram). PURO e agnóstico de runtime: recebe os dados já buscados
// (saída do fetcher canônico) e injeta — NÃO busca, NÃO conhece browser/app/server.
//
// Onda 1a: consolida a lógica atual (a versão rica do web) SEM agrupamento por plano
// terapêutico — isso entra na Onda 1b. `treatmentPlans` faz parte do shape (CON-028) mas
// ainda não é consumido aqui.
//
// REGRAS:
// - NUNCA incluir IDs/UUIDs ou dados que identifiquem o usuário.
// - NUNCA incluir dados de outros usuários.
// - Manter o contexto compacto (<2000 tokens) p/ não estourar o free tier do LLM.
// - dateUtils SEMPRE do core (R-020); zero `new Date()` direto.

import { getTodayLocal, getSaoPauloTime, parseISO, getNow, parseLocalDate, isProtocolActiveOnDate as isProtocolInPeriod } from '../utils/dateUtils'
import { splitDayTimeline, type DoseZoneInstance, type DoseZoneProtocol } from '../utils/doseZones'
import { formatDoseItem, formatStockCount, formatIntakeDose, stockUnitLabel, formatNumberPtBR } from '../utils/doseUnit'
import { getProtocolDays } from '../utils/adherenceLogic'
import { calculateAge } from '../utils/profile'

/** Nomes dos dias da semana em PT (índice = Date.getDay(): 0=domingo). */
const WEEKDAYS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

/** Medicamento (shape mínimo consumido por este builder). */
interface MedicineLike {
  id: string
  name: string
  active_ingredient?: string | null
  therapeutic_class?: string | null
  dosage_per_pill?: number | null
  dosage_unit?: string | null
  units_per_ml?: number | null
  stock?: Array<{ quantity: number }>
}

/** Protocolo (shape mínimo consumido por este builder). */
interface ProtocolLike {
  medicine_id: string
  medicine?: MedicineLike | null
  active?: boolean
  start_date?: string | null
  end_date?: string | null
  frequency?: string
  time_schedule?: string[]
  dosage_per_intake?: number | null
  intake_unit?: string | null
  treatment_plan?: { name?: string | null } | null
}

/** Entrada de resumo de estoque (rich, já calculada pelo fetcher). */
interface StockSummaryEntry {
  medicine?: { id: string } | null
  total?: number
  dailyIntake?: number | null
  daysRemaining?: number | null
  isZero?: boolean
}

/** Perfil leve do paciente (sem PII sensível). */
interface ProfileLike {
  display_name?: string | null
  birth_date?: string | null
}

/** Log de dose registrada. */
interface LogLike {
  taken_at: string
}

/** Contexto derivado de UM medicamento (saída de _toMedContext). */
interface MedContext {
  nome: string
  principioAtivo?: string | null
  classeTerapeutica?: string | null
  dosagem: string
  estoque: number
  consumoDiario: number | null
  diasRestantes: string | null
  semEstoque: boolean
  medLike: { dosage_unit: string | null; dosage_per_pill: number | null; units_per_ml: number | null }
  frequencia: string
  horarios: string[]
  weekdays?: string[]
  dosePerIntake: number | null
  intakeUnit: string | null
  planName: string | null
}

/** Formata dias restantes (relativo) — Infinity/sem consumo → null (omitido). */
function _formatDaysRemaining(daysRemaining: number | null | undefined) {
  if (daysRemaining == null || !Number.isFinite(daysRemaining)) return null
  return `${Math.floor(daysRemaining)} dia${Math.floor(daysRemaining) === 1 ? '' : 's'}`
}

/** Campos derivados do PROTOCOLO (extraído p/ baixar complexidade de _toMedContext). */
function _protocolFields(protocol: ProtocolLike | null | undefined) {
  return {
    frequencia: protocol?.frequency ?? 'sem protocolo',
    horarios: protocol?.time_schedule ?? [],
    // Dias da semana agendados (semanal) — sem isso o LLM só via o horário (dose
    // semanal sem dia parece diária). getProtocolDays cobre weekdays[]/days[].
    weekdays: getProtocolDays(protocol),
    // Dose por tomada na unidade de tomada (gotas/UI/ml) p/ exibir certo em líquidos.
    dosePerIntake: protocol?.dosage_per_intake ?? null,
    intakeUnit: protocol?.intake_unit ?? null,
    // Plano terapêutico nomeado (onda 1b). Vazio/nulo/só-espaços → sem plano (flat, sem header).
    planName: protocol?.treatment_plan?.name?.trim() || null,
  }
}

/**
 * Identificação leve do paciente (se preenchida no perfil): personaliza o tom e dá
 * contexto etário (idoso → linguagem mais simples). Nome/idade não são PII sensível
 * (nada de IDs, CPF, contato). Retorna '' (omitido) quando vazio.
 */
function _formatPatientLine(profile: ProfileLike | null | undefined) {
  const name = profile?.display_name?.trim() || null
  const age = calculateAge(profile?.birth_date)
  if (!name && age == null) return ''
  return `Paciente: ${[name, age != null ? `${age} anos` : null].filter(Boolean).join(', ')}`
}

/** Saldo de estoque: stockSummary.total, ou soma dos lotes embedded (fallback). */
function _resolveStock(med: MedicineLike, stockEntry: StockSummaryEntry | undefined) {
  return (
    stockEntry?.total ??
    (med.stock || []).filter((s) => s.quantity > 0).reduce((sum, s) => sum + s.quantity, 0)
  )
}

/**
 * Deriva a entrada de contexto de UM medicamento (extraído p/ baixar complexidade do map).
 * @param med
 * @param validProtocols
 * @param stockByMedId
 */
function _toMedContext(
  med: MedicineLike,
  validProtocols: ProtocolLike[],
  stockByMedId: Map<string | undefined, StockSummaryEntry>
): MedContext {
  const protocol = validProtocols.find((p) => p.medicine_id === med.id)
  const stockEntry = stockByMedId.get(med.id)
  const totalStock = _resolveStock(med, stockEntry)

  return {
    nome: med.name,
    principioAtivo: med.active_ingredient,
    classeTerapeutica: med.therapeutic_class,
    dosagem: `${med.dosage_per_pill ?? ''}${med.dosage_unit ?? ''}`.trim(),
    estoque: totalStock,
    consumoDiario: stockEntry?.dailyIntake ?? null,
    diasRestantes: _formatDaysRemaining(stockEntry?.daysRemaining),
    semEstoque: stockEntry?.isZero ?? totalStock === 0,
    // Objeto medicine-like p/ os formatadores unit-aware (líquidos vs sólidos) do doseUnit.
    medLike: {
      dosage_unit: med.dosage_unit ?? null,
      dosage_per_pill: med.dosage_per_pill ?? null,
      units_per_ml: med.units_per_ml ?? null,
    },
    ..._protocolFields(protocol),
  }
}

/** Cronograma: frequência + (dias da semana p/ semanal) + horários. */
function _formatSchedule(mc: MedContext) {
  const horarios = mc.horarios.join(', ') || 'nao definidos'
  const freq = (mc.frequencia || '').toLowerCase()
  if ((freq === 'semanal' || freq === 'weekly') && mc.weekdays?.length) {
    return `semanal (${mc.weekdays.join(', ')}), horarios ${horarios}`
  }
  return `${mc.frequencia}, horarios ${horarios}`
}

/**
 * Linha de um medicamento. Unidades unit-aware (R-022/líquidos 022): estoque, consumo e
 * dose por tomada usam a unidade real do medicamento (ml/UI/gotas p/ líquidos; un./mg p/
 * sólidos) — NUNCA "un." cego (ex.: "5,2 ml" de Lantus, não "5,2 un.").
 */
function _formatMedLine(mc: MedContext) {
  const infos = [mc.principioAtivo, mc.classeTerapeutica].filter(Boolean).join(', ')
  const detalhe = infos ? ` [${infos}]` : ''
  const dose = mc.dosePerIntake ? `, dose ${formatIntakeDose(mc.dosePerIntake, mc.intakeUnit, mc.medLike)}` : ''
  const estoque = formatStockCount(mc.estoque, mc.medLike)
  const consumo = mc.consumoDiario
    ? `, consumo ~${formatNumberPtBR(Math.round(mc.consumoDiario * 100) / 100)} ${stockUnitLabel(mc.medLike)}/dia`
    : ''
  const dias = mc.diasRestantes ? `, ~${mc.diasRestantes} restantes` : ''
  return `- ${mc.nome}${detalhe} (${mc.dosagem}): ${_formatSchedule(mc)}${dose}, estoque ${estoque}${consumo}${dias}`
}

/**
 * Monta as linhas de medicamentos: PRIMEIRO os sem plano nomeado (flat, sem cabeçalho —
 * sem rótulo "Sem plano", evita ruído/associação falsa no LLM), DEPOIS os grupos nomeados
 * (header `Plano "<nome>":` + itens). Quando nenhum med tem plano nomeado, a saída é o
 * formato legado flat idêntico (compat PO-1).
 * @param medsContext - entradas já derivadas (com `planName: string|null`)
 * @returns linhas prontas
 */
function _buildMedLines(medsContext: MedContext[]): string[] {
  const ungrouped = medsContext.filter((mc) => !mc.planName)
  const grouped = new Map<string, MedContext[]>() // nome do plano → mc[] (ordem de aparição)
  for (const mc of medsContext) {
    if (!mc.planName) continue
    if (!grouped.has(mc.planName)) grouped.set(mc.planName, [])
    grouped.get(mc.planName)?.push(mc)
  }

  const lines = ungrouped.map(_formatMedLine)
  for (const [planName, items] of grouped) {
    lines.push(`Plano "${planName}":`)
    lines.push(...items.map(_formatMedLine))
  }
  return lines
}

/** Logs registrados HOJE (no tz local) — filtragem por ano/mês/dia. */
function _countTodayLogs(logs: LogLike[] | null | undefined, y: number, m: number, d: number) {
  return (logs || []).filter((log) => {
    const logDate = getSaoPauloTime(parseISO(log.taken_at))
    return logDate.getFullYear() === y && logDate.getMonth() + 1 === m && logDate.getDate() === d
  })
}

/** Filas de doses: pendentes de hoje (ordenadas) + atrasadas actionáveis (carry-over). */
function _resolveDoseQueues(doseInstances: DoseZoneInstance[] | undefined, validProtocols: DoseZoneProtocol[]) {
  const { carryOver = [], today: todayDoses = [] } = splitDayTimeline(
    doseInstances || [],
    validProtocols,
    { now: getNow() }
  )
  const pendingToday = todayDoses
    .filter((dose) => dose.status === 'pending')
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
  const overdue = carryOver.filter((dose) => dose.status === 'pending')
  return { pendingToday, overdue }
}

/**
 * Monta contexto compacto do paciente para enviar ao LLM.
 *
 * ESCOPO (decisão de produto, R-278): considera SOMENTE tratamentos ATIVOS com prescrição
 * vigente no PERÍODO da data da interação (`p.active && isProtocolInPeriod(p, hoje)`).
 * Finalizados, pausados e não-iniciados NÃO entram — evita o bot sugerir repor estoque de
 * cursos encerrados. NÃO filtra por frequência cair hoje (senão tratamentos semanais/PRN/
 * personalizados sumiriam do contexto fora do dia exato da dose); doses pendentes de HOJE
 * seguem por caminho próprio (splitDayTimeline sobre doseInstances).
 *
 * @param {Object} data - Saída do fetcher canônico (ver chatbotContextSchema / CON-028)
 * @param {Array} data.medicines - Medicamentos (incluem .stock[] embedded)
 * @param {Array} data.protocols - Protocolos (todos; filtrados por ativo+válido aqui)
 * @param {Array} data.logs - Logs recentes (filtrados p/ hoje internamente)
 * @param {Array} data.stockSummary - Resumo de estoque rich ({medicine,total,daysRemaining,dailyIntake,isZero,isLow})
 * @param {Object} data.stats - Stats de adesão ({ adherence: 0-1 })
 * @param {Array} data.doseInstances - Ocorrências de dose materializadas (próximas/atrasadas)
 * @param {Object} [data.profile] - Perfil leve do paciente ({ display_name, birth_date }) — sem PII sensível
 * @returns {string} - Contexto formatado para o system prompt
 */
export function buildPatientContext({ medicines, protocols, logs, stockSummary, stats, doseInstances, profile }: {
  medicines?: any[]; protocols?: any[]; logs?: any[]; stockSummary?: any[]; stats?: any; doseInstances?: any[]; profile?: any
} = {}) {
  const today = getTodayLocal('America/Sao_Paulo') // String YYYY-MM-DD (tz explícito — Hermes/Android)
  const [y, m, d] = today.split('-').map(Number)
  // Dia da semana nomeado: permite ao LLM raciocinar sobre semanais/personalizados quando
  // a pergunta é geral (ex.: "o que tomo às quintas?"), já que todo tratamento ativo entra
  // no contexto independente de a frequência cair hoje.
  const weekday = WEEKDAYS_PT[parseLocalDate(today).getDay()]
  const todayStr = `${weekday}, ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`

  // Apenas tratamentos ATIVOS com prescrição vigente no período hoje (exclui finalizados/
  // pausados/futuros). NÃO exige que a frequência caia hoje — semanais/PRN/personalizados
  // são tratamentos válidos mesmo sem dose no dia da interação.
  // Anexa o medicamento (do array `medicines`) a cada protocolo: o fetcher seleciona
  // protocols só com o join de treatment_plan, sem medicine — sem isto, splitDayTimeline
  // não resolve o nome/unidade da dose ("Desconhecido", "un." cego).
  const medsById = new Map((medicines || []).map((m) => [m.id, m]))
  const validProtocols = (protocols || [])
    .filter((p) => p.active && isProtocolInPeriod(p, today))
    .map((p) => ({ ...p, medicine: p.medicine ?? medsById.get(p.medicine_id) ?? null }))
  const validMedicineIds = new Set(validProtocols.map((p) => p.medicine_id))
  const stockByMedId = new Map((stockSummary || []).map((s) => [s.medicine?.id, s]))

  const medsContext = (medicines || [])
    .filter((med) => validMedicineIds.has(med.id))
    .map((med) => _toMedContext(med, validProtocols, stockByMedId))

  const todayLogs = _countTodayLogs(logs, y, m, d)
  const adherence7d = stats?.adherence != null ? Math.round(stats.adherence * 100) : null
  const { pendingToday, overdue } = _resolveDoseQueues(doseInstances, validProtocols)

  // Alertas de estoque (somente tratamentos válidos) — sem estoque ou baixo
  const stockAlerts = medsContext
    .filter((mc) => mc.semEstoque || (mc.diasRestantes && parseInt(mc.diasRestantes, 10) <= 7))
    .map((mc) =>
      mc.semEstoque
        ? `- ${mc.nome}: SEM ESTOQUE`
        : `- ${mc.nome}: estoque baixo (~${mc.diasRestantes} restantes)`
    )

  return [
    _formatPatientLine(profile),
    `Data: ${todayStr}`,
    `Tratamentos ativos: ${medsContext.length}`,
    ..._buildMedLines(medsContext),
    pendingToday.length
      ? `Próximas doses pendentes hoje: ${pendingToday.length}`
      : 'Nenhuma dose pendente para hoje',
    ...pendingToday.slice(0, 6).map((dose) => `- ${dose.scheduledTime} ${dose.medicineName} (${formatDoseItem(dose)})`),
    overdue.length ? `Doses atrasadas (dias anteriores): ${overdue.length}` : '',
    ...overdue.slice(0, 6).map((dose) => `- ${dose.scheduledTime} ${dose.medicineName} (${formatDoseItem(dose)})`),
    `Doses registradas hoje: ${todayLogs.length}`,
    adherence7d != null ? `Adesão ultimos 7 dias: ${adherence7d}%` : '',
    stockAlerts.length ? 'Atenção de estoque:' : '',
    ...stockAlerts,
  ]
    .filter(Boolean)
    .join('\n')
}
