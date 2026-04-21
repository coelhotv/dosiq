# Exec Spec Hibrido - Fase 6: Push Native e Beta Interno

> **Status:** Exec spec detalhado e prescritivo | 🏗️ Em execução (Sprint 6.5)
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Pre-requisito:** Fase 5 concluida
> **Objetivo da fase:** adicionar notificacoes mobile nativas sem quebrar Telegram, introduzindo arquitetura multicanal real e distribuicao beta interna controlada

---

## 1. Papel desta fase

Esta fase existe para completar a transicao de "app mobile funcional" para "app mobile notificavel e testavel em ambiente real".

Esta fase **faz**:

- modelagem final de preferencia de notificacao em `user_settings`
- criacao da tabela `notification_devices`
- registro, refresh, desativacao e reutilizacao de device tokens
- dispatcher multicanal real
- canal `telegram`
- canal `mobile_push` via Expo Push
- integracao do mobile com permissao e token
- observabilidade minima de entrega/falha
- distribuicao beta interna em iOS e Android

Esta fase **nao faz**:

- web push
- substituicao de Telegram
- reescrita completa de `server/bot/tasks.js`
- refactor estrutural grande do produto web
- App Store production release
- biometria
- HealthKit/Google Fit
- features novas de produto fora de notificacoes

### Leituras complementares obrigatorias

Antes de executar esta fase, o agente deve ler tambem:

- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_TESTING_MOBILE.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_HUMAN_DEPENDENCIES.md`

### Estrategia de rollback para migracao de jobs

A migracao de `checkReminders`, `checkStockAlerts` e `runDailyDigest` para o dispatcher multicanal e a mudanca mais arriscada do projeto — se o dispatcher falhar, lembretes param de funcionar.

**Estrategia obrigatoria de migracao incremental:**

1. **Sprint 1:** Criar dispatcher e canais, mas NAO conectar aos jobs existentes
2. **Sprint 2:** Migrar apenas `checkReminders` (job mais importante) para o dispatcher
3. **Sprint 3:** Manter Telegram funcional via dispatcher (mesmo caminho, nova arquitetura)
4. **Sprint 4:** Adicionar canal `mobile_push` ao dispatcher
5. **Sprint 5:** Migrar demais jobs (`checkStockAlerts`, `runDailyDigest`)

**Rollback por job:** cada job migrado deve ter uma flag de rollback:

```js
// Em cada job migrado:
const USE_DISPATCHER = process.env.USE_NOTIFICATION_DISPATCHER !== 'false'

