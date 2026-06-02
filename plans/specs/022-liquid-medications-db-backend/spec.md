# Feature Specification: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Migration Status**: migrated
**Legacy Sources**:
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`
- `docs/architecture/DOSE_INSTANCES.md`

---

## Context

Para suportar medicamentos líquidos (xaropes, gotas, soluções, suspensões) no Dosiq, centralizamos toda a inteligência físico-métrica no **backend**, sem flags redundantes na UI.

**Decisão arquitetural-mãe (PO):** a natureza líquida é **derivada da unidade de concentração** do medicamento — **não** de um booleano `is_liquid`. A unidade de concentração passa a ser expressa como razão massa/volume: **`'mg/ml'`** ou **`'ui/ml'`**. Logo: `is_liquid := dosage_unit LIKE '%/ml'`.

Isso exige **duas frentes obrigatórias** nesta fundação:
1. **Estender o enum** `dosage_unit` com `'mg/ml'` e `'ui/ml'`.
2. **Migrar os dados legados**: medicamentos já cadastrados com `dosage_unit IN ('ml','gotas')` hoje **conflam concentração e unidade de tomada**. Eles precisam ser convertidos para o novo modelo: a unidade de tomada antiga (`ml`/`gotas`) migra para a nova coluna `protocols.intake_unit`, e o medicamento passa a ter `dosage_unit = 'mg/ml'`. Sem essa migração, os líquidos legados deixariam de ser detectados (a detecção `LIKE '%/ml'` não casa com `ml`/`gotas`).

A coluna `stock.quantity` (já `numeric`) passa a representar, para líquidos, o **volume fluido contínuo restante em mililitros (`ml`)** do lote, inicializado a partir de `original_quantity` (volume nominal do frasco). A RPC transacional `consume_stock_fifo` é sobrecarregada para baixas decimais por FIFO, espelhando o modelo de estoque v4.0.0 (`purchases` + `stock` + `stock_consumptions`) — **sem trigger paralelo**.

---

## User Scenarios & Testing

### User Story 1 — Modelagem Estrutural + Novas Unidades de Concentração (Priority: P1)
**Why this priority**: persistir metadados de líquidos e habilitar a detecção por unidade sem quebrar dados existentes.
**Independent Test**: inspecionar o enum `dosage_unit` e confirmar que aceita `'mg/ml'`/`'ui/ml'`; confirmar que `protocols.intake_unit` e `medicines.drops_per_ml` existem como nullable/com default.

**Acceptance Scenarios**:
1. Given o enum de unidades de concentração, When inspecionado, Then inclui `'mg/ml'` e `'ui/ml'` além dos sólidos (`mg`, `mcg`, `g`, `ui`, `un`).
2. Given a tabela `medicines`, When a coluna `drops_per_ml` é inspecionada, Then é `integer` com default `20` e aceita `NULL`.
3. Given a tabela `protocols`, When a coluna `intake_unit` é inspecionada, Then é `text` nullable aceitando `'gotas'`, `'ml'` ou `'UI'` (NULL para sólidos).

### User Story 2 — Migração de Líquidos Legados (Priority: P1)
**Why this priority**: sem migrar `ml`/`gotas` → `mg/ml` + `intake_unit`, os líquidos atuais ficam órfãos (não detectados como líquidos) e o decremento fracionado nunca dispara.
**Independent Test**: rodar a migração de dados e confirmar que (a) nenhum medicamento permanece com `dosage_unit IN ('ml','gotas')`; (b) os protocolos desses medicamentos receberam `intake_unit` com o valor da unidade antiga.

**Acceptance Scenarios**:
1. Given um medicamento legado com `dosage_unit = 'gotas'` e protocolos associados, When a migração roda, Then o medicamento passa a `dosage_unit = 'mg/ml'`, `drops_per_ml = 20`, e cada protocolo associado recebe `intake_unit = 'gotas'`.
2. Given um medicamento legado com `dosage_unit = 'ml'`, When a migração roda, Then o medicamento passa a `dosage_unit = 'mg/ml'` e seus protocolos recebem `intake_unit = 'ml'`.
3. Given que a concentração ativa (`dosage_per_pill`) é desconhecida para o medicamento legado, When a migração roda, Then `dosage_per_pill` permanece `NULL` (o decremento de estoque e a adesão por razão não dependem da concentração; a massa ativa simplesmente não é exibida até o usuário preencher).

### User Story 3 — Baixa Transacional Contínua por FIFO (Priority: P1)
**Why this priority**: tomadas devem deduzir o volume contínuo em ml por FIFO, com precisão decimal, dentro do modelo de estoque v4.0.0.
**Independent Test**: invocar `consume_stock_fifo` com tomada decimal (`2.5 ml`) e com gotas (`15 gotas`, `drops_per_ml = 20`) e confirmar a baixa exata em `stock.quantity` por FIFO, com linhas em `stock_consumptions`.

**Acceptance Scenarios**:
1. Given medicamento `'mg/ml'` e protocolo `intake_unit = 'ml'`, When o paciente confirma `2.50` ml, Then a RPC deduz exatamente `2.50` de `stock.quantity` do lote ativo por FIFO e grava `stock_consumptions.quantity_consumed = 2.50`.
2. Given medicamento `'mg/ml'`, `drops_per_ml = 20`, protocolo `intake_unit = 'gotas'`, When o paciente confirma `15` gotas, Then a RPC calcula `ROUND(15 / 20, 2) = 0.75` ml e deduz `0.75` por FIFO.
3. Given múltiplos lotes com validades distintas, When uma dose supera o volume do primeiro frasco, Then a RPC zera o primeiro lote e debita o saldo do próximo, atomicamente.
4. Given um medicamento sólido (`'mg'`, `'g'`, `'ui'`, `'un'`), When a RPC roda, Then ela desvia para o caminho linear legado (subtrai o valor inteiro de `quantity`, sem divisão).

---

## Edge Cases

- **Underflow / dízimas**: divisões de gotas podem gerar dízimas. Toda conversão usa `ROUND(..., 2)`; a coluna `stock.quantity` é `numeric` (sem escala fixa — a precisão é garantida pelo `ROUND` aplicativo + RPC). Uma `CHECK (quantity >= 0)` impede saldo negativo.
- **Retrocompat sólidos**: medicamentos sólidos seguem o caminho linear inteiro, sem qualquer conversão.
- **Líquido legado sem concentração**: `dosage_per_pill = NULL` é tolerado — só a exibição de massa ativa (mg) fica oculta; decremento e adesão funcionam normalmente.
- **`intake_unit = 'UI'` (v1)**: tratado como escala direta (`volume = p_quantity`) sem conversão — insulina/canetas é escopo do épico de diabetes (ADR-052), fora desta v1. Documentado, não silencioso.

---

## Requirements

### Functional Requirements

- **FR-001**: Estender o enum de `dosage_unit` (`DOSAGE_UNITS` no core + qualquer CHECK/enum SQL) com `'mg/ml'` e `'ui/ml'`.
- **FR-002**: Adicionar `drops_per_ml` (`integer`, default `20`, nullable) em `public.medicines`.
- **FR-003**: Adicionar `intake_unit` (`text`, nullable) em `public.protocols`.
- **FR-004**: Adicionar `CHECK (quantity >= 0)` em `public.stock` (impede underflow).
- **FR-005**: **Migração de dados** — converter medicamentos legados `dosage_unit IN ('ml','gotas')` para `dosage_unit = 'mg/ml'` + `drops_per_ml = COALESCE(drops_per_ml, 20)`, movendo a unidade antiga para `protocols.intake_unit` dos protocolos associados. Idempotente.
- **FR-006**: A RPC `public.consume_stock_fifo` infere o líquido via `dosage_unit LIKE '%/ml'`, converte a tomada (`intake_unit` + `drops_per_ml`) para ml e deduz por FIFO de `stock.quantity`, gravando `stock_consumptions`. Sólidos seguem o caminho linear. Mantém a assinatura atual `(p_user_id, p_medicine_id, p_quantity, p_medicine_log_id)`.

### Key Entities

- **Medicine**: `dosage_unit` (enum estendido com `mg/ml`/`ui/ml`) + `drops_per_ml`. Líquido = unidade termina em `/ml`.
- **Protocol**: `intake_unit` (`gotas`/`ml`/`UI`) — unidade física da tomada do líquido.
- **Stock**: `quantity` = ml restantes (líquidos) / unidades (sólidos); `original_quantity` = volume nominal do frasco.

---

## Success Criteria

- **SC-001**: `consume_stock_fifo` faz baixas decimais (ml) e inteiras (sólidos) precisas por FIFO, sem dízimas inconsistentes.
- **SC-002**: 100% de retrocompatibilidade — queries que somam `quantity` retornam o volume físico total restante; nenhum medicamento permanece com `dosage_unit IN ('ml','gotas')` pós-migração.
- **SC-003**: Migração idempotente (rodar 2× = mesmo estado) e testes de integração SQL cobrindo líquido (ml + gotas), sólido e multilote no Supabase local.
