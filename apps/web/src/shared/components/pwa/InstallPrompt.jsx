import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'
import InstallInstructionsModal from './InstallInstructionsModal'
import './InstallPrompt.css'
import {
  isStandalone,
  isIOSSafari,
  isChromeAndroid,
  isDesktopChrome,
  canShowNativePrompt,
  wasPromptDismissed,
  dismissPrompt,
  isDismissalExpired,
  getInstallInstructions,
  isPushPermissionGranted,
  supportsWebPush
} from './pwaUtils'
import { webpushService } from '@/shared/services/webpushService'

function getPromptText(platformInfo) {
  if (platformInfo.isStandalone) return { title: 'Habilitar Notificações', description: 'Receba lembretes importantes do seu tratamento no seu dispositivo', buttonText: 'Habilitar' }
  if (platformInfo.isIOSSafari) return { title: 'Adicione à Tela de Início', description: 'Acesse o Dosiq rapidamente como um app instalado', buttonText: 'Ver Como Instalar' }
  if (platformInfo.isChromeAndroid) return { title: 'Instale o Dosiq', description: 'Acesse rapidamente como um app instalado no seu Android', buttonText: 'Instalar Agora' }
  return { title: 'Instale o Dosiq', description: 'Acesse rapidamente como um app nativo no seu computador', buttonText: 'Instalar Agora' }
}

/**
 * Componente de Prompt de Instalação PWA
 * iOS Safari: instruções customizadas | Chrome/Android: prompt nativo ou instruções
 * Dispensável com persistência via localStorage
 */
export default function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [platformInfo, setPlatformInfo] = useState({ isIOSSafari: false, isChromeAndroid: false, isDesktopChrome: false, canShowNativePrompt: false })

  useEffect(() => {
    if (isStandalone() && (!supportsWebPush() || isPushPermissionGranted())) { setIsVisible(false); return }
    if (wasPromptDismissed() && !isDismissalExpired()) { setIsVisible(false); return }

    const isIOS = isIOSSafari()
    const isAndroid = isChromeAndroid()
    const isDesktop = isDesktopChrome()

    setPlatformInfo({ isIOSSafari: isIOS, isChromeAndroid: isAndroid, isDesktopChrome: isDesktop, canShowNativePrompt: canShowNativePrompt(), isStandalone: isStandalone() })

    const needsPush = isStandalone() && supportsWebPush() && !isPushPermissionGranted()
    setIsVisible((!isStandalone() && (isIOS || isAndroid || isDesktop)) || needsPush)
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => { event.preventDefault(); setDeferredPrompt(event) }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const handleDismiss = useCallback(() => { setIsVisible(false); dismissPrompt(30) }, [])

  const handleInstall = useCallback(async () => {
    if (platformInfo.isIOSSafari || platformInfo.isChromeAndroid || platformInfo.isDesktopChrome) {
      if (!deferredPrompt) { setShowIOSInstructions(true); return }
    }
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') setIsVisible(false)
        setDeferredPrompt(null)
      } catch (error) { console.error('[PWA Install] Erro ao exibir prompt:', error) }
      return
    }
    if (platformInfo.isStandalone && supportsWebPush() && !isPushPermissionGranted()) {
      try { await webpushService.subscribe(); setIsVisible(false) }
      catch (error) { console.error('Falha ao assinar Web Push:', error) }
      return
    }
    setShowIOSInstructions(true)
  }, [deferredPrompt, platformInfo])

  const handleCloseInstructions = useCallback(() => { setShowIOSInstructions(false); setIsVisible(false); dismissPrompt(30) }, [])

  const promptText = getPromptText(platformInfo)
  const instructions = getInstallInstructions()

  return (
    <>
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
              <div className="install-prompt__icon" aria-hidden="true"><Download size={24} /></div>
              <div className="install-prompt__text">
                <h3 className="install-prompt__title">{promptText.title}</h3>
                <p className="install-prompt__description">{promptText.description}</p>
              </div>
              <div className="install-prompt__actions">
                <button className="install-prompt__install-btn" onClick={handleInstall} type="button">{promptText.buttonText}</button>
                <button className="install-prompt__dismiss-btn" onClick={handleDismiss} type="button" aria-label="Fechar prompt de instalação">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallInstructionsModal
        showIOSInstructions={showIOSInstructions}
        instructions={instructions}
        platformInfo={platformInfo}
        onClose={handleCloseInstructions}
      />
    </>
  )
}