if (USE_DISPATCHER) {
  await dispatcher.dispatch({ userId, kind, payload, channels })
} else {
  // fallback direto para Telegram (codigo legado)
  await sendTelegramNotification(chatId, message)
}
```

A flag `USE_NOTIFICATION_DISPATCHER` default para `true`. Se houver problema em producao, o maintainer pode desativar imediatamente via env var no Vercel.

**Criterio para remover o fallback:** apos 2 semanas de operacao estavel com dispatcher ativo em todos os jobs.

### Especificacao de `device_fingerprint`

O campo `device_fingerprint` em `notification_devices` e metadado auxiliar para ajudar o usuario a identificar seus dispositivos. NAO e usado como identidade tecnica.

Composicao recomendada:

```js
function generateDeviceFingerprint() {
  return {
    os: Platform.OS,                    // 'ios' | 'android'
    osVersion: Platform.Version,
    deviceModel: Device.modelName,      // expo-device
    appVersion: Application.nativeApplicationVersion, // expo-application
  }
}
```

O fingerprint e armazenado como JSON string no campo `device_name` da tabela `notification_devices`. Nao requer dependencia adicional alem de `expo-device` e `expo-application` (ja incluidos no Expo).

### Limites do Expo Push Service (free tier)

O Expo Push Service nao tem limites publicados para projetos individuais, mas:

- requests sao rate-limited por IP/projeto
- tokens expiram e precisam ser refreshed
- em escala, pode ser necessario migrar para APNs/FCM direto

Para o beta interno (< 50 usuarios), o free tier e suficiente. Registrar como divida tecnica para revisao pos-beta se o projeto escalar.

### Resultado esperado

Ao fim da fase, o projeto deve conseguir:

1. manter Telegram funcional como hoje
2. enviar notificacao push nativa para devices registrados
3. respeitar a preferencia `telegram`, `mobile_push`, `both` ou `none`
4. registrar e invalidar tokens de forma segura
5. operar um beta interno real em iOS e Android

---

## 2. Leitura correta da arquitetura

### 2.1. O erro proibido

O erro mais perigoso desta fase e transformar `api/notify.js` em um `if/else` desta forma:

```js
if (user.hasExpoToken) {
  sendExpo(...)
} else {
  sendTelegram(...)
}
```

Isto esta **proibido** porque:

- mistura preferencia com endereco de entrega
- nao suporta mais de um device por usuario
- nao suporta `both`
- nao suporta tokens inativos
- acopla regra de negocio ao provider tecnico

### 2.2. A arquitetura correta

O projeto precisa sair de:

- notificacoes centradas em Telegram

Para:

- notificacoes centradas em **evento de dominio + politica de canais + endpoints ativos**

Fluxo obrigatorio:

1. job identifica um evento de dominio notificavel
2. evento vira payload normalizado
3. politica resolve canais habilitados para o usuario
4. dispatcher chama cada canal
5. canal entrega para seus endpoints
6. resultado e registrado
7. falhas invalidam device quando apropriado

---

## 3. Regras de ouro da fase

### R6-001. Telegram continua operacional

Nenhum PR desta fase pode degradar:

- reminders por Telegram
- digest diario
- alertas de estoque
- relatarios/alertas que hoje usam o bot

### R6-002. `notification_preference` e obrigatorio

Nao inferir preferencia a partir da existencia de token.

Preferencia do usuario vive em `user_settings`.

### R6-003. Devices vivem em tabela propria

Tokens push **nao** podem ser salvos em:

- `profiles`
- `auth.users`
- coluna avulsa de `user_settings`

### R6-004. Um usuario pode ter varios devices

Toda implementacao deve assumir:

- 1 usuario -> N devices
- 1 usuario -> iOS e Android ao mesmo tempo
- 1 usuario -> app reinstalado e token trocado

### R6-005. O mobile nunca envia push direto

O app mobile apenas:

- pede permissao
- obtem token
- registra token no backend/Supabase

O envio efetivo sai sempre do backend/cron.

### R6-006. Falha de push nao pode derrubar Telegram

Se o canal `mobile_push` falhar, o canal `telegram` ainda precisa funcionar quando a preferencia permitir.

### R6-007. Web push permanece fora desta fase

Mesmo que a tabela aceite `app_kind = 'pwa'` e `provider = 'webpush'`, esta fase **nao** implementa entrega web push.

### R6-008. Beta interno e parte da fase

Nao considerar a fase concluida sem:

- build instalavel de iOS
- build instalavel de Android
- testes reais de notificacao em devices fisicos

### R6-009. Tocar na notificacao deve navegar de forma segura

Push entregue sem roteamento correto e implementacao incompleta.

Esta fase deve cobrir:

- foreground
- background
- cold start
- usuario deslogado com pending intent

### R6-010. UX de permissao e compliance sao parte do escopo

Nao basta pedir permissao do sistema.

Esta fase deve respeitar:

- pre-prompt honesta
- copy coerente
- logs sanitizados
- ausencia de payload clinico excessivo em telemetria/log

### R6-011. Beta interno deve usar os profiles de release engineering

Build de beta nao pode nascer de comando improvisado e nao reproduzivel.

---

## 4. Escopo exato da fase

## 4.1. Entram obrigatoriamente

- migration SQL de preferencia em `user_settings`
- migration SQL da tabela `notification_devices`
- contrato de repositorio para devices
- integracao `expo-notifications`
- registro de token ao logar e ao abrir o app
- refresh seguro de token
- logout com desativacao local/remota quando aplicavel
- dispatcher multicanal
- canal Telegram adaptado para nova arquitetura
- canal Expo Push
- logs estruturados de entrega
- invalidacao de device em erro permanente
- tratamento de tap em notificacao
- comportamento definido para foreground/background/cold start
- pre-prompt de permissao
- beta interno iOS + Android

## 4.2. Entram se forem pequenos e diretamente necessarios

- tela simples de preferencia de notificacao em mobile
- tela simples de diagnostico de push para ambiente interno
- utilitario de deduplicacao por evento

## 4.3. Nao entram

- inbox de notificacoes
- centro de notificacoes no app
- web push
- analytics sofisticado de abertura de notificacao (inbox, centro de notificacoes)
- segmentacao complexa por tipo de evento (BigQuery, Data Studio)
- multiplos providers de push alem de Expo

---

## 5. Estrutura alvo obrigatoria

```text
server/
  notifications/
    dispatcher/
      dispatchNotification.js
    channels/
      telegramChannel.js
      expoPushChannel.js
    policies/
      resolveChannelsForUser.js
    payloads/
      buildNotificationPayload.js
    repositories/
      notificationPreferenceRepository.js
      notificationDeviceRepository.js
    utils/
      normalizeChannelResults.js
      shouldDeactivateDevice.js
