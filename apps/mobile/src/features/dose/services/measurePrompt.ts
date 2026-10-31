// measurePrompt.ts — pedido de medida após a dose (spec 069 A2 · FR-001..FR-003; spec 100 B · FR-006..FR-008).
//
// Regra PURA (shouldAskMeasure) separada do I/O (marca local + última medida): os modais só perguntam
// resolvePostDoseStep(ctx) e nunca a regra de uma medida direto (slot único — S-5).
// Política como dado (S-3): peso (semana local, recência 7 d), PA (dia local, teto 3/semana) e
// glicemia (meio-dia local: manhã 00:00–11:59 · tarde/noite 12:00–23:59). O teto conta PERÍODOS
// RESOLVIDOS — medida registrada ou pedido dispensado —, nunca pedidos exibidos (RC3 E-3).
// Qual medida um tratamento acompanha sai de `effectiveMeasure` (core): escolha gravada, ou a regra
// da 069 quando não decidido (NULL). Chave ausente no protocolo = select sem a coluna (RC3 E-1) ⇒
// falha fechada: não pede e avisa no Sentry (pedir peso a quem escolheu "nenhum" é pior).
// Marca no aparelho, com user_id na chave (FR-003/S-1): trocar de conta não herda a marca.

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Sentry from '@sentry/react-native'
import { mondayOf, formatLocalDate, addDays, parseISO, getNow, effectiveMeasure, type Measure } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { measuresRepo } from '@measures/services/measuresRepo'

export type PromptItem = { protocol?: { frequency?: string | null; tracked_measure?: unknown; medicine?: unknown } | null }

export type MeasurePromptPolicy = {
  biomarkerType: Measure
  period: 'half-day' | 'day' | 'week'
  // N dias locais (contando hoje) sem registro para pedir; null = basta não haver registro NO PERÍODO.
  recencyDays: number | null
  // Teto de períodos resolvidos por semana local (segunda a domingo); ausente = sem teto semanal.
  weeklyCap?: number
  appliesTo: (item: PromptItem) => boolean
}

/** Medida que o item acompanha; `missing` = protocolo sem a chave (select incompleto). */
export function measureOfItem(item: PromptItem): Measure | 'nenhum' | 'missing' {
  const protocol = item?.protocol
  if (!protocol) return 'nenhum'
  const measure = effectiveMeasure(protocol)
  return typeof measure === 'string' ? measure : 'missing'
}

// Peso = o predicado da 069 quando não decidido (semanal), ou a escolha gravada (spec 100).
export function isWeightEligible(item: PromptItem): boolean {
  return measureOfItem(item) === 'peso'
}

export const MEASURE_PROMPT_POLICIES: Record<Measure, MeasurePromptPolicy> = {
  peso: { biomarkerType: 'peso', period: 'week', recencyDays: 7, appliesTo: isWeightEligible },
  pressao_arterial: {
    biomarkerType: 'pressao_arterial', period: 'day', recencyDays: null, weeklyCap: 3,
    appliesTo: (item) => measureOfItem(item) === 'pressao_arterial',
  },
  glicemia: {
    biomarkerType: 'glicemia', period: 'half-day', recencyDays: null,
    appliesTo: (item) => measureOfItem(item) === 'glicemia',
  },
}

// D-6 / FR-008: no lote, a medida de MENOR frequência de pedido vence. Bloqueada sai da disputa.
export const MEASURE_RANK: readonly Measure[] = ['peso', 'pressao_arterial', 'glicemia']

export type MeasurePromptContext = {
  items: PromptItem[]
  periodMarked: boolean
  lastMeasuredAt: string | null // ISO do último registro do tipo; null = nenhum OU leitura falhou (R-1)
  now: Date
  weekDaysUsed?: number // dias locais da semana com registro ou dispensa (só políticas com weeklyCap)
}

/**
 * Chave do período LOCAL: segunda da semana (week), o dia (day) ou dia + am/pm (half-day).
 * Nunca toISOString (R-020/AP-270).
 */
