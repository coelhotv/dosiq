// AlarmSchedulerBridge.jsx — cola o scheduler de alarmes ao app root (Spec 001)
//
// Monta-se uma vez na árvore. Quando o alarme está ligado (FR-007), carrega
// protocolos ativos + tz do usuário e alimenta useAlarmScheduler (reuso CON-024).
// Também registra o handler de FOREGROUND do Notifee (o de background fica no
// index.js). Render nulo — é só orquestração.
//
// Coexiste com expo-notifications: só trata eventos das notificações do Notifee.

import { useState, useEffect, useCallback } from 'react'
import { AppState } from 'react-native'
import notifee, { EventType } from '@notifee/react-native'
import { getRawNow } from '@dosiq/core'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { getActiveProtocols, getUserSettings, getMedicinesData } from '@dashboard/services/dashboardService'
import { navigationRef } from '@navigation/navigationRef'
import { ROUTES } from '@navigation/routes'
import { useAlarmEnabled } from './useAlarmEnabled'
import { useAlarmScheduler } from './useAlarmScheduler'
import { handleAlarmAction } from './quickDoseRegistration'
import { onAlarmResync } from './alarmResyncBus'
import { ALARM_CHANNEL_ID } from './alarmService'

const DEFAULT_TZ = 'America/Sao_Paulo'

// Navega ao takeover de tela cheia quando uma notificação do canal de alarme
// abre/está ativa no app (FR-002). Idempotente: não re-navega se já está lá.
function isAlarmNotification(notification) {
  if (!notification) return false
  // Android identifica pelo canal; iOS pela categoria (não tem `android`).
  return (
    notification.android?.channelId === ALARM_CHANNEL_ID ||
    notification.ios?.categoryId === ALARM_CHANNEL_ID
  )
}

function openAlarmScreen(notification) {
  if (!isAlarmNotification(notification)) return
  const data = notification.data || {}
  if (!data.doseInstanceId) return
  if (!navigationRef.isReady()) return
  if (navigationRef.getCurrentRoute?.()?.name === ROUTES.ALARM_FULLSCREEN) return
  navigationRef.navigate(ROUTES.ALARM_FULLSCREEN, {
    doseInstanceId: data.doseInstanceId,
    medicineName: data.medicineName,
    protocolId: data.protocolId,
    medicineId: data.medicineId,
    quantityTaken: data.quantityTaken,
    scheduledTime: data.scheduledTime,
    scheduledFor: data.scheduledFor,
    toleranceMinutes: data.toleranceMinutes,
    snoozeAttempt: data.snoozeAttempt,
  })
}

export default function AlarmSchedulerBridge() {
  const { user } = useAuth()
  const [enabled] = useAlarmEnabled()
  const [protocols, setProtocols] = useState([])
  const [tz, setTz] = useState(DEFAULT_TZ)
  const userId = user?.id ?? null

  // Foreground: ações dos botões da notificação + abre o takeover de tela cheia.
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(async (event) => {
      try {
        if (event.type === EventType.ACTION_PRESS) {
          await handleAlarmAction(event)
        } else if (event.type === EventType.PRESS || event.type === EventType.DELIVERED) {
          // tap no corpo OU entrega enquanto em foreground → tela cheia
          openAlarmScreen(event.detail?.notification)
        }
      } catch (err) {
        if (__DEV__) console.warn('[AlarmSchedulerBridge] foreground event falhou', err?.message)
      }
    })
    return unsub
  }, [])

  // Cold launch pela notificação (app estava morto) → abre a tela cheia.
  useEffect(() => {
    notifee
      .getInitialNotification()
      .then((initial) => openAlarmScreen(initial?.notification))
      .catch(() => {})
  }, [])

  // Refetch protocolos + tz. setState → useAlarmScheduler reagenda (deps protocols).
  const load = useCallback(async () => {
    if (!enabled || !userId) return
    try {
      const settings = await getUserSettings(userId)
      const userTz = settings?.timezone || DEFAULT_TZ
      // YYYY-MM-DD no fuso do usuário (en-CA → ISO date), sem dep extra.
      const dateStr = getRawNow().toLocaleDateString('en-CA', { timeZone: userTz })
      const protos = await getActiveProtocols(userId, dateStr)
      // Enriquecer com o medicine aninhado — buildDoseItemsFromInstances lê
      // protocol.medicine.name (senão "Desconhecido"). getActiveProtocols traz
      // só medicine_id; junta via getMedicinesData (mesmo padrão do dashboard).
      const list = Array.isArray(protos) ? protos : []
      const medIds = [...new Set(list.map((p) => p.medicine_id).filter(Boolean))]
      const medsById = medIds.length ? await getMedicinesData(medIds) : {}
      const enriched = list.map((p) => ({ ...p, medicine: medsById[p.medicine_id] || null }))
      setTz(userTz)
      setProtocols(enriched)
    } catch (err) {
      if (__DEV__) console.warn('[AlarmSchedulerBridge] load falhou', err?.message)
    }
  }, [enabled, userId])

  // Carrega quando ligado (mount + retorno de background).
  // Desligado → não carrega; useAlarmScheduler cancela via isAlarmEnabled=false.
  useEffect(() => {
    if (!enabled || !userId) return
    // load é async — setState ocorre pós-await (não síncrono); fetch de mount legítimo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      load()
      // App veio a foreground (inclui launch pelo full-screen intent c/ app
      // minimizado): se há alarme ativo no canal, abre o takeover de tela cheia.
      notifee
        .getDisplayedNotifications()
        .then((list) => {
          const alarm = list.find((n) => isAlarmNotification(n.notification))
          openAlarmScreen(alarm?.notification)
        })
        .catch(() => {})
    })
    return () => sub.remove()
  }, [enabled, userId, load])

  // Re-sync sob demanda: mutação de tratamento (criar/editar/pausar/excluir)
  // altera as dose_instances → refetch + reagenda (FR-006 / insumo E).
  useEffect(() => onAlarmResync(load), [load])

  useAlarmScheduler({ isAlarmEnabled: enabled, userId, protocols, tz })
  return null
}
