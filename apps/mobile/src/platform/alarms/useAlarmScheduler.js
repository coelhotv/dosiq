// useAlarmScheduler.js — sincroniza os alarmes locais com dose_instances (Spec 001)
//
// Reuso da malha de @dosiq/core (R-231; precedente: _useTodayDerived.js):
//  - C: ensureInstancesUpTo(now+72h) por protocolo ativo → fecha gap de geração
//       (sem isso, buraco no high-water-mark = sem alarme).
//  - repo.getWindow(userId, from, to) → ocorrências na janela.
//  - B: buildDoseItemsFromInstances(instances, protocols, tz) (CON-024) → DoseItem[]
//       com instanceId/scheduledFor(absoluto)/toleranceMinutes/medicineName, sem
//       inventar read raw nem coluna medicine_name.
//  - F: scheduledFor é instante absoluto → alarmService agenda direto, sem tz.
//  - G: filtramos status==='pending' (getWindow exclui nada; pausados já são
//       skipped_paused e não passam no filtro).
//
// OFF (FR-007 default) → cancelAll e não agenda. O re-sync também é chamado
// imperativamente após mutação de protocolo (FR-006 / insumo E).

import { useEffect } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createDoseInstanceRepository,
  createCriticalAuditService,
  buildDoseItemsFromInstances,
  ensureInstancesUpTo,
  getRawNow,
  addDays,
  parseISO,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { alarmService } from './alarmService'

const LOOK_AHEAD_DAYS = 3 // 72h (cota de alarmes exatos, Android 12+)
const LOOK_BACK_DAYS = 1 // inclui doses recém-vencidas (cobre soneca de dose no T0/late)

// Auditoria de dose crítica (spec 042): dedupe do `alarm_scheduled`. syncAlarms roda a
// cada mudança de estado (cancelAll + re-agenda) → sem dedupe emitiria o mesmo scheduled
// dezenas de vezes (risco MEDIUM do analysis). Persistimos o conjunto de instanceIds já
// emitidos; a interseção com a janela atual poda ids não mais agendados (drop → re-emite
// só se a dose voltar a ser agendada, o que é um scheduling genuinamente novo).
const SCHEDULED_AUDIT_KEY = '@dosiq/audit/alarm_scheduled_ids'

async function emitScheduledDedupe(criticalIds, userId) {
  if (!userId || criticalIds.length === 0) {
    // Sem doses críticas agendadas: zera o set (próxima dose re-emite).
    try {
      await AsyncStorage.removeItem(SCHEDULED_AUDIT_KEY)
    } catch {
      /* fail-open: dedupe é best-effort */
    }
    return
  }
  let prev = []
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_AUDIT_KEY)
    prev = raw ? JSON.parse(raw) : []
  } catch {
    prev = []
  }
  const prevSet = new Set(Array.isArray(prev) ? prev : [])
  const audit = createCriticalAuditService({ client: supabase })
  const toEmit = criticalIds.filter((id) => !prevSet.has(id))
  // Emits independentes e fail-open → paralelos (evita latência serial no resync).
  await Promise.all(
    toEmit.map((id) =>
      audit.emit({
        userId,
        doseInstanceId: id,
        event: 'alarm_scheduled',
        platform: Platform.OS,
        actor: 'system',
      }),
    ),
  )
  // Persiste só os ids da janela atual (poda os que saíram).
  try {
    await AsyncStorage.setItem(SCHEDULED_AUDIT_KEY, JSON.stringify(criticalIds))
  } catch {
    /* fail-open */
  }
}

