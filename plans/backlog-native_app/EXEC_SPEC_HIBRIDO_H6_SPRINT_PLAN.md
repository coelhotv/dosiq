# Exec Spec — Fase 6: Sprint Plan (Agentes Coders)

> **Status:** Planejado ✅ | Pronto para execução por agentes coding
> **Gerado por:** DEVFLOW Planning — sessão `session_2026W16_h6_planning` — 2026-04-16
> **Spec base:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE6_PUSH_BETA_INTERNO.md`
> **Master spec:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Pré-requisito:** Fase 5 concluída ✅ (PR #474 mergeado)

---

## Como usar esta spec

Este arquivo é o ponto de entrada para agentes coders que executam `/devflow coding` em sessões subsequentes.

**Protocolo obrigatório para cada sprint:**

```
1. /devflow → bootstrap (lê state.json + hot + warm relevantes)
2. Leia este arquivo inteiro
3. Leia a seção do sprint atual
4. Leia a spec base: EXEC_SPEC_HIBRIDO_FASE6_PUSH_BETA_INTERNO.md (seção correspondente)
5. /devflow coding "Sprint 6.X — <título>"
6. Aguarde o C2 GATE antes de implementar
7. Use /deliver-sprint para execução estruturada
8. Após merge: atualize o status do sprint neste arquivo
```

**Regra absoluta:** Agentes coders NUNCA mergeiam seus próprios PRs. Criar PR → aguardar review humano.

---

## Estado dos Sprints

| Sprint | Título | Status | Branch | PR |
|--------|--------|--------|--------|----|
| 6.1 | Banco e Contratos | ✅ Completo | merged | #475 |
| 6.2 | Dispatcher e Canais | ✅ Completo | merged | #476 |
| 6.3 | Integração Mobile | ✅ Completo | merged | #477 |
| 6.3.5 | Firebase Analytics | ✅ Completo | merged | #478 |
| 6.4 | Migração dos Jobs | ✅ Completo | merged | #479 |
| 6.5 | Beta Interno e Hardening | 🏗️ Em execução | `main` | — |

**Atualizar esta tabela após cada sprint ser mergeado.**

---

## Pré-condições Globais

Antes de qualquer sprint começar, verificar:

- [x] ADR-029 rascunhado e aprovado pelo maintainer (arquitetura dispatcher multicanal)
- [x] ADR-030 rascunhado e aprovado pelo maintainer (feature flag rollback `USE_NOTIFICATION_DISPATCHER`)
- [x] `npm run validate:agent` verde na branch `main`
- [x] `npm run build` verde na branch `main`

**ADR-029 — Dispatcher Multicanal de Notificações (a criar)**

Decisão: criar `server/notifications/` como camada entre jobs e canais de entrega.
Alternativa rejeitada: if/else em `api/notify.js` (proibido pela spec — seção 2.1).
Arquivo a criar: `.agent/memory/decisions/mobile_and_platform/ADR-029.md`

**ADR-030 — Feature Flag de Rollback (a criar)**

Decisão: `USE_NOTIFICATION_DISPATCHER` env var, default `true`, fallback para Telegram legado.
Remoção do fallback: somente após 2 semanas de operação estável em produção.
Arquivo a criar: `.agent/memory/decisions/mobile_and_platform/ADR-030.md`

---

## Sprint 6.1 — Banco e Contratos

### Objetivo

Criar a base de dados e contratos de repositório **sem tocar ainda no envio real**.
Nenhuma linha de código de notificação de push é enviada neste sprint.

### Branch

```
feature/fase6/sprint-6.1-banco-contratos
```

Criada a partir de `main`.

### Arquivos a criar (verificar que não existem antes de criar)

```
supabase/migrations/20260417_add_notification_preference_to_user_settings.sql
supabase/migrations/20260417_create_notification_devices.sql
server/notifications/repositories/notificationPreferenceRepository.js
server/notifications/repositories/notificationDeviceRepository.js
server/notifications/policies/resolveChannelsForUser.js
server/notifications/policies/resolveChannelsForUser.test.js
```

### Implementação — ordem obrigatória (C3)

**Passo 1: Migration `user_settings.notification_preference`**

```sql
-- supabase/migrations/20260417_add_notification_preference_to_user_settings.sql
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS notification_preference text DEFAULT 'telegram';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_notification_preference_check'
  ) THEN
    ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_notification_preference_check
    CHECK (notification_preference IN ('telegram', 'mobile_push', 'both', 'none'));
  END IF;
END $$;
```

**Passo 2: Migration `notification_devices`**

```sql
-- supabase/migrations/20260417_create_notification_devices.sql
CREATE TABLE IF NOT EXISTS notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_kind text NOT NULL CHECK (app_kind IN ('native', 'pwa')),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  provider text NOT NULL CHECK (provider IN ('expo', 'webpush')),
  push_token text NOT NULL,
  device_name text,
  device_fingerprint text,
  app_version text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, push_token)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_id
  ON notification_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_devices_active_provider
  ON notification_devices (is_active, provider);

ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification devices"
  ON notification_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification devices"
  ON notification_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification devices"
  ON notification_devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Passo 3: `notificationPreferenceRepository.js`**

Exporta:
- `getByUserId(userId)` → retorna valor da coluna `notification_preference`
- `hasTelegramChat(userId)` → retorna `true` se `telegram_chat_id` está preenchido em `user_settings`
- `setPreference(userId, preference)` → atualiza `notification_preference`

**Passo 4: `notificationDeviceRepository.js`**

