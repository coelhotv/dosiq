# Implementation Plan: Alarme Nativo Persistente (Mobile)

**Feature Directory**: `plans/specs/001-native-alarm-persistent`
**Spec**: `spec.md` · **Revised**: 2026-06-02 · **Tier**: 1
**Legacy Source**: `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md`

---

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

### 3. `alarmService.js` (core — referência da fonte, mantida)
Canal HIGH + `scheduleAlarm({ doseInstanceId, medicineName, scheduledFor, nagAttempt })` via `notifee.createTriggerNotification` (full-screen action + actions "Tomei"/"Pular"), `cancelAlarm`, `scheduleNag` (máx 3), `cancelAll`. **Importar `parseLocalDate` de `@dosiq/core`**, não `@utils/dateUtils`.

### 4. `useAlarmScheduler.js` (hook)
```javascript
import { useEffect } from 'react'
import { parseLocalDate, addDays, createDoseInstanceRepository } from '@dosiq/core'
import { alarmService } from './alarmService'

const LOOK_AHEAD_DAYS = 3 // 72h

export function useAlarmScheduler({ isAlarmEnabled, userId }) {
  useEffect(() => {
    if (!isAlarmEnabled || !userId) return
    let cancelled = false

    async function sync() {
      const repo = createDoseInstanceRepository(/* client */)
      // Lê pendentes na janela + JOIN p/ medicine_name (repo expõe o nome do medicamento;
      // dose_instances NÃO tem coluna medicine_name — vem de protocols→medicines).
      const now = Date.now()
      const end = addDays(new Date(), LOOK_AHEAD_DAYS).getTime()
      const pending = await repo.listPendingForAlarms({ userId, fromTs: now, toTs: end })

      await alarmService.cancelAll()
      if (cancelled) return
      for (const di of pending) {
        if (cancelled) return
        await alarmService.scheduleAlarm({
          doseInstanceId: di.id,
          medicineName: di.medicine_name, // derivado pelo repo (JOIN), não coluna
          scheduledFor: di.scheduled_for,
        })
      }
    }
    sync()
    return () => { cancelled = true }
  }, [isAlarmEnabled, userId])
}
```
> Se o repo de `@dosiq/core` ainda não expõe um método de leitura com o nome do medicamento, **adicionar `listPendingForAlarms` no repository** (core) com o JOIN — confirmar a API real em C1 (T-preflight). Não inventar `di.medicine_name` cru.

### 5. `quickDoseRegistration.js` — registro pela via canônica (CORREÇÃO CRÍTICA)
```javascript
import notifee from '@notifee/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { registerDose } from '@features/dose/services/doseService'
import { alarmService } from './alarmService'
import { nativeSupabaseClient } from '../supabase/nativeSupabaseClient'

const SNAPSHOTS_TAKEN = ['@dosiq/dose-instances-snapshot', '@dosiq/stock-snapshot',
                         '@dosiq/adherence-snapshot', '@dosiq/today-snapshot']
const SNAPSHOTS_SKIP  = ['@dosiq/dose-instances-snapshot', '@dosiq/adherence-snapshot',
                         '@dosiq/today-snapshot']

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

### 6. iOS (Sprint 2)
Config `Info.plist` + background modes; critical alert condicional (fallback `timeSensitive`); adaptar `AlarmFullScreen` p/ notification action buttons; re-scheduling em mutação de protocolo.

---

## SQP (R-221)
Plataforma **Mobile** (+ possível adição de método no repo `@dosiq/core` = Shared). SemVer **minor**. Bump `apps/mobile/app.config.js`. CHANGELOG `[Unreleased]` (mobile) + store-note ("alarmes no horário certo, mesmo no silencioso").

---

## Risks

- **API do repo `dose_instances` p/ alarmes**: confirmar/adicionar `listPendingForAlarms` (com nome do medicamento) em `@dosiq/core` — C1 gate. Não usar coluna inexistente.
- **Payload de `registerDose`**: casar com `logSchema` (campos obrigatórios: `quantity_taken`, unidades). C1 gate.
- **500 alarmes exatos (Android 12+)**: janela 72h + nag reativo.
- **iOS background**: nag só via `createTriggerNotification` (kernel), nunca JS timer.
- **Critical Alert entitlement**: lead 2-4 semanas; v1 com fallback `timeSensitive`.
