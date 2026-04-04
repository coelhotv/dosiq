/**
 * TreatmentsComplex — Modo complexo da view de tratamentos (Carlos)
 * Grupos colapsáveis por plano/classe com header colorido
 * Cada grupo contém protocolos com rows expandíveis
 * Layout responsivo controlado por media queries (sem useEffect)
 * Wave 15.10: Integração de ProtocolRiskBadge
 */
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import TreatmentPlanHeader from '@protocols/components/redesign/TreatmentPlanHeader'
import ProtocolRow from '@protocols/components/redesign/ProtocolRow'
import ProtocolRiskBadge from '@adherence/components/ProtocolRiskBadge'
import { calculateProtocolRisk } from '@adherence/services/protocolRiskService'

/**
 * TreatmentsComplex — Modo complexo com grupos colapsáveis
 * S7.5.5: Adicionar hoveredRow state para iluminar linha inteira em desktop
 */
export default function TreatmentsComplex({ groups, onEdit, onDelete, onEditPlan, onDeletePlan, activeTab }) {
  const { cascade } = useMotion()
  const { logs } = useDashboard()
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [expandedRow, setExpandedRow] = useState(null)
  const [hoveredRow, setHoveredRow] = useState(null) // S7.5.5

  // Calcular scores de risco para cada protocolo (Wave 15.10)
  const riskByProtocol = useMemo(() => {
    if (!groups?.length || !logs?.length) return new Map()
    const map = new Map()
    groups.forEach((group) => {
      group.items?.forEach((item) => {
        if (!item?.id || item.active === false) return
        const risk = calculateProtocolRisk({
          protocolId: item.id,
          logs,
          protocol: item,
        })
        if (risk) map.set(item.id, risk)
      })
    })
    return map
  }, [groups, logs])

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => {
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
      {groups.map((group) => {
        const isCollapsed = collapsedGroups.has(group.groupKey)
        return (
          <motion.section
            key={group.groupKey}
            variants={cascade.item}
            className="treatments-complex__group"
          >
            <TreatmentPlanHeader
              group={group}
              isCollapsed={isCollapsed}
              onToggle={() => toggleGroup(group.groupKey)}
              onEditPlan={onEditPlan}
              onDeletePlan={onDeletePlan}
            />
            {!isCollapsed && (
              <>
                {/* Desktop: tabular grid layout (shown on >= 1024px) — S7.5.5: hover state */}
                <div className="treatments-complex__rows treatments-complex__rows--tabular-container">
                  {group.items.map((item) => (
                    // S7.5.5: display:contents preserva grid, mouse events na 1ª célula
                    <div key={item.id} style={{ display: 'contents' }}>
                      <ProtocolRow
                        item={item}
                        isComplex={true}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        activeTab={activeTab}
                        variant="tabular"
                        isHovered={hoveredRow === item.id}
                        onRowMouseEnter={() => setHoveredRow(item.id)}
                        onRowMouseLeave={() => setHoveredRow(null)}
                        onRowClick={() => onEdit?.(item)}
                        riskBadge={<ProtocolRiskBadge risk={riskByProtocol.get(item.id)} isComplex={true} />}
                      />
                    </div>
                  ))}
                </div>
                {/* Mobile: card layout (shown on < 1024px) */}
                <div className="treatments-complex__rows treatments-complex__rows--card-container">
                  {group.items.map((item) => (
                    <ProtocolRow
                      key={item.id}
                      item={item}
                      isComplex={true}
                      expanded={expandedRow === item.id}
                      onToggleExpand={() =>
                        setExpandedRow((prev) => (prev === item.id ? null : item.id))
                      }
                      onEdit={onEdit}
                      onDelete={onDelete}
                      activeTab={activeTab}
                      variant="card"
                      riskBadge={<ProtocolRiskBadge risk={riskByProtocol.get(item.id)} isComplex={true} />}
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
