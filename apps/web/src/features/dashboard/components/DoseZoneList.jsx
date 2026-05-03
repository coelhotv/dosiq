import React, { useState, useMemo } from 'react'
import { parseISO } from '@utils/dateUtils'
import { motion, AnimatePresence } from 'framer-motion'
import TreatmentAccordion from '@dashboard/components/TreatmentAccordion'
import SwipeRegisterItem from '@dashboard/components/SwipeRegisterItem'
import PlanBadge from '@dashboard/components/PlanBadge'
import BatchRegisterButton from '@dashboard/components/BatchRegisterButton'
import './DoseZoneList.css'

// Configuração visual de cada zona
const ZONE_CONFIG = {
  late: { icon: '⚠️', label: 'ATRASADAS', color: 'late' },
  now: { icon: '▶', label: 'AGORA', color: 'now' },
  upcoming: { icon: '🕐', label: 'PRÓXIMAS', color: 'upcoming' },
  later: { icon: '📅', label: 'MAIS TARDE', color: 'later' },
  done: { icon: '✓', label: 'REGISTRADAS', color: 'done' },
}

const ZONE_ORDER = ['late', 'now', 'upcoming', 'later', 'done']

/**
 * Determina se uma zona deve iniciar expandida com base na complexidade.
 */
function getDefaultExpanded(zone, complexityMode = 'moderate') {
  if (zone === 'late') return true
  if (zone === 'now') return true
  if (zone === 'upcoming') return complexityMode !== 'complex'
  return false // later e done: sempre colapsadas
}

/**
 * DoseCard — Card de dose para modo hora (time mode).
 * Mostra horário, nome do medicamento, PlanBadge e botão de registro.
 */
