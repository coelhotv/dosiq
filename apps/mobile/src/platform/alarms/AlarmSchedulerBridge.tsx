// AlarmSchedulerBridge.jsx — cola o scheduler de alarmes ao app root (Spec 001/010)
//
// Spec 010: controle migrou para por-tratamento (protocols.critical_alarm).
// O toggle global (useAlarmEnabled) foi aposentado como master-switch; o scheduler
// roda sempre que há userId, e syncAlarms filtra apenas doses críticas.
// Também registra o handler de FOREGROUND do Notifee (o de background fica no
// index.js). Render nulo — é só orquestração.
//
// Coexiste com expo-notifications: só trata eventos das notificações do Notifee.

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import notifee, { EventType, AuthorizationStatus } from '@notifee/react-native'
import {
  getTodayLocal,
  getRawNow,
  createCriticalAuditService,
  type CriticalAuditEvent,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createCriticalAuditQueue } from '@platform/audit/criticalAuditQueue'
import { deriveIosAlarmOutcome } from '@platform/audit/deriveIosAlarmOutcome'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { useConsentSuppressed } from '@platform/consent/useConsentSuppressed'
import { getActiveProtocols, getUserSettings, getMedicinesData } from '@dashboard/services/dashboardService'
import { navigationRef } from '@navigation/navigationRef'
import { ROUTES } from '@navigation/routes'
import { useAlarmScheduler } from './useAlarmScheduler'
import { handleAlarmAction } from './quickDoseRegistration'
import { onAlarmResync } from './alarmResyncBus'
import { cancelAlarm } from './alarmService'
import { SURFACE_ACTION, endDoseActivity } from '@platform/doseActivity/doseActivitySurfaceService'
import { isAlarmNotification, isDoseNotificationStale, reconcileStaleDoseNotifications } from './staleDoseNotifications'

// Auditoria de dose crítica (042 Slice B): no foreground, deriva o desfecho iOS (ENG-1 — iOS não
// roda JS no disparo) e DRENA a fila offline (Android enfileira no headless). Fail-open total.
const auditQueue = createCriticalAuditQueue()
const auditEmitter = createCriticalAuditService({ client: supabase as any })

// Dedupe dos desfechos iOS derivados no foreground: enquanto a notificação segue exibida, cada
// foreground re-derivaria o MESMO alarm_fired/nag_fired → duplicatas no trail (review #700). Guarda
// as chaves já enfileiradas (id:event:nag) em AsyncStorage; cap simples p/ não crescer sem limite.
const IOS_DERIVE_SEEN_KEY = '@dosiq/audit/ios_derive_seen'
const IOS_DERIVE_SEEN_CAP = 500

async function filterUnseenDerived(derived) {
  let seen = []
  try {
    const raw = await AsyncStorage.getItem(IOS_DERIVE_SEEN_KEY)
    seen = raw ? JSON.parse(raw) : []
  } catch {
    seen = []
  }
  const seenSet = new Set(Array.isArray(seen) ? seen : [])
  const keyOf = (e) => `${e.doseInstanceId}:${e.event}`
  const fresh = derived.filter((e) => !seenSet.has(keyOf(e)))
  if (fresh.length) {
    const merged = [...seenSet, ...fresh.map(keyOf)].slice(-IOS_DERIVE_SEEN_CAP)
    try {
      await AsyncStorage.setItem(IOS_DERIVE_SEEN_KEY, JSON.stringify(merged))
    } catch {
      /* fail-open */
    }
  }
  return fresh
}

