# 🔔 Sistema de Notificações & Bot Telegram

**Versão:** 6.0.0  
**Última atualização:** 2026-05-13  
**Status:** Produção (Waves N1, N2, M2.5 & Gate 6 — Arquitetura 3 Camadas Consolidada)

Documentação central do motor de notificações do Dosiq, abrangendo a arquitetura multicanal (Telegram, Push, Web), o sistema de agrupamento inteligente e a lógica de engajamento comportamental.

---

## 📋 Visão Geral

O Dosiq utiliza um **Motor de Notificações Unificado** baseado no princípio **Inbox-First**. Toda e qualquer comunicação com o usuário nasce como um registro no banco de dados e é distribuída por múltiplos canais de acordo com as preferências e a disponibilidade técnica de cada dispositivo.

### Propósitos do Sistema

- **Lembretes de Doses**: Notificações agrupadas por plano de tratamento.
- **Relatórios de Adesão**: Storytelling e nudges comportamentais dinâmicos.
- **Gestão de Estoque**: Alertas preditivos (estoque < 7 dias).
- **Titulação**: Avisos de transição de etapa em protocolos.
- **Interatividade**: Comandos e botões inline no Telegram e App.

---

## 🏗️ Arquitetura do Motor — 3 Camadas

O sistema opera através de um motor desacoplado em **3 Camadas**, garantindo que lógica de negócio, formatação visual e entrega técnica sejam completamente independentes.

```
server/bot/tasks.js (L1)
         │  { kind, data: { raw_domain_fields } }
         ▼
server/notifications/payloads/buildNotificationPayload.js (L2)
         │  { title, body, pushBody, deeplink, actions[], metadata{} }
         ▼
server/notifications/dispatcher/dispatchNotification.js (L3)
         │
         ├── telegramChannel.js     → Telegram Bot API
         ├── expoPushChannel.js     → Expo Push (iOS/Android)
         └── inboxChannel.js        → notification_log (Supabase)
```

### Camada 1 — Business Logic (L1)

**Localização:** `server/bot/tasks.js`, `server/bot/_reminderHelpers.js`, `server/bot/_adherenceHelpers.js`

**Responsabilidade:** Decidir *quem* notificar e *o quê* (dados brutos de domínio).

**Regras:**
- ❌ **Zero formatting**: Nenhum emoji, Markdown, ou string formatada
- ❌ **Zero presentation logic**: Nenhuma decisão de canal ou visual
- ✅ **Dados brutos**: Envia objetos de domínio (`medicineName`, `dosage`, `time`, etc.)
- ✅ **kind + data**: Sempre usa o contrato `{ kind, data }` para o dispatcher

**Exemplo correto:**
```js
await dispatchNotification({
  userId,
  kind: 'dose_reminder',
  data: { medicineName: 'Losartana', dosage: '50mg', time: '08:00', protocolId: 'proto-123' },
  context: { correlationId: 'uuid-...' }
})
```

### Camada 2 — Presentation Layer (L2)

**Localização:** `server/notifications/payloads/buildNotificationPayload.js`, `server/notifications/payloads/_payloadSchemas.js`, `server/notifications/payloads/_payloadBuilders.js`

**Responsabilidade:** Transformar dados brutos em experiência visual rica e validada.

**Regras:**
- ✅ **Centralização**: Mesma "voz" para todos os canais (Telegram, Push, Inbox)
- ✅ **Markdown**: Centraliza escape via `escapeMarkdownV2` para `body`
- ✅ **pushBody**: Sempre produz texto puro sem escapes para Push/Alerts (R-205)
- ✅ **Validação Zod**: Todo payload é validado antes de sair (via `notificationPayloadSchema`)
- ✅ **actions[]**: Botões interativos definidos aqui (take, snooze, skip, details)
- ✅ **metadata whitelist**: Apenas campos em `metadataSchema` são permitidos

