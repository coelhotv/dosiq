# Artifact Coverage Analysis: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: PASS (dev-ready após revisão)

---

## Legacy Source Coverage

| Legacy Section | Migrado Para | Notas |
|----------------|--------------|-------|
| 2. Fórmulas/Engine | `plan.md` §5 (`formatDose`) | Extensão de `doseUnit.js`, não arquivo novo. |
| 4. UX (validação) | `spec.md` US1 + `plan.md` §1–3 | Zod líquido + cap revisado. |
| 6. Retrocompat | `plan.md` §4 (desmembramento via RPC) | Modelo `purchases` v4.0.0 preservado. |

---

## Requirement Coverage

| Requisito | Tem Task? | Task IDs | Notas |
|-----------|-----------|----------|-------|
| FR-001 (enum + refine líquido) | Sim | T003 | core. |
| FR-002 (`intake_unit` + cross-val) | Sim | T004 | core. |
| FR-003 (cap-100→1000 nos 4 schemas) | Sim | T005 | alvo correto (não protocolSchema). |
| FR-004 (desmembramento via RPC) | Sim | T007, T008 | N× `create_purchase_with_stock`. |
| FR-005 (`formatDose` estende) | Sim | T006 | reusa `formatNumberPtBR`. |
| FR-006 (fração de frasco) | Sim | T007 (leitura) | `quantity/original_quantity`. |

---

## Contract / ADR Coverage

- **ADR-046**: formatação de dose por unidade — `formatDose` adere e estende o helper canônico.
- **ADR-052**: parede de unidade exercitada (líquidos antes de diabetes).
- **RPC `create_purchase_with_stock`** (contrato de estoque v4.0.0, PR #443): consumida **sem alteração de assinatura** — desmembramento chama N vezes. Sem breaking change.

---

## Constitution Alignment

- `dry-principles`: `formatDose` estende `doseUnit.js` (sem paralelo). ✅
- `backwards-compatibility`: web schemas `export *` do core → editar só a definição; desmembramento via RPC não fura `purchases`. ✅
- `smart-data-design`: Zod tipa decimais e bloqueia líquido incompleto. ✅

---

## Gaps (resolvidos nesta revisão)

| ID | Severidade | Resumo | Ação |
|----|-----------|--------|------|
| G-023-1 | CRITICAL (resolvido) | Plano fazia `stock.insert` direto, furando `purchases`/auditoria v4.0.0; contradizia a própria analysis. | FR-004/§4: N× `create_purchase_with_stock`. |
| G-023-2 | CRITICAL (resolvido) | Cap-100 atacado em `protocolSchema` (já era 1000+decimal); o teto real vive em `logSchema`+3. | FR-003/T005 redirecionado aos arquivos corretos. |
| G-023-3 | HIGH (resolvido) | `formatDose` em arquivo novo duplicava `doseUnit.js`. | Estende o helper existente; reusa `formatNumberPtBR`. |
| G-023-4 | MEDIUM (resolvido) | Exigir concentração em líquido bloquearia edição de legados (NULL). | `dosage_per_pill` nullable; só `drops_per_ml` exigido. |
| G-023-5 | MEDIUM (resolvido) | Path mobile `.ts`. | Real é `stockService.js` (JS). |
| G-023-6 | LOW (resolvido) | `formatDose` com `.replace('.',',')` quebrava milhares. | Reusa `formatNumberPtBR`. |

---

## Gate Decision

**Status**: **PASS — Dev Ready.** Conflitos críticos (insert direto, cap no arquivo errado, helper duplicado) resolvidos; paths verificados. Pronta para `/devflow coding` (após 022).
