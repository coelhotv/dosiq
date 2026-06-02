# Requirements Checklist: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan  

---

## Completeness

- [ ] CHK001 O Zod bloqueia com segurança medicamentos líquidos com campos de coeficientes vazios ou dosagens inválidas? [Completeness]
- [ ] CHK002 A lógica de compensação centava no desmembramento de estoque está documentada e implementada para prevenir dízimas financeiras? [Completeness]

## Clarity

- [ ] CHK003 A formatação de strings em português do helper `formatDose` respeita a gramática e o singular/plural (ex: "1 gota" vs "15 gotas")? [Clarity]
- [ ] CHK004 A transposição dos decimais de tomada está isenta de dízimas ou perdas por ponto flutuante JavaScript? [Clarity]

## Traceability

- [ ] CHK005 Cada requisito funcional (FR-001 a FR-004) possui pelo menos uma tarefa de desenvolvimento mapeada em `tasks.md`? [Traceability]
- [ ] CHK006 O plano de testes do core cobre 100% de cenários de formatação de ml, gotas e UI? [Traceability]

## Constitution Alignment

- [ ] CHK007 O helper `formatDose` é uma função pura em conformidade com o princípio `dry-principles`? [Consistency]
- [ ] CHK008 A arquitetura respeita a política de "Never Self-Merge" (R-060)? [Consistency]
