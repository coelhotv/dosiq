# EXEC SPEC — P0.1: Alarme Nativo Persistente (v1.0 — 2026-05-30)

> **STATUS: 📋 SPEC PRONTA — AGUARDANDO CONCLUSÃO DO REFACTOR dose_instances**
> **Duração**: 2 sprints semanais (A1.1 + A1.2)
> **Branch base**: `feat/alarme-nativo`
> **Referência**: UNIFIED_ROADMAP_2026.md §3 (Pré-Fase 5) + §4.4
> **Pré-condição**: ✅ Refactor dose_instances Fase 3 concluído e mergeado em `main`
> **Quality Gates**: G1 (Copy Android) → G2 (Copy iOS) → G3 (Merge)
> **SQP vinculante**: v2.0 ([INDEX_EXEC_SPECS.md](../backlog-native_app/INDEX_EXEC_SPECS.md))
> **Plataforma**: 📱 Mobile ONLY — PWA não suporta alarme persistente (browser limitation)

---

## §0 — Contexto Crítico

### 0.1 Por que P0?

Alarme nativo persistente é a **diferenciação competitiva #1** do Dosiq. Sem ele:
- Push notifications comuns são **silenciadas** pelo Doze mode (Android) e DND/Focus (iOS).
- Pacientes crônicos (idosos + multi-medicamento) **dependem** de alarme sonoro para adesão.
- Competidores diretos (Pillo 4.7★, Medisafe 4.7★) têm alarme persistente — é baseline de mercado.
- Diferença entre **3★ e 5★** na Play Store. Sem alarme confiável, reviews negativos são certos.

### 0.2 Estado atual da infra de notificações

O Dosiq mobile usa **somente** `expo-notifications` v0.31.5 para push remoto:

| Componente | Path | O que faz |
|-----------|------|----------|
| `usePushNotifications.js` | `apps/mobile/src/platform/notifications/` | Setup de push pós-login (register-only) |
| `pushPermission.js` | `apps/mobile/src/platform/notifications/` | Pontos de intenção para pedir permissão |
| `registerPushToken.js` | `apps/mobile/src/platform/notifications/` | Registra Expo push token no Supabase |
| `getExpoPushToken.js` | `apps/mobile/src/platform/notifications/` | Obtém token do Expo |
| `syncNotificationDevice.js` | `apps/mobile/src/platform/notifications/` | Sincroniza dispositivo de notificação |
| `unregisterNotificationDevice.js` | `apps/mobile/src/platform/notifications/` | Remove dispositivo no logout |

**Problema**: `expo-notifications` faz push remoto, mas **NÃO faz alarme nativo persistente local**. Push remoto:
- Depende de internet.
- É silenciável pelo SO.
- Não toca indefinidamente.
- Não exibe full-screen alarm na lock screen.

### 0.3 Solução: `@notifee/react-native`

`@notifee/react-native` é a lib mais madura para alarmes nativos em React Native. Suporta:
- **Android**: `AlarmManager.setExactAndAllowWhileIdle()` + full-screen intent + canais de prioridade alta.
- **iOS**: `UNNotificationSound` com som customizado + critical alert entitlement (requer aprovação Apple).
- **Coexistência**: Funciona junto com `expo-notifications` sem conflito — notifee cuida do local, expo cuida do push remoto.

### 0.4 Decisão pendente: Critical Alerts iOS

> [!IMPORTANT]
> iOS Critical Alerts **requer entitlement especial** da Apple (apps de saúde, 2-4 semanas de aprovação).
> O sprint A1.2 (iOS) pode ser implementado sem Critical Alerts — usando som normal em full-screen intent.
> Se a aprovação vier depois, upgrade para Critical Alert é um diff de ~10 linhas.
> **Ação PO**: Submeter request de Critical Alert entitlement à Apple Developer em paralelo com Sprint A1.1.

### 0.5 Cuidados Aprendidos (consolidado de specs anteriores)

