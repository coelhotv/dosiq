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

import { useMemo, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import Loading from '../ui/Loading'
import EmptyState from '../ui/EmptyState'
import DoseListItem from './DoseListItem'
import { calculateDosesByDate } from '../../utils/adherenceLogic'
import './DailyDoseModal.css'

/**
 * Formata data para exibição em português
 * @param {string} dateStr - Data em formato YYYY-MM-DD
 * @returns {string} Data formatada (ex: "terça-feira, 11 de fevereiro")
 */
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  // Adicionar T00:00:00 para evitar problemas de timezone
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Formata data curta (para aria-label)
 * @param {string} dateStr - Data em formato YYYY-MM-DD
 * @returns {string} Data formatada curta
 */
const formatShortDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Hook para gerenciar focus trap no modal
 * @param {boolean} isOpen - Se o modal está aberto
 */
function useFocusTrap(isOpen) {
  const modalRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (isOpen) {
      // Salvar elemento focado anteriormente
      previousFocus.current = document.activeElement

      // Focar no primeiro elemento focável após abrir
      const timer = setTimeout(() => {
        const focusable = modalRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        focusable?.focus()
      }, 100)

      return () => clearTimeout(timer)
    } else if (previousFocus.current) {
      // Restaurar foco ao fechar
      previousFocus.current.focus()
    }
  }, [isOpen])

  // Handler para capturar Tab e fazer focus trap
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusableElements?.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault()
      lastElement.focus()
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault()
      firstElement.focus()
    }
  }

  return { modalRef, handleKeyDown }
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
  const { modalRef, handleKeyDown } = useFocusTrap(isOpen)

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
  const hasScheduledDoses = hasDoses
  const formattedDate = formatDate(date)
  const shortDate = formatShortDate(date)

  // Calcular porcentagem de adesão
  const adherencePercent = dailySummary?.adherence ?? 0
  const adherenceStatus =
    adherencePercent >= 80 ? 'good' : adherencePercent >= 50 ? 'warning' : 'poor'

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
        {/* Header com resumo - escondido visualmente pois Modal já tem título */}
        <div id="daily-dose-title" className="sr-only">
          Doses do dia {shortDate}
        </div>

        {/* Badge de adesão */}
        {dailySummary && (
          <div className="daily-dose-summary" aria-live="polite" aria-atomic="true">
            <span
              className={`adherence-badge adherence-badge--${adherenceStatus}`}
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
        )}

        {/* Estado de loading */}
        {isLoading && (
          <div className="daily-dose-loading">
            <Loading message="Carregando doses..." />
          </div>
        )}

        {/* Estado de erro */}
        {error && !isLoading && (
          <EmptyState
            icon="⚠️"
            title="Erro ao carregar"
            message="Não foi possível carregar os dados deste dia."
            action={
              onRetry
                ? {
                    label: 'Tentar novamente',
                    onClick: onRetry,
                  }
                : null
            }
          />
        )}

        {/* Estado vazio - sem doses agendadas */}
        {!isLoading && !error && !hasScheduledDoses && (
          <EmptyState
            icon="📋"
            title="Nenhuma dose agendada"
            message={`Não há doses programadas para este dia.`}
          />
        )}

        {/* Lista de doses tomadas */}
        {!isLoading && !error && takenDoses.length > 0 && (
          <div className="dose-list-section">
            <h3 className="dose-list-section__title">Doses Tomadas ({takenDoses.length})</h3>
            <div className="dose-list" role="list" aria-label={`Doses tomadas em ${shortDate}`}>
              {takenDoses.map((log, index) => (
                <DoseListItem key={log.id} log={log} isTaken={true} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Lista de doses perdidas */}
        {!isLoading && !error && missedDoses.length > 0 && (
          <div className="dose-list-section dose-list-section--missed">
            <h3
              className="dose-list-section__title dose-list-section__title--missed"
              aria-live="polite"
            >
              Doses Perdidas ({missedDoses.length})
            </h3>
            <div className="dose-list" role="list" aria-label={`Doses perdidas em ${shortDate}`}>
              {missedDoses.map((log, index) => (
                <DoseListItem
                  key={log.id}
                  log={log}
                  isTaken={false}
                  scheduledTime={log.scheduledTime}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Lista de doses agendadas (futuras) */}
        {!isLoading && !error && scheduledDoses.length > 0 && (
          <div className="dose-list-section dose-list-section--scheduled">
            <h3
              className="dose-list-section__title dose-list-section__title--scheduled"
              aria-live="polite"
            >
              Doses Agendadas ({scheduledDoses.length})
            </h3>
            <div className="dose-list" role="list" aria-label={`Doses agendadas em ${shortDate}`}>
              {scheduledDoses.map((log, index) => (
                <DoseListItem
                  key={log.id}
                  log={log}
                  isTaken={false}
                  status="scheduled"
                  scheduledTime={log.scheduledTime}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer informativo */}
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
