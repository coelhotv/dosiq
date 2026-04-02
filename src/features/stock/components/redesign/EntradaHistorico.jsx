/**
 * EntradaHistorico → "Histórico de Compras" (Wave 8)
 * Mostra as N compras mais recentes com "Ver tudo" para expandir.
 *
 * Exibe: ícone tipo + data + nome medicamento + quantidade + custo total (unit_price × qty)
 * - Dona Maria: "última compra" per-card (não usa este componente)
 * - Carlos: histórico completo para auditoria e análise de preço
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pill, Leaf, ChevronDown, ChevronUp } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { parseLocalDate } from '@utils/dateUtils'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatQuantity(entry) {
  return `+${entry.quantity_bought} un.`
}

/**
 * Formata o preço unitário: "R$ X,XX/un." ou null se não registrado.
 * Custo total seria irreal pois FIFO decrementa quantity após cada dose.
 */
function formatCost(entry) {
  if (entry.unit_price == null) return null
  if (entry.unit_price < 0.01) return 'Grátis'
  return `${entry.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/un.`
}

export default function EntradaHistorico({ purchases = [], maxVisible = 3 }) {
  const motionConfig = useMotion()
  const [expanded, setExpanded] = useState(false)

  if (purchases.length === 0) return null

  // Ordenar por data mais recente primeiro
  const sorted = [...purchases].sort(
    (a, b) => parseLocalDate(b.purchase_date) - parseLocalDate(a.purchase_date)
  )
  const visible = expanded ? sorted : sorted.slice(0, maxVisible)
  const hasMore = sorted.length > maxVisible

  return (
    <div className="entrada-historico">
      <motion.ul
        key={expanded}
        className="entrada-historico__list"
        variants={motionConfig.cascade.container}
        initial="hidden"
        animate="visible"
      >
        {visible.map((entry) => {
          // Ícone de tipo de medicamento
          const isSupplement = entry.medicineType === 'suplemento'
          const TypeIcon = isSupplement ? Leaf : Pill
          const cost = formatCost(entry)

          return (
            <motion.li
              key={entry.id}
              className="entrada-historico__item"
              variants={motionConfig.cascade.item}
            >
              {/* Ícone tipo de medicamento */}
              <div className="entrada-historico__type-icon">
                <TypeIcon size={16} aria-hidden="true" />
              </div>

              {/* Data + Nome */}
              <div className="entrada-historico__info">
                <span className="entrada-historico__date">{formatDate(entry.purchase_date)}</span>
              <span className="entrada-historico__medicine">{entry.medicineName}</span>
              </div>

              {/* Quantidade */}
              <span
                className={`entrada-historico__qty entrada-historico__qty--${
                  entry.quantity >= 0 ? 'positive' : 'negative'
                }`}
              >
                {formatQuantity(entry)}
              </span>

              {/* Custo total */}
              {cost && <span className="entrada-historico__cost">{cost}</span>}
            </motion.li>
          )
        })}
      </motion.ul>

      {hasMore && (
        <button
          className="entrada-historico__toggle"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp size={14} aria-hidden="true" /> Ver menos
            </>
          ) : (
            <>
              <ChevronDown size={14} aria-hidden="true" /> Ver tudo ({sorted.length})
            </>
          )}
        </button>
      )}
    </div>
  )
}
