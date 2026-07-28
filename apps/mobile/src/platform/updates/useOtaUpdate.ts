// useOtaUpdate.ts — checagem+download de OTA em sessão viva (spec 051-A · FR-023/PO-11)
//
// Só CHECA e BAIXA aqui — nunca aplica sozinho. `Updates.reloadAsync()` recarrega a árvore React
// inteira (apagaria formulário meio preenchido, tela de alarme, fluxo de estoque em andamento);
// quem decide é o usuário, sempre, tocando no banner (TodayScreen.tsx). FR-005 (checagem no
// launch nativo) já cobre o cold start — este hook só cobre o caso "processo já vivo, app volta
// do background", que a FR-005 não alcança.
//
// Throttle de ~15min: sem ele cada alternância de app dispara 1 request — custo de bateria/dados
// relevante no plano de dados limitado que é a regra no Brasil.
//
// Não checa no mount: só reage a transições REAIS pra 'active' (AppState.addEventListener não
// dispara no registro, só em mudança de estado). Rodar no mount duplicaria a checagem nativa do
// cold start e poderia deixar o banner pronto para aparecer logo na abertura — quebraria a
// garantia de FR-005/T056 ("cold start não vê banner").

import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import * as Updates from 'expo-updates'
import AsyncStorage from '@react-native-async-storage/async-storage'

const THROTTLE_MS = 15 * 60 * 1000
const LAST_CHECK_KEY = 'ota_update:last_check_at'

export interface UseOtaUpdateResult {
  /** true quando um update foi baixado e está pronto para `applyUpdate()`. */
  updateReady: boolean
  /** Recarrega o app no bundle baixado. Só chamar por toque explícito do usuário (PO-11). */
  applyUpdate: () => void
}

export function useOtaUpdate(): UseOtaUpdateResult {
  const [updateReady, setUpdateReady] = useState(false)
  const checkingRef = useRef(false)

  useEffect(() => {
    async function checkAndDownload() {
      if (checkingRef.current || !Updates.isEnabled) return
      checkingRef.current = true
      try {
        const lastRaw = await AsyncStorage.getItem(LAST_CHECK_KEY)
        const last = lastRaw ? Number(lastRaw) : 0
        if (Date.now() - last < THROTTLE_MS) return
        await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()))

        const result = await Updates.checkForUpdateAsync()
        if (!result.isAvailable) return
        await Updates.fetchUpdateAsync()
        setUpdateReady(true)
      } catch {
        // Fail-silent — mesma postura de bundleInfo.ts: falha de rede/checagem não pode
        // interromper o uso do app, só custa não saber que há update pronto.
      } finally {
        checkingRef.current = false
      }
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndDownload()
    })

    return () => subscription.remove()
  }, [])

  function applyUpdate() {
    Updates.reloadAsync().catch(() => {})
  }

  return { updateReady, applyUpdate }
}
