// src/views/redesign/HealthHistoryRedesign.jsx
import HealthHistory from '../HealthHistory'
import './HealthHistoryRedesign.css'

/**
 * Wrapper redesenhado para HealthHistory.
 *
 * Estratégia: envolve o HealthHistory original em .hhr-wrapper,
 * que aplica overrides CSS substituindo tokens neon/glass pelo
 * design system Santuário. Nenhuma lógica de dados é alterada.
 *
 * @param {Object} props - Mesmos props de HealthHistory
 * @param {Function} props.onNavigate - Callback de navegação
 */
export default function HealthHistoryRedesign({ onNavigate }) {
  return (
    <div className="hhr-wrapper">
      <HealthHistory onNavigate={onNavigate} />
    </div>
  )
}
