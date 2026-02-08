/**
 * ShakeEffect.jsx - Componente de efeito de shake (tremer)
 * 
 * Funcionalidades:
 * - Anima elementos com shake horizontal ou vertical
 * - Feedback háptico para dispositivos móveis
 * - Ideal para erros de validação de formulários
 */

import { memo } from 'react'
import { useShake } from '../../hooks/useShake'
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
  const { isShaking, shake, shakeClass } = useShake({ trigger, onComplete, direction })

  return (
    <div className={isShaking ? shakeClass : ''}>
      {children}
    </div>
  )
}

// Memoize para evitar re-renders
const MemoizedShakeEffect = memo(ShakeEffect)

export default MemoizedShakeEffect
