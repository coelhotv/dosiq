/**
 * PulseEffect.jsx - Componente de efeito de pulsação
 *
 * Funcionalidades:
 * - Anel de pulsação ao redor de elementos
 * - Glow effect para destacar elementos
 * - Suporta prefers-reduced-motion
 */

import { useEffect, useState, memo } from 'react'
import { useHapticFeedback } from '../../hooks/useHapticFeedback'
import './Animations.css'

/**
 * Componente PulseEffect
 *
 * @param {Object} props
 * @param {boolean} props.trigger - Controla quando disparar a pulsação
 * @param {Function} props.onComplete - Callback quando animação terminar
 * @param {string} props.variant - Variante: 'ring' (anel) ou 'glow' (brilho)
 * @param {React.ReactNode} props.children - Elemento a ser destacado
 */
function PulseEffect({ trigger = false, onComplete, variant = 'ring', children }) {
  const [isPulsing, setIsPulsing] = useState(false)
  const { trigger: haptic } = useHapticFeedback()

  useEffect(() => {
    if (!trigger) {
      // Usar setTimeout para evitar setState síncrono no useEffect
      const timer = setTimeout(() => {
        setIsPulsing(false)
      }, 0)
      return () => clearTimeout(timer)
    }

    // Feedback háptico
    haptic('pulse')

    // Usar setTimeout para evitar setState síncrono no useEffect
    const timer2 = setTimeout(() => {
      setIsPulsing(true)
    }, 0)

    // Para após 2 pulsos
    const timer3 = setTimeout(() => {
      setIsPulsing(false)
      onComplete?.()
    }, 2000)

    return () => {
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [trigger, haptic, onComplete])

  if (!children) {
    return (
      <div className={`pulse-container ${isPulsing ? 'pulse-ring' : ''}`}>
        {variant === 'ring' && (
          <>
            <div className="pulse-ring" />
            <div className="pulse-ring" style={{ animationDelay: '0.3s' }} />
            <div className="pulse-ring" style={{ animationDelay: '0.6s' }} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`pulse-container ${isPulsing ? 'pulse-element' : ''}`}>
      {variant === 'ring' && isPulsing && (
        <>
          <div className="pulse-ring" />
          <div className="pulse-ring" style={{ animationDelay: '0.3s' }} />
          <div className="pulse-ring" style={{ animationDelay: '0.6s' }} />
        </>
      )}
      {children}
    </div>
  )
}

const MemoizedPulseEffect = memo(PulseEffect)

export default MemoizedPulseEffect
