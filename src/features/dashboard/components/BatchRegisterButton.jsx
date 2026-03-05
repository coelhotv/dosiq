/**
 * BatchRegisterButton — Botão de registro em lote (W2-06)
 *
 * Botão proeminente para registrar múltiplas doses pendentes de uma vez.
 * Não renderiza quando pendingCount === 0.
 */

import { motion } from 'framer-motion'
import './BatchRegisterButton.css'

/**
 * @param {Object} props
 * @param {number} props.pendingCount - Quantidade de doses pendentes
 * @param {string} props.label - Texto do botão
 * @param {Function} props.onClick
 * @param {boolean} [props.disabled=false]
 * @param {'primary'|'outline'} [props.variant='primary']
 */
export default function BatchRegisterButton({
  pendingCount,
  label,
  onClick,
  disabled = false,
  variant = 'primary',
}) {
  if (pendingCount === 0) return null

  return (
    <motion.button
      className={`batch-btn batch-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      type="button"
      aria-label={`${label} (${pendingCount})`}
    >
      {label} ({pendingCount})
    </motion.button>
  )
}
