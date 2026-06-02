# Tasks: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`  
**Input**: `spec.md`, `plan.md`  
**Status**: Spec Draft (Wave M2)  

---

## Phase 1: Setup / Preflight

- [ ] T001 [C1] Verificar o funcionamento dos validadores do core (`medicineSchema` e `protocolSchema` atualizados na Spec 023) antes de iniciar as modificações na interface.

---

## Phase 2: Implementation (PWA Web & Mobile Frontend)

- [ ] T002 [US1] Ajustar o select de unidades e o comportamento dinâmico de exibição em `MedicineForm.jsx` (Web).
- [ ] T003 [US1] Sincronizar o comportamento dinâmico de exibição em `MedicineForm.tsx` (Mobile).
- [ ] T004 [US1] Adaptar o formulário de criação de protocolo (`ProtocolForm.jsx`) para exibir o select de `intake_unit` (`gotas`, `ml`, `UI`) de forma condicional para líquidos.
- [ ] T005 [US1] Adaptar o formulário de estoque (`StockForm.jsx`) para exibir inputs numéricos responsivos com hints visuais de frascos/ml para líquidos.
- [ ] T006 [US2] Criar e integrar o banner de aviso visual de fim de frasco no componente `StockAlertInline.jsx` do dashboard.

---

## Phase 3: Implementation (Telegram Bot Webhook)

- [ ] T007 [US3] Atualizar a formatação das mensagens de alarme no dispatcher do bot (`api/notify.js`) utilizando o helper `formatDose`.
- [ ] T008 [US3] Atualizar o callback de confirmação rápida `✅ Tomei` em `server/bot/callbacks/doseActions.js` para registrar decimais e descontar o estoque de forma correta no backend.

---

## Phase 4: Validation (Quality Gates)

- [ ] T009 [C4] Criar testes e2e locais para os formulários de cadastro de medicamentos líquidos, tomadas e compras de estoque.
- [ ] T010 [C4] Validar visualmente o layout responsivo em mobile e o comportamento do Bot no Telegram.
- [ ] T011 [C4] Rodar `rtk npm run validate:agent` e atestar que a suíte completa de testes críticos, linting e produção funciona perfeitamente sem qualquer erro.

---

## Phase 5: DEVFLOW Record

- [ ] T012 [C5] Realizar o checkpoint SQP (R-221) e atualizar os índices do DEVFLOW.
- [ ] T013 [C5] Submeter as alterações de apresentação em PR consolidado para a aprovação final do operador humano ("Never self-merge" R-060).
