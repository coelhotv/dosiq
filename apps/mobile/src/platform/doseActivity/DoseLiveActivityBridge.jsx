// DoseLiveActivityBridge.jsx — Spec 039 / F3 (iOS Live Activity)
//
// Contraparte iOS do DoseActivityBridge (Android). Deriva a ÚNICA dose ativa entre as críticas
// pendentes (selectActiveDoseActivity / CON-029) e dirige a Live Activity (start/update/end via
// liveActivityService). iOS-only: render nulo e no-op fora do iOS.
//
// Diferença de plataforma vs Android: o iOS NÃO executa JS em background (sem equivalente ao trigger
// Notifee/reconcileDoseActivityFromAlarm). O timer da LA é VIVO (Text(timerInterval:) conta sozinho,
// server-free). As transições de ESTADO discreto (cor/label/botões) acontecem por:
//  (a) re-derive via update() no mount/foreground/resync — o alarme crítico T0 (fullscreen) traz o
//      app ao foreground, cobrindo later→upcoming→now;
//  (b) `staleDate` (= próximo boundary, liveActivityService) → quando passa, o sistema re-renderiza
//      a LA em background e o widget RECALCULA o estado de scheduledAt+now (cobre now→late server-free).
// Limitação: só UM hop por update em background profundo. Multi-hop sem o app abrir exigiria
// ActivityKit push/APNs — FORA do escopo server-free da 039 (FR-009); seria uma spec futura separada.
//
// Ações da ilha (App Intent Registrar/Adiar) chegam pela fila do App Group: drenamos no foreground
// e processamos com SESSÃO VIVA (PO-SEC-2) — "Registrar" abre a modal bulk (sítio do injetável),
// "Adiar" reagenda o alarme.

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import {
  createDoseInstanceRepository,
  buildDoseItemsFromInstances,
  selectActiveDoseActivity,
  getRawNow,
  addDays,
  getTodayLocal,
  createCriticalAuditService,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'

// Auditoria (042 Slice B): token_captured emitido no foreground (online) — NUNCA grava o token no
// detail (SEC-3), só marca que a captura ocorreu. Fail-open: emit nunca lança.
const tokenAudit = createCriticalAuditService({
  client: supabase,
  getUserId: async () => {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  },
})
import { useAuth } from '@platform/auth/hooks/useAuth'
import { getActiveProtocols, getUserSettings, getMedicinesData } from '@dashboard/services/dashboardService'
import { onAlarmResync } from '@platform/alarms/alarmResyncBus'
import { onDoseActivityRefresh } from './doseActivityRefreshBus'
import { navigationRef } from '@navigation/navigationRef'
import { ROUTES } from '@navigation/routes'
import { scheduleSnooze } from '@platform/alarms/alarmService'
import {
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  showDoneLiveActivity,
  drainPendingActions,
  getPushToStartToken,
  getActivityPushToken,
  liveActivitySupported,
} from './liveActivityService'
import { syncNotificationDevice } from '@platform/notifications/syncNotificationDevice'

// Dedupe do token_captured: _syncActivityToken roda a cada foreground/derive e quase sempre re-lê o
// MESMO token → sem isto o trail enche de token_captured idênticos (rajada observada: 4× em 40s).
// Emite só quando o token MUDA de fato (nova Activity / rotação). In-memory (sem storage/bloat);
// no restart re-emite no máx 1×/dose/sessão. Não guarda o valor do token no trail (SEC-3).
const lastSyncedToken = new Map()

const DEFAULT_TZ = 'America/Sao_Paulo'
const LOOK_AHEAD_DAYS = 3
const LOOK_BACK_DAYS = 3
const RESYNC_INTERVAL_MS = 15 * 60 * 1000

/**
 * Spec 041 fix-up — sincroniza o token push per-Activity da LA ativa em dose_instances.la_push_token,
 * p/ o backend empurrar update/end com app fechado. Best-effort; token vazio (SO ainda não emitiu /
 * iOS < 17.2) → no-op, tenta de novo no próximo derive. RLS escopa ao dono (auth.uid()=user_id). @private
 */
async function _syncActivityToken(instanceId) {
  if (!instanceId) return
  // O token per-Activity é emitido de forma ASSÍNCRONA pelo iOS após Activity.request — logo após o
  // start quase sempre ainda está vazio. Retry curto com backoff linear aguarda a emissão; se falhar,
  // o próximo derive (foreground/interval) tenta de novo. Best-effort: nunca derruba o derive.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const token = await getActivityPushToken(instanceId)
      if (token) {
        await supabase.from('dose_instances').update({ la_push_token: token }).eq('id', instanceId)
        // token_captured só quando o token muda (dedupe da rajada de re-sync). Marca a captura SEM
        // gravar o valor do token (SEC-3).
        if (lastSyncedToken.get(instanceId) !== token) {
          lastSyncedToken.set(instanceId, token)
          await tokenAudit.emit({
            doseInstanceId: instanceId,
            event: 'token_captured',
            platform: 'ios',
            actor: 'system',
          })
        }
        return
      }
    } catch {
      // best-effort
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
  }
}

