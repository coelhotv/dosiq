/**
 * ShakeEffect.jsx - Componente de efeito de shake (tremer)
 * 
 * Funcionalidades:
 * - Anima elementos com shake horizontal ou vertical
 * - Feedback háptico para dispositivos móveis
 * - Ideal para erros de validação de formulários
 */

import { useEffect, useState, useCallback, memo } from 'react'
import { useHapticFeedback } from '../../hooks/useHapticFeedback'
import './Animations.css'

/**
 * Componente ShakeEffect
 * 
 * @param {Object} props
 * @param {boolean} props.trigger - Controla quando disparar o shake
 * @param {Function} props.onComplete - Callback quando animação terminar
 * @param {string} props.direction - Direção: 'horizontal' ou 'vertical'
 * @param {React.ReactNode} props.children - Elemento a ser animado
 */
function ShakeEffect({ 
  trigger = false, 
  onComplete,
  direction = 'horizontal',
  children 
}) {
  const [isShaking, setIsShaking] = useState(false)
  const { trigger: haptic } = useHapticFeedback()

  const shakeClass = direction === 'horizontal' ? 'shake-horizontal' : 'shake-vertical'

  const handleShake = useCallback(() => {
    setIsShaking(true)
    haptic('error')

    const timer = setTimeout(() => {
      setIsShaking(false)
      onComplete?.()
    }, 500)

    return () => clearTimeout(timer)
  }, [haptic, onComplete])

  useEffect(() => {
    if (trigger) {
      handleShake()
    }
  }, [trigger, handleShake])

  return (
    <div className={isShaking ? shakeClass : ''}>
      {children}
    </div>
  )
}

// Memoize para evitar re-renders
const MemoizedShakeEffect = memo(ShakeEffect)

export default MemoizedShakeEffect

/**
 * Hook standalone para shake effect
 */
export function useShake(options = {}) {
  const [isShaking, setIsShaking] = useState(false)
  const { trigger: haptic } = useHapticFeedback()
  const { direction = 'horizontal', onComplete } = options

  const shake = useCallback(() => {
    setIsShaking(true)
    haptic('error')

    setTimeout(() => {
      setIsShaking(false)
      onComplete?.()
    }, 500)
  }, [haptic, onComplete])

  return {
    isShaking,
    shake,
    shakeClass: isShaking 
      ? (direction === 'horizontal' ? 'shake-horizontal' : 'shake-vertical') 
      : ''
  }
}
