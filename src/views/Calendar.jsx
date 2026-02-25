/**
 * Calendar View - Wrapper para o calendário visual de doses
 *
 * Página dedicada ao calendário mensal de adesão com indicadores
 * de status para cada dia.
 *
 * @module Calendar
 */
import { useEffect } from 'react'
import { lazy, Suspense } from 'react'
import Loading from '@shared/components/ui/Loading'
import { analyticsService } from '@dashboard/services/analyticsService'
import styles from './Calendar.module.css'

// Lazy import do componente DoseCalendar (Acceptance Criteria #2)
const DoseCalendar = lazy(() => import('@calendar/components/DoseCalendar'))

/**
 * Calendar View - Página do calendário de doses
 *
 * @param {Object} props - Propriedades do componente
 * @param {Function} props.onNavigate - Callback para navegação entre views
 * @returns {JSX.Element} Página do calendário
 */
function Calendar({ onNavigate }) {
  // Analytics tracking (Acceptance Criteria #3)
  useEffect(() => {
    analyticsService.track('calendar_view_opened')
  }, [])

  return (
    <div className={styles.container}>
      {/* Header com navegação */}
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => onNavigate?.('dashboard')}
          aria-label="Voltar ao Dashboard"
        >
          ← Voltar
        </button>
        <h1 className={styles.title}>Calendário de Doses</h1>
      </header>

      {/* Conteúdo principal com lazy loading */}
      <main className={styles.content}>
        <Suspense fallback={<Loading text="Carregando calendário..." />}>
          <DoseCalendar />
        </Suspense>
      </main>
    </div>
  )
}

export default Calendar
