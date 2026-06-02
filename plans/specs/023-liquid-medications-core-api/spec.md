# Feature Specification: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Migration Status**: migrated
**Legacy Sources**:
- `plans/specs/022-liquid-medications-db-backend/`
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`

---

## Context

Com a fundação de banco pronta (spec 022), a camada **core / validações / serviços** precisa: aceitar decimais, validar coeficientes de líquido, expor as novas unidades de concentração e gerenciar a escrita de inventário de líquidos **dentro do modelo de estoque v4.0.0** (`purchases` + RPC, nunca insert direto).

Responsabilidades:
1. **Enum e validação Zod**: `DOSAGE_UNITS` ganha `'mg/ml'`/`'ui/ml'`; `protocols.intake_unit` (`gotas`/`ml`/`UI`); flexibilizar os tetos herdados (cap-100, R-022) que hoje **bloqueiam** doses líquidas grandes.
2. **Desmembramento de compras**: comprar `N frascos de V ml` por preço total `P` → **N chamadas** à RPC `create_purchase_with_stock` (uma por frasco), com custo por ml e compensação de centavos na última.
3. **Formatação universal**: estender o helper existente `packages/core/src/utils/doseUnit.js` com `formatDose(value, unit)` (reusando `formatNumberPtBR`), sem criar arquivo paralelo (DRY/R-231).

> **Correção crítica de escopo (revisão 2026-06-02):** o teto de 100 **não** está em `protocols.dosage_per_intake` (já é `.max(1000)` e aceita decimal). Está em **`logSchema.quantity_taken.max(100)`** e em `adherencePatternSchema`, `costAnalysisSchema`, `reminderOptimizerSchema`. É **lá** que a tomada de `100 ml`/`1000 gotas` é rejeitada. O alvo da flexibilização é o registro de dose, não o protocolo.

---

## User Scenarios & Testing

### User Story 1 — Validação Zod de Concentração + Tomada (Priority: P1)
**Why this priority**: impedir cadastros líquidos incompletos e permitir doses decimais válidas no registro.
**Independent Test**: cadastrar medicamento `'mg/ml'` sem `drops_per_ml` → Zod rejeita; registrar um log de `100 ml` → Zod aceita (não barra no antigo teto 100).

**Acceptance Scenarios**:
1. Given um medicamento com `dosage_unit` terminando em `/ml`, When `medicineSchema` valida, Then exige `drops_per_ml` (inteiro positivo, default 20); `dosage_per_pill` (concentração) é **opcional/nullable** (legados migrados têm `NULL`).
2. Given um protocolo de medicamento líquido, When `protocolSchema` valida, Then exige `intake_unit ∈ {gotas, ml, UI}` e aceita `dosage_per_intake` decimal (ex.: `2.5`).
3. Given um medicamento sólido, When `protocolSchema` valida, Then `intake_unit` permanece `NULL` (não exigido).
4. Given um registro de dose de `100 ml` (líquido), When `logSchema` valida `quantity_taken`, Then aceita (teto revisado para `1000`, não mais `100`).

### User Story 2 — Desmembramento de Compra via RPC + Custo por mL (Priority: P1)
**Why this priority**: UX de "N frascos + preço total" numa tela, alimentando o custo mensal com precisão, **sem furar** o modelo `purchases`.
**Independent Test**: `stockService.createPurchase` com `3 frascos de 100 ml`, total `R$ 30,00` → **3 chamadas** `create_purchase_with_stock`, cada uma `p_quantity = 100`, `p_unit_price = 0.10` (= 30/3/100), última compensando centavos.

**Acceptance Scenarios**:
1. Given compra de `3 frascos de 100 ml` por R$ 30,00, When `stockService` processa, Then dispara 3× `create_purchase_with_stock` (`p_quantity=100`, `p_unit_price=0.10`), criando 3 lotes independentes em `stock` (cada um com seu `purchase_id`).
2. Given compra de `3 frascos de 100 ml` por R$ 10,00 (divisão inexata), When processa, Then os 2 primeiros frascos usam `unit_price = ROUND(3.33/100, 4)` e o último compensa o centavo restante para fechar o total exato R$ 10,00.

### User Story 3 — Formatação de Dose (Priority: P2)
**Why this priority**: exibir a tomada na unidade real, em PT-BR, reusando o helper existente.
**Independent Test**: `formatDose(15, 'gotas') → "15 gotas"`; `formatDose(2.5, 'ml') → "2,5 ml"`; `formatDose(1, 'gotas') → "1 gota"`.

**Acceptance Scenarios**:
1. Given `(15, 'gotas')`, When `formatDose` roda, Then retorna `"15 gotas"`.
2. Given `(2.5, 'ml')`, When `formatDose` roda, Then retorna `"2,5 ml"` (vírgula decimal, via `formatNumberPtBR`).
3. Given `(1, 'gotas')`, When `formatDose` roda, Then retorna `"1 gota"` (singular).

---

## Edge Cases

- **Centavos no custo/ml**: 3 frascos por R$ 10,00 → `price_per_bottle = 3.33`, `compensated_last = 10 - 3.33*2 = 3.34`. `unit_price = ROUND(price_per_bottle / V, 4)`; o último frasco usa o preço compensado. Total reconstruído (`Σ unit_price*V`) ≈ R$ 10,00 sem perda.
- **Edição de líquido legado sem concentração**: `medicineSchema` aceita `dosage_per_pill = NULL` (não bloqueia salvar); a massa ativa só aparece quando preenchida.
- **Cross-validação**: medicamento líquido (unidade `/ml`) **exige** `protocols.intake_unit` no `protocolSchema` (superRefine); sólido não.

---

## Requirements

### Functional Requirements

- **FR-001**: `DOSAGE_UNITS` (`packages/core/src/schemas/medicineSchema.js`) ganha `'mg/ml'` e `'ui/ml'`; `medicineSchema` exige `drops_per_ml` quando a unidade termina em `/ml` (concentração opcional/nullable).
- **FR-002**: `protocolSchema` (`packages/core/src/schemas/protocolSchema.js`) ganha `intake_unit` (`z.enum(['gotas','ml','UI']).nullable().optional()`) + superRefine: líquido ⇒ `intake_unit` obrigatório. `dosage_per_intake` permanece `.max(1000)` decimal (sem mudança).
- **FR-003**: Revisar o teto R-022 (cap-100) onde ele realmente vive — `logSchema.quantity_taken`, `adherencePatternSchema`, `costAnalysisSchema`, `reminderOptimizerSchema` — elevando para `.max(1000)` (cobre gotas) e documentando que a segurança real do volume é o `CHECK`/saldo de estoque (spec 022), não o cap Zod.
- **FR-004**: `stockService.createPurchase` (web `apps/web/src/features/stock/services/stockService.js` + mobile `apps/mobile/src/features/stock/services/stockService.js`) desmembra `N frascos × V ml × preço total` em **N chamadas** `create_purchase_with_stock` (`p_quantity = V`, `p_unit_price = custo/ml`), com compensação de centavos no último frasco. **Nunca** `supabase.from('stock').insert(...)` direto.
- **FR-005**: Estender `packages/core/src/utils/doseUnit.js` com `formatDose(value, unit)` reusando `formatNumberPtBR` + `pluralizeDoseUnit` (sem arquivo novo).
- **FR-006**: As leituras de saldo expõem a fração de frasco por `quantity / original_quantity` por lote (helper puro), sem tocar nos hooks de cache compartilhados.

### Key Entities

- **Core Schemas**: `medicineSchema` (enum + refine líquido), `protocolSchema` (`intake_unit` + cross-validação).
- **logSchema & cousins**: teto revisado para tomadas líquidas.
- **stockService**: orquestrador de desmembramento via RPC `create_purchase_with_stock`.
- **doseUnit.js**: `formatDose` (extensão do helper existente).

---

## Success Criteria

- **SC-001**: Zod valida concentração/tomada decimal e bloqueia líquidos sem `drops_per_ml`/`intake_unit`, com zero falso-positivo em sólidos legados.
- **SC-002**: Compras de N frascos geram N lotes via `create_purchase_with_stock` (modelo `purchases` intacto), com custo total reconstruído sem perda de centavos.
- **SC-003**: 100% de cobertura unitária em `formatDose`, no desmembramento (incl. compensação de centavos) e nos schemas (válido/inválido, sólido/líquido).
