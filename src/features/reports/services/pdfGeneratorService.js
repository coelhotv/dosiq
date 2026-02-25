/**
 * @fileoverview Serviço de geração de relatórios PDF.
 * Gera relatórios completos em formato A4 com gráficos e tabelas.
 * @module features/reports/services/pdfGeneratorService
 */

import { renderAdherenceChart, renderStockChart } from './chartRenderer.js'
import { adherenceService } from '@services/api/adherenceService.js'
import { protocolService } from '@features/protocols/services/protocolService.js'
import { stockService } from '@features/stock/services/stockService.js'
import { parseLocalDate } from '@utils/dateUtils.js'

/**
 * Dimensões da página A4 em milímetros.
 * @constant {Object}
 */
const PAGE_DIMENSIONS = {
  width: 210,
  height: 297,
  margin: 10,
  contentWidth: 190, // 210 - 2*10
}

/**
 * Posições Y para elementos do PDF.
 * @constant {Object}
 */
const Y_POSITIONS = {
  headerStart: 20,
  headerTitle: 25,
  headerDate: 35,
  summaryStart: 45,
  chartStart: 80,
  chartHeight: 76, // Proporção 500x200 convertida para 190mm largura
  tableStart: 165,
  stockStart: 250,
  footer: 285,
}

/**
 * Cores do tema para o PDF.
 * @constant {Object}
 */
const PDF_COLORS = {
  primary: [16, 185, 129], // Verde
  warning: [245, 158, 11], // Âmbar
  danger: [239, 68, 68], // Vermelho
  text: [51, 51, 51], // Cinza escuro
  lightGray: [200, 200, 200],
  white: [255, 255, 255],
}

/**
 * Formata uma data para exibição no cabeçalho do relatório.
 * @param {Date} date - Data a ser formatada.
 * @returns {string} Data formatada em português.
 * @private
 */
function formatReportDate(date) {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  return date.toLocaleDateString('pt-BR', options)
}

/**
 * Formata horários de doses para exibição.
 * @param {Array<string>} timeSchedule - Array de horários.
 * @returns {string} Horários formatados.
 * @private
 */
function formatTimeSchedule(timeSchedule) {
  if (!timeSchedule || timeSchedule.length === 0) return '1x/dia'
  return `${timeSchedule.length}x/dia`
}

/**
 * Traduz o status do protocolo para português.
 * @param {boolean} active - Se o protocolo está ativo.
 * @returns {string} Status traduzido.
 * @private
 */
function translateStatus(active) {
  return active ? 'Ativo' : 'Inativo'
}

/**
 * Calcula dias restantes de estoque para um medicamento.
 * @param {Object} stockSummary - Resumo do estoque.
 * @param {Object} protocol - Protocolo associado.
 * @returns {number} Dias restantes estimados.
 * @private
 */
function calculateDaysRemaining(stockSummary, protocol) {
  if (!stockSummary || stockSummary.total_quantity <= 0) return 0

  const dosesPerDay = protocol?.time_schedule?.length || 1
  return Math.floor(stockSummary.total_quantity / dosesPerDay)
}

/**
 * Log estruturado para o serviço de PDF (R-087).
 * @param {string} level - Nível do log (info, warn, error).
 * @param {string} message - Mensagem do log.
 * @param {Object} data - Dados adicionais.
 * @private
 */
function logPDF(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: 'pdfGeneratorService',
    level,
    message,
    ...data,
  }
  console.log(JSON.stringify(logEntry))
}

/**
 * Desenha o cabeçalho do relatório.
 * @param {Object} doc - Instância do jsPDF.
 * @param {string} title - Título do relatório.
 * @param {Date} reportDate - Data do relatório.
 * @private
 */
function drawHeader(doc, title, reportDate) {
  // Título principal
  doc.setFontSize(20)
  doc.setTextColor(...PDF_COLORS.text)
  doc.text(title, PAGE_DIMENSIONS.width / 2, Y_POSITIONS.headerTitle, {
    align: 'center',
  })

  // Data do relatório
  doc.setFontSize(10)
  doc.setTextColor(...PDF_COLORS.lightGray)
  doc.text(formatReportDate(reportDate), PAGE_DIMENSIONS.width / 2, Y_POSITIONS.headerDate, {
    align: 'center',
  })

  // Linha separadora
  doc.setDrawColor(...PDF_COLORS.primary)
  doc.setLineWidth(0.5)
  doc.line(
    PAGE_DIMENSIONS.margin,
    Y_POSITIONS.headerDate + 5,
    PAGE_DIMENSIONS.width - PAGE_DIMENSIONS.margin,
    Y_POSITIONS.headerDate + 5
  )
}

