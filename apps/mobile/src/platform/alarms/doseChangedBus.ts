// doseChangedBus.ts — sinal leve "uma dose mudou neste aparelho" (spec 103 A, FR-A4)
//
// Escritas de dose feitas FORA da tela do Hoje (botão da notificação, superfície Android, Live
// Activity iOS, tela cheia do alarme) não passam pelo `refresh()` do Hoje. Com o app aberto e sem
// mudança de AppState, o `useTodayData` montado seguia com o registro antigo — e o relógio do Hoje
// (FR-A2) levaria uma dose já tomada a "atrasada". O tick só recalcula a ZONA; o REGISTRO só muda
// por escrita, e este bus é o aviso dela.
//
// Dep zero, só pub/sub (mesmo padrão do alarmResyncBus). Emitir sem assinante (Hoje desmontado,
// handler headless) é no-op. Best-effort: um listener com erro não derruba a escrita.

const listeners = new Set<() => void>()

/** Assina o sinal de dose alterada. Retorna unsubscribe. */
export function onDoseChanged(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Avisa os assinantes — chamar só DEPOIS de uma escrita de dose bem-sucedida. */
export function emitDoseChanged() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // best-effort
    }
  }
}