/** Limpa o token per-Activity ao encerrar localmente a LA (paridade com o end-push do backend). @private */
async function _clearActivityToken(instanceId) {
  if (!instanceId) return
  try {
    await supabase.from('dose_instances').update({ la_push_token: null, la_push_state: null }).eq('id', instanceId)
  } catch {
    // best-effort
  }
}

/** Deriva a dose ativa (crítica pendente) e start/update/end a LA. Retorna o instanceId ativo. @private */
async function deriveAndDrive({ userId, protocols, tz, prevInstanceId }) {
  const repo = createDoseInstanceRepository({ client: supabase })
  const now = getRawNow()
  const instances = await repo.getWindow(userId, addDays(now, -LOOK_BACK_DAYS), addDays(now, LOOK_AHEAD_DAYS))
  const allItems = buildDoseItemsFromInstances(instances, protocols, tz)
  const items = allItems.filter((it) => it.status === 'pending' && it.critical)
  const active = selectActiveDoseActivity(items, now)

  // A dose que mostrávamos virou `taken`? → card `done` (~3min) em vez de só encerrar. Retorna o
  // HORÁRIO REAL da tomada (registeredAt), NÃO `now` — senão o card mostra a hora do re-derive
  // (ex.: reabertura do app), não quando o paciente tomou. Fallback `now` se o campo faltar.
  const prevTakenAt = (id) => {
    const prev = allItems.find((it) => it.instanceId === id)
    if (!prev) return null
    if (prev.status === 'taken' || prev.isRegistered === true) return prev.registeredAt || now
    return null
  }

  if (!active) {
    if (prevInstanceId) {
      const takenAt = prevTakenAt(prevInstanceId)
      if (takenAt) await showDoneLiveActivity({ instanceId: prevInstanceId, takenAt })
      else await endLiveActivity()
      await _clearActivityToken(prevInstanceId) // LA encerrada → token não serve mais
    }
    return null
  }
  const doseItem = items.find((it) => it.instanceId === active.instanceId) || null
  if (prevInstanceId === active.instanceId) {
    await updateLiveActivity(active, doseItem) // mesma dose → transição de estado sem recriar
  } else {
    // Trocou de dose: se a anterior foi tomada, confirma; senão encerra. Depois inicia a nova.
    if (prevInstanceId) {
      const takenAt = prevTakenAt(prevInstanceId)
      if (takenAt) await showDoneLiveActivity({ instanceId: prevInstanceId, takenAt })
      else await endLiveActivity()
      await _clearActivityToken(prevInstanceId)
    }
    await startLiveActivity(active, doseItem)
  }
  // Fase 2: sincroniza o token per-Activity da LA ativa (idempotente; backend usa p/ update/end).
  await _syncActivityToken(active.instanceId)
  return active.instanceId
}

/**
 * Spec 041 — registra o token push-to-start (iOS 17.2+) no backend p/ a LA iniciar com o app
 * fechado (ADR-076). Best-effort: token vazio (SO ainda não emitiu / iOS < 17.2) → no-op.
 * Sessão VIVA (PO-SEC-2): o RPC usa auth.uid() internamente — o token fica escopado ao dono. @private
 */
// Cache do último par (userId,token) registrado com sucesso — evita upsert redundante no Supabase
// a cada foreground/mount quando nada mudou. Escopado por usuário (login diferente re-registra).
let lastRegistered = { userId: null, token: null }