/**
 * Desenha o resumo de adesão.
 * @param {Object} doc - Instância do jsPDF.
 * @param {Object} adherenceSummary - Dados de adesão.
 * @private
 */
function drawAdherenceSummary(doc, adherenceSummary) {
  const startY = Y_POSITIONS.summaryStart

  // Título da seção
  doc.setFontSize(14)
  doc.setTextColor(...PDF_COLORS.text)
  doc.text('Resumo de Adesão', PAGE_DIMENSIONS.margin, startY)

  // Estatísticas em caixas
  const stats = [
    {
      label: 'Score Geral',
      value: `${adherenceSummary.overallScore || 0}%`,
      color:
        adherenceSummary.overallScore >= 80
          ? PDF_COLORS.primary
          : adherenceSummary.overallScore >= 50
            ? PDF_COLORS.warning
            : PDF_COLORS.danger,
    },
    {
      label: 'Doses Tomadas',
      value: String(adherenceSummary.overallTaken || 0),
      color: PDF_COLORS.text,
    },
    {
      label: 'Doses Esperadas',
      value: String(adherenceSummary.overallExpected || 0),
      color: PDF_COLORS.text,
    },
    {
      label: 'Sequência Atual',
      value: `${adherenceSummary.currentStreak || 0} dias`,
      color: PDF_COLORS.primary,
    },
  ]

  const boxWidth = 45
  const boxHeight = 20
  const boxGap = 5
  const startX = PAGE_DIMENSIONS.margin

  stats.forEach((stat, index) => {
    const x = startX + index * (boxWidth + boxGap)

    // Caixa
    doc.setDrawColor(...PDF_COLORS.lightGray)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, startY + 8, boxWidth, boxHeight, 2, 2, 'S')

    // Valor
    doc.setFontSize(14)
    doc.setTextColor(...stat.color)
    doc.text(stat.value, x + boxWidth / 2, startY + 18, { align: 'center' })

    // Label
    doc.setFontSize(8)
    doc.setTextColor(...PDF_COLORS.lightGray)
    doc.text(stat.label, x + boxWidth / 2, startY + 25, { align: 'center' })
  })
}

/**
 * Desenha o gráfico de adesão.
 * @param {Object} doc - Instância do jsPDF.
 * @param {string} chartImage - Imagem do gráfico em base64.
 * @param {number} startY - Posição Y inicial.
 * @returns {number} Posição Y após o gráfico.
 * @private
 */
function drawAdherenceChart(doc, chartImage, startY) {
  if (!chartImage) {
    // Mensagem de dados não disponíveis
    doc.setFontSize(10)
    doc.setTextColor(...PDF_COLORS.lightGray)
    doc.text(
      'Dados de adesão não disponíveis para o período',
      PAGE_DIMENSIONS.width / 2,
      startY + Y_POSITIONS.chartHeight / 2,
      { align: 'center' }
    )
    return startY + Y_POSITIONS.chartHeight + 10
  }

  // Título do gráfico
  doc.setFontSize(12)
  doc.setTextColor(...PDF_COLORS.text)
  doc.text('Tendência de Adesão (30 dias)', PAGE_DIMENSIONS.margin, startY)

  // Adiciona imagem do gráfico
  doc.addImage(
    chartImage,
    'PNG',
    PAGE_DIMENSIONS.margin,
    startY + 5,
    PAGE_DIMENSIONS.contentWidth,
    Y_POSITIONS.chartHeight
  )

  return startY + Y_POSITIONS.chartHeight + 15
}

/**
 * Desenha a tabela de protocolos.
 * @param {Object} doc - Instância do jsPDF.
 * @param {Array} protocols - Lista de protocolos.
 * @param {Function} autoTable - Função autoTable do jspdf-autotable.
 * @param {number} startY - Posição Y inicial.
 * @returns {number} Posição Y final após a tabela.
 * @private
 */
