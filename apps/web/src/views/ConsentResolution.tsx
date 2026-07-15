// ConsentResolution.tsx — tela travada de resolução da revogação (spec 046, T010, web).
//
// Espelho web da ConsentResolutionScreen mobile. Anti-deadlock (R2/F8): TRÊS saídas SEMPRE
// acessíveis — exportar (view 'profile', onde vive o ExportDialog do 008), excluir (view
// 'account-settings') e re-consentir (consentService.grant via useConsentGate). O guard usa
// ALLOWLIST, não denylist — nenhuma destas saídas pode desaparecer condicionalmente.

import { useState } from 'react'
import { ShieldAlert, FileDown, Trash2, RotateCcw } from 'lucide-react'
import { HEALTH_CONSENT_COPY } from '@dosiq/core'
import { useConsentGate } from '@shared/hooks/useConsentGate'
import ConsentPrompt from '@features/consent/components/ConsentPrompt'
import ExportDialog from '@features/export/components/ExportDialog'
import './ConsentResolution.css'

interface ConsentResolutionProps {
  onNavigate: (view: string) => void
  /** Chamado após o grant dar certo — quem monta a tela decide pra onde ir (ex.: dashboard). */
  onReconsented?: () => void
}

export default function ConsentResolution({ onNavigate, onReconsented }: ConsentResolutionProps) {
  const { grant } = useConsentGate()
  const [reconsenting, setReconsenting] = useState(false)
  const [showExport, setShowExport] = useState(false)

  // Export INLINE (dialog sobre a resolução), não navegando pro perfil: sem sidebar durante a
  // trava, navegar pra outra view deixaria o titular sem volta óbvia. Fechar o dialog volta pra cá.
  const handleDelete = () => onNavigate('account-settings')

  // 🔴 "Voltar a consentir" NÃO concede num clique. Consentimento de dado sensível de saúde (LGPD
  // art. 11) tem que ser livre, INFORMADO e INEQUÍVOCO (art. 5º XII): o titular revê a copy do
  // opt-in e MARCA o checkbox de novo. Reativar com um toque seria consentimento presumido — o
  // mesmo vício que o gate combate no signup e no card.
  if (reconsenting) {
    return (
      <ConsentPrompt
        blocking={false}
        onGrant={grant}
        onDismiss={() => setReconsenting(false)}
        onGranted={() => { onReconsented?.() }}
      />
    )
  }

  return (
    <div className="consent-resolution">
      <div className="consent-resolution__card">
        <div className="consent-resolution__icon">
          <ShieldAlert size={26} />
        </div>
        <h1 className="consent-resolution__title">Consentimento retirado</h1>
        <p className="consent-resolution__description">{HEALTH_CONSENT_COPY.revokeWarning}</p>

        <button
          type="button"
          className="consent-resolution__option"
          onClick={() => setShowExport(true)}
          aria-label="Exportar meus dados"
        >
          <FileDown size={20} />
          <span className="consent-resolution__option-body">
            <span className="consent-resolution__option-title">Exportar meus dados</span>
            <span className="consent-resolution__option-subtitle">
              Leve seus dados antes de decidir.
            </span>
          </span>
        </button>

        <button
          type="button"
          className="consent-resolution__option consent-resolution__option--danger"
          onClick={handleDelete}
          aria-label="Excluir minha conta"
        >
          <Trash2 size={20} />
          <span className="consent-resolution__option-body">
            <span className="consent-resolution__option-title consent-resolution__option-title--danger">
              Excluir minha conta
            </span>
            <span className="consent-resolution__option-subtitle">
              Apaga tudo agora, sem esperar os 90 dias.
            </span>
          </span>
        </button>

        <button
          type="button"
          className="consent-resolution__option consent-resolution__option--primary"
          onClick={() => setReconsenting(true)}
          aria-label="Voltar a consentir"
        >
          <RotateCcw size={20} />
          <span className="consent-resolution__option-body">
            <span className="consent-resolution__option-title consent-resolution__option-title--inverse">
              Voltar a consentir
            </span>
            <span className="consent-resolution__option-subtitle consent-resolution__option-subtitle--inverse">
              Você revê a autorização e confirma.
            </span>
          </span>
        </button>
      </div>

      <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} />
    </div>
  )
}
