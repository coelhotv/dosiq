/**
 * TreatmentsSimple — Modo simples da view de tratamentos (Dona Maria)
 * Lista plana sem agrupamento visual de grupos
 * Foco: próximo horário + estoque visível
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'
import ProtocolRow from '@protocols/components/redesign/ProtocolRow'

export default function TreatmentsSimple({ items, onEdit }) {
  const { cascade } = useMotion()
  const [expanded, setExpanded] = useState(null)

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
      {items.map(item => (
        <motion.li key={item.id} variants={cascade.item}>
          <ProtocolRow
            item={item}
            isComplex={false}
            expanded={expanded === item.id}
            onToggleExpand={() => setExpanded(prev => (prev === item.id ? null : item.id))}
            onEdit={onEdit}
          />
        </motion.li>
      ))}
    </motion.ul>
  )
}
