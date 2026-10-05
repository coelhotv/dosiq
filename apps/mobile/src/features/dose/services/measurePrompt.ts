// measurePrompt.ts — pedido de medida após a dose (spec 069 A2 · FR-001..FR-003).
//
// Regra PURA (shouldAskMeasure) separada do I/O (marca local + último peso): os modais só perguntam
// resolvePostDoseStep(ctx) e nunca a regra do peso direto (slot único — S-5).
// Política como dado (S-3): hoje só `peso`, período semanal (segunda local — R-2/AP-270).
// Marca no aparelho, com user_id na chave (FR-003/S-1): trocar de conta não herda a marca.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { mondayOf, formatLocalDate, addDays, parseISO, getNow } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { measuresRepo } from '@measures/services/measuresRepo'

export type PromptItem = { protocol?: { frequency?: string | null; medicine?: unknown } | null }

export type MeasurePromptPolicy = {
  biomarkerType: 'peso'
  period: 'day' | 'week'
  recencyDays: number
  appliesTo: (item: PromptItem) => boolean
}

// Só SEMANAL (R-11, emenda do PO 2026-10-05 no smoke da 069 Bb): "injetável" pegava anticoncepcional
// mensal e insulina diária — falso positivo do wedge GLP-1. O mesmo predicado decide o pedido de peso
// da Fase A e o card da Fase B. GLP-1 diário injetável (Saxenda) fica fora até existir classe
// terapêutica rastreável (CMED); a saída planejada é a configuração do gráfico por tratamento.
export function isWeightEligible(item: PromptItem): boolean {
  return item?.protocol?.frequency === 'semanal'
}

export const MEASURE_PROMPT_POLICIES: Record<'peso', MeasurePromptPolicy> = {
  peso: { biomarkerType: 'peso', period: 'week', recencyDays: 7, appliesTo: isWeightEligible },
}

export type MeasurePromptContext = {
  items: PromptItem[]
  periodMarked: boolean
  lastMeasuredAt: string | null // ISO do último registro do tipo; null = nenhum OU leitura falhou (R-1)
  now: Date
}

/** Chave do período LOCAL: segunda-feira da semana (week) ou o próprio dia (day). Nunca toISOString. */
export function periodKeyOf(policy: MeasurePromptPolicy, now: Date): string {
  return formatLocalDate(policy.period === 'week' ? mondayOf(now) : now)
}

/** Regra pura (FR-002): algum item elegível E período livre E nada registrado nos últimos N dias locais. */
export function shouldAskMeasure(policy: MeasurePromptPolicy, ctx: MeasurePromptContext): boolean {
  if (!ctx.items?.some(policy.appliesTo)) return false
  if (ctx.periodMarked) return false
  if (!ctx.lastMeasuredAt) return true
  // Janela de N dias locais contando hoje: com N=7, registro de hoje-6 suprime; de hoje-7 libera.
  const lastDay = formatLocalDate(parseISO(ctx.lastMeasuredAt))
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

// Leitura lenta não pode segurar o sheet: estourou o tempo ⇒ "sem peso" ⇒ pede (R-1).
const LATEST_TIMEOUT_MS = 2500

export type LastMeasure = { value: number; measuredAt: string }

async function readLastMeasure(policy: MeasurePromptPolicy): Promise<LastMeasure | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), LATEST_TIMEOUT_MS) })
  try {
    const latest = await Promise.race([measuresRepo.getLatest(policy.biomarkerType), timeout])
    const row = latest as { measured_at?: string; value?: number | string } | null
    if (!row?.measured_at) return null
    return { value: Number(row.value), measuredAt: row.measured_at }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function readPeriodMarked(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) != null
  } catch {
    return false // falha de leitura = livre (mesma filosofia do R-1)
  }
}

export type PostDoseStep = { policy: MeasurePromptPolicy; userId: string; periodKey: string; lastMeasure: LastMeasure | null }

/**
 * Slot único pós-dose (S-5): devolve o pedido a exibir ou null. Nunca lança.
 * Sem user_id não há throttle seguro por conta ⇒ não pede.
 */
export async function resolvePostDoseStep({ items }: { items: PromptItem[] }): Promise<PostDoseStep | null> {
  const policy = MEASURE_PROMPT_POLICIES.peso
  if (!items?.some(policy.appliesTo)) return null
  const userId = await currentUserId()
  if (!userId) return null
  const now = getNow()
  const periodKey = periodKeyOf(policy, now)
  const [periodMarked, lastMeasure] = await Promise.all([
    readPeriodMarked(promptStorageKey(userId, policy, periodKey)),
    readLastMeasure(policy),
  ])
  const lastMeasuredAt = lastMeasure?.measuredAt ?? null
  if (!shouldAskMeasure(policy, { items, periodMarked, lastMeasuredAt, now })) return null
  return { policy, userId, periodKey, lastMeasure }
}

/** Encerra o pedido no período ("Agora não", fechar sem botão). Salvar não marca: a recência cobre (R-15). Best-effort. */
export async function markPromptPeriod(step: PostDoseStep): Promise<void> {
  try {
    await AsyncStorage.setItem(promptStorageKey(step.userId, step.policy, step.periodKey), '1')
  } catch {
    // marca perdida = o pedido pode reaparecer 1× na semana; nunca bloqueia o fechamento
  }
}