// Campos do `data` da notificação (single): tudo string (contrato Notifee). Inclui os
// campos clínicos (036) p/ a tela cheia exibir concentração/dose/ícone contextual.
function buildSingleAlarmData(it) {
  return {
    protocolId: it.protocolId,
    medicineId: it.medicineId,
    quantityTaken: String(it.dosagePerIntake ?? 1),
    scheduledTime: it.scheduledTime || '',
    dosagePerPill: it.dosagePerPill != null ? String(it.dosagePerPill) : '',
    dosageUnit: it.dosageUnit || '',
    concentrationVolumeMl: it.concentrationVolumeMl != null ? String(it.concentrationVolumeMl) : '',
    intakeUnit: it.intakeUnit || '',
    unitsPerMl: it.unitsPerMl != null ? String(it.unitsPerMl) : '',
    medicineType: it.medicineType || '',
    presentation: it.presentation || '',
    // Auditoria (042 Slice B): o beacon no DELIVERED lê isCritical do data p/ filtrar só dose crítica.
    isCritical: String(it.critical === true),
  }
}

// Entrada de `groupedDoses` (vai serializada em JSON → mantém tipos crus).
function buildGroupedDose(it) {
  return {
    instanceId: it.instanceId,
    medicineName: it.medicineName,
    protocolId: it.protocolId,
    medicineId: it.medicineId,
    dosagePerIntake: it.dosagePerIntake,
    dosagePerPill: it.dosagePerPill,
    dosageUnit: it.dosageUnit,
    concentrationVolumeMl: it.concentrationVolumeMl,
    intakeUnit: it.intakeUnit,
    unitsPerMl: it.unitsPerMl,
    treatmentPlanName: it.treatmentPlanName,
    scheduledTime: it.scheduledTime,
    toleranceMinutes: it.toleranceMinutes,
  }
}

/**
 * Reconstrói o conjunto de alarmes para os próximos 72h. Idempotente (cancelAll +
 * re-agenda; ids === doseInstanceId). Best-effort — nunca lança.
 * @param {{ userId: string, protocols: Array, tz: string }} ctx
 */
