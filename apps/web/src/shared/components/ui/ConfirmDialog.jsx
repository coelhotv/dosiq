import { AlertTriangle, Info } from 'lucide-react'
import Modal from '@shared/components/ui/Modal'
import './ConfirmDialog.css'

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

  const Icon = variant === 'danger' || variant === 'warning' ? AlertTriangle : Info

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="sr-confirm-dialog">
        <div className={`sr-confirm-dialog__icon sr-confirm-dialog__icon--${variant}`}>
          <Icon size={24} />
        </div>
        <h3 className="sr-confirm-dialog__title">{title}</h3>
        {message && <p className="sr-confirm-dialog__message">{message}</p>}
        <div className="sr-confirm-dialog__actions">
          <button className="btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
