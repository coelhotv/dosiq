/**
 * EntradaHistorico — Histórico compacto de entradas de estoque (Wave 8).
 * Mostra as N mais recentes com "Ver tudo" para expandir.
 *
 * Exibe: data + custo do lote (unit_price) para ambas personas
 * - Dona Maria: "última compra" per-card (não usa este componente)
 * - Carlos: histórico completo com custos (para análise de preço)
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { parseLocalDate } from '@utils/dateUtils'

// Prefixos de ajustes automáticos do sistema (mesma lógica de StockCard.jsx original)
const SYSTEM_PREFIXES = ['Dose excluída', 'Ajuste de dose']

function classifyEntry(entry) {
  if (SYSTEM_PREFIXES.some((p) => entry.notes?.startsWith(p))) return 'system'
  if (entry.quantity > 0) return 'purchase'
  return 'adjustment'
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatQuantity(entry) {
  const sign = entry.quantity >= 0 ? '+' : ''
  return `${sign}${entry.quantity} un.`
}

/**
 * Formata o custo do lote: "R$ X,XX" ou null se não registrado.
 * Exibido para ambas as personas — é o ponto de referência para reposição.
 */
function formatCost(entry) {
  if (entry.unit_price == null) return null
  return entry.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function EntradaHistorico({ entries = [], medicineName, maxVisible = 3 }) {
  const motionConfig = useMotion()
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0) return null

  // Ordenar por data mais recente primeiro
  const sorted = [...entries].sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
  const visible = expanded ? sorted : sorted.slice(0, maxVisible)
  const hasMore = sorted.length > maxVisible

  return (
    <div className="entrada-historico">
      <motion.ul className="entrada-historico__list" variants={motionConfig.cascade.container} initial="hidden" animate="visible">
        {visible.map((entry) => {
          const type = classifyEntry(entry)
          const Icon = type === 'purchase' ? ShoppingCart : Pencil

          return (
            <motion.li key={entry.id} className="entrada-historico__item" variants={motionConfig.cascade.item}>
              <div className="entrada-historico__icon-wrap">
                <Icon size={14} aria-hidden="true" />
              </div>
              <div className="entrada-historico__info">
                <span className="entrada-historico__desc">
                  {type === 'purchase' ? 'Compra Realizada' : entry.notes || 'Ajuste Manual'}
                </span>
                {medicineName && <span className="entrada-historico__medicine">{medicineName}</span>}
              </div>
              <span
                className={`entrada-historico__qty entrada-historico__qty--${
                  entry.quantity >= 0 ? 'positive' : 'negative'
                }`}
              >
                {formatQuantity(entry)}
              </span>
              <div className="entrada-historico__meta">
                <span className="entrada-historico__date">{formatDate(entry.purchase_date)}</span>
                {/* Custo do lote — referência de preço para reposição (ambas as personas) */}
                {formatCost(entry) && <span className="entrada-historico__cost">{formatCost(entry)}</span>}
              </div>
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
