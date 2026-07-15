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
import { parseLocalDate } from '@utils/dateUtils'
import './ExportDialog.css'

/** Renderiza seletor de formato de exportação. */
function FormatSelector({ format, isExporting, onFormatChange }) {
  return (
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
              onClick={() => onFormatChange(option.value)}
              disabled={isExporting}
            >
              <OptionIcon size={18} />
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Renderiza seletor de intervalo de datas. */
function DateRangeSelector({ dateRange, isExporting, onDateChange }) {
  return (
    <div className="export-section">
      <label className="export-label">Período (opcional)</label>
      <div className="date-range">
        <div className="date-input-group">
          <label htmlFor="export-date-start">De</label>
          <input
            id="export-date-start"
            type="date"
            value={dateRange.start}
            onChange={onDateChange('start')}
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
            onChange={onDateChange('end')}
            disabled={isExporting}
            className="date-input"
          />
        </div>
      </div>
    </div>
  )
}

/** Renderiza checkboxes de seleção de tipos de dados. */
function DataTypeCheckboxes({ states, isExporting, onCheckboxChange }) {
  const { includeProfile, setIncludeProfile, includeProtocols, setIncludeProtocols, includeLogs, setIncludeLogs, includeStock, setIncludeStock, includeMedicines, setIncludeMedicines, includeBiomarkers, setIncludeBiomarkers } = states
  // 046 Slice D: checkbox "Estoque" SEMPRE presente — é dado do titular (art. 18), não uma feature
  // ligável. Condicioná-lo a `stock_tracking_enabled` (preferência de UX) escondia os lotes/compras
  // congelados de quem desligou o controle (044 congela, não apaga) — o furo de cobertura LGPD (R-291).
  const options = [
    { checked: includeProfile, setter: setIncludeProfile, label: DATA_TYPE_LABELS.profile },
    { checked: includeProtocols, setter: setIncludeProtocols, label: DATA_TYPE_LABELS.protocols },
    { checked: includeLogs, setter: setIncludeLogs, label: DATA_TYPE_LABELS.logs },
    { checked: includeStock, setter: setIncludeStock, label: DATA_TYPE_LABELS.stock },
    { checked: includeMedicines, setter: setIncludeMedicines, label: DATA_TYPE_LABELS.medicines },
    { checked: includeBiomarkers, setter: setIncludeBiomarkers, label: DATA_TYPE_LABELS.biomarkers },
  ]
  return (
    <div className="export-section">
      <label className="export-label">Dados a exportar</label>
      <div className="checkbox-group">
        {options.map(({ checked, setter, label }) => (
          <label key={label} className="checkbox-label">
            <input
              type="checkbox"
              checked={checked}
              onChange={onCheckboxChange(setter)}
              disabled={isExporting}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/** Opções de formato de exportação */
const FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON', icon: FileBracesCorner },
  { value: 'csv', label: 'CSV', icon: FileDigit },
]

/** Labels para tipos de dados */
const DATA_TYPE_LABELS = {
  profile: 'Perfil e configurações',
  protocols: 'Tratamentos',
  logs: 'Registros de dose',
  stock: 'Estoque',
  medicines: 'Medicamentos',
  biomarkers: 'Medidas e biomarcadores',
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
  const [includeProfile, setIncludeProfile] = useState(true)
  const [includeProtocols, setIncludeProtocols] = useState(true)
  const [includeLogs, setIncludeLogs] = useState(true)
  // 046 Slice D: nasce marcado para TODOS. O estoque é dado do titular, não condicionado à
  // preferência de controle (044). Quem não tem estoque recebe uma seção "sem dados" honesta.
  const [includeStock, setIncludeStock] = useState(true)
  const [includeMedicines, setIncludeMedicines] = useState(true)
  const [includeBiomarkers, setIncludeBiomarkers] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // 2. Memos (R-010: Hook order)
  // 046 Slice D: o export do estoque segue APENAS o checkbox — não é mais recortado por
  // `stock_tracking_enabled`. A preferência de controle é UX do app, não permissão de acesso.
  const exportStock = includeStock

  const isExportDisabled = useMemo(() => {
    return (
      !includeProfile &&
      !includeProtocols &&
      !includeLogs &&
      !exportStock &&
      !includeMedicines &&
      !includeBiomarkers
    )
  }, [includeProfile, includeProtocols, includeLogs, exportStock, includeMedicines, includeBiomarkers])

  const hasDateFilter = useMemo(() => {
    return dateRange.start || dateRange.end
  }, [dateRange])

  // 4. Handlers (R-010: Hook order)
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
        includeProfile,
        includeProtocols,
        includeLogs,
        includeStock: exportStock,
        includeMedicines,
        includeBiomarkers,
        dateRange: hasDateFilter
          ? {
              start: dateRange.start ? parseLocalDate(dateRange.start) : null,
              end: dateRange.end ? parseLocalDate(dateRange.end) : null,
            }
          : null,
      }

      // Track analytics event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        ;(window as any).gtag('event', 'export_data', {
          format,
          includeProfile,
          includeProtocols,
          includeLogs,
          includeStock: exportStock,
          includeMedicines,
          includeBiomarkers,
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
    includeProfile,
    includeProtocols,
    includeLogs,
    exportStock,
    includeMedicines,
    includeBiomarkers,
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
        <FormatSelector format={format} isExporting={isExporting} onFormatChange={handleFormatChange} />
        <DateRangeSelector dateRange={dateRange} isExporting={isExporting} onDateChange={handleDateChange} />
        <DataTypeCheckboxes
          states={{ includeProfile, setIncludeProfile, includeProtocols, setIncludeProtocols, includeLogs, setIncludeLogs, includeStock, setIncludeStock, includeMedicines, setIncludeMedicines, includeBiomarkers, setIncludeBiomarkers }}
          isExporting={isExporting}
          onCheckboxChange={handleCheckboxChange}
        />
        {exportError && <div className="export-error">{exportError}</div>}
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
