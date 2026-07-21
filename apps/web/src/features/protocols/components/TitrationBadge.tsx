/**
 * TitrationBadge — estado da Evolução do tratamento + progresso da etapa vigente.
 *
 * 029 F6: passou a consumir o summary de `calculateTitrationData(titration_steps)` (core), a
 * MESMA fonte do `EvolutionBadge` do mobile — inclusive no rótulo ("Em evolução"), que antes
 * dizia "Titulação" só aqui. Antes vinha do `titrationService` web, moldado no jsonb N1
 * (`protocols.titration_schedule`) que foi dropado — e que, medido em prod, estava vazio nas
 * 68 linhas: este badge nunca teve dado real para exibir.
 *
 * `summary === null` (etapa vigente CONTÍNUA de manutenção/alvo, ou sem etapa vigente) não é
 * erro: é o estado "Estável", e o chamador simplesmente não monta o badge.
 */
import { formatDaysLabel } from '@dosiq/core'

export default function TitrationBadge({ summary }) {
  if (!summary) return null

  const { currentStep, totalSteps, daysRemaining, progressPercent } = summary
  const percent = Math.max(0, Math.min(100, Math.round(progressPercent ?? 0)))

  return (
    <div className="titration-badge">
      <span className="titration-badge__icon">📈</span>
      <span className="titration-badge__text">
        Em evolução: Etapa {currentStep}/{totalSteps}
      </span>
      {daysRemaining > 0 && (
        <span className="titration-badge__sub">
          · próxima em {formatDaysLabel(daysRemaining)}
        </span>
      )}
      {/* Etapa vencida (`daysRemaining <= 0` com a etapa ainda vigente): o avanço está
          pendente — o cron vira o status no dia do vencimento. "Próxima em 0 dias" seria
          mentira; o estado honesto é dizer que se aguarda. */}
      {daysRemaining <= 0 && <span className="titration-badge__sub">· avanço pendente</span>}
      {percent > 0 && (
        <div className="titration-badge__progress">
          <div style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  )
}
