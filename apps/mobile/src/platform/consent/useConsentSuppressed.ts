// useConsentSuppressed — supressão LOCAL (no aparelho) das superfícies de dado de saúde quando o
// consentimento está REVOGADO (spec 046, contraparte local da supressão de PUSH no servidor, R-292).
//
// Os bridges (AlarmSchedulerBridge, DoseActivityBridge, DoseLiveActivityBridge) montam no AppRoot,
// ACIMA do ConsentGateProvider — que só envolve o Navigation — logo NÃO enxergam o contexto do gate.
// Sem uma leitura própria, um reload de um titular que revogou reprograma alarmes e a Live Activity
// (vazamento pego no smoke: logs de setup notifee mesmo na tela de bloqueio). Este hook lê a trilha
// direto e re-checa nos mesmos boundaries dos bridges (mount / troca de usuário / foreground) e no
// bus de consentimento (revoke/grant in-app, que não passam por foreground).
//
// FAIL-OPEN CONSCIENTE: suprime SÓ quando a leitura CONFIRMA 'revoked'. Numa falha de leitura mantém
// o valor anterior — não some com os alarmes clínicos de um titular que consentiu por causa de um
// piscar de rede. Um revoke real está persistido no servidor; a próxima leitura bem-sucedida (foreground
// ou bus) suprime. A trava da UI do app é gateada à parte (ConsentGateProvider, que trata indeterminado).

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState } from 'react-native'
import { createConsentService } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { onConsentChange } from './consentSuppressionBus'

const consentService = createConsentService({ client: supabase as never })

/** true quando o consentimento de dado de saúde está REVOGADO — o bridge deve desarmar suas superfícies. */
export function useConsentSuppressed(userId: string | null): boolean {
  const [suppressed, setSuppressed] = useState(false)
  const suppressedRef = useRef(false)

  const check = useCallback(async () => {
    if (!userId) {
      suppressedRef.current = false
      setSuppressed(false)
      return
    }
    try {
      const current = await consentService.getStatus('health_data')
      const next = current.status === 'revoked'
      suppressedRef.current = next
      setSuppressed(next)
    } catch {
      // Indeterminado (falha de leitura): mantém o valor anterior — ver FAIL-OPEN no cabeçalho.
    }
  }, [userId])

  // Re-checa em mount/troca de usuário; e no foreground e no bus de consentimento (revoke/grant
  // in-app). Sincroniza com sistema externo (a trilha no backend) — setState no callback assíncrono.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check()
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check()
    })
    const offConsent = onConsentChange(check)
    return () => {
      appSub.remove()
      offConsent()
    }
  }, [check])

  return suppressed
}
