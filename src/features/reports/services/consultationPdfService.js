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
 * Utilitario de cor RGB.
 * @param {Array<number>} rgb - Cor em RGB.
 * @returns {Array<number>} Cor segura.
 */
function rgb(rgb) {
  return Array.isArray(rgb) ? rgb : COLORS.text
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

  const cards = pdfData.summaryCards
  const cardWidth = 58
  const cardHeight = 22
  const gap = 4
  const startX = PAGE.margin
  const startY = 50

  cards.slice(0, 3).forEach((card, index) => {
    drawKpiCard(doc, card, startX + index * (cardWidth + gap), startY, cardWidth, cardHeight)
  })

  cards.slice(3, 6).forEach((card, index) => {
    drawKpiCard(doc, card, startX + index * (cardWidth + gap), startY + 26, cardWidth, cardHeight)
  })

  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Mensagem executiva', PAGE.margin, 104)
  doc.setFontSize(8)
  doc.setTextColor(...rgb(COLORS.muted))
  const executiveText = doc.splitTextToSize(
    'Este documento resume os tratamentos em curso, a adesao recente, alertas de estoque, validade de prescricoes e titulacoes ativas. Ele foi desenhado para ser util tanto na consulta quanto no acompanhamento do paciente.',
    PAGE.contentWidth
  )
  doc.text(executiveText, PAGE.margin, 110)

  const columnWidth = 86
  drawAttentionList(doc, pdfData.attentionItems, PAGE.margin, 132, columnWidth)

  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Notas clinicas', PAGE.width - PAGE.margin - columnWidth, 104)
  doc.setFontSize(8)
  doc.setTextColor(...rgb(COLORS.muted))
  const clinicalNotes = pdfData.clinicalNotes
    .map((note) => `- ${note}`)
    .join('\n')
  doc.text(doc.splitTextToSize(clinicalNotes, columnWidth), PAGE.width - PAGE.margin - columnWidth, 112)
}

/**
 * Renderiza uma tabela com cor por linha.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} options - Opcoes da tabela.
 */
function renderTable(autoTable, doc, options) {
  autoTable(doc, {
    startY: 22,
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
    `30d: ${summary.score ?? 0}% | ${summary.taken ?? 0}/${summary.expected ?? 0} doses | Pontualidade ${summary.punctuality ?? 0}%`,
    PAGE.margin,
    24
  )

  renderTable(autoTable, doc, {
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
 * Renderiza a pagina operacional com estoque e prescricoes.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} pdfData - Dados do PDF.
 */
function renderOperationalPage(doc, autoTable, pdfData) {
  doc.setFontSize(12)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Estoque e prescricoes', PAGE.margin, 18)

  doc.setFontSize(9)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text('Ordens por urgencia primeiro, para facilitar a decisao durante a consulta.', PAGE.margin, 24)

  renderTable(autoTable, doc, {
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

  doc.addPage()
  doc.setFontSize(12)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Prescricoes', PAGE.margin, 18)

  renderTable(autoTable, doc, {
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

  if (pdfData.titrationRows.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text('Nenhuma titulacao ativa no momento.', PAGE.margin, 26)
  } else {
    renderTable(autoTable, doc, {
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

  doc.addPage()
  doc.setFontSize(12)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Observacoes clinicas', PAGE.margin, 18)

  doc.setFontSize(9)
  doc.setTextColor(...rgb(COLORS.muted))
  const notes = [
    `Paciente: ${pdfData.patient.name}`,
    ...pdfData.clinicalNotes,
  ].join('\n')
  doc.text(doc.splitTextToSize(notes, PAGE.contentWidth), PAGE.margin, 26)
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
  doc.addPage()
  renderOperationalPage(doc, autoTable, pdfData)

  if (pdfData.titrationRows.length > 0 || pdfData.clinicalNotes.length > 0) {
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