Exporta:
- `listActiveByUser(userId, provider)` → lista devices com `is_active = true` e `provider = provider`
- `upsert({ userId, appKind, platform, provider, pushToken, deviceName, deviceFingerprint, appVersion })` → upsert com `onConflict: 'provider,push_token'`, atualiza `last_seen_at`
- `deactivateByToken(pushToken)` → `UPDATE SET is_active = false, updated_at = now()` WHERE `push_token = pushToken`
- `deactivateAllForUser(userId, provider)` → desativa todos os devices de um usuário/provider (usado no logout)

**Passo 5: `resolveChannelsForUser.js`**

```js
// server/notifications/policies/resolveChannelsForUser.js
export async function resolveChannelsForUser({ userId, repositories }) {
  const preference = await repositories.preferences.getByUserId(userId)
  const hasTelegram = await repositories.preferences.hasTelegramChat(userId)
  const activeExpoDevices = await repositories.devices.listActiveByUser(userId, 'expo')

  if (preference === 'none') return []
  if (preference === 'telegram') return hasTelegram ? ['telegram'] : []
  if (preference === 'mobile_push') return activeExpoDevices.length > 0 ? ['mobile_push'] : []
  if (preference === 'both') {
    return [
      ...(hasTelegram ? ['telegram'] : []),
      ...(activeExpoDevices.length > 0 ? ['mobile_push'] : []),
    ]
  }
  return []
}
```

**Passo 6: Testes `resolveChannelsForUser.test.js`**

Casos obrigatórios (todos com mocks dos repositories):
1. `preference = 'telegram'` + hasTelegram → `['telegram']`
2. `preference = 'telegram'` + !hasTelegram → `[]`
3. `preference = 'mobile_push'` + devices ativos → `['mobile_push']`
4. `preference = 'mobile_push'` + sem devices → `[]`
5. `preference = 'both'` + hasTelegram + devices ativos → `['telegram', 'mobile_push']`
6. `preference = 'both'` + hasTelegram + sem devices → `['telegram']`
7. `preference = 'both'` + !hasTelegram + devices ativos → `['mobile_push']`
8. `preference = 'none'` → `[]`
9. `preference = 'both'` + !hasTelegram + sem devices → `[]`

### Regras a aplicar (DEVFLOW memory)

- R-082: Zod/DB em sincronia — se criar schema Zod para `notification_preference`, sincronizar com CHECK constraint
- R-089: Verificar colunas antes de INSERT
- R-087: Logging estruturado desde o primeiro arquivo de repositório
- R-042: Operações server-side em `notification_devices` usam service role

### DoD verificável

- [ ] Migrations aplicam sem erro em DB local/staging (`supabase db push` ou equivalente)
- [ ] Leitura/escrita autenticada de devices funciona via RLS
- [ ] `resolveChannelsForUser` passa todos os 9 casos de teste
- [ ] `npm run validate:agent` verde
- [ ] Nenhum arquivo de envio de push criado neste sprint

### Contratos novos a formalizar após sprint

Adicionar ao `CONTRACTS_INDEX.md`:
- CON-017: `resolveChannelsForUser({ userId, repositories })` → `string[]`

---

## Sprint 6.2 — Dispatcher e Canais

### Pré-requisito

Sprint 6.1 mergeado ✅

### Objetivo

Introduzir a nova arquitetura de notificação no backend de forma incremental.
Telegram e push podem coexistir. Falha de um canal não impede o outro.

### Branch

```
feature/fase6/sprint-6.2-dispatcher
```

Criada a partir de `main` (após merge do 6.1).

### Arquivos a criar

```
server/notifications/dispatcher/dispatchNotification.js
server/notifications/channels/telegramChannel.js
server/notifications/channels/expoPushChannel.js
server/notifications/payloads/buildNotificationPayload.js
server/notifications/utils/normalizeChannelResults.js
server/notifications/utils/shouldDeactivateDevice.js
server/notifications/dispatcher/dispatchNotification.test.js
server/notifications/channels/telegramChannel.test.js
server/notifications/channels/expoPushChannel.test.js
```

### Implementação — ordem obrigatória (C3)

**Passo 1: `buildNotificationPayload.js`**

```js
export function buildNotificationPayload({ kind, data }) {
  switch (kind) {
    case 'dose_reminder':
      return {
        title: 'Hora do seu remédio',
        body: `Tome ${data.medicineName} agora`,
        deeplink: `meusremedios://today?protocolId=${data.protocolId}`,
        metadata: { protocolId: data.protocolId, medicineId: data.medicineId },
      }
    case 'stock_alert':
      return {
        title: 'Estoque baixo',
        body: `${data.medicineName} está acabando`,
        deeplink: `meusremedios://stock`,
        metadata: { medicineId: data.medicineId },
      }
    case 'daily_digest':
      return {
        title: 'Resumo do dia',
        body: data.summary,
        deeplink: `meusremedios://today`,
        metadata: {},
      }
    default:
      throw new Error(`Unsupported notification kind: ${kind}`)
  }
}
```

**Passo 2: `normalizeChannelResults.js`**

Recebe array de resultados de canais. Retorna objeto consolidado:
```js
{ success: boolean, channels: result[], totalDelivered: number, totalFailed: number }
```

**Passo 3: `shouldDeactivateDevice.js`**

```js
const PERMANENT_ERRORS = ['DeviceNotRegistered', 'InvalidCredentials', 'MessageTooBig']

