import { getNow, parseISO } from './dateUtils.js'

const MS_DAY = 24 * 60 * 60 * 1000

/**
 * Resolve a etapa de titulação vigente num INSTANTE arbitrário (012 Fase B, FR-006).
 *
 * Caminha o cronograma a partir de stage_started_at/current_stage_index somando
 * duration (days) de cada etapa — permite ao gerador de dose_instances congelar
 * `expected_dose` da etapa vigente NA DATA da ocorrência (FP-1/ADR-050), mesmo
 * para instâncias futuras geradas antes do avanço formal no banco.
 *
 * Puro e clock-free (instante injetado). Retorna null quando titulação não rege
 * a dose: sem schedule, sem stage_started_at, status 'alvo_atingido'/'pausado',
 * índice fora do range, ou instante anterior ao início da etapa atual.
 *
 * @param {Object} protocol - {titration_schedule, current_stage_index, stage_started_at, titration_status}
 * @param {Date|string|number} at - instante da ocorrência
 * @returns {{stageIndex: number, dosage: number}|null}
 */
export function resolveTitrationStageAt(protocol, at) {
  const schedule = protocol?.titration_schedule
  if (!Array.isArray(schedule) || schedule.length === 0) return null
  if (!protocol.stage_started_at) return null
  // Só 'titulando' rege a dose (consistente com isTitrationActive); 'estável'/
  // 'alvo_atingido' → dosage_per_intake manda.
  if (protocol.titration_status !== 'titulando') return null

  let index = protocol.current_stage_index || 0
  if (index >= schedule.length) return null

  const atMs =
    typeof at === 'number' ? at : at instanceof Date ? at.getTime() : parseISO(String(at)).getTime()
  let stageStartMs = parseISO(protocol.stage_started_at).getTime()
  if (Number.isNaN(atMs) || Number.isNaN(stageStartMs)) return null
  // Ocorrência antes do início da etapa atual: histórico — não re-derivar (já congelado).
  if (atMs < stageStartMs) return null

  // Avança etapas cuja duração já se esgotou antes do instante alvo.
  while (index < schedule.length - 1) {
    // duration_days = canônico (titrationStageSchema); days = fallback legado
    const days = Number(schedule[index]?.duration_days ?? schedule[index]?.days)
    if (!Number.isFinite(days) || days <= 0) break
    const stageEndMs = stageStartMs + days * MS_DAY
    if (atMs < stageEndMs) break
    stageStartMs = stageEndMs
    index += 1
  }

  const dosage = Number(schedule[index]?.dosage)
  if (!Number.isFinite(dosage) || dosage <= 0) return null
  return { stageIndex: index, dosage }
}

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

  // Calculate days elapsed (difference in time / milliseconds per day)
  const diffTime = Math.abs(today - startDate)
  const daysElapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Clamp day to at least 1
  const currentDay = Math.max(1, daysElapsed)
  const totalDays = currentStage.duration_days ?? currentStage.days

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
    stageNote: currentStage.description ?? currentStage.note,
    daysRemaining: totalDays - currentDay,
  }
}
