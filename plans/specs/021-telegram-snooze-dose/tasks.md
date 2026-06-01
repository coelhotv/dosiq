# Tasks: Telegram Dose Snooze (Telegram Only)

**Feature Directory**: `plans/specs/021-telegram-snooze-dose`  
**Input**: `spec.md`, `plan.md`, legacy sources  
**Status**: Migrated Draft  

---

## Phase 1: Setup / Preflight

- [ ] **T001** [C1] Verificar a presença da coluna `snoozed_until` (`timestamptz`) e `notified_at` (`timestamptz`) na tabela canônica `dose_instances` no Supabase em ambiente local.
- [ ] **T002** [C1] Certificar que o schema de ações canônicas em `packages/core/schemas/actionSchema.js` (ou correspondente) aceita a ação `'snooze'` no seletor Zod de validação.

---

## Phase 2: Implementation

### Sprint 1: Helpers Clínicos e Validação de Elegibilidade
- [ ] **T003** [US1] Criar o arquivo de utilitários `server/bot/_snoozeHelpers.js` contendo a validação de opções de tempo `getAvailableSnoozeOptions` respeitando a janela limite de 120 minutos (2h).
- [ ] **T004** [US1] Implementar a lógica de verificação de elegibilidade `isSnoozeEligible` para protocolos com gaps de fuso adjacentes maiores de 2h, incluindo gap circular e dose única.
- [ ] **T005** [US1] Escrever testes unitários em `snoozeHelpers.test.js` cobrindo todos os cenários clínicos de elegibilidade e janelas horárias.

### Sprint 2: Handlers de Callback do Bot do Telegram
- [ ] **T006** [US1] Registrar os callbacks inline do bot em `server/bot/callbacks/doseActions.js` escutando as chaves curtas `snooze_:` e `snooze_pick:` antes dos tratamentos genéricos de string.
- [ ] **T007** [US1] Implementar a lógica de `handleSnooze` para validar elegibilidade clínica, calcular opções e editar a mensagem inline com o teclado de tempos (15/30/60 min).
- [ ] **T008** [US1] Implementar a lógica de `handleSnoozePick` para persistir o instante em `dose_instances.snoozed_until` e editar a mensagem com a confirmação local de re-alerta (fuso America/Sao_Paulo).

### Sprint 3: Decoração de Payload e Codificação de Canais
- [ ] **T009** [US1] Criar e acionar a função `applySnoozeDecoration` em `buildNotificationPayload.js` para estilizar re-alertas com o cabeçalho `⏰` e linha explicativa de horário original.
- [ ] **T010** [US1] Restaurar o botão `⏰ Adiar` (`snooze`) no array de ações do lembrete individual em `formatDoseReminder` mapeando o callback correto.
- [ ] **T011** [US1] Atualizar `telegramChannel.js` para codificar a ação `'snooze'` no formato seguro de callback de 64 bytes (`snooze_:${doseInstanceId}`).

### Sprint 4: Orquestração no Cron do Servidor
- [ ] **T012** [US1] Implementar a rotina `checkSnoozedDoses` em `_snoozeHelpers.js` para carregar instâncias pendentes vencidas, re-alertar via dispatcher e redefinir timestamps no banco.
- [ ] **T013** [US1] Importar e acionar a rotina `checkSnoozedDoses` no loop principal agendado a cada minuto em `api/notify.js`.

---

## Phase 3: Validation

- [ ] **T014** [C4] Rodar testes unitários em `snoozeHelpers.test.js` garantindo 100% de sucesso.
- [ ] **T015** [C4] Executar `rtk lint` na pasta do bot e do core para assegurar conformidade de estilo.
- [ ] **T016** [C4] Simular adiamento de dose no Telegram, comprovar a edição imediata de mensagens, a gravação de `snoozed_until` no banco e a chegada precisa do re-alerta decorado.
- [ ] **T017** [C4] Validar que o registro de tomada de dose no aplicativo cancela automaticamente o re-alerta do bot.

---

## Phase 4: DEVFLOW Record (SQP R-221 Checkpoints)

- [ ] **T018** [C5] Classificar o impacto de liberação da feature como **Medium** (altera fluxo do bot e loop de cron a cada minuto).
- [ ] **T019** [C5] Efetuar o bump de versão nos arquivos correspondentes.
- [ ] **T020** [C5] Registrar a entrega técnica no `CHANGELOG.md` na seção `[Unreleased]` em português.
- [ ] **T021** [C5] Gravar os detalhes SQP e a evidência de conclusão no diário final do DEVFLOW C5 (`.agent/memory/journal/`).

---

## Dependencies

- O refatoramento de `dose_instances` precisa estar concluído (já homologado e entregue).

---

## Parallel Opportunities

- A escrita de testes unitários e lógica pura dos helpers (Sprint 1) pode ocorrer de forma paralela à modelagem de botões e payloads do bot (Sprint 3).
