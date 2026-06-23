# Tasks — 015 Chatbot IA (Tier 2)

> Ondas RC3/F3. Guard full por onda. POs na spec.md. `[P]`=paralelo, `[USn]`=user story, `[C4]`=gate, `[C5]`=record.

## Onda 1a — Core fetcher + builder + adoção web/server (refactor puro de paridade) [PR-1]

- [ ] T001 [US2] Criar `packages/core/src/chatbot/fetchChatbotContextData.js` — consolida selects (web DashboardContext + server `:138-153`); protocols c/ join `treatment_plan(id,name,emoji,color)`; inclui doseInstances + treatmentPlans. [PO-2]
- [ ] T002 [US2] Criar `packages/core/src/chatbot/buildPatientContext.js` — move lógica de `contextBuilder.js` (filtro ativos R-278, dias-restantes, doses pendentes/atrasadas via splitDayTimeline). SEM grouping ainda. Puro (dateUtils core, sem new Date — R-020). [PO-2]
- [ ] T003 [US2] Zod schema `ChatbotContextData` (CON-028) + export em `packages/core/src/chatbot/index.js` + `packages/core/src/index.js`. [PO-2]
- [ ] T004 [US2] Web `chatbotService.js` adota builder do core; deletar `contextBuilder.js` (preservar reexports de config se houver). Atualizar imports/tests web. [PO-2]
- [ ] T005 [US2] Telegram `chatbotServerService.js` adota builder+fetcher do core; remover `buildServerContext`; passar `doseInstances` (hoje não passa). [PO-2]
- [ ] T006 [US2][P] Testes builder `__tests__/buildPatientContext.test.js` (sem grouping). [PO-2]
- [ ] T007 [US2] Teste paridade `__tests__/parity.test.js` — fixture golden → web-path == server-path (string idêntica). [PO-5]
- [ ] T008 [C4] Guard full: `validate:agent` (web) + testes bot + suíte core verdes; CON-028 honrado; paridade verde.
- [ ] T009 [C4] PO audit: PO-2 + PO-5 fechados com evidência.
- [ ] T010 [C5] CHANGELOG (refactor no-user-impact) + journal + state; PR-1.

## Onda 1b — Plan-grouping [PR-2]

- [ ] T020 [US1] `buildPatientContext` agrupa por `protocol.treatment_plan.name`; protocolo sem plano → "Sem plano"; fallback nome nulo. [PO-1]
- [ ] T021 [US1] Garantir join `treatment_plan` + `treatmentPlans` no fetcher (confirmar selects). [PO-1]
- [ ] T022 [US1][P] Testes grouping (com/sem plano, plano 1-item, nome nulo). [PO-1]
- [ ] T023 [C4] Atualizar teste de paridade (grouping nas 3 superfícies). [PO-5]
- [ ] T024 [C4] Guard full + PO audit (PO-1, PO-5).
- [ ] T025 [C5] CHANGELOG + journal + state; PR-2.

## Onda 2 — Chat mobile e2e [PR-3]

- [ ] T030 [US3] Criar `apps/mobile/src/features/chatbot/` — tela (`FlatList` invertido, `TextInput`, chips "digitando") + navegação/entry-point. [PO-3]
- [ ] T031 [US3] `chatbotService` mobile — fetcher core + `api/chatbot.js` (mesma rota); fuso GMT-3. [PO-3]
- [ ] T032 [US3] Render markdown nativo (paridade #681: negrito, listas `-`/`*`/`+`, itálico) + disclaimer. [PO-3]
- [ ] T033 [US3] AsyncStorage histórico (teto `CHATBOT_MAX_HISTORY`=20) + offline desabilita envio. [PO-3]
- [ ] T034 [US3] FR-012 — fetch-on-open + loading branded "Iniciando IA do dosiq…" + cache por sessão.
- [ ] T035 [US4] Smoke disclaimer/safetyGuard no mobile (server-side intacto, AP-237). [PO-4]
- [ ] T036 [C4] Guard full: `npx expo export` OK + jest mobile + validate:agent web inalterado; PO-3/PO-4.
- [ ] T037 [C5] CHANGELOG + bump mobile (R-221, minor) + store notes + journal + state; PR-3.

## Onda 3 — Paridade & polish [PR-4]

- [ ] T040 [C4] SC-002 rolagem ≥55fps (mobile) — medir.
- [ ] T041 Edge cases offline (3 superfícies) + disclaimer parity final.
- [ ] T042 [C5] Spec status delivered + README + journal; distill se threshold.
