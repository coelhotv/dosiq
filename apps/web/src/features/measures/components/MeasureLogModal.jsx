// MeasureLogModal.jsx — fast-logging de biomarcador no web (012 Fase C · FR-010).
// Espelho do MeasureLogSheet mobile: layout B "idoso primeiro" (valor grande centrado, tipo em
// chips, contexto em chips só p/ glicemia, unidade fixa por tipo). Vírgula PT-BR via coerceDecimal
// (R-276). v1 = glicemia + peso (PA fora da UI, schema-ready). Modal reusável (focus trap/Esc).
// SaMD (ADR-062): nenhuma cor/copy de qualidade do valor. Transparência radical de erro (FR-012b).

import { useState } from 'react'
import { Ruler } from 'lucide-react'
import {
  coerceDecimal,
  BIOMARKER_TYPE_UNITS,
  BIOMARKER_TYPE_LABELS,
  BIOMARKER_CONTEXTS,
  BIOMARKER_CONTEXT_LABELS,
} from '@dosiq/core'
import Modal from '@shared/components/ui/Modal'
import './MeasureLogModal.css'

// Tipos com UI no v1. PA/batimentos não entram aqui (schema-ready no core).
const UI_TYPES = ['glicemia', 'peso']

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSaved - async(payload) => salvo. payload = {type,value,unit,context,[id],[measured_at]}.
 * @param {Object} [props.editItem] - medida existente (edição). Caller deve remontar via key (R-273).
 * @param {string} [props.defaultType='glicemia']
 * @param {string} [props.lockedType] - trava o tipo (contexto de um histórico específico).
 */
export default function MeasureLogModal({ isOpen, onClose, onSaved, editItem = null, defaultType = 'glicemia', lockedType = null }) {
  const isEdit = !!editItem
  const fixedType = editItem?.type || lockedType
  const showTabs = !fixedType

  const [type, setType] = useState(fixedType || defaultType)
  const [value, setValue] = useState(editItem ? String(editItem.value).replace('.', ',') : '')
  const [context, setContext] = useState(editItem?.context ?? null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const unit = BIOMARKER_TYPE_UNITS[type]
  const showContext = type === 'glicemia'

  function handleSelectType(t) {
    setType(t)
    if (t !== 'glicemia') setContext(null)
    setErrorMsg(null)
  }

  function handleClose() {
    if (saving) return
    onClose?.()
  }

  async function handleSave() {
    const num = coerceDecimal(value)
    if (Number.isNaN(num) || num <= 0) {
      setErrorMsg('Digite um valor válido maior que zero.')
      return
    }
    try {
      setSaving(true)
      setErrorMsg(null)
      const payload = { type, value: num, unit, context: showContext ? context : null }
      // Criação: measured_at omitido → DB usa DEFAULT now() (sem new Date no app, R-020).
      const saved = await onSaved?.(isEdit ? { id: editItem.id, ...payload } : payload)
      onClose?.(saved)
    } catch {
      // Transparência radical (FR-012b): diz o que falhou; nada salvo; valor mantido.
      setErrorMsg('Não foi possível salvar. Nada foi gravado — tente novamente.')
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEdit ? 'Editar medida' : 'Registrar medida'}>
      <div className="mlm">
        <div className="mlm__icon"><Ruler size={24} aria-hidden="true" /></div>

        {/* Tipo (chips) — oculto quando contextual a um tipo (lockedType/edição) */}
        {showTabs ? (
          <div className="mlm__types">
            {UI_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectType(t)}
                className={`mlm__type-chip${type === t ? ' mlm__type-chip--active' : ''}`}
                aria-pressed={type === t}
              >
                {BIOMARKER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        ) : (
          <p className="mlm__locked-type">{BIOMARKER_TYPE_LABELS[type]}</p>
        )}

        {/* Valor grande + unidade fixa (layout B) */}
        <div className="mlm__value-row">
          <input
            className={`mlm__value${errorMsg ? ' mlm__value--error' : ''}`}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => { setValue(e.target.value); if (errorMsg) setErrorMsg(null) }}
            placeholder="0"
            maxLength={6}
            autoFocus
            aria-label={`Valor da medida em ${unit}`}
          />
          <span className="mlm__unit">{unit}</span>
        </div>

        {/* Caption de erro — altura-neutra não empurra o layout */}
        <p className="mlm__error" role={errorMsg ? 'alert' : undefined}>{errorMsg || ' '}</p>

        {/* Contexto (chips, opcional, só glicemia) */}
        {showContext && (
          <div className="mlm__contexts">
            {BIOMARKER_CONTEXTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setContext(context === c ? null : c)}
                className={`mlm__ctx-chip${context === c ? ' mlm__ctx-chip--active' : ''}`}
                aria-pressed={context === c}
              >
                {BIOMARKER_CONTEXT_LABELS[c]}
              </button>
            ))}
          </div>
        )}

        <div className="mlm__actions">
          <button type="button" className="mlm__btn mlm__btn--cancel" onClick={handleClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="mlm__btn mlm__btn--save" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar medida'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
