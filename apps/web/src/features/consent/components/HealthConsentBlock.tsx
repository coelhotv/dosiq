// HealthConsentBlock.tsx — caixa A: dados de saúde, obrigatória (spec 046 T006 → spec 096 v0.4).
//
// LGPD art. 11 exige consentimento ESPECÍFICO e DESTACADO para dado sensível — por isso a caixa
// própria (ConsentBox), nunca embutida no aceite de Termos/Política (rodapé, guarda 3).
// A copy vem de HEALTH_CONSENT_COPY (@dosiq/core) VERBATIM — a política v0.4 §5 cita o mesmo texto.

import { HEALTH_CONSENT_COPY } from '@dosiq/core'
import { analyticsService } from '@dashboard/services/analyticsService'
import ConsentBox from './ConsentBox'

export const HEALTH_BOX_TITLE = 'Dados de saúde · obrigatória'

interface HealthConsentBlockProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Mensagem de erro quando o titular tenta seguir sem marcar (null = sem erro). */
  errorMessage?: string | null
}

export default function HealthConsentBlock({
  checked,
  onChange,
  disabled = false,
  errorMessage = null,
}: HealthConsentBlockProps) {
  // FR-008: instrumentação de atrito — dispara SÓ quando o titular desmarca (recusa), nunca
  // quando marca. Sem PII no payload.
  const handleChange = (next: boolean) => {
    if (!next) {
      analyticsService.track('consent_health_declined', {})
    }
    onChange(next)
  }

  return (
    <ConsentBox
      variant="health"
      title={HEALTH_BOX_TITLE}
      label={HEALTH_CONSENT_COPY.label}
      checked={checked}
      onChange={handleChange}
      disabled={disabled}
      errorMessage={errorMessage}
    />
  )
}
