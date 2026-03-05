import { motion } from 'framer-motion'
import './StockBars.css'

// Máximo de dias para normalizar a barra (100%)
const MAX_DAYS = 30

// Indicadores visuais por nível
const STOCK_INDICATORS = {
  critical: '🔴',
  low: '🟡',
  normal: '🟢',
  high: '🔵',
}

const STOCK_COLORS = {
  critical: 'var(--color-error)',
  low: 'var(--color-warning)',
  normal: 'var(--color-success)',
  high: 'var(--color-info)',
}

// Formata dias: cap em "90d+" para estoques muito altos
function formatDays(days) {
  if (days >= 90) return '90d+'
  return `${Math.round(days)}d`
}

// Trunca nome em 12 caracteres (elipsis via CSS)
const containerVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
}

const barVariants = {
  hidden: { width: 0 },
  visible: (percent) => ({
    width: `${percent}%`,
    transition: { duration: 0.5, ease: 'easeOut' },
  }),
}

/**
 * StockBars — Barras horizontais de estoque com projeção de consumo.
 *
 * Componente puro: dados exclusivamente por props.
 *
 * @param {Array<StockBarItem>} items - Lista de medicamentos com dados de estoque
 * @param {number} [maxItems=Infinity] - Limita quantidade exibida
 * @param {boolean} [showOnlyCritical=false] - Filtra só CRITICAL+LOW
 * @param {Function} [onItemClick] - Click handler (medicineId) → navega para Estoque
 * @param {string} [className] - CSS override
 */
export default function StockBars({
  items = [],
  maxItems = Infinity,
  showOnlyCritical = false,
  onItemClick,
  className = '',
}) {
  let visibleItems = showOnlyCritical
    ? items.filter((item) => item.level === 'critical' || item.level === 'low')
    : items

  if (maxItems !== Infinity) {
    visibleItems = visibleItems.slice(0, maxItems)
  }

  if (visibleItems.length === 0) {
    return (
      <div className={`stock-bars stock-bars--empty ${className}`}>
        <p className="stock-bars__empty-text">Nenhum item de estoque para exibir</p>
      </div>
    )
  }

  return (
    <motion.div
      className={`stock-bars ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {visibleItems.map((item) => {
        const percent = Math.min((item.daysRemaining / MAX_DAYS) * 100, 100)
        const color = STOCK_COLORS[item.level] || STOCK_COLORS.normal
        const isCritical = item.level === 'critical'

        return (
          <motion.div
            key={item.medicineId}
            className="stock-bars__item"
            variants={itemVariants}
            onClick={() => onItemClick?.(item.medicineId)}
            role={onItemClick ? 'button' : undefined}
            tabIndex={onItemClick ? 0 : undefined}
            onKeyDown={
              onItemClick ? (e) => e.key === 'Enter' && onItemClick(item.medicineId) : undefined
            }
            aria-label={`${item.name}: ${formatDays(item.daysRemaining)} restantes`}
          >
            <span className="stock-bars__name" title={item.name}>
              {item.name}
            </span>
            <div className="stock-bars__track">
              <motion.div
                className={`stock-bars__fill ${isCritical ? 'pulse-critical' : ''}`}
                style={{ backgroundColor: color }}
                variants={barVariants}
                custom={percent}
              />
            </div>
            <span className="stock-bars__days">{formatDays(item.daysRemaining)}</span>
            <span className="stock-bars__indicator" aria-hidden="true">
              {STOCK_INDICATORS[item.level]}
            </span>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
