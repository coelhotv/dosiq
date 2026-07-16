import { getNow, parseISO, getUserTime, formatLocalDate, addDays, getStartOfDayISO } from './dateUtils'

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

/**
 * Etapa da escada N2 como o adapter precisa (subconjunto de `titration_steps`).
 *
 * ⚠️ Só declare aqui campos que a tabela TEM. Este tipo é a fonte de onde os `select()` do
 * PostgREST são escritos — um campo fantasma aqui vira `42703` em runtime, não erro de compilação
 * (o select é string). Conferir contra `database.types.ts` (gerado) antes de somar campo. AP-300.
 *
 * NÃO tem `description`: "nota/objetivo por etapa (N1 web) **não migra** — a etapa se descreve por
 * medicamento+dose" (Decisões §2, linha 100). `stageNote` é campo do N1 e morre com ele no F6.
 */
export interface TitrationStepLike {
  position: number
  dose?: number
  duration_days?: number | null
  status?: string | null
  started_at?: string | null
}

/**
 * Fonte de leitura da titulação (flag env `TITRATION_SOURCE`).
 *
 * Default **'n1'**: o F3 entregou a maquinaria do N2 mas NÃO virou a chave — ligar o cutover é um
 * passo separado e reversível sem deploy, não um efeito do merge. Vira 'n2' setando a env var em
 * prod; a flag inteira (e esta função) morrem no F6.
 *
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
    // Sempre undefined no N2, por decisão de PRODUTO (Decisões §2 linha 100): a nota/objetivo por
    // etapa do N1 web não migra — a etapa se descreve por medicamento+dose. Consumers de stageNote
    // (PDF de consulta, ProtocolCard) já tratam ausência; some de vez no F6 com o N1.
    stageNote: undefined,
    daysRemaining: totalDays - currentDay,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR DE AVANÇO N2 (spec 029 / ADR-080 / Slice F3 — T012). PURO e clock-free.
//
// Gêmeo de `_titrationDueAdvance` (server/bot/_reminderHelpers.ts) lendo a escada nova.
// Vive no core (nível A strict) porque a decisão é lógica de domínio; o cron só faz o I/O.
//
// DUAS DIFERENÇAS DELIBERADAS em relação ao legado (decisões do PO, C2 gate do F3):
//   1. VENCIMENTO POR DIA LOCAL DO DONO (R-253/R-254) — o legado somava `duration_days × 24h`
//      sobre `stage_started_at`, vencendo no HORÁRIO de início. Agora a etapa vence na virada
//      do dia local: `hoje >= dia_local(started_at) + duration_days`.
//   2. `started_at` da etapa nova é o INÍCIO DO DIA LOCAL do vencimento — nunca `now()`
//      (preserva o "fim ACUMULADO" do legado: atraso do cron não desloca a escada) e mantém o
//      walk do adapter (que soma MS_DAY) alinhado à fronteira de dia local. Brasil não tem DST.
//
// A parada no `medicine_switch` é o coração do épico: o motor NUNCA troca de medicamento
// sozinho (Decisões §10) — marca a próxima etapa como pendente e a vigente segue regendo a dose.
// ═══════════════════════════════════════════════════════════════════════════════

/** Etapa como o MOTOR precisa (superset do que o adapter de leitura usa). */
export interface TitrationStepEngineLike extends TitrationStepLike {
  id: string
  medicine_id: string
  dose?: number
  intake_unit?: string | null
  protocol_id?: string | null
}

/** Etapa encerrada pelo avanço. */
export interface TitrationStepClosure {
  id: string
  endedAtIso: string
}

/** Etapa que passa a vigorar (dose_change) ou que aguarda confirmação (medicine_switch). */
export interface TitrationStepTarget {
  id: string
  position: number
  dose: number
  intakeUnit: string | null
  medicineId: string
  protocolId: string | null
  startedAtIso?: string
}

/**
 * Plano de avanço da escada. `transition` é DERIVADO (medicine_id adjacente), nunca lido de coluna.
 * - `dose_change`     → `activated` preenchido, `pending` null: aplicar automático.
 * - `medicine_switch` → `pending` preenchido: só marcar pendência + notificar; NUNCA executar.
 * - `target_reached`  → última etapa finita esgotada: escada concluída, titulação para de reger
 *                       a dose (espelha `alvo_atingido` do legado, que devolvia null).
 */
export interface TitrationAdvancePlan {
  transition: 'dose_change' | 'medicine_switch' | 'target_reached'
  completed: TitrationStepClosure[]
  activated: TitrationStepTarget | null
  pending: TitrationStepTarget | null
  totalSteps: number
}

