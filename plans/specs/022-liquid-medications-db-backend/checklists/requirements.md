# Requirements Checklist: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Source**: spec revisada (dev-ready)

---

## Completeness

- [ ] CHK001 As migrações cobrem enum (`mg/ml`/`ui/ml`), colunas (`drops_per_ml`, `intake_unit`), check de saldo E a migração de dados dos líquidos legados? [Completeness]
- [ ] CHK002 A RPC `consume_stock_fifo` atende baixa fracionada (ml/gotas) e linear (sólidos) sem ramo morto? [Completeness]
- [ ] CHK003 O estorno (`restore_stock_for_log`) foi coberto por teste de regressão para decimais? [Completeness]

## Clarity

- [ ] CHK004 A regra `dosage_unit LIKE '%/ml'` é válida **após** estender o enum e migrar os dados (sem isso ela não casaria com `ml`/`gotas`)? [Clarity]
- [ ] CHK005 A precisão é garantida por `ROUND(.,2)` na RPC/Zod (e NÃO por `numeric(10,2)` na coluna, que é `numeric` puro)? [Clarity]
- [ ] CHK006 A migração é idempotente e tem critério de verificação (`count(medicines WHERE dosage_unit IN ('ml','gotas')) = 0`)? [Clarity]

## Traceability

- [ ] CHK007 Cada FR (001–006) mapeia para ≥1 task em `tasks.md`? [Traceability]
- [ ] CHK008 O FIFO multilote e os sólidos têm testes SQL dedicados? [Traceability]

## Constitution Alignment

- [ ] CHK009 `consume_stock_fifo` tem hardening SECURITY DEFINER (`search_path = ''`, REVOKE PUBLIC/anon, GRANT authenticated/service_role)? [Consistency]
- [ ] CHK010 A mudança de semântica de `p_quantity` está registrada como contrato (CON-NNN) no C5? [Consistency]
- [ ] CHK011 Respeita "Never Self-Merge" (R-060)? [Consistency]
