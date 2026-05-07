import React from 'react'
import { motion } from 'framer-motion'
import { parseISO } from '@utils/dateUtils'
import PlanBadge from '@dashboard/components/PlanBadge'

export default function DoseCard({ dose, onRegisterDose, selectedDoses, onToggleSelection, done = false }) {
  const isSelected = selectedDoses?.has(`${dose.protocolId}:${dose.scheduledTime}`) ?? false

  const displayTime =
    done && dose.registeredAt
      ? parseISO(dose.registeredAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        })
      : dose.scheduledTime

  return (
    <motion.div
      className={`dose-card${done ? ' dose-card--done' : ''}${isSelected ? ' dose-card--selected' : ''}`}
      data-testid={`dose-card-${dose.protocolId}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        className={`dose-card__select-area ${!done && onToggleSelection ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => onToggleSelection?.(dose.protocolId, dose.scheduledTime)}
        disabled={done || !onToggleSelection}
      >
        <div className="dose-card__time">{displayTime}</div>
        <div className="dose-card__info">
          <span className="dose-card__name">{dose.medicineName}</span>
          {dose.planBadge && (
            <PlanBadge
              emoji={dose.planBadge.emoji}
              color={dose.planBadge.color}
              planName={dose.treatmentPlanName}
            />
          )}
          <span className="dose-card__dosage">{dose.dosagePerIntake} cp</span>
        </div>
      </button>
      {done ? (
        <span className="dose-card__done-icon" aria-label="Registrada">✓</span>
      ) : (
        <button
          className="dose-card__register-btn"
          onClick={() => onRegisterDose(dose.protocolId, dose.dosagePerIntake)}
          aria-label={`Registrar ${dose.medicineName}`}
          type="button"
        >
          ✓
        </button>
      )}
    </motion.div>
  )
}
