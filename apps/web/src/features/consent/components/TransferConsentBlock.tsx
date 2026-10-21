// TransferConsentBlock.tsx — caixa B: envio para fora do Brasil, OPCIONAL (spec 096, art. 33 VIII).
//
// Nunca é condição de nada (guarda 4): sem ela o cadastro/confirmação segue, e o servidor entra no
// modo sem B (ADR-112). Copy VERBATIM de TRANSFER_CONSENT_COPY — a política v0.4 §13 cita a mesma.

import { TRANSFER_CONSENT_COPY } from '@dosiq/core'
import ConsentBox from './ConsentBox'

export const TRANSFER_BOX_TITLE = 'Fora do Brasil · opcional'

interface TransferConsentBlockProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  errorMessage?: string | null
}

export default function TransferConsentBlock({
  checked,
  onChange,
  disabled = false,
  errorMessage = null,
}: TransferConsentBlockProps) {
  return (
    <ConsentBox
      variant="transfer"
      title={TRANSFER_BOX_TITLE}
      label={TRANSFER_CONSENT_COPY.label}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      errorMessage={errorMessage}
    />
  )
}