function drawProtocolsTable(doc, protocols, autoTable, startY) {
  if (!protocols || protocols.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(...PDF_COLORS.lightGray)
    doc.text('Nenhum protocolo cadastrado', PAGE_DIMENSIONS.margin, startY + 10)
    return startY + 20
  }

  // Prepara dados da tabela
  const tableData = protocols.map((protocol) => [
    protocol.medicine?.name || protocol.name || 'Medicamento',
    `${protocol.dosage || ''} ${protocol.dosage_unit || 'comprimido(s)'}`,
    formatTimeSchedule(protocol.time_schedule),
    translateStatus(protocol.active),
  ])

  // Usa autoTable para criar tabela formatada
  autoTable(doc, {
    startY: startY,
    head: [['Medicamento', 'Dosagem', 'Frequência', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: PDF_COLORS.primary,
      textColor: PDF_COLORS.white,
      fontSize: 10,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: PDF_COLORS.text,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: {
      left: PAGE_DIMENSIONS.margin,
      right: PAGE_DIMENSIONS.margin,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40 },
      2: { cellWidth: 40 },
      3: { cellWidth: 30 },
    },
  })

  // Retorna a posição Y final da tabela
  return doc.lastAutoTable.finalY + 10
}

/**
 * Desenha o resumo de estoque com gráfico.
 * @param {Object} doc - Instância do jsPDF.
 * @param {Array} stockData - Dados de estoque.
 * @param {string} stockChartImage - Imagem do gráfico de estoque.
 * @param {number} startY - Posição Y inicial.
 * @private
 */
function drawStockSummary(doc, stockData, stockChartImage, startY) {
  // Verifica se precisa de nova página
  if (startY > 240) {
    doc.addPage()
    startY = 20
  }

  // Título da seção
  doc.setFontSize(12)
  doc.setTextColor(...PDF_COLORS.text)
  doc.text('Resumo de Estoque', PAGE_DIMENSIONS.margin, startY)

  if (!stockData || stockData.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(...PDF_COLORS.lightGray)
    doc.text('Nenhum dado de estoque disponível', PAGE_DIMENSIONS.margin, startY + 10)
    return
  }

  // Alertas de estoque baixo
  const lowStock = stockData.filter((item) => item.daysRemaining < 7)
  if (lowStock.length > 0) {
    doc.setFontSize(9)
    doc.setTextColor(...PDF_COLORS.danger)
    doc.text(
      `Atenção: ${lowStock.length} medicamento(s) com estoque baixo`,
      PAGE_DIMENSIONS.margin,
      startY + 8
    )
  }

  // Gráfico de estoque
  if (stockChartImage) {
    doc.addImage(
      stockChartImage,
      'PNG',
      PAGE_DIMENSIONS.margin,
      startY + 12,
      PAGE_DIMENSIONS.contentWidth,
      50
    )
  }
}

/**
 * Desenha o rodapé do relatório.
 * @param {Object} doc - Instância do jsPDF.
 * @private
 */
function drawFooter(doc) {
  // Linha separadora
  doc.setDrawColor(...PDF_COLORS.lightGray)
  doc.setLineWidth(0.2)
  doc.line(
    PAGE_DIMENSIONS.margin,
    Y_POSITIONS.footer - 5,
    PAGE_DIMENSIONS.width - PAGE_DIMENSIONS.margin,
    Y_POSITIONS.footer - 5
  )

  // Disclaimer
  doc.setFontSize(8)
  doc.setTextColor(...PDF_COLORS.lightGray)
  doc.text(
    'Este relatório é apenas informativo e não substitui orientação médica. Consulte seu médico para decisões sobre tratamento.',
    PAGE_DIMENSIONS.width / 2,
    Y_POSITIONS.footer,
    { align: 'center', maxWidth: PAGE_DIMENSIONS.contentWidth }
  )
}

/**
 * Prepara dados de adesão para o gráfico.
 * @param {Array} dailyAdherence - Dados diários de adesão.
 * @returns {Object} Dados formatados para renderAdherenceChart.
 * @private
 */
function prepareAdherenceChartData(dailyAdherence) {
  if (!dailyAdherence || dailyAdherence.length === 0) {
    return null
  }

  return {
    labels: dailyAdherence.map((day) => {
      // Formata data para DD/MM
      const date = parseLocalDate(day.date)
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }),
    values: dailyAdherence.map((day) => day.adherence || 0),
    expected: dailyAdherence.map((day) => day.expected || 0),
    taken: dailyAdherence.map((day) => day.taken || 0),
  }
}

/**
 * Prepara dados de estoque para o gráfico.
 * @param {Array} protocols - Lista de protocolos.
 * @param {Array} stockSummaries - Resumos de estoque.
 * @returns {Array} Dados formatados para renderStockChart.
 * @private
 */
function prepareStockChartData(protocols, stockSummaries) {
  if (!protocols || protocols.length === 0) {
    return []
  }

  return protocols
    .filter((protocol) => protocol.active && protocol.medicine)
    .map((protocol) => {
      const stock = stockSummaries.find((s) => s.medicine_id === protocol.medicine_id)
      return {
        name: protocol.medicine?.name || protocol.name,
        daysRemaining: stock ? calculateDaysRemaining(stock, protocol) : 0,
      }
    })
    .filter((item) => item.daysRemaining > 0)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 10) // Limita a 10 medicamentos
}

