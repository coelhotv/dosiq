import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '@shared/hooks/useFocusTrap'
import './Modal.css'

/**
 * Modal — Componente de diálogo modal reutilizável.
 *
 * ARIA: role="dialog", aria-modal="true", aria-labelledby vinculado ao título.
 * Focus: trap via useFocusTrap + restauração ao fechar.
 * Keyboard: Escape fecha o modal.
 *
 * @param {boolean} isOpen - Controla visibilidade
 * @param {Function} onClose - Callback de fechamento
 * @param {React.ReactNode} children - Conteúdo do modal
 * @param {string} title - Título exibido no header (opcional)
 */
export default function Modal({ isOpen, onClose, children, title }) {
  const { containerRef, handleKeyDown } = useFocusTrap(isOpen)

  // Bloquear scroll do body quando aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Fechar com Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      aria-hidden="false"
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-label={!title ? 'Diálogo' : undefined}
        ref={containerRef}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar diálogo"
            type="button"
          >
            <X size={20} aria-hidden="true" />
          </button>
          {title && (
            <h2 id="modal-title">{title}</h2>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
