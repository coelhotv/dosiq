// registerHandoff — dose entregue à modal pelo "Registrar" não volta à tela cheia (spec 090 S-3).
//
// "Registrar" (superfície 039) tira o alarme da frente (`popTo(TABS)`) e abre a modal da dose. Mas o
// toque traz o app ao foreground → `AppState 'active'` → `promoteActiveAlarm` acha a notificação do
// alarme ainda na bandeja e navega de volta ao takeover, 1,3 s depois, por cima da modal (smoke
// 28/09 23:04, log: `go [Tabs, AlarmFullScreen]` → `openAlarmScreen navigate`). A pessoa já disse
// "vou registrar esta dose": a promoção dela fica suspensa por uma janela curta. Alarme de OUTRA
// dose continua subindo normalmente.

const HANDOFF_TTL_MS = 5 * 60_000
const handedOff = new Map<string, number>()

/** Marca a(s) dose(s) entregue(s) à modal de registro. */
export function markRegisterHandoff(doseInstanceIds: Array<string | null | undefined>, now = Date.now()): void {
  for (const id of doseInstanceIds) if (id) handedOff.set(id, now)
}

/** `true` enquanto a dose está com a modal de registro (TTL de 5 min). */
export function isHandedOffToRegister(doseInstanceId: string | null | undefined, now = Date.now()): boolean {
  if (!doseInstanceId) return false
  const at = handedOff.get(doseInstanceId)
  if (at == null) return false
  if (now - at > HANDOFF_TTL_MS) {
    handedOff.delete(doseInstanceId)
    return false
  }
  return true
}

/** Só testes. */
export function __resetRegisterHandoff(): void {
  handedOff.clear()
}
