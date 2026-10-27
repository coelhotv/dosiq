/**
 * nudgeScheduler — lógica pura de seleção e filtragem de nudges.
 *
 * Sem dependências de platform (browser/RN). Storage injetado via opts.
 */

import { satisfiesSemver } from './semver'
import { getNow, parseISO } from './dateUtils'
import { resolveNudgeDestination, type NudgeNavigatePayload } from './nudgeDestinations'

export interface Nudge {
  id: string
  /** `in_app_nudges.version` (integer NOT NULL DEFAULT 1) — subir reexibe para quem dispensou. */
  version?: number | string
  platform?: 'ios' | 'android' | 'web' | 'all'
  start_at?: string | null
  end_at?: string | null
  min_app_version?: string | null
  max_app_version?: string | null
  priority?: number | null
  [key: string]: unknown
}

interface BuildNudgeListOpts {
  platform?: 'ios' | 'android' | 'web'
  appVersion?: string | null
  dismissed?: Set<string>
  now?: Date
  /** `false` esconde nudges cujo destino exige estoque. Omitido = não filtra. */
  stockTrackingEnabled?: boolean
}

/**
 * Chave de dismiss para um nudge (remote ou local).
 * Formato: "<id>:<version>"
 */
export function dismissKey(nudge: Nudge): string {
  return `${nudge.id}:${nudge.version}`
}

/**
 * Filtra nudges por plataforma corrente.
 * @param {object[]} nudges
 * @param {'ios'|'android'|'web'} platform
 */
function filterByPlatform(nudges: Nudge[], platform: string | undefined): Nudge[] {
  if (!platform) return nudges
  return nudges.filter((n) => n.platform === 'all' || n.platform === platform)
}

/**
 * Filtra nudges por janela de datas (start_at / end_at).
 * @param {object[]} nudges
 * @param {Date} now
 */
function filterByDates(nudges: Nudge[], now: Date): Nudge[] {
  return nudges.filter((n) => {
    if (n.start_at && parseISO(n.start_at) > now) return false
    if (n.end_at && parseISO(n.end_at) < now) return false
    return true
  })
}

/**
 * Filtra nudges por versão do app.
 * @param {object[]} nudges
 * @param {string|null} appVersion  ex: "0.3.4"
 */
function filterByVersion(nudges: Nudge[], appVersion: string | null | undefined): Nudge[] {
  if (!appVersion) return nudges
  return nudges.filter((n) =>
    satisfiesSemver(appVersion, n.min_app_version ?? null, n.max_app_version ?? null)
  )
}

/**
 * Remove nudges já dispensados pelo usuário.
 * Lê do storage de forma síncrona (valores já resolvidos via opts.dismissed).
 * @param {object[]} nudges
 * @param {Set<string>} dismissed  conjunto de chaves já lidas do storage
 */
function filterDismissed(nudges: Nudge[], dismissed: Set<string>): Nudge[] {
  return nudges.filter((n) => !dismissed.has(dismissKey(n)))
}

/**
 * Remove nudges `navigate` cujo payload não é um destino canônico (o app não segue rota arbitrária
 * vinda do banco) e, com estoque desligado, os que levam ao Estoque — navegar para lá derruba o app.
 */
function filterByDestination(nudges: Nudge[], stockTrackingEnabled: boolean | undefined): Nudge[] {
  return nudges.filter((n) => {
    if (n.action_type !== 'navigate') return true
    const dest = resolveNudgeDestination(n.action_payload as NudgeNavigatePayload | null | undefined)
    if (!dest) return false
    return !(dest.requiresStock && stockTrackingEnabled === false)
  })
}

/**
 * Ordena por prioridade decrescente; empate mantém ordem original.
 */
function sortByPriority(nudges: Nudge[]): Nudge[] {
  return [...nudges].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

/**
 * Constrói a lista final de nudges a exibir.
 *
 * @param {object[]} remoteNudges  nudges vindos do Supabase (já filtrados por target_view externamente)
 * @param {object[]} localNudges   nudges locais a injetar (ex: [TZ_RECONCILE_NUDGE])
 * @param {object}   opts
 * @param {string}   opts.platform      'ios' | 'android' | 'web'
 * @param {string}   [opts.appVersion]  versão atual do app (ex: "0.3.4")
 * @param {Set<string>} opts.dismissed  chaves de dismiss já lidas do storage
 * @param {Date}     [opts.now]         override de "agora" para testes
 * @param {boolean}  [opts.stockTrackingEnabled]  `false` esconde nudges que levam ao Estoque
 *
 * @returns {object[]} nudges ordenados por prioridade, prontos para exibição
 */
export function buildNudgeList(remoteNudges: Nudge[] | null | undefined, localNudges: Nudge[] | null | undefined, opts: BuildNudgeListOpts | null | undefined): Nudge[] {
  const {
    platform,
    appVersion = null,
    dismissed = new Set<string>(),
    now = getNow(),
    stockTrackingEnabled,
  } = opts ?? {}

  const all = [...(remoteNudges ?? []), ...(localNudges ?? [])]

  const pipeline: Array<(n: Nudge[]) => Nudge[]> = [
    (n) => filterByPlatform(n, platform),
    (n) => filterByDates(n, now),
    (n) => filterByVersion(n, appVersion),
    (n) => filterDismissed(n, dismissed),
    (n) => filterByDestination(n, stockTrackingEnabled),
    sortByPriority,
  ]

  return pipeline.reduce((acc, fn) => fn(acc), all)
}
