import './AdherenceProgress.css'

/**
 * AdherenceProgress - Componente de Progresso Circular
 * 
 * Exibe um círculo de progresso com porcentagem no centro.
 * Usa SVG para renderização escalável e suavizada.
 * 
 * @param {number} score - Valor de 0 a 100
 * @param {number} size - Tamanho em pixels (padrão: 120)
 * @param {number} strokeWidth - Espessura da linha (padrão: 10)
 * @param {string} className - Classes CSS adicionais
 */
export default function AdherenceProgress({ 
  score = 0, 
  size = 120, 
  strokeWidth = 10,
  className = ''
}) {
  // Garantir valor entre 0 e 100
  const normalizedScore = Math.min(Math.max(score, 0), 100)
  
  // Cálculos para o círculo
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (normalizedScore / 100) * circumference
  
  // Determinar cor baseado no score
  const getScoreColor = () => {
    if (score >= 80) return '#00ff88' // Verde neon
    if (score >= 60) return '#ffd700' // Amarelo/dourado
    if (score >= 40) return '#ff9500' // Laranja
    return '#ff3366' // Vermelho/rosa
  }
  
  const scoreColor = getScoreColor()
  
  return (
    <div className={`adherence-progress ${className}`} style={{ width: size, height: size }}>
      <svg 
        className="progress-ring" 
        width={size} 
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Círculo de fundo */}
        <circle
          className="progress-ring-circle-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Círculo de progresso */}
        <circle
          className="progress-ring-circle"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          stroke={scoreColor}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease'
          }}
        />
      </svg>
      
      {/* Texto central */}
      <div className="progress-text">
        <span className="progress-percentage" style={{ color: scoreColor }}>
          {Math.round(normalizedScore)}
        </span>
        <span className="progress-suffix">%</span>
      </div>
    </div>
  )
}