async function registerPushToStart(userId) {
  if (!userId) return
  try {
    const token = await getPushToStartToken()
    if (!token) return
    if (userId === lastRegistered.userId && token === lastRegistered.token) return
    await syncNotificationDevice({ supabase, userId, token, provider: 'apns_liveactivity' })
    lastRegistered = { userId, token }
  } catch (err) {
    if (__DEV__) console.warn('[DoseLiveActivityBridge] registro push-to-start falhou', err?.message)
  }
}

/** PO-SEC-2: confirma sessão VIVA antes de agir sobre uma ação da ilha. @private */
async function liveUserId() {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

/** Protocolos ativos enriquecidos com o medicamento (compartilhado por load() e pela ação). @private */
async function fetchEnrichedProtocols(userId, tz) {
  const protos = await getActiveProtocols(userId, getTodayLocal(tz))
  const list = Array.isArray(protos) ? protos : []
  const medIds = [...new Set(list.map((p) => p.medicine_id).filter(Boolean))]
  const medsById = medIds.length ? await getMedicinesData(medIds) : {}
  return list.map((p) => ({ ...p, medicine: medsById[p.medicine_id] || null }))
}

/** Resolve o doseItem (CON-029) de um instanceId p/ montar o deeplink da modal. @private */
async function resolveDoseItem(userId, protocols, tz, instanceId) {
  const repo = createDoseInstanceRepository({ client: supabase })
  const now = getRawNow()
  const instances = await repo.getWindow(userId, addDays(now, -LOOK_BACK_DAYS), addDays(now, LOOK_AHEAD_DAYS))
  const items = buildDoseItemsFromInstances(instances, protocols, tz)
  return items.find((it) => it.instanceId === instanceId) || null
}

/**
 * Deeplink da modal bulk a partir do doseItem — MESMO shape do Android (buildRegisterDeeplink):
 * plano → 'bulk-plan' (planId + at + treatmentPlanName); avulsa → 'dose-individual' (protocolId + at).
 * TodayScreen._resolveDeeplinkModal exige planId (bulk) ou protocolId (individual) — instanceId NÃO
 * abre nada (era o bug). Fallback p/ treatmentId da fila se o doseItem não resolver. @private
 */
function buildRegisterParams(doseItem, fallbackTreatmentId) {
  const at = doseItem?.scheduledTime || ''
  const planId = doseItem?.treatmentPlanId || fallbackTreatmentId || ''
  if (planId) {
    return { screen: 'bulk-plan', planId, at, treatmentPlanName: doseItem?.treatmentPlanName || doseItem?.medicineName || '' }
  }
  if (doseItem?.protocolId) {
    return { screen: 'dose-individual', protocolId: doseItem.protocolId, at }
  }
  return null
}

/** Navega p/ Hoje com retry de isReady (cold start: container pode não ter montado — igual Android). @private */
function navigateTodayWithRetry(params) {
  const go = () => navigationRef.navigate(ROUTES.TODAY, params)
  if (navigationRef.isReady?.()) {
    go()
    return
  }
  let waited = 0
  const interval = setInterval(() => {
    waited += 100
    if (navigationRef.isReady?.()) {
      clearInterval(interval)
      go()
    } else if (waited >= 5000) {
      clearInterval(interval)
    }
  }, 100)
}

/** Processa a fila de ações do App Intent (App Group) com sessão viva. @private */
async function processPendingActions(tz) {
  const queue = await drainPendingActions()
  if (queue.length === 0) return
  const uid = await liveUserId()
  if (!uid) return // sessão não-viva → não registra em conta errada (PO-SEC-2)
  let protocols = null
  for (const item of queue) {
    if (item.action === 'register') {
      // "Registrar" abre a modal bulk (sítio do injetável só selecionável lá) — paridade Android.
      // Resolve o doseItem p/ obter protocolId/treatmentPlanId/horário (o widget só tem instanceId).
      if (!protocols) protocols = await fetchEnrichedProtocols(uid, tz).catch(() => [])
      const doseItem = await resolveDoseItem(uid, protocols, tz, item.instanceId).catch(() => null)
      const params = buildRegisterParams(doseItem, item.treatmentId)
      if (params) navigateTodayWithRetry(params)
    } else if (item.action === 'snooze') {
      // Enriquece a soneca com o doseItem (nome/horário/tolerância/criticidade) — senão a notif
      // reagendada fica genérica (sem nome do remédio). Paridade com o path de alarme do Android.
      if (!protocols) protocols = await fetchEnrichedProtocols(uid, tz).catch(() => [])
      const doseItem = await resolveDoseItem(uid, protocols, tz, item.instanceId).catch(() => null)
      // doseItem null (deletado/offline) → não agenda: passar scheduledFor undefined a um param
      // obrigatório do scheduleSnooze daria agendamento inválido. Pular é mais seguro (Gemini #692).
      if (doseItem) {
        await scheduleSnooze({
          doseInstanceId: item.instanceId,
          medicineName: doseItem.medicineName,
          scheduledFor: doseItem.scheduledFor,
          toleranceMinutes: doseItem.toleranceMinutes ?? null,
          isCritical: doseItem.critical ?? true,
          data: {
            doseInstanceId: item.instanceId,
            medicineName: doseItem.medicineName,
            scheduledFor: doseItem.scheduledFor,
          },
        })
      }
    } else if (item.action === 'open') {
      // "Abrir" (later) — só traz o app pra Hoje, sem registrar.
      navigateTodayWithRetry({})
    }
  }
}

export default function DoseLiveActivityBridge() {
  const { user } = useAuth()
  const [protocols, setProtocols] = useState([])
  const [tz, setTz] = useState(DEFAULT_TZ)
  const userId = user?.id ?? null
  const prevInstanceRef = useRef(null)
  // tz espelhado em ref p/ o effect de AppState NÃO depender de tz (senão load() atualiza tz no
  // mount → re-dispara o effect → load() duplicado p/ fuso ≠ DEFAULT_TZ). Gemini #692. Sync em effect
  // (R-010: refs no topo; não escrever ref durante render).
  const tzRef = useRef(tz)
  const enabled = Platform.OS === 'ios' && liveActivitySupported

  useEffect(() => {
    tzRef.current = tz
  }, [tz])

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const settings = await getUserSettings(userId)
      const userTz = settings?.timezone || DEFAULT_TZ
      setTz(userTz)
      setProtocols(await fetchEnrichedProtocols(userId, userTz))
    } catch (err) {
      if (__DEV__) console.warn('[DoseLiveActivityBridge] load falhou', err?.message)
    }
  }, [userId])

  const derive = useCallback(async () => {
    if (!userId) return
    try {
      prevInstanceRef.current = await deriveAndDrive({
        userId,
        protocols,
        tz,
        prevInstanceId: prevInstanceRef.current,
      })
    } catch (err) {
      if (__DEV__) console.warn('[DoseLiveActivityBridge] derive falhou', err?.message)
    }
  }, [userId, protocols, tz])

  // Logout → encerra a LA ativa.
  useEffect(() => {
    if (userId || !enabled) return
    if (prevInstanceRef.current) {
      endLiveActivity()
      prevInstanceRef.current = null
    }
  }, [userId, enabled])

  // Carrega protocolos no mount + foreground; drena ações da ilha ao voltar a foreground.
  useEffect(() => {
    if (!enabled || !userId) return undefined
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    processPendingActions(tzRef.current)
    registerPushToStart(userId) // Spec 041: registra token push-to-start no mount/foreground
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      load()
      processPendingActions(tzRef.current)
      registerPushToStart(userId)
    })
    return () => sub.remove()
  }, [enabled, userId, load])

  // Re-sync sob demanda (mutação de tratamento).
  useEffect(() => {
    if (!enabled) return undefined
    return onAlarmResync(load)
  }, [enabled, load])

  // Registro de dose (modal/in-app/alarme) → card `done` JÁ (sem esperar foreground/interval; iOS não
  // roda JS em bg e registrar in-app não muda AppState). Se a dose registrada é a que mostrávamos,
  // mostra o done com o HORÁRIO REAL da tomada (payload.takenAt — dose_instances não persiste isso;
  // o doseItem.registeredAt = scheduled_for, hora errada). Depois deriva a próxima dose ativa.
  useEffect(() => {
    if (!enabled) return undefined
    return onDoseActivityRefresh((payload) => {
      if (payload?.instanceId && payload.instanceId === prevInstanceRef.current) {
        showDoneLiveActivity({ instanceId: payload.instanceId, takenAt: payload.takenAt })
        prevInstanceRef.current = null
      }
      derive()
    })
  }, [enabled, derive])

  // Re-deriva no mount/troca + rede de segurança periódica (transição de estado via update).
  useEffect(() => {
    if (!enabled || !userId) return undefined
    derive()
    const timer = setInterval(derive, RESYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [enabled, userId, derive])

  return null
}
