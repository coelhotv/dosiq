/**
 * InstallInstructionsModal — Modal de instruções de instalação do PWA.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function InstallInstructionsModal({
  showIOSInstructions,
  instructions,
  platformInfo,
  onClose,
}) {
  return (
    <AnimatePresence>
      {showIOSInstructions && (
        <motion.div
          className="install-prompt__modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
                onClick={onClose}
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
                onClick={onClose}
                type="button"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