export function shouldDeactivateDevice(errorCode) {
  return PERMANENT_ERRORS.includes(errorCode)
}
```

**Passo 4: `telegramChannel.js`**

Encapsula o adapter Telegram existente (`server/bot/`).
- Recebe payload canônico (`{title, body, deeplink, metadata}`)
- Converte para texto Telegram (MarkdownV2 com `escapeMarkdownV2()` — R-031)
- Busca `telegram_chat_id` do usuário via `user_settings`
- Retorna shape padronizado:
```js
{ channel: 'telegram', success: true, attempted: 1, delivered: 1, failed: 0, deactivatedTokens: [], errors: [] }
```

**Passo 5: `expoPushChannel.js`**

```js
export async function sendExpoPushNotification({ userId, payload, context, repositories, expoClient }) {
  const devices = await repositories.devices.listActiveByUser(userId, 'expo')
  if (devices.length === 0) {
    return { channel: 'mobile_push', success: true, attempted: 0, delivered: 0, failed: 0, deactivatedTokens: [], errors: [] }
  }

  const messages = devices.map((device) => ({
    to: device.push_token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.metadata,
  }))

  const result = await expoClient.send(messages)
  return normalizeExpoResult({ devices, result, repositories })
}
```

O `expoClient` é injetado (facilita testes sem chamadas HTTP reais).
`normalizeExpoResult` processa tickets Expo e desativa tokens com erro permanente via `shouldDeactivateDevice`.

**Passo 6: `dispatchNotification.js`**

```js
export async function dispatchNotification({ userId, kind, payload, channels, context, repositories, expoClient }) {
  const results = []

  for (const channel of channels) {
    try {
      if (channel === 'telegram') {
        results.push(await sendTelegramNotification({ userId, payload, context, repositories }))
      }
      if (channel === 'mobile_push') {
        results.push(await sendExpoPushNotification({ userId, payload, context, repositories, expoClient }))
      }
    } catch (error) {
      results.push({ channel, success: false, attempted: 0, delivered: 0, failed: 0, deactivatedTokens: [], errors: [{ message: error.message }] })
    }
  }

  return normalizeChannelResults(results)
}
```

**Passo 7: Testes obrigatórios**

`dispatchNotification.test.js`:
1. `both` com Telegram OK + push OK → ambos entregues
2. `both` com push falhando → Telegram entrega, push falha sem cancelar Telegram
3. `mobile_push` com `DeviceNotRegistered` → token desativado
4. `none` (channels=[]) → zero tentativas
5. Usuário sem devices push → `attempted: 0`

`telegramChannel.test.js`:
1. Entrega com sucesso → shape correto retornado
2. Sem `telegram_chat_id` → `attempted: 0`

`expoPushChannel.test.js`:
1. 2 devices ativos → 2 mensagens enviadas
2. 1 device com `DeviceNotRegistered` → desativado, outro entregue

### Regras a aplicar

- R-087: `correlationId` obrigatório em todo log de dispatch
- AP-SL01: Logging DEVE estar em `server/notifications/` (não em `server/bot/`) para ser visível no Vercel
- R-041: NUNCA usar `process.exit()` nos handlers
- R-042: `expoClient` server-side nunca expõe credenciais ao cliente mobile

### DoD verificável

- [ ] Teste `both` simula coexistência de canais
- [ ] Falha de `expoPushChannel` não cancela `telegramChannel`
- [ ] `shouldDeactivateDevice('DeviceNotRegistered')` retorna `true`
- [ ] Logs de dispatch incluem `correlationId`, `userId`, `kind`, canais tentados/entregues
- [ ] `npm run validate:agent` verde

### Contratos novos a formalizar após sprint

- CON-018: `dispatchNotification({userId, kind, payload, channels, context, repositories, expoClient})` → `{success, channels, totalDelivered, totalFailed}`
- CON-019: `telegramChannel` e `expoPushChannel` → shape de retorno padronizado

### ⚠️ Gap identificado: DLQ Multicanal (não bloqueante para este sprint)

**Situação:** O DLQ existente (`server/services/deadLetterQueue.js`) é exclusivamente Telegram-aware. O `dispatchNotification` implementado neste sprint **não integra com o DLQ** — falhas transitórias de Telegram ou Expo via nova arquitetura se perdem sem retry.

**Por que não é risco neste sprint:** O dispatcher ainda não é chamado por nenhum job em produção. O DLQ atual continua cobrindo o caminho Telegram legado (`tasks.js`) enquanto a feature flag `USE_NOTIFICATION_DISPATCHER` não estiver ativa nos jobs.

**O risco se torna real no Sprint 6.4**, quando os jobs forem migrados. Tratar neste momento.

**Caminhos de solução para Sprint 6.4 (decidir antes de implementar):**

| Opção | Descrição | Custo | Recomendação |
|-------|-----------|-------|--------------|
| **A** | Estender o DLQ atual — adicionar `ErrorCategories` Expo, integrar `enqueue()` no `dispatchNotification` para erros não-permanentes | ~2h | ✅ Preferida |
| **B** | DLQ separado para push — nova tabela `failed_push_queue` com schema Expo-específico | ~4h + nova migration | Alternativa se A criar conflito de schema |

**Erros permanentes Expo** (ex: `DeviceNotRegistered`) são tratados imediatamente via `shouldDeactivateDevice` + `deactivateByToken` — **não precisam de DLQ** ✅

---

## Sprint 6.3 — Integração Mobile

### Pré-requisito

Sprint 6.2 mergeado ✅ (backend do dispatcher pronto)

### Objetivo

Fazer o app mobile registrar o device, manter token sincronizado, e permitir ao usuário escolher preferência de notificação.

### Branch

```
feature/fase6/sprint-6.3-mobile-push
```

Criada a partir de `main` (após merge do 6.2).

### Dependências humanas obrigatórias

Antes de iniciar este sprint, confirmar com o maintainer:
- [ ] Apple Developer account ativa com push notifications habilitadas
- [ ] Projeto EAS configurado (`eas.json` com profiles `development`, `preview`, `production`)
- [ ] `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` em `.env.local` do mobile

### Pacotes a instalar no workspace mobile

```bash
cd apps/mobile
npx expo install expo-notifications expo-device expo-application
```

Verificar que não há conflito de peer deps (R-158) antes de commitar `package-lock.json`.

### Arquivos a criar

```
apps/mobile/src/platform/notifications/requestPushPermission.js
apps/mobile/src/platform/notifications/getExpoPushToken.js
apps/mobile/src/platform/notifications/syncNotificationDevice.js
apps/mobile/src/platform/notifications/unregisterNotificationDevice.js
apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx
apps/mobile/src/platform/notifications/syncNotificationDevice.test.js
```

### Implementação — ordem obrigatória (C3)

**Passo 1: `requestPushPermission.js`**

```js
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export async function requestPushPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return { granted: true }

  const { status } = await Notifications.requestPermissionsAsync()
  return { granted: status === 'granted' }
}
```

UX obrigatória (addendum Privacy/Permissions):
- Não chamar no splash screen
- Chamar apenas após login, com pre-prompt explicativo
- O pre-prompt deve existir como componente separado em `NotificationPreferencesScreen`

**Passo 2: `getExpoPushToken.js`**

```js
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'

