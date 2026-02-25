/**
 * @fileoverview Serviço de renderização de gráficos para relatórios PDF.
 * Gera gráficos como imagens PNG em base64 usando Canvas API.
 * @module features/reports/services/chartRenderer
 */

/**
 * Cores do tema do aplicativo.
 * @constant {Object}
 */
const COLORS = {
  primary: '#10b981',    // Verde
  warning: '#f59e0b',    // Âmbar
  danger: '#ef4444',     // Vermelho
  background: '#1a1a2e', // Fundo escuro
  text: '#ffffff',       // Texto branco
  grid: 'rgba(255, 255, 255, 0.1)', // Linhas de grade
  barFill: 'rgba(16, 185, 129, 0.8)', // Barras com transparência
}

/**
 * Margens padrão para os gráficos.
 * @constant {Object}
 */
const MARGINS = {
  top: 40,
  right: 20,
  bottom: 60,
  left: 50,
}

/**
 * Altura da legenda em pixels.
 * @constant {number}
 */
const LEGEND_HEIGHT = 30

/**
 * Raio dos cantos arredondados das barras.
 * @constant {number}
 */
const BAR_RADIUS = 4

/**
 * Cria um contexto de canvas com as dimensões especificadas.
 * @param {number} width - Largura do canvas em pixels.
 * @param {number} height - Altura do canvas em pixels.
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}} Canvas e contexto 2D.
 * @private
 */
function createCanvas(width, height) {
  // Verifica se está em ambiente Node.js (para testes)
  const isNode = typeof window === 'undefined'
  
  if (isNode) {
    // Em Node.js, usa canvas do pacote 'canvas' se disponível
    // Caso contrário, retorna null (testes devem mockar)
    return { canvas: null, ctx: null }
  }
  
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  return { canvas, ctx }
}

/**
 * Desenha o fundo do gráfico com a cor de fundo do tema.
 * @param {CanvasRenderingContext2D} ctx - Contexto do canvas.
 * @param {number} width - Largura do canvas.
 * @param {number} height - Altura do canvas.
 * @private
 */
function drawBackground(ctx, width, height) {
  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, width, height)
}

/**
 * Desenha linhas de grade horizontais.
 * @param {CanvasRenderingContext2D} ctx - Contexto do canvas.
 * @param {number} chartLeft - Posição X inicial da área do gráfico.
 * @param {number} chartRight - Posição X final da área do gráfico.
 * @param {number} chartTop - Posição Y inicial da área do gráfico.
 * @param {number} chartBottom - Posição Y final da área do gráfico.
 * @param {number} steps - Número de divisões da grade.
 * @private
 */
function drawGridLines(ctx, chartLeft, chartRight, chartTop, chartBottom, steps) {
  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 1
  
  const stepHeight = (chartBottom - chartTop) / steps
  
  for (let i = 0; i <= steps; i++) {
    const y = chartTop + (stepHeight * i)
    ctx.beginPath()
    ctx.moveTo(chartLeft, y)
    ctx.lineTo(chartRight, y)
    ctx.stroke()
  }
}

/**
 * Desenha um retângulo com cantos arredondados.
 * @param {CanvasRenderingContext2D} ctx - Contexto do canvas.
 * @param {number} x - Posição X do canto superior esquerdo.
 * @param {number} y - Posição Y do canto superior esquerdo.
 * @param {number} width - Largura do retângulo.
 * @param {number} height - Altura do retângulo.
 * @param {number} radius - Raio dos cantos arredondados.
 * @private
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  // Garante que o raio não seja maior que a metade da altura/largura
  const r = Math.min(radius, width / 2, height / 2)
  
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * Obtém a cor da barra baseada no valor de adesão.
 * @param {number} value - Valor de adesão (0-100).
 * @returns {string} Cor correspondente ao valor.
 * @private
 */
function getAdherenceColor(value) {
  if (value >= 80) return COLORS.primary
  if (value >= 50) return COLORS.warning
  return COLORS.danger
}

/**
 * Obtém a cor da barra baseada nos dias restantes de estoque.
 * @param {number} daysRemaining - Dias restantes de estoque.
 * @returns {string} Cor correspondente ao valor.
 * @private
 */
