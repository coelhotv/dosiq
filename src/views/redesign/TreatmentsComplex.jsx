/**
 * TreatmentsComplex — Modo complexo da view de tratamentos (Carlos)
 * Grupos colapsáveis por plano/classe com header colorido
 * Cada grupo contém protocolos com rows expandíveis
 * Layout responsivo controlado por media queries (sem useEffect)
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'
import TreatmentPlanHeader from '@protocols/components/redesign/TreatmentPlanHeader'
import ProtocolRow from '@protocols/components/redesign/ProtocolRow'

export default function TreatmentsComplex({ groups, onEdit, activeTab }) {
  const { cascade } = useMotion()
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [expandedRow, setExpandedRow] = useState(null)

  const toggleGroup = key => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <div className="treatments-complex__empty">
        <p>Nenhum tratamento nesta categoria.</p>
      </div>
    )
  }

  return (
    <motion.div
      className="treatments-complex"
      variants={cascade.container}
      initial="hidden"
      animate="visible"
    >
      {groups.map(group => {
        const isCollapsed = collapsedGroups.has(group.groupKey)
        return (
          <motion.section key={group.groupKey} variants={cascade.item} className="treatments-complex__group">
            <TreatmentPlanHeader
              group={group}
              isCollapsed={isCollapsed}
              onToggle={() => toggleGroup(group.groupKey)}
            />
            {!isCollapsed && (
              <>
                {/* Desktop: tabular grid layout (shown on >= 1024px) */}
                <div className="treatments-complex__rows treatments-complex__rows--tabular-container">
                  {group.items.map(item => (
                    <div key={item.id} style={{ display: 'contents' }}>
                      <ProtocolRow
                        item={item}
                        isComplex={true}
                        onEdit={onEdit}
                        activeTab={activeTab}
                        variant="tabular"
                      />
                    </div>
                  ))}
                </div>
                {/* Mobile: card layout (shown on < 1024px) */}
                <div className="treatments-complex__rows treatments-complex__rows--card-container">
                  {group.items.map(item => (
                    <ProtocolRow
                      key={item.id}
                      item={item}
                      isComplex={true}
                      expanded={expandedRow === item.id}
                      onToggleExpand={() =>
                        setExpandedRow(prev => (prev === item.id ? null : item.id))
                      }
                      onEdit={onEdit}
                      activeTab={activeTab}
                      variant="card"
                    />
                  ))}
                </div>
              </>
            )}
          </motion.section>
        )
      })}
    </motion.div>
  )
}