**Contrato de saída (notificationPayloadSchema):**
```js
{
  title: string,          // Texto puro — ex: "💊 Losartana (50mg)"
  body: string,           // MarkdownV2 para Telegram / HTML Inbox
  pushBody: string,       // Texto puro para Expo Push / alertas nativos (R-205)
  deeplink: string|null,  // "dosiq://today?protocolId=..." ou null
  actions: ActionItem[],  // Botões interativos: [{ id, label, params }]
  metadata: {
    kind: KindEnum,             // "dose_reminder" | "stock_alert" | ...
    builtAt: string,            // ISO timestamp
    correlationId?: string,     // UUID de rastreabilidade
    details?: Record<string, unknown>,
    navigation?: { screen: string, params: Record<string, unknown> },
    protocolId?: string,
    protocolIds?: string[],
    medicineName?: string,
    planId?: string,
    planName?: string,
    percentage?: number,
    nudge?: string,
  }
}
```

### Camada 3 — Delivery Layer (L3)

**Localização:** `server/notifications/dispatcher/dispatchNotification.js`, `server/notifications/channels/`

**Responsabilidade:** Adaptar o payload canônico para os canais nativos de entrega.

**Regras:**
- ❌ **Zero business logic**: Não decide conteúdo
- ❌ **Zero formatting**: Não aplica Markdown (exceto adapter Telegram para `title` — ver nota)
- ✅ **Multi-canal**: Telegram, Push, Inbox em paralelo
- ✅ **Gate de supressão**: Quiet Hours e Notification Modes
- ✅ **DLQ automático**: Se todos os canais falharem → auto-enfileira

> **Nota (desvio aceito):** O `telegramChannel.js` aplica `escapeMarkdownV2(payload.title)` antes do wrapping `*bold*`. Isso é necessário porque o `title` em L2 é construído com emojis + texto puro (não escapado). Documentado como exceção pragmática do Gate 4; a refatoração para que L2 entregue o title já escapado está planejada para uma wave futura.

---

## 📦 Payload por Kind

| Kind | L1 (dados brutos) | L2 (resultado) |
|:-----|:-----------------|:--------------|
| `dose_reminder` | `medicineName, time, dosage, protocolId` | title + body formatado + action `take/snooze/skip` |
| `dose_reminder_by_plan` | `planName, planId, doses[], hour` | título do plano + lista de doses + action `take_plan` |
| `dose_reminder_misc` | `doses[], hour, protocolIds[]` | "Suas doses agora" + lista + action `take_misc` |
| `stock_alert` | `medicineName, remaining, daysRemaining` | alerta de estoque + deeplink `dosiq://stock` |
| `daily_digest` | `firstName, pendingCount, medicines[]` | resumo rico do dia |
| `adherence_report` | `firstName, percentage, comparison{}` | storytelling + emoji de tendência |
| `monthly_report` | — | fechamento mensal |
| `titration_alert` | `medicineName, currentStage, nextStage` | aviso de titulação |
| `prescription_alert` | `medicineName, endDate, daysRemaining` | alerta de prescrição |
| `dlq_digest` | `failedCount, failures[]` | resumo admin de falhas |

---

## 🧩 Como Adicionar um Novo Kind

Siga estes 6 passos para adicionar um novo tipo de notificação:

### 1. Schema de dados (L1 → L2)

Em `server/notifications/payloads/_payloadSchemas.js`:
```js
// Adicione o schema dos dados brutos que L1 enviará
export const myNewKindDataSchema = z.object({
  field1: z.string(),
  field2: z.number().optional(),
});

// Adicione ao kindSchema
export const kindSchema = z.enum([
  // ... existing kinds ...
  'my_new_kind', // ← aqui
]);
```

### 2. Builder de apresentação (L2)

Em `server/notifications/payloads/_payloadBuilders.js` (ou direto no switch do `buildNotificationPayload.js`):
```js
export function buildMyNewKindPayload(data, context) {
  const parsed = myNewKindDataSchema.safeParse(data);
  if (!parsed.success) throw new Error(`[L2] my_new_kind data inválido`);
  const d = parsed.data;

  return {
    title: `Título limpo sem escapes`,
    body: `*Bold* e _itálico_ para o Telegram`,
    pushBody: `Texto puro para push notifications`,
    deeplink: `dosiq://minha-rota`,
    actions: [{ id: 'details', label: '📋 Ver detalhes', params: { field1: d.field1 } }],
  };
}
```

### 3. Registrar no switch

Em `server/notifications/payloads/buildNotificationPayload.js`, dentro do `switch(kind)`:
```js
case 'my_new_kind':
  specific = buildMyNewKindPayload(data, context);
  break;
