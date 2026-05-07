import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon, Sunrise, Circle } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { getNow } from '@utils/dateUtils'
import CronogramaDoseItem from '@dashboard/components/CronogramaDoseItem'
import CronogramaPeriodHeader from '@dashboard/components/CronogramaPeriodHeader'

const PERIODS = [
  { id: 'midnight', label: 'Madrugada', Icon: Moon, timeRange: [0, 6] },
  { id: 'morning', label: 'Manhã', Icon: Sunrise, timeRange: [6, 12] },
  { id: 'afternoon', label: 'Tarde', Icon: Sun, timeRange: [12, 18] },
  { id: 'night', label: 'Noite', Icon: Moon, timeRange: [18, 24] },
]

function getHour(scheduledTime) {
  return parseInt(scheduledTime.split(':')[0], 10)
}

export default function CronogramaPeriodo({
  allDoses = [],
  onRegister,
  variant = 'complex',
  now = getNow(),
}) {
  const { cascade } = useMotion()
  const currentHour = now.getHours()
  const [manuallyToggledZones, setManuallyToggledZones] = useState({})

  const autoOpenZones = useMemo(() => {
    return Object.fromEntries(
      PERIODS.map(({ id, timeRange }) => {
        const [start, end] = timeRange
        const isPast = currentHour >= end
        if (allDoses.length > 0) {
          const hasDoses = allDoses.some((d) => {
            const h = getHour(d.scheduledTime)
            return h >= start && h < end
          })
          if (!hasDoses) return [id, false]
        }
        return [id, !isPast]
      })
    )
  }, [allDoses, currentHour])

  const toggleZone = (id) => {
    setManuallyToggledZones((prev) => ({
      ...prev,
      [id]: !(manuallyToggledZones[id] ?? autoOpenZones[id])
    }))
  }

  const grouped = useMemo(() => {
    return PERIODS.map(({ id, label, Icon, timeRange }) => {
      const [start, end] = timeRange
      const doses = allDoses
        .filter((d) => {
          const h = getHour(d.scheduledTime)
          return h >= start && h < end
        })
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

      return { id, label, Icon, doses, isPast: currentHour >= end, isCurrent: currentHour >= start && currentHour < end }
    })
  }, [allDoses, currentHour])

  if (variant === 'simple') {
    const sorted = [...allDoses].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    if (sorted.length === 0) return null
    return (
      <div className="cronograma-doses cronograma-doses--simple" aria-label="Cronograma de doses de hoje">
        {sorted.map((dose) => (
          <CronogramaDoseItem key={`${dose.protocolId}-${dose.scheduledTime}`} dose={dose} onRegister={onRegister} stockDays={dose.stockDays} stockStatus={dose.stockStatus} now={now} />
        ))}
      </div>
    )
  }

  return (
    <motion.div className="cronograma-doses cronograma-doses--complex" aria-label="Cronograma de doses de hoje" variants={cascade.container} initial="hidden" animate="visible">
      {grouped.map(({ id, label, Icon, doses, isPast, isCurrent }) => {
        const isOpen = manuallyToggledZones[id] ?? autoOpenZones[id]
        const isEmpty = doses.length === 0
        const doneCount = doses.filter((d) => d.isRegistered).length
        const missedCount = isPast ? doses.filter((d) => !d.isRegistered).length : 0

        return (
          <motion.section key={id} aria-label={`${label}: ${doses.length} dose${doses.length !== 1 ? 's' : ''}`} variants={cascade.item}>
            <CronogramaPeriodHeader
              label={label} Icon={Icon} isOpen={isOpen} isEmpty={isEmpty} isPast={isPast}
              isPastActive={isPast && !isEmpty} isPastEmpty={isPast && isEmpty} isCurrent={isCurrent}
              missedCount={missedCount} doneCount={doneCount} totalDoses={doses.length} onToggle={() => toggleZone(id)}
            />
            {isOpen && (
              isEmpty ? (
                <div className="cronograma-period-empty" role="status">
                  <Circle size={18} color="var(--color-outline-variant)" aria-hidden="true" />
                  <p className="cronograma-period-empty__text">Nenhum medicamento para este período</p>
                </div>
              ) : (
                <div className="cronograma-doses">
                  {doses.map((dose) => (
                    <CronogramaDoseItem key={`${dose.protocolId}-${dose.scheduledTime}`} dose={dose} onRegister={onRegister} stockDays={dose.stockDays} stockStatus={dose.stockStatus} now={now} />
                  ))}
                </div>
              )
            )}
          </motion.section>
        )
      })}
    </motion.div>
  )
}
