// EnableTransferModal.tsx — ligar a caixa B (spec 096 `enableB`, guarda 11).
//
// Ligar B é SEMPRE a autorização completa: a mesma frase verbatim da caixa B + "Detalhes ›", nunca
// um botão com nome de recurso ("ativar assistente"). Autorizar só com a caixa marcada; sem ela, o
// mesmo padrão de erro da caixa A (foco + role=alert).

import { useState } from 'react'
import TransferConsentBlock from './TransferConsentBlock'
import './EnableTransferModal.css'

export const ENABLE_TRANSFER_COPY = Object.freeze({
  title: 'Ligar o processamento fora do Brasil',
  body: 'Permite os três juntos: lembretes com o nome do remédio, assistente IA e medições de uso.',
  authorize: 'Autorizar',
  cancel: 'Cancelar',
  errorNoBox: 'Marque a autorização para ligar.',
})

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
    const ok = await onAuthorize()
    setSaving(false)
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
