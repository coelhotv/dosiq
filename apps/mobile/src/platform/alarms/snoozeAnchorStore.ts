// snoozeAnchorStore.ts — âncora LOCAL da soneca (Spec 101, FR-006)
//
// A superfície de dose some ao adiar e reaparece em `snoozedUntil` no estado `now`. O banco não serve
// sozinho como âncora: `setSnoozedUntil` é fail-open (offline ⇒ nunca chega) e o claim do servidor zera
// `snoozed_until` justamente no instante do reaparecimento (doseReminders `_claimInstances`). Os bridges
// mesclam esta âncora nos DoseItems antes de derivar a superfície.
//
// Persistência em AsyncStorage, mapa `{ [doseInstanceId]: epochMs }`. Best-effort em tudo.

import AsyncStorage from '@react-native-async-storage/async-storage'

export const SNOOZE_ANCHOR_KEY = '@dosiq/snooze-anchor'

// A âncora só importa até o fim do `now` aberto por ela (10 min). 24h de folga cobre relógio torto e
// app que só volta ao foreground horas depois, sem acumular lixo.
export const SNOOZE_ANCHOR_TTL_MS = 24 * 60 * 60 * 1000

/** Lê o mapa cru, já podado. Falha ou JSON inválido → {}. @private */
async function _read(nowMs: number): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_ANCHOR_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const out: Record<string, number> = {}
    for (const [id, ms] of Object.entries(parsed || {})) {
      if (typeof ms === 'number' && Number.isFinite(ms) && ms + SNOOZE_ANCHOR_TTL_MS > nowMs) out[id] = ms
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Grava a âncora para cada ocorrência adiada (alarme agrupado adia o grupo inteiro).
 * @param {string[]} ids - doseInstanceIds
 * @param {number} anchorMs - epoch ms do fim da soneca
 * @param {number} [nowMs]
 */
export async function setSnoozeAnchors(ids: string[], anchorMs: number, nowMs: number = Date.now()): Promise<void> {
  try {
    const map = await _read(nowMs)
    for (const id of ids) if (id) map[String(id)] = anchorMs
    await AsyncStorage.setItem(SNOOZE_ANCHOR_KEY, JSON.stringify(map))
  } catch {
    // best-effort — sem âncora local a superfície cai no `snoozed_until` do banco
  }
}

/** Mapa `{ id: epochMs }` das âncoras vigentes. Fail-open → {}. */
export async function getSnoozeAnchors(nowMs: number = Date.now()): Promise<Record<string, number>> {
  return _read(nowMs)
}

/** Epoch ms de um `snoozedUntil` do banco (ISO/ms); inválido → null. @private */
function _toMs(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string' || v === '') return null
  const ms = Date.parse(v) // ISO absoluto com offset (timestamptz) — não é data local 'YYYY-MM-DD' (R-020)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Mescla as âncoras locais nos DoseItems: vale a MAIS RECENTE entre banco e local (uma 2ª soneca
 * sempre empurra para frente). Puro.
 */
export function mergeSnoozeAnchors<T extends { instanceId?: string | null; snoozedUntil?: unknown }>(
  items: T[],
  anchors: Record<string, number>
): T[] {
  return items.map((it) => {
    const local = it.instanceId ? anchors[String(it.instanceId)] : undefined
    if (local == null) return it
    const db = _toMs(it.snoozedUntil)
    return db !== null && db >= local ? it : { ...it, snoozedUntil: local }
  })
}

// Spec 101 C-25: contagem de sonecas por ocorrência. O resync (`syncAlarms`) re-arma o alarme da
// soneca a partir da âncora; sem a contagem ele voltava com `snoozeAttempt: 0` e o teto de sonecas
// zerava. Só vale enquanto a âncora existir (poda junto).
export const SNOOZE_ATTEMPT_KEY = '@dosiq/snooze-attempt'

/** Grava a tentativa de soneca de cada ocorrência. Best-effort. */
export async function setSnoozeAttempts(ids: string[], attempt: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_ATTEMPT_KEY)
    const map = { ...(raw ? JSON.parse(raw) : {}) }
    for (const id of ids) if (id) map[String(id)] = attempt
    const anchors = await _read(Date.now())
    for (const id of Object.keys(map)) if (!(id in anchors) && !ids.includes(id)) delete map[id]
    await AsyncStorage.setItem(SNOOZE_ATTEMPT_KEY, JSON.stringify(map))
  } catch {
    // best-effort — sem contagem, o re-arme volta a 0 (comportamento anterior)
  }
}

/** Mapa `{ id: tentativa }`. Fail-open → {}. */
export async function getSnoozeAttempts(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_ATTEMPT_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const out: Record<string, number> = {}
    for (const [id, n] of Object.entries(parsed || {})) if (typeof n === 'number' && Number.isFinite(n)) out[id] = n
    return out
  } catch {
    return {}
  }
}