- **Hook order**: States → Memos → Effects → Handlers (R-010). Alarmes locais envolvem Effects com cleanup — cuidado com TDZ.
- **Bottom sheet Android**: `<Modal statusBarTranslucent>` (R-233).
- **Cache invalidation**: O alarme local NÃO passa pelo cache SWR. Mas quando dose é registrada via alarme full-screen, `useStockMutation` e `useDoseMutation` devem invalidar caches relevantes (R-236).
- **parseLocalDate()**: NUNCA `new Date('YYYY-MM-DD')` para horários de dose. Usar `parseLocalDate()` (R-020).
- **Validação contínua**: `rtk lint` + `rtk npm run validate:agent` após cada task (SQP §5).

---

## Objetivo

Implementar alarme nativo persistente que:
1. **Toca alto** mesmo com telefone em modo silencioso / Doze mode / DND (Android) ou Focus (iOS).
2. **Exibe full-screen** na lock screen com botão grande "Tomei" + "Pular".
3. **Repete** a cada 5 minutos se não descartado (nagging mode — max 3 repetições).
4. **Registra dose** diretamente do alarme sem abrir o app completo.
5. **Coexiste** com push notifications existentes (expo-notifications não é removido).

**Fora do escopo P0.1 v1:**
- ❌ Alarme para estoque baixo (Fase 7A — cuidador)
- ❌ Alarme para receita vencendo (Fase 6)
- ❌ Som customizado por medicamento (futuro)
- ❌ Vibração pattern customizado (futuro)
- ❌ Widget de alarme na home screen (futuro)

---

## Sprint Breakdown

### Sprint A1.1 — Android Alarm + Full-Screen (Semana ~1)

> **Gate alvo**: G1 (Copy Android)
> **Wave plan** (R-237):
> - **Wave 1 inline Opus**: A1.0 (install + config notifee) + A1.1 (alarm service core)
> - **Wave 2 spawn paralelo**: A1.2 (Sonnet: alarm scheduling hook), A1.3 (Haiku: alarm sound asset)
> - **Wave 3 spawn**: A1.4 (Sonnet: full-screen alarm UI), A1.5 (Sonnet: dose registration from alarm)
> - **Wave 4 spawn**: A1.6 (Sonnet: nagging mode + snooze), A1.7 (Haiku: alarm settings screen)
> - **Wave 5 inline Opus**: A1.8 (integration + smoke) + smoke PO

| # | Task | Arquivos | Agente | Complexidade |
|---|------|----------|--------|-------------|
| A1.0 | **Instalar `@notifee/react-native`** + config `app.config.js` (plugin expo) + Android channel de prioridade alta | `package.json`, `app.config.js` | 👤 Arquiteto | ⭐⭐ |
| A1.1 | **Criar `alarmService.js`** — core de agendamento e cancelamento de alarmes locais | `apps/mobile/src/platform/alarms/alarmService.js` | 👤 Arquiteto | ⭐⭐⭐ |
| A1.2 | **Hook `useAlarmScheduler`** — agenda alarmes ao carregar tratamentos ativos + reagenda em mutation | `apps/mobile/src/platform/alarms/useAlarmScheduler.js` | 🤖 Sonnet | ⭐⭐⭐ |
| A1.3 | **Asset de som de alarme** — 1 arquivo `.wav` 5s (tom médico) + reference no notifee channel | `apps/mobile/assets/sounds/alarm_dose.wav` | 🤖 Haiku | ⭐ |
| A1.4 | **Tela `AlarmFullScreen`** — full-screen intent Android lock screen com botão "Tomei" + "Pular" | `apps/mobile/src/platform/alarms/AlarmFullScreen.jsx` | 🤖 Sonnet | ⭐⭐⭐ |
| A1.5 | **Quick dose registration** — registrar dose diretamente do full-screen (mutation + dismiss alarm) | `apps/mobile/src/platform/alarms/quickDoseRegistration.js` | 🤖 Sonnet | ⭐⭐ |
| A1.6 | **Nagging mode** — re-agendar alarme 5 min depois se ignorado, max 3 tentativas | (expand `alarmService.js`) | 🤖 Sonnet | ⭐⭐ |
| A1.7 | **Alarm Settings** — toggle on/off, horário de silêncio (ex: 22h-6h), em ProfileScreen | `apps/mobile/src/features/profile/components/AlarmSettings.jsx` | 🤖 Haiku | ⭐⭐ |
| A1.8 | **Integração** — conectar `useAlarmScheduler` ao App root + test E2E manual | (integration) | 👤 Arquiteto | ⭐⭐ |
| A1.9 | Testes unitários: `alarmService.test.js`, `quickDoseRegistration.test.js` | `apps/mobile/src/platform/alarms/__tests__/` | 🤖 Haiku | ⭐⭐ |

