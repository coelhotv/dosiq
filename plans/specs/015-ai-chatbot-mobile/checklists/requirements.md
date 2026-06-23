# Requirements Checklist — 015 Chatbot IA (Tier 2)

**Reescrito:** 2026-06-23 (pós-RC3). "Unit tests" da escrita dos requisitos — completude/clareza/
consistência/cobertura/mensurabilidade/rastreabilidade. NÃO testa comportamento.

## Completude
- [x] 3 eixos cobertos (centralizar / contexto plan-aware / port mobile)
- [x] Mobile explícito como greenfield e2e (não port de UI)
- [x] FR-001..012 cobrem fetcher, builder, grouping, mobile, segurança, paridade, UX latência
- [x] Edge cases (plano nulo/órfão, offline, histórico, plano 1-item)
- [x] Migração DB: nenhuma (additivo — selects/join já existem; sem schema change)

## Clareza / Consistência
- [x] FR-010 reconciliado (3 mecanismos: fetcher+builder-puro+Zod) — sem contradição com ceremony
- [x] CON-028 input == saída do fetcher (7 campos) consistente em spec/plan/ADR/contrato
- [x] "(A) client-build" consistente; Telegram=server runtime explicitado
- [x] Forks a deletar nomeados (contextBuilder.js, buildServerContext)

## Cobertura (rastreabilidade FR→PO→task)
- [x] PO-1 (grouping) → US1 → T020-T022
- [x] PO-2 (builder único) → US2 → T001-T006
- [x] PO-3 (mobile e2e) → US3 → T030-T034
- [x] PO-4 (safety) → US4 → T035
- [x] PO-5 (paridade) → SC-007 → T007/T023
- [x] Cada FR mapeia a ≥1 task

## Mensurabilidade
- [x] PO-2/PO-5: comandos (grep 0 refs; teste paridade)
- [x] PO-1: teste core grouping
- [x] PO-3/PO-4: MANUAL com evidência (smoke iOS+Android) + jest mobile
- [x] SC-002: ≥55fps (mensurável)

## Riscos sinalizados
- [x] R1 input divergente (server sem doseInstances) → CON-028 + paridade
- [x] R3 deletar forks → onda 1a refactor puro + validate:agent
- [ ] Confirmar no C1.5/onda: DashboardContext (web) realmente carrega protocols c/ join treatment_plan (senão fetcher supre)
