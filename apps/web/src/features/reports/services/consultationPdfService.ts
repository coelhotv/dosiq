/**
 * @fileoverview Geracao do PDF de consulta medica.
 * Usa lazy import de jsPDF e jspdf-autotable para manter o first load leve.
 * @module features/reports/services/consultationPdfService
 */

import { buildConsultationPdfData } from './consultationPdfDataBuilder'
import { getNow } from '@utils/dateUtils'

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
  topY: 112,
  columnGap: 10,
  leftColumnWidth: 88,
  rightColumnWidth: 88,
  cardPaddingX: 4,
  cardPaddingTop: 6,
  bodyOffsetY: 11,
  bodyLineHeight: 4.2,
  attentionTopY: 162,
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
    '7d': 'últimos 7 dias',
    '30d': 'últimos 30 dias',
    '90d': 'últimos 90 dias',
    all: 'todo o período disponível',
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
  doc.line(
    PAGE.margin,
    CHROME_LAYOUT.headerLineY,
    PAGE.width - PAGE.margin,
    CHROME_LAYOUT.headerLineY
  )

  doc.setFontSize(CHROME_LAYOUT.headerBrandFontSize)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Dosiq', PAGE.margin, CHROME_LAYOUT.headerY)

  const headerTitle = doc.splitTextToSize(pdfData.title, CHROME_LAYOUT.headerTitleMaxWidth)
  doc.setFontSize(CHROME_LAYOUT.headerTitleFontSize)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(headerTitle, PAGE.margin + CHROME_LAYOUT.headerTitleOffsetX, CHROME_LAYOUT.headerY)

  doc.setTextColor(...rgb(COLORS.muted))
  const patientName = doc.splitTextToSize(
    pdfData.patient.name || 'Paciente sem nome',
    CHROME_LAYOUT.headerPatientMaxWidth
  )
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
    `Gerado em ${pdfData.generatedAtLabel} | Período: ${getPeriodLabel(pdfData.period)}`,
    PAGE.margin,
    PAGE.height - CHROME_LAYOUT.footerTextOffsetY
  )
  doc.text(
    `Página ${pageNumber}/${totalPages}`,
    PAGE.width - PAGE.margin,
    PAGE.height - CHROME_LAYOUT.footerTextOffsetY,
    {
      align: 'right',
    }
  )
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
  const accentColor = _resolveAccentColor(card.tone)

  doc.setFillColor(...rgb(toneColor))
  doc.setDrawColor(...rgb(COLORS.line))
  doc.roundedRect(x, y, width, height, KPI_LAYOUT.radius, KPI_LAYOUT.radius, 'FD')

  doc.setFontSize(KPI_LAYOUT.fontSizeValue)
  doc.setTextColor(...rgb(accentColor))
  doc.text(pdfSafe(card.value), x + KPI_LAYOUT.paddingX, y + KPI_LAYOUT.valueOffsetY)

  doc.setFontSize(KPI_LAYOUT.fontSizeLabel)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text(pdfSafe(card.label), x + KPI_LAYOUT.paddingX, y + KPI_LAYOUT.labelOffsetY)

  doc.setFontSize(KPI_LAYOUT.fontSizeMeta)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(pdfSafe(card.meta), x + KPI_LAYOUT.paddingX, y + KPI_LAYOUT.metaOffsetY)
}

/**
 * Resolve a cor de destaque baseada no tone do score.
 * @param {string} tone - 'danger' | 'warning' | outro
 * @returns {Array<number>} Cor RGB
 */
function _resolveAccentColor(tone) {
  if (tone === 'danger') return COLORS.danger
  if (tone === 'warning') return COLORS.warning
  return COLORS.primary
}

function drawArcSegments(doc, centerX, centerY, radius, startAngle, endAngle) {
  const segments = Math.max(20, Math.ceil(Math.abs(endAngle - startAngle) / 6))
  const radiansPerDegree = Math.PI / 180
  const step = (endAngle - startAngle) / segments

  for (let index = 0; index < segments; index += 1) {
    const start = (startAngle + step * index) * radiansPerDegree
    const end = (startAngle + step * (index + 1)) * radiansPerDegree
    const startX = centerX + radius * Math.cos(start)
    const startY = centerY + radius * Math.sin(start)
    const endX = centerX + radius * Math.cos(end)
    const endY = centerY + radius * Math.sin(end)
    doc.line(startX, startY, endX, endY)
  }
}

/**
 * Desenha o hero de adesao na pagina de resumo.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} pdfData - Dados do PDF.
 */
