// ConsentRegularizationModal.tsx — nudge de política nova (spec 046, T011, espelho web).
//
// Alvo: titular que CONSENTIU numa versão ANTIGA da política (`stale`). NÃO trava o app — é um
// convite. "Agora não" dispensa sem escrever nada; aceitar chama consent_grant (via
// useConsentGate, nunca insert direto), que carimba a versão vigente no servidor.

import { useState } from 'react'
import { ShieldCheck, FileText } from 'lucide-react'
import { useConsentGate } from '@shared/hooks/useConsentGate'
import './ConsentRegularizationModal.css'

const PRIVACY_POLICY_URL = '/politica-de-privacidade.html'

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
  // Não se pode pedir novo aceite sem dar como ler a nova política. "Aceitar" fica travado até o
  // titular abrir a política. Em aba nova o navegador NÃO avisa o fechamento — o proxy honesto é
  // "abriu para ler" (clicou no link), não "leu e fechou" (indetectável fora de webview embutida).
  const [hasRead, setHasRead] = useState(false)

  if (!visible) return null

  const handleOpenPolicy = () => {
    window.open(PRIVACY_POLICY_URL, '_blank', 'noopener,noreferrer')
    setHasRead(true)
  }

  const handleAccept = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await grant()
      if (!res.ok) {
        setError('Não foi possível registrar agora. Tente de novo.')
        return
      }
      onConfirmed()
    } catch {
      setError('Não foi possível registrar agora. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="consent-regularization-modal" role="dialog" aria-modal="true">
      <div className="consent-regularization-modal__card">
        <div className="consent-regularization-modal__icon">
          <ShieldCheck size={22} />
        </div>
        <h2 className="consent-regularization-modal__title">A política de privacidade mudou</h2>
        <p className="consent-regularization-modal__description">
          Atualizamos a política de privacidade. Leia a nova versão e, se concordar, confirme seu
          consentimento de dados de saúde para continuar em dia.
        </p>

        {error && <p className="consent-regularization-modal__error">{error}</p>}

        <button
          type="button"
          className="consent-regularization-modal__read"
          onClick={handleOpenPolicy}
          disabled={saving}
        >
          <FileText size={16} aria-hidden="true" />
          {hasRead ? 'Política lida ✓' : 'Ler a nova política'}
        </button>

        <button
          type="button"
          className="consent-regularization-modal__accept"
          onClick={handleAccept}
          disabled={saving || !hasRead}
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
