/**
 * CriticalAlertBanner — Banner de alerta crítico de estoque.
 * Renderizado apenas quando há medicamentos com status 'urgente'.
 *
 * Exibe: quantidade de medicamentos críticos + CTA "Comprar Tudo Agora"
 */

import { motion } from 'framer-motion'
import { AlertTriangle, ShoppingCart } from 'lucide-react'

export default function CriticalAlertBanner({ criticalCount, onBuyAll }) {
  if (criticalCount === 0) return null

  const message =
    criticalCount === 1
      ? '1 medicamento precisa de reposição imediata'
      : `${criticalCount} medicamentos precisam de reposição imediata`

  return (
    <motion.div
      className="critical-alert-banner"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      role="alert"
      aria-live="polite"
    >
      <div className="critical-alert-banner__content">
        <AlertTriangle size={20} className="critical-alert-banner__icon" aria-hidden="true" />
        <div>
          <p className="critical-alert-banner__title">Reposição Crítica</p>
          <p className="critical-alert-banner__message">{message}</p>
        </div>
      </div>
      <button
        className="critical-alert-banner__cta"
        onClick={onBuyAll}
        aria-label="Abrir formulário para registrar compra"
      >
        <ShoppingCart size={16} aria-hidden="true" />
        Comprar Tudo Agora
      </button>
    </motion.div>
  )
}
