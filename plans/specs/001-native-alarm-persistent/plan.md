# Implementation Plan: Alarme Nativo Persistente (Mobile)

**Feature Directory**: `plans/specs/001-native-alarm-persistent`
**Spec**: `spec.md` · **Revised**: 2026-06-02 · **Tier**: 1
**Legacy Source**: `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md`

---

## Clarifications

- Q: Quais chaves `AsyncStorage` de fato invalidar após "Tomei"/"Pular"? → A: As chaves `@dosiq/dose-instances-snapshot` e `@dosiq/adherence-snapshot` da spec **não existem** no mobile (grep 2026-06-02 → 0 hits). Chaves reais: `today / stock / treatments / protocols / medicines / purchases / notif-log`. Conjunto canônico confirmado em C1 (T004b). Adesão vive em `treatments-snapshot`.
- Q: `dose_instances` expõe `medicine_name`? → A: Não (só `protocol_id`). Repo `@dosiq/core` faz JOIN protocols→medicines; se não houver método pronto, adicionar `listPendingForAlarms` (gate T003).
- Q: Registro de "Tomei" é update cru? → A: Não. Via canônica `registerDose(logData,{instanceId})` (Validar→Registrar→Decrementar). Update cru só no "Pular" (`status='skipped_user'`, sem log/consumo).

## Technical Context

`@notifee/react-native` para alarmes locais persistentes (Android `AlarmManager.setExactAndAllowWhileIdle` + full-screen intent + canal HIGH; iOS `UNNotificationSound` + critical alert/timeSensitive fallback). Coexiste com `expo-notifications` (push remoto).

**Paths reais verificados:**
- `apps/mobile/src/platform/supabase/nativeSupabaseClient.js` ✅
- `apps/mobile/src/features/dose/services/doseService.js` → `registerDose(logData, { instanceId })` (`:136`), `registerDoseMany` (`:230`) ✅ — fluxo completo insert→`consume_stock_fifo`→âncora→rollback.
- `apps/mobile/src/features/profile/screens/SettingsScreen.jsx` ✅
- `@dosiq/core` exporta `parseLocalDate`, `addDays`, `getTodayLocal`, `createDoseInstanceRepository` (usado em `dashboardService.js:7`) ✅
- `apps/mobile/assets/sounds/alarm_dose.wav` + `push_chime.wav` ✅
- `apps/mobile/src/platform/alarms/` → **[NEW]** (não existe ainda).
- Alias mobile (`babel.config.js`): `@utils` → `./src/utils` (**vazio** — não usar p/ datas); datas via `@dosiq/core`.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Health Data Safety | ✅ | Registro de tomada pela via canônica (`registerDose`), com consumo de estoque — sem bypass. |
| Mobile-First Reliability | ✅ | Look-ahead 72h; nag reativo; sem JS background. |
| Timezone Correctness | ✅ | `parseLocalDate`/`addDays` de `@dosiq/core`; `scheduled_for` é timestamptz absoluto. |
| Release/SQP (R-221) | ✅ | Minor mobile; bump `app.config.js`; CHANGELOG + store-note. |

---

## Target Files

| Path | Purpose | Evidence |
|------|---------|----------|
| `apps/mobile/package.json` | dep `@notifee/react-native`. | [MOD] |
| `apps/mobile/app.config.js` | plugin Notifee + permissões `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` + iOS background modes. | [MOD] |
| `apps/mobile/src/platform/alarms/alarmService.js` | canal HIGH, agendar/cancelar, nag. | [NEW] |
| `apps/mobile/src/platform/alarms/useAlarmScheduler.js` | hook look-ahead 72h sobre repo `dose_instances`. | [NEW] |
| `apps/mobile/src/platform/alarms/AlarmFullScreen.jsx` | UI lock screen (a11y idoso). | [NEW] |
| `apps/mobile/src/platform/alarms/quickDoseRegistration.js` | handler de ação → `registerDose` / skip + invalidação cache. | [NEW] |
| `apps/mobile/src/platform/alarms/alarmPermission.js` | prompt de permissão em ponto de intenção. | [NEW] |
| `apps/mobile/src/features/profile/screens/SettingsScreen.jsx` | toggle on/off. | [MOD] |
| `apps/mobile/src/platform/alarms/__tests__/{alarmService,quickDoseRegistration}.test.js` | unit. | [NEW] |

