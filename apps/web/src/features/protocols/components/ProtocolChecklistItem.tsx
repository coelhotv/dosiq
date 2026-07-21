import { getNow } from '@utils/dateUtils'
import { formatIntakeDose, getEvolutionBadge } from '@dosiq/core'
import './ProtocolChecklistItem.css'

export default function ProtocolChecklistItem({ protocol, isSelected, onToggle }) {
  const getCurrentTime = () => {
    const now = getNow()
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const currentTime = getCurrentTime()

  return (
    <button
      type="button"
      className={`protocol-checklist-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onToggle(protocol.id)}
      aria-pressed={isSelected}
    >
      <div className="checklist-left">
        <div className={`custom-checkbox ${isSelected ? 'checked' : ''}`}>{isSelected && '✓'}</div>
        <div className="checklist-info">
          <span className="checklist-name">💊 {protocol.name}</span>
          <div className="checklist-meta">
            {/* 029 F3.1: o ramo "Etapa X/Y" + a barra de progresso liam
                `titration_scheduler_data`, campo SEM produtor no repositório inteiro — o ternário
                caía SEMPRE aqui. Removidos (AP-301: código que aparenta capacidade que não existe).

                029 F6: o badge restante lia `titration_status`, coluna dropada que estava
                `'estável'` em 100% das linhas de prod — ou seja, este selo dizia "Estável" para
                TODO tratamento, inclusive um em plena evolução. É a mesma mentira corrigida no
                mobile (#763). Agora sai da escada N2 e só aparece quando há escada E ela está
                evoluindo: os tratamentos deste checklist vêm de `selectedPlan.protocols`, que
                não carrega `titration_steps`, então o normal aqui é NÃO renderizar nada.
                Ausência é visível; "Estável" afirmado sem dado é indistinguível da verdade. */}
            {getEvolutionBadge(
              Array.isArray(protocol.titration_steps) ? protocol.titration_steps : []
            ).key === 'em_evolucao' && (
              <span className="titration-badge em_evolucao">📈 Em evolução</span>
            )}
            <span className="dosage-badge">
              {formatIntakeDose(protocol.dosage_per_intake, protocol.intake_unit, protocol.medicine)}
            </span>
          </div>
        </div>
      </div>

      <div className="checklist-right">
        <div className="time-pills">
          {protocol.time_schedule?.map((t) => (
            <span key={t} className={`time-pill ${t <= currentTime ? 'past' : ''}`}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