export async function getExpoPushToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) throw new Error('EAS projectId não configurado em app.config.js')

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  return token
}
```

**Passo 3: `syncNotificationDevice.js`**

```js
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Application from 'expo-application'

export async function syncNotificationDevice({ supabase, userId, token }) {
  const deviceFingerprint = JSON.stringify({
    os: Platform.OS,
    osVersion: Platform.Version,
    deviceModel: Device.modelName,
    appVersion: Application.nativeApplicationVersion,
  })

  return supabase.from('notification_devices').upsert({
    user_id: userId,
    app_kind: 'native',
    platform: Platform.OS,
    provider: 'expo',
    push_token: token,
    device_name: Device.modelName,
    device_fingerprint: deviceFingerprint,
    app_version: Application.nativeApplicationVersion,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'provider,push_token' })
}
```

**Passo 4: `unregisterNotificationDevice.js`**

```js
export async function unregisterNotificationDevice({ supabase, userId, token }) {
  try {
    await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', 'expo')
      .eq('push_token', token)
  } catch {
    // falha silenciosa — logout local deve ocorrer de qualquer forma
  }
}
```

**Passo 5: Integração no bootstrap do app**

No fluxo pós-login (em `Navigation.jsx` ou equivalente):
1. Verificar permissão com `requestPushPermission()`
2. Se concedida: chamar `getExpoPushToken()` → `syncNotificationDevice()`
3. Armazenar token atual em AsyncStorage para uso no logout
4. Configurar handler de notificação com `Notifications.setNotificationHandler()`

Handler de foreground (não deve navegar sem interação):
```js
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
})
```

Handler de tap (background/cold start):
```js
Notifications.addNotificationResponseReceivedListener((response) => {
  const { screen, params } = response.notification.request.content.data?.navigation ?? {}
  if (screen) navigation.navigate(screen, params)
  else navigation.navigate('Today') // fallback obrigatório (spec §10.5)
})
```

**Passo 6: `NotificationPreferencesScreen.jsx`**

Tela acessível via Perfil/Settings. Conteúdo mínimo:
- Pre-prompt com explicação do valor das notificações (se permissão ainda não concedida)
- Seletor de preferência: `telegram` / `mobile_push` / `both` / `none`
- Estado atual da permissão do sistema
- Botão para abrir Configurações do sistema (se permissão negada)
- Idioma: pt-BR coloquial — paridade com web (R-166)
- Labels: "Telegram", "App (push)", "Ambos", "Desativar notificações"

**Passo 7: Testes `syncNotificationDevice.test.js`**

1. Upsert correto com `onConflict: 'provider,push_token'`
2. `platform` reflete `Platform.OS` mockado
3. `is_active: true` sempre no upsert
4. Falha de `unregisterNotificationDevice` não lança exceção

### Regras a aplicar

- R-166: Antes de escrever qualquer texto visível, localizar equivalente web e copiar linguagem
- R-167: Logs de debug em RN DEVEM estar dentro de `if (__DEV__)`
- R-168: Polyfill em `polyfills.js` é permanente — não remover
- AP-H16: Idioma pt-BR (não pt-EU): "Tomar", não "Registar"

### DoD verificável

- [ ] Device real gera linha em `notification_devices` com `provider = 'expo'`
- [ ] Preferência pode ser alterada pela tela de perfil
- [ ] Retorno ao app atualiza `last_seen_at`
- [ ] Logout tenta desativação remota, mas não bloqueia se falhar
- [ ] Tap em notificação (foreground/background/cold start) navega corretamente
- [ ] `npm run validate:agent` verde (web)
- [ ] Testes mobile passam no workspace `apps/mobile`

### Contratos novos a formalizar após sprint

- CON-020: `syncNotificationDevice({ supabase, userId, token })` → Supabase upsert result

---

## Sprint 6.3.5 — Firebase Analytics

### Pré-requisito

Sprint 6.3 mergeado ✅ (device registration + push funcionando)

### Objetivo

Integrar Firebase Analytics ao app mobile para acompanhar comportamento de usuários de teste, métricas de retenção e eventos de conversão. Dados alimentam decisões de produto e validam o beta interno.

### Motivação

O `analyticsService.js` web é local/privacy-first e não oferece visibilidade de sessões, retenção ou funil. Com o beta em Android, o time precisa de métricas reais para iterar: quantos usuários completam onboarding, voltam no dia seguinte, registram doses, etc.

### Branch

```
feature/fase6/sprint-6.3.5-analytics
```

Criada a partir de `main` (após merge do 6.3).

### Decisão de arquitetura

**Firebase Analytics via `@react-native-firebase`** — não `expo-firebase-analytics` (deprecated).

O projeto já possui `google-services-*.json` configurado por perfil (development / preview / production), e EAS Build já lê credenciais via `GOOGLE_SERVICES_JSON_PATH`. A integração Firebase segue o mesmo padrão.

**Plugin Expo necessário:** `@react-native-firebase/app` usa config plugin que injetará `google-services.json` no build nativo automaticamente — sem editar `build.gradle` manualmente.

### Pacotes a instalar

```bash
cd apps/mobile
npx expo install @react-native-firebase/app @react-native-firebase/analytics
```

> ⚠️ Estes pacotes **não são compatíveis com Expo Go** — requerem build customizado via EAS (já em uso).

Verificar peer deps e lockfile antes de commitar (R-158).

### Arquivos a criar

```
apps/mobile/src/platform/analytics/firebaseAnalytics.js
apps/mobile/src/platform/analytics/analyticsEvents.js
apps/mobile/src/platform/analytics/useScreenTracking.js
```

### Arquivos a modificar

```
apps/mobile/app.config.js          (adicionar plugin @react-native-firebase/app)
apps/mobile/src/app/Navigation.jsx (integrar useScreenTracking)
```

### Implementação — ordem obrigatória (C3)

**Passo 1: Plugin no `app.config.js`**

```js
// apps/mobile/app.config.js — seção plugins
plugins: [
  '@react-native-firebase/app',
],
```

O plugin injeta automaticamente `apply plugin: 'com.google.gms.google-services'` e as dependências no `build.gradle`. **Não editar `build.gradle` manualmente.**

**Passo 2: `analyticsEvents.js` — catálogo de eventos**

```js
// apps/mobile/src/platform/analytics/analyticsEvents.js
// Catálogo centralizado de eventos — nunca usar strings literais fora deste arquivo

