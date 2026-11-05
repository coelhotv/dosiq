// resolvedDoseStore.ts — ocorrências resolvidas NESTE aparelho (spec 082 D2 · C-35)
//
// O registro in-app cancela alarme + superfície, mas um arme em voo (derive do bridge, boundary
// entregue, reconcile do alarme) que leu a dose ainda `pending` pode terminar DEPOIS do cancel e
// re-agendar o boundary — smoke 054 C-35: `taken` 22:25:02, boundary `late` 22:34:00. Esta marca é
// conferida pela superfície imediatamente antes de exibir/agendar, então o arme atrasado vira no-op.
//
// AsyncStorage (vale também no headless), mapa `{ [doseInstanceId]: epochMs }`, TTL 24 h. Desfazer o
// registro desmarca. Best-effort em tudo: falha de leitura ⇒ "não resolvida" (comportamento anterior).

import AsyncStorage from '@react-native-async-storage/async-storage'

export const RESOLVED_DOSES_KEY = '@dosiq/resolved-doses'
export const RESOLVED_DOSE_TTL_MS = 24 * 60 * 60 * 1000

async function _read(nowMs: number): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(RESOLVED_DOSES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const out: Record<string, number> = {}
    for (const [id, ms] of Object.entries(parsed || {})) {
      if (typeof ms === 'number' && Number.isFinite(ms) && ms + RESOLVED_DOSE_TTL_MS > nowMs) out[id] = ms
    }
    return out
  } catch {
    return {}
  }
}

/** Marca as ocorrências como resolvidas (registro aceito pelo servidor). */
// Escritas SERIALIZADAS: ler-mutar-gravar do mapa inteiro em paralelo (registro em lote + pulo)
// perdia a marca de quem gravou primeiro — e marca perdida reabre o C-35 (RC6 #930).
let _chain: Promise<unknown> = Promise.resolve()

function _write(mutate: (map: Record<string, number>, nowMs: number) => void, nowMs: number): Promise<void> {
  const run = _chain
    .then(async () => {
      const map = await _read(nowMs)
      mutate(map, nowMs)
      await AsyncStorage.setItem(RESOLVED_DOSES_KEY, JSON.stringify(map))
    })
    .catch(() => {
      // best-effort — sem a marca, vale só o cancel imediato (comportamento anterior)
    })
  _chain = run
  return run
}

export function markDosesResolved(ids: string[], nowMs: number = Date.now()): Promise<void> {
  return _write((map, at) => {
    for (const id of ids) if (id) map[String(id)] = at
  }, nowMs)
}

/** Retira a marca (desfazer registro: a dose volta a `pending` e a superfície pode voltar). */
export function unmarkDoseResolved(id: string, nowMs: number = Date.now()): Promise<void> {
  return _write((map) => {
    delete map[String(id)]
  }, nowMs)
}

/** A ocorrência foi resolvida neste aparelho nas últimas 24 h? Falha ⇒ false. */
export async function isDoseResolved(id: string | null | undefined, nowMs: number = Date.now()): Promise<boolean> {
  if (!id) return false
  return String(id) in (await _read(nowMs))
}
