# 024 — Node.js 20→22 Upgrade — Tasks

**Spec:** [spec.md](./spec.md)
**Tier:** 1 (Standard)

---

## Fase 1 — Anchor Node 22 + CI Actions (Haiku/low-effort)

- [ ] T001 [US1] Adicionar `engines.node >= 22.0.0` em `package.json`
- [ ] T002 [US1] Criar `.nvmrc` com `22`
- [ ] T003 [US1] Setar NODE_VERSION=22 na Vercel via CLI (prod/preview/dev)
- [ ] T004 [US2] `test.yml` L29: NODE_VERSION `'20'` → `'22'`
- [ ] T005 [US2] `test.yml`: substituir `tj-actions/changed-files@v44` por step git nativo
- [ ] T005b [US2] `test.yml` lint job: adicionar `fetch-depth: 0` ao checkout (requerido pelo git diff nativo)
- [ ] T006 [US2] `gemini-review.yml` L38: NODE_VERSION `'20'` → `'22'`
- [ ] T007 [US2] `gemini-review.yml`: 10× `github-script@v7` → `@v8`
- [ ] T008 [US2] `setup-secrets.yml`: `github-script@v7` → `@v8`
- [ ] T009 [C4] Validar SC-01 a SC-06 (grep outputs)
- [ ] T010 🛑 **HARD STOP Gate 1** — apresentar resumo ao operador

## Fase 2 — Smoke Test Serverless (Sonnet)

- [ ] T011 [US3] Criar `scripts/smoke-server.mjs`
- [ ] T012 [US3] Adicionar `test:smoke-server` em `package.json`
- [ ] T013 [US3] Adicionar step smoke-server em `test.yml`
- [ ] T014 [C4] Validar SC-07 (`node scripts/smoke-server.mjs` → exit 0)
- [ ] T015 🛑 **HARD STOP Gate 2** — apresentar resumo ao operador

## Fase 3 — Validação Full (Sonnet)

- [ ] T016 [C4] `rtk npm run validate:agent` em Node 22 (SC-08)
- [ ] T017 [C4] `rtk npm run build` (SC-09)
- [ ] T018 [C4] `rtk npm run lint` (SC-10)
- [ ] T019 🛑 **HARD STOP Gate 3** — apresentar resumo ao operador

## Fase 4 — SQP + Documentação + C5 (Haiku/low-effort)

- [ ] T020 [C5] Bump version em `apps/web/package.json` (SC-11)
- [ ] T021 [C5] Entrada CHANGELOG.md `[Unreleased]` → `### Infra` (SC-12)
- [ ] T022 [C5] Atualizar R-263 (Node 22)
- [ ] T023 [C5] Atualizar R-264 (smoke em Node 22)
- [ ] T024 [C5] Atualizar `PLAN_SERVER_REGRESSION_COVERAGE.md`
- [ ] T025 [C5] DEVFLOW C5 journal entry + state.json
- [ ] T026 🛑 **HARD STOP Gate 4 (Final)** — apresentar resumo ao operador
- [ ] T027 [C5] Commit + push + PR (após aprovação do operador)

## Parallelism

- [P] T001-T010 (Fase 1) e T011-T015 (Fase 2) podem rodar em paralelo
- T016-T019 (Fase 3) depende de Fase 1 + Fase 2
- T020-T027 (Fase 4) depende de Fase 3
