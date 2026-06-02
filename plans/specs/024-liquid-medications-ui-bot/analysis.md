# Artifact Coverage Analysis: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`  
**Created**: 2026-06-01  
**Status**: PASS  

---

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|----------------|-------------|-------|
| 4. UX/UI | `spec.md` (User Story 1 e 2) e `plan.md` (Web & Mobile Forms) | Formulários dinâmicos de medicamentos, protocolos, estoque com hints visuais e alertas de fim de frasco. |
| 5. Bot do Telegram | `spec.md` (User Story 3) e `plan.md` (Bot Integration) | Notificações formatadas e confirmação transacional inline. |

---

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|
| **FR-001** (MedicineForm Units & Labels) | Sim | `T002`, `T003` | UI MedicineForm dropdown updates. |
| **FR-002** (ProtocolForm Intake Unit) | Sim | `T004` | Dynamic intake_unit select logic. |
| **FR-003** (StockForm Hints) | Sim | `T005` | Numeric inputs decorated with dynamic hints. |
| **FR-004** (Telegram Bot Dispatcher) | Sim | `T007`, `T008` | formatDose integration on telegram webhook. |

---

## Contract / ADR Coverage

- **ADR-046 / ADR-052**: O layout dinâmico dos formulários atende as regras da "parede de unidades" e mantém a interface limpa e intuitiva para o paciente.
- **CON-025**: O Bot do Telegram e as APIs de UI comunicam as unidades operacionais de dosagem respeitando a escala centava física estabelecida no backend.

---

## 🛠️ Validação de Aderência ao Refactor de Estoque (PR #443)

Cruzamos o plano das UIs e do Bot do Telegram contra as regras do **Refactor de Estoque (PR #443)** para atestar compatibilidade absoluta de apresentação:

### A. Rendimento de Frações no Redesign
* **Invariante**: O histórico de estoque do redesign (`EntradaHistorico.jsx` e `StockCardRedesign.jsx`) deve expor a fração do frasco de forma amigável ao paciente.
* **Solução Proposta**: Como `original_quantity` armazena o volume nominal de compra (ex: `50.00 ml`) e `quantity` o volume restante atual (ex: `35.00 ml`), a UI calcula o saldo com a conta $\frac{quantity}{original\_quantity} = 0.70$ frascos restantes de forma imediata e transparente.
* **Aderência**: **100% Perfeita.** Paridade perfeita de UX sem tocar nos hooks compartilhados ou na view legacy.

### B. Integração do Bot no `/adicionar_estoque`
* **Invariante**: O bot deve usar o novo modelo de transações de compra de forma retrocompatível.
* **Solução Proposta**: A entrada via Telegram `/adicionar_estoque` dispara a chamada para a RPC `create_purchase_with_stock` passando `p_quantity = volume` em mililitros e registrando o lote de forma exata.
* **Aderência**: **100% Perfeita.** O bot escreve de forma consistente com a trilha histórica do redesign, eliminando qualquer bypass de compra fake.

---

## Gaps

Nenhum gap ativo mapeado.

---

## Gate Decision

**Status**: **PASS**  
A especificação `024-liquid-medications-ui-bot` completa com excelência o ciclo de vida do épico de líquidos, detalhando todas as modificações nas interfaces responsivas Web/Mobile, hints visuais e alinhamento do Bot do Telegram, garantindo uma UX premium focada e simples para a "Dona Maria". Pronto para homologação.