function getStockColor(daysRemaining) {
  if (daysRemaining >= 15) return COLORS.primary
  if (daysRemaining >= 7) return COLORS.warning
  return COLORS.danger
}

/**
 * Desenha texto no canvas.
 * @param {CanvasRenderingContext2D} ctx - Contexto do canvas.
 * @param {string} text - Texto a ser desenhado.
 * @param {number} x - Posição X.
 * @param {number} y - Posição Y.
 * @param {Object} options - Opções de formatação.
 * @param {string} [options.color='#ffffff'] - Cor do texto.
 * @param {string} [options.font='12px Inter, sans-serif'] - Fonte do texto.
 * @param {string} [options.align='left'] - Alinhamento do texto.
 * @param {string} [options.baseline='middle'] - Alinhamento vertical.
 * @private
 */
function drawText(ctx, text, x, y, options = {}) {
  const {
    color = COLORS.text,
    font = '12px Inter, sans-serif',
    align = 'left',
    baseline = 'middle',
  } = options
  
  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(text, x, y)
}

/**
 * Desenha a legenda do gráfico de adesão.
 * @param {CanvasRenderingContext2D} ctx - Contexto do canvas.
 * @param {number} width - Largura total do canvas.
 * @param {number} legendY - Posição Y da legenda.
 * @private
 */
function drawAdherenceLegend(ctx, width, legendY) {
  const items = [
    { color: COLORS.primary, label: 'Doses tomadas' },
    { color: COLORS.grid, label: 'Esperado' },
  ]
  
  const itemWidth = 120
  const totalWidth = items.length * itemWidth
  const startX = (width - totalWidth) / 2
  
  items.forEach((item, index) => {
    const x = startX + (index * itemWidth)
    
    // Desenha quadrado colorido
    ctx.fillStyle = item.color
    ctx.fillRect(x, legendY - 6, 12, 12)
    
    // Desenha texto
    drawText(ctx, item.label, x + 18, legendY, { font: '11px Inter, sans-serif' })
  })
}

/**
 * Desenha a legenda do gráfico de estoque.
 * @param {CanvasRenderingContext2D} ctx - Contexto do canvas.
 * @param {number} width - Largura total do canvas.
 * @param {number} legendY - Posição Y da legenda.
 * @private
 */
function drawStockLegend(ctx, width, legendY) {
  const items = [
    { color: COLORS.primary, label: '≥15 dias' },
    { color: COLORS.warning, label: '7-14 dias' },
    { color: COLORS.danger, label: '<7 dias' },
  ]
  
  const itemWidth = 80
  const totalWidth = items.length * itemWidth
  const startX = (width - totalWidth) / 2
  
  items.forEach((item, index) => {
    const x = startX + (index * itemWidth)
    
    // Desenha quadrado colorido
    ctx.fillStyle = item.color
    ctx.fillRect(x, legendY - 6, 12, 12)
    
    // Desenha texto
    drawText(ctx, item.label, x + 18, legendY, { font: '11px Inter, sans-serif' })
  })
}

/**
 * Renderiza um gráfico de barras de adesão diária.
 * @param {Object} data - Dados do gráfico de adesão.
 * @param {string[]} data.labels - Rótulos das datas (formato DD/MM).
 * @param {number[]} data.values - Percentuais de adesão (0-100).
 * @param {number[]} data.expected - Doses esperadas por dia.
 * @param {number[]} data.taken - Doses tomadas por dia.
 * @param {number} [width=600] - Largura do gráfico em pixels.
 * @param {number} [height=300] - Altura do gráfico em pixels.
 * @returns {string|null} URL de dados base64 (data:image/png;base64,...) ou null se dados vazios.
 * 
 * @example
 * const chartData = {
 *   labels: ['01/02', '02/02', '03/02'],
 *   values: [100, 80, 50],
 *   expected: [2, 2, 2],
 *   taken: [2, 1.6, 1]
 * }
 * const dataUrl = renderAdherenceChart(chartData, 600, 300)
 * // Retorna: 'data:image/png;base64,iVBORw0KGgo...'
 */