/**
 * Gera um relatório PDF completo.
 *
 * @param {Object} options - Opções de geração do relatório.
 * @param {string} [options.title='Meus Remédios - Relatório'] - Título do relatório.
 * @param {string} [options.period='30d'] - Período do relatório ('7d', '30d', '90d').
 * @param {boolean} [options.includeCharts=true] - Se deve incluir gráficos.
 * @param {boolean} [options.includeProtocols=true] - Se deve incluir tabela de protocolos.
 * @param {boolean} [options.includeStock=true] - Se deve incluir resumo de estoque.
 * @returns {Promise<Blob>} Blob do PDF gerado.
 *
 * @example
 * // Geração básica
 * const pdfBlob = await generatePDF()
 *
 * // Com opções personalizadas
 * const pdfBlob = await generatePDF({
 *   title: 'Relatório Mensal',
 *   period: '30d',
 *   includeCharts: true
 * })
 *
 * // Download do PDF
 * const url = URL.createObjectURL(pdfBlob)
 * const a = document.createElement('a')
 * a.href = url
 * a.download = 'relatorio-medicamentos.pdf'
 * a.click()
 * URL.revokeObjectURL(url)
 */
export async function generatePDF(options = {}) {
  const startTime = Date.now()
  const {
    title = 'Meus Remédios - Relatório',
    period = '30d',
    includeCharts = true,
    includeProtocols = true,
    includeStock = true,
  } = options

  logPDF('info', 'Iniciando geração do PDF', { title, period, options })

  try {
    // Lazy load jsPDF e jspdf-autotable (não impacta bundle inicial)
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    logPDF('info', 'Bibliotecas carregadas', { library: 'jspdf + jspdf-autotable' })

    // Busca dados em paralelo
    const dataFetchStart = Date.now()
    const [adherenceSummary, dailyAdherence, protocols, lowStock] = await Promise.all([
      adherenceService.getAdherenceSummary(period),
      adherenceService.getDailyAdherence(30),
      includeProtocols ? protocolService.getAll() : Promise.resolve([]),
      includeStock ? stockService.getLowStockMedicines(100) : Promise.resolve([]),
    ])

    logPDF('info', 'Dados buscados', {
      duration: `${Date.now() - dataFetchStart}ms`,
      adherenceScore: adherenceSummary.overallScore,
      protocolsCount: protocols.length,
      lowStockCount: lowStock.length,
    })

    // Busca resumos de estoque para cada medicamento
    let stockSummaries = []
    if (includeStock && protocols.length > 0) {
      const medicineIds = [...new Set(protocols.map((p) => p.medicine_id).filter(Boolean))]
      stockSummaries = await Promise.all(medicineIds.map((id) => stockService.getStockSummary(id)))
    }

    // Cria documento PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Desenha cabeçalho
    drawHeader(doc, title, new Date())

    // Desenha resumo de adesão
    drawAdherenceSummary(doc, adherenceSummary)

    // Prepara e desenha gráfico de adesão
    let currentY = Y_POSITIONS.chartStart
    if (includeCharts) {
      const chartData = prepareAdherenceChartData(dailyAdherence)
      const chartImage = chartData ? renderAdherenceChart(chartData, 500, 200) : null
      currentY = drawAdherenceChart(doc, chartImage, currentY)
    }

    // Desenha tabela de protocolos
    if (includeProtocols) {
      currentY = drawProtocolsTable(doc, protocols, autoTable, currentY)
    }

    // Desenha resumo de estoque
    if (includeStock) {
      const stockChartData = prepareStockChartData(protocols, stockSummaries)
      const stockChartImage =
        stockChartData.length > 0 ? renderStockChart(stockChartData, 500, 150) : null
      drawStockSummary(doc, stockChartData, stockChartImage, currentY)
    }

    // Desenha rodapé
    drawFooter(doc)

    // Gera Blob
    const pdfBlob = doc.output('blob')

    const totalDuration = Date.now() - startTime
    logPDF('info', 'PDF gerado com sucesso', {
      duration: `${totalDuration}ms`,
      blobSize: `${(pdfBlob.size / 1024).toFixed(2)}KB`,
      blobSizeMB: `${(pdfBlob.size / 1024 / 1024).toFixed(2)}MB`,
    })

    // Verifica tamanho do arquivo (<2MB)
    if (pdfBlob.size > 2 * 1024 * 1024) {
      logPDF('warn', 'PDF excede 2MB', {
        size: `${(pdfBlob.size / 1024 / 1024).toFixed(2)}MB`,
      })
    }

    return pdfBlob
  } catch (error) {
    logPDF('error', 'Erro ao gerar PDF', {
      error: error.message,
      stack: error.stack,
    })
    throw new Error(`Falha ao gerar relatório PDF: ${error.message}`)
  }
}

/**
 * Exporta todas as funções do módulo.
 */
export default {
  generatePDF,
}