```

### 4. Metadados de navegação

Em `buildMetadata()` (mesmo arquivo), adicionar ao mapeamento de navegação se necessário:
```js
} else if (kind === 'my_new_kind') {
  navigation.screen = 'minha-tela';
  navigation.params = { field1: data.field1 };
}
```

### 5. Labels no frontend

Em `apps/web/src/services/api/dlqService.js`, adicionar ao `formatNotificationType`:
```js
my_new_kind: 'Meu Novo Tipo',
```

### 6. Teste unitário

Em `server/notifications/payloads/__tests__/buildNotificationPayload.test.js`:
```js
it('my_new_kind — gera payload correto', () => {
  const payload = buildNotificationPayload({
    kind: 'my_new_kind',
    data: { field1: 'test', field2: 42 },
    context: { correlationId: 'test-id' }
  });
  expect(payload.title).toBeDefined();
  expect(payload.pushBody).not.toMatch(/[*_]/); // Sem Markdown no pushBody
  expect(payload.metadata.kind).toBe('my_new_kind');
});
```

---

## 🔌 Como Adicionar um Novo Canal

Siga estes 5 passos para adicionar um novo canal de entrega (ex: WhatsApp, Email):

### 1. Criar o channel adapter

Em `server/notifications/channels/whatsappChannel.js`:
```js
/**
 * Canal WhatsApp — Adapter L3
 * Recebe payload canônico (L2) e adapta para a API do WhatsApp.
 * Nunca formata conteúdo — apenas mapeia campos.
 */
