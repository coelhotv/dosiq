# Implementation Plan: Notification Copy & Engagement Metrics (Wave N3)

**Feature Directory**: `plans/specs/020-notification-copy-metrics`  
**Spec**: `spec.md`  
**Legacy Sources**:
- `plans/backlog-notifications/EXEC_SPEC_WAVE_N3_COPY_METRICS.md`
- `plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md`

---

## Summary

Este plano detalha o refatoramento do fluxo e da arquitetura do dispatcher de notificações para operar em duas fases, estendendo o modelo de dados de `notification_log` para se associar com `dose_instances` de forma direta, a criação da biblioteca de copy dinâmico motivacional contra fadiga e os endpoints de rastreamento reativo client-side (web e mobile) baseados em regras RLS.

---

## Technical Context

- **Associação Granular**: Com a tabela `dose_instances` em produção, cada alerta está amarrado a uma instância de dose. O log de notificações deve persistir essa amarração para que relatórios e análises de conversão sejam clinicamente significativos.
- **Ambiente Serverless**: A hospedagem web roda em Vercel Hobby (limite restrito de 12 slots de funções serverless).
- **Decisão Arquitetural de Rastreabilidade**: O endpoint de tracking de aberturas será feito utilizando **chamadas REST diretas ao cliente Supabase com regras RLS restritas**, evitando a criação de rotas API serverless adicionais na Vercel.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **R-020 (Timezone)** | ✅ Pass | `opened_at` e `action_taken_at` serão persistidos como `timestamptz` absolutos (UTC) e manipulados com `parseLocalDate` de `@utils/dateUtils` no client-side para visualização de fuso. |
| **R-090 (Serverless Limit)** | ✅ Pass | Sem criar novas funções serverless na Vercel. Aproveita as políticas RLS do Supabase para fazer update direto nas colunas permitidas. |
| **R-117 (Mobile Performance)** | ✅ Pass | O carregamento de pools e processamento do copy motivacional ocorre em threads desacopladas no backend sem onerar a UI. |
| **R-221 (SQP)** | ✅ Pass | Inclui o bump da versão do core/web e logging no DEVFLOW C5. |

---

## Architecture / Approach

### 1. Extensão do Banco de Dados (Migration SQL)
Criar arquivo de migração SQL:
```sql
ALTER TABLE public.notification_log
  ADD COLUMN opened_at TIMESTAMPTZ,
  ADD COLUMN action_taken_at TIMESTAMPTZ,
  ADD COLUMN action_type TEXT, -- 'opened' | 'take_all' | 'take_plan' | 'take_misc' | 'snooze' | 'skip'
  ADD COLUMN dose_instance_id UUID REFERENCES public.dose_instances(id) ON DELETE SET NULL;

-- Criar índices de performance de query
CREATE INDEX idx_notification_log_dose_instance ON public.notification_log(dose_instance_id);
CREATE INDEX idx_notification_log_opened ON public.notification_log(user_id, opened_at) 
  WHERE opened_at IS NULL;
```
*Sincronizar o schema Zod canônico correspondente (`packages/core/schemas/notificationLogSchema.js`) para aceitar estes novos campos.*

### 2. Refatoração de Duas Fases do Dispatcher (`dispatchNotification.js`)
O dispatcher central de alertas (`server/notifications/dispatcher/dispatchNotification.js`) deve ser re-arquitetado:
- **Fase 1 (Preflight)**: Cria o registro do log na tabela `notification_log` em estado `'pending'` contendo `user_id`, `dose_instance_id` (se informada no contexto), `title` e `body`.
- **Fase 2 (Payload Enrichment)**: Adiciona `notificationLogId = logEntry.id` à metadata do payload. Esse ID será trafegado nos canais (Expo data push e Telegram callbacks).
- **Fase 3 (Dispatch)**: Executa o envio concorrente em todos os canais configurados (`Promise.allSettled`).
- **Fase 4 (Completion/MarkSent)**: Atualiza o log correspondente no banco de dados para o status final (`'sent'` ou `'failed'`), gravando o timestamp `sent_at` e mensagens de erro caso aplicável.
- *Fallback*: Caso a criação inicial do log (Fase 1) falhe por oscilação de rede, o dispatcher ainda executa o envio do push (fail-safe) e tenta criar o log de forma retroativa.

