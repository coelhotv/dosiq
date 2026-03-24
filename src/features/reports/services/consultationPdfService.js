/**
 * @fileoverview Geracao do PDF de consulta medica.
 * Usa lazy import de jsPDF e jspdf-autotable para manter o first load leve.
 * @module features/reports/services/consultationPdfService
 */

import { buildConsultationPdfData } from './consultationPdfDataBuilder.js'

/**
 * Paleta do PDF.
 * @constant {Object}
 */
const COLORS = {
  primary: [15, 118, 110],
  primarySoft: [236, 253, 245],
  warning: [245, 158, 11],
  danger: [239, 68, 68],
  text: [30, 41, 59],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  surface: [248, 250, 252],
  white: [255, 255, 255],
}

/**
 * Dimensoes padrao da pagina A4.
 * @constant {Object}
 */
const PAGE = {
  width: 210,
  height: 297,
  margin: 12,
  contentWidth: 186,
}

/**
 * Regras visuais do cabecalho e rodape.
 * @constant {Object}
 */
const CHROME_LAYOUT = {
  headerLineY: 12,
  headerY: 8,
  headerBrandFontSize: 9,
  headerTitleFontSize: 8,
  headerTitleOffsetX: 34,
  headerTitleMaxWidth: 74,
  headerPatientMaxWidth: 60,
  footerLineOffsetY: 14,
  footerTextOffsetY: 8,
}

/**
 * Regras visuais dos cards de resumo.
 * @constant {Object}
 */
const KPI_LAYOUT = {
  valueOffsetY: 8,
  labelOffsetY: 14,
  metaOffsetY: 18,
  paddingX: 4,
  paddingY: 3,
  radius: 3,
  fontSizeValue: 13,
  fontSizeLabel: 8,
  fontSizeMeta: 7,
}

/**
 * Regras do hero de adesao.
 * @constant {Object}
 */
const HERO_LAYOUT = {
  x: 16,
  y: 51,
  size: 48,
}

/**
 * Regras dos cards do resumo.
 * @constant {Object}
 */
const SUMMARY_CARD_LAYOUT = {
  startX: 74,
  startY: 50,
  width: 38,
  height: 22,
  gap: 3,
  rowGap: 26,
}

/**
 * Regras do texto editorial na pagina de resumo.
 * @constant {Object}
 */
const SUMMARY_TEXT_LAYOUT = {
  topY: 114,
  columnGap: 6,
  leftColumnWidth: 88,
  rightColumnWidth: 92,
  bodyOffsetY: 6,
  bodyLineHeight: 4.2,
  attentionTopY: 148,
}

/**
 * Utilitario de cor RGB.
 * @param {Array<number>} rgb - Cor em RGB.
 * @returns {Array<number>} Cor segura.
 */
function rgb(rgb) {
  return Array.isArray(rgb) ? rgb : COLORS.text
}

function getScoreTone(score) {
  if (score < 50) return 'danger'
  if (score < 70) return 'warning'
  if (score < 85) return 'info'
  return 'success'
}

/**
 * Texto de periodo amigavel.
 * @param {string} period - Periodo bruto.
 * @returns {string} Label humano.
 */
function getPeriodLabel(period) {
  const labels = {
    '7d': 'ultimos 7 dias',
    '30d': 'ultimos 30 dias',
    '90d': 'ultimos 90 dias',
    all: 'todo o periodo disponivel',
  }

  return labels[period] || 'consulta atual'
}

/**
 * Desenha o cabecalho em todas as paginas.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} pdfData - Dados do PDF.
 * @param {number} pageNumber - Pagina atual.
 * @param {number} totalPages - Total de paginas.
 */
