/**
 * ConsultationSections — Seções da ConsultationView.
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
import { formatConcentration, formatDose, formatNumberPtBR, roundForDisplay } from '@dosiq/core'

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

/**
 * Tabela de medicamentos ativos.
 */
export function ConsultationMedicinesSection({ activeMedicines }) {
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
                    {med.isLiquid && med.timesPerDay ? (
                      <span>
                        {formatConcentration(med.dosagePerPill, med.dosageUnit)}
                        <span className="sr-consultation__dosage-detail">
                          {' '}
                          ({med.cadenceLabel || `${med.timesPerDay}x`}
                          {med.dailyDosage
                            ? `, ${formatDose(roundForDisplay(med.dailyDosage), med.intakeUnit)}/dia`
                            : ''})
                        </span>
                      </span>
                    ) : med.dosagePerIntake && med.timesPerDay ? (
                      <span>
                        {formatConcentration(med.dosagePerIntake, med.dosageUnit)}
                        <span className="sr-consultation__dosage-detail">
                          {' '}
                          ({med.cadenceLabel || `${med.timesPerDay}x`}
                          {med.dailyDosage
                            ? `, ${formatConcentration(roundForDisplay(med.dailyDosage), med.dosageUnit)}/dia`
                            : ''})
                        </span>
                      </span>
                    ) : med.dosagePerPill ? (
                      <span>
                        {formatConcentration(med.dosagePerPill, med.dosageUnit)}
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
 * Alertas de estoque.
 */
export function ConsultationStockSection({ stockAlerts }) {
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
 * Prescrições.
 */
export function ConsultationPrescriptionsSection({ prescriptionStatus }) {
  return (
    <motion.section className="sr-consultation__section" variants={itemVariants}>
      <h2 className="sr-consultation__section-title">
        <ClipboardList size={20} /> Status das Prescrições
      </h2>
      {prescriptionStatus?.length > 0 ? (
        <div className="sr-consultation__prescriptions">
          {prescriptionStatus.map((rx) => {
            const statusConfig = {
              vigente: { label: 'Vigente', Icon: CheckCircle2 },
              vencendo: { label: 'Vencendo', Icon: AlertTriangle },
              vencida: { label: 'Vencida', Icon: XCircle },
            }
            const statusKey = rx.status?.toLowerCase()
            const currentStatus = statusConfig[statusKey] || {
              label: rx.status || 'Desconhecido',
              Icon: AlertCircle,
            }
            const BadgeIcon = currentStatus.Icon
            return (
              <div key={rx.protocolId} className="sr-prescription">
                <span className={`sr-prescription__badge sr-prescription__badge--${statusKey}`}>
                  <BadgeIcon size={14} />
                  {currentStatus.label}
                </span>
                <span className="sr-prescription__name">{rx.medicineName}</span>
                {rx.daysRemaining != null && (
                  <span className="sr-prescription__days">
                    {/* 073: `daysRemaining` é NEGATIVO na vencida. O ternário antigo lia
                        qualquer não-positivo como "Hoje" — uma receita vencida há 4 dias
                        aparecia como vencendo hoje, no documento que decide a renovação. */}
                    {rx.daysRemaining > 0
                      ? `${rx.daysRemaining} dias`
                      : rx.daysRemaining === 0
                        ? 'Vence hoje'
                        : `Há ${Math.abs(rx.daysRemaining)} ${Math.abs(rx.daysRemaining) === 1 ? 'dia' : 'dias'}`}
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
 * Titulações.
 */
export function ConsultationTitrationsSection({ activeTitrations }) {
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
                {/* 073: 'mg' era literal — 10 UI de Lantus saíam "10mg" e 4 comprimidos de
                    Selozok saíam "4mg". A dose com unidade vem do DEGRAU (currentDoseLabel,
                    resolvido pela concentração daquele degrau — R-299), não de um recálculo. */}
                <span className="sr-titration-card__dosage">
                  {t.currentDoseLabel || (t.currentDosage != null ? formatNumberPtBR(t.currentDosage) : '—')}
                </span>
              </div>
              <div className="sr-titration-card__progress-bar">
                <motion.div
                  className="sr-titration-card__progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${t.isMaintenance ? 100 : (t.progressPercent ?? 0)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <span className="sr-titration-card__progress-text">
                {/* Manutenção não tem progresso a exibir — tem um FATO a declarar (AP-338).
                    Sem isto a etapa concluída imprimia "% — Etapa 4/4", com o número faltando. */}
                {t.isMaintenance ? 'Dose alvo' : `${t.progressPercent ?? 0}%`} — Etapa{' '}
                {t.currentStep}/{t.totalSteps}
                {t.isMaintenance && t.maintenanceSince ? ` · desde ${t.maintenanceSince}` : ''}
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