export function renderAdherenceChart(data, width = 600, height = 300) {
  // Validação de dados vazios
  if (!data || !data.labels || data.labels.length === 0) {
    return null
  }
  
  const { labels, values, expected, taken } = data
  const barCount = labels.length
  
  // Cria canvas
  const { canvas, ctx } = createCanvas(width, height)
  if (!canvas || !ctx) {
    return null
  }
  
  // Desenha fundo
  drawBackground(ctx, width, height)
  
  // Calcula dimensões da área do gráfico
  const chartLeft = MARGINS.left
  const chartRight = width - MARGINS.right
  const chartTop = MARGINS.top
  const chartBottom = height - MARGINS.bottom - LEGEND_HEIGHT
  const chartWidth = chartRight - chartLeft
  const chartHeight = chartBottom - chartTop
  
  // Desenha linhas de grade
  drawGridLines(ctx, chartLeft, chartRight, chartTop, chartBottom, 5)
  
  // Desenha rótulos do eixo Y (0%, 25%, 50%, 75%, 100%)
  const yLabels = ['100%', '75%', '50%', '25%', '0%']
  yLabels.forEach((label, index) => {
    const y = chartTop + (chartHeight * index / 4)
    drawText(ctx, label, chartLeft - 10, y, { align: 'right', font: '10px Inter, sans-serif' })
  })
  
  // Calcula largura das barras
  const barGroupWidth = chartWidth / barCount
  const barWidth = Math.min(barGroupWidth * 0.6, 40)
  const barGap = barGroupWidth - barWidth
  
  // Desenha barras
  labels.forEach((label, index) => {
    const x = chartLeft + (index * barGroupWidth) + (barGap / 2)
    
    // Valor da adesão (0-100)
    const value = Math.min(100, Math.max(0, values[index] || 0))
    const barHeight = (value / 100) * chartHeight
    const y = chartBottom - barHeight
    
    // Desenha barra com cor baseada no valor
    const color = getAdherenceColor(value)
    ctx.fillStyle = color
    drawRoundedRect(ctx, x, y, barWidth, barHeight, BAR_RADIUS)
    ctx.fill()
    
    // Desenha linha de referência do esperado (tracejada)
    if (expected && expected[index] > 0) {
      const expectedY = chartBottom - chartHeight // 100% sempre no topo
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(x, expectedY)
      ctx.lineTo(x + barWidth, expectedY)
      ctx.stroke()
      ctx.setLineDash([])
    }
    
    // Desenha rótulo do eixo X (data)
    drawText(ctx, label, x + barWidth / 2, chartBottom + 15, {
      align: 'center',
      font: '10px Inter, sans-serif',
    })
    
    // Desenha valor acima da barra
    if (barHeight > 20) {
      drawText(ctx, `${Math.round(value)}%`, x + barWidth / 2, y - 8, {
        align: 'center',
        font: '10px Inter, sans-serif',
        color: COLORS.text,
      })
    }
  })
  
  // Desenha título
  drawText(ctx, 'Adesão Diária (%)', width / 2, 20, {
    align: 'center',
    font: 'bold 14px Inter, sans-serif',
  })
  
  // Desenha legenda
  drawAdherenceLegend(ctx, width, height - LEGEND_HEIGHT / 2)
  
  // Retorna data URL
  return canvas.toDataURL('image/png')
}

/**
 * Renderiza um gráfico de barras horizontais de estoque.
 * @param {Array<Object>} stockSummary - Resumo do estoque de medicamentos.
 * @param {string} stockSummary[].name - Nome do medicamento.
 * @param {number} stockSummary[].daysRemaining - Dias restantes de estoque.
 * @param {number} [width=600] - Largura do gráfico em pixels.
 * @param {number} [height=300] - Altura do gráfico em pixels.
 * @returns {string|null} URL de dados base64 (data:image/png;base64,...) ou null se dados vazios.
 * 
 * @example
 * const stockData = [
 *   { name: 'Metformina', daysRemaining: 30 },
 *   { name: 'Losartana', daysRemaining: 7 },
 *   { name: 'AAS', daysRemaining: 3 }
 * ]
 * const dataUrl = renderStockChart(stockData, 600, 300)
 * // Retorna: 'data:image/png;base64,iVBORw0KGgo...'
 */
