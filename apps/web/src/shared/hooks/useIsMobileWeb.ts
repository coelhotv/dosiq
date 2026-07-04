import { useMemo } from 'react'
import { isIOSSafari as detectIOSSafari } from '@shared/components/pwa/pwaUtils'

interface NavigatorUAData {
  mobile?: boolean
}

interface NavigatorWithExtras extends Navigator {
  userAgentData?: NavigatorUAData
  standalone?: boolean
}

export interface UseIsMobileWebResult {
  isMobile: boolean
  isStandalone: boolean
  isIOSSafari: boolean
}

/**
 * Detecta se o usuário está em um dispositivo móvel e se o app está rodando
 * no modo PWA standalone (instalado), para exibir ou ocultar o banner "Abra no app".
 *
 * @returns {{ isMobile: boolean, isStandalone: boolean, isIOSSafari: boolean }}
 *   - isMobile: true quando o UA ou userAgentData indicam dispositivo móvel
 *   - isStandalone: true quando o web app está instalado como PWA (display-mode: standalone
 *     ou navigator.standalone, usado pelo iOS Safari)
 *   - isIOSSafari: true no Safari iOS — onde o Smart App Banner nativo
 *     (`apple-itunes-app`) já cobre o "abra no app", então o banner custom é suprimido
 */
export function useIsMobileWeb(): UseIsMobileWebResult {
  // Memos — calculados uma única vez (UA e matchMedia não mudam durante a sessão)
  const isMobile = useMemo(() => {
    // Guard SSR/testes (Vitest em Node sem DOM completo)
    if (typeof navigator === 'undefined') return false
    const nav = navigator as NavigatorWithExtras
    // Preferir a API moderna quando disponível (Chromium 90+)
    if (nav.userAgentData?.mobile !== undefined) {
      return nav.userAgentData.mobile
    }
    // Fallback: regex clássica de UA
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
      navigator.userAgent || ''
    )
  }, [])

  const isStandalone = useMemo(() => {
    // Guard SSR/testes
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    // iOS Safari expõe navigator.standalone
    if ((navigator as NavigatorWithExtras).standalone === true) return true
    // Todos os outros browsers (Chrome, Firefox, Samsung…)
    return window.matchMedia('(display-mode: standalone)').matches
  }, [])

  // Fonte única de verdade — reusa pwaUtils.isIOSSafari (mesma detecção usada
  // pelas instruções de PWA install), evitando lógica duplicada e divergente.
  const isIOSSafari = useMemo(() => detectIOSSafari(), [])

  return { isMobile, isStandalone, isIOSSafari }
}
