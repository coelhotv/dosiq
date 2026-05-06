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

  return [
    {
      label: `Adesao ${selectedPeriodLabel}`,
      value: `${selectedPeriodSummary.score ?? 0}%`,
      meta: `${selectedPeriodSummary.taken ?? 0}/${selectedPeriodSummary.expected ?? 0} doses`,
      tone: scoreTone(selectedPeriodSummary.score),
    },
    {
      label: 'Adesao 30d',
      value: `${adherence30d.score ?? 0}%`,
      meta: `${adherence30d.taken ?? 0}/${adherence30d.expected ?? 0} doses`,
      tone: scoreTone(adherence30d.score),
    },
    {
      label: 'Adesao 90d',
      value: `${adherence90d.score ?? 0}%`,
      meta: `${adherence90d.taken ?? 0}/${adherence90d.expected ?? 0} doses`,
      tone: scoreTone(adherence90d.score),
    },
    {
      label: 'Pontualidade',
      value: `${selectedPeriodSummary.punctuality ?? 0}%`,
      meta: `Janela de tolerancia | ${selectedPeriodLabel}`,
      tone: scoreTone(selectedPeriodSummary.punctuality),
    },
    {
      label: 'Tratamentos ativos',
      value: String(activeTreatments.length),
      meta: `${activeMedicines.length} medicamentos`,
      tone: 'info',
    },
    {
      label: 'Alertas criticos',
      value: String(criticalStockCount + expiredPrescriptionCount),
      meta: `${warningStockCount + expiringPrescriptionCount} em atencao`,
      tone: criticalStockCount + expiredPrescriptionCount > 0 ? 'danger' : 'success',
    },
    {
      label: 'Titulações',
      value: String(activeTitrationCount),
      meta: `${titrationRows.filter((item) => item.isTransitionDue).length} pendentes`,
      tone: activeTitrationCount > 0 ? 'warning' : 'success',
    },
  ]
}

/**
 * Monta os itens de atenção clínica (estoque, prescrições, titulações).
 * @param {Array} stockRows - Rows de estoque
 * @param {Array} prescriptionRows - Rows de prescrição
 * @param {Array} titrationRows - Rows de titulação
 * @returns {Array} attentionItems
 */
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
            : `Estoque baixo: ${item.daysRemaining ?? '-'} dias`,
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
      : 'Sem alergias registradas no cartao de emergencia',
    patientInfo.emergencyCard?.blood_type
      ? `Tipo sanguineo: ${patientInfo.emergencyCard.blood_type}`
      : 'Tipo sanguineo nao informado',
  ]
}
