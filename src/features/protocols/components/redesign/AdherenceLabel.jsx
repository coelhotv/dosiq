/**
 * AdherenceLabel — Tag de adesão em linguagem natural (persona Dona Maria)
 * Substitui o % numérico por uma legenda compreensível para usuários não-técnicos.
 *
 * >90%       → "Tratamento em dia"      (verde)
 * 70% – 90%  → "Algumas doses perdidas" (neutro/cinza)
 * 50% – 70%  → "Tratamento em risco"    (âmbar)
 * <50%       → "Muitas doses perdidas"  (vermelho)
 * score = 0  → não renderiza (sem histórico suficiente)
 */
export default function AdherenceLabel({ score }) {
  const pct = Math.round(Math.max(0, Math.min(100, score ?? 0)))

  // Sem histórico — não exibir
  if (pct === 0) return null

  let label, modifier
  if (pct > 90) {
    label = 'Tratamento em dia'
    modifier = 'good'
  } else if (pct >= 70) {
    label = 'Algumas doses perdidas'
    modifier = 'neutral'
  } else if (pct >= 50) {
    label = 'Tratamento em risco'
    modifier = 'warning'
  } else {
    label = 'Muitas doses perdidas'
    modifier = 'critical'
  }

  return (
    <span
      className={`adherence-label adherence-label--${modifier}`}
      title={`Adesão 7d: ${pct}%`}
    >
      {label}
    </span>
  )
}
