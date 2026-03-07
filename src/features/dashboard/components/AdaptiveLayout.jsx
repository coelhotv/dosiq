/**
 * AdaptiveLayout — Wrapper de layout adaptativo por complexidade (W2-07)
 *
 * Aplica uma classe CSS que cascata para os filhos (dose-card, zone-header)
 * adaptando padding, gap e tamanho visual ao modo de complexidade do paciente.
 *
 * Sem estado interno — recebe mode via props.
 */

import './AdaptiveLayout.css'

/**
 * @param {Object} props
 * @param {'simple'|'moderate'|'complex'} props.mode
 * @param {React.ReactNode} props.children
 */
export default function AdaptiveLayout({ mode = 'moderate', children }) {
  return (
    <div className={`adaptive-layout adaptive-layout--${mode}`} data-testid="adaptive-layout">
      {children}
    </div>
  )
}