/** Dia local (YYYY-MM-DD) de um instante ISO no fuso do dono. @private */
function localDayOf(iso: string, tz: string): string {
  return formatLocalDate(getUserTime(parseISO(iso), tz))
}

/** Soma dias a um dia local YYYY-MM-DD, devolvendo YYYY-MM-DD. @private */
function addLocalDays(day: string, days: number): string {
  return formatLocalDate(addDays(day, days))
}

/** Projeta uma etapa da escada no alvo do plano. @private */
function toTarget(step: TitrationStepEngineLike, startedAtIso?: string): TitrationStepTarget {
  return {
    id: step.id,
    position: step.position,
    dose: Number(step.dose),
    intakeUnit: step.intake_unit ?? null,
    medicineId: step.medicine_id,
    protocolId: step.protocol_id ?? null,
    startedAtIso,
  }
}

/**
 * Decide o que a escada deve fazer HOJE, no fuso do dono. Puro: nada de relógio nem de I/O.
 *
 * Devolve `null` quando nada vence — inclusive nos degenerados que o legado também ignorava:
 * sem etapa vigente (escada pausada), vigente sem `started_at` (**titulação dormente** — é o
 * dado real que existe em prod hoje), vigente contínua (alvo atingido: a dose de manutenção
 * vive no protocol) e duração inválida.
 *
 * Etapas `dose_change` vencidas em sequência (cron parado por semanas) são acumuladas num único
 * plano — igual ao legado, que caminhava tudo de uma vez para não emitir N notificações.
 *
 * @param steps - etapas da escada (qualquer ordem; ordenadas aqui por position)
 * @param todayLocal - dia local do dono (YYYY-MM-DD), ex.: `getTodayLocal(tz)`
 * @param tz - fuso IANA do dono (fallback SP idêntico ao resolveUserTz — R-254)
 */
export function resolveTitrationAdvanceFromSteps(
  steps: TitrationStepEngineLike[] | null | undefined,
  todayLocal: string,
  tz = 'America/Sao_Paulo'
): TitrationAdvancePlan | null {
  if (!Array.isArray(steps) || steps.length === 0) return null
  if (!todayLocal) return null

  const ordered = [...steps].sort((a, b) => a.position - b.position)
  const currentIndex = ordered.findIndex((s) => s?.status === 'current')
  if (currentIndex === -1) return null // pausada/inativa

  const current = ordered[currentIndex]
  if (!current?.started_at) return null // dormente: sem âncora não há vencimento

  let startDay = localDayOf(current.started_at, tz)
  if (!startDay) return null

  const completed: TitrationStepClosure[] = []
  let index = currentIndex
  let plan: TitrationAdvancePlan | null = null

  // Caminha as transições vencidas. Para na 1ª que exige o usuário (switch) ou que não venceu.
  for (;;) {
    const step = ordered[index]
    const days = getStepDurationDays(step)
    if (days === null) break // etapa contínua: nunca vence

    const dueDay = addLocalDays(startDay, days)
    if (todayLocal < dueDay) break // ainda dentro da etapa

    const dueIso = getStartOfDayISO(dueDay, tz)
    const next = ordered[index + 1]

    if (!next) {
      // Última etapa finita esgotada = alvo atingido (legado congelava o índice e marcava
      // 'alvo_atingido'; aqui a etapa encerra e a escada deixa de reger a dose — mesmo efeito).
      completed.push({ id: step.id, endedAtIso: dueIso })
      plan = { transition: 'target_reached', completed, activated: null, pending: null, totalSteps: ordered.length }
      break
    }

    if (next.medicine_id !== step.medicine_id) {
      // TROCA DE MEDICAMENTO: pendura e para. A vigente NÃO é encerrada — segue regendo os
      // lembretes até o usuário confirmar (Decisões §3.2). Nunca automático (§10).
      plan = {
        transition: 'medicine_switch',
        completed,
        activated: plan?.activated ?? null,
        pending: toTarget(next),
        totalSteps: ordered.length,
      }
      break
    }

    // MESMO MEDICAMENTO: dose_change automático (comportamento N1 preservado).
    completed.push({ id: step.id, endedAtIso: dueIso })
    plan = {
      transition: 'dose_change',
      completed,
      activated: toTarget(next, dueIso),
      pending: null,
      totalSteps: ordered.length,
    }
    startDay = dueDay
    index += 1
  }

  return plan
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