export function periodKeyOf(policy: MeasurePromptPolicy, now: Date): string {
  if (policy.period === 'week') return formatLocalDate(mondayOf(now))
  if (policy.period === 'day') return formatLocalDate(now)
  return `${formatLocalDate(now)}:${now.getHours() < 12 ? 'am' : 'pm'}`
}

/** Regra pura (FR-002/FR-007): item elegível E período livre E abaixo do teto E sem registro recente. */
export function shouldAskMeasure(policy: MeasurePromptPolicy, ctx: MeasurePromptContext): boolean {
  if (!ctx.items?.some(policy.appliesTo)) return false
  if (ctx.periodMarked) return false
  if (policy.weeklyCap != null && (ctx.weekDaysUsed ?? 0) >= policy.weeklyCap) return false
  if (!ctx.lastMeasuredAt) return true
  const last = parseISO(ctx.lastMeasuredAt)
  if (policy.recencyDays === null) return periodKeyOf(policy, last) !== periodKeyOf(policy, ctx.now)
  // Janela de N dias locais contando hoje: com N=7, registro de hoje-6 suprime; de hoje-7 libera.
  const lastDay = formatLocalDate(last)
  const windowStart = formatLocalDate(addDays(ctx.now, -(policy.recencyDays - 1)))
  return lastDay < windowStart
}

export function promptStorageKey(userId: string, policy: MeasurePromptPolicy, periodKey: string): string {
  return `measurePrompt:${userId}:${policy.biomarkerType}:${periodKey}`
}

async function currentUserId(): Promise<string | null> {
  try {
    const session = await supabase.auth.getSession()
    return session?.data?.session?.user?.id ?? null
  } catch {
    return null
  }
}

// Leitura lenta não pode segurar o sheet: estourou o tempo ⇒ "sem medida" ⇒ pede (R-1).
const LATEST_TIMEOUT_MS = 2500

async function withTimeout<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), LATEST_TIMEOUT_MS) })
  try {
    return await Promise.race([read(), timeout])
  } catch {
    return fallback
  } finally {
    clearTimeout(timer)
  }
}

export type LastMeasure = { value: number; valueSecondary?: number | null; measuredAt: string }

async function readLastMeasure(policy: MeasurePromptPolicy): Promise<LastMeasure | null> {
  const latest = await withTimeout<unknown>(() => measuresRepo.getLatest(policy.biomarkerType), null)
  const row = latest as { measured_at?: string; value?: number | string; value_secondary?: number | string | null } | null
  if (!row?.measured_at) return null
  const secondary = row.value_secondary == null ? null : Number(row.value_secondary)
  const base = { value: Number(row.value), measuredAt: row.measured_at }
  return secondary === null ? base : { ...base, valueSecondary: secondary }
}

async function readPeriodMarked(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) != null
  } catch {
    return false // falha de leitura = livre (mesma filosofia do R-1)
  }
}

// Teto semanal (PA): dias locais da semana com registro ∪ dias marcados por dispensa. Falha de
// leitura conta só o que leu — no pior caso pede 1× a mais, nunca bloqueia a dose (INV-4).
async function readWeekDaysUsed(policy: MeasurePromptPolicy, userId: string, now: Date): Promise<number> {
  const monday = mondayOf(now)
  const days: string[] = []
  for (let d = monday; formatLocalDate(d) <= formatLocalDate(now); d = addDays(d, 1)) days.push(formatLocalDate(d))
  const rows = await withTimeout<unknown[]>(
    () => measuresRepo.list({ type: policy.biomarkerType, fromTs: monday.toISOString() }),
    []
  )
  const used = new Set<string>()
  for (const row of rows as Array<{ measured_at?: string }>) {
    if (row?.measured_at) used.add(formatLocalDate(parseISO(row.measured_at)))
  }
  const marks = await Promise.all(days.map((day) => readPeriodMarked(promptStorageKey(userId, policy, day))))
  marks.forEach((marked, i) => { if (marked) used.add(days[i]) })
  return used.size
}

