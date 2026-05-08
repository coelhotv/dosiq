/**
 * ConsultationSections — Seções reutilizáveis da ConsultationView.
 */
import { motion } from 'framer-motion'

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

/**
 * Tabela de medicamentos ativos.
 */
export function ConsultationMedicinesSection({ activeMedicines }) {
  return (
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
  )
}

/**
 * Alertas de estoque.
 */
export function ConsultationStockSection({ stockAlerts }) {
  return (
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
  )
}

const PRESCRIPTION_STATUS_LABELS = {
  vigente: 'Vigente',
  vencendo: 'Vencendo',
  vencida: 'Vencida',
}

/**
 * Status de prescrições.
 */
export function ConsultationPrescriptionsSection({ prescriptionStatus }) {
  return (
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
                {PRESCRIPTION_STATUS_LABELS[prescription.status] || prescription.status}
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
  )
}

/**
 * Progresso de titulação.
 */
export function ConsultationTitrationsSection({ activeTitrations }) {
  return (
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
  )
}
