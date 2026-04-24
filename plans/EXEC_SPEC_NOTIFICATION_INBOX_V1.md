# EXEC SPEC — Central de Avisos v1
**Sprint:** 8.4  
**Tipo:** feature (redesign + schema evolution)  
**Prioridade:** high  
**Estimativa:** 3–4 dias de desenvolvimento  

---

## Contexto

A Central de Avisos (v0) existe como estrutura mas entrega zero valor ao usuário:
- Cada item mostra apenas o **tipo** da notificação ("Lembrete de dose"), não a notificação em si
- Usuários com Telegram + Push recebem **entradas duplicadas** para o mesmo evento
- Todos os itens têm o mesmo ícone (relógio), mesmo CTA ("Ver doses >"), mesmo status ("Enviada")
- O corpo da mensagem (`body`) nunca é persistido — se perde no momento do envio
- `notification_type` e `protocol_id` já existem no banco, mas o frontend não os usa para nada

Esta spec cobre a reescrita completa da camada de dados, servidor e frontend para entregar uma
Central que justifique existir.

---

## Decisão: zerar a tabela

Antes de qualquer deploy da v1, truncar `notification_log` no Supabase:

```sql
TRUNCATE TABLE public.notification_log;
```

**Justificativa:** todos os registros existentes carecem de `body`, `title`, `medicine_name` e
`channels`. Exibi-los na UI v1 produziria itens degradados misturados com itens completos.
O produto está em fase de testes — sem usuários reais afetados.

**A DLQ é independente** — não referenciar `notification_log`. Não precisa ser zerada.

---

## Escopo de entrega

### Camada 1 — Schema do banco (1 migração)
### Camada 2 — Servidor: dispatcher + repositório
### Camada 3 — Schema Zod + tipos compartilhados  
### Camada 4 — Hook de dados (shared-data)
### Camada 5 — Frontend Mobile (NotificationItem + NotificationInboxScreen)
### Camada 6 — Frontend Web (NotificationCard + NotificationList)

---

## Camada 1 — Migração do banco

**Arquivo:** `docs/migrations/20260424_notification_log_v1.sql`

```sql
-- Central de Avisos v1: adicionar campos de conteúdo e unificar canais

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS title          text,
  ADD COLUMN IF NOT EXISTS body           text,
  ADD COLUMN IF NOT EXISTS medicine_name  text,
  ADD COLUMN IF NOT EXISTS protocol_name  text,
  ADD COLUMN IF NOT EXISTS channels       jsonb DEFAULT '[]'::jsonb;

-- Remover sent_at redundante com created_at? Não — sent_at é o timestamp do envio real
-- channels substitui a necessidade de uma linha por canal (AP a documentar)

COMMENT ON COLUMN public.notification_log.title         IS 'Título da notificação conforme enviado ao usuário';
COMMENT ON COLUMN public.notification_log.body          IS 'Corpo completo da mensagem enviada';
COMMENT ON COLUMN public.notification_log.medicine_name IS 'Nome do medicamento no momento do envio (desnormalizado — imutável)';
COMMENT ON COLUMN public.notification_log.protocol_name IS 'Nome do protocolo no momento do envio (desnormalizado — imutável)';
COMMENT ON COLUMN public.notification_log.channels      IS 'Array de canais utilizados e seus resultados: [{channel, status, message_id?}]';

-- Truncar dados v0 (apenas em ambiente com usuários de teste)
TRUNCATE TABLE public.notification_log;
```

**Por que desnormalizar `medicine_name` e `protocol_name`?**  
Se o protocolo for arquivado ou renomeado após o envio, o log deve refletir o que o usuário
viu naquele momento — não o estado atual. Desnormalização intencional (não é schema drift).

---

## Camada 2 — Servidor

### 2.1 `dispatchNotification.js` — unificar log por evento

**Problema atual:** `results.map(...)` cria um insert por canal → duplicatas na inbox.  
**Fix:** um único insert após consolidar todos os canais.