---

## Architectural Approach

### 1. Expo Go Decommission
Notifee tem código nativo Java/Obj-C → **Expo Go falha**. Testar só via `rtk expo run:android` / `rtk expo run:ios`. Config Plugin no `app.config.js` injeta permissões + background modes.

### 2. Bypass DND/Doze
- Canal Android: `importance: AndroidImportance.HIGH`, `bypassDnd: true`, `sound: 'alarm_dose'`.
- Trigger: `TriggerType.TIMESTAMP` + `alarmManager: { allowWhileIdle: true }`.
- iOS: `interruptionLevel: 'timeSensitive'` (fallback até critical alert entitlement).

### 3. `alarmService.js`
Canal HIGH + `scheduleAlarm({ doseInstanceId, medicineName, scheduledFor, toleranceMinutes, nagAttempt })` via `notifee.createTriggerNotification` (full-screen action + actions "Tomei"/"Pular"), `cancelAlarm`, `scheduleNag` (máx 3), `cancelAll`.
- **F**: `scheduledFor` é instante absoluto (timestamptz) → `TriggerType.TIMESTAMP` usa o instante direto, **sem conversão tz** no agendamento. HH:MM exibido no full-screen deriva no tz do perfil (R-254).
- **D**: `toleranceMinutes` (dinâmico por instância, §5 do DOSE_INSTANCES.md) é o cutoff de expiração/nag — não usar 120 fixo; espelha o sweep `markMissedDueInstances`.
- **A (idempotência cross-restart)**: `notificationId = doseInstanceId` torna o agendamento idempotente na notifee (re-sync re-cria a mesma id). Avaliar em C1 se vale também marcar `dose_instances.notified_at` via repo após o disparo (idempotência server-side já prevista no schema, §3); `snoozed_until` é o campo canônico do nag/snooze.

### 4. `useAlarmScheduler.js` (hook) — REUSO CON-024 (insumo B/C/F)

Não inventar read raw. Reusar a malha já existente de `@dosiq/core` (precedente: mobile
`_useTodayDerived.js`, §9 do DOSE_INSTANCES.md):
- `repo.getWindow({ userId, fromTs, toTs })` → instâncias `pending` (já exclui `skipped_paused`/pausados — insumo G).
- `ensureInstancesUpTo(now+72h)` ANTES de ler — gera gap se HWM não cobre (insumo C; senão buraco de geração = sem alarme).
- `buildDoseItemsFromInstances(instances, protocols, tz)` (CON-024) → `DoseItem[]` com `instanceId`, `scheduledFor` (instante absoluto), `toleranceMinutes` (dinâmico §5) e HH:MM local. `medicine_name` vem do lookup `protocols`, **não** de coluna nem de método novo no repo (insumo B).

