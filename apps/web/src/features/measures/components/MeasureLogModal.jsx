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
  BIOMARKER_PA_CONTEXTS,
  BIOMARKER_PA_CONTEXT_LABELS,
} from '@dosiq/core'
import Modal from '@shared/components/ui/Modal'
import './MeasureLogModal.css'

// Tipos com UI. PA entra na spec 032 (2 campos). batimentos = schema-ready.
const UI_TYPES = ['glicemia', 'peso', 'pressao_arterial']

// Contexto por família (ADR-070). Tipos ausentes = sem contexto.
const CONTEXTS_BY_TYPE = {
  glicemia: { values: BIOMARKER_CONTEXTS, labels: BIOMARKER_CONTEXT_LABELS },
  pressao_arterial: { values: BIOMARKER_PA_CONTEXTS, labels: BIOMARKER_PA_CONTEXT_LABELS },
}

function MeasureValueInputs({ isPa, value, setValue, valueSec, setValueSec, errorMsg, setErrorMsg, saving, unit }) {
  if (isPa) {
    return (
      <div className="mlm__value-row mlm__value-row--pa">
        <span className="mlm__pa-field">
          <input
            className={`mlm__value mlm__value--pa${errorMsg ? ' mlm__value--error' : ''}`}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => { setValue(e.target.value.replace(/[^0-9.,]/g, '')); if (errorMsg) setErrorMsg(null) }}
            placeholder="120"
            maxLength={3}
            autoFocus
            disabled={saving}
            aria-label="Sistólica em mmHg"
          />
          <span className="mlm__pa-label">Sistólica</span>
        </span>
        <span className="mlm__pa-sep">por</span>
        <span className="mlm__pa-field">
          <input
            className={`mlm__value mlm__value--pa${errorMsg ? ' mlm__value--error' : ''}`}
            type="text"
            inputMode="decimal"
            value={valueSec}
            onChange={(e) => { setValueSec(e.target.value.replace(/[^0-9.,]/g, '')); if (errorMsg) setErrorMsg(null) }}
            placeholder="80"
            maxLength={3}
            disabled={saving}
            aria-label="Diastólica em mmHg"
          />
          <span className="mlm__pa-label">Diastólica</span>
        </span>
        <span className="mlm__unit">{unit}</span>
      </div>
    )
  }

  return (
    <div className="mlm__value-row">
      <input
        className={`mlm__value${errorMsg ? ' mlm__value--error' : ''}`}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          // Só dígitos, vírgula e ponto (coerceDecimal normaliza no salvar — R-276).
          setValue(e.target.value.replace(/[^0-9.,]/g, ''))
          if (errorMsg) setErrorMsg(null)
        }}
        placeholder="0"
        maxLength={6}
        autoFocus
        disabled={saving}
        aria-label={`Valor da medida em ${unit}`}
      />
      <span className="mlm__unit">{unit}</span>
    </div>
  )
}

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
  const [valueSec, setValueSec] = useState(
    editItem?.value_secondary != null ? String(editItem.value_secondary).replace('.', ',') : ''
  )
  const [context, setContext] = useState(editItem?.context ?? null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const unit = BIOMARKER_TYPE_UNITS[type]
  const isPa = type === 'pressao_arterial'
  const ctxConfig = CONTEXTS_BY_TYPE[type] ?? null
  const showContext = !!ctxConfig

  function handleSelectType(t) {
    setType(t)
    // Contexto é por família — trocar de tipo zera o contexto (evita inválido p/ o novo tipo).
    setContext(null)
    if (t !== 'pressao_arterial') setValueSec('')
    setErrorMsg(null)
  }

  function handleClose() {
    if (saving) return
    onClose?.()
  }

  async function handleSave() {
    const num = coerceDecimal(value)
    if (Number.isNaN(num) || num <= 0) {
      setErrorMsg(isPa ? 'Digite a sistólica (maior que zero).' : 'Digite um valor válido maior que zero.')
      return
    }
    // PA: diastólica obrigatória e válida (refine do core exige ambas).
    let secNum = null
    if (isPa) {
      secNum = coerceDecimal(valueSec)
      if (Number.isNaN(secNum) || secNum <= 0) {
        setErrorMsg('Digite a diastólica (maior que zero).')
        return
      }
    }
    try {
      setSaving(true)
      setErrorMsg(null)
      const payload = { type, value: num, value_secondary: secNum, unit, context: showContext ? context : null }
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

        {/* Valor grande + unidade fixa (layout B). PA = 2 campos (sistólica "por" diastólica). */}
        <MeasureValueInputs
          isPa={isPa}
          value={value}
          setValue={setValue}
          valueSec={valueSec}
          setValueSec={setValueSec}
          errorMsg={errorMsg}
          setErrorMsg={setErrorMsg}
          saving={saving}
          unit={unit}
        />

        {/* Caption de erro — altura-neutra não empurra o layout */}
        <p className="mlm__error" role={errorMsg ? 'alert' : undefined}>{errorMsg || ' '}</p>

        {/* Contexto (chips, opcional) — por família (glicemia/PA) */}
        {showContext && (
          <div className="mlm__contexts">
            {ctxConfig.values.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setContext(context === c ? null : c)}
                className={`mlm__ctx-chip${context === c ? ' mlm__ctx-chip--active' : ''}`}
                aria-pressed={context === c}
              >
                {ctxConfig.labels[c]}
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
