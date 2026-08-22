/**
 * Consultation Data Service - Serviço de agregação de dados clínicos
 *
 * Agrega todos os dados necessários para o Modo Consulta Médica.
 * NÃO faz chamadas Supabase — usa APENAS dados do dashboardData (context).
 *
 * @module consultationDataService
 */

import { getExpiringPrescriptions } from '@prescriptions/services/prescriptionService'
import { emergencyCardService } from '@emergency/services/emergencyCardService'
import { extractEmailHandle, formatPatientDisplayName } from '@shared/utils/patientUtils'
import { calculateTitrationData } from '@utils/titrationUtils'
import {
  formatIntakeDose,
  formatActiveIngredientShort,
  formatNumberPtBR,
  resolveCurrentStep,
} from '@dosiq/core'
import { addDays, getServerTimestamp, parseISO } from '@utils/dateUtils'

/**
 * Agrega todos os dados clínicos para o Modo Consulta Médica
 *
 * @param {Object} dashboardData - Dados do contexto do Dashboard
 * @param {Array} dashboardData.medicines - Lista de medicamentos
 * @param {Array} dashboardData.protocols - Lista de protocolos (com next_dose)
 * @param {Array} dashboardData.logs - Logs de doses (últimos 30 dias)
 * @param {Array} dashboardData.stockSummary - Sumário de estoque processado
 * @param {Object} dashboardData.stats - Estatísticas de aderência
 * @param {string} [patientName] - Nome do paciente (opcional)
 * @param {number} [patientAge] - Idade do paciente (opcional)
 * @param {string} [patientEmail] - Email do paciente (opcional)
 * @param {string} [userId] - ID do usuário (isolamento do cartão offline)
 * @param {{ last30d?: Object, last90d?: Object }} [adherenceSummaries] - Sumários
 *        instance-based (de `adherenceService.getAdherenceSummary`) injetados pelo
 *        caller (Opção A — service permanece sync/sem I/O). ADR-054.
 * @returns {Object} Objeto consolidado com todos os dados clínicos
 */
export function getConsultationData(
  dashboardData,
  patientName = '',
  patientAge = null,
  patientEmail = '',
  userId = null,
  adherenceSummaries = null
) {
  // Guard defensivo: dashboardData pode chegar nulo em render inicial/loading (Gemini #620).
  const { medicines, protocols, stockSummary } = dashboardData || {}

  // 1. Informações do paciente + cartão de emergência (offline, do localStorage)
  // userId obrigatório para isolamento entre usuários no mesmo dispositivo
  const emergencyCard = emergencyCardService.getOfflineCard(userId)

  const patientInfo = {
    name: formatPatientDisplayName(patientName, patientEmail),
    handle: extractEmailHandle(patientEmail) || null,
    age: patientAge,
    emergencyCard: emergencyCard || null,
  }

  // 2. Medicamentos ativos (com protocolos ativos)
  const activeMedicines = _extractActiveMedicines(medicines, protocols)

  // 3. Sumário de aderência (30d e 90d) — fonte única dose_instances (ADR-054).
  // O caller (Consultation.jsx) busca os summaries instance-based e injeta aqui,
  // mantendo este service sync/sem I/O. PDF == anel do dashboard (mesma fonte).
  const adherenceSummary = _calculateAdherenceSummary(adherenceSummaries)

  // 4. Alertas de estoque (críticos e baixos)
  const stockAlerts = _extractStockAlerts(stockSummary, medicines)

  // 5. Status de prescrições (vencendo/vencidas)
  const prescriptionStatus = _extractPrescriptionStatus(protocols)

  // 6. Titulações ativas
  const activeTitrations = _extractActiveTitrations(protocols, medicines)

  return {
    patientInfo,
    activeMedicines,
    adherenceSummary,
    stockAlerts,
    prescriptionStatus,
    activeTitrations,
    generatedAt: getServerTimestamp(),
  }
}

/**
 * Extrai medicamentos que possuem protocolos ativos
 * Inclui cálculo de dosagem real baseado nos protocolos
 * @private
 */
