/**
 * Export Service - Exportação de dados em CSV e JSON
 *
 * @module exportService
 * @description Serviço para exportação de dados do usuário em formatos CSV e JSON.
 * Suporta exportação de medicamentos, protocolos, registros de dose e estoque.
 *
 * REGRAS SEGUIDAS:
 * - R-020: Usa parseLocalDate() para manipulação de datas
 * - R-050: JSDoc em português
 */

import { protocolService } from '@features/protocols/services/protocolService'
import { logService } from '@shared/services/api/logService'
import { medicineService } from '@features/medications/services/medicineService'
import { formatLocalDate, parseLocalDate, getNow, parseISO, getServerTimestamp } from '@utils/dateUtils'

/** Versão do formato de exportação */
const EXPORT_VERSION = '1.0.0'

/** BOM UTF-8 para compatibilidade com Excel */
const UTF8_BOM = '\uFEFF'

/**
 * Sanitiza valor para prevenir injeção de fórmulas em CSV
 * Prefixa caracteres perigosos (=, +, -, @) com tabulação
 *
 * @param {string|number|null} value - Valor a ser sanitizado
 * @returns {string} Valor sanitizado
 */
function sanitizeCSVValue(value) {
  if (value === null || value === undefined) {
    return ''
  }

  const strValue = String(value)

  // Previne injeção de fórmulas Excel prefixando com tab
  if (
    strValue.startsWith('=') ||
    strValue.startsWith('+') ||
    strValue.startsWith('-') ||
    strValue.startsWith('@')
  ) {
    return '\t' + strValue
  }

  return strValue
}

/**
 * Escapa valor para CSV (aspas e quebras de linha)
 *
 * @param {string|number|null} value - Valor a ser escapado
 * @returns {string} Valor escapado para CSV
 */