export const EVENTS = {
  // Onboarding
  ONBOARDING_START: 'onboarding_start',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  ONBOARDING_SKIP: 'onboarding_skip',

  // Autenticação
  LOGIN: 'login',                   // method: 'email' | 'google'
  LOGOUT: 'logout',
  SIGNUP: 'sign_up',                // Firebase reserved — mapeia para funil de conversão

  // Medicamentos
  MEDICINE_ADDED: 'medicine_added',
  MEDICINE_EDITED: 'medicine_edited',
  MEDICINE_DELETED: 'medicine_deleted',

  // Doses
  DOSE_LOGGED: 'dose_logged',       // protocol_id, medicine_name
  DOSE_SKIPPED: 'dose_skipped',

  // Notificações
  NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
  NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',
  NOTIFICATION_PREFERENCE_CHANGED: 'notification_preference_changed', // new_preference
  PUSH_NOTIFICATION_TAPPED: 'push_notification_tapped', // kind: dose_reminder | stock_alert

  // Estoque
  STOCK_ADDED: 'stock_added',
  STOCK_LOW_VIEWED: 'stock_low_viewed',

  // Engajamento
  SCREEN_VIEW: 'screen_view',       // Firebase reserved — screen_name, screen_class
}
```

**Passo 3: `firebaseAnalytics.js` — wrapper seguro**

```js
// apps/mobile/src/platform/analytics/firebaseAnalytics.js
import analytics from '@react-native-firebase/analytics'

export async function logEvent(eventName, params = {}) {
  try {
    await analytics().logEvent(eventName, params)
  } catch {
    // Analytics nunca deve quebrar o fluxo do usuário — falha silenciosa
  }
}

export async function setUserId(userId) {
  try {
    await analytics().setUserId(userId)
  } catch { /* silent */ }
}

export async function setUserProperty(name, value) {
  try {
    await analytics().setUserProperty(name, String(value))
  } catch { /* silent */ }
}

export async function logScreenView(screenName, screenClass) {
  try {
    await analytics().logScreenView({ screen_name: screenName, screen_class: screenClass })
  } catch { /* silent */ }
}
```

**Passo 4: `useScreenTracking.js` — hook automático de telas**

```js
// apps/mobile/src/platform/analytics/useScreenTracking.js
import { useEffect } from 'react'
import { logScreenView } from './firebaseAnalytics'

export function useScreenTracking(screenName, screenClass = screenName) {
  useEffect(() => {
    logScreenView(screenName, screenClass)
  }, [screenName, screenClass])
}
```

Integrar em `Navigation.jsx`: chamar `useScreenTracking(currentView)` quando a view mudar.

**Passo 5: Identificação do usuário pós-login**

No hook `useAuth` ou no fluxo pós-login, após obter `user`:

```js
import { setUserId, setUserProperty } from '@/platform/analytics/firebaseAnalytics'

