# Requirements Checklist 034 (unit tests for the spec)

Valida completude/clareza/consistência/cobertura/mensurabilidade/rastreabilidade dos requisitos — NÃO comportamento.

## Completude
- [x] Todo FR tem ≥1 task (FR-001→T030-34; 002→T034; 003→T032; 004→T036/T031; 005→T011-14; 006→T037; 007→T031/35; 008→T035; 009→T020-23; 010→T036; 011→T035/37)
- [x] Toda US tem acceptance (US1-5 ✓)
- [x] Toda SC tem verificação (SC-001→T040; 002→T015; 003/007→T041; 004→T035; 005→T050; 006→T035)

## Clareza
- [x] 3 [NEEDS CLARIFICATION] resolvidos (NC1 soft / NC2 manual+hook / NC3 Tier1+)
- [x] Decisão arquitetural → ADR-069 (não chute)

## Consistência (cross-file)
- [x] spec ↔ plan ↔ tasks concordam em: PR-level (não inline) MVP; events-only; sandbox no-tools; gate soft
- [x] FR-002 spec atualizada por EH2 (PR-level) — confirmar no C1.5 da 034-C
- [ ] ⚠️ SC-SEC1 contradiz Assumption `--dangerously-skip-permissions` da spec → ADR-069 reconcilia (skip-perms OK só sem tools); validar no C1.5

## Mensurabilidade
- [x] SC-001/002/003/006 automatizáveis; SC-004/005 métricas observáveis

## Rastreabilidade
- [x] Findings ceremony → tasks (EH1→T041 SC-007; EH2→T034; EM1→T014; EM2→T036; SC-SEC1→T031; SC-SEC2→T032/37; SC-SEC3→T034; SC-SEC4→T037; SC-SEC5→T039)

## Gaps a fechar no C1.5 (coding)
- Path do flat eslint config (UNVERIFIED) — T010
- Capacidade real de `gh api` postar PR-level comment — confirmar
- Schema JSON do output RC6 — definir formato exato
