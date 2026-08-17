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
import {
  isAlarmNotification,
  pickPromotableAlarm,
  reconcileStaleDoseNotifications,
} from './staleDoseNotifications'
import { evaluateDoseWindow } from './doseWindow'
import { reportOutOfWindowAlarm, shouldDropOnRevokedConsent } from './outOfWindowNotice'

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
    //
    // 067 A2 (FR-035 / Decisão 8): a ANOMALIA de janela é a única classe que o consentimento
    // revogado DESCARTA em vez de gravar. Ela coleta fabricante/modelo numa trilha de saúde (R-293),
    // e o fail-open da FR-008 vale para falha de rede — nunca para ausência de base legal. O
    // descarte mora AQUI, no flush, porque é onde o consentimento é legível: no headless a leitura é
    // de rede e foreground-only, e não se coloca mecanismo novo no caminho mais frágil do app
    // (precedente 065/D5). O evento fica horas no AsyncStorage e some sem virar linha.
    //
    // Os demais eventos seguem drenando pelo motivo já documentado acima (:79-82): JÁ ocorreram.
    // O cancelamento do alarme é idêntico nos dois regimes — consentimento nunca deixa a paciente
    // com um alarme errado tocando.
    await auditQueue.flush((evt) => {
      if (shouldDropOnRevokedConsent(evt, consentSuppressed)) {
        // `true` = item consumido: sai da fila sem insert (descarte, não retry infinito).
        return Promise.resolve(true)
      }
      return auditEmitter.emit(evt as unknown as CriticalAuditEvent)
    })
  } catch (err) {
    if (__DEV__) console.warn('[AlarmSchedulerBridge] flush audit falhou', err?.message)
  }
}

const DEFAULT_TZ = 'America/Sao_Paulo'


/**
 * Pergunta ao SO se existe alarme ativo na tela e, havendo, promove ao takeover (FR-002).
 *
 * Ordem importa: PRIMEIRO varre e cancela notificações de dose já vencidas (missed) presas na tela;
 * SÓ então promove — nunca reabrir uma dose velha (tocar "Tomei" nela bate em P0001).
 *
 * Chamada em DOIS momentos, e os dois são necessários:
 *  - montagem → cobre o app lançado MORTO pelo full-screen intent (não há transição `active`, e o
 *    `getInitialNotification` volta vazio porque não houve press);
 *  - `AppState 'active'` → cobre o app vivo em background cuja Activity o SO reusa (singleTask).
 *
 * Idempotente por dois motivos: `openAlarmScreen` não re-navega se a rota já é o takeover, e
 * `pickPromotableAlarm` ignora vencidas. Falha em silêncio de propósito — não descobrir que há
 * alarme na tela nunca pode derrubar o agendamento.
 */
function promoteActiveAlarm() {
  reconcileStaleDoseNotifications()
    .then(() => notifee.getDisplayedNotifications())
    .then((list) => openAlarmScreen(pickPromotableAlarm(list)))
    .catch(() => {})
}

// Navega ao takeover de tela cheia quando uma notificação do canal de alarme abre/está ativa no app
// (FR-002). Idempotente: não re-navega se já está lá. (isAlarmNotification + staleness + sweep vivem
// em staleDoseNotifications.js.)
function openAlarmScreen(notification) {
  if (!isAlarmNotification(notification)) return
  const data = notification.data || {}
  if (!data.doseInstanceId) return
  // Dose FORA DA JANELA não promove a fullscreen — limpa e sai.
  //  - atrasada (regime original): takeover de dose missed batia em P0001 ao tocar "Tomei";
  //  - adiantada (067 A2 / FR-003): takeover de um disparo torto do SO, que foi como uma dose de
  //    13:30 virou `skipped_user` às 09:47.
  // O cancelamento vem PRIMEIRO e nunca depende do resto (FR-008): a telemetria e o aviso são
  // best-effort, silenciar o alarme errado não é.
  const verdict = evaluateDoseWindow(data, getRawNow())
  if (verdict.outOfWindow) {
    cancelAlarm(data.doseInstanceId).catch(() => {})
    endDoseActivity(data.doseInstanceId).catch(() => {})
    // Trilha (US2) + aviso à paciente (FR-019/Princípio IX): nunca silencioso. Fail-open total.
    //
    // 🔴 Só o lado ADIANTADO é ANOMALIA. Esta função roda na PROMOÇÃO (foreground), não no disparo:
    // uma notificação atrasada aqui é o caso banal de "ficou na gaveta e o app abriu horas depois",
    // que a reconciliação sempre cancelou em silêncio. Reportá-la encheria a trilha de expiração
    // normal e afogaria o sinal que a US2 quer medir (disparo torto do SO), além de avisar
    // "o alarme tocou fora de hora" sobre algo que não foi disparo nenhum.
    if (verdict.direction === 'early') reportOutOfWindowAlarm({ data, ...verdict }).catch(() => {})
    return
  }
  const navigate = () => {
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
      earlyWindowMinutes: data.earlyWindowMinutes, // 067 A2: o takeover herda a janela completa
      snoozeAttempt: data.snoozeAttempt,
      isCritical: data.isCritical,
      isGrouped: data.isGrouped,
      groupedDoses: data.groupedDoses,
      doseInstanceIds: data.doseInstanceIds,
    })
  }

  if (navigationRef.isReady()) {
    navigate()
    return
  }

  // Cold start (app morto — inclusive pelo próprio Android em background prolongado, não só
  // "matar de propósito"): o NavigationContainer pode ainda não ter montado no instante exato do
  // tap. Sem retry, o toque abria o app mas NUNCA promovia a tela cheia — dose crítica avisada só
  // pela notificação, nunca pelo takeover (achado no smoke 055 do kill switch, PO-7). Mesmo padrão
  // de `usePushNotifications.ts:navigateFromPush` (100ms, desiste em ~5s).
  let waited = 0
  const interval = setInterval(() => {
    waited += 100
    if (navigationRef.isReady()) {
      clearInterval(interval)
      navigate()
    } else if (waited >= 5000) {
      clearInterval(interval)
    }
  }, 100)
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
  // dose-activity-v2) NÃO é alarme → openAlarmScreen a ignora; precisa ir pra handleAlarmAction
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
    // 🔴 TAMBÉM na montagem, não só na transição de estado. Quando o full-screen intent lança o app
    // MORTO, não há transição `active` (o app já nasce ativo) e o `getInitialNotification` volta
    // vazio — não houve press, quem abriu foi o SO. Sem esta chamada, ninguém pergunta se existe
    // alarme na tela e o app abre na última aba com o alarme tocando (medido 2026-08-02: cold start
    // `result code=0` + `WARM`, `Running "main"` 1,4s após o headless; takeover não abria).
    promoteActiveAlarm()
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      load()
      flushCriticalAudit(userId, consentSuppressed) // 042 Slice B: deriva iOS + drena fila offline no foreground
      promoteActiveAlarm()
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