```js
// ANTES (um insert por canal — causa duplicatas)
const logPromises = results.map(async (res) => {
  await notificationLogRepository.create({ ... })
})

// DEPOIS (um insert por evento, canais como array)
const channelResults = results.map((res) => ({
  channel:    res.channel,
  status:     res.success ? 'enviada' : 'falhou',
  message_id: res.channel === 'telegram' ? res.messageId : null,
  tickets:    res.channel === 'mobile_push' ? res.tickets : null,
}))

const overallStatus = results.some(r => r.success) ? 'enviada' : 'falhou'

await notificationLogRepository.create({
  user_id:       userId,
  protocol_id:   payload.metadata?.protocolId ?? null,
  notification_type: kind,
  title:         payload.title,
  body:          payload.body,
  medicine_name: payload.metadata?.medicineName ?? null,
  protocol_name: payload.metadata?.protocolName ?? null,
  status:        overallStatus,
  mensagem_erro: overallStatus === 'falhou' ? results.find(r => !r.success)?.errors?.[0]?.message : null,
  channels:      channelResults,
  provider_metadata: {}, // mantido para compatibilidade, mas channels é a fonte canônica agora
})
```

### 2.2 `notify.js` — passar `protocolName` no metadata

O `medicineName` já existe. Adicionar `protocolName`:

```js
// dose_reminder
metadata: {
  protocolId:   data.protocolId,
  medicineName: data.medicineName,
  protocolName: data.protocolName, // NOVO
  dosage:       data.dosage || 1,
}

// stock_alert
metadata: {
  medicineId:   data.medicineId,
  medicineName: data.medicineName,
}
```

Garantir que o scheduler passa `protocolName` nos jobs de dose_reminder.

### 2.3 `notificationLogRepository.js` — atualizar `create()`

Mapear os novos campos no insert. O `listByUserId` do servidor já tem o JOIN com protocols —
manter para compatibilidade futura mas o cliente usará os campos desnormalizados.

---

## Camada 3 — Schema Zod

**Arquivo:** `packages/core/src/schemas/notificationLogSchema.js`

```js
const baseSchema = {
  user_id:           z.string().uuid(),
  protocol_id:       z.string().uuid().optional().nullable(),
  notification_type: z.string(),
  status:            z.string().default('enviada'),
  sent_at:           z.string().datetime({ offset: true }).optional(),
  title:             z.string().optional().nullable(),           // NOVO
  body:              z.string().optional().nullable(),           // NOVO
  medicine_name:     z.string().optional().nullable(),          // NOVO
  protocol_name:     z.string().optional().nullable(),          // NOVO
  channels:          z.array(z.object({                         // NOVO
    channel:    z.string(),
    status:     z.string(),
    message_id: z.number().optional().nullable(),
    tickets:    z.array(z.unknown()).optional().nullable(),
  })).default([]),
  telegram_message_id: z.number().nullable().optional(),        // mantido (legado)
  mensagem_erro:     z.string().nullable().optional(),
  provider_metadata: z.record(z.string(), z.unknown()).default({}),
};
```

---

## Camada 4 — Hook de dados

**Arquivo:** `packages/shared-data/src/services/createNotificationLogRepository.js`

O `select('*')` já busca todos os campos novos automaticamente após a migração — sem alteração
necessária no SQL. Apenas atualizar o schema de validação (Camada 3).

---

## Camada 5 — Frontend Mobile

### 5.1 `getNotificationIcon` — já correto

O mapper em `packages/core/src/utils/notificationIconMapper.js` já mapeia 5 tipos para
ícones distintos (Clock, Package, AlertTriangle, BarChart2, TrendingUp). Funciona — o problema
era que o componente não estava diferenciando visualmente porque todos têm `notification_type`
populado com `dose_reminder` (único tipo com volume hoje). Com dados ricos, os ícones já vão
variar naturalmente.

### 5.2 `NotificationItem.jsx` — reescrita

**Comportamento por tipo:**

