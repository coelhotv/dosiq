// src/views/redesign/EmergencyRedesign.jsx
import Emergency from '../Emergency'
import './EmergencyRedesign.css'

/**
 * Wrapper redesenhado para Emergency.
 *
 * Envolve a view original em .er-wrapper para aplicar
 * overrides CSS do design system Santuário.
 * Toda a lógica offline/localStorage permanece inalterada.
 *
 * @param {Object} props - Mesmos props de Emergency
 * @param {Function} props.onNavigate - Callback de navegação
 */
export default function EmergencyRedesign({ onNavigate }) {
  return (
    <div className="er-wrapper">
      <Emergency onNavigate={onNavigate} />
    </div>
  )
}
