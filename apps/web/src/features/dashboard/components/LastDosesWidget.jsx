import { useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import { getNow, parseISO, getSaoPauloTime } from '@utils/dateUtils.js'
import './LastDosesWidget.css'

/**
 * LastDosesWidget - Widget de Últimas Doses Tomadas
 *
 * Exibe as 5 doses mais recentes tomadas, ordenadas cronologicamente
 * (mais recentes primeiro), independente do dia em que foram tomadas.
 *
 * Features:
 * - Lista até 5 doses mais recentes
 * - Ordenação inversa cronológica (mais recente primeiro)
 * - Exibe nome do medicamento, horário relativo e quantidade
 * - Link para histórico completo
 * - Estado vazio quando não há doses
 */
export default function LastDosesWidget({ onViewHistory, viewAllClassName }) {
  const { logs, protocols, medicines, isLoading } = useDashboard()

  // Processar e ordenar as últimas doses
  const lastDoses = useMemo(() => {
    if (!logs || logs.length === 0) return []

    // Filtrar apenas doses tomadas (com taken_at válido)
    const takenDoses = logs.filter((log) => log.taken_at && log.quantity_taken > 0)

    // Ordenar por taken_at descendente (mais recente primeiro)
    const sortedDoses = takenDoses.sort((a, b) => {
      return parseISO(b.taken_at).getTime() - parseISO(a.taken_at).getTime()
    })

    // Limitar a 3 doses (balance com próximas doses)
    return sortedDoses.slice(0, 3)
  }, [logs])

  // Criar mapas para lookup rápido
  const medicineMap = useMemo(() => {
    if (!medicines) return new Map()
    return new Map(medicines.map((m) => [m.id, m]))
  }, [medicines])

  const protocolMap = useMemo(() => {
    if (!protocols) return new Map()
    return new Map(protocols.map((p) => [p.id, p]))
  }, [protocols])

  // Formatar horário relativo
  const formatRelativeTime = (dateString) => {
    // R-020: Ambos devem estar no mesmo referencial (shifted SP) para aritmética correta
    const date = getSaoPauloTime(parseISO(dateString))
    const now = getNow()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    const options = { timeZone: 'America/Sao_Paulo' }
    const timeOptions = { ...options, hour: '2-digit', minute: '2-digit' }

    // Menos de 1 hora
    if (diffMinutes < 60) {
      if (diffMinutes < 1) return 'Agora mesmo'
      return `Há ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`
    }

    // Menos de 24 horas
    if (diffHours < 24) {
      return `Há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`
    }

    // Ontem
    if (diffDays === 1) {
      return `Ontem às ${date.toLocaleTimeString('pt-BR', timeOptions)}`
    }

    // 2-6 dias atrás
    if (diffDays < 7) {
      const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
      // M9.0: Extrair dia da semana no fuso de SP
      const dayIndex = parseInt(date.toLocaleDateString('en-US', { ...options, weekday: 'numeric' }), 10) % 7
      const weekday = weekdays[dayIndex]
      return `${weekday} às ${date.toLocaleTimeString('pt-BR', timeOptions)}`
    }

    // Mais de uma semana
    return date.toLocaleDateString('pt-BR', {
      ...timeOptions,
      day: '2-digit',
      month: 'short',
    })
  }

  // Obter informações do medicamento
  const getMedicineInfo = (log) => {
    if (log.medicine) return log.medicine
    return medicineMap.get(log.medicine_id) || { name: 'Medicamento', dosage_unit: 'un' }
  }

  // Obter informações do protocolo
  const getProtocolInfo = (log) => {
    if (log.protocol) return log.protocol
    return protocolMap.get(log.protocol_id)
  }

  if (isLoading) {
    return (
      <div className="last-doses-widget last-doses-widget--loading">
        <div className="last-doses-widget__loading">
          <div className="last-doses-widget__spinner">⟳</div>
          <span>Carregando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="last-doses-widget">
      {lastDoses.length === 0 ? (
        <div className="last-doses-widget__empty">
          <span className="last-doses-widget__empty-icon">💊</span>
          <p className="last-doses-widget__empty-text">Nenhuma dose registrada recentemente</p>
          <button
            className={viewAllClassName || 'last-doses-widget__empty-action'}
            onClick={onViewHistory}
          >
            Ver histórico completo →
          </button>
        </div>
      ) : (
        <>
          <ul className="last-doses-widget__list" role="list">
            {lastDoses.map((dose, index) => {
              const medicine = getMedicineInfo(dose)
              const protocol = getProtocolInfo(dose)

              return (
                <li
                  key={dose.id || `${dose.medicine_id}-${index}`}
                  className="last-doses-widget__item"
                >
                  <div className="last-doses-widget__item-icon">💊</div>
                  <div className="last-doses-widget__item-content">
                    <div className="last-doses-widget__item-main">
                      <span className="last-doses-widget__item-name">{medicine.name}</span>
                      <span className="last-doses-widget__item-time">
                        {formatRelativeTime(dose.taken_at)}
                      </span>
                    </div>
                    <div className="last-doses-widget__item-details">
                      <span className="last-doses-widget__item-quantity">
                        {dose.quantity_taken * (medicine.dosage_per_pill || 1)}
                        {medicine.dosage_unit || 'mg'}
                      </span>
                      {protocol && (
                        <span className="last-doses-widget__item-protocol">• {protocol.name}</span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <button
            className={viewAllClassName || 'last-doses-widget__view-all'}
            onClick={onViewHistory}
            aria-label="Ver histórico completo de doses"
          >
            Ver histórico completo →
          </button>
        </>
      )}
    </div>
  )
}
