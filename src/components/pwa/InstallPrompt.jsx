import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './InstallPrompt.css'
import {
  isStandalone,
  isIOSSafari,
  isChromeAndroid,
  isDesktopChrome,
  wasPromptDismissed,
  dismissPrompt,
  isDismissalExpired,
  getInstallInstructions
} from './pwaUtils'

/**
 * PWA Install Prompt Component
 * 
 * Displays an install prompt for users on supported platforms.
 * - iOS Safari: Shows custom instructions for "Add to Home Screen"
 * - Chrome/Android & Desktop: Shows native install button or custom instructions
 * - Dismissible with localStorage persistence
 * - Hides when app is already installed (standalone mode)
 */
export default function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [platformInfo, setPlatformInfo] = useState({
    isIOSSafari: false,
    isChromeAndroid: false,
    isDesktopChrome: false
  })

  // Detect platform and check if prompt should be shown
  useEffect(() => {
    const checkVisibility = () => {
      console.log('[PWA Install] Checking visibility...')
      
      // Don't show if already in standalone mode
      if (isStandalone()) {
        console.log('[PWA Install] Hidden: Running in standalone mode')
        setIsVisible(false)
        return
      }

      // Don't show if user recently dismissed
      if (wasPromptDismissed() && !isDismissalExpired()) {
        console.log('[PWA Install] Hidden: Recently dismissed')
        setIsVisible(false)
        return
      }

      // Detect platform
      const isIOS = isIOSSafari()
      const isAndroid = isChromeAndroid()
      const isDesktop = isDesktopChrome()
      
      console.log('[PWA Install] Platform detection:', { isIOS, isAndroid, isDesktop })
      console.log('[PWA Install] User agent:', navigator.userAgent)

      setPlatformInfo({
        isIOSSafari: isIOS,
        isChromeAndroid: isAndroid,
        isDesktopChrome: isDesktop
      })

      // Show prompt for supported platforms
      const shouldShow = isIOS || isAndroid || isDesktop
      console.log('[PWA Install] Should show banner:', shouldShow)
      setIsVisible(shouldShow)
    }

    checkVisibility()
  }, [])

  // Listen for beforeinstallprompt event (Chrome/Edge)
  useEffect(() => {
    console.log('[PWA Install] Setting up beforeinstallprompt listener')
    
    const handleBeforeInstallPrompt = (event) => {
      console.log('[PWA Install] beforeinstallprompt event fired!')
      // Prevent the default browser prompt
      event.preventDefault()
      // Store the event for later use
      setDeferredPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    
    // Check if event was already fired (before this component mounted)
    console.log('[PWA Install] Component mounted, checking for deferred prompt...')

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    dismissPrompt(30) // Remember dismissal for 30 days
  }, [])

  // Handle install click
  const handleInstall = useCallback(async () => {
    console.log('[PWA Install] Button clicked')
    console.log('[PWA Install] Platform info:', platformInfo)
    console.log('[PWA Install] Deferred prompt available:', !!deferredPrompt)
    
    // iOS Safari - show instructions
    if (platformInfo.isIOSSafari) {
      console.log('[PWA Install] iOS Safari detected - showing instructions')
      setShowIOSInstructions(true)
      return
    }

    // Chrome/Edge with deferred prompt
    if (deferredPrompt) {
      console.log('[PWA Install] Triggering deferred prompt...')
      try {
        // Show the native install prompt
        deferredPrompt.prompt()
        
        // Wait for user choice
        const { outcome } = await deferredPrompt.userChoice
        console.log('[PWA Install] User choice outcome:', outcome)
        
        if (outcome === 'accepted') {
          setIsVisible(false)
        }
        
        // Clear the deferred prompt
        setDeferredPrompt(null)
      } catch (error) {
        console.error('[PWA Install] Error showing prompt:', error)
      }
      return
    }

    // Chrome Android without deferred prompt - show manual instructions
    if (platformInfo.isChromeAndroid) {
      console.log('[PWA Install] Chrome Android without deferred prompt - showing instructions')
      setShowIOSInstructions(true) // Reuse the instructions modal
      return
    }
    
    console.log('[PWA Install] No matching platform handler - browser may not support PWA install')
  }, [deferredPrompt, platformInfo])

  // Close instructions modal
  const handleCloseInstructions = useCallback(() => {
    setShowIOSInstructions(false)
    setIsVisible(false)
    dismissPrompt(30)
  }, [])

  // Get appropriate text based on platform
  const getPromptText = () => {
    if (platformInfo.isIOSSafari) {
      return {
        title: 'Adicione à Tela de Início',
        description: 'Acesse o Meus Remédios rapidamente como um app nativo',
        buttonText: 'Ver Como Instalar'
      }
    }
    
    if (platformInfo.isChromeAndroid) {
      return {
        title: 'Instale o Meus Remédios',
        description: 'Acesse rapidamente como um app nativo no seu Android',
        buttonText: 'Instalar Agora'
      }
    }
    
    return {
      title: 'Instale o Meus Remédios',
      description: 'Acesse rapidamente como um app nativo no seu computador',
      buttonText: 'Instalar Agora'
    }
  }

  const promptText = getPromptText()
  const instructions = getInstallInstructions()

  return (
    <>
      {/* Main Install Prompt Banner */}
      <AnimatePresence>
        {isVisible && !showIOSInstructions && (
          <motion.div
            className="install-prompt"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-label="Prompt de instalação do app"
          >
            <div className="install-prompt__content">
              {/* App Icon */}
              <div className="install-prompt__icon">
                <span role="img" aria-label="Ícone do app">💊</span>
              </div>

              {/* Text Content */}
              <div className="install-prompt__text">
                <h3 className="install-prompt__title">{promptText.title}</h3>
                <p className="install-prompt__description">
                  {promptText.description}
                </p>
              </div>

              {/* Actions */}
              <div className="install-prompt__actions">
                <button
                  className="install-prompt__install-btn"
                  onClick={handleInstall}
                  type="button"
                >
                  {promptText.buttonText}
                </button>
                <button
                  className="install-prompt__dismiss-btn"
                  onClick={handleDismiss}
                  type="button"
                  aria-label="Fechar prompt de instalação"
                >
                  ✕
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS/Android Instructions Modal */}
      <AnimatePresence>
        {showIOSInstructions && (
          <motion.div
            className="install-prompt__modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseInstructions}
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-instructions-title"
          >
            <motion.div
              className="install-prompt__modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="install-prompt__modal-header">
                <span className="install-prompt__modal-icon" role="img" aria-label="Ícone">
                  {instructions.icon}
                </span>
                <h3 id="install-instructions-title" className="install-prompt__modal-title">
                  {instructions.title}
                </h3>
                <button
                  className="install-prompt__modal-close"
                  onClick={handleCloseInstructions}
                  type="button"
                  aria-label="Fechar instruções"
                >
                  ✕
                </button>
              </div>

              <div className="install-prompt__modal-content">
                <ol className="install-prompt__steps">
                  {instructions.steps.map((step, index) => (
                    <li key={index} className="install-prompt__step">
                      <span className="install-prompt__step-number">{index + 1}</span>
                      <span className="install-prompt__step-text">{step}</span>
                    </li>
                  ))}
                </ol>

                {platformInfo.isIOSSafari && (
                  <div className="install-prompt__ios-hint">
                    <span role="img" aria-label="Dica">💡</span>
                    <span>Procure o botão 
                      <svg 
                        className="install-prompt__share-icon" 
                        viewBox="0 0 24 24" 
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M16 5l-1.42-1.42-4.58 4.59V0h-2v8.17L3.42 3.58 2 5l7 7 7-7zm7 6v8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-8H0v8c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-8h-2z" />
                      </svg>
                      {' '}na barra do Safari
                    </span>
                  </div>
                )}
              </div>

              <div className="install-prompt__modal-footer">
                <button
                  className="install-prompt__modal-btn"
                  onClick={handleCloseInstructions}
                  type="button"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}