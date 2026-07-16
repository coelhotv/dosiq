import { getNow, parseISO } from './dateUtils'

const MS_DAY = 24 * 60 * 60 * 1000

interface TitrationStage {
  dosage?: number
  duration_days?: number
  days?: number
  description?: string
  note?: string
}

export interface TitrationProtocol {
  titration_schedule?: TitrationStage[] | null
  current_stage_index?: number | null
  stage_started_at?: string | null
  titration_status?: string | null
}

/**
 * Verifica se a titulação está inativa.
 * @private
 */
function isTitrationInactive(protocol: TitrationProtocol | null | undefined): boolean {
  const schedule = protocol?.titration_schedule
  return (
    !Array.isArray(schedule) ||
    schedule.length === 0 ||
    !protocol?.stage_started_at ||
    protocol?.titration_status !== 'titulando'
  )
}

/**
 * Obtém o timestamp MS de um instante.
 * @private
 */
function getTimestamp(at: Date | string | number): number {
  if (typeof at === 'number') return at
  if (at instanceof Date) return at.getTime()
  return parseISO(String(at)).getTime()
}

/**
 * Obtém a duração em dias da etapa.
 * @private
 */
function getStageDurationDays(stage: TitrationStage | null | undefined): number | null {
  const days = Number(stage?.duration_days ?? stage?.days)
  return Number.isFinite(days) && days > 0 ? days : null
}

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
export function resolveTitrationStageAt(
  protocol: TitrationProtocol | null | undefined,
  at: Date | string | number
): { stageIndex: number; dosage: number } | null {
  if (isTitrationInactive(protocol)) return null
  const schedule = protocol?.titration_schedule
  if (!schedule || !protocol?.stage_started_at) return null
  let index = protocol.current_stage_index || 0
  if (index >= schedule.length) return null

  const atMs = getTimestamp(at)
  let stageStartMs = parseISO(protocol.stage_started_at).getTime()
  if (Number.isNaN(atMs) || Number.isNaN(stageStartMs)) return null
  // Ocorrência antes do início da etapa atual: histórico — não re-derivar (já congelado).
  if (atMs < stageStartMs) return null

  // Avança etapas cuja duração já se esgotou antes do instante alvo.
  while (index < schedule.length - 1) {
    const days = getStageDurationDays(schedule[index])
    if (!days) break
    const stageEndMs = stageStartMs + days * MS_DAY
    if (atMs < stageEndMs) break
    stageStartMs = stageEndMs
    index += 1
  }

  const dosage = Number(schedule[index]?.dosage)
  if (!Number.isFinite(dosage) || dosage <= 0) return null
  return { stageIndex: index, dosage }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTER dual-read N1↔N2 (spec 029 / ADR-080 / Slice F2 — T007).
//
// As funções `*FromSteps` são o gêmeo PURO das de cima lendo a entidade nova
// (`titration_steps`) em vez do jsonb N1. Assinaturas das originais permanecem INTACTAS:
// o cutover dos consumers (generator, cron, consulta/PDF, leitura web) é F3 (flag
// `TITRATION_SOURCE=n2`). Aqui só construímos a maquinaria + a paridade (PO-5).
//
// PARIDADE (regra que espelha `titration_status === 'titulando'` do legado):
//   - etapa 'current' com duração FINITA  → escada rege a dose (titulando) → retorna dose
//   - etapa 'current' CONTÍNUA (duration_days null) → alvo atingido/manutenção → null
//     (a dose de manutenção vive no protocol; a titulação não rege — igual legado 'alvo_atingido')
//   - nenhuma etapa 'current' → escada pausada/inativa → null (igual legado 'pausado')
// ═══════════════════════════════════════════════════════════════════════════════

/** Etapa da escada N2 como o adapter precisa (subconjunto de titration_steps). */
export interface TitrationStepLike {
  position: number
  dose?: number
  duration_days?: number | null
  status?: string | null
  started_at?: string | null
  description?: string | null
}

/**
 * Fonte de leitura da titulação. Default 'n1' até o cutover na F3 (flag env `TITRATION_SOURCE`).
 * Isomórfico: guarda o acesso a `process.env` (indefinido em alguns bundles).
 */
export function getTitrationSource(): 'n1' | 'n2' {
  const raw =
    typeof process !== 'undefined' && process.env ? process.env.TITRATION_SOURCE : undefined
  return raw === 'n2' ? 'n2' : 'n1'
}

/**
 * Duração em dias de uma etapa N2. NULL = etapa contínua (sem fim previsto).
 * @private
 */
function getStepDurationDays(step: TitrationStepLike | null | undefined): number | null {
  const days = Number(step?.duration_days)
  return Number.isFinite(days) && days > 0 ? days : null
}

/**
 * Gêmeo PURO/clock-free de `resolveTitrationStageAt` lendo `titration_steps` (F2 T007).
 *
 * Recebe as etapas injetadas (pureza preservada) e o instante alvo. Retorna a mesma forma
 * `{stageIndex, dosage}|null` — `stageIndex` é o índice na escada ORDENADA por position.
 *
 * @param {TitrationStepLike[]} steps - etapas da escada (qualquer ordem; ordenadas aqui)
 * @param {Date|string|number} at - instante da ocorrência
 * @returns {{stageIndex: number, dosage: number}|null}
 */
export function resolveTitrationStageAtFromSteps(
  steps: TitrationStepLike[] | null | undefined,
  at: Date | string | number
): { stageIndex: number; dosage: number } | null {
  if (!Array.isArray(steps) || steps.length === 0) return null
  const ordered = [...steps].sort((a, b) => a.position - b.position)

  const currentIndex = ordered.findIndex((s) => s?.status === 'current')
  if (currentIndex === -1) return null // pausada/inativa → legado 'pausado'

  const currentStep = ordered[currentIndex]
  // Etapa vigente contínua = manutenção/alvo atingido: a titulação NÃO rege a dose (legado null).
  if (getStepDurationDays(currentStep) === null) return null
  if (!currentStep?.started_at) return null

  const atMs = getTimestamp(at)
  let stageStartMs = parseISO(currentStep.started_at).getTime()
  if (Number.isNaN(atMs) || Number.isNaN(stageStartMs)) return null
  // Ocorrência antes do início da etapa atual: histórico congelado — não re-derivar.
  if (atMs < stageStartMs) return null

  let index = currentIndex
  while (index < ordered.length - 1) {
    const days = getStepDurationDays(ordered[index])
    if (!days) break // etapa contínua: para aqui
    const stageEndMs = stageStartMs + days * MS_DAY
    if (atMs < stageEndMs) break
    stageStartMs = stageEndMs
    index += 1
  }

  const dosage = Number(ordered[index]?.dose)
  if (!Number.isFinite(dosage) || dosage <= 0) return null
  return { stageIndex: index, dosage }
}

/**
 * Gêmeo de `calculateTitrationData` lendo `titration_steps` (F2 T007). `now` injetável p/ testes.
 * Retorna null quando não há etapa vigente FINITA (mesma inatividade do legado).
 */
export function calculateTitrationDataFromSteps(
  steps: TitrationStepLike[] | null | undefined,
  now: Date = getNow()
): {
  currentStep: number
  totalSteps: number
  day: number
  realDay: number
  totalDays: number
  progressPercent: number
  isTransitionDue: boolean
  stageNote: string | undefined
  daysRemaining: number
} | null {
  if (!Array.isArray(steps) || steps.length === 0) return null
  const ordered = [...steps].sort((a, b) => a.position - b.position)

  const currentIndex = ordered.findIndex((s) => s?.status === 'current')
  if (currentIndex === -1) return null
  const currentStep = ordered[currentIndex]
  if (!currentStep?.started_at) return null

  // Etapa vigente contínua (sem duração) = manutenção/alvo: não há progresso a exibir.
  // Retorna null — coerente com o comentário desta função e com resolveTitrationStageAtFromSteps.
  const totalDays = getStepDurationDays(currentStep)
  if (totalDays === null) return null

  const startDate = parseISO(currentStep.started_at)
  const diffTime = Math.abs(now.getTime() - startDate.getTime())
  const daysElapsed = Math.ceil(diffTime / MS_DAY)
  const currentDay = Math.max(1, daysElapsed)

  const progressPercent = Math.min(100, (currentDay / totalDays) * 100)

  return {
    currentStep: currentIndex + 1,
    totalSteps: ordered.length,
    day: Math.min(currentDay, totalDays),
    realDay: currentDay,
    totalDays,
    progressPercent,
    isTransitionDue: currentDay > totalDays,
    stageNote: currentStep.description ?? undefined,
    daysRemaining: totalDays - currentDay,
  }
}

export function calculateTitrationData(protocol: TitrationProtocol): {
  currentStep: number
  totalSteps: number
  day: number
  realDay: number
  totalDays: number
  progressPercent: number
  isTransitionDue: boolean
  stageNote: string | undefined
  daysRemaining: number
} | null {
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
  const diffTime = Math.abs(today.getTime() - startDate.getTime())
  const daysElapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Clamp day to at least 1
  const currentDay = Math.max(1, daysElapsed)
  const totalDays = currentStage.duration_days ?? currentStage.days ?? 0

  // Calculate progress percent (capped at 100)
  const progressPercent = totalDays > 0 ? Math.min(100, (currentDay / totalDays) * 100) : 0

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
