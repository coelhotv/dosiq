# Tasks: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`
**Input**: `spec.md`, `plan.md`
**Status**: Dev Ready

---

## Phase 1: Setup / Preflight

- [ ] T001 [C1] Verificar a saúde do projeto Supabase `kwqjtdsqkkbebfiaxubb` (MCP) e a integridade de `medicines`, `protocols`, `stock`, `medicine_logs`, `stock_consumptions`.
- [ ] T002 [C1] Identificar o nome real da constraint/validação de `medicines.dosage_unit` (`pg_constraint`/`information_schema`). Se for `text` livre sem CHECK, registrar e pular o passo 1 do SQL.

---

## Phase 2: Implementation (SQL & Migrations)

- [ ] T003 [US1] Criar `docs/migrations/20260602_liquid_meds_db.sql` — passo 1: estender o CHECK de `dosage_unit` com `'mg/ml'`/`'ui/ml'` (se aplicável).
- [ ] T004 [US1] No mesmo script — passo 2: `ALTER TABLE medicines ADD drops_per_ml`, `protocols ADD intake_unit`, `stock ADD CHECK (quantity >= 0)`.
- [ ] T005 [US2] No mesmo script — passo 3: migração de dados (mover `ml`/`gotas` para `protocols.intake_unit` + converter `medicines.dosage_unit` para `'mg/ml'`). Idempotente.
- [ ] T006 [US3] No mesmo script — passo 4: `CREATE OR REPLACE consume_stock_fifo` com branch líquido (ml/gotas→ml via `drops_per_ml`) + branch sólido linear + REVOKE/GRANT hardening (`search_path = ''`).
- [ ] T007 [US3] Aplicar a migração no Supabase local/branch (`apply_migration`); validar contagem `medicines WHERE dosage_unit IN ('ml','gotas') = 0`.

---

## Phase 3: Validation (Quality Gates)

- [ ] T008 [P] [C4] Teste SQL: tomada `2.5 ml` (`intake_unit='ml'`) deduz `2.50` de `stock.quantity` por FIFO + grava `stock_consumptions`.
- [ ] T009 [P] [C4] Teste SQL: tomada `15 gotas` (`drops_per_ml=20`) deduz `0.75` ml.
- [ ] T010 [P] [C4] Teste SQL: multilote — dose supera lote 1 → zera lote 1 e debita lote 2, atômico.
- [ ] T011 [P] [C4] Teste SQL: sólido (`'mg'`/`'un'`) segue caminho linear inteiro, sem divisão.
- [ ] T012 [P] [C4] Teste SQL: `restore_stock_for_log` devolve exatamente `quantity_consumed` (ex.: `0.75`) ao lote (regressão de estorno).
- [ ] T013 [C4] Teste SQL: idempotência da migração (rodar 2× = mesmo estado).
- [ ] T014 [C4] Rodar `rtk npm run validate:agent` na raiz (linter zero + testes críticos estáveis).

---

## Phase 4: DEVFLOW Record

- [ ] T015 [C5] SQP (R-221): plataforma Backend/Infra; impacto `no-user-impact` direto (fundação); registrar release log + CHANGELOG [Unreleased] Shared/Core.
- [ ] T016 [C5] Registrar/atualizar contrato da RPC `consume_stock_fifo` em CONTRACTS_INDEX (CON-NNN) — a semântica de `p_quantity` passa a ser a unidade de tomada para líquidos. Atualizar índices DEVFLOW.
- [ ] T017 [C5] Abrir PR; aguardar review Gemini + aprovação humana (R-060, nunca self-merge).

## Dependencies
T003→T004→T005→T006→T007 (mesmo arquivo, ordem importa). T008–T013 dependem de T007.

## Parallel Opportunities
T008–T012 marcados `[P]` (testes SQL independentes após T007).
