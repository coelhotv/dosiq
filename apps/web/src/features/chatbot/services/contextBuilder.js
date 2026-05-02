import { getTodayLocal, getSaoPauloTime } from '@utils/dateUtils'

/**
 * Monta contexto compacto do paciente para enviar ao LLM.
 * Dados vem do DashboardContext (cache SWR) — ZERO chamadas ao Supabase.
 *
 * REGRAS:
 * - NUNCA incluir IDs, UUIDs, ou dados que identifiquem o usuario
 * - NUNCA incluir dados de outros usuarios
 * - Manter o contexto compacto (<2000 tokens) para nao estourar free tier
 *
 * @param {Object} params
 * @param {Array} params.medicines - Medicamentos (incluem .stock[] embedded)
 * @param {Array} params.protocols - Protocolos ativos
 * @param {Array} params.logs - Logs do dia
 * @param {Array} params.stockSummary - Resumo de estoque por medicamento
 * @param {Object} params.stats - Stats de adesao (adherence: 0-1, etc.)
 * @returns {string} - Contexto formatado para system prompt
 */
export function buildPatientContext({ medicines, protocols, logs, stockSummary, stats }) {
  const today = getTodayLocal() // String YYYY-MM-DD
  const [y, m, d] = today.split('-').map(Number)
  const todayStr = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`

  const medsContext = (medicines || []).map((med) => {
    const protocol = (protocols || []).find((p) => p.medicine_id === med.id && p.active)
    // Estoque vem via stockSummary ou medicine.stock embedded
    const stockEntry = (stockSummary || []).find((s) => s.medicine_id === med.id)
    const totalStock =
      stockEntry?.quantity ??
      (med.stock || []).filter((s) => s.quantity > 0).reduce((sum, s) => sum + s.quantity, 0)

    return {
      nome: med.name,
      principioAtivo: med.active_ingredient,
      classeTerapeutica: med.therapeutic_class,
      dosagem: `${med.dosage_per_pill ?? ''}${med.dosage_unit ?? ''}`.trim(),
      frequencia: protocol?.frequency ?? 'sem protocolo',
      horarios: protocol?.time_schedule ?? [],
      estoque: totalStock,
    }
  })

  const todayLogs = (logs || []).filter((log) => {
    const logDate = getSaoPauloTime(new Date(log.taken_at))
    return (
      logDate.getFullYear() === y &&
      logDate.getMonth() + 1 === m &&
      logDate.getDate() === d
    )
  })

  const adherence7d = stats?.adherence != null ? Math.round(stats.adherence * 100) : null

  return [
    `Data: ${todayStr}`,
    `Medicamentos ativos: ${medsContext.length}`,
    ...medsContext.map((m) => {
      const infos = [m.principioAtivo, m.classeTerapeutica].filter(Boolean).join(', ')
      const detalhe = infos ? ` [${infos}]` : ''
      return `- ${m.nome}${detalhe} (${m.dosagem}): ${m.frequencia}, horarios ${m.horarios.join(', ') || 'nao definidos'}, estoque ${m.estoque} un.`
    }),
    `Doses registradas hoje: ${todayLogs.length}`,
    adherence7d != null ? `Adesão ultimos 7 dias: ${adherence7d}%` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Constrói a PARTE ESTÁTICA do system prompt (regras, instruções).
 * Esta seção é cacheable porque não muda entre requisições.
 * Ref: Groq Prompt Caching docs — colocar conteúdo estático PRIMEIRO.
 *
 * @returns {string}
 */
export function buildStaticSystemRules() {
  return [
    'Você é um assistente virtual do app Dosiq.',
    'Você ajuda o paciente a gerenciar seus medicamentos de forma amigavel.',
    'REGRAS ABSOLUTAS:',
    '- NUNCA recomende dosagens, diagnosticos ou substituicoes de medicamentos.',
    '- NUNCA sugira parar ou alterar tratamento sem consultar o medico.',
    '- Se sua resposta menciona medicamentos ou saúde, SEMPRE termine com uma linha em branco seguida de: "Não substituo orientação médica."',
    '- Responda em portugues brasileiro, de forma concisa (max 3 frases), em texto puro sem markdown, asteriscos, hashtags ou listas.',
    '- Use os dados do paciente abaixo para contextualizar respostas.',
  ].join('\n')
}

/**
 * System prompt para o LLM.
 * Combina regras estáticas (cacheable) + contexto dinâmico do paciente.
 *
 * NOTA: Para otimizar Groq Prompt Caching:
 * - Conteúdo estático (buildStaticSystemRules) deve vir PRIMEIRO
 * - Conteúdo dinâmico (patientContext) vem DEPOIS
 * - Isso permite cache hit em conversas multi-turn onde o contexto é reutilizado
 *
 * @param {string} patientContext
 * @returns {string}
 */
export function buildSystemPrompt(patientContext) {
  const staticRules = buildStaticSystemRules()
  return [staticRules, '', 'DADOS DO PACIENTE:', patientContext].join('\n')
}
