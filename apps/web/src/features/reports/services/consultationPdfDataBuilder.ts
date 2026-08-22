/**
 * @fileoverview Monta os dados normalizados do PDF de consulta medica.
 * Converte o estado clinico da app em um modelo editorial pronto para renderizacao.
 * @module features/reports/services/consultationPdfDataBuilder
 */

import { addDays, formatLocalDate, parseLocalDate, parseISO, getNow, getTodayLocal } from '@utils/dateUtils'
import { extractEmailHandle, formatPatientDisplayName } from '@shared/utils/patientUtils'
import { calculateDailyIntake, calculateDosesByDate } from '@utils/adherenceLogic'
import {
  stockDoseMetrics,
  isProtocolVigentOn,
  stockUnitLabel,
  formatNumberPtBR,
  frequencyDailyFactor,
  FREQUENCY_LABELS,
  formatIntakeDose,
  formatMedicineConcentration,
} from '@dosiq/core'
import {
  buildSummaryCards,
  buildAttentionItems,
  buildPatientSection,
  buildClinicalNotes,
} from './_pdfSectionBuilders'

/**
 * Formata um numero com fallback legivel.
 * @param {number|string|null|undefined} value - Valor a formatar.
 * @param {string} fallback - Texto exibido quando nao ha valor.
 * @returns {string} Texto formatado.
 */
function safeText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function getTrendLabel(days) {
  if (days >= 90) return '90 dias'
  if (days >= 30) return '30 dias'
  if (days >= 7) return '7 dias'
  return `${days} dias`
}

function summarizeTrend(trend = [], fallbackCurrentStreak = 0) {
  const totals = trend.reduce(
    (accumulator, row) => ({
      taken: accumulator.taken + Number(row.taken ?? 0),
      expected: accumulator.expected + Number(row.expected ?? 0),
    }),
    { taken: 0, expected: 0 }
  )

  const score = totals.expected > 0 ? Math.round((totals.taken / totals.expected) * 100) : 0

  return {
    score,
    taken: totals.taken,
    expected: totals.expected,
    punctuality: score,
    currentStreak: fallbackCurrentStreak,
  }
}

/**
 * Retorna o nome clinico do tratamento.
 * @param {Object} protocol - Protocolo ativo.
 * @param {Object} medicine - Medicamento associado.
 * @returns {string} Label no formato `[tratamento] - [medicacao]`.
 */
/** Retorna o primeiro valor truthy dos argumentos. @param {...*} vals @returns {*} */
function _first(...vals) { return vals.find(Boolean) }

export function formatTreatmentLabel(protocol, medicine) {
  const treatmentName = _first(protocol?.name, protocol?.treatment_name, protocol?.medicine_name) ?? ''
  const medicineName = _first(medicine?.name, protocol?.medicine?.name, protocol?.medicine_name) ?? ''
  if (treatmentName && medicineName) return `${treatmentName} - ${medicineName}`
  return treatmentName || medicineName || 'Tratamento sem nome'
}

/**
 * Apresentação do medicamento (concentração cadastrada).
 *
 * 073/F-1: era um formatador LOCAL que colava " por comprimido" em qualquer coisa — inclusive
 * em caneta injetável e frasco de líquido. A concentração agora sai do formatador canônico do
 * core (o MESMO que a página de estoque deste PDF já usava), que respeita a forma real.
 *
 * @param {Object} medicine - Medicamento cadastrado.
 * @returns {string} Texto de apresentacao.
 */
function _formatPresentation(medicine) {
  return formatMedicineConcentration(medicine) || 'Apresentação não cadastrada'
}

/**
 * Dose por tomada, na unidade REAL da tomada.
 *
 * 🔴 073/F-17 (o achado mais grave da spec): o formatador local multiplicava
 * `dosage_per_intake × dosage_per_pill` SEMPRE, ignorando `intake_unit`. Quando a tomada já
 * está em massa (`mg`/`UI`), isso multiplica a dose pela CONCENTRAÇÃO e imprime a
 * concentração como se fosse a dose — "Lantus 10 UI" saía "1.000 UI" no documento que o
 * paciente leva ao médico (2 ordens de grandeza).
 *
 * @param {Object} protocol - Protocolo.
 * @param {Object} medicine - Medicamento cadastrado.
 * @returns {string}
 */
