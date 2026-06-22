import { getTodayLocal, getSaoPauloTime, parseISO, getNow } from '@utils/dateUtils'
import { splitDayTimeline, formatDoseItem, isProtocolActiveOnDate } from '@dosiq/core'
// Fonte única das regras estáticas e do system prompt (compartilhada com o serverless).
// Reexportadas aqui para compatibilidade de imports existentes (tests, telegram).
export { buildStaticSystemRules, buildSystemPrompt } from '@/features/chatbot/config/chatbotConfig'

/** Formata dias restantes (relativo) — Infinity/sem consumo → null (omitido). */
function _formatDaysRemaining(daysRemaining) {
  if (daysRemaining == null || !Number.isFinite(daysRemaining)) return null
  return `${Math.floor(daysRemaining)} dia${Math.floor(daysRemaining) === 1 ? '' : 's'}`
}

/**
 * Monta contexto compacto do paciente para enviar ao LLM.
 * Dados vem do DashboardContext (cache SWR) — ZERO chamadas ao Supabase.
 *
 * ESCOPO (decisão de produto): considera SOMENTE tratamentos ATIVOS com prescrição
 * válida na data da interação (`p.active && isProtocolActiveOnDate(p, hoje)`). Tratamentos
 * finalizados (end_date passado), pausados (active=false) e não-iniciados (start_date futuro)
 * NÃO entram no contexto — evita o bot sugerir repor estoque de cursos já encerrados.
 *
 * REGRAS:
 * - NUNCA incluir IDs, UUIDs, ou dados que identifiquem o usuario
 * - NUNCA incluir dados de outros usuarios
 * - Manter o contexto compacto (<2000 tokens) para nao estourar free tier
 *
 * @param {Object} params
 * @param {Array} params.medicines - Medicamentos (incluem .stock[] embedded)
 * @param {Array} params.protocols - Protocolos (todos; filtrados por ativo+válido aqui)
 * @param {Array} params.logs - Logs do dia
 * @param {Array} params.stockSummary - Resumo de estoque ({ medicine, total, daysRemaining, dailyIntake, isLow, isZero })
 * @param {Object} params.stats - Stats de adesao (adherence: 0-1, etc.)
 * @param {Array} params.doseInstances - Ocorrências de dose materializadas (próximas/atrasadas)
 * @returns {string} - Contexto formatado para system prompt
 */
export function buildPatientContext({ medicines, protocols, logs, stockSummary, stats, doseInstances }) {
  const today = getTodayLocal() // String YYYY-MM-DD
  const [y, m, d] = today.split('-').map(Number)
  const todayStr = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`

  // Apenas tratamentos ATIVOS com prescrição válida hoje (exclui finalizados/pausados/futuros)
  const validProtocols = (protocols || []).filter(
    (p) => p.active && isProtocolActiveOnDate(p, today)
  )
  const validMedicineIds = new Set(validProtocols.map((p) => p.medicine_id))
  const stockByMedId = new Map((stockSummary || []).map((s) => [s.medicine?.id, s]))

  const medsContext = (medicines || [])
    .filter((med) => validMedicineIds.has(med.id))
    .map((med) => {
      const protocol = validProtocols.find((p) => p.medicine_id === med.id)
      const stockEntry = stockByMedId.get(med.id)
      const totalStock =
        stockEntry?.total ??
        (med.stock || []).filter((s) => s.quantity > 0).reduce((sum, s) => sum + s.quantity, 0)

      return {
        nome: med.name,
        principioAtivo: med.active_ingredient,
        classeTerapeutica: med.therapeutic_class,
        dosagem: `${med.dosage_per_pill ?? ''}${med.dosage_unit ?? ''}`.trim(),
        frequencia: protocol?.frequency ?? 'sem protocolo',
        horarios: protocol?.time_schedule ?? [],
        estoque: totalStock,
        consumoDiario: stockEntry?.dailyIntake ?? null,
        diasRestantes: _formatDaysRemaining(stockEntry?.daysRemaining),
        semEstoque: stockEntry?.isZero ?? totalStock === 0,
      }
    })

  const todayLogs = (logs || []).filter((log) => {
    const logDate = getSaoPauloTime(parseISO(log.taken_at))
    return (
      logDate.getFullYear() === y &&
      logDate.getMonth() + 1 === m &&
      logDate.getDate() === d
    )
  })

  const adherence7d = stats?.adherence != null ? Math.round(stats.adherence * 100) : null

  // Próximas doses pendentes (hoje) e atrasadas (dias anteriores ainda actionáveis)
  const { carryOver = [], today: todayDoses = [] } = splitDayTimeline(
    doseInstances || [],
    validProtocols,
    { now: getNow() }
  )
  const pendingToday = todayDoses
    .filter((dose) => dose.status === 'pending')
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
  const overdue = carryOver.filter((dose) => dose.status === 'pending')

  // Alertas de estoque (somente tratamentos válidos) — sem estoque ou baixo
  const stockAlerts = medsContext
    .filter((mc) => mc.semEstoque || (mc.diasRestantes && parseInt(mc.diasRestantes, 10) <= 7))
    .map((mc) =>
      mc.semEstoque
        ? `- ${mc.nome}: SEM ESTOQUE`
        : `- ${mc.nome}: estoque baixo (~${mc.diasRestantes} restantes)`
    )

  return [
    `Data: ${todayStr}`,
    `Tratamentos ativos: ${medsContext.length}`,
    ...medsContext.map((mc) => {
      const infos = [mc.principioAtivo, mc.classeTerapeutica].filter(Boolean).join(', ')
      const detalhe = infos ? ` [${infos}]` : ''
      const consumo = mc.consumoDiario ? `, consumo ~${mc.consumoDiario}/dia` : ''
      const dias = mc.diasRestantes ? `, ~${mc.diasRestantes} restantes` : ''
      return `- ${mc.nome}${detalhe} (${mc.dosagem}): ${mc.frequencia}, horarios ${mc.horarios.join(', ') || 'nao definidos'}, estoque ${mc.estoque} un.${consumo}${dias}`
    }),
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

