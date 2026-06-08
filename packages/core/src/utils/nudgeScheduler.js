/**
 * nudgeScheduler — lógica pura de seleção e filtragem de nudges.
 *
 * Sem dependências de platform (browser/RN). Storage injetado via opts.
 * Exporta também TZ_RECONCILE_NUDGE: nudge local que substitui TzNudge/TzNudgeCard.
 */

import { satisfiesSemver } from './semver.js'
import { getNow, parseISO } from './dateUtils.js'

/**
 * Chave de dismiss para um nudge (remote ou local).
 * Formato: "<id>:<version>"
 */
export function dismissKey(nudge) {
  return `${nudge.id}:${nudge.version}`
}

/**
 * Filtra nudges por plataforma corrente.
 * @param {object[]} nudges
 * @param {'ios'|'android'|'web'} platform
 */
function filterByPlatform(nudges, platform) {
  if (!platform) return nudges
  return nudges.filter((n) => n.platform === 'all' || n.platform === platform)
}

/**
 * Filtra nudges por janela de datas (start_at / end_at).
 * @param {object[]} nudges
 * @param {Date} now
 */
function filterByDates(nudges, now) {
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
function filterByVersion(nudges, appVersion) {
  if (!appVersion) return nudges
  return nudges.filter((n) =>
    satisfiesSemver(appVersion, n.min_app_version, n.max_app_version)
  )
}

/**
 * Remove nudges já dispensados pelo usuário.
 * Lê do storage de forma síncrona (valores já resolvidos via opts.dismissed).
 * @param {object[]} nudges
 * @param {Set<string>} dismissed  conjunto de chaves já lidas do storage
 */
function filterDismissed(nudges, dismissed) {
  return nudges.filter((n) => !dismissed.has(dismissKey(n)))
}

/**
 * Ordena por prioridade decrescente; empate mantém ordem original.
 */
function sortByPriority(nudges) {
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
 *
 * @returns {object[]} nudges ordenados por prioridade, prontos para exibição
 */
export function buildNudgeList(remoteNudges, localNudges, opts) {
  const {
    platform,
    appVersion = null,
    dismissed = new Set(),
    now = getNow(),
  } = opts ?? {}

  const all = [...(remoteNudges ?? []), ...(localNudges ?? [])]

  const pipeline = [
    (n) => filterByPlatform(n, platform),
    (n) => filterByDates(n, now),
    (n) => filterByVersion(n, appVersion),
    (n) => filterDismissed(n, dismissed),
    sortByPriority,
  ]

  return pipeline.reduce((acc, fn) => fn(acc), all)
}
