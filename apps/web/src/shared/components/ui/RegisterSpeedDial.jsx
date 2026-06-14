// RegisterSpeedDial.jsx — FAB speed-dial de registro (012 Fase C / FR-010b).
// Consolida "Registrar dose" + "Registrar medida" num só gatilho (antes eram FABs separados —
// o de medida colidia com o FAB do chatbot). Usado no footer do Sidebar (desktop) e flutuante
// acima da bottom nav (mobile). Fecha ao escolher uma ação ou ao perder foco/Esc.

import { useState, useRef, useEffect } from 'react'
import { Plus, Pill, Ruler, X } from 'lucide-react'
import './RegisterSpeedDial.css'

/**
 * @param {Object} props
 * @param {Function} props.onRegisterDose
 * @param {Function} props.onRegisterMeasure
 * @param {'sidebar'|'floating'} [props.variant='floating'] - contexto de posicionamento.
 */
export default function RegisterSpeedDial({ onRegisterDose, onRegisterMeasure, variant = 'floating' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const pick = (fn) => { setOpen(false); fn?.() }

  return (
    <div ref={rootRef} className={`rsd rsd--${variant}`}>
      {open && (
        <div className="rsd__actions" role="menu">
          <button type="button" className="rsd__action" role="menuitem" onClick={() => pick(onRegisterMeasure)}>
            <span className="rsd__action-icon"><Ruler size={18} aria-hidden="true" /></span>
            Registrar medida
          </button>
          <button type="button" className="rsd__action" role="menuitem" onClick={() => pick(onRegisterDose)}>
            <span className="rsd__action-icon"><Pill size={18} aria-hidden="true" /></span>
            Registrar dose
          </button>
        </div>
      )}
      <button
        type="button"
        className={`rsd__trigger${open ? ' rsd__trigger--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? 'Fechar menu de registro' : 'Registrar'}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
        <span className="rsd__trigger-label">Registrar</span>
      </button>
    </div>
  )
}