// Um aviso por sessão: o snapshot do Hoje anterior ao OTA 0.34.0+ota.1 não tem a coluna até o 1º refresh (C-B6).
let missingReported = false
function reportMissingKey() {
  if (__DEV__) console.warn('[measurePrompt] protocol sem tracked_measure — select incompleto? (spec 100 E-1)')
  if (missingReported) return
  missingReported = true
  Sentry.captureMessage('measure_prompt_missing_tracked_measure', 'warning')
}

export type MeasureSource = 'configured' | 'fallback'

export type PostDoseStep = {
  policy: MeasurePromptPolicy
  userId: string
  periodKey: string
  lastMeasure: LastMeasure | null
  measureSource: MeasureSource
}

// FR-012: `configured` quando algum item da medida tem escolha gravada; `fallback` = regra da 069 (NULL).
function sourceOf(items: PromptItem[], measure: Measure): MeasureSource {
  const configured = items.some(
    (item) => measureOfItem(item) === measure && item?.protocol?.tracked_measure != null
  )
  return configured ? 'configured' : 'fallback'
}

/** Medidas presentes no lote, na ordem do rank; reporta chave ausente. Puro exceto o aviso. */
export function measuresInBatch(items: PromptItem[]): Measure[] {
  const present = new Set<Measure>()
  let missing = false
  for (const item of items ?? []) {
    const measure = measureOfItem(item)
    if (measure === 'missing') missing = true
    else if (measure !== 'nenhum') present.add(measure)
  }
  if (missing) reportMissingKey()
  return MEASURE_RANK.filter((measure) => present.has(measure))
}

async function evaluate(policy: MeasurePromptPolicy, items: PromptItem[], userId: string, now: Date): Promise<PostDoseStep | null> {
  const periodKey = periodKeyOf(policy, now)
  const [periodMarked, lastMeasure, weekDaysUsed] = await Promise.all([
    readPeriodMarked(promptStorageKey(userId, policy, periodKey)),
    readLastMeasure(policy),
    policy.weeklyCap != null ? readWeekDaysUsed(policy, userId, now) : Promise.resolve(0),
  ])
  const lastMeasuredAt = lastMeasure?.measuredAt ?? null
  if (!shouldAskMeasure(policy, { items, periodMarked, lastMeasuredAt, now, weekDaysUsed })) return null
  return { policy, userId, periodKey, lastMeasure, measureSource: sourceOf(items, policy.biomarkerType) }
}

/**
 * Slot único pós-dose (S-5): devolve o pedido a exibir ou null. Nunca lança.
 * Sem user_id não há throttle seguro por conta ⇒ não pede. Lote: as medidas presentes são lidas em
 * paralelo e vence a primeira LIVRE no rank (FR-008) — ordem de chegada no lote não desempata.
 */
export async function resolvePostDoseStep({ items }: { items: PromptItem[] }): Promise<PostDoseStep | null> {
  try {
    const measures = measuresInBatch(items)
    if (measures.length === 0) return null
    const userId = await currentUserId()
    if (!userId) return null
    const now = getNow()
    const steps = await Promise.all(measures.map((m) => evaluate(MEASURE_PROMPT_POLICIES[m], items, userId, now)))
    return steps.find((step) => step !== null) ?? null
  } catch {
    return null // INV-4: a dose já está salva; o pedido é secundário
  }
}

/** Encerra o pedido no período ("Agora não", fechar sem botão). Salvar não marca: a recência cobre (R-15). Best-effort. */
export async function markPromptPeriod(step: PostDoseStep): Promise<void> {
  try {
    await AsyncStorage.setItem(promptStorageKey(step.userId, step.policy, step.periodKey), '1')
  } catch {
    // marca perdida = o pedido pode reaparecer 1× no período; nunca bloqueia o fechamento
  }
}
