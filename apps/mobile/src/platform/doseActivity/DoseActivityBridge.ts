// DoseActivityBridge.jsx — cola a superfície de estado contínuo ao app root (Spec 039 / F2)
//
// A superfície é EXTENSÃO do alarme crítico (decisão PO): NÃO tem toggle próprio. Se o paciente
// ativou "alerta crítico" para um tratamento (protocols.critical_alarm), ele ganha a visibilidade
// contínua dos estados das doses desse tratamento — o opt-in é o do alarme crítico (por-tratamento).
// Escopo MVP (CL-4): cobre exatamente as doses críticas (que já têm trigger local p/ wake-up).
//
// Responsabilidade: derivar a ÚNICA dose ativa (selectActiveDoseActivity / CON-029) entre as doses
// críticas pendentes e exibir/encerrar a ongoing notification. Re-deriva no boundary via:
//  - mount / troca de userId
//  - foreground (AppState 'active')
//  - bus de re-sync de tratamento (onAlarmResync — mutação altera dose_instances)
//  - intervalo leve enquanto montado (rola estados upcoming→now→late com o app vivo; o
//    Chronometer da notif já corre sozinho na lock screen, CL-1)
//
// Render nulo — é só orquestração. Coexiste com AlarmSchedulerBridge (alarme invasivo) sem
// tocar nos canais de alarme.

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState } from 'react-native'
import notifee, { EventType } from '@notifee/react-native'
import {
  createDoseInstanceRepository,
  buildDoseItemsFromInstances,
  selectActiveDoseActivity,
  getRawNow,
  addDays,
  getTodayLocal,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { useConsentSuppressed } from '@platform/consent/useConsentSuppressed'
import { getActiveProtocols, getUserSettings, getMedicinesData } from '@dashboard/services/dashboardService'
import { onAlarmResync } from '@platform/alarms/alarmResyncBus'
import { endDoseActivity } from './doseActivitySurfaceService'
import { armDoseActivity, advanceDoseActivity } from './doseActivityScheduler'

const DEFAULT_TZ = 'America/Sao_Paulo'
const LOOK_AHEAD_DAYS = 3 // 72h — alinhado ao scheduler de alarmes
// getWindow filtra `scheduled_for >= from` (gte). Sem lookback, doses atrasadas (passado) e
// 'now' já vencidas ficam FORA da janela → estados late/now nunca derivam. Buscar para trás cobre
// late/missed; doses missed (> tolerância) são podadas por selectActiveDoseActivity (não-actionáveis),
// então o lookback generoso é seguro. (Doses semanais/GLP-1 podem atrasar 3+ dias → ±3d.)
const LOOK_BACK_DAYS = 3
// Re-sync de segurança enquanto o app está vivo (re-arma a cadeia caso um boundary tenha sido
// perdido em background/Doze). As transições NÃO dependem dele — são dirigidas por trigger nativo.
// 60s re-exibia/re-agendava à toa (flicker + CPU); 15min basta como fallback (mount/foreground/bus
// já re-sincronizam) (#910).
const RESYNC_INTERVAL_MS = 15 * 60 * 1000

/**
 * Deriva a dose ativa entre as CRÍTICAS pendentes e (re)arma a cadeia de boundaries (trigger-driven).
 * Best-effort — nunca lança. Retorna o instanceId armado (ou null).
 * @param {{ userId: string, protocols: Array, tz: string, prevInstanceId: string|null }} ctx
 * @returns {Promise<string|null>}
 */
async function deriveAndRender({ userId, protocols, tz, prevInstanceId }) {
  if (!userId) {
    if (prevInstanceId) await endDoseActivity(prevInstanceId)
    return null
  }
  const repo = createDoseInstanceRepository({ client: supabase as any })
  const now = getRawNow()
  const instances = await repo.getWindow(userId, addDays(now, -LOOK_BACK_DAYS), addDays(now, LOOK_AHEAD_DAYS))
  // Apenas doses críticas pendentes — a superfície é extensão do alarme crítico (CL-4).
  const items = buildDoseItemsFromInstances(instances, protocols, tz).filter(
    (it) => it.status === 'pending' && it.critical
  )

  const active = selectActiveDoseActivity(items, now)
  // Mudou a dose ativa (ou sumiu) → encerra a superfície anterior (+ trigger pendente) antes da nova.
  if (prevInstanceId && (!active || active.instanceId !== prevInstanceId)) {
    await endDoseActivity(prevInstanceId)
  }
  if (!active) return null

  const doseItem = items.find((it) => it.instanceId === active.instanceId) || null
  // PO-SEC-1: dose crítica = modo discreto por padrão (oculta nome na lock screen).
  // Arma a cadeia: exibe o estado atual + agenda o próximo boundary (trigger nativo encadeia daí).
  await armDoseActivity(active, doseItem, { now, discreet: active.isCritical })
  return active.instanceId
}

export default function DoseActivityBridge() {
  const { user } = useAuth()
  const [protocols, setProtocols] = useState([])
  const [tz, setTz] = useState(DEFAULT_TZ)
  // 046: consentimento revogado equivale a "sem usuário" para a superfície — dispara o mesmo teardown
  // do logout (encerra a ongoing notification) e trava load/derive. Re-consentir religa o userId.
  const consentSuppressed = useConsentSuppressed(user?.id ?? null)
  const userId = consentSuppressed ? null : (user?.id ?? null)
  const prevInstanceRef = useRef(null)

  // Refetch protocolos + tz (mesmo enriquecimento do AlarmSchedulerBridge: medicine aninhado).
  const load = useCallback(async () => {
    if (!userId) return
    try {
      const settings = await getUserSettings(userId)
      const userTz = settings?.timezone || DEFAULT_TZ
      const protos = await getActiveProtocols(userId, getTodayLocal(userTz))
      const list = Array.isArray(protos) ? protos : []
      const medIds = [...new Set(list.map((p) => p.medicine_id).filter(Boolean))]
      const medsById = medIds.length ? await getMedicinesData(medIds) : {}
      setTz(userTz)
      setProtocols(list.map((p) => ({ ...p, medicine: medsById[p.medicine_id] || null })))
    } catch (err) {
      if (__DEV__) console.warn('[DoseActivityBridge] load falhou', err?.message)
    }
  }, [userId])

  // (Re)arma a cadeia de boundaries da dose ativa (best-effort). Atualiza o id armado.
  const derive = useCallback(async () => {
    try {
      prevInstanceRef.current = await deriveAndRender({
        userId,
        protocols,
        tz,
        prevInstanceId: prevInstanceRef.current,
      })
    } catch (err) {
      if (__DEV__) console.warn('[DoseActivityBridge] derive falhou', err?.message)
    }
  }, [userId, protocols, tz])

  // Encadeamento em FOREGROUND: quando um boundary da superfície é entregue com o app aberto, agenda
  // o próximo (espelha o handler de background — sem isso a cadeia travaria com app em foreground).
  useEffect(() => {
    if (!userId) return undefined
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.DELIVERED) return
      const data = detail?.notification?.data
      if (data?.__surface === 'true') advanceDoseActivity(data)
      else if (data?.__surfaceEnd === 'true') endDoseActivity(data.doseInstanceId)
    })
  }, [userId])

  // Logout → encerra a superfície ativa (notif + trigger pendente).
  useEffect(() => {
    if (userId) return
    if (prevInstanceRef.current) {
      endDoseActivity(prevInstanceRef.current)
      prevInstanceRef.current = null
    }
  }, [userId])

  // Carrega protocolos na montagem e no retorno de foreground.
  useEffect(() => {
    if (!userId) return undefined
    // load é async — setState ocorre pós-await (não síncrono); fetch de mount legítimo
    // (mesmo padrão do AlarmSchedulerBridge).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load()
    })
    return () => sub.remove()
  }, [userId, load])

  // Re-sync sob demanda (mutação de tratamento altera dose_instances).
  useEffect(() => onAlarmResync(load), [load])

  // Re-arma no mount/troca de conjunto + re-sync de segurança periódico (caso um boundary tenha sido
  // perdido em background). As transições são dirigidas por trigger nativo — o intervalo é só rede.
  useEffect(() => {
    if (!userId) return undefined
    derive()
    const timer = setInterval(derive, RESYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [userId, derive])

  return null
}
