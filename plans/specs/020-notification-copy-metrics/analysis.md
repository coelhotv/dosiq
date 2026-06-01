# Artifact Coverage Analysis: Notification Copy & Engagement Metrics (Wave N3)

**Feature Directory**: `plans/specs/020-notification-copy-metrics`  
**Created**: 2026-06-01  
**Status**: PASS  

---

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|:---|:---|:---|
| **§1 Objetivo** | `spec.md` (§Context e §FR-001) | Coberto combate a fadiga com pools dinâmicos e tracking granular. |
| **§2 Pré-requisitos** | `plan.md` (§Technical Context) | Alinhado com a finalização do refactor de `dose_instances` de forma robusta. |
| **§Sprint 3.1: Migration** | `plan.md` (§1 Migration) & `tasks.md` (Phase 1) | Migration SQL mapeada estendendo o log com as colunas novas e a FK crucial. |
| **§Sprint 3.2: Refactor** | `plan.md` (§2 Dispatcher) & `tasks.md` (Sprint 1) | Re-arquitetado o dispatcher central em duas fases preflight/completion. |
| **§Sprint 3.3: Copy library** | `plan.md` (§3 Copy) & `tasks.md` (Sprint 2) | Implementação do anti-fadiga determinístico com seed por (userId, dia). |
| **§Sprint 3.4: Digest Formatter** | `plan.md` (§3 Copy) & `tasks.md` (Sprint 3) | Formatter do Daily Digest agrupado por fuso local e plano de tomada. |
| **§Sprints 3.5 a 3.8: Tracking** | `plan.md` (§4 RLS) & `tasks.md` (Sprint 4) | Rastreamento do clique em push web/mobile e botões do bot com RLS. |
| **§Sprint 3.9: Validação** | `plan.md` (§Quality Gates) & `tasks.md` (Phase 3) | Validação rigorosa de lint, testes de determinismo e RLS. |

---

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|:---|:---:|:---|:---|
| **FR-001**: Extensão do banco e FK | Yes | `T001`, `T002`, `T003` | Migration SQL e Zod schema. |
| **FR-002**: Refactor dispatcher duas fases | Yes | `T005`, `T006`, `T007`, `T008` | Sequência preflight/enriquecimento/MarkSent. |
| **FR-003**: Pools de saudações e streak | Yes | `T009`, `T013` | Biblioteca de copy dinâmico motivacional. |
| **FR-004**: Hash de seed determinística | Yes | `T010`, `T011` | Seleção determinística livre de fadiga diária. |
| **FR-005**: Rastreamento de abertura | Yes | `T004`, `T014`, `T015`, `T016` | RLS direct client update + hooks de URL e Mobile. |
| **SC-001**: Redução da fadiga de copy | Yes | `T011`, `T019` | Testes de determinismo e distribuição saudável. |
| **SC-002**: Rastreabilidade robusta | Yes | `T019` | Gravação em DB para cliques e respostas ativas. |
| **SC-003**: Proteção de dados por RLS | Yes | `T004`, `T020` | Políticas de segurança impedem vazamento de logs. |

---

## Constitution Alignment

- **R-090 (Hobby serverless functions budget)**: A re-arquitetura do tracking de aberturas utilizando chamadas de update diretas ao cliente REST do Supabase sob políticas RLS restritas foi uma decisão brilhante. Ela cumpre as metas do spec de forma robusta sem consumir nenhum dos escassos 12 slots de funções serverless da Vercel Hobby, preservando a estabilidade da infra.
- **R-221 (SQP)**: Todas as tarefas de liberação e governança para bumps canônicos e português sob `CHANGELOG.md` foram rigorosamente incluídas na Tasks list (Fase 4), garantindo estabilidade e visibilidade de releases de forma robusta e rastreável.

---

## Gaps

| ID | Severity | Summary | Required Action |
|:---|:---|:---|:---|
| **GAP-01** | **LOW** | Offsets de timezone na seed | A seed baseada em string de data deve usar a data local derivada da timezone do usuário (`getUserTime` do refactor) para garantir simetria de dias. |
| **GAP-02** | **MEDIUM** | Tratamento de rede instável no mobile | Eventos de tracking de abertura push no mobile devem ser salvos offline reativamente no SQLite caso a conexão caia. |

---

## Gate Decision

> [!TIP]
> **GATE DECISION: PASS**  
> A feature `020-notification-copy-metrics` foi migrada com absoluto sucesso para o formato SDD. O desenho arquitetural é elegante, está totalmente integrado com a granularidade de instâncias do banco e define perfeitamente a implementação de métricas e copy.
