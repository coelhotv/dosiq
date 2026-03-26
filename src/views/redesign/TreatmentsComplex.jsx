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

/**
 * TreatmentsComplex — Modo complexo com grupos colapsáveis
 * S7.5.5: Adicionar hoveredRow state para iluminar linha inteira em desktop
 */
export default function TreatmentsComplex({ groups, onEdit, onEditPlan, activeTab }) {
  const { cascade } = useMotion()
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [expandedRow, setExpandedRow] = useState(null)
  const [hoveredRow, setHoveredRow] = useState(null) // S7.5.5

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
              onEditPlan={onEditPlan}
            />
            {!isCollapsed && (
              <>
                {/* Desktop: tabular grid layout (shown on >= 1024px) — S7.5.5: hover state */}
                <div className="treatments-complex__rows treatments-complex__rows--tabular-container">
                  {group.items.map(item => (
                    // S7.5.5: wrapper exterior (sem display:contents) para receber mouse events
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredRow(item.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => onEdit?.(item)}
                      role="row"
                      aria-label={`Editar protocolo de ${item.medicineName}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onEdit?.(item)
                        }
                      }}
                    >
                      <div style={{ display: 'contents' }}>
                        <ProtocolRow
                          item={item}
                          isComplex={true}
                          onEdit={onEdit}
                          activeTab={activeTab}
                          variant="tabular"
                          isHovered={hoveredRow === item.id}
                        />
                      </div>
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