function escapeCSVField(value) {
  if (value === null || value === undefined) {
    return ''
  }

  const sanitized = sanitizeCSVValue(value)
  const strValue = String(sanitized)

  // Se contém ponto e vírgula, aspas ou quebra de linha, envolve em aspas
  if (
    strValue.includes(';') ||
    strValue.includes('"') ||
    strValue.includes('\n') ||
    strValue.includes('\r')
  ) {
    return '"' + strValue.replace(/"/g, '""') + '"'
  }

  return strValue
}

/**
 * Formata data para exibição no CSV/JSON
 *
 * @param {string} dateStr - String de data ISO
 * @returns {string} Data formatada (DD/MM/YYYY HH:MM)
 */
function formatDateTime(dateStr) {
  if (!dateStr) return ''

  const date = parseISO(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

/**
 * Formata data apenas (sem hora)
 *
 * @param {string} dateStr - String de data ISO ou YYYY-MM-DD
 * @returns {string} Data formatada (DD/MM/YYYY)
 */
function formatDateOnly(dateStr) {
  if (!dateStr) return ''

  // Usa parseLocalDate para evitar problemas de timezone (R-020)
  const date = parseLocalDate(dateStr.slice(0, 10))
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

/**
 * Converte array de objetos para CSV
 *
 * @param {Array<Object>} data - Array de objetos
 * @param {Array<Object>} headers - Configuração de cabeçalhos {key, label}
 * @returns {string} Conteúdo CSV
 */
function arrayToCSV(data, headers) {
  // Linha de cabeçalhos
  const headerLine = headers.map((h) => escapeCSVField(h.label)).join(';')

  // Se não há dados, retorna apenas cabeçalhos
  if (!data || data.length === 0) {
    return headerLine
  }

  // Linhas de dados
  const dataLines = data.map((item) => {
    return headers
      .map((h) => {
        const value = h.transform ? h.transform(item[h.key], item) : item[h.key]
        return escapeCSVField(value)
      })
      .join(';')
  })

  return [headerLine, ...dataLines].join('\n')
}

/**
 * Faz download de arquivo no navegador
 *
 * @param {string} content - Conteúdo do arquivo
 * @param {string} filename - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Gera nome de arquivo com timestamp
 *
 * @param {string} prefix - Prefixo do nome
 * @param {string} extension - Extensão do arquivo
 * @returns {string} Nome do arquivo
 */
function generateFilename(prefix, extension) {
  const now = getNow()
  const timestamp = formatLocalDate(now).replace(/-/g, '')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  return `${prefix}_${timestamp}_${time}.${extension}`
}

/**
 * Exporta medicamentos como CSV
 *
 * @param {Array} medicines - Lista de medicamentos
 * @returns {string} Conteúdo CSV
 */
function exportMedicinesCSV(medicines) {
  const headers = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome do Medicamento' },
    { key: 'dosage_mg', label: 'Dosagem (mg)' },
    { key: 'pill_count', label: 'Comprimidos por Dose' },
    { key: 'instructions', label: 'Instruções' },
    { key: 'created_at', label: 'Data de Cadastro', transform: formatDateTime },
  ]

  return arrayToCSV(medicines, headers)
}

/**
 * Exporta protocolos como CSV
 *
 * @param {Array} protocols - Lista de protocolos
 * @returns {string} Conteúdo CSV
 */
function exportProtocolsCSV(protocols) {
  const headers = [
    { key: 'id', label: 'ID' },
    {
      key: 'medicine_name',
      label: 'Medicamento',
      transform: (_, item) => item.medicine?.name || '',
    },
    { key: 'dosage_per_intake', label: 'Dosagem por Intake' },
    { key: 'frequency', label: 'Frequência' },
    {
      key: 'times',
      label: 'Horários',
      transform: (val) => (Array.isArray(val) ? val.join(', ') : ''),
    },
    { key: 'start_date', label: 'Data de Início', transform: formatDateOnly },
    { key: 'end_date', label: 'Data de Término', transform: formatDateOnly },
    { key: 'active', label: 'Ativo', transform: (val) => (val ? 'Sim' : 'Não') },
    { key: 'notes', label: 'Observações' },
    { key: 'created_at', label: 'Data de Criação', transform: formatDateTime },
  ]

  return arrayToCSV(protocols, headers)
}

/**
 * Exporta registros de dose como CSV
 *
 * @param {Array} logs - Lista de registros
 * @returns {string} Conteúdo CSV
 */
function exportLogsCSV(logs) {
  const headers = [
    { key: 'id', label: 'ID' },
    {
      key: 'medicine_name',
      label: 'Medicamento',
      transform: (_, item) => item.medicine?.name || '',
    },
    { key: 'quantity_taken', label: 'Quantidade Tomada' },
    { key: 'taken_at', label: 'Data/Hora', transform: formatDateTime },
    { key: 'notes', label: 'Observações' },
    { key: 'created_at', label: 'Data de Registro', transform: formatDateTime },
  ]

  return arrayToCSV(logs, headers)
}

/**
 * Exporta estoque como CSV
 *
 * @param {Array} stockData - Lista de entradas de estoque
 * @param {Array} medicines - Lista de medicamentos para referência
 * @returns {string} Conteúdo CSV
 */
function exportStockCSV(stockData, medicines) {
  // medicines disponível para referência futura se necessário
  void medicines

  // Achata dados de estoque
  const flatStock = stockData.flatMap((medicine) => {
    const stock = medicine.stock || []
    return stock.map((s) => ({
      ...s,
      medicine_name: medicine.name,
    }))
  })

  const headers = [
    { key: 'id', label: 'ID' },
    { key: 'medicine_name', label: 'Medicamento' },
    { key: 'quantity', label: 'Quantidade' },
    { key: 'purchase_date', label: 'Data de Compra', transform: formatDateOnly },
    {
      key: 'unit_price',
      label: 'Preço Unitário (R$)',
      transform: (val) => (val ? val.toFixed(2) : '0,00'),
    },
    { key: 'notes', label: 'Observações' },
    { key: 'created_at', label: 'Data de Registro', transform: formatDateTime },
  ]

  return arrayToCSV(flatStock, headers)
}

/**
 * Exporta dados como JSON
 *
 * @param {Object} options - Opções de exportação
 * @param {Object} options.dateRange - Intervalo de datas {start: Date, end: Date}
 * @param {boolean} options.includeProtocols - Incluir protocolos
 * @param {boolean} options.includeLogs - Incluir registros de dose
 * @param {boolean} options.includeStock - Incluir estoque
 * @param {boolean} options.includeMedicines - Incluir medicamentos
 * @returns {Promise<void>} Faz download do arquivo JSON
 */
export async function exportAsJSON(options = {}) {
  const {
    dateRange,
    includeProtocols = true,
    includeLogs = true,
    includeStock = true,
    includeMedicines = true,
  } = options

  const exportData = {
    metadata: {
      exportDate: getServerTimestamp(),
      version: EXPORT_VERSION,
      dateRange: dateRange
        ? {
            start: formatLocalDate(dateRange.start),
            end: formatLocalDate(dateRange.end),
          }
        : null,
    },
    data: {},
  }

  // Busca medicamentos (base para outros dados)
  let medicines = []
  if (includeMedicines || includeStock) {
    medicines = await medicineService.getAll()
    if (includeMedicines) {
      exportData.data.medicines = medicines.map((m) => ({
        id: m.id,
        name: m.name,
        dosage_mg: m.dosage_mg,
        pill_count: m.pill_count,
        instructions: m.instructions,
        created_at: m.created_at,
      }))
    }
  }

  // Busca protocolos
  if (includeProtocols) {
    const protocols = await protocolService.getAll()
    exportData.data.protocols = protocols.map((p) => ({
      id: p.id,
      medicine_id: p.medicine_id,
      medicine_name: p.medicine?.name || null,
      dosage_per_intake: p.dosage_per_intake,
      frequency: p.frequency,
      times: p.times,
      start_date: p.start_date,
      end_date: p.end_date,
      active: p.active,
      notes: p.notes,
      created_at: p.created_at,
    }))
  }

  // Busca registros de dose
  if (includeLogs) {
    let logs = []
    if (dateRange) {
      const result = await logService.getByDateRange(
        formatLocalDate(dateRange.start),
        formatLocalDate(dateRange.end),
        10000,
        0
      )
      logs = result.data
    } else {
      logs = await logService.getAll(10000)
    }
    exportData.data.logs = logs.map((l) => ({
      id: l.id,
      medicine_id: l.medicine_id,
      medicine_name: l.medicine?.name || null,
      protocol_id: l.protocol_id,
      quantity_taken: l.quantity_taken,
      taken_at: l.taken_at,
      notes: l.notes,
      created_at: l.created_at,
    }))
  }

  // Busca estoque
  if (includeStock) {
    exportData.data.stock = medicines.map((m) => ({
      medicine_id: m.id,
      medicine_name: m.name,
      stock_entries: (m.stock || []).map((s) => ({
        id: s.id,
        quantity: s.quantity,
        purchase_date: s.purchase_date,
        unit_price: s.unit_price,
        notes: s.notes,
        created_at: s.created_at,
      })),
    }))
  }

  // Gera JSON com pretty-print (2 espaços)
  const jsonContent = JSON.stringify(exportData, null, 2)

  // Download
  downloadFile(
    jsonContent,
    generateFilename('dosiq_export', 'json'),
    'application/json;charset=utf-8'
  )
}

/**
 * Exporta dados como CSV
 *
 * @param {Object} options - Opções de exportação
 * @param {Object} options.dateRange - Intervalo de datas {start: Date, end: Date}
 * @param {boolean} options.includeProtocols - Incluir protocolos
 * @param {boolean} options.includeLogs - Incluir registros de dose
 * @param {boolean} options.includeStock - Incluir estoque
 * @param {boolean} options.includeMedicines - Incluir medicamentos
 * @returns {Promise<void>} Faz download do arquivo CSV
 */
export async function exportAsCSV(options = {}) {
  const {
    dateRange,
    includeProtocols = true,
    includeLogs = true,
    includeStock = true,
    includeMedicines = true,
  } = options

  const csvSections = []

  // Busca medicamentos (base para outros dados)
  let medicines = []
  if (includeMedicines || includeStock) {
    medicines = await medicineService.getAll()
  }

  // Exporta medicamentos
  if (includeMedicines) {
    csvSections.push('=== MEDICAMENTOS ===')
    csvSections.push(exportMedicinesCSV(medicines))
    csvSections.push('')
  }

  // Exporta protocolos
  if (includeProtocols) {
    const protocols = await protocolService.getAll()
    csvSections.push('=== PROTOCOLOS ===')
    csvSections.push(exportProtocolsCSV(protocols))
    csvSections.push('')
  }

  // Exporta registros de dose
  if (includeLogs) {
    let logs = []
    if (dateRange) {
      const result = await logService.getByDateRange(
        formatLocalDate(dateRange.start),
        formatLocalDate(dateRange.end),
        10000,
        0
      )
      logs = result.data
    } else {
      logs = await logService.getAll(10000)
    }
    csvSections.push('=== REGISTROS DE DOSE ===')
    csvSections.push(exportLogsCSV(logs))
    csvSections.push('')
  }

  // Exporta estoque
  if (includeStock) {
    csvSections.push('=== ESTOQUE ===')
    csvSections.push(exportStockCSV(medicines, medicines))
    csvSections.push('')
  }

  // Adiciona cabeçalho com metadados
  const metadataSection = [
    '=== METADADOS ===',
    `Data de Exportação;${formatDateTime(getServerTimestamp())}`,
    `Versão do Formato;${EXPORT_VERSION}`,
    dateRange
      ? `Período;${formatDateOnly(formatLocalDate(dateRange.start))} a ${formatDateOnly(formatLocalDate(dateRange.end))}`
      : 'Período;Todos os dados',
    '',
  ]

  // Monta CSV final com BOM UTF-8
  const csvContent = UTF8_BOM + [...metadataSection, ...csvSections].join('\n')

  // Download
  downloadFile(
    csvContent,
    generateFilename('dosiq_export', 'csv'),
    'text/csv;charset=utf-8'
  )
}

/**
 * Exporta dados em lote (múltiplos arquivos)
 *
 * @param {Object} options - Opções de exportação
 * @param {Object} options.dateRange - Intervalo de datas {start: Date, end: Date}
 * @param {boolean} options.includeProtocols - Incluir protocolos
 * @param {boolean} options.includeLogs - Incluir registros de dose
 * @param {boolean} options.includeStock - Incluir estoque
 * @param {boolean} options.includeMedicines - Incluir medicamentos
 * @returns {Promise<void>} Faz download dos arquivos
 */
export async function exportAll(options = {}) {
  await Promise.all([exportAsJSON(options), exportAsCSV(options)])
}