```javascript
import { useEffect } from 'react'
import {
  createDoseInstanceRepository,
  buildDoseItemsFromInstances,
  ensureInstancesUpTo,
} from '@dosiq/core'
import { alarmService } from './alarmService'

const LOOK_AHEAD_MS = 72 * 60 * 60 * 1000 // 72h

export function useAlarmScheduler({ isAlarmEnabled, userId, protocols, tz }) {
  useEffect(() => {
    if (!isAlarmEnabled || !userId) return
    let cancelled = false

    async function sync() {
      const repo = createDoseInstanceRepository({ client: nativeSupabaseClient })
      const now = Date.now()
      const end = now + LOOK_AHEAD_MS
      // C: rede lazy — garante instâncias materializadas até o horizonte antes de ler.
      await ensureInstancesUpTo({ repo, userId, ts: end /* + tz/protocols conforme API real */ })
      const instances = await repo.getWindow({ userId, fromTs: now, toTs: end })
      // B/F: DoseItem traz instanceId + scheduledFor absoluto + toleranceMinutes + HH:MM local no tz.
      const items = buildDoseItemsFromInstances(instances, protocols, tz)
        .filter((it) => it.status === 'pending')

      await alarmService.cancelAll()
      if (cancelled) return
      for (const it of items) {
        if (cancelled) return
        await alarmService.scheduleAlarm({
          doseInstanceId: it.instanceId,
          medicineName: it.medicineName,       // do lookup protocols, não coluna
          scheduledFor: it.scheduledFor,        // F: instante absoluto → trigger TIMESTAMP direto, sem conversão tz
          toleranceMinutes: it.toleranceMinutes, // D: cutoff dinâmico p/ nag/expiração
        })
      }
    }
    sync()
    return () => { cancelled = true }
  }, [isAlarmEnabled, userId, protocols, tz])
}
```
> **C1 gates**: confirmar assinaturas reais de `getWindow`, `ensureInstancesUpTo` e o shape do `DoseItem` de `buildDoseItemsFromInstances` (campos `instanceId/medicineName/scheduledFor/toleranceMinutes` — T003). Se `DoseItem` ainda não expõe `medicineName`, derivar do `protocols` no caller (não adicionar coluna).

### 5. `quickDoseRegistration.js` — registro pela via canônica (CORREÇÃO CRÍTICA)
```javascript
import notifee from '@notifee/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { registerDose } from '@features/dose/services/doseService'
import { alarmService } from './alarmService'
import { nativeSupabaseClient } from '../supabase/nativeSupabaseClient'

// ⚠️ CORREÇÃO (planning 2026-06-02): chaves REAIS verificadas no repo mobile.
// `@dosiq/dose-instances-snapshot` e `@dosiq/adherence-snapshot` NÃO EXISTEM
// (multiRemove delas = no-op silencioso → AP-168). Chaves reais presentes:
// today / stock / treatments / protocols / medicines / purchases / notif-log.
// Adesão é exibida na view de tratamentos → invalidar `treatments-snapshot`.
// CONFIRMAR o conjunto canônico em C1 (T004b — ler useTodayData.js + hook de adesão).
const SNAPSHOTS_TAKEN = ['@dosiq/today-snapshot', '@dosiq/stock-snapshot',
                         '@dosiq/treatments-snapshot']
const SNAPSHOTS_SKIP  = ['@dosiq/today-snapshot', '@dosiq/treatments-snapshot']

export async function handleAlarmAction(event) {
  const { doseInstanceId, protocolId, medicineId, expectedDose, intakeUnit, nagAttempt }
    = event.detail.notification.data

  switch (event.detail.pressAction.id) {
    case 'dose-taken': {
      // VIA CANÔNICA: cria medicine_log + consume_stock_fifo + ancora a instance.
      // registerDose já faz o elo bidirecional (status='taken' + medicine_log_id) e rollback.
      await registerDose(
        { protocol_id: protocolId, medicine_id: medicineId,
          quantity_taken: expectedDose, /* + campos exigidos pelo logSchema */ },
        { instanceId: doseInstanceId }
      )
      await alarmService.cancelAlarm(doseInstanceId)
      await AsyncStorage.multiRemove(SNAPSHOTS_TAKEN)
      break
    }
    case 'dose-skip': {
      // Skip não cria log nem consome estoque — update direto é correto aqui.
      await nativeSupabaseClient.from('dose_instances')
        .update({ status: 'skipped_user' }).eq('id', doseInstanceId)
      await alarmService.cancelAlarm(doseInstanceId)
      await AsyncStorage.multiRemove(SNAPSHOTS_SKIP)
      break
    }
    default: { // ignorado → nag reativo
      await alarmService.scheduleNag({ doseInstanceId,
        medicineName: event.detail.notification.data.medicineName,
        currentNagAttempt: parseInt(nagAttempt || '0', 10) })
    }
  }
}
```
> **Mudança vs. fonte**: a fonte fazia `dose_instances.update({ status:'taken', taken_at })` — **errado** (coluna `taken_at` inexistente + pula `medicine_log`/`consume_stock_fifo`). O payload de `registerDose` deve casar com `logSchema` (`@dosiq/core`) — confirmar campos obrigatórios em C1. A `data` da notificação passa a carregar `protocolId`/`medicineId`/`expectedDose`/`intakeUnit` (não só `medicineName`).

