// doseActivityRefreshBus.js — sinal leve "re-derive a superfície de dose" (Spec 039 / F3)
//
// O registro de dose (modal/in-app/alarme, via doseService._cancelAlarmBestEffort) NÃO dispara
// re-derive da Live Activity por si só no iOS — o JS não roda em background e, registrando em
// foreground, não há mudança de AppState que acione o DoseLiveActivityBridge. Sem este sinal a
// LA fica no estado anterior (ex.: `late`) até o próximo gatilho (foreground/resync/interval).
//
// Este bus desacopla o doseService do bridge (dep zero pub/sub, igual alarmResyncBus): o registro
// emite, o DoseLiveActivityBridge re-deriva e transiciona p/ o card `done`. iOS-only de fato (o
// Android resolve o done no próprio choke point via doseActivitySurfaceService); no Android nada
// assina → no-op. Best-effort: um listener com erro não derruba o registro.

const listeners = new Set()

/** Assina o sinal de refresh da superfície de dose. Retorna unsubscribe. */
export function onDoseActivityRefresh(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Dispara o refresh em todos os assinantes (chamar após registrar/cancelar uma dose).
 * @param {{ instanceId?: string, takenAt?: Date|string }} [payload] instanceId tomada + HORÁRIO
 *   REAL da tomada (getRawNow no registro). dose_instances NÃO tem coluna de horário de tomada
 *   (registeredAt do doseItem = scheduled_for), então a hora real só existe aqui, no momento do registro.
 */
export function triggerDoseActivityRefresh(payload) {
  for (const fn of listeners) {
    try {
      fn(payload)
    } catch {
      // best-effort — não pode derrubar a mutação que o emitiu
    }
  }
}
