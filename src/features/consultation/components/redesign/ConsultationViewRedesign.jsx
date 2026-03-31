import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Pill,
  BarChart3,
  Package,
  ClipboardList,
  Target,
  AlertTriangle,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Bell,
  FileText,
  Share2,
} from 'lucide-react'
import './ConsultationViewRedesign.css'

export default function ConsultationViewRedesign({ data, onGeneratePDF, onShare, onBack }) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

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

  const formattedGeneratedAt = useMemo(() => {
    if (!generatedAt) return ''
    return new Date(generatedAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [generatedAt])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--color-success, #10b981)'
    if (score >= 60) return 'var(--color-warning, #f59e0b)'
    if (score >= 40) return 'color-mix(in srgb, var(--color-warning, #f59e0b), var(--color-error, #ef4444))'
    return 'var(--color-error, #ef4444)'
  }

  return (
    <motion.div
      className="sr-consultation"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header className="sr-consultation__header" variants={itemVariants}>
        <div className="sr-consultation__header-content">
          <div>
            <h1 className="sr-consultation__patient-name">{patientInfo?.name || 'Paciente'}</h1>
            {patientInfo?.age && (
              <span className="sr-consultation__patient-age">{patientInfo.age} anos</span>
            )}
          </div>
          <div className="sr-consultation__gen-info">
            <span className="sr-consultation__gen-label">Gerado em:</span>
            <span className="sr-consultation__gen-time">{formattedGeneratedAt}</span>
          </div>
        </div>
        {onBack && (
          <button className="sr-consultation__back-btn" onClick={onBack} type="button">
            <ArrowLeft size={18} /> Voltar
          </button>
        )}
      </motion.header>

      <main className="sr-consultation__content">
        {/* Medicamentos Ativos */}
        <motion.section
          className="sr-consultation__section sr-consultation__section--full"
          variants={itemVariants}
        >
          <h2 className="sr-consultation__section-title">
            <Pill size={20} /> Medicamentos Ativos
          </h2>
          {activeMedicines?.length > 0 ? (
            <div className="sr-consultation__table-wrap">
              <table className="sr-consultation__table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Dosagem</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMedicines.map((med) => (
                    <tr key={med.id}>
                      <td className="sr-consultation__med-name">{med.name}</td>
                      <td>
                        {med.dosagePerIntake && med.timesPerDay ? (
                          <span>
                            {med.dosagePerIntake}
                            {med.dosageUnit}
                            <span className="sr-consultation__dosage-detail">
                              {' '}
                              ({med.timesPerDay}x ao dia
                              {med.dailyDosage ? `, ${med.dailyDosage}${med.dosageUnit}/dia` : ''})
                            </span>
                          </span>
                        ) : med.dosagePerPill ? (
                          <span>
                            {med.dosagePerPill}
                            {med.dosageUnit}
                          </span>
                        ) : (
                          <span className="sr-consultation__dosage-unknown">Não informado</span>
                        )}
                      </td>
                      <td>{med.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sr-consultation__empty">Nenhum medicamento ativo</p>
          )}
        </motion.section>

        {/* Aderência */}
        <motion.section className="sr-consultation__section" variants={itemVariants}>
          <h2 className="sr-consultation__section-title">
            <BarChart3 size={20} /> Aderência ao Tratamento
          </h2>
          <div className="sr-consultation__adherence-grid">
            {['last30d', 'last90d'].map((key) => {
              const d = adherenceSummary?.[key]
              const score = d?.score || 0
              return (
                <div key={key} className="sr-adherence-card">
                  <div className="sr-adherence-card__header">
                    <span className="sr-adherence-card__period">
                      Últimos {key === 'last30d' ? '30 dias' : '90 dias'}
                    </span>
                    <span
                      className="sr-adherence-card__score"
                      style={{ color: getScoreColor(score) }}
                    >
                      {score}%
                    </span>
                  </div>
                  <div className="sr-adherence-card__bar">
                    <motion.div
                      className="sr-adherence-card__bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ backgroundColor: getScoreColor(score) }}
                    />
                  </div>
                  <div className="sr-adherence-card__details">
                    <div>
                      <span className="sr-adherence-card__detail-value">
                        {d?.taken || 0}/{d?.expected || 0}
                      </span>
                      <span className="sr-adherence-card__detail-label"> doses tomadas</span>
                    </div>
                    {(d?.punctuality || 0) > 0 && (
                      <div>
                        <span className="sr-adherence-card__detail-value">{d.punctuality}%</span>
                        <span className="sr-adherence-card__detail-label"> pontualidade</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>

        {/* Alertas de Estoque */}
        <motion.section className="sr-consultation__section" variants={itemVariants}>
          <h2 className="sr-consultation__section-title">
            <Package size={20} /> Alertas de Estoque
          </h2>
          {stockAlerts?.length > 0 ? (
            <div className="sr-consultation__alerts">
              {stockAlerts.map((alert) => (
                <div
                  key={alert.medicineId}
                  className={`sr-stock-alert sr-stock-alert--${alert.severity}`}
                >
                  <span className="sr-stock-alert__icon">
                    {alert.severity === 'critical' ? (
                      <AlertTriangle size={20} />
                    ) : (
                      <AlertCircle size={20} />
                    )}
                  </span>
                  <div>
                    <strong className="sr-stock-alert__name">{alert.medicineName}</strong>
                    <span className="sr-stock-alert__message"> — {alert.message}</span>
                    {alert.daysRemaining > 0 && (
                      <div className="sr-stock-alert__days">
                        ~{alert.daysRemaining} dias restantes
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="sr-consultation__empty">Estoque em dia</p>
          )}
        </motion.section>

        {/* Status de Prescrições */}
        <motion.section className="sr-consultation__section" variants={itemVariants}>
          <h2 className="sr-consultation__section-title">
            <ClipboardList size={20} /> Status das Prescrições
          </h2>
          {prescriptionStatus?.length > 0 ? (
            <div className="sr-consultation__prescriptions">
              {prescriptionStatus.map((rx) => {
                const BadgeIcon =
                  rx.status === 'vencida'
                    ? XCircle
                    : rx.status === 'vencendo'
                      ? AlertTriangle
                      : CheckCircle2
                return (
                  <div key={rx.protocolId} className="sr-prescription">
                    <span className={`sr-prescription__badge sr-prescription__badge--${rx.status}`}>
                      <BadgeIcon size={14} />
                      {rx.status === 'vigente'
                        ? 'Vigente'
                        : rx.status === 'vencendo'
                          ? 'Vencendo'
                          : 'Vencida'}
                    </span>
                    <span className="sr-prescription__name">{rx.medicineName}</span>
                    {rx.daysRemaining !== undefined && (
                      <span className="sr-prescription__days">
                        {rx.daysRemaining > 0 ? `${rx.daysRemaining} dias` : 'Hoje'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="sr-consultation__empty">Todas as prescrições em dia</p>
          )}
        </motion.section>

        {/* Titulação */}
        <motion.section
          className="sr-consultation__section sr-consultation__section--full"
          variants={itemVariants}
        >
          <h2 className="sr-consultation__section-title">
            <Target size={20} /> Progresso de Titulação
          </h2>
          {activeTitrations?.length > 0 ? (
            <div className="sr-consultation__titrations">
              {activeTitrations.map((t) => (
                <div key={t.protocolId} className="sr-titration-card">
                  <div className="sr-titration-card__header">
                    <strong className="sr-titration-card__name">{t.medicineName}</strong>
                    <span className="sr-titration-card__dosage">{t.currentDosage}mg</span>
                  </div>
                  <div className="sr-titration-card__progress-bar">
                    <motion.div
                      className="sr-titration-card__progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${t.progressPercent}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="sr-titration-card__progress-text">
                    {t.progressPercent}% — Etapa {t.currentStep}/{t.totalSteps}
                  </span>
                  {t.stageNote && <p className="sr-titration-card__note">{t.stageNote}</p>}
                  {t.isTransitionDue && (
                    <span className="sr-titration-card__transition">
                      <Bell size={14} /> Transição pendente
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="sr-consultation__empty">Nenhuma titulação ativa</p>
          )}
        </motion.section>
      </main>

      {/* Ações */}
      <motion.section
        className="sr-consultation__section sr-consultation__section--actions"
        variants={itemVariants}
      >
        <div className="sr-consultation__actions">
          <button
            className="sr-consultation__action-btn sr-consultation__action-btn--secondary"
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF}
            type="button"
          >
            <FileText size={18} />
            {isGeneratingPDF ? 'Gerando...' : 'Gerar PDF'}
          </button>
          <button
            className="sr-consultation__action-btn sr-consultation__action-btn--primary"
            onClick={handleShare}
            disabled={isSharing}
            type="button"
          >
            <Share2 size={18} />
            {isSharing ? 'Enviando...' : 'Compartilhar'}
          </button>
        </div>
      </motion.section>
    </motion.div>
  )
}