### 6. Re-sync em mutação de protocolo (insumo E)
A fonte canônica do wipe+regen de `dose_instances` em CRUD de protocolo é `syncInstancesOnWrite`
(`createProtocolRepository`, §4/§9 DOSE_INSTANCES.md). O re-sync do alarme (FR-006) deve disparar
**APÓS** `syncInstancesOnWrite` concluir — não em paralelo (race: re-agendar sobre instâncias que
o wipe ainda vai apagar). Padrão: re-rodar `useAlarmScheduler.sync()` no mesmo ponto que invalida
os snapshots pós-mutação de protocolo. Confirmar o hook de mutação real em C1 (T003b).

### 7. iOS (Sprint 2)
Config `Info.plist` + background modes; critical alert condicional (fallback `timeSensitive`); adaptar `AlarmFullScreen` p/ notification action buttons; re-scheduling em mutação de protocolo.

---

## SQP (R-221)
Plataforma **Mobile** (+ possível adição de método no repo `@dosiq/core` = Shared). SemVer **minor**. Bump `apps/mobile/app.config.js`. CHANGELOG `[Unreleased]` (mobile) + store-note ("alarmes no horário certo, mesmo no silencioso").

---

## Insumos integrados do `docs/architecture/DOSE_INSTANCES.md` (2026-06-02)
- **A** `notified_at`/`snoozed_until` existem no schema → idempotência server-side + snooze canônico (§3 do plano).
- **B** Reuso `getWindow` + `buildDoseItemsFromInstances` (CON-024) em vez de read raw inventado (§4).
- **C** `ensureInstancesUpTo(now+72h)` antes de ler — fecha gap de geração (§4).
- **D** `tolerance_minutes` dinâmico por instância como cutoff de nag/expiração (§3).
- **E** Re-sync pendurado em `syncInstancesOnWrite`, nunca paralelo (§6).
- **F** `scheduled_for` absoluto → trigger TIMESTAMP direto, sem conversão tz (§3/§4).
- **G** `getWindow status='pending'` já exclui pausados (`skipped_paused`) — sem lógica extra.

## Risks

- **API do repo `dose_instances`**: confirmar assinaturas reais de `getWindow`, `ensureInstancesUpTo` e shape do `DoseItem` (`buildDoseItemsFromInstances`) em C1 (T003). Reusar — NÃO adicionar `listPendingForAlarms` nem coluna `medicine_name`.
- **Hook de mutação de protocolo (re-sync)**: localizar o ponto pós-`syncInstancesOnWrite` que invalida snapshots, ancorar o re-sync do alarme ali (T003b). Evitar race com o wipe.
- **Payload de `registerDose`**: casar com `logSchema` (campos obrigatórios: `quantity_taken`, unidades). C1 gate.
- **500 alarmes exatos (Android 12+)**: janela 72h + nag reativo.
- **iOS background**: nag só via `createTriggerNotification` (kernel), nunca JS timer.
- **Critical Alert entitlement**: lead 2-4 semanas; v1 com fallback `timeSensitive`.
- **Cache invalidation incompleto (AP-168)**: chaves de snapshot da spec eram fantasmas; corrigidas p/ chaves reais. Confirmar conjunto canônico em C1 (T004b) antes de codar — invalidar adesão (`treatments-snapshot`) é obrigatório p/ ring/sparkline refletirem a tomada.
