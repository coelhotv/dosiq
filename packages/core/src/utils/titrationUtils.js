export function calculateTitrationData(protocol) {
  if (!protocol.titration_schedule || protocol.titration_schedule.length === 0) return null
  if (!protocol.stage_started_at) return null

  const currentStageIndex = protocol.current_stage_index || 0
  const schedule = protocol.titration_schedule

  // Safety check
  if (currentStageIndex >= schedule.length) return null

  const currentStage = schedule[currentStageIndex]
  const startDate = new Date(protocol.stage_started_at)
  const today = new Date()

  // Calculate days elapsed (difference in time / milliseconds per day)
  const diffTime = Math.abs(today - startDate)
  const daysElapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Clamp day to at least 1
  const currentDay = Math.max(1, daysElapsed)
  const totalDays = currentStage.days

  // Calculate progress percent (capped at 100)
  const progressPercent = Math.min(100, (currentDay / totalDays) * 100)

  const isTransitionDue = currentDay > totalDays // Or >= depending on logic. Let's say > implies finished yesterday.

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
