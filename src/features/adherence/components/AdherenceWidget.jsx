import { useState, useEffect, useCallback } from 'react'
import { adherenceService } from '@adherence/services/adherenceService'
import AdherenceProgress from './AdherenceProgress'
import StreakBadge from './StreakBadge'
import Loading from '@shared/components/ui/Loading'
import './AdherenceWidget.css'

/**
 * @typedef {Object} ProtocolScore
 * @property {string} protocolId - ID do protocolo
 * @property {string} name - Nome do protocolo
 * @property {string} [medicineName] - Nome do medicamento associado
 * @property {number} score - Porcentagem de adesão (0-100)
 */

/**
 * @typedef {Object} AdherenceData
 * @property {number} overallScore - Score geral de adesão (0-100)
 * @property {number} overallTaken - Total de doses tomadas
 * @property {number} overallExpected - Total de doses esperadas
 * @property {number} [currentStreak] - Dias consecutivos atual
 * @property {number} [longestStreak] - Recorde de dias consecutivos
 * @property {ProtocolScore[]} [protocolScores] - Scores por protocolo
 */

/**
 * @typedef {Object} AdherenceWidgetProps
 * @property {string} [defaultPeriod='30d'] - Período inicial: '7d' | '30d' | '90d'
 */

/**
 * AdherenceWidget - Widget completo de adesão ao tratamento
 *
 * **Propósito:**
 * Widget completo que carrega e exibe dados de adesão ao tratamento,
 * incluindo score geral, streak, adesão por protocolo e dicas personalizadas.
 * Este componente gerencia seu próprio estado de dados e chamadas à API.
 *
 * **Funcionalidades incluídas:**
 * - Score geral de adesão com indicador visual circular
 * - Seletor de período (7 dias, 30 dias, 90 dias)
 * - Streak atual e recorde de dias consecutivos
 * - Breakdown de adesão por protocolo
 * - Dicas contextualizadas baseadas no score
 * - Estados de loading e erro
 *
 * **Quando usar:**
 * - No dashboard para visão geral de adesão
 * - Quando você precisa que os dados sejam carregados automaticamente
 * - Para widgets completos com interatividade (mudança de período)
 *
 * **Quando NÃO usar (use AdherenceProgress em vez disso):**
 * - Quando você já tem o valor calculado e só precisa exibir
 * - Para indicadores visuais simples em cards ou listas
 * - Quando precisa de controle total sobre o layout e dados
 *
 * **Dependências de dados:**
 * Este componente usa {@link adherenceService} para carregar:
 * - Resumo de adesão via `adherenceService.getAdherenceSummary(period)`
 *
 * @param {AdherenceWidgetProps} props
 * @returns {JSX.Element}
 *
 * @example
 * // Uso padrão com período inicial de 30 dias
 * <AdherenceWidget />
 *
 * @example
 * // Período inicial customizado
 * <AdherenceWidget defaultPeriod="7d" />
 *
 * @see {@link AdherenceProgress} - Para componente visual puro sem dados
 * @see {@link StreakBadge} - Para exibir streak em outros contextos
 */
export default function AdherenceWidget({ defaultPeriod = '30d' }) {
  const [period, setPeriod] = useState(defaultPeriod)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadAdherenceData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const summary = await adherenceService.getAdherenceSummary(period)
      setData(summary)
    } catch (err) {
      console.error('Erro ao carregar adesão:', err)
      setError('Não foi possível carregar os dados de adesão')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadAdherenceData()
  }, [loadAdherenceData])

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Excelente'
    if (score >= 80) return 'Muito Bom'
    if (score >= 60) return 'Bom'
    if (score >= 40) return 'Regular'
    return 'Precisa de Atenção'
  }

  const getScoreStatus = (score) => {
    if (score >= 80) return 'good'
    if (score >= 60) return 'warning'
    return 'poor'
  }

  if (loading) {
    return (
      <div className="adherence-widget loading">
        <Loading text="Calculando adesão..." size="sm" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="adherence-widget error">
        <p className="error-text">{error}</p>
        <button onClick={loadAdherenceData} className="retry-btn">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="adherence-widget">
      {/* Header com período selector */}
      <div className="adherence-header">
        <h3 className="adherence-title">Score de Adesão</h3>
        <div className="period-selector">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              className={`period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p.replace('d', ' dias')}
            </button>
          ))}
        </div>
      </div>

      {/* Score principal e streak */}
      <div className="adherence-main">
        <div className="score-section">
          <AdherenceProgress 
            score={data?.overallScore || 0} 
            size={140}
            strokeWidth={12}
          />
          <div className="score-info">
            <span className={`score-label ${getScoreStatus(data?.overallScore || 0)}`}>
              {getScoreLabel(data?.overallScore || 0)}
            </span>
            <span className="score-detail">
              {data?.overallTaken || 0} de {data?.overallExpected || 0} doses
            </span>
          </div>
        </div>

        {/* Streak info */}
        {(data?.currentStreak > 0 || data?.longestStreak > 0) && (
          <div className="streak-section">
            {data?.currentStreak > 0 && (
              <div className="streak-item">
                <StreakBadge streak={data.currentStreak} size="lg" />
                <span className="streak-description">dias seguidos</span>
              </div>
            )}
            {data?.longestStreak > data?.currentStreak && (
              <div className="streak-item record">
                <span className="record-label">Recorde:</span>
                <span className="record-value">{data.longestStreak} dias</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Adesão por protocolo */}
      {data?.protocolScores?.length > 0 && (
        <div className="protocol-scores">
          <h4 className="protocols-title">Por Protocolo</h4>
          <div className="protocols-list">
            {data.protocolScores.map((protocol) => (
              <div key={protocol.protocolId} className="protocol-item">
                <div className="protocol-info">
                  <span className="protocol-name">{protocol.name}</span>
                  {protocol.medicineName && (
                    <span className="protocol-medicine">{protocol.medicineName}</span>
                  )}
                </div>
                <div className="protocol-score">
                  <div className="mini-progress">
                    <div 
                      className="mini-progress-bar"
                      style={{ 
                        width: `${protocol.score}%`,
                        backgroundColor: protocol.score >= 80 
                          ? '#00ff88' 
                          : protocol.score >= 60 
                            ? '#ffd700' 
                            : '#ff3366'
                      }}
                    />
                  </div>
                  <span className="protocol-score-value">{protocol.score}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dicas baseadas no score */}
      <div className="adherence-tips">
        {(data?.overallScore || 0) < 60 && (
          <p className="tip-text">
            💡 Dica: Configure lembretes para não esquecer suas doses
          </p>
        )}
        {(data?.overallScore || 0) >= 90 && (
          <p className="tip-text success">
            🌟 Parabéns! Você está mantendo uma adesão excelente!
          </p>
        )}
      </div>
    </div>
  )
}
