/**
 * Utilitários de Detecção PWA
 *
 * Funções auxiliares para detectar estado de instalação do PWA,
 * capacidades do navegador e comportamentos específicos por plataforma.
 */

/**
 * Verifica se o app está rodando em modo standalone (instalado como PWA)
 * @returns {boolean} Verdadeiro se estiver rodando como PWA instalado
 */
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  )
}

/**
 * Verifica se o navegador é o iOS Safari
 * @returns {boolean} Verdadeiro se estiver rodando no iOS Safari
 */
export function isIOSSafari() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(userAgent)
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent)

  return isIOS && isSafari
}

/**
 * Verifica se o navegador é o Chrome no Android
 * @returns {boolean} Verdadeiro se estiver rodando no Chrome Android
 */
export function isChromeAndroid() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isAndroid = /android/.test(userAgent)
  const isChrome = /chrome/.test(userAgent) && /mobile/.test(userAgent)

  return isAndroid && isChrome
}

/**
 * Verifica se o navegador suporta o evento beforeinstallprompt (Chrome/Edge)
 * @returns {boolean} Verdadeiro se beforeinstallprompt for suportado
 */
export function supportsBeforeInstallPrompt() {
  return 'BeforeInstallPromptEvent' in window
}

/**
 * Verifica se o navegador é desktop Chrome/Edge/Opera (baseado em Chromium)
 * @returns {boolean} Verdadeiro se for um navegador Chromium desktop
 */
export function isDesktopChrome() {
  const userAgent = window.navigator.userAgent.toLowerCase()

  // Detecção flexível para Chrome em qualquer plataforma desktop (incluindo macOS)
  const hasChrome = /chrome|chromium/.test(userAgent)
  const hasEdge = /edg|edge/.test(userAgent)
  const hasOpera = /opr|opera/.test(userAgent)
  const hasBrave = /brave/.test(userAgent)
  const hasMobile = /mobile|android/.test(userAgent)

  const isChrome = hasChrome && !hasMobile
  const isEdge = hasEdge && !hasMobile
  const isOpera = hasOpera && !hasMobile
  const isBraveBrowser = hasBrave && !hasMobile

  // Exibe o banner para qualquer navegador Chromium desktop
  return isChrome || isEdge || isOpera || isBraveBrowser
}

/**
 * Verifica se o navegador suporta o evento nativo beforeinstallprompt
 * @returns {boolean} Verdadeiro se BeforeInstallPromptEvent for suportado
 */
export function canShowNativePrompt() {
  return supportsBeforeInstallPrompt()
}

/**
 * Verifica se o navegador é qualquer Chromium desktop com suporte a PWA
 * @returns {boolean} Verdadeiro se for navegador Chromium desktop
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
 * Verifica se o prompt foi dispensado anteriormente pelo usuário
 * @returns {boolean} Verdadeiro se o usuário dispensou o prompt
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
 * Marca o prompt como dispensado pelo usuário
 * @param {number} days - Número de dias para lembrar da dispensa (padrão: 30)
 */
export function dismissPrompt(days = 30) {
  try {
    localStorage.setItem('pwa-install-dismissed', 'true')
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + days)
    localStorage.setItem('pwa-install-dismissed-expiry', expiryDate.toISOString())
  } catch {
    // Ignora erros de localStorage
  }
}

/**
 * Redefine o estado de dispensa (útil para testes ou após expiração)
 */
export function resetDismissedState() {
  try {
    localStorage.removeItem('pwa-install-dismissed')
    localStorage.removeItem('pwa-install-dismissed-expiry')
  } catch {
    // Ignora erros de localStorage
  }
}

/**
 * Verifica se a dispensa expirou
 * @returns {boolean} Verdadeiro se a dispensa expirou ou não existe
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
 * Retorna as instruções de instalação adequadas à plataforma atual
 * @returns {Object} Instruções de instalação para a plataforma atual
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
 * Detecção completa do estado PWA
 * @returns {Object} Informações completas sobre o estado PWA atual
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
