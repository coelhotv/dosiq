// ConsentRegularizationModal.tsx — nudge de política nova (spec 046, T011, espelho web).
//
// Alvo: titular que CONSENTIU numa versão ANTIGA da política (`stale`). NÃO trava o app — é um
// convite. "Agora não" dispensa sem escrever nada; aceitar chama consent_grant (via
// useConsentGate, nunca insert direto), que carimba a versão vigente no servidor.

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useConsentGate } from '@shared/hooks/useConsentGate'
import './ConsentRegularizationModal.css'

interface ConsentRegularizationModalProps {
  visible: boolean
  onDismiss: () => void
  onConfirmed: () => void
}

export default function ConsentRegularizationModal({
  visible,
  onDismiss,
  onConfirmed,
}: ConsentRegularizationModalProps) {
  const { grant } = useConsentGate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!visible) return null

  const handleAccept = async () => {
    setSaving(true)
    setError(null)
    const res = await grant()
    setSaving(false)
    if (!res.ok) {
      setError('Não foi possível registrar agora. Tente de novo.')
      return
    }
    onConfirmed()
  }

  return (
    <div className="consent-regularization-modal" role="dialog" aria-modal="true">
      <div className="consent-regularization-modal__card">
        <div className="consent-regularization-modal__icon">
          <ShieldCheck size={22} />
        </div>
        <h2 className="consent-regularization-modal__title">A política de privacidade mudou</h2>
        <p className="consent-regularization-modal__description">
          Atualizamos a política de privacidade. Aceite a nova versão para continuar em dia com o
          seu consentimento de dados de saúde.
        </p>

        {error && <p className="consent-regularization-modal__error">{error}</p>}

        <button
          type="button"
          className="consent-regularization-modal__accept"
          onClick={handleAccept}
          disabled={saving}
        >
          {saving ? 'Registrando...' : 'Aceitar a nova versão'}
        </button>

        <button
          type="button"
          className="consent-regularization-modal__dismiss"
          onClick={onDismiss}
          disabled={saving}
        >
          Agora não
        </button>
      </div>
    </div>
  )
}
