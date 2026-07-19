// titrationRefreshBus — sinal leve "a evolução mudou, re-leia" (029 F5).
//
// POR QUE EXISTE: a ação `[Iniciar etapa]` do PUSH resolve com `opensAppToForeground:false` —
// a RPC roda, a escada transiciona e o app **não muda de tela nem de AppState**. Se o Hoje já
// estava aberto e focado, nada dispara releitura: `useFocusEffect` não roda (a tela nunca perdeu
// o foco) e não há evento de foreground. O card seguia na tela anunciando uma pendência que já
// não existe — pior que não atualizar, porque convida a um segundo toque (achado no smoke do F5).
//
// Mesmo desenho do `doseActivityRefreshBus` (pub/sub sem dependência): quem MUTA emite, quem
// EXIBE assina. Best-effort — um assinante com erro não derruba a mutação que o emitiu.

const listeners = new Set<() => void>()

/** Assina o sinal. Retorna unsubscribe. */
export function onTitrationRefresh(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Emitir SEMPRE que a escada mudar fora do ciclo de render (confirmação por push, RPC). */
export function triggerTitrationRefresh(): void {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // best-effort — a transição no servidor já aconteceu; falha de UI não pode escalar
    }
  }
}