**Entrega**: smoke PO em Android (R-234) → push → `gh pr create` → merge em `feat/alarme-nativo`

---

### Sprint A1.2 — iOS Alarm + Polish Cross-Platform (Semana ~2)

> **Wave plan**:
> - **Wave 1 inline Opus**: A2.1 (iOS-specific config notifee) + A2.2 (Critical Alert handling)
> - **Wave 2 spawn**: A2.3 (Sonnet: iOS full-screen adaptation), A2.4 (Haiku: permissions prompt)
> - **Wave 3 spawn**: A2.5 (Sonnet: protocol mutation re-scheduling), A2.6 (Haiku: tests iOS)
> - **Wave 4 inline Opus**: A2.7 (integration cross-platform) + smoke PO iOS + Android retest

| # | Task | Arquivos | Agente | Complexidade |
|---|------|----------|--------|-------------|
| A2.1 | **iOS config notifee** — `Info.plist` additions, background modes, notification service extension | `app.config.js`, iOS-specific config | 👤 Arquiteto | ⭐⭐⭐ |
| A2.2 | **Critical Alert handling** — conditional code path se entitlement aprovado; fallback para high priority | (expand `alarmService.js`) | 👤 Arquiteto | ⭐⭐ |
| A2.3 | **Adapt `AlarmFullScreen` para iOS** — iOS não tem full-screen intent nativo; usar notification action buttons com rich notification | (expand `AlarmFullScreen.jsx`) | 🤖 Sonnet | ⭐⭐ |
| A2.4 | **Permission prompt inteligente** — pedir permissão de alarme em ponto de intenção (após 1ª dose registrada com sucesso) | `apps/mobile/src/platform/alarms/alarmPermission.js` | 🤖 Haiku | ⭐⭐ |
| A2.5 | **Re-scheduling hook** — quando protocol é editado/criado/deletado/pausado, recalcular alarmes | (expand `useAlarmScheduler.js`) | 🤖 Sonnet | ⭐⭐⭐ |
| A2.6 | Testes iOS-specific + snapshot test cross-platform | `apps/mobile/src/platform/alarms/__tests__/` | 🤖 Haiku | ⭐⭐ |
| A2.7 | **Integração cross-platform** + cleanup + validate:agent + expo export | (integration) | 👤 Arquiteto | ⭐⭐ |

**Entrega**: smoke PO iOS + Android (R-234) → push → `gh pr create` → merge em `feat/alarme-nativo` → **merge em `main`**

---

## Especificações Técnicas Detalhadas

### A1.1 — `alarmService.js` (Core)