export function renderStockChart(stockSummary, width = 600, height = 300) {
  // Validação de dados vazios
  if (!stockSummary || !Array.isArray(stockSummary) || stockSummary.length === 0) {
    return null
  }
  
  // Limita a 10 medicamentos para evitar sobreposição
  const data = stockSummary.slice(0, 10)
  const barCount = data.length
  
  // Cria canvas
  const { canvas, ctx } = createCanvas(width, height)
  if (!canvas || !ctx) {
    return null
  }
  
  // Desenha fundo
  drawBackground(ctx, width, height)
  
  // Calcula dimensões da área do gráfico
  const chartLeft = MARGINS.left + 80 // Espaço extra para nomes
  const chartRight = width - MARGINS.right
  const chartTop = MARGINS.top
  const chartBottom = height - MARGINS.bottom - LEGEND_HEIGHT
  const chartWidth = chartRight - chartLeft
  const chartHeight = chartBottom - chartTop
  
  // Encontra o valor máximo para escala
  const maxDays = Math.max(...data.map(item => item.daysRemaining || 0), 30)
  
  // Desenha linhas de grade verticais
  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 1
  const gridSteps = 5
  for (let i = 0; i <= gridSteps; i++) {
    const x = chartLeft + (chartWidth * i / gridSteps)
    ctx.beginPath()
    ctx.moveTo(x, chartTop)
    ctx.lineTo(x, chartBottom)
    ctx.stroke()
    
    // Rótulos do eixo X
    const daysLabel = Math.round(maxDays * i / gridSteps)
    drawText(ctx, `${daysLabel}d`, x, chartBottom + 15, {
      align: 'center',
      font: '10px Inter, sans-serif',
    })
  }
  
  // Calcula altura das barras
  const barHeight = Math.min((chartHeight / barCount) * 0.7, 25)
  const barGap = (chartHeight / barCount) - barHeight
  
  // Desenha barras horizontais
  data.forEach((item, index) => {
    const y = chartTop + (index * (barHeight + barGap)) + (barGap / 2)
    const daysRemaining = Math.max(0, item.daysRemaining || 0)
    const barWidth = (daysRemaining / maxDays) * chartWidth
    
    // Desenha nome do medicamento à esquerda
    const truncatedName = item.name.length > 12 
      ? item.name.substring(0, 10) + '...' 
      : item.name
    drawText(ctx, truncatedName, chartLeft - 10, y + barHeight / 2, {
      align: 'right',
      font: '10px Inter, sans-serif',
    })
    
    // Desenha barra com cor baseada nos dias restantes
    const color = getStockColor(daysRemaining)
    ctx.fillStyle = color
    drawRoundedRect(ctx, chartLeft, y, barWidth, barHeight, BAR_RADIUS)
    ctx.fill()
    
    // Desenha valor dentro ou ao lado da barra
    const valueText = `${daysRemaining} dias`
    if (barWidth > 50) {
      drawText(ctx, valueText, chartLeft + barWidth - 8, y + barHeight / 2, {
        align: 'right',
        font: '10px Inter, sans-serif',
        color: COLORS.text,
      })
    } else if (barWidth > 0) {
      drawText(ctx, valueText, chartLeft + barWidth + 8, y + barHeight / 2, {
        align: 'left',
        font: '10px Inter, sans-serif',
        color: COLORS.text,
      })
    }
  })
  
  // Desenha título
  drawText(ctx, 'Dias de Estoque Restantes', width / 2, 20, {
    align: 'center',
    font: 'bold 14px Inter, sans-serif',
  })
  
  // Desenha legenda
  drawStockLegend(ctx, width, height - LEGEND_HEIGHT / 2)
  
  // Retorna data URL
  return canvas.toDataURL('image/png')
}

/**
 * Exporta todas as funções do módulo.
 */
export default {
  renderAdherenceChart,
  renderStockChart,
}