/** Deriva desfechos iOS dos alarmes exibidos + drena a fila. Chamado no AppState 'active'. */
async function flushCriticalAudit(userId, consentSuppressed = false) {
  if (!userId) return
  try {
    // 046: consentimento revogado NÃO gera evento de auditoria novo — sintetizar 'pending' a partir de
    // alarmes exibidos seria processar dado de dose sem base legal (AP-295). A drenagem da fila abaixo
    // segue: são eventos que JÁ ocorreram (base de segurança/defesa, não consentimento) e o prune 90d /
    // exclusão de conta cuidam da retenção.
    if (Platform.OS === 'ios' && !consentSuppressed) {
      const displayed = await notifee.getDisplayedNotifications()
      const alarms = displayed
        .filter((n) => isAlarmNotification(n.notification))
        .map((n) => {
          const d = n.notification?.data || {}
          return {
            doseInstanceId: d.doseInstanceId,
            isCritical: d.isCritical === 'true',
            nagAttempt: Number(d.nagAttempt ?? 0) || 0,
            doseStatus: 'pending',
          }
        })
        .filter((a) => a.doseInstanceId)
      if (alarms.length) {
        const settings = await notifee.getNotificationSettings()
        const status = settings?.authorizationStatus
        const permissionGranted =
          status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL
        const derived = deriveIosAlarmOutcome({ alarms, permissionGranted, userId })
        // Dedupe: só enfileira desfechos ainda não vistos (evita duplicata a cada foreground).
        const fresh = await filterUnseenDerived(derived)
        for (const evt of fresh) await auditQueue.enqueue(evt)
      }
    }
    // Drena a fila: insere cada evento via o helper único (CON-031). Item só sai após insert OK.
    await auditQueue.flush((evt) => auditEmitter.emit(evt as unknown as CriticalAuditEvent))
  } catch (err) {
    if (__DEV__) console.warn('[AlarmSchedulerBridge] flush audit falhou', err?.message)
  }
}

const DEFAULT_TZ = 'America/Sao_Paulo'

// Navega ao takeover de tela cheia quando uma notificação do canal de alarme abre/está ativa no app
// (FR-002). Idempotente: não re-navega se já está lá. (isAlarmNotification + staleness + sweep vivem
// em staleDoseNotifications.js.)
function openAlarmScreen(notification) {
  if (!isAlarmNotification(notification)) return
  const data = notification.data || {}
  if (!data.doseInstanceId) return
  // Alarme VELHO (dose fora da janela) NÃO deve promover a fullscreen — limpa e sai. Evita o takeover
  // de uma dose missed que, ao tocar "Tomei", batia em P0001 ('já registrada ou indisponível').
  if (isDoseNotificationStale(data, getRawNow())) {
    cancelAlarm(data.doseInstanceId).catch(() => {})
    endDoseActivity(data.doseInstanceId).catch(() => {})
    return
  }
  if (!navigationRef.isReady()) return
  if (navigationRef.getCurrentRoute?.()?.name === ROUTES.ALARM_FULLSCREEN) return
  navigationRef.navigate(ROUTES.ALARM_FULLSCREEN, {
    doseInstanceId: data.doseInstanceId,
    medicineName: data.medicineName,
    protocolId: data.protocolId,
    medicineId: data.medicineId,
    quantityTaken: data.quantityTaken,
    dosagePerPill: data.dosagePerPill,
    dosageUnit: data.dosageUnit,
    concentrationVolumeMl: data.concentrationVolumeMl,
    intakeUnit: data.intakeUnit,
    unitsPerMl: data.unitsPerMl,
    medicineType: data.medicineType,
    presentation: data.presentation,
    scheduledTime: data.scheduledTime,
    scheduledFor: data.scheduledFor,
    toleranceMinutes: data.toleranceMinutes,
    snoozeAttempt: data.snoozeAttempt,
    isCritical: data.isCritical,
    isGrouped: data.isGrouped,
    groupedDoses: data.groupedDoses,
    doseInstanceIds: data.doseInstanceIds,
  })
}