function _extractActiveMedicines(medicines, protocols) {
  if (!medicines || !protocols) return []

  const activeProtocolMedicineIds = new Set(
    protocols
      .filter((p) => p.active !== false) // Considera undefined como ativo
      .map((p) => p.medicine_id)
  )

  return medicines
    .filter((m) => activeProtocolMedicineIds.has(m.id))
    .map((medicine) => {
      // Busca protocolos ativos deste medicamento
      const medicineProtocols = protocols.filter(
        (p) => p.medicine_id === medicine.id && p.active !== false
      )

      // Dosagem por comprimido em mg (do cadastro do medicamento)
      // NÃO tentamos inferir do protocolo - lá temos apenas quantidade de comprimidos
      const dosagePerPill = medicine.dosage_per_pill || null
      const dosageUnit = medicine.dosage_unit || 'mg'

      // Calcula dosagens baseadas nos protocolos (liquid-aware — 022)
      const dosageInfo = _calculateDosageInfo(medicineProtocols, dosagePerPill, medicine)

      return {
        id: medicine.id,
        name: medicine.name,
        type: medicine.type || 'comprimido',
        dosagePerPill,
        dosageUnit,
        ...dosageInfo,
        notes: medicine.notes || null,
      }
    })
}

/**
 * Calcula informações de dosagem baseado nos protocolos
 * @private
 */
function _calculateDosageInfo(protocols, dosagePerPill, medicine = null) {
  if (!protocols || protocols.length === 0) {
    return { dosagePerIntake: null, timesPerDay: null, dailyDosage: null, isLiquid: false, intakeUnit: null }
  }

  // Líquidos (022): a dose já está na unidade de tomada (gotas/ml/UI). NÃO multiplicar
  // por dosagePerPill (concentração) — isso gerava "10000 mg/ml" absurdos. O total
  // diário fica na própria unidade de tomada; a concentração é exibida à parte.
  const isLiquid = Boolean(medicine?.dosage_unit?.endsWith('/ml'))

  let totalTimesPerDay = 0
  let liquidDailyDose = 0 // soma dose×vezes na unidade de tomada (líquidos)
  let totalDosagePerIntake = 0 // soma em mg (sólidos)
  let intakeUnit = null

  protocols.forEach((protocol) => {
    const timesPerDay = protocol.time_schedule?.length || 1
    const dosePerIntake = protocol.dosage_per_intake || 1
    totalTimesPerDay += timesPerDay

    if (isLiquid) {
      intakeUnit = intakeUnit || protocol.intake_unit || 'ml'
      liquidDailyDose += dosePerIntake * timesPerDay
    } else if (dosagePerPill) {
      totalDosagePerIntake += dosePerIntake * dosagePerPill
    }
  })

  if (isLiquid) {
    return {
      dosagePerIntake: null,
      timesPerDay: totalTimesPerDay,
      dailyDosage: liquidDailyDose,
      isLiquid: true,
      intakeUnit,
    }
  }

  if (totalDosagePerIntake === 0) {
    return {
      dosagePerIntake: null,
      timesPerDay: totalTimesPerDay > 0 ? totalTimesPerDay : null,
      dailyDosage: null,
      isLiquid: false,
      intakeUnit: null,
    }
  }

  // Dosagem diária total = dosagem por tomada × vezes ao dia (sólidos)
  const dailyDosage = totalDosagePerIntake * totalTimesPerDay

  return {
    dosagePerIntake: totalDosagePerIntake,
    timesPerDay: totalTimesPerDay,
    dailyDosage,
    isLiquid: false,
    intakeUnit: null,
  }
}

/**
 * Mapeia os sumários de adesão instance-based (de `adherenceService.getAdherenceSummary`)
 * para o shape do PDF/consulta. Fonte única `dose_instances` (ADR-054, R-248):
 * `overallScore` já é `taken/(taken+missed)*100` capado — sem o bug >100% do legado.
 * Não infere ±2h sobre logs (aposentou `calculateAdherenceStats`).
 *
 * @param {{ last30d?: Object, last90d?: Object }|null} adherenceSummaries
 *        Cada summary: `{ overallScore, overallTaken, overallExpected, currentStreak }`.
 * @private
 */