function drawPageChrome(doc, pdfData, pageNumber, totalPages) {
  doc.setDrawColor(...rgb(COLORS.line))
  doc.setLineWidth(0.2)
  doc.line(PAGE.margin, CHROME_LAYOUT.headerLineY, PAGE.width - PAGE.margin, CHROME_LAYOUT.headerLineY)

  doc.setFontSize(CHROME_LAYOUT.headerBrandFontSize)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Meus Remedios', PAGE.margin, CHROME_LAYOUT.headerY)

  const headerTitle = doc.splitTextToSize(pdfData.title, CHROME_LAYOUT.headerTitleMaxWidth)
  doc.setFontSize(CHROME_LAYOUT.headerTitleFontSize)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(headerTitle, PAGE.margin + CHROME_LAYOUT.headerTitleOffsetX, CHROME_LAYOUT.headerY)

  doc.setTextColor(...rgb(COLORS.muted))
  const patientName = doc.splitTextToSize(pdfData.patient.name || 'Paciente sem nome', CHROME_LAYOUT.headerPatientMaxWidth)
  doc.text(patientName, PAGE.width - PAGE.margin, CHROME_LAYOUT.headerY, { align: 'right' })

  doc.setDrawColor(...rgb(COLORS.line))
  doc.line(
    PAGE.margin,
    PAGE.height - CHROME_LAYOUT.footerLineOffsetY,
    PAGE.width - PAGE.margin,
    PAGE.height - CHROME_LAYOUT.footerLineOffsetY
  )

  doc.setFontSize(8)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(
    `Gerado em ${pdfData.generatedAtLabel} | Periodo: ${getPeriodLabel(pdfData.period)}`,
    PAGE.margin,
    PAGE.height - CHROME_LAYOUT.footerTextOffsetY
  )
  doc.text(`Pagina ${pageNumber}/${totalPages}`, PAGE.width - PAGE.margin, PAGE.height - CHROME_LAYOUT.footerTextOffsetY, {
    align: 'right',
  })
}

/**
 * Desenha um bloco de KPI.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} card - Dados do card.
 * @param {number} x - Posicao X.
 * @param {number} y - Posicao Y.
 * @param {number} width - Largura.
 * @param {number} height - Altura.
 */
function drawKpiCard(doc, card, x, y, width, height) {
  const toneMap = {
    success: COLORS.primarySoft,
    warning: [255, 251, 235],
    danger: [254, 242, 242],
    info: [239, 246, 255],
  }

  const toneColor = toneMap[card.tone] || toneMap.info
  const accentColor =
    card.tone === 'danger' ? COLORS.danger : card.tone === 'warning' ? COLORS.warning : COLORS.primary

  doc.setFillColor(...rgb(toneColor))
  doc.setDrawColor(...rgb(COLORS.line))
  doc.roundedRect(x, y, width, height, KPI_LAYOUT.radius, KPI_LAYOUT.radius, 'FD')

  doc.setFontSize(KPI_LAYOUT.fontSizeValue)
  doc.setTextColor(...rgb(accentColor))
  doc.text(card.value, x + KPI_LAYOUT.paddingX, y + KPI_LAYOUT.valueOffsetY)

  doc.setFontSize(KPI_LAYOUT.fontSizeLabel)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text(card.label, x + KPI_LAYOUT.paddingX, y + KPI_LAYOUT.labelOffsetY)

  doc.setFontSize(KPI_LAYOUT.fontSizeMeta)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(card.meta || '', x + KPI_LAYOUT.paddingX, y + KPI_LAYOUT.metaOffsetY)
}

function buildArcPath(centerX, centerY, radius, startAngle, endAngle) {
  const points = []
  const segments = Math.max(12, Math.ceil(Math.abs(endAngle - startAngle) / 10))
  const radiansPerDegree = Math.PI / 180
  const step = (endAngle - startAngle) / segments

  for (let index = 0; index <= segments; index += 1) {
    const angle = (startAngle + step * index) * radiansPerDegree
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    points.push(index === 0 ? { op: 'm', c: [x, y] } : { op: 'l', c: [x, y] })
  }

  return points
}

/**
 * Desenha o hero de adesao na pagina de resumo.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} pdfData - Dados do PDF.
 */