apps/mobile/src/
  platform/
    notifications/
      requestPushPermission.js
      getExpoPushToken.js
      syncNotificationDevice.js
      unregisterNotificationDevice.js
    analytics/
      firebaseAnalytics.js
      analyticsEvents.js
      useScreenTracking.js
  features/
    profile/
      screens/
        NotificationPreferencesScreen.jsx
supabase/
  migrations/
    20xxxxxx_add_notification_preference_to_user_settings.sql
    20xxxxxx_create_notification_devices.sql
```

### Regra

Os nomes podem variar pouco, mas a separacao por responsabilidades e obrigatoria.

Esta proibido:

- colocar toda a logica em `api/notify.js`
- colocar toda a logica em `server/bot/tasks.js`
- colocar a logica de token dentro de componentes de tela sem camada de plataforma

---

## 6. Modelo de dados obrigatorio

## 6.1. Migration de `user_settings`

SQL minimo:

```sql
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

### Regra

Nao usar enum Postgres nesta fase se a base atual usa majoritariamente `text + check`.

Objetivo:

- reduzir friccao de migration
- manter padrao coerente com schema existente

## 6.2. Migration de `notification_devices`

SQL minimo:

```sql
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
```

### Indices obrigatorios

```sql
CREATE INDEX IF NOT EXISTS idx_notification_devices_user_id
ON notification_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_devices_active_provider
ON notification_devices (is_active, provider);
```

## 6.3. RLS obrigatorio

Se a app mobile registrar devices via cliente autenticado, aplicar RLS minima:

```sql
ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification devices"
ON notification_devices
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification devices"
ON notification_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification devices"
ON notification_devices
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Regra

Se houver necessidade de operacao administrativa server-side, usar service role fora do cliente.

---

## 7. Contratos obrigatorios de dominio

## 7.1. Tipos de canal

Representacao minima:

```js
export const NOTIFICATION_CHANNELS = {
  TELEGRAM: 'telegram',
  MOBILE_PUSH: 'mobile_push',
}
```

## 7.2. Contrato do dispatcher

```js
export async function dispatchNotification({
  userId,
  kind,
  payload,
  channels,
  context,
}) {}
```

### Semantica obrigatoria

- `kind`: tipo de notificacao de dominio
- `payload`: titulo, corpo, metadados e deep link normalizados
- `channels`: lista final resolvida pela politica
- `context`: correlation id, origem do job e metadados observaveis

## 7.3. Contrato dos canais

```js
export async function sendTelegramNotification({ userId, payload, context }) {}
export async function sendExpoPushNotification({ userId, payload, context }) {}
```

### Retorno obrigatorio

```js
{
  channel: 'mobile_push',
  success: true,
  attempted: 2,
  delivered: 2,
  failed: 0,
  deactivatedTokens: [],
  errors: [],
}
```

---

## 8. Arquitetura detalhada do backend

## 8.1. `buildNotificationPayload`

Funcao responsavel por transformar evento de dominio em payload canonico.

Exemplo:

```js
export function buildNotificationPayload({ kind, data }) {
  switch (kind) {
    case 'dose_reminder':
      return {
        title: 'Hora do seu remedio',
        body: `Tome ${data.medicineName} agora`,
        deeplink: `meusremedios://today?protocolId=${data.protocolId}`,
        metadata: {
          protocolId: data.protocolId,
          medicineId: data.medicineId,
        },
      }
    default:
      throw new Error(`Unsupported notification kind: ${kind}`)
  }
}
```

### Regra

`server/bot/tasks.js` nao deve montar string final de Telegram e string final de push em paralelo.

Ele deve produzir evento/payload normalizado.

## 8.2. `resolveChannelsForUser`

Responsabilidade:

- ler `user_settings.notification_preference`
- verificar se usuario tem Telegram conectado
- verificar se ha devices ativos `provider = 'expo'`
- decidir canais finais

Exemplo:

```js
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

### Regra

Canal ausente nao e erro fatal.

Exemplo:

- preferencia = `both`
- Telegram conectado
- nenhum device ativo

Resultado:

- envia so em `telegram`

## 8.3. `telegramChannel`

O canal Telegram deve encapsular o adapter atual.

Implementacao alvo:

- reaproveitar adapter/fetch para Telegram
- receber payload canonico
- converter para texto Telegram no proprio canal
- retornar resultado padronizado

### Proibido

- continuar chamando bot adapter direto de todos os jobs apos o dispatcher existir