export async function syncAlarms({ userId, protocols, tz }) {
  if (!userId) return
  const repo = createDoseInstanceRepository({ client: supabase })
  const now = getRawNow() // instante absoluto (UTC real), sem date-string parse
  const end = addDays(now, LOOK_AHEAD_DAYS)
  // Lookback: inclui doses recém-vencidas (scheduled_for ≤ now). Sem isto, uma dose snoozed no
  // T0/late some da janela → no resync (cancelAll mata o trigger de soneca) não há o que re-armar →
  // soneca perdida. Doses passadas NÃO-snoozed não geram alarme (guard timestamp ≤ now em scheduleAlarm).
  const from = addDays(now, -LOOK_BACK_DAYS)

  // C: garante instâncias materializadas até o horizonte (por protocolo ativo).
  const active = (Array.isArray(protocols) ? protocols : []).filter((p) => p?.active !== false)
  for (const protocol of active) {
    try {
      await ensureInstancesUpTo({ protocol, doseInstanceRepo: repo, ts: end, tz })
    } catch (err) {
      if (__DEV__) console.warn('[useAlarmScheduler] ensureInstancesUpTo falhou', protocol?.id, err?.message)
    }
  }

  const instances = await repo.getWindow(userId, from, end)
  // snoozeFireAt anexado ao item: soneca ativa (snoozed_until futuro). cancelAll abaixo mata o
  // trigger de soneca → re-armamos AQUI no snoozed_until (fireAt), senão a soneca some no resync.
  const items = buildDoseItemsFromInstances(instances, protocols, tz)
    .filter((it) => {
      if (it.status !== 'pending') return false
      if (!it.critical) return false // agenda somente alarmes críticos (Spec 010)
      return true
    })
    .map((it) => {
      if (it.snoozedUntil == null) return it
      const snoozedTs = typeof it.snoozedUntil === 'number'
        ? it.snoozedUntil
        : Date.parse(it.snoozedUntil) // ISO timestamptz → epoch (sem new Date — R-020)
      return !Number.isNaN(snoozedTs) && snoozedTs > now.getTime() ? { ...it, snoozeFireAt: snoozedTs } : it
    })

  await alarmService.cancelAll()

  // Soneca ativa → re-armada individualmente no snoozed_until (fireAt), fora do agrupamento por
  // minuto (horário deslocado). Mantém scheduledFor original p/ tolerância/labels.
  const snoozed = items.filter((it) => it.snoozeFireAt != null)
  for (const it of snoozed) {
    await alarmService.scheduleAlarm({
      doseInstanceId: it.instanceId,
      medicineName: it.medicineName,
      scheduledFor: it.scheduledFor,
      toleranceMinutes: it.toleranceMinutes,
      isCritical: it.critical,
      data: buildSingleAlarmData(it),
      fireAt: it.snoozeFireAt,
    })
  }

  // Agrupa alarmes do mesmo minuto pelo epoch timestamp absoluto (exclui os já re-armados como soneca)
  const groups = new Map()
  for (const it of items.filter((x) => x.snoozeFireAt == null)) {
    const ts = parseISO(it.scheduledFor).getTime()
    if (!groups.has(ts)) {
      groups.set(ts, [])
    }
    groups.get(ts).push(it)
  }

  for (const [ts, groupItems] of groups.entries()) {
    if (groupItems.length === 1) {
      const it = groupItems[0]
      await alarmService.scheduleAlarm({
        doseInstanceId: it.instanceId,
        medicineName: it.medicineName,
        scheduledFor: it.scheduledFor, // F: instante absoluto
        toleranceMinutes: it.toleranceMinutes, // D: cutoff dinâmico
        isCritical: it.critical,
        data: buildSingleAlarmData(it),
      })
    } else {
      // Múltiplos alarmes no mesmo minuto
      const first = groupItems[0]
      const doseInstanceIds = groupItems.map((it) => it.instanceId).join(',')
      const groupedDoses = groupItems.map(buildGroupedDose)
      const maxTolerance = Math.max(...groupItems.map((it) => it.toleranceMinutes ?? 120))

      await alarmService.scheduleAlarm({
        doseInstanceId: String(ts),
        medicineName: '', // Nome vazio sinaliza agrupamento no alarme local
        scheduledFor: first.scheduledFor,
        toleranceMinutes: maxTolerance,
        isCritical: groupItems.some((it) => it.critical),
        data: {
          isGrouped: 'true',
          doseInstanceIds,
          groupedDoses: JSON.stringify(groupedDoses),
          scheduledTime: first.scheduledTime || '',
        },
      })
    }
  }

  // Auditoria (spec 042): emite `alarm_scheduled` uma vez por ocorrência crítica agendada.
  // `items` já está filtrado a critical+pending → usamos os instanceIds reais (não o id
  // sintético do grupo). Fail-open TOTAL: auditoria jamais pode quebrar o agendamento.
  try {
    await emitScheduledDedupe(items.map((it) => it.instanceId), userId)
  } catch (err) {
    if (__DEV__) console.warn('[useAlarmScheduler] emit alarm_scheduled falhou (fail-open)', err?.message)
  }
}

/**
 * Hook: mantém os alarmes em dia enquanto ligado. Re-sincroniza quando muda o
 * estado relevante (toggle, protocolos). Para mutações pontuais de protocolo,
 * chame `syncAlarms()` imperativamente após o write (insumo E).
 * @param {{ isAlarmEnabled: boolean, userId: string, protocols: Array, tz: string }} params
 */
export function useAlarmScheduler({ isAlarmEnabled, userId, protocols, tz }) {
  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        if (!isAlarmEnabled || !userId) {
          await alarmService.cancelAll() // OFF → limpa tudo
          return
        }
        if (cancelled) return // efeito re-disparou durante o await → aborta
        await syncAlarms({ userId, protocols, tz })
      } catch (err) {
        if (__DEV__) console.warn('[useAlarmScheduler] sync falhou', err?.message)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isAlarmEnabled, userId, protocols, tz])
}
