/**
 * PWA Detection Utilities
 *
 * Helper functions to detect PWA installation state, browser capabilities,
 * and platform-specific behaviors.
 */

/**
 * Check if the app is running in standalone mode (installed as PWA)
 * @returns {boolean} True if running as installed PWA
 */
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  )
}

/**
 * Check if the browser is iOS Safari
 * @returns {boolean} True if running on iOS Safari
 */
export function isIOSSafari() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(userAgent)
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent)

  return isIOS && isSafari
}

/**
 * Check if the browser is Chrome on Android
 * @returns {boolean} True if running on Chrome Android
 */
export function isChromeAndroid() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isAndroid = /android/.test(userAgent)
  const isChrome = /chrome/.test(userAgent) && /mobile/.test(userAgent)

  return isAndroid && isChrome
}

/**
 * Check if the browser supports beforeinstallprompt event (Chrome/Edge)
 * @returns {boolean} True if beforeinstallprompt is supported
 */
export function supportsBeforeInstallPrompt() {
  return 'BeforeInstallPromptEvent' in window
}

/**
 * Check if the browser is desktop Chrome/Edge/Opera (Chromium-based)
 * @returns {boolean} True if desktop Chromium browser
 */
export function isDesktopChrome() {
  const userAgent = window.navigator.userAgent.toLowerCase()

  console.log('[PWA Utils] isDesktopChrome - User agent:', userAgent)

  // More flexible detection for Chrome on any platform (including macOS)
  const hasChrome = /chrome|chromium/.test(userAgent)
  const hasEdge = /edg|edge/.test(userAgent)
  const hasOpera = /opr|opera/.test(userAgent)
  const hasBrave = /brave/.test(userAgent)
  const hasMobile = /mobile|android/.test(userAgent)

  const isChrome = hasChrome && !hasMobile
  const isEdge = hasEdge && !hasMobile
  const isOpera = hasOpera && !hasMobile
  const isBraveBrowser = hasBrave && !hasMobile

  const result = isChrome || isEdge || isOpera || isBraveBrowser

  console.log('[PWA Utils] Detection:', {
    hasChrome,
    hasEdge,
    hasOpera,
    hasBrave,
    hasMobile,
    isChrome,
    isEdge,
    isOpera,
    isBraveBrowser,
    result,
  })

  // Show banner for ANY Chromium desktop browser, not just those with beforeinstallprompt
  return result
}

/**
 * Check if the browser supports native beforeinstallprompt event
 * @returns {boolean} True if BeforeInstallPromptEvent is supported
 */
export function canShowNativePrompt() {
  return supportsBeforeInstallPrompt()
}

/**
 * Check if browser is any Chromium-based browser that might support PWA
 * @returns {boolean} True if Chromium-based desktop browser
 */
export function isChromiumDesktop() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isDesktop = !/mobile|android|iphone|ipad|ipod/.test(userAgent)
  const isChrome = /chrome|chromium/.test(userAgent)
  const isEdge = /edg|edge/.test(userAgent)
  const isOpera = /opr|opera/.test(userAgent)
  const isBrave = /brave/.test(userAgent)

  return isDesktop && (isChrome || isEdge || isOpera || isBrave)
}

/**
 * Check if the prompt was previously dismissed by the user
 * @returns {boolean} True if user dismissed the prompt
 */
export function wasPromptDismissed() {
  try {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    return dismissed === 'true'
  } catch {
    return false
  }
}

/**
 * Mark the prompt as dismissed by the user
 * @param {number} days - Number of days to remember dismissal (default: 30)
 */
export function dismissPrompt(days = 30) {
  try {
    localStorage.setItem('pwa-install-dismissed', 'true')
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + days)
    localStorage.setItem('pwa-install-dismissed-expiry', expiryDate.toISOString())
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Reset the dismissed state (useful for testing or after expiry)
 */
export function resetDismissedState() {
  try {
    localStorage.removeItem('pwa-install-dismissed')
    localStorage.removeItem('pwa-install-dismissed-expiry')
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if the dismissal has expired
 * @returns {boolean} True if dismissal has expired or doesn't exist
 */
export function isDismissalExpired() {
  try {
    const expiry = localStorage.getItem('pwa-install-dismissed-expiry')
    if (!expiry) return true

    return new Date() > new Date(expiry)
  } catch {
    return true
  }
}

/**
 * Get the appropriate install instructions based on platform
 * @returns {Object} Install instructions for the current platform
 */
export function getInstallInstructions() {
  if (isIOSSafari()) {
    return {
      title: 'Adicionar à Tela de Início',
      steps: [
        'Toque no botão Compartilhar no Safari',
        'Role para baixo e toque em "Adicionar à Tela de Início"',
        'Toque em "Adicionar" para confirmar',
      ],
      icon: '📱',
    }
  }

  if (isChromeAndroid()) {
    return {
      title: 'Instalar o App',
      steps: [
        'Toque no menu (⋮) no Chrome',
        'Selecione "Adicionar à tela inicial"',
        'Confirme para instalar',
      ],
      icon: '📲',
    }
  }

  // Desktop Chrome/Edge
  return {
    title: 'Instalar o App',
    steps: ['Clique em "Instalar" no prompt', 'Ou use o menu (⋮) > Instalar Meus Remédios'],
    icon: '💻',
  }
}

/**
 * Comprehensive PWA state detection
 * @returns {Object} Complete PWA state information
 */
export function getPWAState() {
  return {
    isStandalone: isStandalone(),
    isIOSSafari: isIOSSafari(),
    isChromeAndroid: isChromeAndroid(),
    isDesktopChrome: isDesktopChrome(),
    supportsBeforeInstallPrompt: supportsBeforeInstallPrompt(),
    wasDismissed: wasPromptDismissed() && !isDismissalExpired(),
    canShowPrompt: !isStandalone() && (!wasPromptDismissed() || isDismissalExpired()),
  }
}
