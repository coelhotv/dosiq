import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon, Sunrise, Circle } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { getNow } from '@utils/dateUtils'
import CronogramaDoseItem from '@dashboard/components/CronogramaDoseItem'
import CronogramaPeriodHeader from '@dashboard/components/CronogramaPeriodHeader'
import MeasureTimelineCard from '@features/measures/components/MeasureTimelineCard'

const PERIODS = [
  { id: 'midnight', label: 'Madrugada', Icon: Moon, timeRange: [0, 6] },
  { id: 'morning', label: 'Manhã', Icon: Sunrise, timeRange: [6, 12] },
  { id: 'afternoon', label: 'Tarde', Icon: Sun, timeRange: [12, 18] },
  { id: 'night', label: 'Noite', Icon: Moon, timeRange: [18, 24] },
]

function getHour(scheduledTime) {
  return parseInt(scheduledTime.split(':')[0], 10)
}

// Renderiza um item da agenda — dose ou medida (012 Fase C / FR-011, interleave temporal).
function renderTimelineItem(item, onRegister, nowAbsolute) {
  if (item.kind === 'measure') {
    return <MeasureTimelineCard key={`measure-${item.id}`} measure={item.measure} scheduledTime={item.scheduledTime} />
  }
  return (
    <CronogramaDoseItem
      key={`${item.protocolId}-${item.scheduledTime}`}
      dose={item} onRegister={onRegister}
      stockDays={item.stockDays} stockStatus={item.stockStatus} now={nowAbsolute}
    />
  )
}

export default function CronogramaPeriodo({
  allDoses = [],
  measures = [],
  onRegister,
  variant = 'complex',
  now = getNow(),
  nowRaw = null,
}) {
  const { cascade } = useMotion()
  const currentHour = now.getHours()
  // Instante absoluto p/ classificação das doses (cronograma agrupa por hora local
  // via `now` shiftado; o item classifica por `nowRaw` absoluto vs scheduled_for).
  const nowAbsolute = nowRaw ?? now
  const [manuallyToggledZones, setManuallyToggledZones] = useState({})

  // Doses + medidas combinadas na MESMA timeline, ordenadas por horário (FR-011).
  // Medidas trazem `kind:'measure'`; doses mantêm o shape original (sem kind).
  const allItems = useMemo(() => [...allDoses, ...measures], [allDoses, measures])

  const autoOpenZones = useMemo(() => {
    return Object.fromEntries(
      PERIODS.map(({ id, timeRange }) => {
        const [start, end] = timeRange
        const isPast = currentHour >= end
        if (allItems.length > 0) {
          const hasItems = allItems.some((d) => {
            const h = getHour(d.scheduledTime)
            return h >= start && h < end
          })
          if (!hasItems) return [id, false]
        }
        return [id, !isPast]
      })
    )
  }, [allItems, currentHour])

  const toggleZone = (id) => {
    setManuallyToggledZones((prev) => ({
      ...prev,
      [id]: !(manuallyToggledZones[id] ?? autoOpenZones[id])
    }))
  }

  const grouped = useMemo(() => {
    return PERIODS.map(({ id, label, Icon, timeRange }) => {
      const [start, end] = timeRange
      const doses = allItems
        .filter((d) => {
          const h = getHour(d.scheduledTime)
          return h >= start && h < end
        })
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

      return { id, label, Icon, doses, isPast: currentHour >= end, isCurrent: currentHour >= start && currentHour < end }
    })
  }, [allItems, currentHour])

  if (variant === 'simple') {
    const sorted = [...allItems].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    if (sorted.length === 0) return null
    return (
      <div className="cronograma-doses cronograma-doses--simple" aria-label="Cronograma de hoje">
        {sorted.map((item) => renderTimelineItem(item, onRegister, nowAbsolute))}
      </div>
    )
  }

  return (
    <motion.div className="cronograma-doses cronograma-doses--complex" aria-label="Cronograma de doses de hoje" variants={cascade.container} initial="hidden" animate="visible">
      {grouped.map(({ id, label, Icon, doses, isPast, isCurrent }) => {
        const isOpen = manuallyToggledZones[id] ?? autoOpenZones[id]
        const isEmpty = doses.length === 0
        // Contadores do header contam SÓ doses (medidas são registros, não inflam "X doses").
        const doseOnly = doses.filter((d) => d.kind !== 'measure')
        const doneCount = doseOnly.filter((d) => d.isRegistered).length
        const missedCount = isPast ? doseOnly.filter((d) => !d.isRegistered).length : 0

        return (
          <motion.section key={id} aria-label={`${label}: ${doseOnly.length} dose${doseOnly.length !== 1 ? 's' : ''}`} variants={cascade.item}>
            <CronogramaPeriodHeader
              label={label} Icon={Icon} isOpen={isOpen} isEmpty={isEmpty} isPast={isPast}
              isPastActive={isPast && !isEmpty} isPastEmpty={isPast && isEmpty} isCurrent={isCurrent}
              missedCount={missedCount} doneCount={doneCount} totalDoses={doseOnly.length} onToggle={() => toggleZone(id)}
            />
            {isOpen && (
              isEmpty ? (
                <div className="cronograma-period-empty" role="status">
                  <Circle size={18} color="var(--color-outline-variant)" aria-hidden="true" />
                  <p className="cronograma-period-empty__text">Nenhum medicamento para este período</p>
                </div>
              ) : (
                <div className="cronograma-doses">
                  {doses.map((item) => renderTimelineItem(item, onRegister, nowAbsolute))}
                </div>
              )
            )}
          </motion.section>
        )
      })}
    </motion.div>
  )
}
