import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'
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

/**
 * Componente de Prompt de Instalação PWA
 *
 * Exibe um prompt de instalação para usuários em plataformas suportadas.
 * - iOS Safari: Mostra instruções customizadas para "Adicionar à Tela de Início"
 * - Chrome/Android e Desktop: Mostra botão de instalação nativo ou instruções customizadas
 * - Dispensável com persistência via localStorage
 * - Oculto quando o app já está instalado (modo standalone)
 */
export default function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [platformInfo, setPlatformInfo] = useState({
    isIOSSafari: false,
    isChromeAndroid: false,
    isDesktopChrome: false,
    canShowNativePrompt: false,
  })

  // Detecta plataforma e verifica se o prompt deve ser exibido
  useEffect(() => {
    const checkVisibility = () => {
      // Não exibir se já estiver em modo standalone E já tem permissões (ou não suporta Push)
      if (isStandalone() && (!supportsWebPush() || isPushPermissionGranted())) {
        setIsVisible(false)
        return
      }

      // Não exibir se o usuário dispensou recentemente
      if (wasPromptDismissed() && !isDismissalExpired()) {
        setIsVisible(false)
        return
      }

      // Detecta plataforma
      const isIOS = isIOSSafari()
      const isAndroid = isChromeAndroid()
      const isDesktop = isDesktopChrome()

      setPlatformInfo({
        isIOSSafari: isIOS,
        isChromeAndroid: isAndroid,
        isDesktopChrome: isDesktop,
        canShowNativePrompt: canShowNativePrompt(),
        isStandalone: isStandalone(),
      })

      // Exibe o prompt para plataformas suportadas, ou se já está standalone e falta permissão Push
      const needsPush = isStandalone() && supportsWebPush() && !isPushPermissionGranted()
      const shouldShow = (!isStandalone() && (isIOS || isAndroid || isDesktop)) || needsPush
      setIsVisible(shouldShow)
    }

    checkVisibility()
  }, [])

  // Escuta o evento beforeinstallprompt (Chrome/Edge)
  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      // Previne o prompt padrão do navegador
      event.preventDefault()
      // Armazena o evento para uso posterior
      setDeferredPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // Trata a ação de dispensar o prompt
  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    dismissPrompt(30) // Lembra da dispensa por 30 dias
  }, [])

  // Trata o clique no botão de instalação
  const handleInstall = useCallback(async () => {
    // iOS Safari - exibe instruções
    if (platformInfo.isIOSSafari) {
      setShowIOSInstructions(true)
      return
    }

    // Chrome/Edge com prompt adiado disponível
    if (deferredPrompt) {
      try {
        // Exibe o prompt nativo de instalação
        deferredPrompt.prompt()

        // Aguarda a escolha do usuário
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
          setIsVisible(false)
        }

        // Limpa o prompt adiado
        setDeferredPrompt(null)
      } catch (error) {
        console.error('[PWA Install] Erro ao exibir prompt:', error)
      }
      return
    }

    // Se já é standalone e suporta Web Push, mas não concedeu ainda, tentar assinar
    if (platformInfo.isStandalone && supportsWebPush() && !isPushPermissionGranted()) {
      try {
        await webpushService.subscribe()
        setIsVisible(false)
      } catch (error) {
        console.error('Falha ao assinar Web Push:', error)
      }
      return
    }

    // Chrome Android sem prompt adiado - exibe instruções manuais
    if (platformInfo.isChromeAndroid) {
      setShowIOSInstructions(true) // Reutiliza o modal de instruções
      return
    }

    // Desktop Chrome/Edge sem prompt adiado (comum em dev/localhost)
    // Exibe instruções em vez de não fazer nada
    if (platformInfo.isDesktopChrome) {
      setShowIOSInstructions(true)
      return
    }
  }, [deferredPrompt, platformInfo])

  // Fecha o modal de instruções
  const handleCloseInstructions = useCallback(() => {
    setShowIOSInstructions(false)
    setIsVisible(false)
    dismissPrompt(30)
  }, [])

  // Retorna texto adequado conforme a plataforma
  const getPromptText = () => {
    if (platformInfo.isStandalone) {
      return {
        title: 'Habilitar Notificações',
        description: 'Receba lembretes importantes do seu tratamento no seu dispositivo',
        buttonText: 'Habilitar',
      }
    }

    if (platformInfo.isIOSSafari) {
      return {
        title: 'Adicione à Tela de Início',
        description: 'Acesse o Dosiq rapidamente como um app instalado',
        buttonText: 'Ver Como Instalar',
      }
    }

    if (platformInfo.isChromeAndroid) {
      return {
        title: 'Instale o Dosiq',
        description: 'Acesse rapidamente como um app instalado no seu Android',
        buttonText: 'Instalar Agora',
      }
    }

    return {
      title: 'Instale o Dosiq',
      description: 'Acesse rapidamente como um app nativo no seu computador',
      buttonText: 'Instalar Agora',
    }
  }

  const promptText = getPromptText()
  const instructions = getInstallInstructions()

  return (
    <>
      {/* Banner principal de instalação */}
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
              {/* Ícone do app */}
              <div className="install-prompt__icon" aria-hidden="true">
                <Download size={24} />
              </div>

              {/* Conteúdo textual */}
              <div className="install-prompt__text">
                <h3 className="install-prompt__title">{promptText.title}</h3>
                <p className="install-prompt__description">{promptText.description}</p>
              </div>

              {/* Ações */}
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
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de instruções iOS/Android */}
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
                  <X size={16} aria-hidden="true" />
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
                    <span role="img" aria-label="Dica">
                      💡
                    </span>
                    <span>
                      Procure o botão
                      <svg
                        className="install-prompt__share-icon"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M16 5l-1.42-1.42-4.58 4.59V0h-2v8.17L3.42 3.58 2 5l7 7 7-7zm7 6v8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-8H0v8c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-8h-2z" />
                      </svg>{' '}
                      na barra do Safari
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