function _formatDosePerIntake(protocol, medicine) {
  return formatIntakeDose(protocol?.dosage_per_intake ?? 1, protocol?.intake_unit, medicine)
}

/** Tomadas por dia declaradas no `time_schedule` (mínimo 1). */
function _timesPerDay(protocol) {
  const schedule = Array.isArray(protocol?.time_schedule) ? protocol.time_schedule : []
  return schedule.length > 0 ? schedule.length : 1
}

/**
 * Cadência clínica: a FREQUÊNCIA declarada + as tomadas do dia em que há dose.
 *
 * 073/F-2: o texto anterior derivava tudo do tamanho do `time_schedule` e imprimia "1x/dia"
 * para um GLP-1 SEMANAL — a cadência do tratamento simplesmente não entrava na conta.
 *
 * @param {Object} protocol - Protocolo.
 * @returns {string}
 */
function _formatCadence(protocol) {
  const schedule = Array.isArray(protocol?.time_schedule) ? protocol.time_schedule : []
  const times = _timesPerDay(protocol)
  const frequencyLabel = FREQUENCY_LABELS[protocol?.frequency] || FREQUENCY_LABELS['diário']
  const timesLabel = times === 1 ? '1 tomada' : `${times} tomadas`
  const preview = schedule.slice(0, 3).join(', ')
  const suffix = schedule.length > 3 ? '...' : ''
  const scheduleLabel = preview ? ` • ${preview}${suffix}` : ''
  return `${frequencyLabel} • ${timesLabel}${scheduleLabel}`
}

/**
 * Dose diária MÉDIA, na unidade real da tomada.
 *
 * 073/E-1: o formatador local acumulava as duas doenças — multiplicava pela concentração
 * (F-17) e tratava `time_schedule.length` como cadência (F-2), tratando semanal como diário.
 * A média por dia usa `frequencyDailyFactor` (o mesmo fator que a página de ESTOQUE deste
 * documento já aplicava via `calculateDailyIntake` — ADR-094: cadência sobre a dose, nunca
 * sobre a vigência).
 *
 * @param {Object} protocol - Protocolo.
 * @param {Object} medicine - Medicamento cadastrado.
 * @returns {string}
 */
function _formatDailyDose(protocol, medicine) {
  const perIntake = Number(protocol?.dosage_per_intake ?? 1)
  if (!Number.isFinite(perIntake)) return '-'
  const perDay = perIntake * _timesPerDay(protocol) * frequencyDailyFactor(protocol)
  // Arredonda em 3 casas: o fator 1/7 (semanal) produz dízima e o formatador do core não
  // arredonda (R-277 — o artefato de float vazaria para o documento).
  const rounded = Math.round(perDay * 1000) / 1000
  const label = formatIntakeDose(rounded, protocol?.intake_unit, medicine)
  // "10 UI (≈ 0,1 mL) por dia" lê melhor que colar "/dia" depois do parêntese.
  return label ? `${label} por dia` : '-'
}

/**
 * Calcula a severidade de estoque.
 * @param {Object} stockItem - Resumo de estoque.
 * @returns {string} critical|warning|stable
 */
function getStockSeverity(stockItem) {
  if (!stockItem) return 'stable'
  if (stockItem.isZero || (stockItem.daysRemaining !== null && stockItem.daysRemaining <= 0)) {
    return 'critical'
  }
  if (stockItem.isLow || (stockItem.daysRemaining !== null && stockItem.daysRemaining < 7)) {
    return 'warning'
  }
  return 'stable'
}

/**
 * Gera rows de tratamentos para a tabela principal.
 * @param {Array<Object>} protocols - Protocolos do paciente.
 * @param {Array<Object>} medicines - Medicamentos do paciente.
 * @returns {Array<Object>} Rows prontos para renderizacao.
 */