## 8.4. `expoPushChannel`

Responsabilidade:

- buscar devices ativos `provider = 'expo'`
- enviar lote de mensagens para Expo
- mapear resposta por token
- desativar device em erro permanente

Exemplo de shape:

```js
export async function sendExpoPushNotification({ userId, payload, context, repositories, expoClient }) {
  const devices = await repositories.devices.listActiveByUser(userId, 'expo')
  if (devices.length === 0) {
    return {
      channel: 'mobile_push',
      success: true,
      attempted: 0,
      delivered: 0,
      failed: 0,
      deactivatedTokens: [],
      errors: [],
    }
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

### Regra

Nao espalhar chamadas HTTP para Expo pelo codigo.

Criar um client/adapter unico de provider.

## 8.5. `dispatchNotification`

Fluxo minimo:

1. resolver canais
2. enviar para cada canal habilitado
3. consolidar resultados
4. logar sucesso/falha
5. nunca explodir um canal por causa do outro

Exemplo:

```js
export async function dispatchNotification(input) {
  const results = []

  for (const channel of input.channels) {
    try {
      if (channel === 'telegram') {
        results.push(await sendTelegramNotification(input))
      }
      if (channel === 'mobile_push') {
        results.push(await sendExpoPushNotification(input))
      }
    } catch (error) {
      results.push({
        channel,
        success: false,
        attempted: 0,
        delivered: 0,
        failed: 0,
        deactivatedTokens: [],
        errors: [{ message: error.message }],
      })
    }
  }

  return normalizeChannelResults(results)
}
```

---

## 9. Como integrar com o cron atual

## 9.1. Regra de transicao

`api/notify.js` pode continuar como entrypoint do cron.

O que deve mudar:

- ele para de ser "executor Telegram"
- ele vira "orquestrador de jobs de notificacao"

## 9.2. Refactor correto

Hoje:

- `checkReminders(bot, context)`

Evolucao recomendada:

```js
await checkReminders({
  notificationDispatcher,
  context,
})
```

Ou, em transicao controlada:

```js
await checkReminders({
  telegramBotAdapter: legacyBotAdapter,
  notificationDispatcher,
  context,
})
```

### Regra

Se um job ainda nao foi migrado para payload/dispatcher, ele pode permanecer legacy temporariamente.

Mas os jobs que forem tocados nesta fase devem sair em direcao ao novo modelo.

## 9.3. Ordem recomendada de migracao de jobs

Migrar primeiro:

1. `checkReminders`
2. `checkStockAlerts`
3. `runDailyDigest`

Migrar depois:

4. `checkTitrationAlerts`
5. `checkAdherenceReports`
6. `checkMonthlyReport`

Motivo:

- reminders e o caso de uso critico
- estoque e digest aumentam cobertura sem explodir escopo

---

## 10. Integracao obrigatoria no mobile

## 10.1. Dependencias e bootstrap

O app mobile deve integrar `expo-notifications` somente nesta fase.

No bootstrap:

- configurar handler de notificacao
- pedir permissao em momento controlado
- obter token somente para usuario autenticado

### UX obrigatoria de permissao

O fluxo deve seguir o addendum de privacy/permissoes:

1. explicacao curta do valor da notificacao
2. CTA explicito
3. permissao do sistema
4. reflexo do estado na UI

### Regra

Nao pedir permissao no splash screen sem contexto.

Preferencia:

- primeiro app open pos-login
- ou tela explicativa em Perfil/Notificacoes

## 10.2. Registro do token

Fluxo obrigatorio:

1. usuario autenticado abre app
2. app checa permissao
3. se concedida, obtem Expo token
4. app faz upsert do device atual
5. app atualiza `last_seen_at`

Exemplo:

```js
export async function syncNotificationDevice({
  supabase,
  userId,
  token,
  platform,
  appVersion,
  deviceName,
}) {
  return supabase.from('notification_devices').upsert({
    user_id: userId,
    app_kind: 'native',
    platform,
    provider: 'expo',
    push_token: token,
    device_name: deviceName,
    app_version: appVersion,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  }, {
    onConflict: 'provider,push_token',
  })
}
```

### Regra

Se houver `device_fingerprint`, ele deve ser usado como metadado auxiliar, nao como identidade unica exclusiva.

## 10.3. Atualizacao de token

A implementacao deve lidar com:

- token inicial
- token alterado apos reinstalacao
- retorno do app dias depois

Politica minima:

- tentar sync no login
- tentar sync no app foreground inicial
- atualizar `last_seen_at` se token permanecer igual

## 10.4. Logout

Ao fazer logout:

- sessao local deve ser limpa
- o app deve tentar desativar o device atual remotamente

Exemplo:

```js
await supabase
  .from('notification_devices')
  .update({ is_active: false, updated_at: new Date().toISOString() })
  .eq('user_id', userId)
  .eq('provider', 'expo')
  .eq('push_token', token)