// Após login bem-sucedido:
await setUserId(user.id)
await setUserProperty('app_env', process.env.EXPO_PUBLIC_APP_ENV || 'development')
```

> Privacy note: `setUserId` envia hash interno ao Firebase — **nunca passar email ou nome**.

**Passo 6: Instrumentar eventos críticos de conversão**

Adicionar `logEvent` nos pontos de conversão mais importantes (prioridade decrescente):

| Localização | Evento | Params |
|-------------|--------|--------|
| Onboarding final step | `ONBOARDING_COMPLETE` | — |
| `useAuth` login | `LOGIN` | `{ method: 'email' }` |
| `useAuth` signup | `SIGNUP` | — |
| `syncNotificationDevice` OK | `NOTIFICATION_PERMISSION_GRANTED` | — |
| `NotificationPreferencesScreen` save | `NOTIFICATION_PREFERENCE_CHANGED` | `{ new_preference }` |
| Push notification tap handler | `PUSH_NOTIFICATION_TAPPED` | `{ kind }` |
| `LogForm` submit OK | `DOSE_LOGGED` | `{ medicine_name }` |
| Medicine CRUD create | `MEDICINE_ADDED` | — |

**Não instrumentar PII**: não logar `dosage`, `medicine_name` com dados sensíveis de saúde além do nome. Não logar `userId` como param de evento (já via `setUserId`).

### Configuração Firebase Console

Os passos abaixo são **dependências humanas** — o agente não pode executá-los:

- [ ] Firebase Console → projeto `meus-remedios-c509e` → Analytics habilitado
- [ ] Google Analytics property vinculada ao projeto Firebase
- [ ] Debug View habilitado para validar eventos durante desenvolvimento
- [ ] Eventos de conversão configurados: `sign_up`, `onboarding_complete`, `dose_logged`

### Builds necessários

Após implementação, gerar novo APK preview para ter o plugin Firebase compilado:

```bash
cd apps/mobile
./build-android.sh preview
```

O build de desenvolvimento também precisa ser regeerado para usar com `expo-dev-client` (não Expo Go).

### Validação

**Firebase DebugView (desenvolvimento):**

```bash
# Habilitar debug mode no device físico (Android)
adb shell setprop debug.firebase.analytics.app com.coelhotv.meusremedios.preview
```

Verificar eventos aparecendo em tempo real: Firebase Console → Analytics → DebugView.

**Checklist de validação manual:**

1. [ ] Fazer login → evento `login` aparece no DebugView
2. [ ] Navegar entre telas → `screen_view` disparado por tela
3. [ ] Conceder permissão de push → `notification_permission_granted`
4. [ ] Registrar dose → `dose_logged`
5. [ ] Mudar preferência de notificação → `notification_preference_changed`

### Regras a aplicar

- R-167: Nenhum `console.log` de analytics fora de `if (__DEV__)`
- R-042: `setUserId` apenas com UUID interno — nunca PII
- R-158: Verificar peer deps antes de `npm install` em workspace mobile

### DoD verificável

- [ ] `@react-native-firebase/app` e `@react-native-firebase/analytics` instalados sem conflito de peer deps
- [ ] Plugin adicionado em `app.config.js`
- [ ] `firebaseAnalytics.js` com fallback silencioso (nunca throw)
- [ ] `EVENTS` catálogo centralizado — zero strings literais fora do catálogo
- [ ] `useScreenTracking` integrado na navegação
- [ ] `setUserId` chamado após login (sem PII)
- [ ] Ao menos 6 eventos de conversão instrumentados (lista do Passo 6)
- [ ] Novo APK preview gerado com build EAS
- [ ] Eventos visíveis no Firebase DebugView em device físico
- [ ] `npm run validate:agent` verde (web não afetado)

### Contratos novos a formalizar após sprint

- CON-021: `logEvent(eventName, params)` → void (nunca throw)
- CON-022: `EVENTS` catálogo é a única fonte de nomes de eventos no mobile

---

## Sprint 6.4 — Migração dos Jobs Principais

### Pré-requisito

Sprint 6.3 mergeado ✅

### Objetivo

Ligar o cron e os jobs mais importantes ao dispatcher. Telegram continua funcionando.

### ⚠️ MAIOR RISCO DA FASE

Esta é a mudança mais arriscada — jobs em produção que enviam lembretes reais.
**Obrigatório:** feature flag de rollback ativa antes de qualquer deploy.

### ⚠️ Pré-condição adicional: decidir estratégia do DLQ multicanal

Antes de implementar este sprint, o agente deve escolher e implementar a integração do DLQ com o dispatcher (gap identificado no Sprint 6.2). Ver detalhes na seção "Gap identificado" ao final do Sprint 6.2.

**Decisão mínima obrigatória:** qual `ErrorCategory` usar para falhas transitórias de Expo e como integrar `enqueue()` no `dispatchNotification`.

### Branch

```
feature/fase6/sprint-6.4-jobs-dispatcher
```

Criada a partir de `main` (após merge do 6.3).

### Arquivos a modificar

```
api/notify.js                          (orquestrador → passa a usar dispatcher)
server/bot/tasks.js                    (checkReminders, checkStockAlerts, runDailyDigest)
```

### Feature flag obrigatória

Em TODOS os jobs migrados:

```js
const USE_DISPATCHER = process.env.USE_NOTIFICATION_DISPATCHER !== 'false'
```

Deploy com `USE_NOTIFICATION_DISPATCHER=true` (default). Se houver problema em produção, o maintainer seta `USE_NOTIFICATION_DISPATCHER=false` no Vercel imediatamente — sem deploy necessário.

**Critério para remoção do fallback:** 2 semanas de operação estável com dispatcher ativo.

### Implementação — ordem obrigatória (C3)

**Passo 1: Criar `notificationDispatcher` singleton em `api/notify.js`**

```js
import { dispatchNotification } from '../server/notifications/dispatcher/dispatchNotification.js'
import { resolveChannelsForUser } from '../server/notifications/policies/resolveChannelsForUser.js'
import { notificationPreferenceRepository } from '../server/notifications/repositories/notificationPreferenceRepository.js'
import { notificationDeviceRepository } from '../server/notifications/repositories/notificationDeviceRepository.js'
import { createExpoClient } from '../server/notifications/channels/expoPushChannel.js'