```javascript
import notifee, { TriggerType, AndroidImportance, AndroidCategory } from '@notifee/react-native'
import { parseLocalDate } from '@utils/dateUtils'

// Canal Android de prioridade máxima (bypass Doze mode)
const ALARM_CHANNEL_ID = 'dosiq-dose-alarm'
const MAX_NAG_ATTEMPTS = 3
const NAG_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

export const alarmService = {
  /**
   * Inicializa canal Android de alarme (chamado 1x no boot do app).
   * iOS não precisa de canal — usa UNNotificationCategory.
   */
  async initialize() {
    await notifee.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'Alarmes de Medicamentos',
      description: 'Alarmes persistentes para horário de doses',
      importance: AndroidImportance.HIGH,
      sound: 'alarm_dose',          // ref ao asset em res/raw/
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
      bypassDnd: true,              // Bypass Do Not Disturb
    })
  },

  /**
   * Agenda alarme local para uma dose_instance específica.
   * @param {Object} params
   * @param {string} params.doseInstanceId — PK da dose_instance
   * @param {string} params.medicineName — ex: "Losartana 50mg"
   * @param {string} params.scheduledFor — ISO timestamp (GMT-3 aware)
   * @param {number} [params.nagAttempt=0] — contagem de re-tentativas
   */
  async scheduleAlarm({ doseInstanceId, medicineName, scheduledFor, nagAttempt = 0 }) {
    const triggerTime = parseLocalDate(scheduledFor).getTime()
    if (triggerTime <= Date.now()) return // passado, não agendar

    const notificationId = `alarm-${doseInstanceId}-nag${nagAttempt}`

    await notifee.createTriggerNotification(
      {
        id: notificationId,
        title: '💊 Hora do medicamento',
        body: `${medicineName} — toque para registrar.`,
        android: {
          channelId: ALARM_CHANNEL_ID,
          category: AndroidCategory.ALARM,
          fullScreenAction: { id: 'alarm-full-screen' },
          pressAction: { id: 'default' },
          actions: [
            { title: '✅ Tomei', pressAction: { id: 'dose-taken' } },
            { title: '⏭️ Pular', pressAction: { id: 'dose-skip' } },
          ],
          sound: 'alarm_dose',
          importance: AndroidImportance.HIGH,
          autoCancel: false,
        },
        ios: {
          sound: 'alarm_dose.wav',
          // critical: true,  // habilitar quando entitlement aprovado
          interruptionLevel: 'timeSensitive',
          categoryId: 'DOSE_ALARM',
        },
        data: {
          type: 'dose-alarm',
          doseInstanceId,
          medicineName,
          scheduledFor,
          nagAttempt: String(nagAttempt),
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerTime,
        alarmManager: {
          allowWhileIdle: true,  // Bypass Doze mode
        },
      }
    )
  },

  /**
   * Cancela todos os alarmes de uma dose_instance (incluindo nags pendentes).
   */
  async cancelAlarm(doseInstanceId) {
    for (let i = 0; i <= MAX_NAG_ATTEMPTS; i++) {
      await notifee.cancelNotification(`alarm-${doseInstanceId}-nag${i}`)
    }
  },

  /**
   * Reagenda alarme como nagging (+5 min) se não foi respondido.
   * Max 3 tentativas.
   */
  async scheduleNag({ doseInstanceId, medicineName, scheduledFor, currentNagAttempt }) {
    if (currentNagAttempt >= MAX_NAG_ATTEMPTS) return // desistir após 3

    const nextTime = new Date(Date.now() + NAG_INTERVAL_MS).toISOString()
    await this.scheduleAlarm({
      doseInstanceId,
      medicineName,
      scheduledFor: nextTime,
      nagAttempt: currentNagAttempt + 1,
    })
  },

  /**
   * Cancela TODOS os alarmes pendentes (logout, troca de conta).
   */
  async cancelAll() {
    await notifee.cancelAllNotifications()
  },
}
```

### A1.2 — `useAlarmScheduler` (Hook)

