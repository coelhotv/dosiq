import React, { useMemo } from 'react'
import TreatmentAccordion from '@dashboard/components/TreatmentAccordion'
import SwipeRegisterItem from '@dashboard/components/SwipeRegisterItem'

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

function makeSyntheticProtocol(group, zoneKey) {
  return {
    name: group.planName || 'Tratamento',
    medicines_count: group.doses.length,
    next_dose: group.doses[0]?.scheduledTime || '--:--',
    next_dose_window_end: null,
    is_in_tolerance_window: zoneKey === 'now' || zoneKey === 'late',
  }
}

export default function PlanModeZone({
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
