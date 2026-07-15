// PrivacyConsentSection.tsx — card "Consentimento" (spec 046, T012, espelho web).
//
// Espelha o card mobile do hub PrivacyDataScreen: estado vigente (Ativo/Retirado/Não informado),
// versão aceita + data (fonte: consentService.getStatus, via consent_log) e a ação de retirar
// com confirmação de DUAS etapas mostrando HEALTH_CONSENT_COPY.revokeWarning.
//
// ⚠️ getStatus() LANÇA em falha de leitura (contrato do Slice A) — vira estado de ERRO
// explícito aqui, nunca "não informado" (ver useConsentGate.tsx para o mesmo cuidado).
//
// Componente NOVO, ainda não pendurado em nenhuma view (o Principal decide onde plugar).

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, ShieldQuestion } from 'lucide-react'
import { HEALTH_CONSENT_COPY, createConsentService, parseISO } from '@dosiq/core'
import type { ConsentState } from '@dosiq/core'
import { supabase } from '@shared/utils/supabase'
import './PrivacyConsentSection.css'

const consentService = createConsentService({ client: supabase })

/** dd/mm/aaaa a partir de um timestamp ISO — só formatação de exibição. */
function formatConsentDate(iso: string): string {
  const d = parseISO(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export default function PrivacyConsentSection() {
  const [state, setState] = useState<ConsentState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0)
  const [revoking, setRevoking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const current = await consentService.getStatus('health_data')
      setState(current)
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

  const handleRevoke = async () => {
    setRevoking(true)
    const res = await consentService.revoke('health_data', 'web')
    setRevoking(false)
    setConfirmStep(0)
    if (res.ok) await load()
  }

  // Resolvido UMA vez — evita repetir o mesmo encadeamento loading/erro/status em 2 lugares
  // (label, ícone), que é o que inflava a complexidade ciclomática do componente.
  const resolved: 'loading' | 'error' | 'missing' | 'granted' | 'revoked' = loading
    ? 'loading'
    : loadError
      ? 'error'
      : (state?.status ?? 'missing')

  const STATUS_META = {
    loading: { label: 'Carregando...', Icon: ShieldQuestion },
    error: { label: 'Não foi possível carregar', Icon: ShieldQuestion },
    missing: { label: 'Não informado', Icon: ShieldQuestion },
    granted: { label: 'Ativo', Icon: ShieldCheck },
    revoked: { label: 'Retirado', Icon: ShieldOff },
  } as const

  const { label: statusLabel, Icon: StatusIcon } = STATUS_META[resolved]

  return (
    <div className="privacy-consent-section">
      <p className="privacy-consent-section__label">CONSENTIMENTO</p>
      <div className="privacy-consent-section__card">
        <div className="privacy-consent-section__status-row">
          <StatusIcon size={18} />
          <span className="privacy-consent-section__status-label">{statusLabel}</span>
        </div>

        {!loading && !loadError && state?.status === 'granted' && state.updatedAt && (
          <p className="privacy-consent-section__meta">
            Aceito em {formatConsentDate(state.updatedAt)}
            {state.policyVersion ? ` · v${state.policyVersion}` : ''}
          </p>
        )}

        {loadError && (
          <button type="button" className="privacy-consent-section__retry" onClick={load}>
            Tentar de novo
          </button>
        )}

        {!loading && !loadError && state?.status === 'granted' && (
          <>
            {confirmStep === 0 && (
              <button
                type="button"
                className="privacy-consent-section__revoke"
                onClick={() => setConfirmStep(1)}
              >
                Retirar consentimento
              </button>
            )}

            {confirmStep === 1 && (
              <div className="privacy-consent-section__confirm">
                <p className="privacy-consent-section__confirm-text">
                  {HEALTH_CONSENT_COPY.revokeWarning}
                </p>
                <div className="privacy-consent-section__confirm-actions">
                  <button type="button" onClick={() => setConfirmStep(0)}>
                    Cancelar
                  </button>
                  <button type="button" onClick={() => setConfirmStep(2)}>
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {confirmStep === 2 && (
              <div className="privacy-consent-section__confirm">
                <p className="privacy-consent-section__confirm-text">
                  Tem certeza? O app ficará bloqueado até você exportar, excluir a conta ou
                  consentir novamente.
                </p>
                <div className="privacy-consent-section__confirm-actions">
                  <button type="button" onClick={() => setConfirmStep(0)} disabled={revoking}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="privacy-consent-section__confirm-danger"
                    onClick={handleRevoke}
                    disabled={revoking}
                  >
                    {revoking ? 'Retirando...' : 'Retirar consentimento'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
