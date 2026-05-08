/**
 * DailyDoseModal - Modal para exibir detalhes das doses de um dia específico
 *
 * Exibe lista de doses tomadas e perdidas para o dia selecionado no sparkline.
 *
 * @component
 * @example
 * <DailyDoseModal
 *   date="2026-02-11"
 *   isOpen={true}
 *   onClose={() => setIsOpen(false)}
 *   logs={logs}
 *   isLoading={false}
 *   error={null}
 *   dailySummary={{ adherence: 85, taken: 3, expected: 4 }}
 * />
 */

import { useMemo } from 'react'
import Modal from '@shared/components/ui/Modal'
import Loading from '@shared/components/ui/Loading'
import EmptyState from '@shared/components/ui/EmptyState'
import DoseListItem from './DoseListItem'
import { calculateDosesByDate } from '@utils/adherenceLogic'
import { parseLocalDate } from '@utils/dateUtils.js'
import { useFocusTrap } from '@shared/hooks/useFocusTrap'
import './DailyDoseModal.css'

/**
 * Formata data para exibição em português
 * @param {string} dateStr - Data em formato YYYY-MM-DD
 * @returns {string} Data formatada (ex: "terça-feira, 11 de fevereiro")
 */
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = parseLocalDate(dateStr)
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Formata data curta (para aria-label)
 * @param {string} dateStr - Data em formato YYYY-MM-DD
 * @returns {string} Data formatada curta
 */
const formatShortDate = (dateStr) => {
  if (!dateStr) return ''
  const date = parseLocalDate(dateStr)
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Calcula o status de adesão baseado no percentual.
 * @param {number} percent - Percentual de adesão (0-100)
 * @returns {'good'|'warning'|'poor'} Status de adesão
 */
const getAdherenceStatus = (percent) => {
  if (percent >= 80) return 'good'
  if (percent >= 50) return 'warning'
  return 'poor'
}

/**
 * Renderiza a seção de resumo de adesão do dia.
 */
const DailySummaryBadge = ({ dailySummary }) => {
  if (!dailySummary) return null
  const adherencePercent = dailySummary.adherence ?? 0
  const status = getAdherenceStatus(adherencePercent)
  return (
    <div className="daily-dose-summary" aria-live="polite" aria-atomic="true">
      <span
        className={`adherence-badge adherence-badge--${status}`}
        aria-label={`Adesão: ${adherencePercent}%`}
      >
        {adherencePercent}% adesão
      </span>
      <span
        className="dose-count"
        aria-label={`${dailySummary.taken} de ${dailySummary.expected} doses`}
      >
        {dailySummary.taken} de {dailySummary.expected} doses
      </span>
    </div>
  )
}

/**
 * Renderiza uma seção de lista de doses (tomadas, perdidas ou agendadas).
 */
const DoseListSection = ({ doses, sectionClass, titleClass, titleText, listLabel, isTaken, status }) => {
  if (doses.length === 0) return null
  return (
    <div className={`dose-list-section ${sectionClass || ''}`}>
      <h3 className={`dose-list-section__title ${titleClass || ''}`} aria-live={isTaken ? undefined : 'polite'}>
        {titleText} ({doses.length})
      </h3>
      <div className="dose-list" role="list" aria-label={listLabel}>
        {doses.map((log, index) => (
          <DoseListItem
            key={log.id}
            log={log}
            isTaken={isTaken}
            status={status}
            scheduledTime={log.scheduledTime}
            index={index}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Componente DailyDoseModal
 *
 * @param {Object} props
 * @param {string} props.date - Data selecionada (YYYY-MM-DD)
 * @param {boolean} props.isOpen - Controle de visibilidade
 * @param {Function} props.onClose - Handler de fechamento
 * @param {Array} props.logs - Logs do dia
 * @param {Array} props.protocols - Protocolos ativos para cálculo de doses perdidas
 * @param {boolean} props.isLoading - Estado de loading
 * @param {Error} props.error - Erro se houver
 * @param {Object} props.dailySummary - Resumo do dia { adherence, taken, expected }
 * @param {Function} props.onRetry - Handler para retry em caso de erro
 */
export function DailyDoseModal({
  date,
  isOpen,
  onClose,
  logs = [],
  protocols = null,
  isLoading = false,
  error = null,
  dailySummary = null,
  onRetry,
}) {
  const { containerRef: modalRef, handleKeyDown } = useFocusTrap(isOpen)

  // Calcular doses tomadas, perdidas e agendadas usando a nova função
  const { takenDoses, missedDoses, scheduledDoses } = useMemo(() => {
    // Se protocols não foi passado, fallback para comportamento anterior
    if (!protocols) {
      return { takenDoses: logs || [], missedDoses: [], scheduledDoses: [] }
    }

    try {
      return calculateDosesByDate(date, logs, protocols)
    } catch (err) {
      console.error('Erro ao calcular doses:', err)
      // Fallback seguro em caso de erro
      return { takenDoses: logs || [], missedDoses: [], scheduledDoses: [] }
    }
  }, [date, logs, protocols])

  const hasDoses = takenDoses.length > 0 || missedDoses.length > 0 || scheduledDoses.length > 0
  const formattedDate = formatDate(date)
  const shortDate = formatShortDate(date)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formattedDate}>
      <div
        ref={modalRef}
        className="daily-dose-modal"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-dose-title"
        data-testid="daily-dose-modal"
      >
        <div id="daily-dose-title" className="sr-only">
          Doses do dia {shortDate}
        </div>

        <DailySummaryBadge dailySummary={dailySummary} />

        {isLoading && (
          <div className="daily-dose-loading">
            <Loading message="Carregando doses..." />
          </div>
        )}

        {error && !isLoading && (
          <EmptyState
            icon="⚠️"
            title="Erro ao carregar"
            message="Não foi possível carregar os dados deste dia."
            action={onRetry ? { label: 'Tentar novamente', onClick: onRetry } : null}
          />
        )}

        {!isLoading && !error && !hasDoses && (
          <EmptyState
            icon="📋"
            title="Nenhuma dose agendada"
            message="Não há doses programadas para este dia."
          />
        )}

        {!isLoading && !error && (
          <>
            <DoseListSection
              doses={takenDoses}
              titleText="Doses Tomadas"
              listLabel={`Doses tomadas em ${shortDate}`}
              isTaken={true}
            />
            <DoseListSection
              doses={missedDoses}
              sectionClass="dose-list-section--missed"
              titleClass="dose-list-section__title--missed"
              titleText="Doses Perdidas"
              listLabel={`Doses perdidas em ${shortDate}`}
              isTaken={false}
            />
            <DoseListSection
              doses={scheduledDoses}
              sectionClass="dose-list-section--scheduled"
              titleClass="dose-list-section__title--scheduled"
              titleText="Doses Agendadas"
              listLabel={`Doses agendadas em ${shortDate}`}
              isTaken={false}
              status="scheduled"
            />
          </>
        )}

        {hasDoses && (
          <div className="daily-dose-footer">
            <p className="daily-dose-hint">💡 Clique em uma dose para ver detalhes</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default DailyDoseModal
