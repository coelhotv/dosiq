# Tasks for 025 — Correção e Evolução de Notificações e Alarmes

- [x] **T001** [US1] Criar migração SQL para remover default de `notification_preference` e higienizar dados de Telegram inconsistentes
- [x] **T002** [US1] Atualizar comando `/start` em `server/bot/commands/start.js` para setar `channel_telegram_enabled = true` e atualizar `notification_preference`
- [x] **T003** [US3] Atualizar query SQL no notificador para carregar `dosage_per_pill` em `server/bot/_reminderHelpers.js`
- [x] **T004** [US2] Alterar cron `server/bot/_reminderHelpers.js` para realizar a separação física de instâncias críticas e normais
- [x] **T005** [US3] Atualizar schemas do Zod (`doseReminderDataSchema` e correlatos) em `server/notifications/payloads/_payloadSchemas.js` para incluir `critical_alarm` e `dosagePerPill`
- [x] **T006** [US3] Ajustar formatação e copy de lembrete em `server/notifications/payloads/buildNotificationPayload.js`
- [x] **T007** [US3] Configurar som e interrupção corretos no `server/notifications/channels/expoPushChannel.js`
- [x] **T008** [C4] Rodar testes críticos do servidor (`npm run test:critical` ou vitest específico)
- [x] **T009** [US4] Forçar `native_alarm_enabled: true` por padrão para iOS e Android em `registerPushToken.js`
- [x] **T010** [US4] Adicionar fluxo de permissão contextual `enablePushAtIntent` ao `ProtocolFormBody.jsx` ao ativar alarme crítico
- [x] **T011** [US4] Agrupar alarmes do mesmo minuto em um único trigger Notifee em `useAlarmScheduler.js`
- [x] **T012** [US4] Atualizar ações rápidas para tratar registro em lote no `quickDoseRegistration.js`
- [x] **T013** [US4] Atualizar tela cheia do alarme `AlarmFullScreen.jsx` para exibir lista de doses agrupadas e confirmar em lote
- [x] **T013a** [US3/US4] Ajustar o copy de exibição do alarme local no `alarmService.js` (incluindo suporte a plano essencial e doses avulsas essenciais)
- [x] **T014** [C4] Executar testes do app mobile e validar funcionamento dos handlers de doses e lote
- [x] **T015** [C4] Rodar suite completa de validação `rtk npm run validate:agent` e `rtk lint`
- [x] **T016** [C5] Executar bump de versão em `apps/mobile/app.config.js`
- [x] **T017** [C5] Atualizar `CHANGELOG.md` na seção `[Unreleased]` em português
- [x] **T018** [C5] Registrar logs do SQP e DEVFLOW C5 no journal de eventos e weekly journal
- [x] **T019** [C5] Atualizar status da sessão no `.agent/state.json` para `"completed"`

## Fase 3: Evolução dos Relatórios de Adesão no Backend
- [x] **T020** [Server] Criar rascunho de performance para estatísticas em `adherence_stats_approaches.md`
- [x] **T021** [Server] Configurar crons em `alerts.js` para rodar às 9:00 AM e 10:00 AM (estoque)
- [x] **T022** [Server] Ajustar janela de disparo do semanal em `notify.js` para 9:00 AM – 12:00 PM
- [x] **T023** [Server] Mudar `ADHERENCE_REPORT_TIME` e cortes locais em `_adherenceHelpers.js` para `'09:00'`
- [x] **T024** [Server] Implementar filtros de usuários ativos (`protocols.active = true`) e doses vazias (`total = 0`) em `_adherenceHelpers.js`
- [x] **T025** [Server] Ajustar cálculo do diário em `_adherenceHelpers.js` para analisar ontem vs anteontem e mudar `period` para `'ontem'`
- [x] **T026** [Server] Atualizar testes unitários em `tasks.test.js`
- [x] **T027** [C4] Validar todas as alterações executando `rtk lint` e os testes unitários do bot via Vitest

## Correção de Bugs (Smoke Test & Erro Vercel)
- [x] **T028** [Debug] Investigar ZodError no Vercel (confirmado que ocorreu às 08:25, anterior ao merge do PR #646 às 08:27 que adicionou 'snooze' ao actionSchema)
- [x] **T029** [Debug] Investigar por que o agrupamento de doses do mesmo plano gerou push de doses bundle (`dose_reminder_misc`) em vez de plano (`dose_reminder_by_plan`) no device
- [x] **T030** [Mobile] Adicionar `treatment_plan_id` e `treatment_plan:treatment_plans(...)` no select da query `getActiveProtocols` em `dashboardService.js` (mantendo as alterações locais no mobile unstaged)
- [x] **T031** [C4] Rodar testes unitários e linter e verificar estabilidade

## Correções Pós-Review (Fase 4)
- [x] **T032** [Refactor] Substituir a paralelização `Promise.all` em `quickDoseRegistration.js` por um loop sequencial `for...of` para evitar condições de corrida (FIFO estoque)
- [x] **T033** [Refactor] Extrair a verificação duplicada de protocolos ativos em `_adherenceHelpers.js` para o helper `_hasActiveProtocols`
- [x] **T034** [C4] Validar alterações de refatoração nos testes e linter
- [x] **T035** [PR] Publicar Pull Request #647 e obter aprovação do peer review

