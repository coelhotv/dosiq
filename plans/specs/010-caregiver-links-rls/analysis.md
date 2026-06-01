# Artifact Coverage Analysis: Caregiver Links & RLS

**Feature Directory**: `plans/specs/010-caregiver-links-rls`  
**Created**: 2026-06-01  
**Status**: PASS

---

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|:---|:---|:---|
| `§2. Modelo de Dados` | `spec.md §Context` | Alinhamento do banco Supabase de convites e links relacionais. |
| `§2.1 Contratos Zod` | `plan.md §Target Files` | Mapeamento dos schemas Zod no core conforme a R-021. |
| `§Regras Críticas de RLS` | `plan.md §Architectural Approach` | Mapeamento das regras de Manager, Observer e Revogação soberana. |

---

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|:---|:---|:---|:---|
| **FR-001** (Mapeamento relational DB) | Yes | `T001` | Migration SQL do Supabase. |
| **FR-002** (Políticas RLS) | Yes | `T003` | Políticas de row-level security no PostgreSQL. |
| **FR-003** (Direito Manager) | Yes | `T003`, `T009` | Permissão total para gestores vinculados. |
| **FR-004** (Direito Observer médico) | Yes | `T003`, `T009` | Permissão restrita SELECT para médicos. |
| **FR-005** (Zod 4 schemas `@dosiq/core`) | Yes | `T005` | Schemas Zod de convite e links relacionais. |
| **SC-001** (Bloqueio mutação) | Yes | `T009` | Testes integrados de segurança. |
| **SC-002** (Bloqueio 5 tentativas) | Yes | `T004`, `T011` | Verificação do bloqueio de força bruta. |

---

## Constitution Alignment

* **Princípio I (Health Data Safety):** Validado. Proteção absoluta de dados médicos por políticas PostgreSQL ativas.
* **Princípio II (Mobile-First Reliability):** Validado. Conexões diretas e rápidas via API Supabase.
* **Princípio IV (Timezone Correctness):** Validado. Datas e exibições no banco em timestamps UTC do servidor.
* **Princípio VI (Release and SQP):** Validado. Tarefas T012-T014 cobrem versionamento e changelog de lançamento.

---

## Gaps

| ID | Severity | Summary | Required Action |
|:---|:---|:---|:---|
| *Nenhum* | `LOW` | Todos os DoDs legados foram catalogados e mapeados para tarefas de implementação e validação. | N/A |

---

## Gate Decision

**🟢 PASS:** O mapeamento técnico e a cobertura de DoDs estão completos e blindados contra vulnerabilidades. A especificação está pronta para ser executada na Wave M1.
