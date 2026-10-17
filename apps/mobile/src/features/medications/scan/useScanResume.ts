// useScanResume — na abertura do app no iPhone, leva de volta ao scan quem saiu para os Ajustes
// liberar a câmera (spec 066 D1 · C-D1-6). Montado nas abas logadas (RootTabs), roda uma vez por
// processo. Abertura por alarme ou notificação tem prioridade e descarta a marca (R-309).

import { useEffect } from 'react'
import { Platform } from 'react-native'
import notifee from '@notifee/react-native'
import * as Notifications from 'expo-notifications'
import { navigationRef } from '@navigation/navigationRef'
import { navigateCrossTab } from '@navigation/navigateCrossTab'
import { ROUTES } from '@navigation/routes'
import { shouldResumeScan, takeScanResume } from './scanResume'

let handledThisProcess = false

/** Só para testes. */
export function resetScanResumeForTests() {
  handledThisProcess = false
}

async function launchedByNotification(): Promise<boolean> {
  const [initial, last] = await Promise.all([
    notifee.getInitialNotification().catch(() => null),
    Notifications.getLastNotificationResponseAsync().catch(() => null),
  ])
  return !!initial || !!last
}

export async function resumeScanIfMarked(now = Date.now()): Promise<boolean> {
  const marker = await takeScanResume()
  if (!marker) return false
  const byNotification = await launchedByNotification()
  const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null
  if (!shouldResumeScan({ marker, now, launchedByNotification: byNotification, currentRoute, alarmRoute: ROUTES.ALARM_FULLSCREEN })) {
    return false
  }
  navigateCrossTab(ROUTES.TREATMENTS, ROUTES.MEDICINE_CREATE, { startScan: true, scanEntryPoint: marker.entryPoint })
  return true
}

/** `ready`: as abas já existem (a RootTabs só monta o navigator depois do modo de estoque — AP-277). */
export function useScanResume(ready: boolean) {
  useEffect(() => {
    if (!ready || Platform.OS !== 'ios' || handledThisProcess) return
    handledThisProcess = true
    resumeScanIfMarked().catch(() => {})
  }, [ready])
}
