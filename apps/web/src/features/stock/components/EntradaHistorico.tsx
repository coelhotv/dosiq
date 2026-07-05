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
import { ChevronDown, ChevronUp } from 'lucide-react'
import MedicineIcon from '@shared/components/ui/MedicineIcon'
import { useMotion } from '@shared/hooks/useMotion'
import { parseLocalDate } from '@utils/dateUtils'
import { stockUnitLabel, formatNumberPtBR } from '@dosiq/core'

function formatDate(dateStr: any) {
  if (!dateStr) return '—'
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatQuantity(entry: any) {
  // Líquidos (022): quantidade em ml.
  const label = stockUnitLabel(entry)
  return `+${formatNumberPtBR(entry.quantity_bought)} ${label}`
}

/**
 * Formata o preço unitário: "R$ X,XX/un." (ou /ml líquido) ou null se não registrado.
 * Custo total seria irreal pois FIFO decrementa quantity após cada dose.
 */
function formatCost(entry: any) {
  if (entry.unit_price == null) return null
  if (entry.unit_price < 0.01) return 'Grátis'
  const label = stockUnitLabel(entry)
  return `${entry.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/${label}`
}

export default function EntradaHistorico({ purchases = [], maxVisible = 3 }: any) {
  const motionConfig = useMotion()
  const [expanded, setExpanded] = useState(false)

  if (purchases.length === 0) return null

  // Ordenar por data mais recente primeiro
  const sorted = [...purchases].sort(
    (a: any, b: any) =>
      parseLocalDate(b.purchase_date).getTime() - parseLocalDate(a.purchase_date).getTime()
  )
  const visible = expanded ? sorted : sorted.slice(0, maxVisible)
  const hasMore = sorted.length > maxVisible

  return (
    <div className="entrada-historico">
      <motion.ul
        key={String(expanded)}
        className="entrada-historico__list"
        variants={motionConfig.cascade.container as any}
        initial="hidden"
        animate="visible"
      >
        {visible.map((entry) => {
          const cost = formatCost(entry)

          return (
            <motion.li
              key={entry.id}
              className="entrada-historico__item"
              variants={motionConfig.cascade.item as any}
            >
              {/* Ícone canônico de identificação do medicamento */}
              <div className="entrada-historico__type-icon">
                <MedicineIcon medicine={{ type: entry.medicineType }} size={16} aria-hidden="true" />
              </div>

              {/* Data + Nome */}
              <div className="entrada-historico__info">
                <span className="entrada-historico__date">{formatDate(entry.purchase_date)}</span>
                <span className="entrada-historico__medicine">{entry.medicineName}</span>
                {(entry.laboratory || entry.pharmacy) && (
                  <span
                    className="entrada-historico__origin"
                    style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}
                  >
                    {[entry.laboratory, entry.pharmacy].filter(Boolean).join(' • ')}
                  </span>
                )}
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
