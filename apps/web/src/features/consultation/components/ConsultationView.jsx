import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { parseISO } from '@utils/dateUtils'
import './ConsultationView.css'

/**
 * @typedef {Object} ConsultationViewProps
 * @property {Object} data - Dados da consulta retornados por consultationDataService
 * @property {function} onGeneratePDF - Callback para gerar PDF
 * @property {function} onShare - Callback para compartilhar
 * @property {function} onBack - Callback para voltar
 */

/**
 * ConsultationView - Interface visual do Modo Consulta Médica
 *
 * Tela read-only otimizada para mostrar dados clínicos ao médico.
 * Fontes grandes, alto contraste, layout landscape-friendly.
 *
 * @param {ConsultationViewProps} props
 * @returns {JSX.Element}
 */
export default function ConsultationView({ data, onGeneratePDF, onShare, onBack }) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  // Memoiza dados para evitar re-renderizações
  const {
    patientInfo,
    activeMedicines,
    adherenceSummary,
    stockAlerts,
    prescriptionStatus,
    activeTitrations,
    generatedAt,
  } = useMemo(() => data || {}, [data])

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true)
    try {
      await onGeneratePDF?.()
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      await onShare?.()
    } finally {
      setIsSharing(false)
    }
  }

  // Formata data de geração
  const formattedGeneratedAt = useMemo(() => {
    if (!generatedAt) return ''
    return parseISO(generatedAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [generatedAt])

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      className="consultation-view"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header do Paciente */}
      <motion.header className="consultation-header" variants={itemVariants}>
        <div className="header-content">
          <div className="patient-info">
            <h1 className="patient-name">{patientInfo?.name || 'Paciente'}</h1>
            {patientInfo?.age && <span className="patient-age">{patientInfo.age} anos</span>}
          </div>
          <div className="generation-info">
            <span className="generation-label">Gerado em:</span>
            <span className="generation-time">{formattedGeneratedAt}</span>
          </div>
        </div>
        {onBack && (
          <button className="back-button" onClick={onBack} type="button">
            ← Voltar
          </button>
        )}
      </motion.header>

      <main className="consultation-content">
        {/* Tabela de Medicamentos Ativos */}
        <motion.section className="consultation-section" variants={itemVariants}>
          <h2 className="section-title">💊 Medicamentos Ativos</h2>
          {activeMedicines?.length > 0 ? (
            <div className="medicines-table-container">
              <table className="medicines-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Dosagem</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMedicines.map((medicine) => (
                    <tr key={medicine.id}>
                      <td className="medicine-name">{medicine.name}</td>
                      <td>
                        {medicine.dosagePerIntake && medicine.timesPerDay ? (
                          <span>
                            {medicine.dosagePerIntake}
                            {medicine.dosageUnit}
                            <span className="dosage-detail">
                              {' '}
                              ({medicine.timesPerDay}x ao dia
                              {medicine.dailyDosage
                                ? `, ${medicine.dailyDosage}${medicine.dosageUnit}/dia`
                                : ''}
                              )
                            </span>
                          </span>
                        ) : medicine.dosagePerPill ? (
                          <span>
                            {medicine.dosagePerPill}
                            {medicine.dosageUnit}
                          </span>
                        ) : (
                          <span className="dosage-unknown">Não informado</span>
                        )}
                      </td>
                      <td>{medicine.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">Nenhum medicamento ativo</p>
          )}
        </motion.section>

        {/* Resumo de Aderência */}
        <motion.section className="consultation-section" variants={itemVariants}>
          <h2 className="section-title">📊 Aderência ao Tratamento</h2>
          <div className="adherence-grid">
            <AdherenceCard period="30 dias" data={adherenceSummary?.last30d} />
            <AdherenceCard period="90 dias" data={adherenceSummary?.last90d} />
          </div>
        </motion.section>

        {/* Alertas de Estoque */}
        <motion.section className="consultation-section" variants={itemVariants}>
          <h2 className="section-title">📦 Alertas de Estoque</h2>
          {stockAlerts?.length > 0 ? (
            <div className="stock-alerts-list">
              {stockAlerts.map((alert) => (
                <div key={alert.medicineId} className={`stock-alert-item ${alert.severity}`}>
                  <span className="alert-icon">{alert.severity === 'critical' ? '⚠️' : '⚡'}</span>
                  <div className="alert-content">
                    <strong>{alert.medicineName}</strong>
                    <span className="alert-message">{alert.message}</span>
                    {alert.daysRemaining > 0 && (
                      <span className="alert-days">~{alert.daysRemaining} dias restantes</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">✅ Estoque em dia</p>
          )}
        </motion.section>

        {/* Status de Prescrições */}
        <motion.section className="consultation-section" variants={itemVariants}>
          <h2 className="section-title">📝 Status das Prescrições</h2>
          {prescriptionStatus?.length > 0 ? (
            <div className="prescriptions-list">
              {prescriptionStatus.map((prescription) => (
                <div
                  key={prescription.protocolId}
                  className={`prescription-item ${prescription.status}`}
                >
                  <span className={`status-badge ${prescription.status}`}>
                    {prescription.status === 'vencida' && '❌'}
                    {prescription.status === 'vencendo' && '⚠️'}
                    {prescription.status === 'vigente' && '✅'}{' '}
                    {getPrescriptionStatusLabel(prescription.status)}
                  </span>
                  <span className="prescription-medicine">{prescription.medicineName}</span>
                  {prescription.daysRemaining !== undefined && (
                    <span className="days-remaining">
                      {prescription.daysRemaining > 0
                        ? `${prescription.daysRemaining} dias`
                        : 'Hoje'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Todas as prescrições em dia</p>
          )}
        </motion.section>

        {/* Progresso de Titulação */}
        <motion.section className="consultation-section" variants={itemVariants}>
          <h2 className="section-title">🎯 Progresso de Titulação</h2>
          {activeTitrations?.length > 0 ? (
            <div className="titrations-list">
              {activeTitrations.map((titration) => (
                <div key={titration.protocolId} className="titration-card">
                  <div className="titration-header">
                    <strong>{titration.medicineName}</strong>
                    <span className="titration-dosage">
                      {titration.currentDosage}
                      mg
                    </span>
                  </div>
                  <div className="titration-progress">
                    <div className="progress-bar-container">
                      <motion.div
                        className="progress-bar"
                        initial={{ width: 0 }}
                        animate={{ width: `${titration.progressPercent}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="progress-text">
                      {titration.progressPercent}% — Etapa {titration.currentStep}/
                      {titration.totalSteps}
                    </span>
                  </div>
                  {titration.stageNote && <p className="titration-note">{titration.stageNote}</p>}
                  {titration.isTransitionDue && (
                    <span className="transition-badge">🔔 Transição pendente</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Nenhuma titulação ativa</p>
          )}
        </motion.section>
      </main>

      {/* Barra Inferior Fixa */}
      <motion.footer
        className="consultation-footer"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
      >
        <button
          className="action-button secondary"
          onClick={handleGeneratePDF}
          disabled={isGeneratingPDF}
          type="button"
        >
          {isGeneratingPDF ? '⏳ Gerando...' : '📄 Gerar PDF'}
        </button>
        <button
          className="action-button primary"
          onClick={handleShare}
          disabled={isSharing}
          type="button"
        >
          {isSharing ? '⏳ Enviando...' : '↗️ Compartilhar'}
        </button>
      </motion.footer>
    </motion.div>
  )
}

/**
 * Componente interno: Card de Aderência
 */
function AdherenceCard({ period, data }) {
  const score = data?.score || 0
  const taken = data?.taken || 0
  const expected = data?.expected || 0
  const punctuality = data?.punctuality || 0

  // Determina cor baseada no score
  const getScoreColor = () => {
    if (score >= 80) return 'var(--color-success)' // verde
    if (score >= 60) return 'var(--color-warning)' // amarelo
    if (score >= 40) return 'var(--color-warning)' // laranja (usando warning-light ou warning)
    return 'var(--color-error)' // vermelho
  }

  return (
    <div className="adherence-card">
      <div className="adherence-header">
        <span className="adherence-period">Últimos {period}</span>
        <span className="adherence-score" style={{ color: getScoreColor() }}>
          {score}%
        </span>
      </div>

      <div className="adherence-bar-container">
        <motion.div
          className="adherence-bar"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ backgroundColor: getScoreColor() }}
        />
      </div>

      <div className="adherence-details">
        <div className="detail-item">
          <span className="detail-value">
            {taken}/{expected}
          </span>
          <span className="detail-label">doses tomadas</span>
        </div>
        {punctuality > 0 && (
          <div className="detail-item">
            <span className="detail-value">{punctuality}%</span>
            <span className="detail-label">pontualidade</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Retorna label traduzido para status de prescrição
 */
function getPrescriptionStatusLabel(status) {
  const labels = {
    vigente: 'Vigente',
    vencendo: 'Vencendo',
    vencida: 'Vencida',
  }
  return labels[status] || status
}
