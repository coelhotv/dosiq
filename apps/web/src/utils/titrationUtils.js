import { getNow, parseISO, daysDifference } from './dateUtils'

export function calculateTitrationData(protocol) {
  if (!protocol.titration_schedule || protocol.titration_schedule.length === 0) return null
  if (!protocol.stage_started_at) return null

  const currentStageIndex = protocol.current_stage_index || 0
  const schedule = protocol.titration_schedule

  // Safety check
  if (currentStageIndex >= schedule.length) return null

  const currentStage = schedule[currentStageIndex]
  const startDate = parseISO(protocol.stage_started_at)
  const today = getNow()

  // Calculate days elapsed
  const daysElapsed = daysDifference(startDate, today)

  // Clamp day to at least 1
  const currentDay = Math.max(1, daysElapsed)
  const totalDays = currentStage.days

  // Calculate progress percent (capped at 100)
  const progressPercent = Math.min(100, (currentDay / totalDays) * 100)

  const isTransitionDue = currentDay > totalDays

  return {
    currentStep: currentStageIndex + 1,
    totalSteps: schedule.length,
    day: Math.min(currentDay, totalDays), // visual cap
    realDay: currentDay,
    totalDays: totalDays,
    progressPercent: progressPercent,
    isTransitionDue: isTransitionDue,
    stageNote: currentStage.note,
    daysRemaining: totalDays - currentDay,
  }
}