function drawHeroGauge(doc, pdfData) {
  const score = Math.max(0, Math.min(pdfData.adherence?.last30d?.score ?? 0, 100))
  const streak = pdfData.adherence?.currentStreak ?? 0
  const taken = pdfData.adherence?.last30d?.taken ?? 0
  const expected = pdfData.adherence?.last30d?.expected ?? 0
  const tone = getScoreTone(score)
  const centerX = HERO_LAYOUT.x + HERO_LAYOUT.size / 2
  const centerY = HERO_LAYOUT.y + HERO_LAYOUT.size / 2
  const radius = HERO_LAYOUT.size / 2 - 4
  const arcEnd = -90 + (score / 100) * 360
  const accentColor =
    tone === 'danger' ? COLORS.danger : tone === 'warning' ? COLORS.warning : COLORS.primary

  doc.setFillColor(...rgb(COLORS.white))
  doc.setDrawColor(...rgb(COLORS.line))
  doc.roundedRect(HERO_LAYOUT.x, HERO_LAYOUT.y, HERO_LAYOUT.size, HERO_LAYOUT.size, 6, 6, 'FD')

  doc.setDrawColor(...rgb(COLORS.line))
  doc.setLineWidth(4)
  if (typeof doc.circle === 'function') {
    doc.circle(centerX, centerY, radius, 'S')
  }

  if (score > 0 && typeof doc.path === 'function') {
    doc.setDrawColor(...rgb(accentColor))
    doc.setLineWidth(4)
    doc.setLineCap('round')
    doc.path(buildArcPath(centerX, centerY, radius, -90, arcEnd), 'S')
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...rgb(accentColor))
  doc.setFontSize(20)
  doc.text(`${score}%`, centerX, centerY + 2, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.setFont('helvetica', 'normal')
  doc.text('Adesao 30d', centerX, centerY + 9, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(...rgb(COLORS.primary))
  doc.text(`${taken}/${expected} doses`, centerX, HERO_LAYOUT.y + HERO_LAYOUT.size - 2, {
    align: 'center',
  })

  doc.setFontSize(7)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(`${streak} dias de sequencia`, centerX, HERO_LAYOUT.y + HERO_LAYOUT.size + 5, {
    align: 'center',
  })

  doc.setLineWidth(0.2)
}

/**
 * Desenha uma lista de alertas.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Array<Object>} items - Alertas sinteticos.
 * @param {number} x - Posicao X.
 * @param {number} y - Posicao Y.
 * @param {number} width - Largura.
 */
function drawAttentionList(doc, items, x, y, width) {
  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Atencao nesta consulta', x, y)

  let offsetY = y + 6
  const visibleItems = items.slice(0, 6)

  if (visibleItems.length === 0) {
    doc.setFontSize(8)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text('Nenhum alerta clinico relevante no momento.', x, offsetY)
    return
  }

  visibleItems.forEach((item) => {
    const toneColor = item.tone === 'danger' ? COLORS.danger : item.tone === 'warning' ? COLORS.warning : COLORS.primary
    doc.setFillColor(...rgb(item.tone === 'danger' ? [254, 242, 242] : item.tone === 'warning' ? [255, 251, 235] : [239, 246, 255]))
    doc.setDrawColor(...rgb(COLORS.line))
    doc.roundedRect(x, offsetY, width, 14, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(...rgb(toneColor))
    doc.text(item.label, x + 3, offsetY + 5)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text(item.detail, x + 3, offsetY + 10)
    offsetY += 16
  })
}

/**
 * Adiciona um bloco de resumo clinico na primeira pagina.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} pdfData - Dados normalizados do PDF.
 */
function renderSummaryPage(doc, pdfData) {
  doc.setFillColor(...rgb(COLORS.surface))
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  doc.setFontSize(18)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Resumo Clinico de Consulta', PAGE.margin, 26)

  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(`Periodo: ${getPeriodLabel(pdfData.period)}`, PAGE.margin, 33)
  doc.text(`Gerado em: ${pdfData.generatedAtLabel}`, PAGE.margin, 38)

  if (pdfData.patient.age !== null && pdfData.patient.age !== undefined) {
    doc.text(`Paciente: ${pdfData.patient.name} | ${pdfData.patient.age} anos`, PAGE.margin, 43)
  } else {
  doc.text(`Paciente: ${pdfData.patient.name}`, PAGE.margin, 43)
  }

  drawHeroGauge(doc, pdfData)

  const cards = pdfData.summaryCards
  cards.slice(0, 3).forEach((card, index) => {
    drawKpiCard(
      doc,
      card,
      SUMMARY_CARD_LAYOUT.startX + index * (SUMMARY_CARD_LAYOUT.width + SUMMARY_CARD_LAYOUT.gap),
      SUMMARY_CARD_LAYOUT.startY,
      SUMMARY_CARD_LAYOUT.width,
      SUMMARY_CARD_LAYOUT.height
    )
  })

  cards.slice(3, 6).forEach((card, index) => {
    drawKpiCard(
      doc,
      card,
      SUMMARY_CARD_LAYOUT.startX + index * (SUMMARY_CARD_LAYOUT.width + SUMMARY_CARD_LAYOUT.gap),
      SUMMARY_CARD_LAYOUT.startY + SUMMARY_CARD_LAYOUT.rowGap,
      SUMMARY_CARD_LAYOUT.width,
      SUMMARY_CARD_LAYOUT.height
    )
  })

  const executiveText = doc.splitTextToSize(
    'Resumo pensado para decisao rapida em consulta: tratamentos ativos, adesao recente, alertas de estoque, prescricoes e titulacoes.',
    SUMMARY_TEXT_LAYOUT.leftColumnWidth
  )
  const clinicalNotes = doc.splitTextToSize(
    pdfData.clinicalNotes.map((note) => `- ${note}`).join('\n'),
    SUMMARY_TEXT_LAYOUT.rightColumnWidth
  )

  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Mensagem executiva', PAGE.margin, SUMMARY_TEXT_LAYOUT.topY)
  doc.setFontSize(8)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(executiveText, PAGE.margin, SUMMARY_TEXT_LAYOUT.topY + SUMMARY_TEXT_LAYOUT.bodyOffsetY)

  const notesX = PAGE.margin + SUMMARY_TEXT_LAYOUT.leftColumnWidth + SUMMARY_TEXT_LAYOUT.columnGap
  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Notas clinicas', notesX, SUMMARY_TEXT_LAYOUT.topY)
  doc.setFontSize(8)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(clinicalNotes, notesX, SUMMARY_TEXT_LAYOUT.topY + SUMMARY_TEXT_LAYOUT.bodyOffsetY)

  const editorialHeight =
    Math.max(executiveText.length, clinicalNotes.length) * SUMMARY_TEXT_LAYOUT.bodyLineHeight
  const attentionTopY = Math.max(
    SUMMARY_TEXT_LAYOUT.attentionTopY,
    SUMMARY_TEXT_LAYOUT.topY + SUMMARY_TEXT_LAYOUT.bodyOffsetY + editorialHeight + 6
  )

  drawAttentionList(doc, pdfData.attentionItems, PAGE.margin, attentionTopY, 86)
}

/**
 * Renderiza uma tabela com cor por linha.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} options - Opcoes da tabela.
 */
function renderTable(autoTable, doc, options) {
  autoTable(doc, {
    startY: options.startY ?? 28,
    margin: { left: PAGE.margin, right: PAGE.margin },
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: COLORS.text,
      lineColor: COLORS.line,
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255],
    },
    ...options,
  })
}

/**
 * Renderiza a pagina de tratamentos.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} pdfData - Dados do PDF.
 */
function renderTreatmentsPage(doc, autoTable, pdfData) {
  doc.setFontSize(12)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Tratamentos ativos', PAGE.margin, 18)

  renderTable(autoTable, doc, {
    startY: 28,
    head: [['Tratamento', 'Apresentacao', 'Dose por tomada', 'Frequencia', 'Dose diaria', 'Status']],
    body: pdfData.activeTreatments.map((row) => [
      row.label,
      row.presentation,
      row.dosePerIntake,
      row.frequency,
      row.dailyDose,
      row.status,
    ]),
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 30 },
      2: { cellWidth: 36 },
      3: { cellWidth: 26 },
      4: { cellWidth: 24 },
      5: { cellWidth: 15 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 5) {
        hookData.cell.styles.textColor = COLORS.primary
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
  })
}

/**
 * Renderiza a pagina de adesao.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} pdfData - Dados do PDF.
 */
function renderAdherencePage(doc, autoTable, pdfData) {
  doc.setFontSize(12)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Adesao recente', PAGE.margin, 18)

  doc.setFontSize(9)
  doc.setTextColor(...rgb(COLORS.muted))
  const summary = pdfData.adherence.last30d
  doc.text(
    `30d: ${summary.score ?? 0}% | ${summary.taken ?? 0}/${summary.expected ?? 0} doses | Pontualidade ${summary.punctuality ?? 0}% | Sequencia ${summary.currentStreak ?? 0}d`,
    PAGE.margin,
    24
  )

  renderTable(autoTable, doc, {
    startY: 30,
    head: [['Data', 'Tomadas', 'Esperadas', 'Adesao', 'Leitura']],
    body: pdfData.adherence.trend7d.map((row) => [
      row.label,
      String(row.taken),
      String(row.expected),
      row.score === null ? 'Sem dados' : `${row.score}%`,
      row.status,
    ]),
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 86 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        const text = hookData.cell.raw || ''
        if (String(text).includes('100') || String(text).includes('90')) {
          hookData.cell.styles.textColor = COLORS.primary
        } else if (String(text).includes('Sem')) {
          hookData.cell.styles.textColor = COLORS.muted
        } else {
          hookData.cell.styles.textColor = COLORS.warning
        }
      }
    },
  })
}

