/**
 * ConfettiAnimation.jsx - Componente de animação de confete
 * 
 * Funcionalidades:
 * - Dispara animação de confete na tela
 * - Usa Vibration API para feedback adicional
 * - Suporta prefers-reduced-motion
 */

import { useEffect, useState, memo } from 'react'
import { useHapticFeedback } from '../../hooks/useHapticFeedback'
import './Animations.css'

/**
 * Componente ConfettiAnimation
 * 
 * @param {Object} props
 * @param {boolean} props.trigger - Controla quando disparar o confete
 * @param {Function} props.onComplete - Callback quando animação terminar
 * @param {string} props.type - Tipo: 'burst' (central) ou 'rain' (caindo)
 */
function ConfettiAnimation({ 
  trigger = false, 
  onComplete,
  type = 'burst'
}) {
  const [particles, setParticles] = useState([])
  const { trigger: haptic } = useHapticFeedback()

  // Gerar partículas de confete
  useEffect(() => {
    if (!trigger) return

    // Feedback háptico
    haptic('celebration')

    const newParticles = []
    const particleCount = type === 'burst' ? 50 : 100

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * 360) * (Math.PI / 180)
      const velocity = 5 + Math.random() * 10
      const size = 6 + Math.random() * 8
      const colorIndex = Math.floor(Math.random() * 5)
      
      newParticles.push({
        id: i,
        x: type === 'burst' ? 50 : Math.random() * 100,
        y: type === 'burst' ? 50 : -10,
        vx: type === 'burst' ? Math.cos(angle) * velocity : (Math.random() - 0.5) * 2,
        vy: type === 'burst' ? Math.sin(angle) * velocity : 2 + Math.random() * 3,
        size,
        color: ['#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#3b82f6'][colorIndex],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10
      })
    }

    setParticles(newParticles)

    // Cleanup após 3 segundos
    const timer = setTimeout(() => {
      setParticles([])
      onComplete?.()
    }, 3000)

    return () => clearTimeout(timer)
  }, [trigger, type, haptic, onComplete])

  if (!trigger && particles.length === 0) return null

  return (
    <div className="confetti-container" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            '--vx': `${p.vx}`,
            '--vy': `${p.vy}`,
            animation: `confetti-fall ${2 + Math.random()}s linear forwards`,
            transform: `rotate(${p.rotation}deg)`
          }}
        />
      ))}
    </div>
  )
}

// Memoize para evitar re-renders
const MemoizedConfettiAnimation = memo(ConfettiAnimation)

export default MemoizedConfettiAnimation
