import { motion } from 'framer-motion'
import './CostChart.css'

const formatBRL = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const containerVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
}

const barVariants = {
  hidden: { width: 0 },
  visible: (percent) => ({
    width: `${percent}%`,
    transition: { duration: 0.45, ease: 'easeOut' },
  }),
}

/**
 * CostChart — Mini-chart de distribuição de custo mensal por medicamento.
 *
 * Componente puro: dados exclusivamente por props.
 *
 * @param {Array<{name: string, monthlyCost: number}>} items - Custo mensal por med
 * @param {number} totalMonthly - Total mensal (soma)
 * @param {number} [projection3m] - Projeção 3 meses
 * @param {Function} [onExpand] - Expandir para detalhes
 */
export default function CostChart({ items = [], totalMonthly = 0, projection3m, onExpand }) {
  const hasData = items.length > 0 && totalMonthly > 0

  if (!hasData) {
    return (
      <div className="cost-chart cost-chart--empty">
        <p className="cost-chart__empty-text">Adicione preços no estoque para ver custos</p>
        {onExpand && (
          <button className="cost-chart__link" onClick={onExpand} type="button">
            Ir para Estoque →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="cost-chart">
      <div className="cost-chart__header">
        <span className="cost-chart__header-label">$ CUSTO MENSAL</span>
        <span className="cost-chart__header-total">{formatBRL(totalMonthly)}</span>
      </div>

      <motion.div
        className="cost-chart__list"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {items.map((item) => {
          const percent = totalMonthly > 0 ? (item.monthlyCost / totalMonthly) * 100 : 0

          return (
            <motion.div key={item.name} className="cost-chart__item" variants={itemVariants}>
              <span className="cost-chart__item-name" title={item.name}>
                {item.name}
              </span>
              <div className="cost-chart__track">
                <motion.div className="cost-chart__fill" variants={barVariants} custom={percent} />
              </div>
              <span className="cost-chart__item-value">{formatBRL(item.monthlyCost)}</span>
            </motion.div>
          )
        })}
      </motion.div>

      {projection3m != null && (
        <div className="cost-chart__projection">
          <span className="cost-chart__projection-label">Projeção 3m:</span>
          <span className="cost-chart__projection-value">{formatBRL(projection3m)}</span>
        </div>
      )}

      {onExpand && (
        <button className="cost-chart__link" onClick={onExpand} type="button">
          Ver análise completa →
        </button>
      )}
    </div>
  )
}
