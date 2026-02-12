import './StreakBadge.css'

/**
 * StreakBadge - Badge de Dias Seguidos
 * 
 * Exibe o número de dias seguidos de adesão com ícone de fogo.
 * Pode ser exibido em tamanhos diferentes.
 * 
 * @param {number} streak - Número de dias seguidos
 * @param {string} size - Tamanho: 'sm' | 'md' | 'lg'
 * @param {boolean} showLabel - Mostrar label "dias"
 * @param {string} className - Classes CSS adicionais
 */
export default function StreakBadge({ 
  streak = 0, 
  size = 'md',
  showLabel = true,
  className = ''
}) {
  // Não mostrar se streak for 0 (a menos que seja explícito)
  if (streak === 0) return null
  
  const isHighStreak = streak >= 7
  
  return (
    <div className={`streak-badge streak-badge-${size} ${isHighStreak ? 'high-streak' : ''} ${className}`}>
      <span className="streak-icon">
        {isHighStreak ? '🔥' : '✓'}
      </span>
      <span className="streak-count">{streak}</span>
      {showLabel && (
        <span className="streak-label">
          {streak === 1 ? 'dia' : 'dias'}
        </span>
      )}
    </div>
  )
}