export async function sendWhatsappNotification({ userId, payload, context, repositories }) {
  const correlationId = context?.correlationId || 'unknown';

  // Adapter: mapeia payload canônico → formato WhatsApp
  const message = {
    to: await getWhatsappContact(userId),
    text: payload.pushBody,  // ← usa pushBody (texto puro), não body (Markdown)
    // payload.actions → botões rápidos do WhatsApp (se suportado)
  };

  // ... enviar e retornar resultado padronizado
  return {
    channel: 'whatsapp',
    success: true,
    // ...
  };
}
```

### 2. Registrar no dispatcher

Em `server/notifications/dispatcher/resolveChannelsForUser.js`:
```js
// Adicionar à lista de canais disponíveis
if (settings.channel_whatsapp_enabled && user.whatsapp_number) {
  channels.push({ type: 'whatsapp', adapter: sendWhatsappNotification });
}
```

### 3. Preferência do usuário

Na tabela `user_settings` (Supabase), adicionar:
```sql
ALTER TABLE user_settings ADD COLUMN channel_whatsapp_enabled boolean DEFAULT false;
```

### 4. Testar o adapter

Criar `server/notifications/channels/whatsappChannel.test.js` com mocks do client e repositório.

### 5. Documentar

Adicionar o canal às tabelas desta documentação (Adaptadores na seção L3, e Canais Explícitos em Preferências).

---

## 🔄 Retry & DLQ

### Fluxo de Retry (`context.isRetry`)

Quando uma notificação falha em todos os canais, ela é enfileirada na `failed_notification_queue` (DLQ). Ao ser re-despachada:

```js
// api/dlq/_handlers/retry.js
await dispatchNotification({
  userId,
  kind: entry.notification_type,
  data: entry.payload,
  context: {
    correlationId: entry.id,
    isRetry: true,           // ← sinaliza ao L2 que é um reenvio
    originalNotificationId: entry.id,
  }
});
```

O builder L2 usa `context.isRetry` para:
- Adicionar prefixo `🔄 Reenvio:` ao título
- Registrar nos metadados que é um retry

> **Regra:** `context.isRetry` é o ÚNICO mecanismo de retry. `data.isRetry` foi removido no Gate 3 (AP-135).

---

## 📨 Tipos de Tarefas Agendadas (`server/bot/tasks.js`)

As tarefas são disparadas por um cron central (`/api/notify`) e processadas com consciência de **Timezone** e **Preferências do Usuário**.

| Tarefa | Gatilho | Descrição |
|--------|---------|-----------| 
| **Dose Reminders** | A cada minuto | Verifica doses agendadas, aplica agrupamento e quiet hours. |
| **Stock Alerts** | 09:00 (Local) | Verifica predição de estoque e alerta se < 7 dias. |
| **Daily Digest** | `digest_time` | Resumo completo do dia para usuários em `digest_morning` mode. |
| **Adherence Report** | Domingos | Relatório semanal com storytelling de engajamento. |
| **Monthly Report** | Dia 1º (Local) | Fechamento mensal de adesão e economia gerada. |
| **Titration Alert** | 08:00 (Local) | Alerta quando um protocolo atinge o dia de troca de dose. |
| **Prescription Alert**| Eventual | Notifica quando uma receita está próxima de vencer. |

---

## ⚙️ Controle e Preferências (Wave N2)

O usuário tem controle granular sobre a experiência de notificações em `user_settings`:

### Modos de Notificação
- **Realtime**: Envio imediato (com agrupamento N1).
- **Digest Morning**: Suprime individuais e envia um único resumo matinal.
- **Silent**: Apenas Inbox (sem push/Telegram).

### Quiet Hours (Não Me Incomode)
Define uma janela (ex: 22:00 às 07:00) onde as notificações externas são suspensas, sendo apenas registradas na Inbox.

### Canais Explícitos
- `channel_mobile_push_enabled`
- `channel_web_push_enabled`
- `channel_telegram_enabled`

---

## 🤖 Bot Telegram: Interface Conversacional

O Telegram funciona como um canal de entrega (Push) e uma interface de ação (Bot).

### Comandos Principais
- `/start <token>`: Vincula a conta do app ao chat do Telegram.
- `/status`: Resumo do tratamento atual.
- `/hoje`: Cronograma de doses para o dia.
- `/estoque`: Status detalhado do armário de medicamentos.
- `/registrar`: Fluxo guiado para log manual de doses.

### Interação por Callbacks
As notificações de dose no Telegram incluem botões interativos:
- **✅ Tomar**: Registra o plano/dose instantaneamente (usa RPCs atômicos).
- **⏭️ Pular**: Ignora a dose com registro de motivo.
- **⏰ Adiar**: Re-agenda o lembrete para 30 minutos depois.

---

## 🛠️ Confiabilidade e Observabilidade

### Resiliência & DLQ
O sistema possui uma camada de proteção contra perda de notificações críticas:

- **Captura Automática (Auto-DLQ)**: O Dispatcher (L3) monitora o sucesso de cada canal. Se todos os canais físicos falharem, a notificação é automaticamente enfileirada na `failed_notification_queue`.
- **Manual Retry Proxy**: O Admin Panel permite o reenvio manual de falhas. Esse reenvio utiliza o Dispatcher, garantindo que o payload seja re-processado pela L2, mantendo consistência visual.
- **Roteamento de Sistema**: Notificações para administradores utilizam o `SYSTEM_USER_ID`, sendo roteadas automaticamente para o chat de administração.

### Rastreabilidade
- **Correlation ID**: Todo dispatch gera um UUID rastreável nos logs da Vercel e Supabase.
- **Status Tracking**: `notification_log` registra `status` (sent, failed, delivered, opened).

### Agrupamento Inteligente (Wave N1)
Para evitar spam de notificações (múltiplos medicamentos no mesmo horário), o sistema aplica **Partição por Plano**:
- **Plano de Tratamento**: ≥2 doses de um plano → 1 notificação nomeada ("Plano Cardio (4 meds)").
- **Sobra Consolidada**: Doses avulsas ou de planos com 1 dose → 1 notificação "Suas doses agora".
- **Dose Individual**: Apenas se for a única dose no minuto.

---

## 🔗 Documentação Relacionada

- [`plans/backlog-notifications/NOTIFICATIONS_ARCHITECTURE_CONSOLIDATION.md`](../../plans/backlog-notifications/NOTIFICATIONS_ARCHITECTURE_CONSOLIDATION.md) — Spec do projeto de consolidação
- [`docs/architecture/DATABASE.md`](DATABASE.md) - Tabelas `notification_log` e `user_settings`
- [`server/BOT README.md`](../../server/BOT%20README.md) - Guia de desenvolvimento local do bot