```javascript
import { useEffect } from 'react'
import { alarmService } from './alarmService'
import { parseLocalDate } from '@utils/dateUtils'

/**
 * Agenda alarmes locais para todas as dose_instances pendentes do dia.
 * Re-executa sempre que treatments mudam (mutation) ou app volta ao foreground.
 *
 * REGRA: Alarmam APENAS dose_instances com status='pending' e scheduled_for > now.
 * dose_instances com status='taken', 'missed', 'skipped_user', 'skipped_paused' são IGNORADAS.
 *
 * Caches invalidados: nenhum (alarme local, não SWR)
 * Caches NÃO invalidados (intencionalmente): todos os SWR caches — alarme não lê SWR
 */
export function useAlarmScheduler({ doseInstances, isAlarmEnabled }) {
  useEffect(() => {
    if (!isAlarmEnabled || !doseInstances?.length) return

    let cancelled = false

    async function syncAlarms() {
      // 1. Cancelar todos os alarmes existentes (idempotente)
      await alarmService.cancelAll()

      if (cancelled) return

      // 2. Agendar novos alarmes para instâncias pendentes
      const now = Date.now()
      const pending = doseInstances.filter(
        (di) => di.status === 'pending' && parseLocalDate(di.scheduled_for).getTime() > now
      )

      for (const di of pending) {
        if (cancelled) return
        await alarmService.scheduleAlarm({
          doseInstanceId: di.id,
          medicineName: di.medicine_name,
          scheduledFor: di.scheduled_for,
        })
      }
    }

    syncAlarms()

    return () => {
      cancelled = true
    }
  }, [doseInstances, isAlarmEnabled])
}
```

### A1.4 — `AlarmFullScreen` (Android Full-Screen Intent)

```jsx
import React from 'react'
import { View, Text, Pressable, StyleSheet, Vibration } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/**
 * Tela full-screen exibida na lock screen quando alarme dispara.
 * Design: fundo escuro, botões gigantes (>80px touch target), texto legível para idosos.
 *
 * NÃO é uma tela da navigation stack — é renderizada via notifee fullScreenAction.
 */
export function AlarmFullScreen({ notification, onDoseTaken, onDoseSkipped, onDismiss }) {
  const { medicineName, scheduledFor } = notification.data

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>💊</Text>
        <Text style={styles.title}>Hora do medicamento</Text>
        <Text style={styles.medicineName}>{medicineName}</Text>
        <Text style={styles.time}>{formatTime(scheduledFor)}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.buttonTaken]}
          onPress={onDoseTaken}
          accessibilityRole="button"
          accessibilityLabel={`Registrar que tomou ${medicineName}`}
        >
          <Text style={styles.buttonText}>✅ Tomei</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonSkip]}
          onPress={onDoseSkipped}
          accessibilityRole="button"
          accessibilityLabel={`Pular dose de ${medicineName}`}
        >
          <Text style={styles.buttonText}>⏭️ Pular</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 },
  content: { alignItems: 'center', marginBottom: 48 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  medicineName: { fontSize: 24, fontWeight: '600', color: '#e0e0ff', marginBottom: 4 },
  time: { fontSize: 20, color: '#a0a0cc' },
  actions: { gap: 16 },
  button: { paddingVertical: 20, borderRadius: 16, alignItems: 'center', minHeight: 80 },
  buttonTaken: { backgroundColor: '#16a34a' },
  buttonSkip: { backgroundColor: '#6b7280' },
  buttonText: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
})
```

### A1.5 — `quickDoseRegistration.js`