function _calculateAdherenceSummary(adherenceSummaries) {
  const empty = { score: 0, taken: 0, expected: 0, punctuality: 0, currentStreak: 0 }
  if (!adherenceSummaries) {
    return { last30d: { ...empty }, last90d: { ...empty }, currentStreak: 0 }
  }

  const map = (s) => ({
    score: s?.overallScore ?? 0,
    taken: s?.overallTaken ?? 0,
    expected: Math.round(s?.overallExpected ?? 0),
    // No modelo de ocorrências, "tomada" já é dentro da tolerância → pontualidade ≡ adesão.
    punctuality: s?.overallScore ?? 0,
    currentStreak: s?.currentStreak ?? 0,
  })

  const { last30d, last90d } = adherenceSummaries
  return {
    last30d: map(last30d),
    last90d: map(last90d),
    currentStreak: last30d?.currentStreak ?? 0,
  }
}

/**
 * Extrai alertas de estoque (zerado ou baixo)
 * @private
 */
function _extractStockAlerts(stockSummary, medicines) {
  if (!stockSummary) return []

  return stockSummary
    .filter((item) => item.isZero || item.isLow)
    .map((item) => {
      const medicine = medicines?.find((m) => m.id === item.medicine?.id)
      const threshold = medicine?.min_stock_threshold || 0

      return {
        medicineId: item.medicine?.id,
        medicineName: item.medicine?.name || 'Desconhecido',
        totalQuantity: item.total || 0,
        daysRemaining: item.daysRemaining || 0,
        dailyIntake: item.dailyIntake || 0,
        severity: item.isZero ? 'critical' : 'warning',
        threshold,
        message: item.isZero
          ? 'Estoque esgotado'
          : `Estoque baixo (${item.total} ${item.total === 1 ? 'unidade' : 'unidades'})`,
      }
    })
    .sort((a, b) => {
      // Ordena: críticos primeiro, depois por dias restantes
      if (a.severity === 'critical' && b.severity !== 'critical') return -1
      if (b.severity === 'critical' && a.severity !== 'critical') return 1
      return (a.daysRemaining || Infinity) - (b.daysRemaining || Infinity)
    })
}

/**
 * Extrai status de prescrições (vencidas e vencendo)
 * @private
 */
function _extractPrescriptionStatus(protocols) {
  if (!protocols) return []

  const expiring = getExpiringPrescriptions(protocols, 30)

  return expiring.map((item) => ({
    protocolId: item.protocol.id,
    medicineName: item.protocol.medicine?.name || item.protocol.medicine_name || 'Desconhecido',
    status: item.status, // 'vencida' | 'vencendo' | 'vigente'
    daysRemaining: item.daysRemaining,
    endDate: item.protocol.end_date,
    isExpiring: item.status === 'vencendo',
    isExpired: item.status === 'vencida',
  }))
}

/**
 * Data local (dd/mm/aaaa) de um timestamp de etapa. R-020: nada de `new Date('YYYY-MM-DD')`.
 * @private
 */
