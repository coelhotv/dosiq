import { useMemo } from 'react'

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
export function useIsMobileWeb() {
  // Memos — calculados uma única vez (UA e matchMedia não mudam durante a sessão)
  const isMobile = useMemo(() => {
    // Guard SSR/testes (Vitest em Node sem DOM completo)
    if (typeof navigator === 'undefined') return false
    // Preferir a API moderna quando disponível (Chromium 90+)
    if (navigator.userAgentData?.mobile !== undefined) {
      return navigator.userAgentData.mobile
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
    if (navigator.standalone === true) return true
    // Todos os outros browsers (Chrome, Firefox, Samsung…)
    return window.matchMedia('(display-mode: standalone)').matches
  }, [])

  const isIOSSafari = useMemo(() => {
    // Guard SSR/testes
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    // Safari de verdade: tem "Safari" mas NÃO os marcadores de Chrome/Firefox/Edge
    // no iOS (CriOS = Chrome iOS, FxiOS = Firefox iOS, EdgiOS = Edge iOS).
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua)
    return isIOS && isSafari
  }, [])

  return { isMobile, isStandalone, isIOSSafari }
}