const repositories = {
  preferences: notificationPreferenceRepository,
  devices: notificationDeviceRepository,
}

export const notificationDispatcher = {
  async dispatch({ userId, kind, data, context }) {
    const payload = buildNotificationPayload({ kind, data })
    const channels = await resolveChannelsForUser({ userId, repositories })
    return dispatchNotification({ userId, kind, payload, channels, context, repositories, expoClient: createExpoClient() })
  }
}
```

**Passo 2: Migrar `checkReminders`**

```js
// server/bot/tasks.js — checkReminders
async function checkReminders({ bot, notificationDispatcher, context }) {
  // ... lógica existente de buscar reminders devidos ...

  for (const reminder of dueReminders) {
    const USE_DISPATCHER = process.env.USE_NOTIFICATION_DISPATCHER !== 'false'

    if (USE_DISPATCHER && notificationDispatcher) {
      await notificationDispatcher.dispatch({
        userId: reminder.userId,
        kind: 'dose_reminder',
        data: { medicineName: reminder.medicineName, protocolId: reminder.protocolId, medicineId: reminder.medicineId },
        context,
      })
    } else {
      // fallback legado — Telegram direto
      await sendTelegramNotification(bot, reminder.chatId, reminder.message)
    }
  }
}
```

**Passo 3: Verificar Telegram via dispatcher**

Testar em staging: reminders devem chegar por Telegram com `preference = 'telegram'` (default).

**Passo 4: Migrar `checkStockAlerts`**

Mesma estrutura: feature flag + dispatch com `kind: 'stock_alert'`.

**Passo 5: Migrar `runDailyDigest`**

Mesma estrutura: feature flag + dispatch com `kind: 'daily_digest'`.

**Passo 6: Testes de regressão**

- Simular cron completo com `USE_DISPATCHER=true` e `preference='telegram'`
- Verificar que mensagem Telegram chega com mesmo conteúdo do legado
- Simular com `preference='mobile_push'` — verificar que device recebe push
- Simular com `preference='both'` — verificar ambos
- Simular com `USE_DISPATCHER=false` — verificar fallback para Telegram direto

**Passo 7: Logs estruturados**

Cada job deve logar (R-087):
```js
logger.info('job_dispatch', { correlationId, userId, kind, channels, result })
```

### Regras a aplicar

- R-087: Logging estruturado com `correlationId` — obrigatório
- R-041: Nunca `process.exit()` em Vercel serverless
- R-086: Sempre `res.status(code).json(body)` em `api/notify.js`
- R-090: Verificar budget de serverless functions antes de qualquer arquivo novo em `api/`
- AP-SL01: Logs de bot em `server/bot/` não aparecem no Vercel — mover logs críticos para `api/notify.js`

### DoD verificável

- [ ] Reminders chegam por Telegram com dispatcher ativo (`USE_DISPATCHER=true`, `preference='telegram'`)
- [ ] Push chega no device com `preference='mobile_push'`
- [ ] `both` entrega em ambos
- [ ] `none` não entrega nada
- [ ] `USE_NOTIFICATION_DISPATCHER=false` faz fallback para Telegram legado (sem push)
- [ ] Logs de dispatch visíveis no Vercel (não apenas no `server/bot/`)
- [ ] `npm run validate:agent` verde

---

## Sprint 6.5 — Beta Interno e Hardening

### Pré-requisito

Sprint 6.4 mergeado ✅ + pelo menos 48h de operação estável em produção com dispatcher

### Objetivo

Distribuir builds reais em iOS e Android e validar em hardware físico.

### Branch

```
feature/fase6/sprint-6.5-beta
```

Criada a partir de `main` (após merge do 6.4).

### Dependências humanas obrigatórias

Antes de iniciar este sprint, confirmar com o maintainer:
- [ ] Apple Developer Program membership ativa
- [x] TestFlight app instalado no device iOS de teste
- [x] Conta Google Play Console com internal testing track configurado
- [x] Device físico iOS disponível para testes
- [x] Device físico Android disponível para testes
- [ ] EAS credentials configuradas para `preview` profile
- [ ] `EXPO_PUSH_TOKEN` (ou equivalente Expo) configurado em ambiente EAS

### Builds

**iOS:**
```bash
cd apps/mobile
eas build --profile preview --platform ios
```

Distribuição: TestFlight interno.

**Android:**
```bash
cd apps/mobile
eas build --profile preview --platform android
```

Distribuição: internal testing track da Play Console.

### Smoke tests obrigatórios (§13.3 da spec base)

Executar sequencialmente em device físico:

1. [ ] Login com conta real
2. [ ] Conceder permissão de notificação quando solicitado
3. [ ] Confirmar inserção em `notification_devices` (verificar Supabase dashboard)
4. [ ] Disparar reminder manualmente (ou aguardar horário programado)
5. [ ] Validar push recebido no device
6. [ ] Mudar preferência para `telegram` na tela de perfil
7. [ ] Validar ausência de push (somente Telegram recebe)
8. [ ] Mudar preferência para `both`
9. [ ] Validar push + Telegram simultâneos
10. [ ] Fazer logout e verificar `is_active = false` em `notification_devices`

**Simulador não fecha esta fase.** Hardware real é obrigatório para o DoD.

### Documentação operacional a criar

```
docs/operations/PUSH_NOTIFICATIONS.md
```

Conteúdo mínimo:
- Como forçar rollback (`USE_NOTIFICATION_DISPATCHER=false` no Vercel)
- Limites do Expo Push free tier (sem limite publicado para < 50 usuários; revisar pós-scale)
- Como diagnosticar token desativado (verificar `is_active` em `notification_devices`)
- Como resetar preferência de usuário

### DoD verificável

- [ ] Ao menos 1 device iOS validado com push real
- [ ] Ao menos 1 device Android validado com push real
- [ ] `preference='none'` respeitado em device real
- [ ] `preference='both'` entrega em ambos em device real
- [ ] Tap em notificação cold start navega corretamente
- [ ] Falha permanente (`DeviceNotRegistered`) desativa token em `notification_devices`
- [ ] Logs de dispatch visíveis no Vercel com `correlationId`
- [ ] `docs/operations/PUSH_NOTIFICATIONS.md` criado
- [ ] `npm run validate:agent` verde

---

## Critérios de Saída da Fase 6

A fase só termina quando TODOS os itens abaixo forem verdadeiros:

- [ ] `user_settings.notification_preference` existe e está sendo usado
- [ ] `notification_devices` existe com RLS adequada
- [ ] Mobile registra device real com `provider = 'expo'`
- [ ] Dispatcher multicanal existe e está em uso
- [ ] Telegram continua funcional
- [ ] Pelo menos `checkReminders` usa o dispatcher
- [ ] Push funciona em iOS e Android reais
- [ ] Tap em notificação leva para rota segura
- [ ] `none` não entrega nada
- [ ] `both` entrega em ambos
- [ ] Falha permanente desativa token
- [ ] Permissão de push respeita UX e copy definidas
- [ ] Build beta interno foi distribuído via TestFlight + Play Console

---

## Regras de Ouro (resumo para agentes coders)

1. **Telegram continua operacional** em todos os sprints — nenhum PR pode degradar reminders
2. `notification_preference` vive em `user_settings` — nunca inferir pela existência de token
3. Tokens push **nunca** em `profiles` — sempre em `notification_devices`
4. Um usuário pode ter **N devices** — não assumir device único
5. O mobile **nunca envia push direto** — apenas registra token; envio é server-side
6. Falha de push **não pode derrubar Telegram**
7. Feature flag `USE_NOTIFICATION_DISPATCHER` é obrigatória em cada job migrado
8. Web push permanece **fora do escopo** desta fase

---

## ADRs a criar antes do Sprint 6.1

### ADR-029 — Dispatcher Multicanal de Notificações

Criar em: `.agent/memory/decisions/mobile_and_platform/ADR-029.md`

```yaml
id: ADR-029
title: Dispatcher Multicanal de Notificações
status: proposed
category: mobile_and_platform
date: 2026-04-17
context: >
  O sistema atual de notificações está acoplado ao Telegram em api/notify.js e
  server/bot/tasks.js. A Fase 6 adiciona push nativo, exigindo arquitetura
  que suporte múltiplos canais sem if/else por canal em cada job.
