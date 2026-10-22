// ConsentBox.tsx — caixa de consentimento da v0.4 (spec 096, artboards `dq4a`/`rec-web`/`enableB`).
//
// Uma caixa = uma autorização (guarda 2: A e B separadas; guarda 3: termos ficam no rodapé, fora
// daqui). Caixa e frase são UM `<label>` (alvo único, nome falado). Nasce desmarcada (guarda 1).
// Erro: tocar no CTA sem marcar NÃO é silencioso — o foco vai à caixa e a mensagem sai em
// `role=alert` (D-8 do RC2: CTA nunca fica cinza).

import { useEffect, useId, useRef, useState } from 'react'
import ConsentDetailsSheet from './ConsentDetailsSheet'
import './ConsentBox.css'

interface ConsentBoxProps {
  variant: 'health' | 'transfer'
  title: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Mensagem exibida (e anunciada) quando o titular tenta seguir sem marcar. */
  errorMessage?: string | null
}

export default function ConsentBox({
  variant,
  title,
  label,
  checked,
  onChange,
  disabled = false,
  errorMessage = null,
}: ConsentBoxProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const checkboxRef = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    if (errorMessage) checkboxRef.current?.focus()
  }, [errorMessage])

  return (
    <div className={`consent-box${errorMessage ? ' consent-box--error' : ''}`}>
      {/* "Detalhes ›" na linha do título, à direita (smoke B2 1.1/1.11: a caixa ficava longa demais). */}
      <div className="consent-box__header">
        <p className="consent-box__title">{title}</p>
        <button type="button" className="consent-box__details" onClick={() => setDetailsOpen(true)}>
          Detalhes ›
        </button>
      </div>

      <label className="consent-box__row" htmlFor={`${id}-checkbox`}>
        <input
          ref={checkboxRef}
          id={`${id}-checkbox`}
          type="checkbox"
          className="consent-box__checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="consent-box__label">{label}</span>
      </label>

      {errorMessage && (
        <p id={`${id}-error`} className="consent-box__error" role="alert">
          {errorMessage}
        </p>
      )}

      {detailsOpen && <ConsentDetailsSheet variant={variant} onClose={() => setDetailsOpen(false)} />}
    </div>
  )
}
