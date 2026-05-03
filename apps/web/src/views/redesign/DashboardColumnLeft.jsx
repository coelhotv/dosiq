import DashboardHeader from './DashboardHeader'
import PriorityDoseCard from '@dashboard/components/PriorityDoseCard'
import InsightCardRedesign from '@dashboard/components/InsightCardRedesign'
import ReminderSuggestionRedesign from '@features/protocols/components/ReminderSuggestionRedesign'

export default function DashboardColumnLeft({
  userName,
  adherenceScore,
  totals,
  streak,
  getMotivationalMessage,
  urgentDoses,
  handleRegisterDoseQuick,
  handleRegisterDosesAll,
  currentInsight,
  onNavigate,
  reminderSuggestionData,
  handleReminderAccept,
  setDismissedSuggestionId
}) {
  return (
    <div className="dashboard-column-left">
      {/* Header + Ring de Adesão */}
      <DashboardHeader
        userName={userName}
        adherenceScore={adherenceScore}
        remainingDoses={totals.remaining}
        streak={streak}
        getMotivationalMessage={getMotivationalMessage}
      />

      {/* Priority Dose Card — 1-Click Registration */}
      {urgentDoses.length > 0 && (
        <div className="dashboard-widget-wrapper">
          <PriorityDoseCard
            doses={urgentDoses}
            onRegister={(dose) =>
              handleRegisterDoseQuick(dose.medicineId, dose.protocolId, dose.dosagePerIntake)
            }
            onRegisterAll={handleRegisterDosesAll}
            variant="priority"
          />
        </div>
      )}

      {/* Insight Card */}
      {currentInsight && (
        <div className="dashboard-widget-wrapper">
          <InsightCardRedesign
            insight={currentInsight}
            onAction={(insight) => {
              if (insight.action?.navigate) onNavigate?.(insight.action.navigate)
            }}
            onDismiss={() => {}}
          />
        </div>
      )}

      {/* Reminder Suggestion */}
      {reminderSuggestionData && (
        <div className="dashboard-widget-wrapper">
          <ReminderSuggestionRedesign
            suggestion={reminderSuggestionData.suggestion}
            protocolId={reminderSuggestionData.protocolId}
            protocolName={reminderSuggestionData.protocolName}
            onAccept={handleReminderAccept}
            onDismiss={() => setDismissedSuggestionId(reminderSuggestionData.protocolId)}
          />
        </div>
      )}
    </div>
  )
}