| notification_type | Linha 1 (título)               | Linha 2 (subtítulo)              | CTA                        |
|-------------------|--------------------------------|----------------------------------|----------------------------|
| dose_reminder     | Nome do medicamento            | body ("Está na hora de tomar…")  | "Registrar dose" ou "✓ Tomada às HH:mm" |
| stock_alert       | Nome do medicamento            | body ("está acabando")           | "Ver estoque"              |
| missed_dose       | Nome do medicamento            | body                             | "Registrar atrasada"       |
| daily_digest      | "Resumo do dia"                | body (conteúdo é o valor)        | expansão inline            |
| titration_update  | Nome do protocolo              | body                             | "Ver tratamento"           |
| fallback          | label do mapper                | body (se existir)                | deep link se houver        |

**Status — nova lógica:**
- `status === 'falhou'` → ícone de erro `⚠` discreto no canto superior direito do item (não badge)
- `status === 'enviada'` → nenhum indicador visual (é o estado normal, não precisa ser anunciado)

**Estrutura visual do item:**

```
┌─────────────────────────────────────────────────────────┐
│  [ícone]  Rivotril 0,5mg                     há 8h  [⚠] │  ← linha 1: medicine_name ou protocol_name
│           Está na hora de tomar 1x de Rivotril.         │  ← linha 2: body (2 linhas max, trunca)
│                                    [Registrar dose  >]  │  ← CTA contextual direita
└─────────────────────────────────────────────────────────┘
```

Para `daily_digest` — expansão inline (sem CTA de navegação):

```
┌─────────────────────────────────────────────────────────┐
│  [ícone]  Resumo do dia                      há 8h      │
│           Você tomou 3 de 4 doses hoje. Adesão: 75%.    │
│           [▼ expandir]  (se body for longo)             │
└─────────────────────────────────────────────────────────┘
```

**Props do componente:**

```jsx
NotificationItem({
  notification,     // objeto completo do DB
  onNavigate,       // (routeName) => void
  doseLogs,         // array de medicine_logs — para cruzar se dose foi tomada
})
```

**Lógica de "dose tomada?":**

```js
// Dentro do componente, para dose_reminder:
const wasTaken = doseLogs?.some(log =>
  log.protocol_id === notification.protocol_id &&
  new Date(log.taken_at) > new Date(notification.sent_at)
)
// wasTaken → CTA "✓ Tomada às HH:mm" (sem link, cor muted)
// !wasTaken → CTA "Registrar dose" (link → ROUTES.TODAY)
```

**Agrupamento temporal na FlatList:**

```
Hoje · 3 avisos
  [item] [item] [item]
  
Ontem
  [item] [item]

Esta semana
  [item]
```

### 5.3 `NotificationInboxScreen.jsx` — ajustes

1. **Buscar `medicine_logs` do período** para passar ao `NotificationItem` (cruzamento de dose tomada).
   Usar o hook existente `useTodayData` ou busca direta limitada aos últimos 7 dias.

2. **Gerar `sections`** a partir de `data` para usar `SectionList` em vez de `FlatList`:

```js
function groupByDay(notifications) {
  const today    = startOfDay(new Date())
  const yesterday = subDays(today, 1)
  const sections = { 'Hoje': [], 'Ontem': [], 'Esta semana': [], 'Mais antigos': [] }
  
  for (const n of notifications) {
    const d = new Date(n.sent_at)
    if (d >= today)      sections['Hoje'].push(n)
    else if (d >= yesterday) sections['Ontem'].push(n)
    else if (d >= subDays(today, 7)) sections['Esta semana'].push(n)
    else                 sections['Mais antigos'].push(n)
  }
  return Object.entries(sections)
    .filter(([, items]) => items.length > 0)
    .map(([title, data]) => ({ title, data }))
}
```

3. **Empty state educativo** (já implementado, apenas atualizar copy):
   > "Seus lembretes de dose, alertas de estoque e resumos diários aparecerão aqui."

---

## Camada 6 — Frontend Web

Espelha a lógica do mobile. Mesmas regras de CTA contextual, agrupamento e status.

