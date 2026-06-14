/**
 * HealthHistoryView — Renderização da view de histórico de doses.
 */
import { lazy, Suspense } from 'react'
import Calendar from '@shared/components/ui/Calendar'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import HistoryKPICards from './HistoryKPICards'
import HistoryDayPanel from './HistoryDayPanel'
import MeasuresHub from '@features/measures/components/MeasuresHub'
import MeasureLogModal from '@features/measures/components/MeasureLogModal'

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
  markedStatusesByDay,
  monthPickerRange,
  timezone,
  dayEvents,
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
  editingMeasure,
  measureModalOpen,
  onEditMeasure,
  onDeleteMeasure,
  onSaveMeasure,
  onCloseMeasureModal,
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
            markedStatusesByDay={markedStatusesByDay}
            enableLazyLoad={true}
            enableSwipe={true}
            enableMonthPicker={true}
            monthPickerRange={monthPickerRange || { start: -12, end: 1 }}
          />
        </div>

        <HistoryDayPanel
          selectedDate={selectedDate}
          dayEvents={dayEvents}
          timezone={timezone}
          onEditLog={onEditLog}
          onDeleteLog={onDeleteLog}
          onEditMeasure={onEditMeasure}
          onDeleteMeasure={onDeleteMeasure}
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

      {/* 012 Fase C / FR-011b — Tendência de Medidas (chips + scatter). Função analítica:
          só no modo `complex` (como sparkline/heatmap de adesão) — não para "dona maria". */}
      {isComplex && (
        <div className="hhr-measures-section">
          <MeasuresHub />
        </div>
      )}

      {/* Edição de biomarcador a partir do card do dia (FR-011b — detalhe Editar). */}
      {measureModalOpen && (
        <MeasureLogModal
          key={editingMeasure?.id || 'edit-measure'}
          isOpen={measureModalOpen}
          editItem={editingMeasure}
          onClose={onCloseMeasureModal}
          onSaved={onSaveMeasure}
        />
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
