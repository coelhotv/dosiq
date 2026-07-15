/**
 * ConsentPrompt — pedido de consentimento para quem NUNCA se manifestou (spec 046, T009).
 *
 * Alvo: contas anteriores ao 046 (estado `missing`). Não existe consentimento retroativo — inventar
 * um seria exatamente a fraude que a trilha existe para impedir. Então perguntamos.
 *
 * Duas formas, decididas pelo guard (`resolveConsentGate`), não por este componente:
 *   - dismissível (até 3 sessões): dá para adiar com "Agora não";
 *   - bloqueante (da 4ª em diante): o "Agora não" some. A cortesia acabou.
 *
 * Recusar não é um evento da trilha: `revoked` é a retirada de um consentimento que EXISTIU. Quem
 * nunca consentiu e adia segue `missing`. Por isso o botão de adiar não escreve nada no banco —
 * só incrementa o contador de sessões, que é do app, não da prova.
 */
import { useState } from 'react'
import { HEALTH_CONSENT_COPY } from '@dosiq/core'
import HealthConsentBlock from './HealthConsentBlock'
import './ConsentPrompt.css'

interface ConsentPromptProps {
  /** `true` = sem saída: o titular já teve as sessões de cortesia. */
  blocking: boolean
  /** Grava o consentimento (RPC `consent_grant` via consentService). */
  onGrant: () => Promise<{ ok: boolean; error?: string }>
  /** Só existe quando `blocking` é falso. */
  onDismiss?: () => void
  /** Chamado após o grant dar certo — o guard revalida o estado. */
  onGranted: () => void
}

export default function ConsentPrompt({ blocking, onGrant, onDismiss, onGranted }: ConsentPromptProps) {
  const [checked, setChecked] = useState(false)
  const [showError, setShowError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!checked) {
      setShowError(true)
      return
    }
    setIsSaving(true)
    setError(null)
    const res = await onGrant()
    setIsSaving(false)

    if (!res.ok) {
      setError('Não foi possível registrar o consentimento agora. Tente de novo.')
      return
    }
    onGranted()
  }

  return (
    <div className="consent-prompt" role="dialog" aria-modal="true" aria-labelledby="consent-prompt-title">
      <div className="consent-prompt-card">
        <h2 id="consent-prompt-title" className="consent-prompt-title">
          {HEALTH_CONSENT_COPY.title}
        </h2>

        <p className="consent-prompt-lead">
          Para continuar usando o dosiq, precisamos da sua autorização para tratar os dados de saúde
          que fazem o app funcionar.
        </p>

        <HealthConsentBlock
          checked={checked}
          onChange={(value) => {
            setChecked(value)
            if (value) setShowError(false)
          }}
          disabled={isSaving}
          showError={showError}
        />

        {error && <div className="consent-prompt-error">{error}</div>}

        <div className="consent-prompt-actions">
          <button
            type="button"
            className="consent-prompt-confirm"
            onClick={handleConfirm}
            disabled={isSaving}
          >
            {isSaving ? 'Registrando...' : 'Autorizar e continuar'}
          </button>

          {!blocking && onDismiss && (
            <button type="button" className="consent-prompt-dismiss" onClick={onDismiss} disabled={isSaving}>
              Agora não
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
