# Feature Specification: Notification Copy & Engagement Metrics (Wave N3)

**Feature Directory**: `plans/specs/020-notification-copy-metrics`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-notifications/EXEC_SPEC_WAVE_N3_COPY_METRICS.md`
- `plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md`

---

## Context

Lembretes de medicamentos estáticos geram fadiga rápida no usuário e aumentam a taxa de abandono do tratamento. Para combater esse comportamento, o Revamp de Notificações na Wave N3 introduz:
1. **Copy Variável e Motivacional**: Substituição do texto estático por saudações de blocos horários dinâmicos combinadas com linhas motivacionais que celebram os streaks (dias consecutivos) de tomada de medicação do usuário.
2. **Combate à Repetição Determinística**: Escolha determinística de textos baseada em seed por (userId, dia), evitando que o usuário receba a mesma mensagem motivacional de forma repetitiva em dias consecutivos.
3. **Loop de Engajamento por Ocorrência de Dose**: Rastreamento granular da reação do usuário. Com o refatoramento de `dose_instances`, cada notificação disparada deve se ligar a uma ocorrência de dose específica (`dose_instance_id`), registrando em `notification_log` quando a notificação foi aberta (`opened_at`) e quando a ação correspondente foi realizada (`action_taken_at` e `action_type`).

---

## User Scenarios & Testing

### User Story 1 — Mensagem de Alerta Altamente Motivacional (Priority: P1)
**Why this priority**: Crucial para incentivar a adesão celebrando o esforço de tomadas consecutivas do paciente.  
**Independent Test**: Simular o envio de um lembrete para um usuário que está com streak de 8 dias consecutivos no bloco da manhã e verificar se o título e corpo são gerados com saudações amigáveis e menção honrosa ao 8º dia em sequência de forma correta.

**Acceptance Scenarios**:
1. Given que o usuário possui um streak de 8 dias consecutivos de adesão registrados,  
   When o sistema dispara o lembrete da dose matinal das 08:00,  
   Then a mensagem é enviada contendo uma saudação matinal dinâmica (ex: *"☀️ Bom dia!"*) e a linha motivacional *"🔥 8º dia em sequência — você está mandando bem!"*.

---

### User Story 2 — Rastreamento de Conversão por Push Clicado (Priority: P1)
**Why this priority**: Permite que o paciente e cuidadores visualizem taxas reais de resposta a lembretes e identifiquem momentos de esquecimento sistemático.  
**Independent Test**: Enviar um lembrete push no mobile/web PWA, tocar na notificação recebida, abrir o aplicativo e verificar no banco de dados se a coluna `opened_at` foi preenchida na linha correspondente de `notification_log`.

**Acceptance Scenarios**:
1. Given que uma notificação foi disparada com sucesso e um registro em `notification_log` foi criado em estado `pending` referenciando a `dose_instance_id`,  
   When o usuário clica na notificação push no celular ou navegador,  
   Then o aplicativo intercepta o evento, chama o helper idempotente de tracking e atualiza `opened_at` com o timestamp atual.

---

### User Story 3 — Rastreamento de Ações do Bot no Telegram (Priority: P1)
**Why this priority**: Rastrear de forma granular quais botões de ação do Telegram estão gerando mais engajamento e tomadas rápidas.  
**Independent Test**: Disparar alerta de dose individual no Telegram, clicar no botão de ação inline `✅ Tomar`, verificar se a dose vira `taken` no app e se a tabela `notification_log` popula `action_taken_at` e `action_type = 'take_plan'`.

**Acceptance Scenarios**:
1. Given que um alerta de dose individual foi enviado no chat do Telegram,  
   When o usuário clica em `✅ Tomar` no teclado inline,  
   Then a dose é registrada com sucesso e a linha correspondente do log de notificações grava o instante em `action_taken_at` e a classificação de ação `'take_plan'` em `action_type`.

---

## Edge Cases

- **Streak Quebrado na Véspera**: Se o usuário tinha um streak longo (ex: 15 dias) mas esqueceu de tomar a dose ontem, o sistema deve detectar que o streak foi zerado e enviar uma mensagem motivacional de recomeço: *"💔 Sua sequência de 15 dias foi quebrada — tudo bem, recomeça hoje!"*.
- **Sem Rede no Mobile ao Abrir Push**: Se o usuário tocar no push móvel estando offline, o aplicativo deve enfileirar o evento de tracking de abertura localmente no SQLite / AsyncStorage e sincronizar reativamente na próxima conexão à internet (DLQ).
- **Semantíca de Inbox vs. Push**: Distinguir claramente `read_at` (o usuário abriu a tela de Inbox de Notificações no app) de `opened_at` (o usuário tocou no push ou no botão com CTA na Inbox). Visualizações passivas de digests ou listas não devem popular `opened_at`.

---

## Requirements

### Functional Requirements

- **FR-001**: O banco de dados Supabase deve estender a tabela `notification_log` para incluir as colunas `opened_at`, `action_taken_at`, `action_type` e a chave estrangeira `dose_instance_id` (FK vinculada à tabela canônica `dose_instances`).
- **FR-002**: O dispatcher de notificações (`dispatchNotification.js`) deve operar em 2 fases: fase 1 cria o log em estado `pending` com a FK da instância e injeta o `notificationLogId` no payload; fase 2 efetua o envio e atualiza o status consolidado de entrega.
- **FR-003**: A biblioteca `notificationCopy.js` deve implementar pools contextuais de saudações por faixas de horário (manhã, almoço, tarde, noite, madrugada) e mensagens motivacionais baseadas em streaks.
- **FR-004**: O seletor de textos de `notificationCopy.js` deve utilizar um algoritmo de hash de seed determinística baseada no par (userId, dia) para evitar mensagens idênticas em dias seguidos para o mesmo paciente.
- **FR-005**: O web app (`apps/web`) e o aplicativo móvel (`apps/mobile`) devem possuir rotas e hooks dedicados para interceptar parâmetros de rastreamento (`?notif=id` na web e callback de push no mobile) e chamar de forma idempotente o endpoint de tracking do log.

### Key Entities

- **Notification Log**: Histórico persistido em `notification_log` que agora rastreia de forma atômica o ciclo de vida da mensagem: pending -> enviada/falhou -> aberta (`opened_at`) -> respondida (`action_taken_at`).
- **Action Type**: String enumerada definindo o tipo de resposta do usuário à notificação: `'take_all'`, `'take_plan'`, `'take_misc'`, `'snooze'`, `'skip'`, ou `'opened'`.

---

## Success Criteria

- **SC-001**: Redução da fadiga de copy atestada por pools dinâmicos motivacionais sem repetições consecutivas.
- **SC-002**: Rastreabilidade robusta: 100% dos pushes de dose abertos e respondidos populam as colunas `opened_at` e `action_taken_at` no banco de dados.
- **SC-003**: A política RLS protege a tabela `notification_log`, permitindo que usuários atualizem apenas seus próprios logs.

---

## Assumptions

- O streak de aderência do usuário é lido de forma eficiente a partir de `adherenceService.getCurrentStreak` com base no novo modelo de `dose_instances`.
- O payload de push do Expo e os callbacks inline do Telegram possuem suporte para trafegar o `notificationLogId` sem estourar limites de payload.
