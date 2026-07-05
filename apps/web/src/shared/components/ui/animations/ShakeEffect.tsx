/**
 * ShakeEffect.jsx - Componente de efeito de shake (tremer)
 *
 * Funcionalidades:
 * - Anima elementos com shake horizontal ou vertical
 * - Feedback háptico para dispositivos móveis
 * - Ideal para erros de validação de formulários
 */

import { memo } from 'react'
import { useShake } from '@shared/hooks/useShake'
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
  children,
}: {
  trigger?: boolean
  onComplete?: () => void
  direction?: string
  children?: any
}) {
  // TODO(040-strict): useShake não expõe trigger/direction/shakeClass — API divergente
  // pré-existente (bug latente, nunca funcionou em JS); cast preserva comportamento atual.
  const { isShaking, shakeClass } = useShake({ trigger, onComplete, direction } as any) as any

  return <div className={isShaking ? shakeClass : ''}>{children}</div>
}

// Memoize para evitar re-renders
const MemoizedShakeEffect = memo(ShakeEffect)

export default MemoizedShakeEffect
