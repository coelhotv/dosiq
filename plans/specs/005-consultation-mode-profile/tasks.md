# Tasks: Modo Consulta + Apresentação (Mobile + Web)

**Feature Directory**: `plans/specs/005-consultation-mode-profile`
**Input**: `spec.md`, `plan.md` · **Status**: Needs Clarification → Dev Ready · **Tier**: 1 (2 se A)

---

## Phase 0 — Decisão + Reality Gates
- [ ] T001 [GATE] **Resolver `[NEEDS CLARIFICATION]` (link web)** com o PO: **C** (sem link, escopo CRUD original — só share nativo) / **B** (snapshot via `api/share`) / **A** (live token+rota+migração, R-090). Registrar no plan.
- [ ] T002 [C1] Ler `consultationDataService.js` (web) — confirmar agregação reusável; decidir extração p/ `@dosiq/core` (mobile).
- [ ] T003 [C1] **(B)** confirmar contrato `api/share.js` (`expiresInHours`). **(A)** confirmar budget serverless (R-090). **(C)** n/a.

## Phase 1 — Modo Consulta (4 tabs)
- [ ] T004 [US1] `ConsultationModeScreen.jsx` (`features/consultation`) full-screen retrato, contraste ≥7:1, **4 tabs** `Meds · Aderência · Prescrições+Titulação · Estoque` (PO-6, **sem Histórico**), footer padBottom 88. Mocks `mock-modoconsulta-*`.
- [ ] T005 [US1] Tab components — `Meds`, `Aderência` (reusa cálculo da 004), `Prescrições+Titulação` (`ConsultationTitrationCard`), `Estoque` (repo Fase 3); via `consultationDataService`/core extraído.

## Phase 2 — Modo Apresentação + Share
- [ ] T006 [US2] `ConsultationPresentationScreen.jsx` full-bleed AAA (PO-7): faixa teal + anel "Excelente" 36px + 3 KPIs + alerta prescrições vencidas + footer de gesto. Mock `mock-modoconsulta-telacheia.png`.
- [ ] T007 [US3] `ShareSheet.jsx` 3 opções: Apresentação (→T006) · **Gerar PDF (→ spec 007)** · Compartilhar sistema (share nativo). Mock `mock-modoconsulta-sharesheet.png`.
- [ ] T008 [US1] Entry point "Modo Consulta" no Perfil hub › Ferramentas (`mock-perfil-entrypoints`).

## Phase 3 — Link desktop (só se B/A)
- [ ] T009 [FR-006] **(B)** snapshot (reusa gerador da 007) → `api/share` TTL 24h → link no share sheet. **(A)** migração `docs/migrations/<data>_consultation_tokens.sql` + rota pública read-only reusando `ConsultationViewRedesign`.

## Phase 4 — Validation (C4)
- [ ] T010 [C4] Contraste ≥7:1; 4 tabs corretas; Modo Apresentação ok; (B/A) expiração 24h.
- [ ] T011 [C4] `rtk lint` + `rtk npm run validate:agent`.
- [ ] T012 [C4] Smoke PO iOS+Android (tabs, apresentação, share; desktop se B/A).

## Phase 5 — Record (C5)
- [ ] T013 [C5] SQP R-221 (minor mobile; +web/core se extração; +DB se A).
- [ ] T014 [C5] events/journal/state; PR; Gemini + aprovação humana.

## Traceability
FR-001/002→T004/T005 · FR-003→T006 · FR-004→T007 · FR-005→T008 · FR-006→T009 (B/A).