/**
 * Renderiza a pagina de estoque.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} pdfData - Dados do PDF.
 */
function renderStockPage(doc, autoTable, pdfData) {
  doc.setFontSize(12)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Estoque', PAGE.margin, 18)

  doc.setFontSize(9)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text('Ordens por urgencia primeiro, para facilitar a decisao durante a consulta.', PAGE.margin, 24)

  if (pdfData.stockRows.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text('Nenhum alerta de estoque relevante.', PAGE.margin, 34)
    return
  }

  renderTable(autoTable, doc, {
    startY: 30,
    head: [['Tratamento', 'Qtd atual', 'Consumo/dia', 'Dias restantes', 'Status']],
    body: pdfData.stockRows.map((row) => [
      row.label,
      String(row.totalQuantity),
      String(row.dailyIntake),
      row.daysRemaining === null || row.daysRemaining === undefined ? '-' : String(row.daysRemaining),
      row.message,
    ]),
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 52 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const row = pdfData.stockRows[hookData.row.index]
        hookData.cell.styles.textColor =
          row.severity === 'critical' ? COLORS.danger : row.severity === 'warning' ? COLORS.warning : COLORS.primary
      }
    },
  })

}

/**
 * Renderiza a pagina de prescricoes.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} pdfData - Dados do PDF.
 */