function _stepDateLabel(value) {
  if (!value) return null
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Dose de um degrau da escada, no rótulo clínico.
 *
 * 🔴 Smoke do PO (2026-08-22): a nota saía "Dose alvo: 7,5 comprimidos" para o Mounjaro —
 * uma CANETA. A unidade não pode vir do degrau: `titration_steps.intake_unit` aceita `'cp'`
 * (que `protocols.intake_unit` NÃO aceita — CON-032 §5) e o embed de `protocols` sequer traz
 * a coluna, então o degrau chega sem unidade em parte dos caminhos. A unidade da tomada é um
 * fato do TRATAMENTO; o degrau só carrega o número.
 *
 * `'cp'` nunca é propagado para `protocols` — vira `null` aqui e o formatador do core resolve
 * o sólido pela concentração ("4 un. (100 mg)").
 *
 * @private
 */
function _stepDoseLabel(step, protocol, medicine) {
  if (!step || step.dose == null) return null
  const qty = Number(step.dose)
  const stepUnit = step.intake_unit || null

  // AC-39: `'cp'` é a unidade de COMPRIMIDO na escada. Ele é exibido por extenso, com a massa
  // equivalente ao lado, e NUNCA é propagado para `protocols` (que rejeita o valor — CON-032
  // §5). O rótulo é do degrau; a coluna do protocolo não é tocada.
  if (stepUnit === 'cp') {
    const label = `${formatNumberPtBR(qty)} ${qty === 1 ? 'comprimido' : 'comprimidos'}`
    const mass = formatActiveIngredientShort(qty, medicine?.dosage_per_pill, medicine?.dosage_unit)
    return mass ? `${label} (${mass})` : label
  }

  // Sem unidade no degrau, a unidade da tomada é um fato do TRATAMENTO (o degrau só carrega o
  // número, e o embed de `protocols` nem traz a coluna).
  const unit = stepUnit ?? protocol?.intake_unit ?? null
  return formatIntakeDose(step.dose, unit, medicine) || null
}

/**
 * Duração de um degrau em linguagem clínica. Degrau sem duração é o de MANUTENÇÃO (dose alvo):
 * ele não "dura", ele permanece.
 * @private
 */
function _stepDurationLabel(step) {
  const days = Number(step?.duration_days)
  if (!Number.isFinite(days) || days <= 0) return 'contínua'
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

/**
 * Período do degrau: "18/07/2026 - 25/07/2026" quando ele tem início e duração; "desde
 * dd/mm/aaaa" para o degrau vigente contínuo (a dose alvo não termina). Espelha a leitura da
 * timeline do app (Etapa N · Concluída · 18 jul - 25 jul).
 * @private
 */
function _stepPeriodLabel(step) {
  const start = _stepDateLabel(step?.started_at)
  if (!start) return '-'
  const days = Number(step?.duration_days)
  if (!Number.isFinite(days) || days <= 0) return `desde ${start}`
  const parsed = parseISO(step.started_at)
  if (Number.isNaN(parsed.getTime())) return `desde ${start}`
  // R-020: aritmética sobre o Date local já parseado — nunca `new Date('YYYY-MM-DD')`.
  const end = addDays(parsed, days).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
  })
  return `${start} - ${end}`
}

/**
 * Situação do degrau, na linguagem do documento (o CHECK de `titration_steps.status` é
 * `completed | current | upcoming | pending_confirmation` — R-295, conferido no banco).
 * @private
 */
function _stepStatusLabel(step) {
  switch (step?.status) {
    case 'current': return 'atual'
    case 'completed': return 'concluído'
    case 'pending_confirmation': return 'aguardando confirmação'
    default: return 'a seguir'
  }
}

/**
 * AC-37: a escada COMPLETA — dose, duração, período e situação de cada degrau, na ordem de
 * `position`. Um contador "4/4" diz que o paciente chegou ao fim; não diz de quanto para quanto
 * ele subiu, nem em quanto tempo, que é o que decide manter, subir ou recuar.
 *
 * 🔴 R-299: cada degrau é um FATO DATADO e carrega o próprio medicamento — uma escada
 * cross-medicamento troca de cadastro no meio (e a concentração muda junto). Converter a dose de
 * um degrau antigo pela concentração do cadastro de HOJE reescreveria o passado do paciente.
 *
 * @private
 */
function _buildLadder(ordered, protocol, medicine, medicines) {
  return ordered.map((step, index) => {
    const stepMedicine = medicines?.find((m) => m.id === step.medicine_id) || medicine
    const doseLabel = _stepDoseLabel(step, protocol, stepMedicine) || '-'
    const crossMedicine = stepMedicine?.name && stepMedicine.name !== medicine?.name
    return {
      position: index + 1,
      doseLabel: crossMedicine ? `${stepMedicine.name} · ${doseLabel}` : doseLabel,
      durationLabel: _stepDurationLabel(step),
      startLabel: _stepDateLabel(step.started_at) || '-',
      periodLabel: _stepPeriodLabel(step),
      statusLabel: _stepStatusLabel(step),
      isCurrent: step.status === 'current',
    }
  })
}

