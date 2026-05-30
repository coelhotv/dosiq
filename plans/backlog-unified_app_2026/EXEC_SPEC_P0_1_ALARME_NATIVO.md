# EXEC SPEC — P0.1: Alarme Nativo Persistente (v2.0 — 2026-05-30)

> **STATUS: 📋 SPEC ATUALIZADA E REFINADA — AGUARDANDO CONCLUSÃO DO REFACTOR dose_instances**
> **Duração**: 2 sprints semanais (A1.1 + A1.2)
> **Branch base**: `feat/alarme-nativo`
> **Referência**: UNIFIED_ROADMAP_2026.md §3 (Pré-Fase 5) + §4.4
> **Pré-condição**: ✅ Refactor dose_instances Fase 3/4 concluído e mergeado em `main`
> **Quality Gates**: G1 (Copy Android) → G2 (Copy iOS) → G3 (Merge)
> **SQP de Qualidade**: v2.0 ([INDEX_EXEC_SPECS.md](../backlog-native_app/INDEX_EXEC_SPECS.md))
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

### 0.4 Decisão estabelecida: Critical Alerts iOS

> [!IMPORTANT]
> iOS Critical Alerts **requer entitlement especial** da Apple (apps de saúde, 2-4 semanas de aprovação).
> O sprint A1.2 (iOS) será implementado inicialmente usando som normal em full-screen intent/timeSensitive fallback.
> Se a aprovação do entitlement vier depois, a ativação do Critical Alert é apenas um toggle de código local.
> **Ação PO**: Submeter request de Critical Alert entitlement à Apple Developer em paralelo com Sprint A1.1.

### 0.5 Cuidados Aprendidos (consolidado de specs anteriores)

- **Development Build Padronizado**: O projeto não utiliza mais Expo Go padrão devido às integrações preexistentes de Push Notifications remotos e Firebase. As builds são geradas usando `rtk expo run:android` e `rtk expo run:ios`.
- **Assinatura Sonora Dupla**: Já constam na pasta `apps/mobile/assets/sounds/` os dois arquivos de áudio oficiais do projeto:
  - `alarm_dose.wav` (1.2 MB): Som de tom clínico com padrão contínuo, ideal para alarme invasivo e persistente em lock screen.
  - `push_chime.wav` (398 KB): Assinatura de tom sutil e curta, ideal para pushes remotos normais (aviso de dose atrasada, alertas de estoque).
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
3. **Repete** a cada 5 minutos se não descartado (nagging mode — max 3 repetições agendadas dinamicamente).
4. **Registra dose** diretamente do alarme sem abrir o app completo.
5. **Coexiste** com push notifications existentes (expo-notifications não é removido e passa a usar o `push_chime.wav`).

**Fora do escopo P0.1 v2:**
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
> - **Wave 2 spawn paralelo**: A1.2 (Sonnet: alarm scheduling hook), A1.3 (Haiku: alarm sound asset mapping)
> - **Wave 3 spawn**: A1.4 (Sonnet: full-screen alarm UI), A1.5 (Sonnet: dose registration from alarm)
> - **Wave 4 spawn**: A1.6 (Sonnet: nagging mode + snooze), A1.7 (Haiku: alarm settings screen)
> - **Wave 5 inline Opus**: A1.8 (integration + smoke) + smoke PO

| # | Task | Arquivos | Agente | Complexidade |
|---|------|----------|--------|-------------|
| A1.0 | **Instalar `@notifee/react-native`** + config `app.config.js` (plugin expo) + Android channel de prioridade alta + permissões `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` | `package.json`, `app.config.js` | 👤 Arquiteto | ⭐⭐ |
| A1.1 | **Criar `alarmService.js`** — core de agendamento e cancelamento de alarmes locais | `apps/mobile/src/platform/alarms/alarmService.js` | 👤 Arquiteto | ⭐⭐⭐ |
| A1.2 | **Hook `useAlarmScheduler`** — agenda alarmes na janela Look-Ahead de **72 horas** baseando-se no refatoramento definitivo de `dose_instances` | `apps/mobile/src/platform/alarms/useAlarmScheduler.js` | 🤖 Sonnet | ⭐⭐⭐ |
| A1.3 | **Mapeamento de som de alarme** — vincular `alarm_dose.wav` e `push_chime.wav` nativamente nas builds compiladas de Android/iOS | `apps/mobile/assets/sounds/` | 🤖 Haiku | ⭐ |
| A1.4 | **Tela `AlarmFullScreen`** — full-screen intent Android lock screen com botão "Tomei" + "Pular" | `apps/mobile/src/platform/alarms/AlarmFullScreen.jsx` | 🤖 Sonnet | ⭐⭐⭐ |
| A1.5 | **Quick dose registration** — registrar dose diretamente do full-screen (mutation + dismiss alarm + invalidar cache local) | `apps/mobile/src/platform/alarms/quickDoseRegistration.js` | 🤖 Sonnet | ⭐⭐ |
| A1.6 | **Nagging mode** — re-agendar alarme exato dinamicamente 5 min depois se ignorado, max 3 tentativas | (expand `alarmService.js`) | 🤖 Sonnet | ⭐⭐ |
| A1.7 | **Alarm Settings** — toggle on/off, integrado em `SettingsScreen.jsx` | `apps/mobile/src/features/profile/screens/SettingsScreen.jsx` | 🤖 Haiku | ⭐⭐ |
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
| A2.2 | **Critical Alert handling** — conditional code path se entitlement aprovado; fallback para high priority / timeSensitive | (expand `alarmService.js`) | 👤 Arquiteto | ⭐⭐ |
| A2.3 | **Adapt `AlarmFullScreen` para iOS** — usar notification action buttons com rich notification | (expand `AlarmFullScreen.jsx`) | 🤖 Sonnet | ⭐⭐ |
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

