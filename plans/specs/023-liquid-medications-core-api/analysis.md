# Artifact Coverage Analysis: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`  
**Created**: 2026-06-01  
**Status**: PASS  

---

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|----------------|-------------|-------|
| 2. Fórmulas Matemáticas e Engine | `plan.md` (Helper formatDose) | Helper centralizado para formatação unificada de dosagens. |
| 4. UX/UI | `spec.md` (User Story 1 e 2) e `plan.md` (Zod Validation) | Mapeados validadores Zod flexíveis e coerentes. |
| 6. Retrocompatibilidade e Migração | `plan.md` (Desmembramento de Compras) | Resolvido com o desmembramento de compras atômicas em nível de API. |

---

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|
| **FR-001** (Zod Medicines & Protocols) | Sim | `T002`, `T003` | Core Schemas synchronization. |
| **FR-002** (Desmembramento Estoque) | Sim | `T004`, `T005` | Transactional desmembramento logic. |
| **FR-003** (Helper formatDose) | Sim | `T006` | Universal formatDose pure helper. |
| **FR-004** (Saldo Fracionado) | Sim | `T004` | Fraction math based on quantity / original_quantity. |

---

## Contract / ADR Coverage

- **ADR-046 / ADR-052**: O helper `formatDose` centraliza a renderização de dosagem no core e atende as restrições da "parede de unidades" de forma segura.
- **CON-025**: O contrato transacional aceita decimais em Zod e realiza a compensação centava de preço unitário de forma atômica no middle-tier.

---

## 🛠️ Validação de Aderência ao Refactor de Estoque (PR #443)

Cruzamos o plano das APIs e schemas de validação Zod contra as regras do **Refactor de Estoque (PR #443)** para atestar compatibilidade absoluta e de middle-tier:

### A. Desmembramento em `stockService.js` via `create_purchase_with_stock`
* **Invariante**: Compras de múltiplos frascos inseridas via UI devem ser desmembradas em inserts de lotes individuais para que o FIFO do banco funcione frasco por frasco.
* **Solução Proposta**: O `stockService` intercepta cadastros multilotes de líquidos e executa a chamada à RPC `create_purchase_with_stock` em lote (ou de forma transacional repetida), mapeando a `original_quantity` e `quantity` como o volume nominal daquele frasco.
* **Aderência**: **100% Perfeita.** O banco persistirá registros de estoque perfeitamente limpos e compatíveis com a trilha de auditoria de compras.

### B. Compensação de Centavos de Preço Unitário
* **Invariante**: O custo total de compra deve ser mantido idêntico ao valor real pago pelo usuário.
* **Solução Proposta**: O `stockService` faz a divisão aritmética e acumula a diferença centava na última linha de lote gerada.
* **Aderência**: **100% Perfeita.** Previne dízimas de ponto flutuante ou distorções de centavos no cálculo de custo médio ponderado do redesign.

---

## Gaps

Nenhum gap ativo identificado nesta etapa estrutural.

---

## Gate Decision

**Status**: **PASS**  
A especificação `023-liquid-medications-core-api` implementa com clareza todas as validações Zod, helper `formatDose` de exibição premium e a lógica de desmembramento de compras na API do core, reduzindo os riscos matemáticos e preparando o terreno para a UI/UX e bot. Pronto para homologação.

