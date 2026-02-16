/**
 * useHapticFeedback.js - Hook para feedback tátil (vibração)
 *
 * Funcionalidades:
 * - Vibration API para Android Chrome
 * - Fallback silencioso em iOS/desktop
 * - Tipos de haptic: success, warning, error, selection, impact
 * - Suporte a prefers-reduced-motion
 */

import { useCallback } from 'react'

/**
 * Tipos de feedback háptico pré-definidos
 */
const HAPTIC_PATTERNS = {
  // Feedback positivo (sucesso)
  success: {
    duration: 50,
    pattern: null,
  },
  // Feedback de atenção (aviso)
  warning: {
    duration: 100,
    pattern: null,
  },
  // Feedback negativo (erro)
  error: {
    duration: 200,
    pattern: null,
  },
  // Feedback de seleção
  selection: {
    duration: 10,
    pattern: null,
  },
  // Feedback de impacto leve
  impact: {
    duration: 20,
    pattern: null,
  },
  // Confete/celebração
  celebration: {
    duration: 15,
    pattern: [15, 10, 15, 10, 15, 10, 50],
  },
  // Pulso (para registro de dose)
  pulse: {
    duration: 30,
    pattern: null,
  },
  // Shake (erro de validação)
  shake: {
    duration: 500,
    pattern: [50, 30, 50, 30, 50],
  },
}

/**
 * Hook useHapticFeedback
 *
 * @returns {Object} { trigger, isSupported, vibrate }
 *
 * @example
 * const { trigger, vibrate } = useHapticFeedback()
 *
 * // Usar tipo pré-definido
 * trigger('success')
 *
 * // Vibração customizada
 * vibrate(100)
 */
export function useHapticFeedback() {
  // Verificar se Vibration API é suportada
  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    !navigator.userAgent.match(/iPhone|iPad|iPod/i)

  // Verificar prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /**
   * Função principal de haptic feedback
   * @param {string} type - Tipo de haptic ('success', 'warning', 'error', 'selection', 'impact', 'celebration', 'pulse', 'shake')
   * @param {Object} options - Opções adicionais
   */
  const trigger = useCallback(
    (type, options = {}) => {
      // Se reduced-motion está ativo, não vibrate
      if (prefersReducedMotion) {
        return
      }

      // Se API não é suportada, retorna silenciosamente
      if (!isSupported) {
        return
      }

      const pattern = HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.selection

      // Se há pattern customizado via options, usa ele
      const patternToUse = options.pattern || pattern.pattern
      const duration = options.duration || pattern.duration

      try {
        if (patternToUse) {
          // Usar pattern de vibração
          navigator.vibrate(patternToUse)
        } else {
          // Usar duração simples
          navigator.vibrate(duration)
        }
      } catch (err) {
        // Silenciosamente ignora erros de vibration API
        console.debug('Haptic feedback error:', err)
      }
    },
    [isSupported, prefersReducedMotion]
  )

  /**
   * Função de vibração direta
   * @param {number|number[]} duration - Duração em ms ou array de pattern
   */
  const vibrate = useCallback(
    (duration) => {
      if (prefersReducedMotion || !isSupported) {
        return
      }

      try {
        navigator.vibrate(duration)
      } catch (err) {
        console.debug('Haptic vibration error:', err)
      }
    },
    [isSupported, prefersReducedMotion]
  )

  return {
    trigger,
    vibrate,
    isSupported,
  }
}

// Exportar padrões para uso externo se necessário
export { HAPTIC_PATTERNS }

export default useHapticFeedback