function renderPrescriptionPage(doc, autoTable, pdfData) {
  doc.addPage()
  doc.setFontSize(12)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Prescricoes', PAGE.margin, 18)

  if (pdfData.prescriptionRows.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text('Nenhuma prescricao com vencimento ativo no periodo.', PAGE.margin, 28)
    return
  }

  renderTable(autoTable, doc, {
    startY: 28,
    head: [['Tratamento', 'Status', 'Dias', 'Vencimento']],
    body: pdfData.prescriptionRows.map((row) => [
      row.label,
      row.statusLabel,
      row.daysRemaining === null || row.daysRemaining === undefined ? '-' : String(row.daysRemaining),
      row.endDate || '-',
    ]),
    columnStyles: {
      0: { cellWidth: 92 },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 40, halign: 'center' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const row = pdfData.prescriptionRows[hookData.row.index]
        hookData.cell.styles.textColor =
          row.status === 'vencida' ? COLORS.danger : row.status === 'vencendo' ? COLORS.warning : COLORS.primary
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
  })
}

/**
 * Renderiza a pagina de titulacoes e notas clinicas.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} pdfData - Dados do PDF.
 */
function renderTitrationPage(doc, autoTable, pdfData) {
  doc.setFontSize(12)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Titulacao e contexto clinico', PAGE.margin, 18)

  renderTable(autoTable, doc, {
    startY: 28,
    head: [['Tratamento', 'Progresso', 'Etapa', 'Transicao', 'Nota']],
    body: pdfData.titrationRows.map((row) => [
      row.label,
      `${row.progressPercent}%`,
      `${row.currentStep}/${row.totalSteps}`,
      row.isTransitionDue ? 'Pendente' : 'Nao',
      row.stageNote,
    ]),
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 58 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        const row = pdfData.titrationRows[hookData.row.index]
        hookData.cell.styles.textColor = row.isTransitionDue ? COLORS.warning : COLORS.primary
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
  })
}

/**
 * Gera o PDF de consulta medica.
 * @param {Object} options - Opcoes de geracao.
 * @param {Object} options.consultationData - Dados consolidados do modo consulta.
 * @param {Object} options.dashboardData - Dados brutos do dashboard.
 * @param {string} [options.period='30d'] - Periodo do relatorio.
 * @param {string} [options.title='Meus Remedios - Consulta Medica'] - Titulo do documento.
 * @returns {Promise<Blob>} Blob do PDF.
 */
export async function generateConsultationPDF(options = {}) {
  const {
    consultationData,
    dashboardData,
    period = '30d',
    title = 'Meus Remedios - Consulta Medica',
  } = options

  const pdfData = buildConsultationPdfData({
    consultationData,
    dashboardData,
    period,
    generatedAt: new Date(),
    title,
  })

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  doc.setProperties({
    title: pdfData.title,
    subject: 'Consulta medica',
    author: 'Meus Remedios',
    creator: 'Meus Remedios',
  })

  renderSummaryPage(doc, pdfData)
  doc.addPage()
  renderTreatmentsPage(doc, autoTable, pdfData)
  doc.addPage()
  renderAdherencePage(doc, autoTable, pdfData)
  if (pdfData.stockRows.length > 0 || pdfData.prescriptionRows.length > 0) {
    doc.addPage()
    renderStockPage(doc, autoTable, pdfData)
    if (pdfData.prescriptionRows.length > 0) {
      renderPrescriptionPage(doc, autoTable, pdfData)
    }
  }

  if (pdfData.titrationRows.length > 0) {
    doc.addPage()
    renderTitrationPage(doc, autoTable, pdfData)
  }

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    drawPageChrome(doc, pdfData, page, totalPages)
  }

  return doc.output('blob')
}

export default {
  generateConsultationPDF,
}
