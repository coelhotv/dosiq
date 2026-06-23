/**
 * ConsultationAdherenceSection — Seção de aderência do relatório de consulta.
 */
import { motion } from 'framer-motion'
import { BarChart3 } from 'lucide-react'

function getScoreColor(score) {
  if (score >= 80) return 'var(--color-success)'
  if (score >= 60) return 'var(--color-warning)'
  if (score >= 40) return 'color-mix(in srgb, var(--color-warning), var(--color-error))'
  return 'var(--color-error)'
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function ConsultationAdherenceSection({ adherenceSummary }) {
  return (
    <motion.section className="sr-consultation__section" variants={itemVariants}>
      <h2 className="sr-consultation__section-title">
        <BarChart3 size={20} /> Aderência ao Tratamento
      </h2>
      <div className="sr-consultation__adherence-grid">
        {['last30d', 'last90d'].map((key) => {
          const d = adherenceSummary?.[key]
          const score = d?.score || 0
          return (
            <div key={key} className="sr-adherence-card">
              <div className="sr-adherence-card__header">
                <span className="sr-adherence-card__period">
                  Últimos {key === 'last30d' ? '30 dias' : '90 dias'}
                </span>
                <span className="sr-adherence-card__score" style={{ color: getScoreColor(score) }}>
                  {score}%
                </span>
              </div>
              <div className="sr-adherence-card__bar">
                <motion.div
                  className="sr-adherence-card__bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ backgroundColor: getScoreColor(score) }}
                />
              </div>
              <div className="sr-adherence-card__details">
                <div>
                  <span className="sr-adherence-card__detail-value">{d?.taken || 0}/{d?.expected || 0}</span>
                  <span className="sr-adherence-card__detail-label"> doses tomadas</span>
                </div>
                {(d?.punctuality || 0) > 0 && (
                  <div>
                    <span className="sr-adherence-card__detail-value">{d.punctuality}%</span>
                    <span className="sr-adherence-card__detail-label"> pontualidade</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </motion.section>
  )
}