function buildTreatmentRows(protocols = [], medicines = [], asOf = getTodayLocal()) {
  return protocols
    // 073/F-18: a listagem filtrava só por `active !== false` e ainda carimbava 'Ativo'
    // literal — a Dipirona vencida em 18/08 saía "Ativo" na pág. 2 e "Vencida" na pág. 5 do
    // MESMO documento. Filtro e status agora derivam do MESMO predicado canônico.
    .filter((protocol) => isProtocolVigentOn(protocol, asOf))
    .map((protocol) => {
      const medicine =
        medicines.find((item) => item.id === protocol.medicine_id) || protocol.medicine || {}
      const timesPerDay =
        Array.isArray(protocol.time_schedule) && protocol.time_schedule.length > 0
          ? protocol.time_schedule.length
          : 1
      const dosagePerPill = medicine.dosage_per_pill ?? null
      const dosagePerIntake =
        dosagePerPill === null ? null : (protocol.dosage_per_intake ?? 1) * dosagePerPill

      return {
        id: protocol.id,
        label: formatTreatmentLabel(protocol, medicine),
        presentation: _formatPresentation(medicine),
        dosePerIntake: _formatDosePerIntake(protocol, medicine),
        frequency: _formatCadence(protocol),
        dailyDose: _formatDailyDose(protocol, medicine),
        // Só chega aqui o que o predicado já declarou vigente em `asOf`; o rótulo diz isso,
        // não um literal (073/F-18).
        status: 'Vigente',
        // 029 F6: a nota lia `titration_schedule` (jsonb N1 dropado — e vazio em 100% das
        // linhas de prod, então este "Em titulacao" nunca apareceu num PDF de verdade).
        //
        // 🔴 NÃO foi repontada para a escada N2, ao contrário das telas (RC6 #765). Os
        // tratamentos daqui vêm do `protocolService.getAll()` (dashboard), cujo select traz
        // `titration_steps` pelo embed da FK `protocol_id` — o RECORTE do executor vigente, que
        // frequentemente não contém a etapa `current` (AP-311). Derivar `getEvolutionBadge`
        // desse recorte produziria uma nota que ora aparece, ora não, sem relação com a
        // realidade clínica. **Num documento que o paciente leva ao médico, uma afirmação
        // instável é pior que a ausência dela** — e o recorte é deliberado no core (o gerador
        // de doses PRECISA dele: a escada inteira vazaria a dose de outro medicamento no caso
        // cross-medicamento), então não dá para "só trocar o embed".
        //
        // Comportamento idêntico ao de antes do F6 (a nota nunca apareceu). Dívida registrada:
        // repontar exige a escada completa por `titration_id` no caminho da consulta —
        // `consultationDataService._extractActiveTitrations` tem o MESMO problema desde o F3.1.
        note: safeText(medicine.notes, 'Sem observacoes'),
        timesPerDay,
        dosagePerIntake,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

/**
 * Quantidade de estoque legível: no máximo 2 casas, vírgula pt-BR e a unidade do medicamento
 * (mL para líquido, "un." para sólido). 073/F-19.
 * @param {number|string|null|undefined} qty
 * @param {Object} medicine
 * @returns {string}
 */
function _formatStockAmount(qty, medicine) {
  const num = Number(qty)
  if (!Number.isFinite(num)) return '-'
  const rounded = Math.round(num * 100) / 100
  return `${formatNumberPtBR(rounded)} ${stockUnitLabel(medicine)}`
}

function _resolveStockMedicine(stockItem, medicines) {
  return medicines.find((item) => item.id === stockItem?.medicine?.id)
    || stockItem?.medicine || {}
}

function _resolveStockProtocol(medicine, protocols, asOf = getTodayLocal()) {
  // vigency-gate: ok — resolve o protocolo só para o RÓTULO da linha de estoque (o CONSUMO
  // é calculado por `calculateDailyIntake`/`stockDoseMetrics`, que já filtram vigência).
  // 073/E-3: era `find` sobre `active !== false`, que devolvia um tratamento ENCERRADO como
  // rótulo e, com dois vigentes, devolvia um arbitrário. Agora: vigente em `asOf` e, no
  // empate, o de `start_date` mais recente (determinístico).
  const candidates = protocols.filter(
    (item) => item.medicine_id === medicine.id && isProtocolVigentOn(item, asOf)
  )
  if (candidates.length <= 1) return candidates[0]
  return [...candidates].sort((a, b) =>
    String(b.start_date ?? '').localeCompare(String(a.start_date ?? ''))
  )[0]
}

function _resolveStockDays(stockItem, dailyIntake, totalQuantity) {
  if (stockItem?.daysRemaining != null) return stockItem.daysRemaining
  return dailyIntake > 0 ? Math.floor(totalQuantity / dailyIntake) : null
}

function _resolveStockMessage(stockItem) {
  if (stockItem?.isZero) return 'Estoque esgotado'
  if (stockItem?.isLow) return 'Estoque baixo'
  return 'Estoque monitorado'
}

/**
 * Mapeia um item de estoque para o formato de row do PDF.
 * @param {Object} stockItem - Item bruto de estoque
 * @param {Array} protocols - Protocolos
 * @param {Array} medicines - Medicamentos
 * @returns {Object}
 */
function _mapStockItem(stockItem, protocols, medicines, asOf = getTodayLocal()) {
  const medicine = _resolveStockMedicine(stockItem, medicines)
  const protocol = _resolveStockProtocol(medicine, protocols, asOf)
  // 064/US2 (F-14, opção (a)): `stockItem.dailyIntake` vem PRÉ-CALCULADO pelo dashboard,
  // sempre para HOJE. Num relatório cujo período não termina hoje, esse número é de outra
  // data de referência (R-299) — então ignoramos o pré-calculado e recalculamos com `asOf`.
  // No período corrente mantemos o pré-calculado (perf + consistência com a tela), que já
  // nasce filtrado por vigência desde `_useDashboardDerived`.
  const isCurrentPeriod = asOf === getTodayLocal()
  const preComputed = isCurrentPeriod ? stockItem : null
  const dailyIntake =
    preComputed?.dailyIntake ?? calculateDailyIntake(medicine.id, protocols, medicine, asOf)
  const totalQuantity = stockItem?.total ?? 0
  const daysRemaining = _resolveStockDays(preComputed, dailyIntake, totalQuantity)
  // RC6/064: `isZero`/`isLow` do `stockItem` também são de HOJE. Espalhá-los aqui misturaria
  // um `daysRemaining` do período com sinais de outra data de referência — exatamente o R-299
  // que este builder passou a respeitar. Fora do período corrente, derivar do próprio saldo.
  const healthSignals = preComputed ?? {
    isZero: totalQuantity <= 0,
    isLow: daysRemaining !== null && daysRemaining < 7,
  }
  const severity = getStockSeverity({ ...healthSignals, daysRemaining })
  const id = medicine.id || stockItem?.medicine?.id || stockItem?.medicine_id || crypto.randomUUID()

  // 012 B4 / ADR-067: doses físicas restantes (número-base p/ freq ≠ diário); a
  // severidade/runway seguem daysRemaining (cronológico).
  const medProtocols = protocols.filter((p) => p.medicine_id === medicine?.id && isProtocolVigentOn(p, asOf))
  const { dosesRemaining, isDaily } = stockDoseMetrics(totalQuantity, medProtocols, medicine, asOf)

  return {
    id,
    label: formatTreatmentLabel(protocol, medicine),
    medicineName: safeText(medicine.name, 'Desconhecido'),
    totalQuantity,
    // 073/F-19: a tabela imprimia o número CRU e sem unidade ("0.1279" de quê?). O rótulo
    // nasce aqui, onde o `medicine` existe — o renderer não tem como saber a unidade.
    totalQuantityLabel: _formatStockAmount(totalQuantity, medicine),
    dailyIntake,
    dailyIntakeLabel: _formatStockAmount(dailyIntake, medicine),
    daysRemaining,
    dosesRemaining,
    isDailyStock: isDaily,
    severity,
    message: _resolveStockMessage(healthSignals),
  }
}

/**
 * Gera rows de estoque ordenados por urgencia.
 * @param {Array<Object>} stockSummary - Sumario de estoque vindo do dashboard.
 * @param {Array<Object>} protocols - Protocolos ativos.
 * @param {Array<Object>} medicines - Medicamentos cadastrados.
 * @param {string} [asOf] - Data local de referência (fim do período do relatório).
 * @returns {Array<Object>} Rows do estoque.
 */
function buildStockRows(stockSummary = [], protocols = [], medicines = [], asOf = getTodayLocal()) {
  return stockSummary
    .map((stockItem) => _mapStockItem(stockItem, protocols, medicines, asOf))
    .sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, stable: 2 }
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      const aDays = a.daysRemaining ?? Number.POSITIVE_INFINITY
      const bDays = b.daysRemaining ?? Number.POSITIVE_INFINITY
      return aDays - bDays
    })
}

/**
 * Dias de prescrição em linguagem clínica: negativo vira "vencida há N dias". 073/F-21.
 * @param {number|null|undefined} days
 * @returns {string}
 */
function _formatPrescriptionDays(days) {
  const num = Number(days)
  if (!Number.isFinite(num)) return '-'
  if (num < 0) {
    const overdue = Math.abs(num)
    return `vencida há ${overdue} ${overdue === 1 ? 'dia' : 'dias'}`
  }
  if (num === 0) return 'vence hoje'
  return `${num} ${num === 1 ? 'dia' : 'dias'}`
}

/**
 * Data de vencimento em dd/mm/aaaa (R-020: `parseLocalDate`, nunca `new Date('YYYY-MM-DD')`).
 * @param {string|null|undefined} dateStr
 * @returns {string}
 */
function _formatPrescriptionDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return '-'
  return parseLocalDate(String(dateStr)).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Gera rows de prescricao.
 * @param {Array<Object>} prescriptionStatus - Status das prescricoes.
 * @param {Array<Object>} protocols - Protocolos.
 * @param {Array<Object>} medicines - Medicamentos.
 * @returns {Array<Object>} Rows das prescricoes.
 */
function buildPrescriptionRows(prescriptionStatus = [], protocols = [], medicines = []) {
  return prescriptionStatus.map((prescription) => {
    const protocol = protocols.find((item) => item.id === prescription.protocolId)
    const medicine =
      medicines.find((item) => item.id === protocol?.medicine_id) || protocol?.medicine || {}

    return {
      id: prescription.protocolId,
      label: formatTreatmentLabel(protocol, medicine),
      status: prescription.status,
      statusLabel:
        prescription.status === 'vencida'
          ? 'Vencida'
          : prescription.status === 'vencendo'
            ? 'Vencendo'
            : 'Vigente',
      daysRemaining: prescription.daysRemaining,
      // 073/F-21: "-3" não é informação — a linha dizia "Vencida | -3 | 2026-08-18".
      daysLabel: _formatPrescriptionDays(prescription.daysRemaining),
      endDate: prescription.endDate || protocol?.end_date || null,
      endDateLabel: _formatPrescriptionDate(prescription.endDate || protocol?.end_date),
    }
  })
}

/**
 * Gera rows de titulacao.
 * @param {Array<Object>} activeTitrations - Titulacoes ativas.
 * @param {Array<Object>} protocols - Protocolos.
 * @param {Array<Object>} medicines - Medicamentos.
 * @returns {Array<Object>} Rows da titulacao.
 */
function buildTitrationRows(activeTitrations = [], protocols = [], medicines = []) {
  return activeTitrations.map((titration) => {
    const protocol = protocols.find((item) => item.id === titration.protocolId)
    const medicine =
      medicines.find((item) => item.id === titration.medicineId) || protocol?.medicine || {}

    return {
      id: titration.protocolId,
      label: formatTreatmentLabel(protocol, medicine),
      currentStep: titration.currentStep,
      totalSteps: titration.totalSteps,
      currentDosage: titration.currentDosage,
      progressPercent: titration.progressPercent,
      daysRemaining: titration.daysRemaining,
      isTransitionDue: titration.isTransitionDue,
      isMaintenance: Boolean(titration.isMaintenance),
      // 073/F-24: manutenção não tem progresso a exibir — tem um FATO a declarar.
      progressLabel: titration.isMaintenance
        ? 'dose alvo'
        : `${titration.progressPercent ?? 0}%`,
      stageLabel: `${titration.currentStep}/${titration.totalSteps}`,
      stageNote: titration.isMaintenance
        ? [
            titration.currentDoseLabel ? `Dose alvo: ${titration.currentDoseLabel}` : 'Dose alvo',
            titration.maintenanceSince ? `desde ${titration.maintenanceSince}` : null,
          ]
            .filter(Boolean)
            .join(' ')
        : safeText(titration.stageNote, titration.currentDoseLabel || 'Sem observações'),
    }
  })
}

/**
 * Mapeia um score de adesão para um status legivel.
 * @param {number|null} score - Percentual de adesão (0-100) ou null
 * @param {number} expected - Doses esperadas
 * @returns {string}
 */
function _adherenceRowStatus(score, expected) {
  if (expected === 0) return 'Sem doses'
  if (score >= 90) return 'Excelente'
  if (score >= 70) return 'Atenção'
  return 'Critico'
}

/**
 * Gera uma trilha sintetica de adesao dos ultimos dias.
 * @param {Array<Object>} dailyAdherence - Série diária já consolidada pelo dashboard.
 * @param {Array<Object>} logs - Logs de dose.
 * @param {Array<Object>} protocols - Protocolos.
 * @param {number} days - Numero de dias a incluir.
 * @returns {Array<Object>} Rows com a adesao diaria.
 */
function buildAdherenceTrend(dailyAdherence = [], logs = [], protocols = [], days = 7) {
  if (Array.isArray(dailyAdherence) && dailyAdherence.length > 0) {
    return dailyAdherence.slice(-days).map((row) => {
      const taken = Number(row.taken ?? 0)
      const expected = Number(row.expected ?? 0)
      const score = expected > 0 ? Math.round((taken / expected) * 100) : null

      return {
        date: row.date,
        label: row.date
          ? parseLocalDate(row.date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })
          : row.label || '',
        taken,
        expected,
        score,
        status: _adherenceRowStatus(score, expected),
      }
    })
  }

  // 073/E-3 (decisão D25 do PO): a vigência é avaliada POR DIA, dentro do loop — filtrar por
  // "vigente HOJE" e aplicar isso aos N dias fazia o tratamento encerrado no meio da janela
  // sumir do PRÓPRIO PASSADO (R-299: fato datado não se lê pelo estado de hoje).
  // Não é a composição vetada pelo ADR-094: a vigência responde "este tratamento valia neste
  // dia" e `calculateDosesByDate` responde "havia dose neste dia" — papéis distintos.
  const trend = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(getNow(), -offset)
    const dateStr = formatLocalDate(date)
    // vigency-gate: ok — vigência por DIA (ADR-094); a cadência quem aplica é o gerador.
    const protocolsOfDay = protocols.filter((protocol) => isProtocolVigentOn(protocol, dateStr))
    const result = calculateDosesByDate(dateStr, logs, protocolsOfDay)
    const taken = result.takenDoses.length
    const missed = result.missedDoses.length
    const expected = taken + missed
    const score = expected > 0 ? Math.round((taken / expected) * 100) : null

    trend.push({
      date: dateStr,
      label: parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }),
      taken,
      expected,
      score,
      status: _adherenceRowStatus(score, expected),
    })
  }

  return trend
}

