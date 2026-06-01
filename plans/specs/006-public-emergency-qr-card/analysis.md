# Artifact Coverage Analysis: Public Emergency QR Card

**Feature Directory**: `plans/specs/006-public-emergency-qr-card`  
**Created**: 2026-06-01  
**Status**: PASS

---

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|:---|:---|:---|
| `§F6.1 Cartão de Emergência` | `spec.md §Context` | Alinhamento do cartão físico com QR Code e página web para socorristas. |
| `§F6.1 Segurança (LGPD)` | `spec.md §Requirements` | Mapeamento da regra de revogação soberana e RLS. |
| `§F6.1 Contrato Zod` | `plan.md §Target Files` | Implementação do schema Zod no core conforme a R-021. |

---

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|:---|:---|:---|:---|
| **FR-001** (Geração QR Code) | Yes | `T005` | Componente `EmergencyQRCode.jsx` nativo. |
| **FR-002** (Página Web ultraleve) | Yes | `T007` | Rota web Next.js/Vite < 50kB bundle size. |
| **FR-003** (Dados críticos de socorro) | Yes | `T007` | Exibição de Alergias, Tipo Sanguíneo e Contatos. |
| **FR-004** (Botão de Revogação) | Yes | `T006` | Controle de desativação na aba mobile. |
| **FR-005** (Schema Zod `@dosiq/core`) | Yes | `T003` | Schema de validação `emergencyProfileSchema.js`. |
| **SC-001** (Carregamento < 1s) | Yes | `T007` | Otimização estática e enxuta do bundle. |
| **SC-002** (Segurança RLS rígida) | Yes | `T001`, `T009` | Migration Supabase com políticas RLS restritas. |

---

## Constitution Alignment

* **Princípio I (Health Data Safety):** Validado. Segurança baseada em tokens dinâmicos revogáveis a qualquer momento.
* **Princípio II (Mobile-First Reliability):** Validado. QR Code gerado localmente em alto contraste físico.
* **Princípio IV (Timezone Correctness):** Validado. Timestamps de alteração e expiração em UTC.
* **Princípio VI (Release and SQP):** Validado. Bump de versão, changelog de qualidade e comandos de validação incluídos.

---

## Gaps

| ID | Severity | Summary | Required Action |
|:---|:---|:---|:---|
| *Nenhum* | `LOW` | Todos os DoDs legados foram catalogados e mapeados para tarefas exatas de implementação. | N/A |

---

## Gate Decision

**🟢 PASS:** O mapeamento técnico e a cobertura de DoDs estão completos e blindados contra falhas de design nativo. A especificação está pronta para ser executada na Wave M1.
