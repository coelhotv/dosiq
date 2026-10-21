// ConsentDetailsSheet.tsx — folha "Detalhes ›" das caixas A e B (spec 096, S6-A e `sheetB`).
//
// Camada 2 do consentimento (guarda 8: detalhe a 1 toque). Copy VERBATIM do core — a mesma fonte
// do mobile e da política. Na folha B, o bloco "Sem a autorização" vem ANTES do contraste (PO 20/10).

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { HEALTH_CONSENT_COPY, TRANSFER_CONSENT_COPY } from '@dosiq/core'
import './ConsentDetailsSheet.css'

const PRIVACY_POLICY_URL = '/politica-de-privacidade.html'

interface ConsentDetailsSheetProps {
  variant: 'health' | 'transfer'
  onClose: () => void
}

export default function ConsentDetailsSheet({ variant, onClose }: ConsentDetailsSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const title = variant === 'health' ? HEALTH_CONSENT_COPY.detailsTitle : TRANSFER_CONSENT_COPY.sheetTitle

  return (
    <div className="consent-details-sheet" role="dialog" aria-modal="true" aria-labelledby="consent-details-title">
      <div className="consent-details-sheet__card">
        <div className="consent-details-sheet__header">
          <h3 id="consent-details-title" className="consent-details-sheet__title">{title}</h3>
          <button ref={closeRef} type="button" className="consent-details-sheet__close" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {variant === 'health' ? (
          <p className="consent-details-sheet__text">{HEALTH_CONSENT_COPY.details}</p>
        ) : (
          <>
            <p className="consent-details-sheet__subtitle">{TRANSFER_CONSENT_COPY.withoutTitle}</p>
            <p className="consent-details-sheet__text">{TRANSFER_CONSENT_COPY.without}</p>

            <div className="consent-details-sheet__contrast">
              <div>
                <span className="consent-details-sheet__contrast-label">Com autorização</span>
                <span className="consent-details-sheet__push">{TRANSFER_CONSENT_COPY.contrastWith}</span>
              </div>
              <div>
                <span className="consent-details-sheet__contrast-label">Sem autorização</span>
                <span className="consent-details-sheet__push">{TRANSFER_CONSENT_COPY.contrastWithout}</span>
              </div>
            </div>

            <ul className="consent-details-sheet__table">
              {TRANSFER_CONSENT_COPY.table.map((row) => (
                <li key={row.use}>
                  <strong>{row.use}</strong>: {row.data} → {row.to}
                </li>
              ))}
            </ul>

            <p className="consent-details-sheet__text">{TRANSFER_CONSENT_COPY.howToChange}</p>
          </>
        )}

        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="consent-details-sheet__link">
          Ler a política completa
        </a>
      </div>
    </div>
  )
}