function DoseCard({ dose, onRegisterDose, selectedDoses, onToggleSelection, done = false }) {
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
        className="dose-card__select-area"
        onClick={() => onToggleSelection?.(dose.protocolId, dose.scheduledTime)}
        disabled={done || !onToggleSelection}
        style={!done && onToggleSelection ? { cursor: 'pointer' } : { cursor: 'default' }}
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
        <span className="dose-card__done-icon" aria-label="Registrada">
          ✓
        </span>
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

/**
 * ZoneSection — Seção colapsável de uma zona temporal.
 */
function ZoneSection({ zoneKey, doses, expanded, onToggle, config, children }) {
  if (!doses || doses.length === 0) return null

  return (
    <div className="dose-zone-section" data-testid={`zone-${zoneKey}`}>
      <button
        type="button"
        className={`zone-header zone-header--${config.color}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="zone-header__icon" aria-hidden="true">
          {config.icon}
        </span>
        <span className="zone-header__label">{config.label}</span>
        <span className="zone-header__count">{doses.length}</span>
        <span
          className={`zone-header__chevron${expanded ? ' zone-header__chevron--expanded' : ''}`}
        >
          ▾
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key={`${zoneKey}-content`}
            className="zone-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <motion.div
              className="zone-content__items"
              variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
              initial="hidden"
              animate="visible"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Agrupa doses por treatmentPlanId.
 * Doses sem plano ficam em avulsos[].
 */
function groupDosesByPlan(doses) {
  const groupMap = {}
  const avulsos = []

  for (const dose of doses) {
    if (!dose.treatmentPlanId) {
      avulsos.push(dose)
    } else {
      if (!groupMap[dose.treatmentPlanId]) {
        groupMap[dose.treatmentPlanId] = {
          planId: dose.treatmentPlanId,
          planName: dose.treatmentPlanName,
          planBadge: dose.planBadge,
          doses: [],
        }
      }
      groupMap[dose.treatmentPlanId].doses.push(dose)
    }
  }

  return { planGroups: Object.values(groupMap), avulsos }
}

/**
 * Cria objeto protocol sintético para TreatmentAccordion a partir de um grupo de plano.
 */
function makeSyntheticProtocol(group, zoneKey) {
  return {
    name: group.planName || 'Tratamento',
    medicines_count: group.doses.length,
    next_dose: group.doses[0]?.scheduledTime || '--:--',
    next_dose_window_end: null,
    is_in_tolerance_window: zoneKey === 'now' || zoneKey === 'late',
  }
}

/**
 * DoseZoneList — Lista de zonas temporais com doses do dia.
 *
 * Renderiza zonas (ATRASADAS, AGORA, PRÓXIMAS, MAIS TARDE, REGISTRADAS) com suporte
 * a dois modos de visualização:
 * - "time": lista flat com PlanBadge para contexto clínico
 * - "plan": agrupado por TreatmentAccordion (Princípio 2 da visão UX)
 *
 * @param {Object} props
 * @param {Object} props.zones - Output de useDoseZones().zones
 * @param {Object} props.totals - Output de useDoseZones().totals
 * @param {'time'|'plan'} props.viewMode - Modo de visualização
 * @param {'simple'|'moderate'|'complex'} props.complexityMode - Complexidade do paciente
 * @param {Function} props.onRegisterDose - (protocolId, dosagePerIntake) => void
 * @param {Function} props.onBatchRegister - (doseItems[]) => void
 * @param {Function} props.onToggleSelection - (protocolId, scheduledTime) => void
 * @param {Set<string>} props.selectedDoses - IDs selecionados no formato "protocolId:scheduledTime"
 */
export default function DoseZoneList({
  zones,
  viewMode,
  complexityMode = 'moderate',
  onRegisterDose,
  onBatchRegister,
  onToggleSelection,
  selectedDoses = new Set(),
}) {
  // Inicializar zonas expandidas com base em complexidade e contagens
  const [expandedZones, setExpandedZones] = useState(() => {
    const expanded = new Set()
    for (const zoneKey of ZONE_ORDER) {
      if (getDefaultExpanded(zoneKey, complexityMode)) {
        expanded.add(zoneKey)
      }
    }
    return expanded
  })

  const toggleZone = (zoneKey) => {
    setExpandedZones((prev) => {
      const next = new Set(prev)
      if (next.has(zoneKey)) {
        next.delete(zoneKey)
      } else {
        next.add(zoneKey)
      }
      return next
    })
  }

  // Doses pendentes na zona "agora" (todas, pois registradas vão para zones.done)
  const nowPending = useMemo(() => zones.now || [], [zones.now])

  return (
    <div className="dose-zone-list" data-testid="dose-zone-list">
      {ZONE_ORDER.map((zoneKey) => {
        const doses = zones[zoneKey] || []
        if (doses.length === 0) return null

        const config = ZONE_CONFIG[zoneKey]
        const isExpanded = expandedZones.has(zoneKey)
        const isDone = zoneKey === 'done'

        return (
          <ZoneSection
            key={zoneKey}
            zoneKey={zoneKey}
            doses={doses}
            expanded={isExpanded}
            onToggle={() => toggleZone(zoneKey)}
            config={config}
          >
            {viewMode === 'time' ? (
              <>
                {doses.map((dose) => (
                  <DoseCard
                    key={`${dose.protocolId}:${dose.scheduledTime}`}
                    dose={dose}
                    onRegisterDose={onRegisterDose}
                    selectedDoses={selectedDoses}
                    onToggleSelection={onToggleSelection}
                    done={isDone}
                  />
                ))}
                {zoneKey === 'now' && nowPending.length > 0 && (
                  <BatchRegisterButton
                    pendingCount={nowPending.length}
                    label="Registrar pendentes"
                    onClick={() => onBatchRegister(nowPending)}
                  />
                )}
              </>
            ) : (
              /* Modo plano: agrupa por TreatmentAccordion (Princípio 2 — preservar accordion) */
              <PlanModeZone
                doses={doses}
                zoneKey={zoneKey}
                selectedDoses={selectedDoses}
                onRegisterDose={onRegisterDose}
                onBatchRegister={onBatchRegister}
                onToggleSelection={onToggleSelection}
              />
            )}
          </ZoneSection>
        )
      })}
    </div>
  )
}

/**
 * PlanModeZone — Renderização em modo plano, com TreatmentAccordion por grupo.
 * Extraído para reduzir complexidade do componente principal.
 */
function PlanModeZone({
  doses,
  zoneKey,
  selectedDoses,
  onRegisterDose,
  onBatchRegister,
  onToggleSelection,
}) {
  const { planGroups, avulsos } = useMemo(() => groupDosesByPlan(doses), [doses])

  return (
    <>
      {planGroups.map((group) => (
        <TreatmentAccordion
          key={group.planId}
          protocol={makeSyntheticProtocol(group, zoneKey)}
          onBatchRegister={() => onBatchRegister(group.doses)}
          selectedMedicines={group.doses
            .filter((d) => selectedDoses.has(`${d.protocolId}:${d.scheduledTime}`))
            .map((d) => d.medicineId)}
        >
          {group.doses.map((dose) => (
            <SwipeRegisterItem
              key={`${dose.protocolId}:${dose.scheduledTime}`}
              medicine={{ id: dose.medicineId, name: dose.medicineName }}
              dosagePerIntake={dose.dosagePerIntake}
              time={dose.scheduledTime}
              isSelected={selectedDoses.has(`${dose.protocolId}:${dose.scheduledTime}`)}
              onToggleSelection={() => onToggleSelection(dose.protocolId, dose.scheduledTime)}
              onRegister={(_medicineId, dosage) => onRegisterDose(dose.protocolId, dosage)}
            />
          ))}
        </TreatmentAccordion>
      ))}

      {/* Doses avulsas (sem plano de tratamento) */}
      {avulsos.map((dose) => (
        <SwipeRegisterItem
          key={`${dose.protocolId}:${dose.scheduledTime}`}
          medicine={{ id: dose.medicineId, name: dose.medicineName }}
          dosagePerIntake={dose.dosagePerIntake}
          time={dose.scheduledTime}
          isSelected={selectedDoses.has(`${dose.protocolId}:${dose.scheduledTime}`)}
          onToggleSelection={() => onToggleSelection(dose.protocolId, dose.scheduledTime)}
          onRegister={(_medicineId, dosage) => onRegisterDose(dose.protocolId, dosage)}
        />
      ))}
    </>
  )
}
