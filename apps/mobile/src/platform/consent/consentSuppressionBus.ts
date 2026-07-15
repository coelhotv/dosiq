// consentSuppressionBus.ts — sinal leve "o consentimento mudou, re-cheque a supressão" (spec 046).
//
// Os bridges de superfície (alarme invasivo, dose activity Android, Live Activity iOS) montam no
// AppRoot, ACIMA do ConsentGateProvider, e reprogramam alarmes/superfícies em boundaries próprios
// (mount / foreground / resync de tratamento). Um grant/revoke feito IN-APP não passa por nenhum
// desses boundaries — o usuário não fecha nem sai do app. Sem este sinal, revogar dentro do app
// travaria a UI mas deixaria os alarmes JÁ agendados dispararem depois (a trava esconde a tela, não
// desarma o trigger nativo). O ConsentGateProvider emite aqui a cada refresh (grant/revoke/foreground)
// e useConsentSuppressed re-lê a trilha. Dep zero, só pub/sub (mesmo padrão do alarmResyncBus).

const listeners = new Set<() => void>()

/** Assina a mudança de consentimento. Retorna unsubscribe. */
export function onConsentChange(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Dispara o sinal em todos os assinantes (chamar após grant/revoke re-avaliar o gate). */
export function triggerConsentChange() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // best-effort — um listener com erro não pode derrubar o refresh do gate
    }
  }
}
