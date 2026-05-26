import { useMemo } from 'react'

/**
 * Detecta se o usuário está em um dispositivo móvel e se o app está rodando
 * no modo PWA standalone (instalado), para exibir ou ocultar o banner "Abra no app".
 *
 * @returns {{ isMobile: boolean, isStandalone: boolean }}
 *   - isMobile: true quando o UA ou userAgentData indicam dispositivo móvel
 *   - isStandalone: true quando o web app está instalado como PWA (display-mode: standalone
 *     ou navigator.standalone, usado pelo iOS Safari)
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

  return { isMobile, isStandalone }
}
