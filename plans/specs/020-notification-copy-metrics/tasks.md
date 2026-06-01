# Tasks: Notification Copy & Engagement Metrics (Wave N3)

**Feature Directory**: `plans/specs/020-notification-copy-metrics`  
**Input**: `spec.md`, `plan.md`, legacy sources  
**Status**: Migrated Draft  

---

## Phase 1: Setup / Preflight

- [ ] **T001** [C1] Criar arquivo de migração SQL `20260601_notification_log_metrics.sql` estendendo a tabela `notification_log` com os novos campos e a FK `dose_instance_id`.
- [ ] **T002** [C1] Aplicar a migração em ambiente local e validar a integridade estrutural do banco.
- [ ] **T003** [C1] Sincronizar o schema Zod canônico em `packages/core/schemas/notificationLogSchema.js` para aceitar os campos de tracking e FK.
- [ ] **T004** [C1] Criar a política RLS no Supabase permitindo que usuários autenticados realizem updates em seus próprios registros de log.

---

## Phase 2: Implementation

### Sprint 1: Refatoração do Dispatcher em Duas Fases
- [ ] **T005** [US2] Modificar o dispatcher central `dispatchNotification.js` para realizar o preflight (criar log em estado `'pending'` contendo `dose_instance_id` antes do envio).
- [ ] **T006** [US2] Enriquecer o payload de envio com o parâmetro `notificationLogId` na metadata do push Expo e do Telegram.
- [ ] **T007** [US2] Implementar a fase final de MarkSent para atualizar o log com o status consolidado de entrega (`'sent'` ou `'failed'`).
- [ ] **T008** [US2] Validar o fail-safe: erros na criação do log inicial não devem travar o envio real do push.

### Sprint 2: Biblioteca de Copy e Anti-Fadiga Determinístico
- [ ] **T009** [US1] Criar a biblioteca `server/bot/notificationCopy.js` com a estrutura de pools de saudações horárias e linhas de streak.
- [ ] **T010** [US1] Implementar a função de hash de seed determinística por (userId, dia) para seleção de mensagens.
- [ ] **T011** [US1] Escrever testes unitários em `notificationCopy.test.js` comprovando determinismo e distribuição saudável de strings.

### Sprint 3: Formatter de Daily Digest Enriquecido e Reminders
- [ ] **T012** [US1] Criar a função `formatDailyDigestMessage` em `server/bot/tasks.js` agrupando instâncias de doses por faixas temporais e planos, aplicando cabeçalhos dinâmicos.
- [ ] **T013** [US1] Substituir todos os textos de notificação estáticos dos formatters existentes por chamadas reativas à biblioteca de copy motivacional.

### Sprint 4: Hooks de Rastreamento de Conversão (Web/Mobile/Telegram)
- [ ] **T014** [US2] Adicionar escuta ao parâmetro de busca `?notif=id` em `apps/web/src/App.jsx` para chamar de forma idempotente a atualização de `opened_at` no Supabase e limpar a URL via `history.replaceState`.
- [ ] **T015** [US2] Integrar o tracking de aberturas no clique do push mobile em `apps/mobile/src/platform/notifications/usePushNotifications.js` populando `opened_at`.
- [ ] **T016** [US2] Modificar handlers de callbacks do bot do Telegram (`doseActions.js`) para persistir `action_taken_at` e o `action_type` correspondente à ação de tomada de dose.

---

## Phase 3: Validation

- [ ] **T017** [C4] Executar testes unitários crítivos: `rtk jest` ou `rtk vitest` para atestar zero regressões nos formatters e dispatcher.
- [ ] **T018** [C4] Rodar `rtk lint` e corrigir eventuais violações de formatação de código.
- [ ] **T019** [C4] Simular fluxo de cliques em push móvel e comprovar a gravação reativa de `opened_at` e `action_taken_at` no Supabase.
- [ ] **T020** [C4] Validar que as políticas RLS bloqueiam tentativas maliciosas de atualização de logs de outros usuários.

---

## Phase 4: DEVFLOW Record (SQP R-221 Checkpoints)

- [ ] **T021** [C5] Classificar o impacto de liberação da feature como **Medium** (altera estrutura crítica de log e fluxos do bot/dispatcher).
- [ ] **T022** [C5] Realizar o bump de versão no core e web incrementando a patch version correspondente.
- [ ] **T023** [C5] Registrar as modificações técnicas no `CHANGELOG.md` na seção `[Unreleased]` em português.
- [ ] **T024** [C5] Gravar os detalhes SQP e a evidência de conclusão no diário final do DEVFLOW C5 (`.agent/memory/journal/`).

---

## Dependencies

- O refatoramento de `dose_instances` precisa estar concluído (já homologado e entregue).

---

## Parallel Opportunities

- A criação da biblioteca de copy e testes unitários de determinismo (Sprint 2) pode ocorrer de forma 100% paralela à refatoração do banco de dados e do dispatcher central (Sprint 1).
