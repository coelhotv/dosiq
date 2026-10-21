// ConsentRegularizationModal.tsx — reconsentimento da v0.4 (spec 096 `rec-web`; era o nudge da 046).
//
// Alvo: titular que consentiu numa versão ANTIGA (`stale`). BLOQUEANTE (DQ-1, PO 20/10): sem "Agora
// não" e sem fechar fora — a v0.4 troca o responsável pelos dados, e o titular decide: Confirmar
// (A obrigatória + B opcional, num gesto) ou Não concordo (→ revogação existente, em Privacidade).
// A caixa A não depende de "abrir a política antes" (o antigo `hasRead`): o detalhe está a 1 toque
// em "O que mudou ›" e em "Detalhes ›" de cada caixa (guarda 8).

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { createConsentService, REGULARIZATION_V04_COPY as COPY } from '@dosiq/core'
import HealthConsentBlock from './HealthConsentBlock'
import TransferConsentBlock from './TransferConsentBlock'
import { useConsentGate } from '@shared/hooks/useConsentGate'
import { supabase } from '@shared/utils/supabase'
import './ConsentRegularizationModal.css'

const consentService = createConsentService({ client: supabase })

interface ConsentRegularizationModalProps {
  visible: boolean
  onConfirmed: () => void
  /** "Não concordo" — leva à revogação existente (Perfil › Privacidade e dados). */
  onDecline: () => void
}

export default function ConsentRegularizationModal({
  visible,
  onConfirmed,
  onDecline,
}: ConsentRegularizationModalProps) {
  const { grantV04 } = useConsentGate()
  const [health, setHealth] = useState(false)
  const [transfer, setTransfer] = useState(false)
  const [healthError, setHealthError] = useState(false)
  const [changedOpen, setChangedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // B já vigente na v0.4 ⇒ a caixa B sai (pedir de novo, desmarcada, sugeria que estava desligado —
  // smoke B2 2.6). Leitura que falha mantém a caixa: marcar de novo só regrava o mesmo aceite.
  const [transferAlreadyOn, setTransferAlreadyOn] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    consentService
      .getStatus('international_transfer')
      .then((s) => { if (!cancelled) setTransferAlreadyOn(s.status === 'granted' && !s.stale) })
      .catch(() => { if (!cancelled) setTransferAlreadyOn(false) })
    return () => { cancelled = true }
  }, [visible])

  if (!visible) return null

  const handleHealthChange = (next: boolean) => {
    setHealth(next)
    if (next) setHealthError(false)
  }

  const handleConfirm = async () => {
    // CTA nunca fica cinza: sem A, o toque leva o foco à caixa com a mensagem (D-8).
    if (!health) {
      setHealthError(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await grantV04({ transfer })
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
    <div className="consent-regularization-modal" role="dialog" aria-modal="true" aria-labelledby="consent-regularization-title">
      <div className="consent-regularization-modal__card">
        <div className="consent-regularization-modal__icon">
          <ShieldCheck size={22} aria-hidden="true" />
        </div>
        <h2 id="consent-regularization-title" className="consent-regularization-modal__title">{COPY.title}</h2>
        <p className="consent-regularization-modal__description">{COPY.body}</p>

        <button
          type="button"
          className="consent-regularization-modal__changed-toggle"
          aria-expanded={changedOpen}
          onClick={() => setChangedOpen((open) => !open)}
        >
          {COPY.changedLink}
        </button>
        {changedOpen && (
          <ul className="consent-regularization-modal__changed">
            {COPY.changed.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}

        <div className="consent-regularization-modal__boxes">
          <HealthConsentBlock
            checked={health}
            onChange={handleHealthChange}
            disabled={saving}
            errorMessage={healthError ? COPY.errorNoHealth : null}
          />
          {transferAlreadyOn ? (
            <p className="consent-regularization-modal__transfer-on">{COPY.transferAlreadyOn}</p>
          ) : (
            <TransferConsentBlock checked={transfer} onChange={setTransfer} disabled={saving} />
          )}
        </div>

        <p className="consent-regularization-modal__terms">{COPY.termsFooter}</p>

        {error && <p className="consent-regularization-modal__error" role="alert">{error}</p>}

        <button
          type="button"
          className="consent-regularization-modal__accept"
          onClick={handleConfirm}
          disabled={saving}
        >
          {saving ? 'Registrando...' : COPY.confirm}
        </button>

        <button
          type="button"
          className="consent-regularization-modal__dismiss"
          onClick={onDecline}
          disabled={saving}
        >
          {COPY.decline}
        </button>
      </div>
    </div>
  )
}
