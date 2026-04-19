/**
 * ExportDialog - Dialog para exportação de dados do usuário
 *
 * @module ExportDialog
 * @description Componente modal que permite ao usuário exportar seus dados
 * em formatos CSV ou JSON, com filtros por tipo de dado e período.
 *
 * REGRAS SEGUIDAS:
 * - R-010: Hook order (States → Memos → Effects → Handlers)
 * - R-050: JSDoc em português
 */

import { useState, useMemo, useCallback } from 'react'
import { FileBracesCorner, FileDigit } from 'lucide-react'
import Modal from '@shared/components/ui/Modal'
import Button from '@shared/components/ui/Button'
import { exportAsJSON, exportAsCSV } from '@features/export/services/exportService'
import './ExportDialog.css'

/** Opções de formato de exportação */
const FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON', icon: FileBracesCorner },
  { value: 'csv', label: 'CSV', icon: FileDigit },
]

/** Labels para tipos de dados */
const DATA_TYPE_LABELS = {
  protocols: 'Protocolos',
  logs: 'Registros de Dose',
  stock: 'Estoque',
  medicines: 'Medicamentos',
}

/**
 * Componente de dialog para exportação de dados
 *
 * @param {Object} props - Propriedades do componente
 * @param {boolean} props.isOpen - Se o dialog está aberto
 * @param {Function} props.onClose - Callback para fechar o dialog
 * @returns {JSX.Element} Componente ExportDialog
 */
export default function ExportDialog({ isOpen, onClose }) {
  // 1. States (R-010: Hook order)
  const [format, setFormat] = useState('json')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [includeProtocols, setIncludeProtocols] = useState(true)
  const [includeLogs, setIncludeLogs] = useState(true)
  const [includeStock, setIncludeStock] = useState(true)
  const [includeMedicines, setIncludeMedicines] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // 2. Memos (R-010: Hook order)
  const isExportDisabled = useMemo(() => {
    return !includeProtocols && !includeLogs && !includeStock && !includeMedicines
  }, [includeProtocols, includeLogs, includeStock, includeMedicines])

  const hasDateFilter = useMemo(() => {
    return dateRange.start || dateRange.end
  }, [dateRange])

  // 3. Handlers (R-010: Hook order)
  const handleFormatChange = useCallback((value) => {
    setFormat(value)
    setExportError(null)
  }, [])

  const handleDateChange = useCallback(
    (field) => (e) => {
      setDateRange((prev) => ({
        ...prev,
        [field]: e.target.value,
      }))
      setExportError(null)
    },
    []
  )

  const handleCheckboxChange = useCallback(
    (setter) => (e) => {
      setter(e.target.checked)
      setExportError(null)
    },
    []
  )

  const handleExport = useCallback(async () => {
    if (isExportDisabled) return

    setIsExporting(true)
    setExportError(null)

    try {
      const options = {
        includeProtocols,
        includeLogs,
        includeStock,
        includeMedicines,
        dateRange: hasDateFilter
          ? {
              start: dateRange.start ? new Date(dateRange.start) : null,
              end: dateRange.end ? new Date(dateRange.end) : null,
            }
          : null,
      }

      // Track analytics event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'export_data', {
          format,
          includeProtocols,
          includeLogs,
          includeStock,
          includeMedicines,
          hasDateFilter,
        })
      }

      // Execute export based on format
      if (format === 'json') {
        await exportAsJSON(options)
      } else {
        await exportAsCSV(options)
      }

      // Close dialog on success
      onClose()
    } catch (err) {
      console.error('Export error:', err)
      setExportError('Erro ao exportar dados. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }, [
    format,
    includeProtocols,
    includeLogs,
    includeStock,
    includeMedicines,
    hasDateFilter,
    dateRange,
    isExportDisabled,
    onClose,
  ])

  const handleClose = useCallback(() => {
    if (!isExporting) {
      onClose()
    }
  }, [isExporting, onClose])

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Exportar Dados">
      <div className="export-dialog">
        {/* Format Selector */}
        <div className="export-section">
          <label className="export-label">Formato</label>
          <div className="format-toggle">
            {FORMAT_OPTIONS.map((option) => {
              const OptionIcon = option.icon
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`format-toggle-btn${format === option.value ? ' active' : ''}`}
                  onClick={() => handleFormatChange(option.value)}
                  disabled={isExporting}
                >
                  <OptionIcon size={18} />
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date Range */}
        <div className="export-section">
          <label className="export-label">Período (opcional)</label>
          <div className="date-range">
            <div className="date-input-group">
              <label htmlFor="export-date-start">De</label>
              <input
                id="export-date-start"
                type="date"
                value={dateRange.start}
                onChange={handleDateChange('start')}
                disabled={isExporting}
                className="date-input"
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="export-date-end">Até</label>
              <input
                id="export-date-end"
                type="date"
                value={dateRange.end}
                onChange={handleDateChange('end')}
                disabled={isExporting}
                className="date-input"
              />
            </div>
          </div>
        </div>

        {/* Data Types */}
        <div className="export-section">
          <label className="export-label">Dados a exportar</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeProtocols}
                onChange={handleCheckboxChange(setIncludeProtocols)}
                disabled={isExporting}
              />
              <span>{DATA_TYPE_LABELS.protocols}</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeLogs}
                onChange={handleCheckboxChange(setIncludeLogs)}
                disabled={isExporting}
              />
              <span>{DATA_TYPE_LABELS.logs}</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeStock}
                onChange={handleCheckboxChange(setIncludeStock)}
                disabled={isExporting}
              />
              <span>{DATA_TYPE_LABELS.stock}</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeMedicines}
                onChange={handleCheckboxChange(setIncludeMedicines)}
                disabled={isExporting}
              />
              <span>{DATA_TYPE_LABELS.medicines}</span>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {exportError && <div className="export-error">{exportError}</div>}

        {/* Actions */}
        <div className="export-actions">
          <Button variant="outline" onClick={handleClose} disabled={isExporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExportDisabled || isExporting}>
            {isExporting ? 'Exportando...' : 'Exportar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
