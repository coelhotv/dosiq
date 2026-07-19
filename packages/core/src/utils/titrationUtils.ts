import { getNow, parseISO, getUserTime, formatLocalDate, addDays, getStartOfDayISO, daysDifference } from './dateUtils'

const MS_DAY = 24 * 60 * 60 * 1000

// ═══════════════════════════════════════════════════════════════════════════════
// LEITURA DA ESCADA (spec 029 / ADR-080 / Slice F3.1 — T017b/T017c).
//
// Fonte ÚNICA: a entidade `titrations`/`titration_steps`. O jsonb N1
// (`protocols.titration_schedule` + `current_stage_index` + `stage_started_at`) e a flag
// `TITRATION_SOURCE` foram removidos no F3.1: a titulação N1 nunca funcionou em produção
// (AP-301) e a feature tinha zero usuários — não havia fonte com que ter paridade, nem
// cutover a reverter (a flag sequer chegava a web/mobile: o Vite troca `process.env` por
// `{}` e o Expo só inlina `EXPO_PUBLIC_*`; só o Node a lia).
//
// REGRA DE VIGÊNCIA (era a "paridade" com `titration_status === 'titulando'`):
//   - etapa 'current' com duração FINITA  → escada rege a dose → retorna dose
//   - etapa 'current' CONTÍNUA (duration_days null) → manutenção/alvo atingido → null
//     (a dose de manutenção vive no protocol; a titulação não rege)
//   - nenhuma etapa 'current' → escada pausada/concluída → null
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Etapa da escada como a leitura precisa (subconjunto de `titration_steps`).
 *
 * ⚠️ Só declare aqui campos que a tabela TEM. Este tipo é a fonte de onde os `select()` do
 * PostgREST são escritos — um campo fantasma aqui vira `42703` em runtime, não erro de compilação
 * (o select é string). Conferir contra o BANCO (`information_schema.columns` via MCP) antes de
 * somar campo — nem contra este tipo, nem contra a memória. R-295 / AP-300.
 *
 * NÃO tem `description`: "nota/objetivo por etapa (N1 web) **não migra** — a etapa se descreve por
 * medicamento+dose" (Decisões §2, linha 100). É decisão de PRODUTO, não omissão: o `stageNote` era
 * campo do N1 e morreu com ele. Não reintroduzir "pra compilar" (foi assim que o #749 nasceu).
 */
export interface TitrationStepLike {
  position: number
  dose?: number
  duration_days?: number | null
  status?: string | null
  started_at?: string | null
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
 * Duração em dias de uma etapa N2. NULL = etapa contínua (sem fim previsto).
 * @private
 */
function getStepDurationDays(step: TitrationStepLike | null | undefined): number | null {
  const days = Number(step?.duration_days)
  return Number.isFinite(days) && days > 0 ? days : null
}

/**
 * Resolve a etapa vigente da escada num INSTANTE arbitrário. PURO e clock-free.
 *
 * Permite ao gerador de dose_instances congelar `expected_dose` da etapa vigente NA DATA da
 * ocorrência (FR-006/FP-1/ADR-050), mesmo para instâncias futuras geradas antes do avanço
 * formal no banco: caminha a escada a partir da etapa 'current' somando `duration_days`.
 *
 * Recebe as etapas injetadas (pureza preservada) e o instante alvo. `stageIndex` é o índice na
 * escada ORDENADA por position.
 *
 * @param {TitrationStepLike[]} steps - etapas da escada (qualquer ordem; ordenadas aqui)
 * @param {Date|string|number} at - instante da ocorrência
 * @returns {{stageIndex: number, dosage: number}|null}
 */
export function resolveTitrationStageAt(
  steps: TitrationStepLike[] | null | undefined,
  at: Date | string | number
): { stageIndex: number; dosage: number } | null {
  if (!Array.isArray(steps) || steps.length === 0) return null
  const ordered = [...steps].sort((a, b) => a.position - b.position)

  const currentIndex = ordered.findIndex((s) => s?.status === 'current')
  if (currentIndex === -1) return null // escada pausada/concluída

  const currentStep = ordered[currentIndex]
  // Etapa vigente contínua = manutenção/alvo atingido: a titulação NÃO rege a dose.
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
 * Progresso da etapa vigente, para exibição (badge/timeline/PDF de consulta).
 * `now` injetável p/ testes. Retorna null quando não há etapa vigente FINITA.
 */
export function calculateTitrationData(
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
  daysRemaining: number
} | null {
  if (!Array.isArray(steps) || steps.length === 0) return null
  const ordered = [...steps].sort((a, b) => a.position - b.position)

  const currentIndex = ordered.findIndex((s) => s?.status === 'current')
  if (currentIndex === -1) return null
  const currentStep = ordered[currentIndex]
  if (!currentStep?.started_at) return null

  // Etapa vigente contínua (sem duração) = manutenção/alvo: não há progresso a exibir.
  // Retorna null — coerente com `resolveTitrationStageAt`.
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
    daysRemaining: totalDays - currentDay,
  }
}

/**
 * Badge de estado da Evolução do tratamento, DERIVADO da escada N2 (spec 029 §2 / F4).
 *
 * Fonte ÚNICA = `titration_steps` (a coluna N1 `protocols.titration_status` está deprecada e não é
 * mais escrita — não ler dela). Regra (Decisões §2):
 *   - etapa vigente FINITA (duração > 0)  → 'em_evolucao' ("Em evolução")
 *   - etapa vigente CONTÍNUA, ou sem etapa vigente, ou SEM escada → 'estavel' ("Estável")
 * "Estável" é o mesmo badge de um tratamento sem escada (§2), por isso é o default.
 *
 * As etapas DEVEM vir filtradas por `protocol_id = protocol.id` (embed) — a etapa vigente do
 * protocolo é a que importa (CON-032 / A5).
 */
export type EvolutionBadgeKey = 'em_evolucao' | 'estavel'
export interface EvolutionBadge {
  key: EvolutionBadgeKey
  label: string
}

export function getEvolutionBadge(
  steps: TitrationStepLike[] | null | undefined
): EvolutionBadge {
  const current = Array.isArray(steps) ? steps.find((s) => s?.status === 'current') : null
  const isFinite = current != null && getStepDurationDays(current) !== null
  return isFinite ? { key: 'em_evolucao', label: 'Em evolução' } : { key: 'estavel', label: 'Estável' }
}

/**
 * Switch pendente de confirmação, com HÁ QUANTO TEMPO espera. PURO e clock-free (spec 029 F5).
 *
 * Alimenta as 3 superfícies do CTA: o card do Hoje (§3.1), a linha neutra do estado pendente
 * (§3.2, incl. a frase de contexto do dia 3) e o banner de etapa vencida (§7.2, "aguardando
 * desde 24 jun · 12 dias").
 *
 * ⚠️ **DE ONDE VEM O "DESDE" — decisão do PO no C2 gate do F5 (2026-07-18).**
 * Não existe coluna de "pendente desde": `titration_steps` (verificado no banco) só tem
 * `updated_at`, e ele está DESCARTADO como fonte — a etapa pendente é editável
 * (`EDITABLE_STATUSES` do titrationService inclui `pending_confirmation`), então uma edição
 * qualquer da escada bumparia `updated_at` e **zeraria o contador em silêncio** (o "desde"
 * pularia para hoje e a frase do dia 3 nunca apareceria). Nenhum teste pegaria isso.
 *
 * A verdade é derivada: o vencimento da etapa VIGENTE (`started_at` + `duration_days`, no dia
 * local do dono) É o instante em que a próxima ficou pendente — o cron vira o status no dia do
 * vencimento. Imune a edição de outras etapas, sem migração, e acompanha o `[Ajustar duração]`
 * de graça: esticar a etapa vigente move o "aguardando desde" junto, que é o correto.
 *
 * Mesma aritmética de vencimento do motor (`resolveTitrationAdvance`): dia LOCAL do dono
 * (R-253/R-254), nunca horário nem UTC.
 *
 * @param steps - etapas da escada (qualquer ordem; ordenadas aqui por position)
 * @param todayLocal - dia local do dono (YYYY-MM-DD), ex.: `getTodayLocal(tz)`
 * @param tz - fuso IANA do dono
 * @returns null quando não há switch pendente ou quando não há âncora honesta para o "desde"
 */
export interface PendingSwitchInfo {
  /** Etapa que aguarda confirmação (a que o `[Iniciar etapa]` inicia). */
  pendingStepId: string
  /** `position` da pendente. A UI rotula "Etapa N" com `position + 1`. */
  pendingPosition: number
  /** Etapa que SEGUE regendo os lembretes até a confirmação (Decisões §3.2). */
  currentStepId: string
  /** Dia local do vencimento (YYYY-MM-DD) = "aguardando desde". */
  dueDay: string
  /** Dias completos de espera. 0 no próprio dia do vencimento ("começa hoje"). */
  daysWaiting: number
}

/** Etapa como o resolvedor de pendência precisa: a leitura + o `id` (a UI age sobre ele). */
export interface TitrationStepPendingLike extends TitrationStepLike {
  id: string
}

/**
 * A etapa VIGENTE de uma escada, imune a `current` residual. PURO.
 *
 * 🔴 **Nunca use `find(s => s.status === 'current')`.** O banco não impede duas etapas `current`
 * na mesma escada — só existe `UNIQUE (titration_id, position)` (verificado em `pg_constraint`
 * 2026-07-18) —, então o invariante "uma vigente por escada" vive só no motor, não no schema.
 * Com `find()` simples, uma escada com vigente residual na posição 0 devolve a etapa ERRADA:
 * sem erro, sem log, só um resultado plausível e falso (encontrado no smoke do F5, e de novo
 * pelo RC6 no F5.5 — ali a escolha alimentava uma ESCRITA, não só um rótulo).
 *
 * A vigente real é a de MAIOR `position` entre as `current`; quando há uma etapa de referência
 * (a pendente), a vigente é a adjacente anterior a ela — daí o `beforePosition`.
 *
 * @param steps - etapas da escada (qualquer ordem; ordenadas aqui por position)
 * @param beforePosition - quando informado, só considera vigentes ANTES desta posição
 */
export function resolveCurrentStep<T extends TitrationStepLike>(
  steps: T[] | null | undefined,
  beforePosition?: number
): T | undefined {
  if (!Array.isArray(steps) || steps.length === 0) return undefined
  const currents = [...steps]
    .sort((a, b) => a.position - b.position)
    .filter((s) => s?.status === 'current' && (beforePosition === undefined || s.position < beforePosition))
  return currents.length > 0 ? currents[currents.length - 1] : undefined
}

export function resolvePendingSwitch(
  steps: TitrationStepPendingLike[] | null | undefined,
  todayLocal: string,
  tz = 'America/Sao_Paulo'
): PendingSwitchInfo | null {
  if (!Array.isArray(steps) || steps.length === 0) return null
  if (!todayLocal) return null

  const ordered = [...steps].sort((a, b) => a.position - b.position)
  const pending = ordered.find((s) => s?.status === 'pending_confirmation')
  if (!pending) return null

  const current = resolveCurrentStep(ordered, pending.position)
  // Sem etapa vigente não há âncora de vencimento. Acontece se o tratamento foi pausado com um
  // switch pendente: a evolução congela junto (§2.2) e o CTA sai de cena — não inventar data.
  if (!current?.started_at) return null

  const days = getStepDurationDays(current)
  // Vigente CONTÍNUA com pendente é estado incoerente (contínua nunca vence, logo nada poderia
  // ter ficado pendente por vencimento). Silenciar é melhor que exibir uma data inventada.
  if (days === null) return null

  const startDay = localDayOf(current.started_at, tz)
  if (!startDay) return null
  const dueDay = addLocalDays(startDay, days)

  // Negativo = pendência marcada antes do vencimento (relógio do device atrasado, edição manual).
  // Piso em 0: "aguardando há -2 dias" é pior que "começa hoje".
  const daysWaiting = Math.max(0, daysDifference(dueDay, todayLocal))

  return {
    pendingStepId: pending.id,
    pendingPosition: pending.position,
    currentStepId: current.id,
    dueDay,
    daysWaiting,
  }
}

/**
 * Etapa cadastrada MANUALMENTE a partir de uma etapa contínua (spec 029 F5.5 / Decisões §7.4).
 *
 * 🔴 **Por que NÃO é `resolvePendingSwitch`.** São dois conceitos distintos:
 *   - `resolvePendingSwitch` = pendência **VENCIDA** — existe um prazo que passou, e o "desde"
 *     é derivado dele. Com vigente contínua ela devolve `null`, e isso está CERTO: contínua
 *     nunca vence, então nada poderia ter ficado pendente por vencimento. **Não alterar.**
 *   - `resolveManualNextStep` = pendência **SEM PRAZO** — o paciente está em manutenção e o
 *     médico mudou a prescrição. O gatilho não é uma DATA, é um EVENTO CLÍNICO. Não há "desde",
 *     não há atraso, não há o que interromper.
 *
 * Consequência de desenho: esta função alimenta SÓ a tela do tratamento (pull, banner teal).
 * O Hoje segue silencioso — sem card, sem push, sem nag (R-239). A etapa fica INERTE até o
 * toque: `resolveTitrationAdvance` devolve `null` com vigente contínua, então o cron nunca
 * reivindica nem notifica.
 *
 * PURO e clock-free (não há data envolvida — é justamente o ponto).
 *
 * @param steps - etapas da escada (qualquer ordem; ordenadas aqui por position)
 * @returns null quando a vigente NÃO é contínua (aí quem manda é o motor/`resolvePendingSwitch`)
 *          ou quando não há etapa aguardando o usuário
 */
export interface ManualNextStepInfo {
  /** Etapa que aguarda o toque do usuário (a que o `[Iniciar etapa N]` inicia). */
  pendingStepId: string
  /** `position` da pendente. A UI rotula "Etapa N" com `position + 1`. */
  pendingPosition: number
  /** Etapa contínua que SEGUE regendo os lembretes até o toque. */
  currentStepId: string
}

export function resolveManualNextStep(
  steps: TitrationStepPendingLike[] | null | undefined
): ManualNextStepInfo | null {
  if (!Array.isArray(steps) || steps.length === 0) return null

  const ordered = [...steps].sort((a, b) => a.position - b.position)
  const pending = ordered.find((s) => s?.status === 'pending_confirmation')
  if (!pending) return null

  // Mesma âncora de `resolvePendingSwitch` — ver `resolveCurrentStep`.
  const current = resolveCurrentStep(ordered, pending.position)
  if (!current) return null

  // 🔴 O gate que separa as duas funções: SÓ vigente CONTÍNUA. Vigente finita significa que há
  // prazo, logo o caso é do motor/`resolvePendingSwitch` — devolver algo aqui duplicaria a
  // superfície (banner manual + card do Hoje para a mesma etapa).
  if (getStepDurationDays(current) !== null) return null

  return {
    pendingStepId: pending.id,
    pendingPosition: pending.position,
    currentStepId: current.id,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR DE AVANÇO (spec 029 / ADR-080 / Slice F3 — T012). PURO e clock-free.
//
// Vive no core (nível A strict) porque a decisão é lógica de domínio; o cron só faz o I/O.
//
// DUAS PROPRIEDADES DELIBERADAS (decisões do PO, C2 gate do F3):
//   1. VENCIMENTO POR DIA LOCAL DO DONO (R-253/R-254): a etapa vence na virada do dia local —
//      `hoje >= dia_local(started_at) + duration_days` — e não no HORÁRIO de início.
//   2. `started_at` da etapa nova é o INÍCIO DO DIA LOCAL do vencimento, nunca `now()`: o fim é
//      ACUMULADO (atraso do cron não desloca a escada) e o walk de `resolveTitrationStageAt`
//      (que soma MS_DAY) fica alinhado à fronteira de dia local. Brasil não tem DST.
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
 *                       a dose (a de manutenção vive no protocol).
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
 * Devolve `null` quando nada vence, inclusive nos degenerados: sem etapa vigente (escada
 * pausada/concluída), vigente sem `started_at` (**escada dormente** — o estado zumbi que matou a
 * titulação N1, hoje barrado pelo CHECK `titration_steps_current_exige_started_check`; o motor
 * segue defensivo), vigente contínua (alvo atingido) e duração inválida.
 *
 * Etapas `dose_change` vencidas em sequência (cron parado por semanas) são acumuladas num único
 * plano, para não emitir N notificações de uma vez.
 *
 * @param steps - etapas da escada (qualquer ordem; ordenadas aqui por position)
 * @param todayLocal - dia local do dono (YYYY-MM-DD), ex.: `getTodayLocal(tz)`
 * @param tz - fuso IANA do dono (fallback SP idêntico ao resolveUserTz — R-254)
 */
export function resolveTitrationAdvance(
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
      // Última etapa finita esgotada = alvo atingido: a etapa encerra e a escada deixa de
      // reger a dose (a de manutenção passa a vir do protocol).
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

    // MESMO MEDICAMENTO (same-med): só muda a quantidade → dose_change automático.
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