function drawHeroGauge(doc, pdfData) {
  const selectedPeriodSummary =
    pdfData.adherence?.selectedPeriod || pdfData.adherence?.last30d || {}
  const score = Math.max(0, Math.min(selectedPeriodSummary.score ?? 0, 100))
  const streak = pdfData.adherence?.currentStreak ?? 0
  const taken = selectedPeriodSummary.taken ?? 0
  const expected = selectedPeriodSummary.expected ?? 0
  const periodLabel = selectedPeriodSummary.label || '30 dias'
  const tone = getScoreTone(score)
  const centerX = HERO_LAYOUT.x + HERO_LAYOUT.size / 2
  const centerY = HERO_LAYOUT.y + HERO_LAYOUT.size / 2
  const radius = HERO_LAYOUT.size / 2 - 4
  const arcEnd = -90 + (score / 100) * 360
  const accentColor = _resolveAccentColor(tone)

  doc.setFillColor(...rgb(COLORS.white))
  doc.setDrawColor(...rgb(COLORS.line))
  doc.roundedRect(HERO_LAYOUT.x, HERO_LAYOUT.y, HERO_LAYOUT.size, HERO_LAYOUT.size, 6, 6, 'FD')

  doc.setDrawColor(...rgb(COLORS.line))
  doc.setLineWidth(4)
  if (typeof doc.circle === 'function') {
    doc.circle(centerX, centerY, radius, 'S')
  }

  if (score > 0) {
    doc.setDrawColor(...rgb(accentColor))
    doc.setLineWidth(4.4)
    if (typeof doc.setLineCap === 'function') {
      doc.setLineCap('round')
    }
    drawArcSegments(doc, centerX, centerY, radius, -90, arcEnd)
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...rgb(accentColor))
  doc.setFontSize(20)
  doc.text(`${score}%`, centerX, centerY + 2, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.setFont('helvetica', 'normal')
  doc.text(`Adesão ${periodLabel}`, centerX, centerY + 9, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(...rgb(COLORS.primary))
  doc.text(`${taken}/${expected} doses`, centerX, HERO_LAYOUT.y + HERO_LAYOUT.size - 2, {
    align: 'center',
  })

  doc.setFontSize(7)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(`${streak} dias de sequência`, centerX, HERO_LAYOUT.y + HERO_LAYOUT.size + 5, {
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
  doc.text('Atenção nesta consulta', x, y)

  let offsetY = y + 6
  const visibleItems = items.slice(0, 6)

  if (visibleItems.length === 0) {
    doc.setFontSize(8)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text('Nenhum alerta clínico relevante no momento.', x, offsetY)
    return
  }

  visibleItems.forEach((item) => {
    const toneColor =
      item.tone === 'danger'
        ? COLORS.danger
        : item.tone === 'warning'
          ? COLORS.warning
          : COLORS.primary
    doc.setFillColor(
      ...rgb(
        item.tone === 'danger'
          ? [254, 242, 242]
          : item.tone === 'warning'
            ? [255, 251, 235]
            : [239, 246, 255]
      )
    )
    doc.setDrawColor(...rgb(COLORS.line))
    doc.roundedRect(x, offsetY, width, 14, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(...rgb(toneColor))
    doc.text(pdfSafe(item.label), x + 3, offsetY + 5)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text(pdfSafe(item.detail), x + 3, offsetY + 10)
    offsetY += 16
  })
}

/**
 * Desenha linha de KPI cards de resumo (uma fileira de até 3 cards).
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Array} cards - Subset de cards a desenhar.
 * @param {number} rowY - Posicao Y da fileira.
 */
function _drawKpiCardRow(doc, cards, rowY) {
  cards.forEach((card, index) => {
    drawKpiCard(
      doc,
      card,
      SUMMARY_CARD_LAYOUT.startX + index * (SUMMARY_CARD_LAYOUT.width + SUMMARY_CARD_LAYOUT.gap),
      rowY,
      SUMMARY_CARD_LAYOUT.width,
      SUMMARY_CARD_LAYOUT.height
    )
  })
}

/**
 * Desenha coluna de texto editorial (mensagem executiva e notas clinicas).
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} pdfData - Dados do PDF.
 * @param {number} notesX - Posicao X da coluna de notas.
 * @param {number} editorialHeight - Altura dos blocos editoriais.
 * @param {string[]} executiveText - Texto da mensagem executiva (splitado).
 * @param {string[]} clinicalNotes - Texto das notas clinicas (splitado).
 */
function _drawEditorialSection(doc, pdfData, notesX, editorialHeight, executiveText, clinicalNotes) {
  doc.setFillColor(...rgb(COLORS.white))
  doc.setDrawColor(...rgb(COLORS.line))
  doc.roundedRect(PAGE.margin, SUMMARY_TEXT_LAYOUT.topY, SUMMARY_TEXT_LAYOUT.leftColumnWidth, editorialHeight, 4, 4, 'FD')
  doc.roundedRect(notesX, SUMMARY_TEXT_LAYOUT.topY, SUMMARY_TEXT_LAYOUT.rightColumnWidth, editorialHeight, 4, 4, 'FD')

  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Mensagem executiva', PAGE.margin + SUMMARY_TEXT_LAYOUT.cardPaddingX, SUMMARY_TEXT_LAYOUT.topY + SUMMARY_TEXT_LAYOUT.cardPaddingTop)
  doc.setFontSize(8)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.setFont('helvetica', 'normal')
  doc.text(executiveText, PAGE.margin + SUMMARY_TEXT_LAYOUT.cardPaddingX, SUMMARY_TEXT_LAYOUT.topY + SUMMARY_TEXT_LAYOUT.bodyOffsetY)

  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.text))
  doc.text('Notas clínicas', notesX + SUMMARY_TEXT_LAYOUT.cardPaddingX, SUMMARY_TEXT_LAYOUT.topY + SUMMARY_TEXT_LAYOUT.cardPaddingTop)
  doc.setFontSize(8)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.setFont('helvetica', 'normal')
  doc.text(clinicalNotes, notesX + SUMMARY_TEXT_LAYOUT.cardPaddingX, SUMMARY_TEXT_LAYOUT.topY + SUMMARY_TEXT_LAYOUT.bodyOffsetY)
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
  doc.text('Resumo clínico de consulta', PAGE.margin, 26)

  doc.setFontSize(10)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(`Período: ${getPeriodLabel(pdfData.period)}`, PAGE.margin, 33)
  doc.text(`Gerado em: ${pdfData.generatedAtLabel}`, PAGE.margin, 38)

  const patientLine = pdfData.patient.age != null
    ? `Paciente: ${pdfData.patient.name} | ${pdfData.patient.age} anos`
    : `Paciente: ${pdfData.patient.name}`
  doc.text(patientLine, PAGE.margin, 43)

  drawHeroGauge(doc, pdfData)
  _drawKpiCardRow(doc, pdfData.summaryCards.slice(0, 3), SUMMARY_CARD_LAYOUT.startY)
  _drawKpiCardRow(doc, pdfData.summaryCards.slice(3, 6), SUMMARY_CARD_LAYOUT.startY + SUMMARY_CARD_LAYOUT.rowGap)

  const executiveText = doc.splitTextToSize(
    'Resumo para decisão rápida em consulta: tratamentos vigentes, adesão recente, alertas de estoque, receitas a renovar e titulações.',
    SUMMARY_TEXT_LAYOUT.leftColumnWidth - SUMMARY_TEXT_LAYOUT.cardPaddingX * 2 - 4
  )
  // pdfSafe ANTES do split: `splitTextToSize` devolve ARRAY, e sanitizar o array o
  // transformaria numa string com vírgulas.
  const clinicalNotes = doc.splitTextToSize(
    pdfSafe(pdfData.clinicalNotes.map((note) => `- ${note}`).join('\n')),
    SUMMARY_TEXT_LAYOUT.rightColumnWidth - SUMMARY_TEXT_LAYOUT.cardPaddingX * 2 - 4
  )
  const notesX = PAGE.margin + SUMMARY_TEXT_LAYOUT.leftColumnWidth + SUMMARY_TEXT_LAYOUT.columnGap
  const editorialHeight =
    Math.max(executiveText.length, clinicalNotes.length) * SUMMARY_TEXT_LAYOUT.bodyLineHeight +
    SUMMARY_TEXT_LAYOUT.cardPaddingTop + 8

  _drawEditorialSection(doc, pdfData, notesX, editorialHeight, executiveText, clinicalNotes)

  const attentionTopY = Math.max(SUMMARY_TEXT_LAYOUT.attentionTopY, SUMMARY_TEXT_LAYOUT.topY + editorialHeight + 8)
  drawAttentionList(doc, pdfData.attentionItems, PAGE.margin, attentionTopY, 86)
}

/**
 * Renderiza uma tabela com cor por linha.
 * @param {Object} autoTable - Funcao autoTable.
 * @param {Object} doc - Instancia do jsPDF.
 * @param {Object} options - Opcoes da tabela.
 */
/**
 * Texto seguro para as fontes padrão do jsPDF.
 *
 * 🔴 Smoke do PO (2026-08-22): as fontes padrão (Helvetica) codificam em **WinAnsi/cp1252**,
 * que cobre TODO o acento do português — mas NÃO cobre sinais tipográficos fora dele. O "≈"
 * (U+2248) que o formatador de dose do core usa saía no PDF como `("H`: sujeira no meio da
 * dose, exatamente na informação mais crítica do documento.
 *
 * Em vez de embutir uma fonte UTF-8 (~300KB de bundle para um caractere), o texto é traduzido
 * na fronteira do PDF: "≈" vira "~" (mesma leitura, dentro do cp1252) e qualquer outro
 * caractere fora do conjunto é descartado — melhor a ausência que a sujeira (decisão do PO).
 *
 * ⚠️ O core NÃO muda: na tela o "≈" renderiza certo. Quem tem a limitação é o PDF.
 *
 * @param {*} value
 * @returns {string}
 */
function pdfSafe(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/[≈∼]/g, '~')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Latin-1 imprimível + os poucos extras do cp1252 que já saem corretos (bullet,
    // reticências), mais os controles que o layout usa (\n, \t).
    .replace(/[^\u0020-\u007E\u00A0-\u00FF\n\t•…]/g, '')
}

function renderTable(autoTable, doc, options) {
  const safeRows = (rows) =>
    Array.isArray(rows) ? rows.map((row) => row.map((cell) => pdfSafe(cell))) : rows
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
    head: safeRows(options.head),
    body: safeRows(options.body),
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
  doc.text('Tratamentos vigentes', PAGE.margin, 18)

  renderTable(autoTable, doc, {
    startY: 28,
    head: [
      ['Tratamento', 'Apresentação', 'Dose por tomada', 'Frequência', 'Dose diária', 'Status'],
    ],
    body: pdfData.activeTreatments.map((row) => [
      row.label,
      row.presentation,
      row.dosePerIntake,
      row.frequency,
      row.dailyDose,
      row.status,
    ]),
    // Larguras revistas no smoke do PO: a coluna de dose estourava e o jsPDF esticava o texto
    // caractere a caractere ("2 , 4  m g"). Soma = 186mm = contentWidth.
    columnStyles: {
      0: { cellWidth: 46 },
      1: { cellWidth: 24 },
      2: { cellWidth: 35 },
      3: { cellWidth: 31 },
      4: { cellWidth: 25 },
      5: { cellWidth: 17 },
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
  doc.text('Adesão recente', PAGE.margin, 18)

  doc.setFontSize(9)
  doc.setTextColor(...rgb(COLORS.muted))
  const summary = pdfData.adherence.selectedPeriod || pdfData.adherence.last30d
  doc.text(
    `${pdfData.adherence.trendLabel}: ${summary.score ?? 0}% | ${summary.taken ?? 0}/${summary.expected ?? 0} doses | Pontualidade ${summary.punctuality ?? 0}% | Sequência ${summary.currentStreak ?? 0}d`,
    PAGE.margin,
    24
  )

  renderTable(autoTable, doc, {
    startY: 30,
    head: [['Data', 'Tomadas', 'Esperadas', 'Adesão', 'Leitura']],
    body: pdfData.adherence.trend.map((row) => [
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
        const text = String(hookData.cell.raw || '')
        const score = Number.parseInt(text, 10)

        if (text.includes('Sem')) {
          hookData.cell.styles.textColor = COLORS.muted
        } else if (Number.isFinite(score) && score <= 50) {
          hookData.cell.styles.textColor = COLORS.danger
        } else if (Number.isFinite(score) && score >= 90) {
          hookData.cell.styles.textColor = COLORS.primary
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

  // 044/US3: usuário em modo dose-only — UMA linha honesta, sem tabela e sem "0 dias" fantasma.
  if (pdfData.stockTrackingEnabled === false) {
    doc.setFontSize(9)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text('Estoque: não controlado pelo paciente.', PAGE.margin, 26)
    return
  }

  doc.setFontSize(9)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(
    'Ordenado por urgência, para facilitar a decisão durante a consulta.',
    PAGE.margin,
    24
  )

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
      // 073/F-19: quantidade e consumo já vêm formatados COM unidade do builder.
      row.totalQuantityLabel ?? String(row.totalQuantity),
      row.dailyIntakeLabel ?? String(row.dailyIntake),
      row.daysRemaining === null || row.daysRemaining === undefined
        ? '-'
        : String(row.daysRemaining),
      row.message,
    ]),
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 48 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const row = pdfData.stockRows[hookData.row.index]
        hookData.cell.styles.textColor =
          row.severity === 'critical'
            ? COLORS.danger
            : row.severity === 'warning'
              ? COLORS.warning
              : COLORS.primary
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
  // 073/AC-11 (decisão D24): a seção lista ALERTAS (vencidas e vencendo), não o
  // conjunto das receitas — o título antigo fazia ausência de linha parecer
  // ausência de prescrição.
  doc.text('Receitas a renovar', PAGE.margin, 18)

  if (pdfData.prescriptionRows.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text('Nenhuma receita com vencimento no período.', PAGE.margin, 28)
    return
  }

  renderTable(autoTable, doc, {
    startY: 28,
    head: [['Tratamento', 'Status', 'Dias', 'Vencimento']],
    body: pdfData.prescriptionRows.map((row) => [
      row.label,
      row.statusLabel,
      // 073/F-21: "vencida há 3 dias" no lugar de "-3"; data em dd/mm/aaaa.
      row.daysLabel ?? '-',
      row.endDateLabel ?? '-',
    ]),
    columnStyles: {
      0: { cellWidth: 86 },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 36, halign: 'center' },
      3: { cellWidth: 28, halign: 'center' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const row = pdfData.prescriptionRows[hookData.row.index]
        hookData.cell.styles.textColor =
          row.status === 'vencida'
            ? COLORS.danger
            : row.status === 'vencendo'
              ? COLORS.warning
              : COLORS.primary
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
  doc.text('Titulação e contexto clínico', PAGE.margin, 18)

  doc.setFontSize(9)
  doc.setTextColor(...rgb(COLORS.muted))
  doc.text(
    'Escada percorrida por tratamento: de quanto para quanto, em quantos degraus e em quanto tempo.',
    PAGE.margin,
    24
  )

  let cursorY = 32

  for (const row of pdfData.titrationRows) {
    // Cabeçalho do bloco + pelo menos duas linhas de tabela precisam caber; senão, página nova.
    if (cursorY > PAGE.height - 60) {
      doc.addPage()
      cursorY = 20
    }

    doc.setFontSize(10)
    doc.setTextColor(...rgb(COLORS.text))
    doc.text(pdfSafe(row.label), PAGE.margin, cursorY)

    doc.setFontSize(8)
    doc.setTextColor(...rgb(COLORS.muted))
    doc.text(pdfSafe(row.stageNote), PAGE.margin, cursorY + 5)

    const ladder = Array.isArray(row.ladder) ? row.ladder : []
    if (ladder.length === 0) {
      cursorY += 14
      continue
    }

    renderTable(autoTable, doc, {
      startY: cursorY + 9,
      head: [['Degrau', 'Dose', 'Duração', 'Período', 'Situação']],
      body: ladder.map((step) => [
        `Etapa ${step.position}`,
        step.doseLabel,
        step.durationLabel,
        step.periodLabel,
        step.statusLabel,
      ]),
      // Soma 152mm (contentWidth é 186): a escada não precisa da largura toda, e folga evita
      // o autoTable encolher texto (foi o que produziu "2 , 4  m g" na tabela da página 2).
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 44 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 44, halign: 'center' },
        4: { cellWidth: 26 },
      },
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return
        // O degrau vigente é o que decide a conduta: ele vem destacado, como na timeline do app.
        if (ladder[hookData.row.index]?.isCurrent) {
          hookData.cell.styles.fontStyle = 'bold'
          hookData.cell.styles.textColor = COLORS.primary
        }
      },
    })

    cursorY = (doc.lastAutoTable?.finalY ?? cursorY + 20) + 12
  }
}

/**
 * Gera o PDF de consulta medica.
 * @param {Object} options - Opcoes de geracao.
 * @param {Object} options.consultationData - Dados consolidados do modo consulta.
 * @param {Object} options.dashboardData - Dados brutos do dashboard.
 * @param {string} [options.period='30d'] - Periodo do relatorio.
 * @param {string} [options.title='Dosiq - Consulta Médica'] - Titulo do documento.
 * @returns {Promise<Blob>} Blob do PDF.
 */
export async function generateConsultationPDF(options: any = {}) {
  const {
    consultationData,
    dashboardData,
    period = '30d',
    title = 'Dosiq - Consulta Médica',
  } = options

  const pdfData = buildConsultationPdfData({
    consultationData,
    dashboardData,
    period,
    generatedAt: getNow(),
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
    subject: 'Consulta médica',
    author: 'Dosiq',
    creator: 'Dosiq',
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

  // 073/F-24: este gate é de EXISTÊNCIA de escada, não de progresso. Ele sempre foi escrito
  // assim, mas o extrator a montante descartava quem estava em manutenção — então, na prática,
  // ele barrava justamente o paciente que TERMINOU de titular. A correção mora no extrator
  // (`consultationDataService._extractActiveTitrations`); aqui só o comentário muda.
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