### 3. Biblioteca `notificationCopy.js` e Seed Determinística
Criar o utilitário `server/bot/notificationCopy.js` com suporte a anti-fadiga:
- **Pool de Saudações por Faixas Horárias (`blockOf(hour)`)**:
  - `05:00 - 10:59` -> Morning: *"☀️ Bom dia!"*, *"Comece bem o dia"*, *"Hora dos remédios da manhã"*
  - `11:00 - 13:59` -> Lunch: *"🍽️ Hora do almoço"*, *"Pausa para os medicamentos do almoço"*
  - `14:00 - 17:59` -> Afternoon: *"☕ Boa tarde"*, *"Hora dos remédios da tarde"*
  - `18:00 - 22:59` -> Evening: *"🌆 Hora dos remédios da noite"*, *"Antes de relaxar"*
  - `23:00 - 04:59` -> Night: *"🌙 Última dose do dia"*, *"Antes de dormir"*
- **Seed Determinística**: Implementar uma função de hash simples:
  ```js
  function getSeedHash(userId, dateStr) {
    const stringToHash = `${userId}-${dateStr}`;
    let hash = 0;
    for (let i = 0; i < stringToHash.length; i++) {
      hash = stringToHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }
  ```
  Isso garante que para um mesmo usuário (`userId`) em um mesmo dia local (`dateStr`), a escolha do array de textos seja 100% determinística, mas mude de forma garantida no dia seguinte (anti-repetição consecutiva).
- **Streak Motivacional**:
  - Streak >= 30 dias -> *"🎯 X dias seguidos — você está mandando muito bem!"*
  - Streak >= 7 dias -> *"🔥 Xº dia em sequência — continue firme!"*
  - Streak quebrado na véspera (`previousStreak >= 7`) -> *"💔 Sua sequência de X dias foi quebrada — tudo bem, recomeçamos hoje!"*
  - Streak < 7 dias -> Retorna `null` (omite linha de streak).

### 4. Rastreamento e Políticas RLS no Supabase
- **RLS Policy**:
  ```sql
  CREATE POLICY "users_can_update_own_logs"
    ON public.notification_log FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  ```
- **Helper `markNotificationOpened`**:
  - Utiliza o Supabase Client direto para fazer `UPDATE notification_log SET opened_at = now() WHERE id = $1 AND opened_at IS NULL`.
  - Chamado pelo web router (`App.jsx`) se a URL contiver `?notif=id` (limpando o parâmetro em seguida com `history.replaceState`), e pelo handler móvel `usePushNotifications.js` ao interceptar o clique em push.
- **Telegram Callbacks**:
  - Em `doseActions.js`, as tomadas de dose (`take_`, `take_plan`, `take_misc`) gravam no log correspondente: `action_taken_at = now()` e `action_type = 'take_plan'` (ou correspondente).

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `supabase/migrations/20260601_notification_log_metrics.sql` [NEW] | Migration SQL para estender o log de notificações com FK e trackers | Requisito 3.1 do spec legado |
| `packages/core/schemas/notificationLogSchema.js` | Sincronização do schema Zod canônico com novos campos | Requisito 3.1 do spec legado |
| `server/notifications/dispatcher/dispatchNotification.js` | Refatoramento de duas fases do dispatcher central | Requisito 3.2 do spec legado |
| `server/bot/notificationCopy.js` [NEW] | Biblioteca de pools contextuais de saudações e hashes determinísticos | Requisito 3.3 do spec legado |
| `server/bot/tasks.js` | Injeção do copy dinâmico motivacional e Daily Digest enriquecido | Requisito 3.4 do spec legado |
| `apps/web/src/App.jsx` | Roteamento reativo e tracking de abertura via URL search parameters | Requisito 3.6 do spec legado |
| `apps/mobile/src/platform/notifications/usePushNotifications.js` | Handler de cliques em push mobile injetando tracking no log | Requisito 3.7 do spec legado |
| `server/bot/callbacks/doseActions.js` | Persistência de `action_taken_at` e `action_type` no clique do bot | Requisito 3.8 do spec legado |

---

## Contracts and ADRs

- **ADR-048**: A amarra com `dose_instances` deve ser mantida. Se `dose_instance_id` não for fornecida no trigger do dispatcher (ex: notificação geral ou teaser do cuidador), o campo no log de notificações permanece `null`.
- **R-221 (SQP)**: bumps e changelog em português obrigatórios.

---

## Risks

- **Viés de Distribuição do Hash**: Uma função de hash fraca pode favorecer sempre o mesmo índice do array.
  - *Mitigação*: Testar a distribuição ao longo de 100 seeds consecutivas assegurando que todos os índices do pool de copy sejam selecionados com frequência equilibrada.

---

## Quality Gates

- `rtk lint` deve passar sem erros nas pastas `server/` e `apps/`.
- Teste unitário de determinismo: `notificationCopy.test.js` deve validar que a mesma seed sempre retorna o mesmo texto motivacional.
- Execução de `npm run validate:agent`.
