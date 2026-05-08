/**
 * HealthHistoryView — Renderização da view de histórico de doses.
 */
import { lazy, Suspense } from 'react'
import Calendar from '@shared/components/ui/Calendar'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import HistoryKPICards from './HistoryKPICards'
import HistoryDayPanel from './HistoryDayPanel'

const SparklineAdesao = lazy(() => import('@dashboard/components/SparklineAdesao'))
const AdherenceHeatmap = lazy(() => import('@adherence/components/AdherenceHeatmap'))

export default function HealthHistoryView({
  onNavigate,
  successMessage,
  error,
  isComplex,
  dailyAdherence,
  adherencePattern,
  stats,
  dosesThisMonth,
  selectedDate,
  markedDates,
  dayLogs,
  isModalOpen,
  editingLog,
  protocols,
  activeProtocols,
  treatmentPlans,
  treatmentPlansAll,
  onDayClick,
  onLoadMonth,
  onEditLog,
  onDeleteLog,
  onSaveLog,
  onCloseModal,
}) {
  return (
    <div className="hhr-view">
      <div className="hhr-header">
        {onNavigate && (
          <button
            className="hhr-back-btn"
            onClick={() => onNavigate('profile')}
            aria-label="Voltar"
          >
            ← Voltar
          </button>
        )}
        <h1 className="hhr-header__title">Histórico de Doses</h1>
        <p className="hhr-header__subtitle">
          Acompanhe sua jornada de saúde e adesão ao tratamento.
        </p>
      </div>

      {successMessage && <div className="hhr-banner hhr-banner--success">{successMessage}</div>}
      {error && <div className="hhr-banner hhr-banner--error">{error}</div>}

      <HistoryKPICards
        adherenceScore={stats?.score ?? 0}
        currentStreak={stats?.currentStreak ?? 0}
        dosesThisMonth={dosesThisMonth}
      />

      <div className="hhr-calendar-section">
        <div className="hhr-calendar-card">
          <Calendar
            selectedDate={selectedDate}
            onDayClick={onDayClick}
            onLoadMonth={onLoadMonth}
            markedDates={markedDates}
            enableLazyLoad={true}
            enableSwipe={true}
            enableMonthPicker={true}
          />
        </div>

        <HistoryDayPanel
          selectedDate={selectedDate}
          dayLogs={dayLogs}
          onEditLog={onEditLog}
          onDeleteLog={onDeleteLog}
        />
      </div>

      {isComplex && dailyAdherence.length > 0 && (
        <div className="hhr-chart-card">
          <h3 className="hhr-section-title">Adesão 30 Dias</h3>
          <Suspense fallback={<div className="hhr-chart-skeleton" aria-busy="true" />}>
            <SparklineAdesao adherenceByDay={dailyAdherence} size="expanded" />
          </Suspense>
        </div>
      )}

      {isComplex && adherencePattern && (
        <div className="hhr-chart-card">
          <h3 className="hhr-section-title">Padrão por Período</h3>
          <Suspense fallback={<div className="hhr-chart-skeleton" aria-busy="true" />}>
            <AdherenceHeatmap pattern={adherencePattern} />
          </Suspense>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={onCloseModal}>
        <LogForm
          protocols={editingLog ? protocols : activeProtocols}
          treatmentPlans={editingLog ? treatmentPlansAll : treatmentPlans}
          initialValues={editingLog}
          onSave={onSaveLog}
          onCancel={onCloseModal}
        />
      </Modal>
    </div>
  )
}