decision: >
  Criar server/notifications/ com dispatcher, channels, policies, payloads e
  repositories. Jobs produzem evento de domínio normalizado; dispatcher resolve
  canais da preferência do usuário e delega entrega a cada canal.
alternatives_rejected:
  - if/else em api/notify.js (proibido pela spec — mistura preferência com entrega)
consequences:
  - Telegram e push coexistem sem acoplamento
  - Novos canais (ex: SMS) podem ser adicionados sem modificar jobs
  - Testes de integração de canal ficam isolados por arquivo
linked_rules: [R-087, R-042, R-041]
linked_aps: [AP-SL01]
```

### ADR-030 — Feature Flag de Rollback para Migração de Jobs

Criar em: `.agent/memory/decisions/mobile_and_platform/ADR-030.md`

```yaml
id: ADR-030
title: Feature Flag USE_NOTIFICATION_DISPATCHER para Rollback
status: proposed
category: mobile_and_platform
date: 2026-04-17
context: >
  A migração de checkReminders, checkStockAlerts e runDailyDigest para o
  dispatcher é a mudança mais arriscada da Fase 6 — se o dispatcher falhar,
  lembretes param de funcionar para todos os usuários.
decision: >
  Cada job migrado verifica process.env.USE_NOTIFICATION_DISPATCHER !== 'false'.
  Default: true. Fallback: Telegram direto via adapter legado. Remoção do
  fallback somente após 2 semanas de operação estável.
consequences:
  - Rollback imediato sem deploy (apenas env var no Vercel)
  - Código legado permanece por 2 semanas mínimas
  - Custo: ~10 linhas extras por job migrado
linked_rules: [R-041, R-086]
```

---

*Gerado por DEVFLOW Planning — `session_2026W16_h6_planning` — 2026-04-16T23:15:00Z*
*Próxima sessão: `/devflow coding "Sprint 6.1 — banco e contratos"`*
