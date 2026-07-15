// HealthConsentBlock.tsx — opt-in DESTACADO de dados de saúde (spec 046, T006).
//
// LGPD art. 11 exige consentimento ESPECÍFICO e DESTACADO para dado sensível — não é estética,
// é requisito legal: por isso este bloco tem borda/fundo próprios, nunca um checkbox solto no
// meio de outro formulário (aceite de Termos/Política fica em outro controle).
//
// A copy vem de HEALTH_CONSENT_COPY (@dosiq/core) VERBATIM — a política publicada cita o mesmo
// texto. Duas redações divergentes seriam, na prática, dois consentimentos diferentes.

import { HEALTH_CONSENT_COPY } from '@dosiq/core'
import { analyticsService } from '@dashboard/services/analyticsService'
import './HealthConsentBlock.css'

interface HealthConsentBlockProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** exibido quando o usuário tenta submeter sem marcar */
  showError?: boolean
}

export default function HealthConsentBlock({
  checked,
  onChange,
  disabled = false,
  showError = false,
}: HealthConsentBlockProps) {
  // FR-008: instrumentação de atrito — dispara SÓ quando o titular desmarca (recusa), nunca
  // quando marca (isso não é analytics de consentimento; o consentimento em si só existe via
  // consent_grant). Sem PII no payload.
  const handleChange = (next: boolean) => {
    if (!next) {
      analyticsService.track('consent_health_declined', {})
    }
    onChange(next)
  }

  return (
    <div className={`health-consent-block${showError ? ' health-consent-block--error' : ''}`}>
      <p className="health-consent-block__title">{HEALTH_CONSENT_COPY.title}</p>

      <div className="health-consent-block__row">
        <input
          id="health-consent-checkbox"
          type="checkbox"
          className="health-consent-block__checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby="health-consent-helper"
          onChange={(e) => handleChange(e.target.checked)}
        />
        <label htmlFor="health-consent-checkbox" className="health-consent-block__label">
          {HEALTH_CONSENT_COPY.label}
        </label>
      </div>

      <p id="health-consent-helper" className="health-consent-block__helper">
        {HEALTH_CONSENT_COPY.helper}{' '}
        <a
          href="/politica-de-privacidade.html"
          target="_blank"
          rel="noreferrer"
          className="health-consent-block__link"
        >
          Ver política de privacidade
        </a>
      </p>

      {showError && (
        <p className="health-consent-block__error" role="alert">
          Para continuar, é preciso autorizar o tratamento dos dados de saúde.
        </p>
      )}
    </div>
  )
}
