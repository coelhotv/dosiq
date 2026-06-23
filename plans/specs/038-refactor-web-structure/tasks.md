# Tasks — 038 Refatorar Estrutura Web

> Tier 1. Planning dobrada no C2 gate. Ordem: resolver clarifications → mover → atualizar refs → guard.

- [x] T001 [US1] Resolver [NEEDS CLARIFICATION 1+2] — ✅ A + carve-out; FR-002 = rename simples [PO-1]
- [ ] T002 [US1] `git mv apps/web/src/views/redesign/*` → `apps/web/src/views/` (preserva história) [PO-1]
- [ ] T003 [US1] Atualizar `AppViewRouter.jsx` lazy imports (`./views/redesign/X` → `./views/X`) [PO-1]
- [ ] T004 [US1] Atualizar `vite.config.js`: alias `@settings` + 3 entradas `manualChunks` (HealthHistory, Stock, Landing) [PO-1]
- [ ] T005 [P][US1] Atualizar os 26 importers restantes (`grep -rl views/redesign`) [PO-1]
- [ ] T006 [US1] Dissolver `features/*/components/redesign/` conforme decisão T001 (rename simples se NC1=A) [PO-1]
- [ ] T007 [P][US2] `git mv` Landing* → `views/landing/` + atualizar import lazy + manualChunks [PO-2]
- [ ] T008a [carve-out FR-007] Extrair `deriveProtocolStatus` de `Stock.jsx` → core/feature + teste unit
- [ ] T008b [carve-out FR-008] Remover `CostSummary.jsx` (0 importers) + reconciliar pares `*Redesign` (confirmar count==0 antes de deletar)
- [ ] T008 [US3] Atualizar `CLAUDE.md` (raiz + apps/web/src) — `features/measures`, estrutura `views/` sem redesign [PO-3]
- [ ] T009 [C4] Guard: `rtk lint` (0 errors) + `rtk npm run build` (bundle gzip ±5% de 102 kB) + `rtk npm run test:critical` (verde) — fecha PO-1/PO-2/PO-3
- [ ] T010 [C4] Fechar todas as POs (colar evidência grep vazio + build + testes) antes do C5
- [ ] T011 [C5] R-221 SQP: web refactor sem impacto de usuário (no-user-impact) — CHANGELOG [Unreleased]; sem bump (ou patch se preferir)
- [ ] T012 [C5] Journal + state.json (status completed) + registrar AP se `git mv` quebrar import (reforço AP-H27/AP-164)
