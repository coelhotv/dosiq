import React, { useState, useMemo } from 'react'
import BatchRegisterButton from '@dashboard/components/BatchRegisterButton'
import DoseCard from '@dashboard/components/DoseCard'
import ZoneSection from '@dashboard/components/ZoneSection'
import PlanModeZone from '@dashboard/components/PlanModeZone'
import './DoseZoneList.css'

const ZONE_CONFIG = {
  late: { icon: '⚠️', label: 'ATRASADAS', color: 'late' },
  now: { icon: '▶', label: 'AGORA', color: 'now' },
  upcoming: { icon: '🕐', label: 'PRÓXIMAS', color: 'upcoming' },
  later: { icon: '📅', label: 'MAIS TARDE', color: 'later' },
  done: { icon: '✓', label: 'REGISTRADAS', color: 'done' },
}

const ZONE_ORDER = ['late', 'now', 'upcoming', 'later', 'done']

function getDefaultExpanded(zone, complexityMode = 'moderate') {
  if (zone === 'late') return true
  if (zone === 'now') return true
  if (zone === 'upcoming') return complexityMode !== 'complex'
  return false
}

export default function DoseZoneList({
  zones,
  viewMode,
  complexityMode = 'moderate',
  onRegisterDose,
  onBatchRegister,
  onToggleSelection,
  selectedDoses = new Set(),
}) {
  const [expandedZones, setExpandedZones] = useState(() => {
    const expanded = new Set()
    for (const zoneKey of ZONE_ORDER) {
      if (getDefaultExpanded(zoneKey, complexityMode)) expanded.add(zoneKey)
    }
    return expanded
  })

  const toggleZone = (zoneKey) => {
    setExpandedZones((prev) => {
      const next = new Set(prev)
      if (next.has(zoneKey)) next.delete(zoneKey)
      else next.add(zoneKey)
      return next
    })
  }

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
          <ZoneSection key={zoneKey} zoneKey={zoneKey} doses={doses} expanded={isExpanded} onToggle={() => toggleZone(zoneKey)} config={config}>
            {viewMode === 'time' ? (
              <>
                {doses.map((dose) => (
                  <DoseCard key={`${dose.protocolId}:${dose.scheduledTime}`} dose={dose} onRegisterDose={onRegisterDose} selectedDoses={selectedDoses} onToggleSelection={onToggleSelection} done={isDone} />
                ))}
                {zoneKey === 'now' && nowPending.length > 0 && (
                  <BatchRegisterButton pendingCount={nowPending.length} label="Registrar pendentes" onClick={() => onBatchRegister(nowPending)} />
                )}
              </>
            ) : (
              <PlanModeZone doses={doses} zoneKey={zoneKey} selectedDoses={selectedDoses} onRegisterDose={onRegisterDose} onBatchRegister={onBatchRegister} onToggleSelection={onToggleSelection} />
            )}
          </ZoneSection>
        )
      })}
    </div>
  )
}
