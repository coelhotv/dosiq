import './AdherenceProgress.css'

/**
 * @typedef {Object} AdherenceProgressProps
 * @property {number} [score=0] - Valor de 0 a 100 representando a porcentagem de adesão
 * @property {number} [size=120] - Tamanho do círculo em pixels
 * @property {number} [strokeWidth=10] - Espessura da linha do círculo
 * @property {string} [className=''] - Classes CSS adicionais
 */

/**
 * AdherenceProgress - Componente visual de progresso circular puro
 *
 * **Propósito:**
 * Componente de apresentação (presentational) que exibe um indicador circular
 * de adesão com porcentagem no centro. Usa SVG para renderização escalável
 * e animada.
 *
 * **Quando usar:**
 * - Para mostrar visualmente uma porcentagem de adesão em qualquer contexto
 * - Como parte de componentes maiores que precisam de um indicador visual
 * - Quando você já tem o valor calculado e só precisa exibi-lo
 *
 * **Quando NÃO usar (use AdherenceWidget em vez disso):**
 * - Quando precisar de dados de adesão carregados automaticamente
 * - Quando precisar de funcionalidades extras (streak, adesão por protocolo, seletor de período)
 * - Para widgets completos do dashboard
 *
 * **Cores automáticas baseadas no score:**
 * - 80-100%: Verde neon (#00ff88) - Excelente
 * - 60-79%: Amarelo/dourado (#ffd700) - Bom
 * - 40-59%: Laranja (#ff9500) - Regular
 * - 0-39%: Vermelho/rosa (#ff3366) - Precisa de atenção
 *
 * @param {AdherenceProgressProps} props
 * @returns {JSX.Element}
 *
 * @example
 * // Uso básico
 * <AdherenceProgress score={85} />
 *
 * @example
 * // Tamanho customizado
 * <AdherenceProgress score={72} size={180} strokeWidth={15} />
 *
 * @see {@link AdherenceWidget} - Para widget completo com dados e funcionalidades
 */
export default function AdherenceProgress({
  score = 0,
  size = 120,
  strokeWidth = 10,
  className = '',
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
      <svg className="progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
            transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease',
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