```javascript
import notifee from '@notifee/react-native'
import { nativeSupabaseClient } from '../../platform/supabase/nativeSupabaseClient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { alarmService } from './alarmService'

/**
 * Registra dose diretamente do alarme (sem abrir app completo).
 * Chamado pelos notification action buttons.
 *
 * Caches invalidados:
 *   - @dosiq/dose-instances-snapshot (status pending → taken)
 *   - @dosiq/stock-snapshot (consume_stock_fifo consome lote)
 *   - @dosiq/adherence-snapshot (score recalculado)
 * Caches NÃO invalidados (intencionalmente):
 *   - @dosiq/protocols-snapshot (dose não muda protocolo)
 */
export async function handleAlarmAction(type, event) {
  const { doseInstanceId, medicineName, nagAttempt } = event.detail.notification.data

  switch (event.detail.pressAction.id) {
    case 'dose-taken': {
      // 1. Registrar dose via Supabase (offline queue se sem internet)
      const { error } = await nativeSupabaseClient
        .from('dose_instances')
        .update({ status: 'taken', taken_at: new Date().toISOString() })
        .eq('id', doseInstanceId)

      // 2. Consumir estoque FIFO (se stock feature habilitada)
      // TODO: Integrar com consume_stock_fifo quando disponível

      // 3. Cancelar nags pendentes
      await alarmService.cancelAlarm(doseInstanceId)

      // 4. Invalidar caches para que UI atualize quando abrir
      await AsyncStorage.multiRemove([
        '@dosiq/dose-instances-snapshot',
        '@dosiq/stock-snapshot',
        '@dosiq/adherence-snapshot',
      ])

      break
    }

    case 'dose-skip': {
      // 1. Marcar como skipped (usa status do dose_instances refactor)
      await nativeSupabaseClient
        .from('dose_instances')
        .update({ status: 'skipped_user' })
        .eq('id', doseInstanceId)

      // 2. Cancelar nags pendentes
      await alarmService.cancelAlarm(doseInstanceId)

      // 3. Invalidar cache
      await AsyncStorage.multiRemove([
        '@dosiq/dose-instances-snapshot',
        '@dosiq/adherence-snapshot',
      ])

      break
    }

    default: {
      // Alarme ignorado (swipe away) — agendar nag se não excedeu limite
      await alarmService.scheduleNag({
        doseInstanceId,
        medicineName,
        scheduledFor: new Date().toISOString(),
        currentNagAttempt: parseInt(nagAttempt || '0', 10),
      })
      break
    }
  }
}
```

---

## Novas Rotas

**Nenhuma rota de navegação nova.** O alarme full-screen é renderizado via `notifee.fullScreenAction`, NÃO pela navigation stack do app. A tela de settings do alarme é incorporada no `ProfileScreen` existente.

---

## Estrutura de Diretórios (Resultado Final)

```
apps/mobile/src/
  platform/
    alarms/                                  ← [NEW] módulo inteiro
      alarmService.js                        ← [NEW] core scheduling + cancel + nag
      alarmPermission.js                     ← [NEW] prompt inteligente em ponto de intenção
      useAlarmScheduler.js                   ← [NEW] hook: agenda alarmes por dose_instance
      quickDoseRegistration.js               ← [NEW] registra dose do notification action
      AlarmFullScreen.jsx                    ← [NEW] UI lock screen (Android full-screen intent)
      __tests__/
        alarmService.test.js                 ← [NEW]
        quickDoseRegistration.test.js        ← [NEW]
    notifications/                            ← existente — NÃO modificar (expo-notifications push)
  features/
    profile/
      components/
        AlarmSettings.jsx                    ← [NEW] toggle + horário silêncio
  assets/
    sounds/
      alarm_dose.wav                         ← [NEW] tom de alarme (5s, loop-friendly)
```

---

## Quality Gates — P0.1 Alarme Nativo

### G1 — Gate de Cópia Android

