/**
 * useShake.js - Hook standalone para shake effect
 * 
 * Hook reutilizável para efeito de shake em elementos
 */

import { useState, useCallback } from 'react'
import { useHapticFeedback } from '../useHapticFeedback'

/**
 * Hook useShake
 * 
 * @param {Object} options
 * @param {string} options.direction - Direção: 'horizontal' ou 'vertical'
 * @param {Function} options.onComplete - Callback quando animação terminar
 * @returns {Object} { isShaking, shake, shakeClass }
 */
export function useShake(options = {}) {
  const [isShaking, setIsShaking] = useState(false)
  const { trigger: haptic } = useHapticFeedback()
  const { direction = 'horizontal', onComplete } = options

  const shakeClass = direction === 'horizontal' ? 'shake-horizontal' : 'shake-vertical'

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
