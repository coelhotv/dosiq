/**
 * _pdfSectionBuilders.js — Construtores de seções do PDF de consulta médica.
 *
 * Módulo privado extraído de consultationPdfDataBuilder.js para manter
 * buildConsultationPdfData abaixo de 100 linhas e complexidade ≤ 15.
 * @module _pdfSectionBuilders
 */

/**
 * Determina o nível de tom (success|warning|danger) por score.
 * @param {number} score
 * @returns {string}
 */
function scoreTone(score) {
  if ((score ?? 0) >= 80) return 'success'
  if ((score ?? 0) >= 50) return 'warning'
  return 'danger'
}

/**
 * Monta os cards de resumo para o cabeçalho do PDF.
 * @param {Object} adherenceData - { selectedPeriodSummary, adherence30d, adherence90d, selectedPeriodLabel }
 * @param {Array} activeTreatments - Rows de tratamentos ativos
 * @param {Array} activeMedicines - Medicamentos ativos
 * @param {Array} stockRows - Rows de estoque
 * @param {Array} prescriptionRows - Rows de prescrição
 * @param {Array} titrationRows - Rows de titulação
 * @returns {Array} summaryCards
 */
export function buildSummaryCards(
  { selectedPeriodSummary, adherence30d, adherence90d, selectedPeriodLabel },
  activeTreatments,
  activeMedicines,
  stockRows,
  prescriptionRows,
  titrationRows
) {
  const criticalStockCount = stockRows.filter((item) => item.severity === 'critical').length
  const warningStockCount = stockRows.filter((item) => item.severity === 'warning').length
  const expiringPrescriptionCount = prescriptionRows.filter((item) => item.status === 'vencendo').length
  const expiredPrescriptionCount = prescriptionRows.filter((item) => item.status === 'vencida').length
  const activeTitrationCount = titrationRows.length

  const cards = [
    {
      label: `Adesão ${selectedPeriodLabel}`,
      value: `${selectedPeriodSummary.score ?? 0}%`,
      meta: `${selectedPeriodSummary.taken ?? 0}/${selectedPeriodSummary.expected ?? 0} doses`,
      tone: scoreTone(selectedPeriodSummary.score),
    },
  ]

  // 073/F-22: a página 1 gastava 4 das 7 caixas repetindo a MESMA métrica — quando o período
  // selecionado É 30d, "Adesão 30 dias" e "Adesão 30d" são a mesma coisa impressa duas vezes.
  // Card de adesão só entra se o número for DISTINTO do que já está na página.
  const shownScores = new Set([selectedPeriodSummary.score ?? 0])
  const addAdherenceCard = (label, summary) => {
    const score = summary.score ?? 0
    if (shownScores.has(score)) return
    shownScores.add(score)
    cards.push({
      label,
      value: `${score}%`,
      meta: `${summary.taken ?? 0}/${summary.expected ?? 0} doses`,
      tone: scoreTone(score),
    })
  }
  if (selectedPeriodLabel !== '30 dias') addAdherenceCard('Adesão 30d', adherence30d)
  if (selectedPeriodLabel !== '90 dias') addAdherenceCard('Adesão 90d', adherence90d)

  // Pontualidade só aparece quando diz algo diferente da adesão (hoje as duas derivam do mesmo
  // número quando não há janela medida — duas caixas para o mesmo dado).
  const punctuality = selectedPeriodSummary.punctuality ?? 0
  if (punctuality !== (selectedPeriodSummary.score ?? 0)) {
    cards.push({
      label: 'Pontualidade',
      value: `${punctuality}%`,
      meta: `Janela de tolerância | ${selectedPeriodLabel}`,
      tone: scoreTone(punctuality),
    })
  }

  const treatmentCount = activeTreatments.length
  const medicineCount = activeMedicines.length
  cards.push(
    {
      label: 'Tratamentos vigentes',
      value: String(treatmentCount),
      meta: `${medicineCount} ${medicineCount === 1 ? 'medicamento' : 'medicamentos'}`,
      tone: 'info',
    },
    {
      label: 'Alertas críticos',
      value: String(criticalStockCount + expiredPrescriptionCount),
      meta: `${warningStockCount + expiringPrescriptionCount} em atenção`,
      tone: criticalStockCount + expiredPrescriptionCount > 0 ? 'danger' : 'success',
    },
    {
      label: 'Titulações',
      value: String(activeTitrationCount),
      meta: `${titrationRows.filter((item) => item.isTransitionDue).length} pendentes`,
      tone: activeTitrationCount > 0 ? 'warning' : 'success',
    }
  )

  return cards
}

