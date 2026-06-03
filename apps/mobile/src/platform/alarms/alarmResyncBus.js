// alarmResyncBus.js — sinal leve "re-sincronize os alarmes" (Spec 001, FR-006 / insumo E)
//
// Mutações de tratamento (criar/editar/pausar/retomar/excluir) alteram as
// dose_instances futuras (via syncInstancesOnWrite). O AlarmSchedulerBridge
// assina este bus e re-roda o agendamento APÓS a mutação invalidar os snapshots
// — sem acoplar os hooks de tratamento ao scheduler (dep zero, só pub/sub).
//
// Idempotente e best-effort: emitir com o alarme desligado é no-op (o bridge
// ignora quando isAlarmEnabled=false).

const listeners = new Set()

/** Assina o sinal de re-sync. Retorna unsubscribe. */
export function onAlarmResync(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Dispara o re-sync em todos os assinantes (chamar após mutação de tratamento). */
export function triggerAlarmResync() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // best-effort — um listener com erro não pode derrubar a mutação
    }
  }
}