### 6.1 `NotificationCard.jsx`
- Adicionar `medicine_name`/`protocol_name` como título primário
- `body` como subtítulo (2 linhas, truncado com `line-clamp-2`)
- `daily_digest` → expansível com `<details>` ou estado local `expanded`
- Status badge "Enviada" → remover; ícone `⚠` apenas para `falhou`
- CTA contextual por tipo (mesma tabela da seção 5.2)

### 6.2 `NotificationList.jsx`
- Adicionar separadores de seção temporal ("Hoje", "Ontem", etc.)
- Passar `doseLogs` para `NotificationCard`

---

## Arquivos a modificar

| Arquivo | Tipo de mudança |
|---------|-----------------|
| `docs/migrations/20260424_notification_log_v1.sql` | NOVO |
| `packages/core/src/schemas/notificationLogSchema.js` | EDITAR — novos campos |
| `packages/core/src/utils/notificationIconMapper.js` | EDITAR — sem alteração (já correto) |
| `server/notifications/dispatcher/dispatchNotification.js` | EDITAR — unificar log por evento |
| `server/notifications/repositories/notificationLogRepository.js` | EDITAR — novos campos no insert |
| `api/notify.js` | EDITAR — passar `protocolName` no metadata |
| `apps/mobile/src/features/notifications/components/NotificationItem.jsx` | EDITAR — reescrita visual |
| `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx` | EDITAR — SectionList + doseLogs |
| `apps/web/src/features/notifications/components/NotificationCard.jsx` | EDITAR — reescrita visual |
| `apps/web/src/features/notifications/components/NotificationList.jsx` | EDITAR — seções temporais |

---

## Ordem de execução (C3)

```
1. Migração SQL → executar no Supabase (inclui TRUNCATE)
2. notificationLogSchema.js (Zod) — base para tudo
3. notificationLogRepository.js (servidor) — create() com novos campos
4. dispatchNotification.js — unificar log por evento
5. notify.js — passar protocolName no metadata
6. NotificationItem.jsx (mobile) — reescrita visual
7. NotificationInboxScreen.jsx (mobile) — SectionList + doseLogs
8. NotificationCard.jsx (web) — reescrita visual
9. NotificationList.jsx (web) — seções temporais
```

---

## Acceptance criteria (DoD)

- [ ] Um único registro em `notification_log` por evento, independente do número de canais
- [ ] Usuário com Telegram + Push vê **um item** por notificação, não dois
- [ ] `title`, `body`, `medicine_name`, `protocol_name` persistidos em todos os tipos suportados
- [ ] Ícones distintos por tipo visíveis na lista (relógio/caixa/alerta/gráfico/tendência)
- [ ] `dose_reminder` exibe nome do medicamento como título primário
- [ ] `dose_reminder` exibe CTA "Registrar dose" ou "✓ Tomada às HH:mm" com base em medicine_logs
- [ ] `daily_digest` exibe body completo (expansível se longo), sem CTA de navegação
- [ ] Status "Enviada" removido da UI; `falhou` exibe ícone `⚠` discreto
- [ ] CTA contextual correto para cada tipo (tabela seção 5.2)
- [ ] Lista agrupada por dia: Hoje / Ontem / Esta semana / Mais antigos
- [ ] Empty state com copy educativo sobre o que aparecerá
- [ ] `npm run validate:agent` verde (zero regressões)
- [ ] Tabela `notification_log` truncada antes do deploy v1

---

## Fora de escopo (v1)

- Swipe to dismiss / delete individual
- Filtros por tipo (tabs "Doses / Alertas / Resumos") — volume insuficiente
- Notificações push locais (in-app) ao receber nova notificação enquanto app aberto
- Paginação infinita (limit=30 suficiente por ora)
- Lida / não lida por item individual (o badge de contagem na tab é suficiente)

---

## AP a documentar após entrega (DEVFLOW C5)

- **AP-060:** Uma entrada de log por canal em vez de por evento — causa duplicatas na inbox
  (padrão: `results.map(create)` → deve ser `consolidar canais → create único`)
