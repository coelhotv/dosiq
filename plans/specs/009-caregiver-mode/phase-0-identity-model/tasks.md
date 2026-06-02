# Tasks: Identity & Context Model (Caregiver Mode — Phase 0)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-0-identity-model`
**Epic**: [Modo Cuidador](../EPIC.md) · **Input**: [spec.md](./spec.md), [plan.md](./plan.md)
**Status**: Dev Ready

---

## Phase 0 — Reality Gates (C1)
- [ ] **T001** [C1] **GATE**: confirmar se Supabase **Anonymous Sign-Ins** está disponível/habilitável no projeto; mapear como o claim faz upgrade anônimo→pleno preservando o `uid`.
- [ ] **T002** [C1] **Resolver Open Questions com PO**: X dias de descarte; viabilidade de `auth.users` anônimo.
- [ ] **T003** [C1] Mapear roteamento de cold-start do mobile (onde decidir self vs invite-context).

## Phase 1 — Modelo de conta/contexto (core)
- [ ] **T004** [US2] `provisionPatientAccount()` — cria conta anônima + grava entidades sob o `uid`.
- [ ] **T005** [US3] `claimPatientAccount(code, deviceUid)` — vincula device à conta provisória, **sem migração**.
- [ ] **T006** [US4] `getContexts(accountId)` → `self` + `managed[]`; default ativo = `self`.

## Phase 2 — Cold-start (mobile)
- [ ] **T007** [US1] Garantir cold-start padrão = auto-gestão; fork `[Sou Paciente]/[Sou Cuidador]` **só** em contexto de convite (deeplink/QR). **Não** exibir como 1ª tela universal.

## Phase 3 — Descarte (cron)
- [ ] **T008** [US2] Cron de descarte de contas provisórias + convites não reivindicados em X dias (reusa scheduler; sem função serverless nova).

## Phase 4 — Validation (C4)
- [ ] **T009** [C4] Testes: usuário sem convite nunca vê fork de papel; claim não migra dados (mesmo `uid`); conta self+managed sem cruzamento.
- [ ] **T010** [C4] `rtk lint` + `rtk npm run validate:agent`.

## Phase 5 — Record (C5)
- [ ] **T011** [C5] SQP R-221 (minor core+mobile+infra), bump + CHANGELOG PT.
- [ ] **T012** [C5] events/journal/state; PR; Gemini + aprovação humana (R-060).

## Traceability
FR-001→T007 · FR-002→T004 · FR-003→T005 · FR-004→T005 · FR-005→T008 · FR-006→T006.
