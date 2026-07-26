// useAlarmScreenActive.ts — sinaliza se `AlarmFullScreen` é a rota atual (spec 051-A, obrigação
// clínica > bloqueio de update).
//
// A dose crítica não perde a obrigação de alertar o usuário porque o binário está desatualizado —
// mesmo que os botões de ação (Tomei/Pular) falhem por bug de banco/registro, o alerta VISUAL tem
// que aparecer. `VersionGateOverlay` obedece este sinal e cede o topo da tela pro alarme; a decisão
// pura do resolver (`blocked`) não muda — só a UI escolhe não desenhar por cima.
//
// `navigationRef` é ref de nível de módulo (ver navigation/navigationRef.ts) — importável fora da
// árvore do NavigationContainer, sem precisar de contexto.

import { useEffect, useState } from 'react'
import { navigationRef } from '@navigation/navigationRef'
import { ROUTES } from '@navigation/routes'

// Intervalo de polling. NÃO usar `navigationRef.addListener('state', ...)`: este hook (via
// `VersionGateOverlay`) monta em paralelo à árvore de navegação, ANTES do `NavigationContainer`
// existir (ele só monta depois que `session` resolve — ver `Navigation.tsx`, `NavigationTree`
// retorna o spinner de loading antes do `NavigationContainer`). Um listener anexado nesse momento
// não tem a que se anexar e nunca dispara depois, mesmo quando o container monta e navega — o
// overlay ficaria preso pra sempre por cima do alarme (achado no smoke 055, PO-7d: a navegação
// funcionou, mas o overlay nunca soube). Polling não depende de QUANDO o container fica pronto —
// só lê `isReady()`/`getCurrentRoute()` a cada tick, correto em qualquer ordem de montagem.
const POLL_MS = 250

export function useAlarmScreenActive(): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    function check() {
      const current = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined
      setActive(current === ROUTES.ALARM_FULLSCREEN)
    }

    check()
    const interval = setInterval(check, POLL_MS)
    return () => clearInterval(interval)
  }, [])

  return active
}