/**
 * Monta os dados normalizados para renderizacao do PDF.
 * @param {Object} params - Parametros agregados.
 * @param {Object} params.consultationData - Dados consolidados do modo consulta.
 * @param {Object} params.dashboardData - Dados brutos do dashboard.
 * @param {string} [params.period='30d'] - Periodo de cobertura.
 * @param {Date|string} [params.generatedAt=getNow()] - Momento de geracao.
 * @param {string} [params.title] - Titulo do documento.
 * @returns {Object} Modelo editorial pronto para o service de PDF.
 */
/**
 * Prepara o resumo de adesão para o PDF.
 * @param {Object} consultationData - Dados de consulta
 * @param {Array} adherenceTrend - Tendência de adesão
 * @param {number} periodDays - Dias do período
 * @returns {Object} { adherence30d, adherence90d, selectedPeriodLabel, selectedPeriodSummary, currentStreak }
 */
function _prepareAdherenceSummary(consultationData, adherenceTrend, periodDays) {
  const adherence30d = consultationData?.adherenceSummary?.last30d || {
    score: 0, taken: 0, expected: 0, punctuality: 0,
  }
  const adherence90d = consultationData?.adherenceSummary?.last90d || {
    score: 0, taken: 0, expected: 0, punctuality: 0,
  }
  const selectedPeriodLabel = getTrendLabel(periodDays)
  const currentStreak = consultationData?.adherenceSummary?.currentStreak ?? adherence30d.currentStreak ?? 0

  let selectedPeriodSummary
  if (periodDays === 30) selectedPeriodSummary = adherence30d
  else if (periodDays === 90) selectedPeriodSummary = adherence90d
  else selectedPeriodSummary = summarizeTrend(adherenceTrend, currentStreak)

  return { adherence30d, adherence90d, selectedPeriodLabel, selectedPeriodSummary, currentStreak }
}

