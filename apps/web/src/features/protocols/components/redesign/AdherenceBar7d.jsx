/**
 * AdherenceBar7d — Barra de adesão de 7 dias com indicador visual colorido
 * Mostra: preenchimento baseado em score (0-100%), cor contextual (verde/âmbar/vermelho)
 * Cores via CSS variables (--adherence-*) para manutenibilidade
 */
/**
 * AdherenceBar7d — Barra de adesão 7 dias
 * S7.5.5: Threshold atualizado para 70% (neutral color)
 * >= 70%: cinza escuro (neutro)
 * < 70%: âmbar (alerta)
 */
export default function AdherenceBar7d({ score }) {
  const pct = Math.round(Math.max(0, Math.min(100, score ?? 0)))
  const statusClass = pct >= 70 ? 'adherence-bar7d--neutral' : 'adherence-bar7d--warning'

  return (
    <div className={`adherence-bar7d ${statusClass}`} title={`Adesão 7d: ${pct}%`}>
      <div className="adherence-bar7d__track">
        <div className="adherence-bar7d__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="adherence-bar7d__label">{pct}%</span>
    </div>
  )
}
