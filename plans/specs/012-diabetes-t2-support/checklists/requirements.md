# Requirements Checklist — Diabetes T2 (Épico)

> "Unit tests" da escrita dos requisitos (completude/clareza/consistência/cobertura/
> mensurabilidade/rastreabilidade). NÃO testam comportamento de implementação.

## Completude
- [x] Toda fase (A–E) tem FR + task + SC associados.
- [x] Net-new identificado (shelf_life_days, opened_at, biomarkers_log, tolerância não-diária). Nota 2026-06-08: `units_per_ml`/`presentation`/conversão UI→ml + formatters de dose **NÃO são net-new** — vêm da 022 (em prod); Fase D reusa (R-272/R-267), não revisa `formatDoseUnit`.
- [x] Dependência dura (022) declarada e **satisfeita** (mergeada #652, 2026-06-08).
- [x] Migrações de dados com cenário explícito por fase.

## Clareza
- [x] Linha SaMD definida sem ambiguidade (zero cálculo/sugestão; carbo dado bruto; sem meta).
- [x] Tolerância: escopo da remoção do cap explícito (só não-diário).
- [x] `opened_at` trigger explícito (1ª tomada).

## Consistência
- [x] spec ↔ plan ↔ tasks ↔ analysis concordam (cross-file consistency em analysis.md).
- [x] Nome de coluna EN + valores enum PT (R-021) — `presentation` (ADR-058).
- [x] Reuso da fundação (FP-1..4, R-252, R-248, 022) sem recriar.

## Mensurabilidade
- [x] SC-001..006 verificáveis (query/teste/smoke).
- [x] Cada US tem Independent Test.

## Rastreabilidade
- [x] FR→task→SC mapeados (Traceability em tasks.md + Coverage em analysis.md).
- [x] ADRs ligados (058 accepted; 059–062 proposed).

## Pendências (gate antes do código)
- [ ] Fast-logging mobile path (T013/C1) — UNVERIFIED.
- [ ] ADR-059..062 → accepted (T030).
- [ ] Export PDF path (T025/C1).
