/**
 * ViewModeToggle — Segmented control Hora/Plano (W2-04)
 *
 * Toggle compacto que alterna a visualização das zonas entre temporal (⏰)
 * e por tratamento (📋). Não renderiza quando não há planos de tratamento
 * ou quando complexityMode='simple' (passado via hasTreatmentPlans=false).
 *
 * Controlled component — sem estado interno.
 */

import './ViewModeToggle.css'

/**
 * @param {Object} props
 * @param {'time'|'plan'} props.mode - Modo atual
 * @param {Function} props.onChange - Callback(mode)
 * @param {boolean} props.hasTreatmentPlans - Se false, não renderiza
 */
export default function ViewModeToggle({ mode, onChange, hasTreatmentPlans }) {
  if (!hasTreatmentPlans) return null

  return (
    <div className="view-mode-toggle" role="group" aria-label="Modo de visualização">
      <button
        className={`view-mode-toggle__btn${mode === 'time' ? ' view-mode-toggle__btn--active' : ''}`}
        onClick={() => onChange('time')}
        aria-pressed={mode === 'time'}
        type="button"
      >
        ⏰ Hora
      </button>
      <button
        className={`view-mode-toggle__btn${mode === 'plan' ? ' view-mode-toggle__btn--active' : ''}`}
        onClick={() => onChange('plan')}
        aria-pressed={mode === 'plan'}
        type="button"
      >
        📋 Plano
      </button>
    </div>
  )
}