/**
 * Monta os itens de atenção clínica (estoque, prescrições, titulações).
 * @param {Array} stockRows - Rows de estoque
 * @param {Array} prescriptionRows - Rows de prescrição
 * @param {Array} titrationRows - Rows de titulação
 * @returns {Array} attentionItems
 */
/**
 * Detalhe de escassez de estoque (012 B4 / ADR-067): freq ≠ diário mostra doses
 * físicas (número-base) com runway entre parênteses; diário mantém "N dias".
 */
function _stockShortageDetail(item) {
  if (item.isDailyStock === false && Number.isFinite(item.dosesRemaining)) {
    const d = item.dosesRemaining
    const dias = item.daysRemaining ?? '-'
    return `Estoque baixo: ${d} ${d === 1 ? 'dose' : 'doses'} (~${dias} dias)`
  }
  return `Estoque baixo: ${item.daysRemaining ?? '-'} dias`
}

export function buildAttentionItems(stockRows, prescriptionRows, titrationRows) {
  return [
    ...stockRows
      .filter((item) => item.severity !== 'stable')
      .slice(0, 4)
      .map((item) => ({
        label: item.label,
        detail:
          item.severity === 'critical'
            ? 'Estoque esgotado'
            : _stockShortageDetail(item),
        tone: item.severity,
      })),
    ...prescriptionRows
      .filter((item) => item.status !== 'vigente')
      .slice(0, 4)
      .map((item) => ({
        label: item.label,
        detail:
          item.status === 'vencida'
            ? 'Prescricao vencida'
            : `${item.daysRemaining ?? '-'} dias para vencer`,
        tone: item.status === 'vencida' ? 'danger' : 'warning',
      })),
    ...titrationRows.slice(0, 3).map((item) => ({
      label: item.label,
      detail: item.isTransitionDue
        ? 'Transicao pendente'
        : `Etapa ${item.currentStep}/${item.totalSteps}`,
      tone: item.isTransitionDue ? 'warning' : 'info',
    })),
  ]
}

/**
 * Monta a seção de informações do paciente.
 * @param {Object} patientInfo - Dados de perfil do paciente
 * @param {string} patientEmail - Email do paciente
 * @param {Function} formatPatientDisplayName - Formatter de nome
 * @param {Function} extractEmailHandle - Extractor de handle
 * @returns {Object} patient section
 */
export function buildPatientSection(patientInfo, patientEmail, formatPatientDisplayName, extractEmailHandle) {
  return {
    name: formatPatientDisplayName(patientInfo.name, patientEmail),
    age: patientInfo.age ?? null,
    handle: extractEmailHandle(patientEmail) || null,
    emergencyCard: patientInfo.emergencyCard || null,
  }
}

/**
 * Monta as notas clínicas para o rodapé do PDF.
 * @param {Object} patientInfo - Dados do paciente (emergencyCard)
 * @returns {Array<string>} Notas clínicas
 */
export function buildClinicalNotes(patientInfo) {
  return [
    patientInfo.emergencyCard?.allergies?.length
      ? `Alergias registradas: ${patientInfo.emergencyCard.allergies.join(', ')}`
      : 'Sem alergias registradas no cartão de emergência',
    patientInfo.emergencyCard?.blood_type
      ? `Tipo sanguíneo: ${patientInfo.emergencyCard.blood_type}`
      : 'Tipo sanguíneo não informado',
  ]
}
