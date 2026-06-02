# Requirements Checklist: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan  

---

## Completeness

- [ ] CHK001 As migrações de banco cobrem todas as alterações de colunas estruturais necessárias para suportar a modelagem clínica purificada? [Completeness]
- [ ] CHK002 A stored procedure `consume_stock_fifo` atende com precisão matemática tanto a baixas fracionadas contínuas quanto a baixas de pílulas discretas? [Completeness]

## Clarity

- [ ] CHK003 A regra de negócio que identifica se o medicamento é líquido (`dosage_unit LIKE '%/ml'`) está explicitamente documentada no plano técnico e na stored procedure? [Clarity]
- [ ] CHK004 A transição de volume fracionado utilizando a coluna `original_quantity` e `quantity` legadas está isenta de dízimas acumuladas? [Clarity]

## Traceability

- [ ] CHK005 Cada requisito funcional (FR-001 a FR-005) possui pelo menos uma tarefa atômica correspondente na checklist `tasks.md`? [Traceability]
- [ ] CHK006 O plano de testes do backend atesta a integridade do FIFO multilote? [Traceability]

## Constitution Alignment

- [ ] CHK007 O uso de tipos de dados numéricos precisos (`numeric`) em `stock.quantity` atende às regras de integridade matemática do Dosiq? [Consistency]
- [ ] CHK008 A arquitetura respeita a política de "Never Self-Merge" (R-060)? [Consistency]
