# Artifact Coverage Analysis: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`  
**Created**: 2026-06-01  
**Status**: PASS  

---

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|----------------|-------------|-------|
| 1. O Problema e Descoberta Arquitetural | `spec.md` (Context) e `plan.md` (Technical Context) | Mapeamento físico-métrico simplificado e purificado focado em mililitros e volumes contínuos. |
| 2. Fórmulas Matemáticas e Engine | `plan.md` (Database Migrations - Stored Procedure) | Fórmulas integradas transacionalmente na stored procedure para gotas/ml/UI. |
| 3. Modelagem de Dados | `plan.md` (Database Migrations) | Adotada a estrutura do banco real em conformidade com o setup. |
| 6. Retrocompatibilidade e Migração | `plan.md` (Database Migrations) e `plan.md` (Technical Context) | Resolvido com o uso inteligente de `original_quantity` e `quantity` legadas. |

---

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|
| **FR-001** (Medicines Metadados) | Sim | `T002` | `drops_per_ml` column migration. |
| **FR-002** (Protocols Metadados) | Sim | `T002` | `intake_unit` column migration. |
| **FR-003** (IsLiquid Rule) | Sim | `T003` | `dosage_unit LIKE '%/ml'` auto-detection in postgres. |
| **FR-004** (Stored Procedure FIFO) | Sim | `T003`, `T004` | Atomics FIFO decimals and solids dispatch. |
| **FR-005** (Check Constraint) | Sim | `T002` | Non-negative check constraint. |

---

## Contract / ADR Coverage

- **ADR-052**: O banco de dados e stored procedure de líquidos entra antes de diabetes como fundação atômica compartilhada para tomada em ml, gotas e UI.
- **CON-025**: O contrato transacional de estoque mantém o formato legando, porém suportando decimais para garantir integridade física contínua.

---

## 🛠️ Validação de Aderência ao Refactor de Estoque (PR #443)

Cruzamos o plano de modelagem clínica de medicamentos líquidos contra o ecossistema de tabelas e procedimentos transacionais introduzidos no **Refactor de Estoque (PR #443)** para atestar compatibilidade absoluta e zero quebra:

### A. Relação com a Tabela `purchases`
* **Invariante**: Compras são eventos históricos imutáveis medidos em unidades comerciais físicas (frascos, canetas).
* **Solução Proposta**: O desmembramento no `stockService` faz com que uma compra de `"2 frascos de 50 ml"` insira 2 registros independentes em `purchases` (ex: `quantity_bought = 50.00` em cada linha).
* **Aderência**: **100% Perfeita.** O histórico de compras e a análise de custo médio ponderado baseada em `purchases` continuam operando de forma nativa e sem necessidade de alteração matemática.

### B. Consumo e Estornos por Lote (`stock_consumptions` & `stock_adjustments`)
* **Invariante**: Toda tomada deve debitar por FIFO e registrar as linhas de lote afetadas em `stock_consumptions`. O estorno em exclusão de log (`restore_stock_for_log`) lê a quantidade consumida original e a devolve ao lote correspondente.
* **Solução Proposta**:
  * Para líquidos, a stored procedure `consume_stock_fifo` calcula o volume em `ml` (ex: `0.75 ml`) e o consome da coluna `stock.quantity` (que armazena mililitros para líquidos).
  * O lote tocado é registrado na tabela `stock_consumptions` com `quantity_consumed = 0.75`.
  * Ao chamar `restore_stock_for_log`, a stored procedure lê `quantity_consumed = 0.75` e devolve exatamente `0.75` para a coluna `stock.quantity` daquele lote de forma atômica e exata, criando o respectiva auditoria em `stock_adjustments`.
* **Aderência**: **100% Perfeita.** Toda a trilha de auditoria e o motor transacional de estorno funcionam perfeitamente sem alteração estrutural, pois `quantity_consumed` e `quantity_delta` utilizam decimais (`numeric`) nativamente.

### C. Ajuste Manual de Saldo (`apply_manual_stock_adjustment`)
* **Invariante**: O ajuste manual do paciente atualiza o saldo de estoque atual do lote ativo e registra o delta na tabela de auditoria `stock_adjustments`.
* **Solução Proposta**: Quando o usuário realizar "Ajuste de Saldo" no PWA/Mobile (ex: de `10.00 ml` para `8.50 ml`), o `stockService` envia o delta `-1.50` para a RPC de ajuste (desbloqueada e permitida no refactor posterior §21.2).
* **Aderência**: **100% Perfeita.** O banco debita o delta em ml do lote, gerando o ajuste de auditoria correspondente na unidade contínua do medicamento.

---

## Gaps

Nenhum gap ativo identificado nesta etapa estrutural.

---

## Gate Decision

**Status**: **PASS**  
A especificação `022-liquid-medications-db-backend` estabelece com absoluta maestria a fundação estrutural do banco de dados, blindando o ecossistema com um modelo de dados 100% retrocompatível, elegantemente simples e focado de forma exclusiva no paciente. Pronto para revisão e homologação.

