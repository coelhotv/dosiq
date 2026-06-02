# Requirements Checklist: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan  

---

## Completeness

- [ ] CHK001 Os dropdowns dinâmicos de unidade de tomada exibem opções corretas (`gotas`, `ml`, `UI`) e comportam-se de forma exemplar para líquidos? [Completeness]
- [ ] CHK002 Os inputs do form de compra de estoque de líquidos exibem hints responsivos e fáceis de entender (frascos e ml)? [Completeness]

## Clarity

- [ ] CHK003 O banner de estoque baixo possui micro-copywriting explicativo e amigável para a Dona Maria? [Clarity]
- [ ] CHK004 As notificações e confirmações inline do Bot do Telegram respeitam a unidade de tomada em português brasileiro? [Clarity]

## Traceability

- [ ] CHK005 Cada requisito funcional (FR-001 a FR-004) possui pelo menos uma tarefa de UI/Bot mapeada na checklist `tasks.md`? [Traceability]
- [ ] CHK006 O plano de testes do Bot do Telegram valida cenários de tomada bem-sucedidos e de estoque zerado de forma best-effort? [Traceability]

## Constitution Alignment

- [ ] CHK007 As novas telas seguem rigidamente as diretrizes de visual-hierarchy e responsividade de design premium do Dosiq? [Consistency]
- [ ] CHK008 A arquitetura respeita a política de "Never Self-Merge" (R-060)? [Consistency]
