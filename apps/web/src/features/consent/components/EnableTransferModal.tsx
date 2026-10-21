// EnableTransferModal.tsx — ligar a caixa B (spec 096 `enableB`, guarda 11).
//
// Ligar B é SEMPRE a autorização completa: a mesma frase verbatim da caixa B + "Detalhes ›", nunca
// um botão com nome de recurso ("ativar assistente"). Autorizar só com a caixa marcada; sem ela, o
// mesmo padrão de erro da caixa A (foco + role=alert).

import { useState } from 'react'
import { ENABLE_TRANSFER_COPY } from '@dosiq/core'
import TransferConsentBlock from './TransferConsentBlock'
import './EnableTransferModal.css'

// Copy no core desde a B3 (uma fonte web↔mobile).
export { ENABLE_TRANSFER_COPY }

interface EnableTransferModalProps {
  onAuthorize: () => Promise<boolean>
  onCancel: () => void
}

export default function EnableTransferModal({ onAuthorize, onCancel }: EnableTransferModalProps) {
  const [checked, setChecked] = useState(false)
  const [boxError, setBoxError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (next: boolean) => {
    setChecked(next)
    if (next) setBoxError(false)
  }

  const handleAuthorize = async () => {
    if (!checked) {
      setBoxError(true)
      return
    }
    setSaving(true)
    setError(null)
    // try/finally: rejeição (rede) não pode deixar o modal travado em "Registrando..." (RC6 #898)
    let ok = false
    try {
      ok = await onAuthorize()
    } catch {
      ok = false
    } finally {
      setSaving(false)
    }
    if (!ok) setError('Não foi possível registrar agora. Tente de novo.')
  }

  return (
    <div className="enable-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="enable-transfer-title">
      <div className="enable-transfer-modal__card">
        <h2 id="enable-transfer-title" className="enable-transfer-modal__title">{ENABLE_TRANSFER_COPY.title}</h2>
        <p className="enable-transfer-modal__body">{ENABLE_TRANSFER_COPY.body}</p>

        <TransferConsentBlock
          checked={checked}
          onChange={handleChange}
          disabled={saving}
          errorMessage={boxError ? ENABLE_TRANSFER_COPY.errorNoBox : null}
        />

        {error && <p className="enable-transfer-modal__error" role="alert">{error}</p>}

        <div className="enable-transfer-modal__actions">
          <button type="button" className="enable-transfer-modal__cancel" onClick={onCancel} disabled={saving}>
            {ENABLE_TRANSFER_COPY.cancel}
          </button>
          <button type="button" className="enable-transfer-modal__authorize" onClick={handleAuthorize} disabled={saving}>
            {saving ? 'Registrando...' : ENABLE_TRANSFER_COPY.authorize}
          </button>
        </div>
      </div>
    </div>
  )
}