```

### Regra

Se a desativacao remota falhar, o logout local ainda deve ocorrer.

## 10.5. Tratamento de notificacao aberta pelo usuario

Esta fase deve implementar o fluxo completo de roteamento da notificacao.

Ao tocar numa notificacao:

- se o app estiver fechado, o intent deve sobreviver ao bootstrap
- se o app estiver em background, a navegacao deve ir para a rota alvo
- se o app estiver aberto, a chegada nao deve arrancar o usuario da tela atual sem interacao

### Contrato obrigatorio

O payload de notificacao deve carregar informacao suficiente para navegacao segura.

Shape minimo recomendado:

```js
{
  kind: 'dose_reminder',
  deeplink: 'meusremedios://today?protocolId=abc',
  navigation: {
    screen: 'Today',
    params: { protocolId: 'abc' }
  }
}
```

### Fallback obrigatorio

Se o payload vier incompleto ou invalido:

- logar erro sanitizado
- navegar para `Today`

---

## 11. Observabilidade e falhas

## 11.1. Logs obrigatorios

Cada dispatch deve registrar:

- `correlationId`
- `userId`
- `kind`
- canais tentados
- canais entregues
- quantidade de tokens desativados
- erros normalizados

## 11.2. Falhas permanentes

Erros permanentes de push devem desativar o device.

Exemplos tipicos:

- `DeviceNotRegistered`
- token invalido
- provider rejeita token definitivamente

Exemplo:

```js
if (ticket.details?.error === 'DeviceNotRegistered') {
  await repositories.devices.deactivateByToken(device.push_token)
}
```

## 11.3. Falhas transitorias

Falhas transitorias **nao** devem desativar o device.

Exemplos:

- timeout
- 5xx do provider
- indisponibilidade temporaria

## 11.4. DLQ Multicanal — Gap Identificado (2026-04-17)

O DLQ existente (`server/services/deadLetterQueue.js`) foi projetado exclusivamente para Telegram:
- `ErrorCategories` mapeia apenas erros HTTP Telegram (400, 401, 403, 429, etc.)
- `enqueue()` e chamado em `tasks.js` apos falha de `bot.sendMessage`
- `sendDLQDigest()` notifica o admin via Telegram

O `dispatchNotification` implementado no Sprint 6.2 **nao integra com o DLQ**. Consequencias:

| Tipo de falha | Tratamento atual | Correto? |
|---|---|---|
| `DeviceNotRegistered` (Expo permanente) | Token desativado via `deactivateByToken` | Sim |
| Timeout de Expo (transitorio) | `failed: 1` no resultado, sem retry | Gap — sem retry |
| Telegram timeout via canal novo (transitorio) | `failed: 1` no resultado, sem retry | Gap — sem retry |
| Telegram legado em `tasks.js` | `enqueue()` chamado, retry disponivel | Sim (path legado) |

**O risco nao existe nos Sprints 6.1-6.3** porque o dispatcher nao e chamado por jobs em producao.
O gap se torna real no Sprint 6.4, quando os jobs forem migrados para o dispatcher.

**Caminhos de solucao — decidir no Sprint 6.4 antes de implementar:**

Opcao A (recomendada): Estender o DLQ atual
- Adicionar ao `ErrorCategories`: `EXPO_RATE_LIMIT`, `EXPO_TRANSIENT`, `EXPO_UNKNOWN`
- Integrar `enqueue()` no `dispatchNotification` para resultados com `success: false` e erro nao-permanente
- Estender `sendDLQDigest` para incluir falhas push (via Telegram admin — ja existente)
- Custo estimado: ~2h

Opcao B: DLQ separado para push
- Nova tabela `failed_push_queue` com schema Expo-especifico
- Operacionaliza dois DLQs distintos
- Custo estimado: ~4h + nova migration SQL
- Recomendado apenas se Opcao A criar conflito de schema irreconciliavel

## 11.5. Deduplicacao

Se um mesmo job puder disparar duplicado no mesmo minuto, criar deduplicacao minima por:

- `userId`
- `kind`
- janela temporal

Se isto ja for resolvido em camada existente, documentar e nao duplicar.

---

## 12. Sprints internos obrigatorios

## Sprint 6.1 - Banco e contratos

### Objetivo

Criar a base de dados e contratos de repositorio sem tocar ainda no envio real.

### Entregas

- migration `notification_preference`
- migration `notification_devices`
- indices
- RLS
- repositorio de preferencias
- repositorio de devices
- testes unitarios de politica de canais

### DoD do sprint

- migrations aplicam sem erro
- leitura/escrita autenticada de devices funciona
- `resolveChannelsForUser` cobre os 4 modos de preferencia

## Sprint 6.2 - Dispatcher e canais

### Objetivo

Introduzir a nova arquitetura no backend de forma incremental.

### Entregas

- `buildNotificationPayload`
- `dispatchNotification`
- `telegramChannel`
- `expoPushChannel`
- normalizacao de resultados
- invalidacao de token permanente

### DoD do sprint

- um teste consegue simular `both`
- Telegram e push podem coexistir
- falha de um canal nao impede o outro

## Sprint 6.3 - Integracao mobile

### Objetivo

Fazer o app mobile registrar o device e manter o token sincronizado.

### Entregas

- integracao `expo-notifications`
- permissao de notificacao
- obtencao de token
- sync de device
- tela simples de preferencia
- logout com tentativa de desativacao

### DoD do sprint

- device real gera linha em `notification_devices`
- preferencia do usuario pode ser alterada
- retorno ao app atualiza `last_seen_at`

## Sprint 6.3.5 - Firebase Analytics

### Objetivo

Integrar Firebase Analytics ao app mobile para acompanhar comportamento de usuarios de teste, metricas de retencao e eventos de conversao. Dados alimentam decisoes de produto e validam o beta interno.

### Motivacao

O `analyticsService.js` web e local/privacy-first e nao oferece visibilidade de sessoes, retencao ou funil entre sessoes. Com o beta ativo em Android, o time precisa de metricas reais para iterar: quantos usuarios completam onboarding, voltam no dia seguinte, registram doses, ativam push, etc.

### Decisao de arquitetura

**`@react-native-firebase/analytics`** via Expo config plugin — nao `expo-firebase-analytics` (deprecated).

Justificativa:
- O projeto ja possui `google-services-*.json` configurado por perfil (development / preview / production)
- EAS Build ja lê credenciais via `GOOGLE_SERVICES_JSON_PATH` (padrao `build-android.sh`)
- O config plugin injeta `apply plugin: 'com.google.gms.google-services'` automaticamente no build nativo — sem editar `build.gradle` manualmente
- Compativel com o fluxo EAS Build ja em uso

> ⚠️ Estes pacotes **nao sao compativeis com Expo Go** — requerem build customizado via EAS (ja em uso).

### Estrutura alvo

```text
apps/mobile/src/
  platform/
    analytics/
      firebaseAnalytics.js       (wrapper seguro com fallback silencioso)
      analyticsEvents.js         (catalogo centralizado de nomes de eventos)
      useScreenTracking.js       (hook para rastreamento automatico de telas)
