# 024 — Node.js 20→22 Upgrade — Tasks

**Spec:** [spec.md](./spec.md)
**Tier:** 1 (Standard)

---

## Fase 1 — Anchor Node 22 + CI Actions (Haiku/low-effort)

- [x] T001 [US1] Adicionar `engines.node >= 22.0.0` em `package.json`
- [x] T002 [US1] Criar `.nvmrc` com `22`
- [x] T003 [US1] Setar NODE_VERSION=22 na Vercel via CLI (prod/preview/dev)
- [x] T004 [US2] `test.yml` L29: NODE_VERSION `'20'` → `'22'`
- [x] T005 [US2] `test.yml`: substituir `tj-actions/changed-files@v44` por step git nativo
- [x] T005b [US2] `test.yml` lint job: adicionar `fetch-depth: 0` ao checkout (requerido pelo git diff nativo)
- [x] T006 [US2] `gemini-review.yml` L38: NODE_VERSION `'20'` → `'22'`
- [x] T007 [US2] `gemini-review.yml`: 11× `github-script@v7` → `@v8`
- [x] T008 [US2] `setup-secrets.yml`: `github-script@v7` → `@v8`
- [x] T009 [C4] Validar SC-01 a SC-06 (grep outputs)
- [x] T010 🛑 **HARD STOP Gate 1** — apresentar resumo ao operador

## Fase 2 — Smoke Test Serverless (Sonnet)

- [x] T011 [US3] Criar `scripts/smoke-server.mjs`
- [x] T012 [US3] Adicionar `test:smoke-server` em `package.json`
- [x] T013 [US3] Adicionar step smoke-server em `test.yml`
- [x] T014 [C4] Validar SC-07 (`node scripts/smoke-server.mjs` → exit 0)
- [x] T015 🛑 **HARD STOP Gate 2** — apresentar resumo ao operador

## Fase 3 — Validação Full (Sonnet)

- [x] T016 [C4] `rtk npm run validate:agent` em Node 22 (SC-08)
- [x] T017 [C4] `rtk npm run build` (SC-09)
- [x] T018 [C4] `rtk npm run lint` (SC-10)
- [x] T019 🛑 **HARD STOP Gate 3** — apresentar resumo ao operador

## Fase 4 — SQP + Documentação + C5 (Haiku/low-effort)

- [x] T020 [C5] Bump version em `apps/web/package.json` (SC-11)
- [x] T021 [C5] Entrada CHANGELOG.md `[Unreleased]` → `### Infra` (SC-12)
- [x] T022 [C5] Atualizar R-263 (Node 22)
- [x] T023 [C5] Atualizar R-264 (smoke em Node 22)
- [x] T024 [C5] Atualizar `PLAN_SERVER_REGRESSION_COVERAGE.md`
- [x] T025 [C5] DEVFLOW C5 journal entry + state.json
- [x] T026 🛑 **HARD STOP Gate 4 (Final)** — apresentar resumo ao operador
- [x] T027 [C5] Commit + push + PR (após aprovação do operador)

## Parallelism

- [P] T001-T010 (Fase 1) e T011-T015 (Fase 2) podem rodar em paralelo
- T016-T019 (Fase 3) depende de Fase 1 + Fase 2
- T020-T027 (Fase 4) depende de Fase 3
