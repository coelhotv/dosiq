// TransferConsentCard.tsx — cartão B em Privacidade (spec 096 `priv-*`, S7/S8).
//
// Interruptor "Processamento fora do Brasil". Desligar = confirmação INLINE âmbar com os efeitos
// (nada some do app; os avisos perdem o nome). Ligar = `EnableTransferModal` (autorização completa,
// guarda 11). Sem trava: revogar B nunca bloqueia o app (só A trava — spec 107).
//
// getStatus() LANÇA em falha de leitura — vira estado de erro explícito, nunca "desligado".

import { useCallback, useEffect, useState } from 'react'
import { createConsentService, TRANSFER_TOGGLE_COPY } from '@dosiq/core'
import type { ConsentState } from '@dosiq/core'
import EnableTransferModal from './EnableTransferModal'
import { supabase } from '@shared/utils/supabase'

const consentService = createConsentService({ client: supabase })

// Copy no core desde a B3 (uma fonte web↔mobile); o nome local fica para os consumidores atuais.
export const TRANSFER_CARD_COPY = TRANSFER_TOGGLE_COPY

export default function TransferConsentCard() {
  const [state, setState] = useState<ConsentState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmOff, setConfirmOff] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [offError, setOffError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setState(await consentService.getStatus('international_transfer'))
    } catch {
      setState(null)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const isOn = state?.status === 'granted'

  const handleToggle = () => {
    if (isOn) setConfirmOff(true)
    else setEnabling(true)
  }

  const handleAuthorize = async () => {
    const res = await consentService.grant('international_transfer', 'web')
    if (res.ok) {
      setEnabling(false)
      await load()
    }
    return res.ok
  }

  // Falha (ex.: sem conexão) mantém a confirmação aberta com o erro — fechar calado deixaria o
  // interruptor ligado sem explicar por quê (smoke B2 3.9).
  const handleTurnOff = async () => {
    setSaving(true)
    setOffError(false)
    let ok = false
    try {
      ok = (await consentService.revoke('international_transfer', 'web')).ok
    } catch {
      ok = false
    }
    setSaving(false)
    if (!ok) {
      setOffError(true)
      return
    }
    setConfirmOff(false)
    await load()
  }

  return (
    <div className="privacy-consent-section__card privacy-consent-section__card--transfer">
      <div className="privacy-consent-section__toggle-row">
        <span id="transfer-toggle-label" className="privacy-consent-section__status-label">{TRANSFER_CARD_COPY.toggle}</span>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-labelledby="transfer-toggle-label"
          className={`privacy-consent-section__switch${isOn ? ' privacy-consent-section__switch--on' : ''}`}
          onClick={handleToggle}
          disabled={loading || loadError || saving || confirmOff}
        >
          <span className="privacy-consent-section__switch-thumb" />
        </button>
      </div>

      {loadError ? (
        <button type="button" className="privacy-consent-section__retry" onClick={load}>
          Tentar de novo
        </button>
      ) : (
        !loading && <p className="privacy-consent-section__meta">{isOn ? TRANSFER_CARD_COPY.on : TRANSFER_CARD_COPY.off}</p>
      )}

      {confirmOff && (
        <div className="privacy-consent-section__confirm privacy-consent-section__confirm--warning" role="group" aria-label={TRANSFER_CARD_COPY.offTitle}>
          <p className="privacy-consent-section__confirm-title">{TRANSFER_CARD_COPY.offTitle}</p>
          <ul className="privacy-consent-section__confirm-list">
            {TRANSFER_CARD_COPY.offEffects.map((e) => <li key={e}>{e}</li>)}
          </ul>
          {offError && <p className="privacy-consent-section__error" role="alert">{TRANSFER_CARD_COPY.offError}</p>}
          <div className="privacy-consent-section__confirm-actions">
            <button type="button" onClick={() => { setConfirmOff(false); setOffError(false) }} disabled={saving}>
              {TRANSFER_CARD_COPY.offKeep}
            </button>
            <button type="button" className="privacy-consent-section__confirm-warning-btn" onClick={handleTurnOff} disabled={saving}>
              {saving ? 'Desligando...' : TRANSFER_CARD_COPY.offConfirm}
            </button>
          </div>
        </div>
      )}

      {enabling && <EnableTransferModal onAuthorize={handleAuthorize} onCancel={() => setEnabling(false)} />}
    </div>
  )
}