```

Modificacoes em arquivos existentes:

```text
apps/mobile/app.config.js          (adicionar plugin @react-native-firebase/app)
apps/mobile/src/app/Navigation.jsx (integrar useScreenTracking)
```

### Catalogo de eventos obrigatorios

O catalogo abaixo define os eventos canonicos da fase. Nenhum evento pode ser disparado fora deste catalogo como string literal.

```js
// analyticsEvents.js
export const EVENTS = {
  // Autenticacao
  LOGIN:                              'login',             // Firebase reserved — method: 'email'
  LOGOUT:                             'logout',
  SIGNUP:                             'sign_up',           // Firebase reserved — alimenta funil de conversao

  // Onboarding
  ONBOARDING_START:                   'onboarding_start',
  ONBOARDING_COMPLETE:                'onboarding_complete',
  ONBOARDING_SKIP:                    'onboarding_skip',

  // Medicamentos
  MEDICINE_ADDED:                     'medicine_added',
  MEDICINE_EDITED:                    'medicine_edited',
  MEDICINE_DELETED:                   'medicine_deleted',

  // Doses
  DOSE_LOGGED:                        'dose_logged',       // medicine_name (sem PII clinico)
  DOSE_SKIPPED:                       'dose_skipped',

  // Notificacoes
  NOTIFICATION_PERMISSION_GRANTED:    'notification_permission_granted',
  NOTIFICATION_PERMISSION_DENIED:     'notification_permission_denied',
  NOTIFICATION_PREFERENCE_CHANGED:    'notification_preference_changed', // new_preference
  PUSH_NOTIFICATION_TAPPED:           'push_notification_tapped',        // kind: dose_reminder | stock_alert

  // Estoque
  STOCK_ADDED:                        'stock_added',
  STOCK_LOW_VIEWED:                   'stock_low_viewed',

  // Navegacao (automatico via useScreenTracking)
  SCREEN_VIEW:                        'screen_view',       // Firebase reserved — screen_name, screen_class
}
```

### Regras de privacidade — obrigatorias

1. `setUserId` recebe apenas o UUID interno do usuario — nunca email, nome ou qualquer PII
2. Nomes de medicamentos podem aparecer apenas como `medicine_name` em eventos de uso direto (`dose_logged`, `medicine_added`) — sem dosagem, sem diagnostico
3. Nenhum evento deve carregar `user_id` como parametro (ja registrado via `setUserId`)
4. Propriedades de usuario aceitas: `app_env` (development/preview/production), `notification_preference`
5. Logs de analytics em `__DEV__` apenas (R-167)

### Wrapper de seguranca — padrao obrigatorio

```js
// firebaseAnalytics.js
export async function logEvent(eventName, params = {}) {
  try {
    await analytics().logEvent(eventName, params)
  } catch {
    // Analytics nunca deve quebrar o fluxo do usuario — falha silenciosa
  }
}
```

O mesmo padrao try/catch silencioso se aplica a `setUserId`, `setUserProperty` e `logScreenView`.

### Eventos de conversao priorizados (instrumentar nesta ordem)

| Prioridade | Localizacao | Evento | Params |
|------------|-------------|--------|--------|
| 1 | `useAuth` login | `LOGIN` | `{ method: 'email' }` |
| 2 | `useAuth` signup | `SIGNUP` | — |
| 3 | Onboarding final step | `ONBOARDING_COMPLETE` | — |
| 4 | `syncNotificationDevice` OK | `NOTIFICATION_PERMISSION_GRANTED` | — |
| 5 | `NotificationPreferencesScreen` save | `NOTIFICATION_PREFERENCE_CHANGED` | `{ new_preference }` |
| 6 | Push notification tap handler | `PUSH_NOTIFICATION_TAPPED` | `{ kind }` |
| 7 | `LogForm` submit OK | `DOSE_LOGGED` | `{ medicine_name }` |
| 8 | Medicine CRUD create | `MEDICINE_ADDED` | — |

### Dependencias humanas obrigatorias (nao executaveis por agente)

- [ ] Firebase Console → projeto `dosiq-c509e` → Analytics habilitado
- [ ] Google Analytics property vinculada ao projeto Firebase
- [ ] Debug View ativado para validar eventos durante desenvolvimento
- [ ] Eventos de conversao configurados: `sign_up`, `onboarding_complete`, `dose_logged`

### Pacotes a instalar

```bash
cd apps/mobile
npx expo install @react-native-firebase/app @react-native-firebase/analytics
```

Verificar peer deps e lockfile antes de commitar (R-158).

### Validacao

Habilitar debug mode em device fisico Android:

```bash
adb shell setprop debug.firebase.analytics.app com.coelhotv.meusremedios.preview
```

Verificar eventos em tempo real: Firebase Console → Analytics → DebugView.

### Contratos novos

- CON-021: `logEvent(eventName, params)` → void (nunca throw)
- CON-022: `EVENTS` catalogo e a unica fonte de nomes de eventos no mobile (zero strings literais fora dele)

### DoD do sprint

- `@react-native-firebase/app` e `@react-native-firebase/analytics` instalados sem conflito de peer deps
- Plugin adicionado em `app.config.js`
- `firebaseAnalytics.js` com fallback silencioso em todas as funcoes
- `EVENTS` catalogo centralizado — zero strings literais de evento fora do catalogo
- `useScreenTracking` integrado na navegacao principal
- `setUserId` chamado apos login sem PII
- Ao menos 6 eventos de conversao instrumentados (lista acima)
- Novo APK preview gerado com EAS Build (plugin compilado)
- Eventos visiveis no Firebase DebugView em device fisico
- `npm run validate:agent` verde (app web nao afetado)

---

## Sprint 6.4 - Migracao dos jobs principais

### Objetivo

Ligar o cron e os jobs mais importantes ao dispatcher.

### Entregas

- `checkReminders` via dispatcher
- `checkStockAlerts` via dispatcher
- `runDailyDigest` via dispatcher
- logs estruturados
- testes de regressao para Telegram

### DoD do sprint

- reminders continuam chegando por Telegram
- push chega no device quando habilitado
- `both` entrega em ambos

## Sprint 6.5 - Beta interno e hardening

### Objetivo

Distribuir builds reais e capturar ajustes finais.

### Entregas

- build iOS beta interno
- build Android beta interno
- checklist de QA
- smoke test manual de notificacoes
- documentacao operacional minima

### DoD do sprint

- pelo menos 1 device iOS validado
- pelo menos 1 device Android validado
- preferencia `none` respeitada
- logs suficientes para diagnostico inicial

---

## 13. Testes obrigatorios

## 13.1. Backend

Cobertura minima:

- `resolveChannelsForUser`
- `dispatchNotification`
- `telegramChannel`
- `expoPushChannel`
- `shouldDeactivateDevice`

Casos obrigatorios:

- `telegram` com chat conectado
- `mobile_push` com 2 devices ativos
- `both` com 1 device invalido e Telegram valido
- `none`
- usuario sem endpoints

## 13.2. Mobile

Cobertura minima:

- funcao de sync de device
- parser/mapper de permissao
- preferencia de notificacao

## 13.3. Testes manuais obrigatorios

Executar em device real:

1. login
2. conceder permissao
3. confirmar insercao em `notification_devices`
4. disparar reminder
5. validar push recebido
6. mudar preferencia para `telegram`
7. validar ausencia de push
8. mudar para `both`
9. validar push + Telegram
10. logout

### Regra

Simulador nao encerra esta fase sozinho.

E obrigatorio validar em hardware real.

---

## 14. Distribuicao beta obrigatoria

## 14.1. iOS

Canal aceito:

- TestFlight interno

## 14.2. Android

Canais aceitos:

- internal testing da Play Console
- ou distribuicao controlada equivalente aprovada pelo maintainer

## 14.3. Build profile

Definir profiles claros:

- `development`
- `preview`
- `production`

### Regra

Nao misturar credenciais e endpoints experimentais sem documentacao.

Se houver ambiente unico inicialmente, documentar isso explicitamente.

O beta interno desta fase deve usar preferencialmente:

- `preview`

E nao:

- builds locais ad hoc sem rastreabilidade

---

## 15. O que um agente executor deve fazer, em ordem

1. Ler esta spec inteira antes de abrir o editor.
2. Ler a master spec e confirmar que push so entra nesta fase.
3. Inspecionar `api/notify.js`, `server/bot/tasks.js` e `user_settings`.
4. Implementar banco e repositorios antes de tocar no app mobile.
5. Implementar dispatcher e canais antes de migrar qualquer job.
6. Integrar mobile com permissao e token somente depois do backend existir.
7. Migrar primeiro reminders, depois estoque e digest.
8. Validar Telegram antes de validar push.
9. Rodar testes automatizados.
10. Executar smoke tests em device real.
11. Documentar limites conhecidos.

---

## 16. Criterios de saida da fase

A fase so termina quando todos os itens abaixo forem verdadeiros:

- `user_settings.notification_preference` existe e esta sendo usado
- `notification_devices` existe com RLS adequada
- mobile registra device real com `provider = 'expo'`
- dispatcher multicanal existe e esta em uso
- Telegram continua funcional
- pelo menos reminders usam o dispatcher
- push funciona em iOS e Android reais
- tap em notificacao leva para rota segura
- `none` nao entrega nada
- `both` entrega em ambos
- falha permanente desativa token
- permissao de push respeita UX e copy definidas
- build beta interno foi distribuido

---

## 17. Handoff para a Fase 7

Ao encerrar esta fase, o projeto deve estar nesta situacao:

- web ainda pode estar na raiz
- mobile ja existe e gera valor real
- notificacoes estao desacopladas
- a decisao de mover web para `apps/web` passa a ser estrutural, nao bloqueante

Isto significa que a Fase 7:

- pode acontecer depois
- pode ser adiada
- nunca deve bloquear entrega de valor mobile

---

## 18. Ancoragem e validacao contra a master spec

Checklist de ancoragem obrigatoria:

- Esta spec manteve Telegram como canal ativo e nao como legado descartavel.
- Esta spec usou `user_settings` para preferencia e `notification_devices` para endpoints.
- Esta spec proibiu token em `profiles`.
- Esta spec tratou push native como arquitetura multicanal, nao como remendo em `api/notify.js`.
- Esta spec colocou beta interno dentro da propria fase.
- Esta spec manteve web push fora de escopo.
- Esta spec nao antecipou a migracao para `apps/web`.
- Esta spec foi enriquecida pelos addendums de release engineering, deep links, offline/sync e privacy/permissoes.

Se qualquer implementacao derivada violar um dos itens acima, ela esta desalinhada com a master spec e deve ser corrigida antes do merge.