/** Extrai e normaliza dados do dashboard e consultationData. */
function _extractInputs(consultationData, dashboardData) {
  return {
    medicines: dashboardData.medicines || [],
    protocols: dashboardData.protocols || [],
    logs: dashboardData.logs || [],
    dailyAdherence: dashboardData.dailyAdherence || [],
    stockSummary: dashboardData.stockSummary || [],
    // 044/US3: só `false` explícito desliga a seção (ausente → controlado, FR-009).
    stockTrackingEnabled: dashboardData.stockTrackingEnabled !== false,
    patientInfo: consultationData?.patientInfo || {},
    activeMedicines: consultationData?.activeMedicines || [],
    prescriptionStatus: consultationData?.prescriptionStatus || [],
    activeTitrations: consultationData?.activeTitrations || [],
  }
}

/** Calcula número de dias do período selecionado. */
function _calculatePeriodDays(period, dailyAdherenceLength) {
  if (period === 'all') return Math.max(dailyAdherenceLength || 0, 90)
  return Math.max(parseInt(period, 10) || 7, 1)
}

/**
 * Normaliza a data de geração do relatório para um Date LOCAL (R-020).
 * `YYYY-MM-DD` puro vai por `parseLocalDate` — `new Date('YYYY-MM-DD')` seria UTC
 * midnight e viraria o dia anterior em GMT-3.
 * @param {Date|string|number|null|undefined} value
 * @returns {Date}
 */
