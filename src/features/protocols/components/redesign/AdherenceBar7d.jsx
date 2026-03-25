/**
 * AdherenceBar7d — Barra de adesão de 7 dias com indicador visual colorido
 * Mostra: preenchimento baseado em score (0-100%), cor contextual (verde/âmbar/vermelho)
 * Cores via CSS variables (--adherence-*) para manutenibilidade
 */
export default function AdherenceBar7d({ score }) {
  const pct = Math.round(Math.max(0, Math.min(100, score ?? 0)))
  const statusClass = pct >= 80 ? 'adherence-bar7d--good' : pct >= 60 ? 'adherence-bar7d--medium' : 'adherence-bar7d--poor'

  return (
    <div className={`adherence-bar7d ${statusClass}`} title={`Adesão 7d: ${pct}%`}>
      <div className="adherence-bar7d__track">
        <div className="adherence-bar7d__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="adherence-bar7d__label">
        {pct}%
      </span>
    </div>
  )
}