const ALARM_CHANNEL_ID = 'dosiq-dose-alarm'
const MAX_NAG_ATTEMPTS = 3
const NAG_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

export const alarmService = {
  /**
   * Inicializa canal Android de alarme (chamado 1x no boot do app).
   */
  async initialize() {
    await notifee.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'Alarmes de Medicamentos',
      description: 'Alarmes persistentes para horário de doses',
      importance: AndroidImportance.HIGH,
      sound: 'alarm_dose',          // mapeado para alarm_dose.wav em res/raw/
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
      bypassDnd: true,              // Bypass Do Not Disturb (DND)
    })
  },

  /**
   * Agenda alarme local para uma dose_instance específica.
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
          // critical: true,  // Habilitar quando entitlement da Apple for aprovado
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
          allowWhileIdle: true,  // Garante disparo preciso no Doze Mode do Android 12+
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
   * Reagenda alarme dinamicamente como nagging (+5 min) se não foi respondido.
   * Agendamento dinâmico otimiza o uso do limite de alarmes exatos do SO.
   */
  async scheduleNag({ doseInstanceId, medicineName, scheduledFor, currentNagAttempt }) {
    if (currentNagAttempt >= MAX_NAG_ATTEMPTS) return // Desistir após 3 tentativas

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
import { parseLocalDate, addDays } from '@utils/dateUtils'

const LOOK_AHEAD_WINDOW_DAYS = 3 // Janela Look-Ahead de 72 horas para cobrir alternate/weekly doses

/**
 * Hook que agenda alarmes locais para todas as dose_instances pendentes.
 * Utiliza o modelo final pós-refatoramento obtido da base de dados.
 */
export function useAlarmScheduler({ doseInstances, isAlarmEnabled }) {
  useEffect(() => {
    if (!isAlarmEnabled || !doseInstances?.length) return

    let cancelled = false

    async function syncAlarms() {
      // 1. Limpar alarmes de agendamentos antigos (idempotente)
      await alarmService.cancelAll()

      if (cancelled) return

      // 2. Agendar novos alarmes exatos dentro da janela de 72h
      const now = Date.now()
      const endWindow = addDays(new Date(), LOOK_AHEAD_WINDOW_DAYS).getTime()
      
      const pending = doseInstances.filter((di) => {
        const time = parseLocalDate(di.scheduled_for).getTime()
        return di.status === 'pending' && time > now && time <= endWindow
      })

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
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/**
 * Tela de lock screen (full-screen action) com visual e usabilidade apropriados para idosos.
 */
export function AlarmFullScreen({ notification, onDoseTaken, onDoseSkipped }) {
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
 * Manipula a tomada rápida de medicação através dos botões da notificação sem carregar a UI reativa principal.
 */
export async function handleAlarmAction(type, event) {
  const { doseInstanceId, medicineName, nagAttempt } = event.detail.notification.data

  switch (event.detail.pressAction.id) {
    case 'dose-taken': {
      // 1. Sincronizar com banco (motor central de dose_instances)
      const { error } = await nativeSupabaseClient
        .from('dose_instances')
        .update({ status: 'taken', taken_at: new Date().toISOString() })
        .eq('id', doseInstanceId)

      // 2. Limpar nags preventivos pendentes
      await alarmService.cancelAlarm(doseInstanceId)

      // 3. Invalidar caches para sincronizar com a UI principal na abertura
      await AsyncStorage.multiRemove([
        '@dosiq/dose-instances-snapshot',
        '@dosiq/stock-snapshot',
        '@dosiq/adherence-snapshot',
        '@dosiq/today-snapshot'
      ])
      break
    }

    case 'dose-skip': {
      await nativeSupabaseClient
        .from('dose_instances')
        .update({ status: 'skipped_user' })
        .eq('id', doseInstanceId)

      await alarmService.cancelAlarm(doseInstanceId)

      await AsyncStorage.multiRemove([
        '@dosiq/dose-instances-snapshot',
        '@dosiq/adherence-snapshot',
        '@dosiq/today-snapshot'
      ])
      break
    }

    default: {
      // Alarme limpo/ignorado: Agenda nova insistência (Nag) dinamicamente pós-gatilho
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
    notifications/                            ← existente (expo-notifications push)
  features/
    profile/
      screens/
        SettingsScreen.jsx                   ← existente (modificado para acomodar o toggle)
  assets/
    sounds/
      alarm_dose.wav                         ← existente (tom do alarme principal, 1.2 MB)
      push_chime.wav                         ← existente (assinatura de push sutil, 398 KB)
```

---

## Quality Gates — P0.1 Alarme Nativo

### G1 — Gate de Cópia Android

| Critério | Validação |
|----------|-----------|
| `@notifee/react-native` instalado e build Android OK | `rtk expo run:android` sem erros |
| Canal de alarme criado com `importance: HIGH` + `bypassDnd: true` + `alarm_dose` som associado | Log `notifee.createChannel` OK |
| Alarme dispara no horário exato com precisão de look-ahead de 72h | Smoke PO: dispositivo no Doze Mode → alarme toca |
| Full-screen intent exibe na lock screen com botões acessíveis | Smoke PO |
| Botão "Tomei" registra dose no Supabase na tabela `dose_instances` | Smoke PO: verificar status do registro |
| Botão "Pular" altera status de dose para `'skipped_user'` | Smoke PO |
| Nagging mode: insistência sônica repete dinamicamente após 5 min se ignorado | Smoke PO |
| Toggle de ativação do alarme persiste nas configurações de Profile | Smoke PO |
| Alarme coexiste e se integra perfeitamente com os pushes do Firebase/Expo | Smoke PO |
| `rtk lint` 0 erros | Output verificado |
| `rtk npm run validate:agent` 100% green | Output verificado |

### G2 — Gate de Cópia iOS

| Critério | Validação |
|----------|-----------|
| Build iOS OK | `rtk expo run:ios` sem erros |
| Alarme toca com som customizado em lock screen | Smoke PO iOS |
| Ações rápidas de notificação funcionam nativamente via iOS categories | Smoke PO iOS |
| Se Critical Alert entitlement aprovado: alarme contorna DND | Smoke PO iOS (condicional) |
| Se não aprovado: fallback nativo `timeSensitive` opera com sucesso | Smoke PO iOS |
| `rtk expo export` 0 erros | Output verificado |

---

## Riscos Especiais

> [!WARNING]
> **Android 12+ (API 31+) Hard Limit (500 Exact Alarms)**
> O sistema operacional Android limita a no máximo 500 alarmes exatos cadastrados simultaneamente por app. Nossa modelagem mitiga esse risco de duas formas:
> * Janela Look-Ahead de **72 horas** mantém os registros de medicamentos futuros em baixíssima escala (máximo de 180 mesmo para tratamentos extremos).
> * O **Nagging Mode** é agendado reativamente sob demanda na interceptação em background, evitando o agendamento preventivo de doses futuras de repetição.

> [!WARNING]
> **Background Execution iOS**
> O iOS impõe políticas drásticas de encerramento de threads em background. O agendamento da insistência (snooze/nag) **obrigatoriamente** delega a responsabilidade ao iOS Notification Center via `notifee.createTriggerNotification` (agendamento a nível de kernel do SO) em vez de processos JavaScript em background (`setTimeout`/`setInterval`).

---

## Changelog

### v2.0 — 2026-05-30 (Revisão e Polish)
- Atualização da janela Look-Ahead para **72 horas** (Look-Ahead Window).
- Inclusão dos limites de 500 alarmes exatos ativos simultaneamente no Android 12+.
- Mapeamento definitivo dos arquivos de som oficiais integrados pelo usuário: `alarm_dose.wav` e `push_chime.wav`.
- Detalhamento de segurança sobre o agendamento sob demanda no Nagging Mode para economia de cota de alarmes exatos do SO.
- Padronização em builds de desenvolvimento nativas (decommission do Expo Go).