function _toLocalDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? getNow() : value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseLocalDate(value)
  if (value == null) return getNow()
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? getNow() : parsed
}

export function buildConsultationPdfData({
  consultationData,
  dashboardData = {},
  period = '30d',
  generatedAt = getNow(),
  title = 'Dosiq - Consulta Médica',
  patientEmail = '',
}: any = {}) {
  const inp = _extractInputs(consultationData, dashboardData)
  const periodDays = _calculatePeriodDays(period, inp.dailyAdherence.length)

  // 064/US2: o relatório termina na data de geração — é ela que define a vigência (R-299).
  const asOf = formatLocalDate(_toLocalDate(generatedAt))
  const activeTreatments = buildTreatmentRows(inp.protocols, inp.medicines, asOf)
  // 044/US3 (dose-only): NENHUMA row de estoque — nem tabela vazia, nem "0 dias" fantasma.
  // Some também dos summary cards e dos itens de atenção (que derivam de stockRows).
  const stockRows = inp.stockTrackingEnabled
    ? buildStockRows(inp.stockSummary, inp.protocols, inp.medicines, asOf)
    : []
  const prescriptionRows = buildPrescriptionRows(inp.prescriptionStatus, inp.protocols, inp.medicines)
  const titrationRows = buildTitrationRows(inp.activeTitrations, inp.protocols, inp.medicines)
  const adherenceTrend = buildAdherenceTrend(inp.dailyAdherence, inp.logs, inp.protocols, periodDays)
  const { adherence30d, adherence90d, selectedPeriodLabel, selectedPeriodSummary, currentStreak } =
    _prepareAdherenceSummary(consultationData, adherenceTrend, periodDays)

  const adherenceData = { selectedPeriodSummary, adherence30d, adherence90d, selectedPeriodLabel }
  const summaryCards = buildSummaryCards(
    adherenceData, activeTreatments, inp.activeMedicines, stockRows, prescriptionRows, titrationRows
  )
  const attentionItems = buildAttentionItems(stockRows, prescriptionRows, titrationRows)
  const patient = buildPatientSection(inp.patientInfo, patientEmail, formatPatientDisplayName, extractEmailHandle)
  const clinicalNotes = buildClinicalNotes(inp.patientInfo)
  const generatedAtDate = generatedAt instanceof Date ? generatedAt : parseISO(generatedAt)
  const generatedAtLabel = generatedAtDate.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

  return {
    title, period, generatedAt, generatedAtLabel, patient, summaryCards, activeTreatments,
    adherence: {
      selectedPeriod: { ...selectedPeriodSummary, label: selectedPeriodLabel },
      last30d: adherence30d, last90d: adherence90d,
      trend: adherenceTrend, trendLabel: selectedPeriodLabel, currentStreak,
    },
    stockRows, prescriptionRows, titrationRows, attentionItems, clinicalNotes,
    stockTrackingEnabled: inp.stockTrackingEnabled,
  }
}

export default {
  buildConsultationPdfData,
  formatTreatmentLabel,
}