| Critério | Validação |
|----------|-----------|
| `@notifee/react-native` instalado e build Android OK | `npx expo run:android` sem erros |
| Canal de alarme criado com `importance: HIGH` + `bypassDnd: true` | Log `notifee.createChannel` OK |
| Alarme dispara no horário exato em Doze mode | Smoke PO: device em Doze → alarme toca |
| Full-screen intent exibe na lock screen | Smoke PO: device locked → tela aparece |
| Botão "Tomei" registra dose no Supabase | Smoke PO: verificar `dose_instances.status='taken'` |
| Botão "Pular" registra `status='skipped_user'` | Smoke PO: verificar `dose_instances.status='skipped_user'` |
| Nagging mode: alarme repete 5 min depois se ignorado (max 3x) | Smoke PO: ignorar alarme → novo toca em 5 min |
| AlarmSettings toggle funciona em ProfileScreen | Smoke PO |
| Alarm coexiste com push notifications existentes | Smoke PO: push remoto ainda funciona normalmente |
| `rtk lint` 0 erros | Output colado |
| `rtk npm run validate:agent` 100% green | Output colado |
| **Smoke PO (R-234) concluído antes de `gh pr create`** | Confirmação PO |

### G2 — Gate de Cópia iOS

| Critério | Validação |
|----------|-----------|
| Build iOS OK | `npx expo run:ios` sem erros |
| Alarme toca com som em iPhone locked | Smoke PO iOS |
| Notification actions "Tomei" / "Pular" funcionam via iOS categories | Smoke PO iOS |
| Se Critical Alert entitlement aprovado: alarme toca em DND | Smoke PO iOS (condicional) |
| Se NÃO aprovado: fallback `timeSensitive` funciona | Smoke PO iOS |
| `npx expo export` 0 erros | Output colado |

### G3 — Gate Final

| Critério | Validação |
|----------|-----------|
| Android + iOS alarmes funcionais simultaneamente | Smoke PO cross-platform |
| Push remoto (expo-notifications) ainda 100% funcional | Smoke PO |
| `validate:agent` 100% green | Output colado |
| `npx expo export` 0 erros | Output colado |
| DEVFLOW C5 aplicado pós-merge | `.agent/` audit |
| PR mergeado em `main` com aprovação PO (R-060) | Confirmação PO |

---

## Delegação de Agentes

| Task ID | Agente | Motivo |
|---------|--------|--------|
| A1.0, A1.1, A1.8 | 👤 Arquiteto (Opus) | Setup de lib nativa + decisões de API + integração cross-feature |
| A1.2, A1.4, A1.5, A1.6, A2.3, A2.5 | 🤖 Sonnet ⭐⭐ | Hooks/UI complexos com pattern claro (notifee docs) |
| A1.3, A1.7, A1.9, A2.4, A2.6 | 🤖 Haiku ⭐ | Assets, tests, settings simples |
| A2.1, A2.2, A2.7 | 👤 Arquiteto (Opus) | Config iOS nativa + Critical Alert condicional + integração final |

---

## Riscos Especiais

> [!WARNING]
> **Expo Managed Workflow + notifee**: `@notifee/react-native` requer código nativo. Se o projeto usa Expo Go, será necessário migrar para **development build** (`npx expo prebuild` + `expo run:android`/`expo run:ios`). Verificar se o projeto já usa development builds antes de iniciar.

> [!WARNING]
> **AlarmManager rate-limiting (Android 12+)**: A partir do Android 12, `setExactAndAllowWhileIdle()` é rate-limited a ~72 alarmes/dia pelo SO. Para pacientes com 5+ medicamentos × 4 doses/dia × 3 nags = 60 alarmes — está no limite. Monitorar. Se necessário, agrupar alarmes próximos (<15 min) em batch.

> [!WARNING]
> **Background execution iOS**: iOS mata processos background de forma agressiva. O nagging mode (re-agendar alarme em 5 min) DEVE usar `notifee.createTriggerNotification` (que agenda no iOS Notification Center, não no app process). Nunca usar `setTimeout` ou `setInterval` para nagging.

---

## Changelog

### v1.0 — 2026-05-30 (criação)
- Sprint breakdown A1.1 (Android) + A1.2 (iOS)
- Especificações técnicas: alarmService, useAlarmScheduler, AlarmFullScreen, quickDoseRegistration
- Quality gates G1/G2/G3
- Riscos: Expo managed workflow, AlarmManager rate-limiting, iOS background execution
