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
import {
  createDoseInstanceRepository,
  buildDoseItemsFromInstances,
  ensureInstancesUpTo,
  getRawNow,
  addDays,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { alarmService } from './alarmService'

const LOOK_AHEAD_DAYS = 3 // 72h (cota de alarmes exatos, Android 12+)

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

  // C: garante instâncias materializadas até o horizonte (por protocolo ativo).
  const active = (Array.isArray(protocols) ? protocols : []).filter((p) => p?.active !== false)
  for (const protocol of active) {
    try {
      await ensureInstancesUpTo({ protocol, doseInstanceRepo: repo, ts: end, tz })
    } catch (err) {
      if (__DEV__) console.warn('[useAlarmScheduler] ensureInstancesUpTo falhou', protocol?.id, err?.message)
    }
  }

  const instances = await repo.getWindow(userId, now, end)
  const items = buildDoseItemsFromInstances(instances, protocols, tz)
    .filter((it) => it.status === 'pending')

  await alarmService.cancelAll()
  for (const it of items) {
    await alarmService.scheduleAlarm({
      doseInstanceId: it.instanceId,
      medicineName: it.medicineName,
      scheduledFor: it.scheduledFor, // F: instante absoluto
      toleranceMinutes: it.toleranceMinutes, // D: cutoff dinâmico
      data: {
        protocolId: it.protocolId,
        medicineId: it.medicineId,
        quantityTaken: String(it.dosagePerIntake ?? 1),
      },
    })
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
        await syncAlarms({ userId, protocols, tz })
      } catch (err) {
        if (__DEV__) console.warn('[useAlarmScheduler] sync falhou', err?.message)
      }
    }

    run()
    return () => {
      cancelled = true
      void cancelled
    }
  }, [isAlarmEnabled, userId, protocols, tz])
}