/**
 * Extrai as titulações do paciente para o modo consulta e para o PDF.
 *
 * 🔴 073/F-24 — POR QUE ISTO MUDOU: a seção de titulação SUMIA para quem terminou de titular.
 * O extrator descartava (`return null`) todo tratamento cujo `calculateTitrationData` fosse
 * `null`, e essa função retorna `null` de propósito quando a etapa vigente é CONTÍNUA (dose
 * de manutenção, sem duração) — o contrato dela é PROGRESSO, e manutenção não tem progresso.
 * Resultado: o gate `titrationRows.length > 0` do PDF virou um gate de "tem progresso" quando
 * deveria ser de "tem escada", e a conta do PO — 4 tratamentos em manutenção, 12 degraus no
 * banco — gerava um documento com ZERO menção à titulação. O médico não via a escada que o
 * paciente subiu.
 *
 * `calculateTitrationData` NÃO é alterada (o contrato dela está certo): quem passa a
 * distinguir "sem escada" de "escada concluída" é este extrator.
 *
 * ⚠️ As etapas devem ser a escada COMPLETA (por `titration_id`, via `attachFullLadders` do
 * core), nunca o recorte por `protocol_id` do embed — AP-311.
 *
 * @private
 */
function _extractActiveTitrations(protocols, medicines) {
  if (!protocols) return []
  return protocols.map((protocol) => _buildTitrationRow(protocol, medicines)).filter(Boolean)
}

/**
 * Linha de um tratamento em EVOLUÇÃO (etapa vigente com duração — há progresso a exibir).
 *
 * 🔴 RC6/R-299: `currentDoseLabel` vem da PRÓPRIA linha da escada, que já resolveu o medicamento
 * do degrau. Recalcular com o medicamento do protocolo imprimiria a massa da concentração errada
 * numa escada cross-medicamento — e faria a nota discordar da tabela logo abaixo, no mesmo
 * documento.
 * @private
 */
function _progressRow(base, ordered, ladder, titrationData) {
  // `currentStep` é 1-based (rótulo de exibição); a escada está ordenada por position.
  const index = titrationData.currentStep - 1
  return {
    ...base,
    isMaintenance: false,
    currentStep: titrationData.currentStep,
    currentDay: titrationData.day,
    totalDays: titrationData.totalDays,
    progressPercent: Math.round(titrationData.progressPercent),
    isTransitionDue: titrationData.isTransitionDue,
    daysRemaining: titrationData.daysRemaining,
    currentDosage: ordered[index]?.dose ?? null,
    currentDoseLabel: ladder[index]?.doseLabel ?? null,
    maintenanceSince: null,
  }
}

/**
 * Uma linha de titulação (ou `null` quando não há o que declarar).
 * @private
 */
function _buildTitrationRow(protocol, medicines) {
  const steps = protocol.titration_steps
  if (!Array.isArray(steps) || steps.length === 0) return null

  const ordered = [...steps].sort((a, b) => a.position - b.position)
  const medicine = medicines?.find((m) => m.id === protocol.medicine_id)
  const ladder = _buildLadder(ordered, protocol, medicine, medicines)

  const base = {
    protocolId: protocol.id,
    ladder,
    medicineId: protocol.medicine_id,
    medicineName: medicine?.name || protocol.medicine_name || 'Desconhecido',
    totalSteps: ordered.length,
    // SEMPRE null: a nota/objetivo por etapa era campo do N1 e NÃO migrou (decisão de
    // PRODUTO — `titration_steps` não tem `description`, R-295 conferido no banco).
    stageNote: null,
  }

  const titrationData = calculateTitrationData(ordered)
  if (titrationData) return _progressRow(base, ordered, ladder, titrationData)

  // Sem progresso a exibir. Só vira linha se houver etapa vigente CONTÍNUA — ou seja, manutenção
  // (dose alvo atingida). Escada sem etapa vigente é escada não iniciada ou encerrada: nada a
  // declarar num documento clínico.
  const currentStep = resolveCurrentStep(ordered)
  if (!currentStep) return null

  const currentIndex = ordered.indexOf(currentStep)
  return {
    ...base,
    isMaintenance: true,
    currentStep: currentIndex + 1,
    currentDay: null,
    totalDays: null,
    progressPercent: null,
    isTransitionDue: false,
    daysRemaining: null,
    currentDosage: currentStep.dose ?? null,
    // RC6/R-299: idem — a nota "Dose alvo" sai da linha da escada, nunca de um recálculo.
    currentDoseLabel: ladder[currentIndex]?.doseLabel ?? null,
    maintenanceSince: _stepDateLabel(currentStep.started_at),
  }
}

export default {
  getConsultationData,
}
