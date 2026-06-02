# Tasks: Modo Consulta (Mobile + Web)

**Feature Directory**: `plans/specs/005-consultation-mode-profile`
**Input**: `spec.md`, `plan.md` · **Status**: Needs Clarification → Dev Ready · **Tier**: 1 (2 se A)

---

## Phase 0 — Decisão + Reality Gates
- [ ] T001 [GATE] **Resolver `[NEEDS CLARIFICATION]`** com o PO: link **A** (live token+rota+migração, R-090) vs **B** (snapshot via `api/share`, recomendado). Registrar a escolha no plan.
- [ ] T002 [C1] Ler `consultationDataService.js` (web) — confirmar a agregação reusável; decidir se extrai p/ `@dosiq/core` (mobile).
- [ ] T003 [C1] **(B)** confirmar contrato de `api/share.js` (`expiresInHours`, retorno URL). **(A)** confirmar budget de funções serverless (R-090) antes de criar rota.

## Phase 1 — Mobile UI (A+B)
- [ ] T004 [US1] `ConsultationModeScreen.jsx` full-screen retrato, contraste ≥7:1, abas (Medicamentos/Histórico/Aderência/Estoque).
- [ ] T005 [US1] Reuso da agregação (web `consultationDataService` ou core extraído).

## Phase 2 — Link (conforme decisão)
- [ ] T006 [US2] **(B)** gerar snapshot (reusa gerador PDF/HTML da 007) → `api/share` TTL 24h → `ShareConsultButton.jsx` (Share nativo).
- [ ] T007 [US2] **(A)** migração `docs/migrations/<data>_consultation_tokens.sql` (tabela+GRANTs+RLS) + rota pública reusando `ConsultationViewRedesign` read-only.

## Phase 3 — Validation (C4)
- [ ] T008 [C4] Contraste ≥7:1 (a11y); expiração 24h funciona (B: 404 pós-TTL; A: RLS).
- [ ] T009 [C4] `rtk lint` + `rtk npm run validate:agent`.
- [ ] T010 [C4] Smoke PO: gerar link, abrir no desktop, validar expiração.

## Phase 4 — Record (C5)
- [ ] T011 [C5] SQP R-221 (minor mobile+web, +core se extração; +DB se A).
- [ ] T012 [C5] events/journal/state; PR; Gemini + aprovação humana.

## Traceability
FR-001/002→T004/T005 · FR-003→T006 · FR-004→T006(B)/T007(A) · FR-005→T007(A)/T002(B).
