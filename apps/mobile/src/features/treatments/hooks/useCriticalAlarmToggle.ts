// useCriticalAlarmToggle — ponto de intenção do alarme crítico (R-239) · spec 054 FR-008b / C-12.
//
// iOS: a decisão depende do estado de Critical Alerts, não só do push. Medido em device:
//   - S5: com push NOT_DETERMINED um pedido só mostra 2 diálogos (push, depois crítico);
//   - S4: com push já decidido, só o diálogo do crítico;
//   - S6: o crítico TOCA com o push negado — por isso push negado não bloqueia mais o toggle.
// O sheet explicativo vem ANTES de qualquer diálogo do SO (o iOS não pergunta duas vezes).
// Android: fluxo de antes, intacto (FR-008).

import { useCallback, useState } from 'react'
import { Alert, Linking, Platform } from 'react-native'
import { enablePushAtIntent, getPushPermissionStatus } from '@platform/notifications/pushPermission'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { getCriticalAlertSetting, requestCriticalAlertPermission } from '@platform/alarms/alarmService'
import { triggerAlarmResync } from '@platform/alarms/alarmResyncBus'

interface Params {
  /** Grava o valor no form (`critical_alarm`). */
  setCritical: (value: boolean) => void
  /** Android: guia de acesso a tela cheia depois de ligar (Android 14+/Xiaomi). */
  onEnabledAndroid?: () => void
}

function showBlockedAlert() {
  Alert.alert(
    'Permissão necessária',
    'Para ativar o alarme crítico, permita notificações nas Configurações do sistema.',
    [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Abrir Configurações', onPress: () => Linking.openSettings() },
    ]
  )
}

/** Fluxo de antes: o alarme depende da permissão de notificação. */
async function enableWithPush() {
  const { granted, blocked } = await enablePushAtIntent({ supabase })
  if (!granted && blocked) showBlockedAlert()
  return granted
}

/** Registra o token sem bloquear: com o crítico concedido o alarme toca mesmo sem push (S6). */
function registerPushBestEffort() {
  enablePushAtIntent({ supabase }).catch(() => {})
}

export function useCriticalAlarmToggle({ setCritical, onEnabledAndroid }: Params) {
  const [primerVisible, setPrimerVisible] = useState(false)
  const [pushDenied, setPushDenied] = useState(false)

  // Sheet ANTES do diálogo do SO — também a partir da faixa de estado ("ainda não permitido").
  const openPrimer = useCallback(async () => {
    const push = await getPushPermissionStatus().catch(() => null)
    setPushDenied(push?.status === 'denied')
    setPrimerVisible(true)
  }, [])

  const onToggle = useCallback(
    async (next: boolean) => {
      if (!next) {
        setCritical(false)
        return
      }
      if (Platform.OS !== 'ios') {
        if (!(await enableWithPush())) return
        onEnabledAndroid?.()
        setCritical(true)
        return
      }
      const setting = await getCriticalAlertSetting()
      if (setting === 'undetermined') {
        await openPrimer()
        return
      }
      if (setting === 'authorized') {
        registerPushBestEffort()
        setCritical(true)
        return
      }
      // Crítico negado (ou indisponível): liga em modo normal, sem prompt (PO-3).
      if (await enableWithPush()) setCritical(true)
    },
    [setCritical, onEnabledAndroid, openPrimer]
  )

  const onPrimerContinue = useCallback(async () => {
    setPrimerVisible(false)
    const granted = await requestCriticalAlertPermission()
    if (granted) {
      registerPushBestEffort()
      // Doses críticas já agendadas sobem para o modo crítico sem esperar salvar o form.
      triggerAlarmResync()
      setCritical(true)
      return
    }
    if (await enableWithPush()) setCritical(true)
  }, [setCritical])

  const onPrimerDismiss = useCallback(() => setPrimerVisible(false), [])

  return { onToggle, requestCritical: openPrimer, primerVisible, pushDenied, onPrimerContinue, onPrimerDismiss }
}
