/**
 * TreatmentsSimple — Modo simples da view de tratamentos (Dona Maria)
 * Lista plana sem agrupamento visual de grupos
 * Foco: próximo horário + estoque visível + risco de protocolo (Wave 15.10)
 */
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import ProtocolRow from '@protocols/components/redesign/ProtocolRow'
import ProtocolRiskBadge from '@adherence/components/ProtocolRiskBadge'
import { calculateProtocolRisk } from '@adherence/services/protocolRiskService'

export default function TreatmentsSimple({ items, onEdit, onDelete, activeTab }) {
  const { cascade } = useMotion()
  const { logs } = useDashboard()
  const [expanded, setExpanded] = useState(null)

  // Calcular scores de risco para cada protocolo (Wave 15.10)
  const riskByProtocol = useMemo(() => {
    if (!items?.length || !logs?.length) return new Map()
    const map = new Map()
    items.forEach((item) => {
      if (!item?.id || item.active === false) return
      const risk = calculateProtocolRisk({
        protocolId: item.id,
        logs,
        protocol: item,
      })
      if (risk) map.set(item.id, risk)
    })
    return map
  }, [items, logs])

  if (items.length === 0) {
    return (
      <div className="treatments-simple__empty">
        <p>Nenhum tratamento ativo no momento.</p>
      </div>
    )
  }

  return (
    <motion.ul
      className="treatments-simple__list"
      variants={cascade.container}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => (
        <motion.li key={item.id} variants={cascade.item}>
          <ProtocolRow
            item={item}
            isComplex={false}
            expanded={expanded === item.id}
            onToggleExpand={() => setExpanded((prev) => (prev === item.id ? null : item.id))}
            onEdit={onEdit}
            onDelete={onDelete}
            activeTab={activeTab}
            riskBadge={<ProtocolRiskBadge risk={riskByProtocol.get(item.id)} isComplex={false} />}
          />
        </motion.li>
      ))}
    </motion.ul>
  )
}
