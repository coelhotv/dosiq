// AlarmSchedulerBridge.jsx — cola o scheduler de alarmes ao app root (Spec 001/010)
//
// Spec 010: controle migrou para por-tratamento (protocols.critical_alarm).
// O toggle global (useAlarmEnabled) foi aposentado como master-switch; o scheduler
// roda sempre que há userId, e syncAlarms filtra apenas doses críticas.
// Também registra o handler de FOREGROUND do Notifee (o de background fica no
// index.js). Render nulo — é só orquestração.
//
// Coexiste com expo-notifications: só trata eventos das notificações do Notifee.

import { useState, useEffect, useCallback } from 'react'
import { AppState } from 'react-native'
import notifee, { EventType } from '@notifee/react-native'
import { getTodayLocal } from '@dosiq/core'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { getActiveProtocols, getUserSettings, getMedicinesData } from '@dashboard/services/dashboardService'
import { navigationRef } from '@navigation/navigationRef'
import { ROUTES } from '@navigation/routes'
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
  const [protocols, setProtocols] = useState([])
  const [tz, setTz] = useState(DEFAULT_TZ)
  const [loaded, setLoaded] = useState(false)
  const userId = user?.id ?? null
  // Spec 010: scheduler sempre ativo; syncAlarms filtra por critical_alarm por-protocolo.
  const hasCriticalProtocol = protocols.some((p) => p.critical_alarm === true)

  // userId = null → sem dados para carregar, mas scheduler deve rodar (cancela alarmes).
  // userId muda → reset loaded até load() completar, evitando cancelAll prematuro.
  useEffect(() => {
    if (!userId) {
      setLoaded(true)
    } else {
      setLoaded(false)
    }
  }, [userId])

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
    if (!userId) return
    try {
      const settings = await getUserSettings(userId)
      const userTz = settings?.timezone || DEFAULT_TZ
      // YYYY-MM-DD no fuso do usuário via helper canônico do core (getTodayLocal).
      // NÃO usar toLocaleDateString({timeZone}) — no Hermes/Android o suporte a tz
      // é limitado e a opção pode ser ignorada → data errada (paridade useTodayData).
      const dateStr = getTodayLocal(userTz)
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
      setLoaded(true)
    } catch (err) {
      if (__DEV__) console.warn('[AlarmSchedulerBridge] load falhou', err?.message)
    }
  }, [userId])

  // Carrega na montagem + retorno de background (Spec 010: sem gate global de enabled).
  useEffect(() => {
    if (!userId) return
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
  }, [userId, load])

  // Re-sync sob demanda: mutação de tratamento (criar/editar/pausar/excluir)
  // altera as dose_instances → refetch + reagenda (FR-006 / insumo E).
  useEffect(() => onAlarmResync(load), [load])

  // Gate: não executa o scheduler antes do primeiro load bem-sucedido — evita
  // cancelAll prematuro enquanto protocols ainda é [] (race condition no mount).
  return loaded ? (
    <AlarmScheduler isAlarmEnabled={hasCriticalProtocol} userId={userId} protocols={protocols} tz={tz} />
  ) : null
}

function AlarmScheduler({ isAlarmEnabled, userId, protocols, tz }) {
  useAlarmScheduler({ isAlarmEnabled, userId, protocols, tz })
  return null
}
