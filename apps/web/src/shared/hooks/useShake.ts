/**
 * useShake.js - Hook standalone para shake effect
 *
 * Hook reutilizável para efeito de shake em elementos
 */

import { useState, useCallback } from 'react'
import { useHapticFeedback } from './useHapticFeedback'

export interface UseShakeOptions {
  onComplete?: () => void
}

export interface UseShakeResult {
  isShaking: boolean
  shake: () => void
}

export function useShake(options: UseShakeOptions = {}): UseShakeResult {
  const [isShaking, setIsShaking] = useState(false)
  const { trigger: haptic } = useHapticFeedback()
  const { onComplete } = options

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
  }
}
