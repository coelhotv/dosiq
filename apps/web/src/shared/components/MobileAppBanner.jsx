import { useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { useIsMobileWeb } from '@shared/hooks/useIsMobileWeb'
import './MobileAppBanner.css'

/** Chave usada no localStorage para persistir o dismiss com TTL de 30 dias. */
const STORAGE_KEY = 'dosiq:app-banner-dismissed'
/** TTL em milissegundos (30 dias). */
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Lê o localStorage e decide se o banner ainda deve estar oculto.
 * Retorna true quando o banner foi dispensado E o TTL de 30 dias ainda não expirou.
 */
function readDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const { dismissedAt } = JSON.parse(raw)
    return Date.now() - dismissedAt < DISMISS_TTL_MS
  } catch {
    return false
  }
}

/**
 * Banner fixo no topo que recomenda o app nativo ao usuário em browser mobile.
 * Não é exibido quando:
 *   - O dispositivo não é mobile (UA/userAgentData)
 *   - O web app já está instalado como PWA standalone
 *   - O usuário dispensou o banner nos últimos 30 dias
 */
export default function MobileAppBanner() {
  const { isMobile, isStandalone } = useIsMobileWeb()

  // States — inicializados com o valor persistido
  const [dismissed, setDismissed] = useState(readDismissed)

  // Não renderizar fora das condições de exibição
  if (!isMobile || isStandalone || dismissed) return null

  // Handlers
  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedAt: Date.now() }))
    } catch {
      // localStorage indisponível (private mode extremo) — ignora silenciosamente
    }
    setDismissed(true)
  }

  return (
    <div className="mobile-app-banner" role="banner" aria-label="Recomendação de app nativo">
      <Smartphone size={16} aria-hidden="true" className="mobile-app-banner__icon" />

      <p className="mobile-app-banner__text">
        Use o Dosiq pelo app — mais rápido e com lembretes
      </p>

      <a
        href="https://dosiq.app/"
        className="mobile-app-banner__cta"
        aria-label="Abrir o Dosiq no app nativo"
        rel="noopener noreferrer"
      >
        Abrir app
      </a>

      <button
        type="button"
        className="mobile-app-banner__close"
        onClick={handleDismiss}
        aria-label="Dispensar banner do app"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
