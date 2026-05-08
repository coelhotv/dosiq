/**
 * ConsultationRedesignSections — Seções da ConsultationViewRedesign.
 */
import { motion } from 'framer-motion'
import {
  Pill,
  Package,
  ClipboardList,
  Target,
  AlertTriangle,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Bell,
} from 'lucide-react'

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

/**
 * Tabela de medicamentos ativos (redesign).
 */
export function RedesignMedicinesSection({ activeMedicines }) {
  return (
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
  )
}

/**
 * Alertas de estoque (redesign).
 */
export function RedesignStockSection({ stockAlerts }) {
  return (
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
  )
}

/**
 * Prescrições (redesign).
 */
export function RedesignPrescriptionsSection({ prescriptionStatus }) {
  return (
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
  )
}

/**
 * Titulações (redesign).
 */
export function RedesignTitrationsSection({ activeTitrations }) {
  return (
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
  )
}