export default function AlarmSchedulerBridge() {
  const { user } = useAuth()
  // 046: consentimento revogado desarma os alarmes locais (lembrete de dose é tratamento de dado de
  // saúde). isAlarmEnabled=false faz o useAlarmScheduler cancelAll — sem reprogramar no reload.
  const consentSuppressed = useConsentSuppressed(user?.id ?? null)
  const [protocols, setProtocols] = useState([])
  const [tz, setTz] = useState(DEFAULT_TZ)
  // loaded: false enquanto aguarda o primeiro load() para userId corrente.
  // userId=null → nada para carregar, scheduler pode rodar (vai cancelar alarmes).
  const [loaded, setLoaded] = useState(!user?.id)
  const [prevUserId, setPrevUserId] = useState(user?.id ?? null)
  const userId = user?.id ?? null
  const coldStartHandled = useRef(false) // cold-start tratado 1x por ciclo de vida (#893)

  // Padrão de derived state: reset síncrono sem useEffect (sem render extra).
  // React executa no mesmo render e descarta o output, re-renderizando com novo estado.
  if (prevUserId !== userId) {
    setPrevUserId(userId)
    setLoaded(!userId) // novo user → false (aguarda load); logout → true (scheduler cancela)
  }

  // Spec 010: scheduler sempre ativo; syncAlarms filtra por critical_alarm por-protocolo.
  const hasCriticalProtocol = protocols.some((p) => p.critical_alarm === true)

  // Foreground: ações dos botões da notificação + abre o takeover de tela cheia.
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(async (event) => {
      try {
        if (event.type === EventType.ACTION_PRESS) {
          await handleAlarmAction(event)
        } else if (event.type === EventType.PRESS || event.type === EventType.DELIVERED) {
          // tap no corpo OU entrega enquanto em foreground → tela cheia
          openAlarmScreen(event.detail?.notification)
          // Marca-passo da superfície: alarme entregue em foreground (fullScreen trouxe a app) →
          // reconcilia a cadeia de estados da dose (paridade com o bg handler; evita a race do T0).
          if (event.type === EventType.DELIVERED) {
            const data = event.detail?.notification?.data
            if (data?.doseInstanceId && data.__surface !== 'true' && data.__surfaceEnd !== 'true') {
              const { reconcileDoseActivityFromAlarm } = require('@platform/doseActivity/doseActivityScheduler')
              await reconcileDoseActivityFromAlarm(data)
            }
          }
        }
      } catch (err) {
        if (__DEV__) console.warn('[AlarmSchedulerBridge] foreground event falhou', err?.message)
      }
    })
    return unsub
  }, [])

  // Cold launch pela notificação (app estava morto). Ação "Registrar" da superfície (canal
  // dose-activity-v1) NÃO é alarme → openAlarmScreen a ignora; precisa ir pra handleAlarmAction
  // (abre a modal bulk). Tap no corpo / alarme → tela cheia. Guard p/ rodar 1x por ciclo de vida.
  useEffect(() => {
    if (coldStartHandled.current) return
    coldStartHandled.current = true
    notifee
      .getInitialNotification()
      .then((initial) => {
        if (!initial) return
        if (initial.pressAction?.id === SURFACE_ACTION.REGISTER) {
          handleAlarmAction({ detail: initial })
        } else {
          openAlarmScreen(initial.notification)
        }
      })
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
    flushCriticalAudit(userId, consentSuppressed) // drena a fila de auditoria na montagem (foreground inicial)
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      load()
      flushCriticalAudit(userId, consentSuppressed) // 042 Slice B: deriva iOS + drena fila offline no foreground

      // App veio a foreground (inclui launch pelo full-screen intent c/ app minimizado): PRIMEIRO
      // varre e cancela notificações de dose já vencidas (missed) que ficaram presas na tela; SÓ
      // então promove um alarme AINDA ativo ao takeover (nunca reabre uma dose velha → P0001).
      reconcileStaleDoseNotifications()
        .then(() => notifee.getDisplayedNotifications())
        .then((list) => {
          const alarm = list.find((n) => isAlarmNotification(n.notification))
          openAlarmScreen(alarm?.notification)
        })
        .catch(() => {})
    })
    return () => sub.remove()
  }, [userId, load, consentSuppressed])

  // Re-sync sob demanda: mutação de tratamento (criar/editar/pausar/excluir)
  // altera as dose_instances → refetch + reagenda (FR-006 / insumo E).
  useEffect(() => onAlarmResync(load), [load])

  // Gate: não executa o scheduler antes do primeiro load bem-sucedido — evita
  // cancelAll prematuro enquanto protocols ainda é [] (race condition no mount).
  return loaded ? (
    <AlarmScheduler isAlarmEnabled={hasCriticalProtocol && !consentSuppressed} userId={userId} protocols={protocols} tz={tz} />
  ) : null
}

function AlarmScheduler({ isAlarmEnabled, userId, protocols, tz }) {
  useAlarmScheduler({ isAlarmEnabled, userId, protocols, tz })
  return null
}
