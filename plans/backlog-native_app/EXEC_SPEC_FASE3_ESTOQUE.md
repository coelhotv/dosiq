# EXEC SPEC — Fase 3: CRUD Estoque (v2.1 — 2026-05-19)

> **Duração**: 2 sprints semanais
> **Branch base**: `feat/crud-stock`
> **Referência**: MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md §9 (Fase 3)
> **Pré-condição**: ✅ Fase 2 + 2.5 completas · ✅ RETRO_FASE2 aplicada · ✅ Mocks Fase 3 aprovados pelo PO
> **Quality Gates**: G1 (Copy) → G2 (Extract) → G3 (Migrate)
> **SQP vinculante**: v2.0 ([INDEX_EXEC_SPECS.md](INDEX_EXEC_SPECS.md))

---

## §0 — Cuidados Aprendidos Pré-Fase 3 (consolidado RETROs Fase 1+2)

**Patterns obrigatórios** (todo spawn da Fase 3 DEVE seguir; spec sem aplicar = retrabalho garantido).

### 0.1 Arquitetura compartilhada (web↔mobile)
- **Factory pattern em `@dosiq/core/repositories/`** (R-231 + ADR-045). **NUNCA** `packages/shared-data/src/services/` (deprecado pra repositories).
- **Helpers canônicos derivados em `@dosiq/core/utils/`** — toda derivação compartilhada (status stock, dias restantes, dias até vencimento, preço médio, consumo diário) DEVE ter helper único.
- **Re-export via barrel** `@dosiq/core/utils/index.js` — auditar consumers antes de adicionar export (AP-164 naming collision).

### 0.2 Mobile patterns (consolidados Fase 2)
- **Bottom sheet** = `<Modal statusBarTranslucent>` + spacer `<View height={StatusBar.currentHeight}>` (Android) + `<SafeAreaView edges={['bottom']}>` (R-233).
- **Input numérico decimal PT-BR** preserva estados intermediários (`"0,"`, `"."`, vazio) como string; coerce só no submit (AP-167).
- **`useFormState.validate`** aceita `overrides` opcional pra fix de race com `handleChange` async (AP-166).
- **Unidade(s) sempre** em formatadores (ADR-046) — apresentação real (mg/ml/cp) em DataPills separadas.
- **Optimistic UI em toggle** = state local `override` + `setOverride(next)` antes da mutation + rollback no catch.
- **`useFocusEffect(refresh)`** em listas/detalhes para refresh pós-edit/create/delete.
- **Hook canônico antes de inline** (R-235) — grep por `use<Entity>*` existente antes de implementar inline.

### 0.3 Cache invalidation matrix (R-236) — CRÍTICO Fase 3
Fase 3 tem **3 snapshots interdependentes**:
- `@dosiq/stock-snapshot` (saldo + status)
- `@dosiq/purchases-snapshot` (histórico)
- `@dosiq/treatments-snapshot` (daysRemaining depende de stock + consumo de tratamentos)

Toda mutation deve documentar inline TODOS os snapshots invalidados. Exemplo:
```js
/**
 * createPurchase — registra compra + atualiza saldo via RPC.
 * Caches invalidados:
 *   - @dosiq/stock-snapshot (saldo, status)
 *   - @dosiq/purchases-snapshot (histórico do medicamento)
 *   - @dosiq/treatments-snapshot (daysRemaining recalculado)
 */
```
Esquecer um cache = bug latente (D11 Fase 2.5; G7 retro Fase 3).

### 0.4 Processo (SQP §§10-13)
- **Smoke PO antes de `gh pr create`** (R-234) — push pra remote OK; PR aguarda smoke local. Vinculante pra toda sprint UI.
- **Wave orchestration com dependency graph** (R-237) — mapear tasks → deps → waves antes de spawn. Maximiza paralelismo.
- **Brief cavecrew R-230 (6 itens)** em todo spawn (refs read-only, paths absolutos, contratos, R-NNN aplicáveis, validação, NÃO COMMITAR).
- **Branch sync** (`git fetch origin` + confirmar base = origin) antes de criar branch nova OU spawn que toca arquivos compartilhados (AP-169).
- **Audit barrel exports** antes de adicionar item novo em `packages/core/src/<dominio>/index.js` (AP-164).
- **Vitest config propagation**: toda mudança em alias propaga pra TODOS configs vitest (AP-170).
- **Spec viva** — atualizar este arquivo durante execução; novas regras vão pra §0 (este bloco).

### 0.5 Decisões PO absorvidas dos mocks Fase 3
| # | Decisão | Impacto na spec |
|---|---------|-----------------|
| PO-1 | **NÃO existe "excluir compra"** | Remove `useStockDelete` + `deletePurchase` + verificação consumo parcial. Correção via Ajuste apenas |
| PO-2 | **FAB ubíquo** "Registrar compra" no Hub E Detail | StockScreen + StockDetailScreen ambos têm FAB |
| PO-3 | **Form de compra sempre com med travado no topo** | Sem `MedicineSelectableRow` no form; seleção é `PurchaseMedicineSheet` (do FAB Hub) ou param da rota (do FAB Detail) |
| PO-4 | **Editar compra ≠ Registrar compra** | Mesma tela, mode prop diferente; push do "..." em PurchaseCard do Histórico |
| PO-5 | **Indicadores v1 = KPI grid 2×2** (skip variant C colapsável; ir direto pra A) | StockIndicators componente único; mock detalhes reflete |
| PO-6 | **Ajuste manual = modo único "Acertar saldo"** (digitar valor final, delta pode ser negativo) | Sem segmented `+ / −`. Preview teal do delta. Motivo obrigatório. **Requer migration nova pra desbloquear delta negativo** (ver §0.8) |
| PO-7 | Glossário UI: "Estoque", "compra", "lote", "validade", "saldo", "farmácia", "laboratório" | Adotar nos labels |
| PO-8 | **Stock = 0 é cenário válido** (validação acontece em LogForm dose) | Spec NÃO bloqueia stock=0; UI mostra status crítico + CTA "Registrar compra". Designer não precisa novo mock |
| PO-9 | **Regra de listagem do Hub** (NOVA, corrige bug atual em produção) | StockScreen mostra meds onde `hasActiveProtocol \|\| totalStock > 0`. Bug atual: `getStockData` legacy filtra só `protocols.active=true` → meds com estoque órfão (treatment finalizado/pausado/inexistente) ficam invisíveis. Fix é INERENTE à reescrita Wave 4 — não fix retroativo separado |
| PO-10 | **`regulatory_category` FORA escopo Fase 3 v1** | Mocks não diferenciam Genérico/Similar/Novo. `StockForm` mobile NÃO implementa matriz regulatória (web archived spec §11.5). Defer pra v2 quando UI mobile expandir cadastro de medicamentos |

### 0.6.5 Alignment com archive_old/stock_refactor (canonical SQL/RPC contract)

Reference: [`plans/archive_old/stock_refactor/exec_spec_stock_refactor.md`](../archive_old/stock_refactor/exec_spec_stock_refactor.md)

Refactor stock (PR #443, 2026-04-02) estabeleceu o modelo canônico que mobile Fase 3 DEVE respeitar:

**Tabelas + colunas** (já existem em produção):
- `purchases` (fonte canônica histórico — quantity_bought, unit_price, purchase_date, expiration_date, pharmacy, laboratory, notes)
- `stock` (saldo por lote — purchase_id, original_quantity, **entry_type** {purchase/adjustment/legacy_unrecoverable})
- `stock_adjustments` (audit trail — quantity_delta, reason, reference_id)
- `stock_consumptions` (consumo por log + lote — medicine_log_id, stock_id, quantity_consumed, reversed_at)
- view `medicine_stock_summary` (agregado pra leitura rápida — total_quantity)
- `medicines.regulatory_category` (genérico/similar/novo — FORA escopo mobile v1, ver PO-10)

**RPCs canônicos** (mobile usa via `stockService.js`):
- `create_purchase_with_stock(p_medicine_id, p_quantity, p_unit_price, p_purchase_date, p_expiration_date, p_pharmacy, p_laboratory, p_notes)` — atomic compra + lote
- `consume_stock_fifo(p_medicine_id, p_quantity, p_medicine_log_id)` — FIFO com `entry_type != 'legacy_unrecoverable'` (fix Phantom Stock 2026-05-13 — §21.1 archive)
- `restore_stock_for_log(p_medicine_log_id, p_reason)` — estorna exato por lote
- `apply_manual_stock_adjustment(p_medicine_id, p_quantity_delta, p_reason, p_notes)` — **atualmente bloqueia delta < 0** (archive §1.1 regra 6); ver §0.8 pra mudança Fase 3

**Read-side regras (Wave 4 StockScreen + Wave 3 PurchaseHistory)**:
- Histórico de compras → SEMPRE `purchases` (via `getPurchasesByMedicine`), NUNCA `stock.quantity`
- Última compra → `purchases ORDER BY purchase_date DESC LIMIT 1`
- Saldo total → `medicine_stock_summary.total_quantity` (já filtra entry_type apropriadamente na view)
- Preço médio → `computeAverageUnitPrice(purchases)` com `quantity_bought × unit_price` (helper §0.6)
- **NUNCA** filtrar `notes LIKE 'Dose excluída%'` ou similares — esse hack do legacy foi eliminado em PR #443

**Write-side regras (Wave 2/3/5)**:
- Mobile NUNCA faz `insert` direto em `stock` — só via RPCs
- Mobile NUNCA cria entry de compra fake pra representar ajuste (anti-pattern morto)
- LogForm dose (já existente) usa `consume_stock_fifo` server-side ao registrar dose
- `useStockMutation.toggleActive` ou similar pra purchase NÃO existe (PO-1 sem delete)

### 0.7 Regra de listagem do Hub (PO-9 — corrige bug em produção)

`StockScreen` (Wave 4) DEVE listar medicamentos onde:
```js
hasActiveProtocol || totalStock > 0
```

Onde:
- `hasActiveProtocol = protocols.some(p => p.active && isProtocolActiveOnDate(p, today))`
- `totalStock = medicine_stock_summary.total_quantity ?? 0`

**Bug atual em produção** (`getStockData` legacy em `stockService.js`):
```js
.eq('protocols.active', true)        // ← filtra protocols antes do join
.filter((m) => m.protocols.some(isProtocolActiveOnDate))  // ← exclui meds sem treatment ativo
```

Cenários quebrados hoje (que Wave 4 corrige por reescrita):
- Med cadastrado com 30cp + sem treatment criado → invisível
- Med com treatment finalizado mas estoque sobrando → invisível
- Med com treatment **pausado** + estoque positivo → invisível (Fase 2.5 introduziu pausa, agravou o problema)

**Query refactor pra Wave 4** (substitui `getStockData`):
```js
// Em useStock.js ou stockService.getMedicinesWithStockOrActiveProtocol
const { data, error } = await nativeSupabaseClient
  .from('medicines')
  .select(`
    id, name, laboratory, dosage_unit, dosage_per_pill,
    medicine_stock_summary!left ( total_quantity ),
    protocols ( id, dosage_per_intake, time_schedule, frequency, active, start_date, end_date )
  `)
  .eq('user_id', userId)
  // SEM filtro protocols.active — queremos avaliar atividade no client
  .order('name')

const today = getTodayLocal()
return (data || []).filter((m) => {
  const hasActiveProtocol = (m.protocols || []).some(
    (p) => p.active && isProtocolActiveOnDate(p, today),
  )
  const totalStock = m.medicine_stock_summary?.total_quantity ?? 0
  return hasActiveProtocol || totalStock > 0
})
```

**Deprecação**: `getStockData` legacy fica preservada até Wave 4 reescrever `useStock`. Após Wave 4 mergeada, marcar `getStockData` como `@deprecated` + remover em fix-pack pós-Fase 3.

### 0.8 Migration pendente pra Wave 5 — ajuste manual negativo

`adjustToBalance` (modo único "Acertar saldo" — PO-6) precisa funcionar pra **delta negativo** (cenários: perda, doação, descarte, vencimento manual sem usar lote vencido). RPC atual `apply_manual_stock_adjustment` **falha explicitamente** quando `p_quantity_delta < 0` (archive §1.1 regra 6 — decisão conservadora de 2026-04-02).

**Decisão Fase 3**: desbloquear via nova migration durante Wave 5.

**Migration a criar** (Wave 5, antes do `StockAdjustmentScreen` ser implementado):
- Path: `docs/migrations/YYYYMMDD_allow_negative_manual_adjustments.sql`
- Conteúdo: ALTER FUNCTION `apply_manual_stock_adjustment` removendo check `p_quantity_delta < 0 → raise exception`
- Comportamento novo pra delta negativo:
  1. Validar `total_quantity` atual >= `abs(p_quantity_delta)` (não permitir saldo negativo)
  2. Iterar lotes FIFO (`stock` com `entry_type != 'legacy_unrecoverable'` + `quantity > 0`)
  3. Decrementar lotes (consumir FIFO igual `consume_stock_fifo`, mas SEM criar `stock_consumptions` — não é dose)
  4. Inserir `stock_adjustments` negativo com `reason = p_reason` + `notes = p_notes`
  5. NÃO cria `stock_consumptions` (não há `medicine_log_id`)
- Grants + RLS conforme template CLAUDE.md (REVOKE EXECUTE FROM PUBLIC/anon, search_path='', SECURITY DEFINER)
- Aplicação manual pelo PO (não auto-merge migration)

**Reasons aceitos pra delta negativo** (alinhado com archive §4.1.1 + extensões PO-6):
- `'perda'`
- `'doacao'`
- `'descarte'`
- `'vencimento_manual'`
- `'correcao_erro'`
- `'outro'`

Archive spec original (`exec_spec_stock_refactor.md`) tem update correspondente em §21.2 (nova seção) marcando essa mudança como pós-entrega.

### 0.9 Migration pendente pra Wave 5 — precisão de `purchases.unit_price`

Regressão detectada via Supabase MCP (schema vivo, 2026-05-20): `purchases.unit_price` ficou `NUMERIC(10,2)` no refactor (`20260402`), enquanto `stock.unit_price` é `NUMERIC(12,4)`. Custos muito baixos (genéricos/fracionados, ex. `R$ 0,134`/comprimido) eram **arredondados silenciosamente pra 2 casas** no INSERT — Zod e form aceitavam, Postgres truncava sem erro.

**Decisão PO**: mínimo 3 casas decimais (4 efetivas, alinhado com `stock`).

**Migration criada** (Wave 5, mesma leva da §0.8 — PO aplica manualmente):
- Path: `docs/migrations/20260520_purchases_unit_price_precision.sql`
- Conteúdo: `ALTER TABLE purchases ALTER COLUMN unit_price TYPE NUMERIC(12,4)` (idempotente — só altera se escala ≠ 4)
- CHECK `(>= 0)` e DEFAULT 0 permanecem válidos; ampliação de escala sem perda de dados
- RPC `create_purchase_with_stock` param `p_unit_price` já é `NUMERIC` ilimitado — sem alteração

**Polish opcional (não bloqueia migration)**: limitar input decimal do `unit_price` no `PurchaseFormScreen` a 4 casas + Zod `.refine` de máx 4 decimais — feedback explícito em vez de arredondar mudo. Avaliar em fix-pack pós-Fase 3.

### 0.6 Helpers canônicos a criar em `@dosiq/core/utils/`
Antes do spawn de telas/cards, criar estes helpers (Wave 1 inline Opus):

| Helper | Assinatura | Onde consumir |
|--------|-----------|---------------|
| `resolveStockStatus(qty, dailyConsumption, today)` | `→ 'critico' \| 'baixo' \| 'normal' \| 'vencido'` | StockCard, StockIndicators, FILTER_CHIPS counts |
| `computeDaysRemaining(qty, dailyConsumption)` | `→ number \| null` | StockIndicators, StockCard `days` |
| `computeDailyConsumption(activeProtocols)` | `→ number` | StockIndicators, cross-domain treatments→stock |
| `computeAverageUnitPrice(purchases)` | `→ number` (weighted) | StockDetail, StockIndicators |
| `computeExpiryDays(expiryYYYYMM)` | `→ number \| null` | PurchaseCard, filtro "Vencendo" |
| `formatBRL(n)` | `→ 'R$ X,YY'` (locale PT-BR) | toda tela com preço |

Thresholds confirmar com `apps/web/src/features/stock/utils/` (existem? espelhar) — CLAUDE.md: CRITICAL <7d · LOW <14d · NORMAL <30d · HIGH ≥30d · VENCENDO `expDays < 90` (proposta; PO confirma).

---

## Objetivo

Expandir o módulo de Estoque de **read-only** (saldo) para **CRUD completo**:
- Registro de compras (quantidade, preço, data, farmácia, laboratório, validade, lote)
- Edição de compras (mesma tela em mode `edit`)
- Visualização de histórico de compras por medicamento
- Indicadores: previsão de reposição, custo médio unitário, dias de vencimento (KPI grid 2×2 — PO-5)
- Ajuste manual de saldo (modo único "Acertar saldo" — PO-6)
- Cross-domain: consumo diário derivado de tratamentos ativos (alto risco cache; ver §0.3)

**Fora do escopo Fase 3 v1** (decisões PO):
- ❌ Exclusão de compras (PO-1 — correção via Ajuste)
- ❌ Variant C colapsável de indicadores (PO-5 — direto pro KPI grid)
- ❌ Segmented `+ / −` em ajuste (PO-6 — só "Acertar saldo")

**Nota**: O domínio Estoque é mais complexo do que parece — envolve 2 services web (`stockService` + `purchaseService`), RPCs Supabase (`consume_stock_fifo`, `restore_stock_for_log`, `apply_manual_stock_adjustment`, `create_purchase_with_stock`), e uma view materializada (`medicine_stock_summary`).

---

## Contexto Técnico: Dualidade Stock + Purchase

Na web, o domínio de estoque é dividido em:

| Service | Responsabilidade | Linhas |
|---------|-----------------|--------|
| `stockService.js` | Saldo, consumo FIFO, ajustes, low stock alerts | 247 |
| `purchaseService.js` | CRUD de compras, histórico, preço médio | 119 |

**RPCs Supabase** (server-side):
- `consume_stock_fifo(p_medicine_id, p_quantity, p_medicine_log_id)` — consumo automático ao registrar dose
- `restore_stock_for_log(p_medicine_log_id, p_reason)` — estorno ao deletar dose
- `apply_manual_stock_adjustment(p_medicine_id, p_quantity_delta, p_reason, p_notes)` — ajuste manual
- `create_purchase_with_stock(...)` — cria purchase + entry de stock atomicamente
- `get_low_stock_medicines(p_user_id, p_threshold)` — alerta de estoque baixo

**Decisão**: No mobile, consolidar em **1 service** (`stockService.js`) que expõe ambas as funcionalidades. Na extração G2, separar se necessário.

---

## Sprint Breakdown

### Sprint S3.1 — Helpers + Service + Purchase CRUD (Semana ~10)

> **Gate alvo**: G1 (Copy)
> **Wave plan** (R-237):
> - **Wave 1 inline Opus**: S1.0 (helpers `@dosiq/core/utils/`) + S1.1/S1.2 (service consolidado) — bloqueia tudo
> - **Wave 2 spawn paralelo**: S1.3 (Sonnet useStockMutation), S1.4 (Haiku PurchaseCard), S1.7 (Sonnet PurchaseMedicineSheet), S1.10 (Haiku routes+stack)
> - **Wave 3 spawn**: S1.5 (Sonnet PurchaseForm — depende S1.3 hook + S1.4 row), S1.6 (Sonnet PurchaseHistoryScreen — depende S1.4 card)
> - **Wave 4 spawn**: S1.8 (Sonnet StockScreen expand — depende S1.7 sheet + S1.10 nav)
> - **Wave 5 inline Opus**: smoke local + smoke PO

| # | Task | Arquivos | Agente | Complexidade |
|---|------|----------|--------|-------------|
| S1.0 | **NOVO** — helpers canônicos (§0.6) | `packages/core/src/utils/stock.js` + barrel | 👤 Arquiteto | ⭐⭐ |
| S1.1 | Copiar + consolidar `stockService` + `purchaseService` para mobile | `apps/mobile/src/features/stock/services/stockService.js` | 👤 Arquiteto | ⭐⭐⭐ |
| S1.2 | Adaptar imports + validar RPCs funcionam no Hermes | (mesmo arquivo) | 👤 Arquiteto | ⭐⭐ |
| S1.3 | Hook `useStockMutation` (create + edit purchase + adjust) **com cache matrix R-236** | `apps/mobile/src/features/stock/hooks/useStockMutation.js` | 🤖 Sonnet | ⭐⭐ |
| S1.4 | Componente `PurchaseCard` (barra consumo + validade) | `apps/mobile/src/features/stock/components/PurchaseCard.jsx` | 🤖 Haiku | ⭐⭐ |
| S1.5 | Tela `PurchaseFormScreen` (modes create/edit; med travado no topo — PO-3) | `apps/mobile/src/features/stock/screens/PurchaseFormScreen.jsx` | 🤖 Sonnet | ⭐⭐⭐ |
| S1.6 | Tela `PurchaseHistoryScreen` (header resumo + PurchaseCards full + "..." → Editar) | `apps/mobile/src/features/stock/screens/PurchaseHistoryScreen.jsx` | 🤖 Sonnet | ⭐⭐ |
| S1.7 | Componente `PurchaseMedicineSheet` (R-233 statusBarTranslucent) | `apps/mobile/src/features/stock/components/PurchaseMedicineSheet.jsx` | 🤖 Sonnet | ⭐⭐ |
| S1.8 | Expandir `StockScreen` (chips filtro + FAB → sheet) + `StockDetailScreen` (FAB → form med travado — PO-2) · **regra listagem expandida PO-9** (substitui `getStockData` legacy) | `apps/mobile/src/features/stock/screens/StockScreen.jsx`, `StockDetailScreen.jsx`, `apps/mobile/src/features/stock/hooks/useStock.js` | 🤖 Sonnet | ⭐⭐⭐ |
| S1.9 | `StockStack` navigation + rotas | `apps/mobile/src/navigation/StockStack.jsx` | 🤖 Haiku | ⭐ |
| S1.10 | Atualizar `routes.js` + `RootTabs.jsx` (StockStack) | `apps/mobile/src/navigation/routes.js`, `RootTabs.jsx` | 🤖 Haiku | ⭐ |
| S1.11 | Testes do `stockService` mobile + helpers `@dosiq/core/utils/stock` | `apps/mobile/.../__tests__/`, `packages/core/.../__tests__/` | 🤖 Haiku | ⭐⭐ |

**Entrega**: smoke PO (R-234) → push → `gh pr create` → merge em `feat/crud-stock`

---

### Sprint S3.2 — Indicadores + Ajuste + Extract + Migrate (Semana ~11)

> **Wave plan**:
> - **Wave 1 inline Opus**: S2.0 (migration ajuste negativo §0.8) + handoff pro PO aplicar antes de continuar
> - **Wave 2 spawn paralelo**: S2.1 (Sonnet StockIndicators KPI grid 2×2), S2.2 (Sonnet StockAdjustment — depende migration aplicada), S2.3/S2.4 (Sonnet factories)
> - **Wave 3 spawn**: S2.5 (Sonnet parity tests factories), S2.6 (Sonnet mobile adopt) — depende Wave 2
> - **Wave 4 inline Opus**: G2 gate check + smoke PO
> - **Wave 5 spawn**: S2.8 (Opus web adopt), S2.9 (Haiku delete obsoletos), S2.10 (Haiku validate:agent)
> - **Wave 6 inline Opus**: G3 gate check + merge `feat/crud-stock` → `main`

| # | Task | Arquivos | Agente | Complexidade |
|---|------|----------|--------|-------------|
| **S2.0** | **NOVA** — Migration desbloqueando ajuste manual negativo (§0.8) + handoff PO aplicar | `docs/migrations/YYYYMMDD_allow_negative_manual_adjustments.sql` | 👤 Opus | ⭐⭐⭐ |
| S2.1 | Componente `StockIndicators` KPI grid 2×2 (PO-5 — direto v2, sem variant C) | `apps/mobile/src/features/stock/components/StockIndicators.jsx` | 🤖 Sonnet | ⭐⭐⭐ |
| S2.2 | Tela `StockAdjustmentScreen` modo único "Acertar saldo" (PO-6) + DeltaPreview + motivo · **depende S2.0 migration aplicada** | `apps/mobile/src/features/stock/screens/StockAdjustmentScreen.jsx` | 🤖 Sonnet | ⭐⭐ |
| S2.3 | Criar `createStockRepository` em `@dosiq/core/repositories/` | `packages/core/src/repositories/createStockRepository.js` | 🤖 Sonnet | ⭐⭐⭐ |
| S2.4 | Criar `createPurchaseRepository` em `@dosiq/core/repositories/` | `packages/core/src/repositories/createPurchaseRepository.js` | 🤖 Sonnet | ⭐⭐ |
| S2.5 | Parity tests factories (espelhar pattern `createProtocolRepository.test.js`) | `packages/core/src/repositories/__tests__/` | 🤖 Sonnet | ⭐⭐ |
| S2.6 | Mobile adota factories | `apps/mobile/src/features/stock/services/` | 👤 Arquiteto | ⭐⭐ |
| S2.7 | **G2 GATE CHECK** (Gate Report SQP §3 + smoke PO R-234) | | 👤 Humano | — |
| S2.8 | Web adota factories | `apps/web/src/features/stock/services/` | 👤 Arquiteto | ⭐⭐⭐ |
| S2.9 | Deletar services locais web obsoletos | (delete) | 🤖 Haiku | ⭐ |
| S2.10 | `validate:agent` web 100% green + alias propagation check vitest (AP-170) | `rtk npm run validate:agent` | 🤖 Haiku | ⭐ |
| S2.11 | **G3 GATE CHECK** | | 👤 Humano | — |

**Entrega**: smoke PO (R-234) → push → `gh pr create` → merge em `feat/crud-stock` → **merge em `main`**

**Removido vs v1**: ❌ `useStockDelete` (PO-1 sem exclusão de compras) · ❌ variant C colapsável (PO-5 direto KPI grid) · ❌ segmented delta no ajuste (PO-6 só acertar saldo)

---

## Especificações Técnicas Detalhadas

### S1.1 — `stockService.js` (Mobile — Consolidado)

**Fontes**:
- `apps/web/src/features/stock/services/stockService.js` (247 linhas)
- `apps/web/src/features/stock/services/purchaseService.js` (119 linhas)

**Consolidação mobile** (1 arquivo, ~200 linhas):

```javascript
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { validateStockCreate, validateStockDecrease, validateStockIncrease } from '@dosiq/core'
import { debugLog, errorLog } from '@shared/utils/debugLog'

export const stockService = {
  // === READS ===
  
  async getStockSummary(medicineId, userId) {
    // Usa medicine_stock_summary view
  },
  
  async getLowStockMedicines(userId, threshold = 10) {
    // RPC get_low_stock_medicines
  },
  
  async getPurchasesByMedicine(medicineId, userId) {
    // Query purchases table
  },
  
  async getAverageUnitPrice(medicineIds, userId) {
    // Weighted average calculation
  },
  
  // === WRITES ===
  
  async createPurchase(input, userId) {
    // Zod validate + RPC create_purchase_with_stock
    const validation = validateStockCreate(input)
    if (!validation.success) throw new Error(...)
    
    const { data, error } = await supabase.rpc('create_purchase_with_stock', {
      p_medicine_id: validation.data.medicine_id,
      p_quantity: validation.data.quantity,
      p_unit_price: validation.data.unit_price ?? 0,
      p_purchase_date: validation.data.purchase_date,
      p_expiration_date: validation.data.expiration_date,
      p_pharmacy: validation.data.pharmacy,
      p_laboratory: validation.data.laboratory,
      p_notes: validation.data.notes,
    })
    if (error) throw error
    return data
  },
  
  async decreaseStock(medicineId, quantity, medicineLogId) {
    // Zod validate + RPC consume_stock_fifo
  },
  
  async increaseStock(medicineId, quantity, options) {
    // Zod validate + RPC restore_stock_for_log ou apply_manual_stock_adjustment
  },
  
  async deletePurchase(id, userId) {
    // Verificação de consumo antes de deletar
    // Entry com original_quantity !== quantity → foi parcialmente consumida
  },
}
```

**Decisão de assinatura**: Diferente da web (que usa `getUserId()` singleton), mobile recebe `userId` como parâmetro explícito. Consistente com `treatmentsService.js` existente.

---

### S1.5 — `PurchaseFormScreen`

```jsx
function PurchaseFormScreen({ route, navigation }) {
  const { medicineId, medicineName } = route.params
  // Pré-seleciona medicamento — usuário navega de StockScreen → PurchaseForm
  
  const { values, errors, handleChange, validate } = useFormState(stockCreateSchema, {
    initialValues: {
      medicine_id: medicineId,
      quantity: null,
      unit_price: 0,
      purchase_date: getTodayLocal(), // hoje por default
      expiration_date: null,
      pharmacy: null,
      laboratory: null,
      notes: null,
    }
  })
  
  return (
    <ScreenContainer title={`Compra: ${medicineName}`}>
      <FormSection title="Quantidade e Preço">
        <FormInput name="quantity" label="Quantidade" keyboardType="numeric" required />
        <FormInput name="unit_price" label="Preço unitário (R$)" keyboardType="decimal-pad" />
      </FormSection>
      
      <FormSection title="Datas">
        <FormDatePicker name="purchase_date" label="Data da compra" required />
        <FormDatePicker name="expiration_date" label="Validade (opcional)" />
      </FormSection>
      
      <FormSection title="Detalhes (opcional)">
        <FormInput name="pharmacy" label="Farmácia" />
        <FormInput name="laboratory" label="Laboratório" />
        <FormInput name="notes" label="Observações" multiline />
      </FormSection>
      
      <FormActions onSubmit={handleSubmit} onCancel={() => navigation.goBack()}
        submitLabel="Registrar Compra" loading={isLoading} />
    </ScreenContainer>
  )
}
```

---

### S2.1 — `StockIndicators` — KPI Grid 2×2 (PO-5)

Usa **helpers canônicos** de `@dosiq/core/utils/stock` (§0.6). Sem if/else por enum, sem lógica de derivação local (delegada aos helpers).

```jsx
import { computeDailyConsumption, computeDaysRemaining, computeAverageUnitPrice, formatBRL } from '@dosiq/core/utils'

function StockIndicators({ medicine, stockSummary, activeProtocols, purchases }) {
  const dailyConsumption = computeDailyConsumption(activeProtocols)
  const currentStock = stockSummary?.total_quantity ?? 0
  const daysRemaining = computeDaysRemaining(currentStock, dailyConsumption)
  const avgPrice = computeAverageUnitPrice(purchases)
  const replenishmentDate = daysRemaining != null ? addDays(new Date(), daysRemaining) : null

  // KPI Grid 2×2 (PO-5 direto v2):
  //   [Saldo atual]    [Consumo diário]
  //   [Duração]        [Custo médio]
  return (
    <KpiGrid>
      <KpiCard label="Saldo atual"      value={currentStock}   unit="unidade(s)" emphasis />
      <KpiCard label="Consumo diário"   value={dailyConsumption} unit="un./dia" />
      <KpiCard label="Duração"          value={daysRemaining ?? '—'} unit="dias"
               status={daysRemaining != null && daysRemaining < 7 ? 'critico' : daysRemaining < 14 ? 'baixo' : 'normal'} />
      <KpiCard label="Custo médio"      value={avgPrice > 0 ? formatBRL(avgPrice) : '—'} />
    </KpiGrid>
  )
}
```

**Cross-domain note** (PO-5 + G7 retro): `activeProtocols` vem de `@dosiq/treatments-snapshot`. Quando treatments muda (toggleActive, edit, delete), StockDetail precisa re-renderizar consumo. Tratado via `useFocusEffect` + cache invalidation matrix em `useTreatmentMutation` (R-236).

---

### S2.2 — Ajuste Manual de Saldo (PO-6 modo único)

**Pré-condição**: migration S2.0 (§0.8) aplicada pelo PO. Sem ela, `adjustToBalance` falha em runtime quando `newBalance < currentStock` (RPC archive original bloqueia delta negativo).

```jsx
function StockAdjustmentScreen({ route, navigation }) {
  const { medicineId, currentStock } = route.params
  const { values, errors, handleChange, validate } = useFormState(adjustmentSchema, {
    initialValues: { new_balance: null, reason: null, notes: null }
  })

  const delta = values.new_balance != null ? values.new_balance - currentStock : null

  return (
    <ScreenContainer title="Acertar saldo">
      <FormSection>
        <DataPill label="Saldo atual" value={`${currentStock} un.`} />
        <FormInput name="new_balance" label="Novo saldo" keyboardType="numeric" required />
        {delta != null && <DeltaPreview from={currentStock} to={values.new_balance} />}
        <FormSelect name="reason" label="Motivo" options={ADJUSTMENT_REASONS} required />
        <FormInput name="notes" label="Observações" multiline />
      </FormSection>
      <FormActions submitLabel="Acertar saldo" onSubmit={handleSubmit} />
    </ScreenContainer>
  )
}
```

**ADJUSTMENT_REASONS** (§0.8 — alinhado com migration S2.0):
- delta negativo: `perda`, `doacao`, `descarte`, `vencimento_manual`, `correcao_erro`, `outro`
- delta positivo: `ajuste_manual_positivo`, `correcao_erro`, `outro` (reusa set existente archive)

---

## Novas Rotas

```javascript
// routes.js — adições
export const ROUTES = {
  // ... existentes ...

  // Sub-rotas de Estoque (expand)
  STOCK_MAIN: 'StockMain',                     // [NEW] renomear de STOCK
  STOCK_DETAIL: 'StockDetail',                 // [NEW] detalhe por medicamento
  PURCHASE_FORM: 'PurchaseForm',               // [NEW] mode: 'create' | 'edit'
  PURCHASE_HISTORY: 'PurchaseHistory',         // [NEW]
  STOCK_ADJUSTMENT: 'StockAdjustment',         // [NEW]
  // ❌ PURCHASE_DELETE removido (PO-1)
}
```

**Navegação** (PO-2 FAB ubíquo + PO-3 form sempre med travado):
- `StockMain → FAB` → `PurchaseMedicineSheet` → `PurchaseForm` (medicineId travado, mode=create)
- `StockMain → StockCard tap` → `StockDetail`
- `StockDetail → FAB` → `PurchaseForm` direto (medicineId travado, mode=create, skip sheet)
- `StockDetail → "Ver todas"` → `PurchaseHistory`
- `PurchaseHistory → "..." em PurchaseCard` → `PurchaseForm` (medicineId travado, mode=edit, purchaseId param)
- `StockDetail → "Acertar saldo"` → `StockAdjustment`

---

## Estrutura de Diretórios (Resultado Final)

```
apps/mobile/src/
  features/
    stock/                                  ← [EXPAND]
      components/
        StockItem.jsx                       ← existente (refactor → StockCard)
        StockLevelBadge.jsx                 ← existente
        PurchaseCard.jsx                    ← [NEW]
        StockIndicators.jsx                 ← [NEW] KPI grid 2×2 (PO-5)
        PurchaseMedicineSheet.jsx           ← [NEW] R-233 statusBarTranslucent
        StockFilterChips.jsx                ← [NEW] todos/baixo/vencendo/crítico
      hooks/
        useStock.js                         ← existente (expandir + cache matrix)
        useStockDetail.js                   ← [NEW] cross-domain w/ treatments
        _stockDataTransformer.js            ← existente
        useStockMutation.js                 ← [NEW] create + edit purchase + adjust
        # ❌ useStockDelete removido (PO-1)
      screens/
        StockScreen.jsx                     ← [MODIFY] chips + FAB → sheet (PO-2)
        StockDetailScreen.jsx               ← [NEW] hero + KPI grid + history + FAB direct
        PurchaseFormScreen.jsx              ← [NEW] mode create/edit, med travado (PO-3/4)
        PurchaseHistoryScreen.jsx           ← [NEW]
        StockAdjustmentScreen.jsx           ← [NEW] modo único Acertar saldo (PO-6)
      services/
        stockService.js                     ← [REPLACE] thin → full CRUD (sem delete)
        __tests__/
          stockService.test.js              ← [NEW]
      utils/
        # ❌ stockCalculations.js movido pra @dosiq/core/utils/stock.js (canônico web↔mobile)
  navigation/
    StockStack.jsx                          ← [NEW]
    RootTabs.jsx                            ← [MODIFY] use StockStack
    routes.js                               ← [MODIFY] add STOCK routes

packages/core/src/
  utils/
    stock.js                                ← [NEW] helpers canônicos (§0.6)
    index.js                                ← [MODIFY] re-export (audit barrel — AP-164)
    __tests__/
      stock.test.js                         ← [NEW]
  repositories/                             ← R-231 + ADR-045 (não shared-data)
    createStockRepository.js                ← [NEW] G2
    createPurchaseRepository.js             ← [NEW] G2
    __tests__/
      createStockRepository.test.js         ← [NEW] parity tests
      createPurchaseRepository.test.js      ← [NEW] parity tests
```

---

## Quality Gates — Fase 3

### G1 — Gate de Cópia

| Critério | Validação |
|----------|-----------|
| Helpers canônicos `@dosiq/core/utils/stock.js` criados + testados | Teste unitário (>=10 tests) |
| `stockCreateSchema` com refinements funciona no Hermes | Teste unitário |
| RPCs Supabase (`create_purchase_with_stock`, `consume_stock_fifo`, `apply_manual_stock_adjustment`) | Smoke test no simulador |
| Purchase form (create+edit) cria entrada + atualiza saldo | Demo gravada |
| FAB ubíquo (Hub + Detail) funciona conforme PO-2/PO-3 | Smoke PO |
| `StockIndicators` KPI grid 2×2 calcula corretamente | Smoke PO |
| Regra listagem expandida PO-9 (`hasActiveProtocol \|\| totalStock > 0`) ativa em StockScreen — meds órfãos (sem treatment) aparecem | Smoke PO + grep `getStockData` ausente |
| Migration S2.0 (`allow_negative_manual_adjustments`) aplicada em produção pelo PO antes de S2.2 | Confirmação PO |
| Cache invalidation matrix documentada em `useStockMutation` (R-236) | Code review |
| Bottom sheets com `statusBarTranslucent` (R-233) testado em Android API 24 | Smoke PO Android |
| **Smoke PO (R-234) concluído antes de `gh pr create`** | Confirmação PO |
| `validate:agent` web 100% green | `rtk npm run validate:agent` |

### G2 — Gate de Extração

| Critério | Validação |
|----------|-----------|
| Factories em `@dosiq/core/repositories/` (R-231 + ADR-045) — NÃO em shared-data | Path verification |
| `createStockRepository` + `createPurchaseRepository` aceitam injection (DI) | Teste unitário |
| Parity tests com mocked client (espelhar `createProtocolRepository.test.js`) | >=15 tests por factory |
| Mobile usa factories — todos os testes passam | CI |
| Barrel `@dosiq/core/utils/index.js` auditado (AP-164 — sem naming collision) | Grep consumers |
| Diff < 5% | `rtk diff` |
| Smoke PO G2 | Confirmação PO |

### G3 — Gate de Migração

| Critério | Validação |
|----------|-----------|
| Web `stockService.js` + `purchaseService.js` usam factories | Grep |
| `vitest.config.js` + `vitest.critical.config.js` alias `@dosiq/core` propagado (AP-170) | Run `validate:agent` |
| `validate:agent` web 100% green + build OK | CI |
| Services locais web DELETADOS | `find` verification |
| `npx expo export` mobile — 0 erros | CI |
| Smoke PO G3 (E2E completo: criar/editar compra, ajustar saldo, ver KPIs, filtros, FAB ubíquo) | Confirmação PO |
| DEVFLOW C5 aplicado pós-merge (R/AP/ADR + journal + state.json counters) | `.agent/` audit |

---

## Delegação de Agentes (Cavecrew SQP §4 v2.0)

Brief obrigatório R-230 (6 itens) em TODO spawn. Recalibração pós-Fase 2: Sonnet cap 4 arquivos, Haiku cap 2.

| Task ID | Agente | Motivo |
|---------|--------|--------|
| S1.0 | 👤 Opus | Helpers canônicos (decisão de API web↔mobile) |
| S1.1-S1.2 | 👤 Opus | Consolidação 2 services + validar RPCs Hermes |
| S1.3, S1.5, S1.6, S1.7, S1.8 | 🤖 Sonnet ⭐⭐ | Componentes/hooks complexos (cache matrix, sheet R-233, form mode dual, KPI cross-domain) |
| S1.4, S1.9, S1.10, S1.11 | 🤖 Haiku ⭐ | Tasks mecânicas (card simples, nav files, tests espelhados) |
| S2.0 | 👤 Opus | Migration SQL crítica (desbloqueia delta negativo + audit FIFO + grants/RLS) |
| S2.1, S2.2 | 🤖 Sonnet ⭐⭐ | KPI grid 2×2 + ajuste com DeltaPreview (UX complexa, mas pattern claro). S2.2 depende S2.0 mergeada |
| S2.3, S2.4, S2.5 | 🤖 Sonnet ⭐⭐ | Factories — espelhar `createProtocolRepository` pattern (validado Fase 2) |
| S2.6, S2.8 | 👤 Opus | Adopção mobile + web (mudança em arquivos sensíveis cross-feature) |
| S2.9, S2.10 | 🤖 Haiku ⭐ | Delete obsoletos + validate:agent |

---

## Risco Especial: RPCs Supabase

> [!WARNING]
> O domínio Estoque depende de 4 RPCs server-side que executam lógica atômica no PostgreSQL.
> Essas RPCs já existem e são usadas pela web — **não precisam ser criadas**.
> Porém, testar no mobile é obrigatório pois o `nativeSupabaseClient` pode ter behaviors diferentes do browser client (auth header, connection pooling).
>
> **Ação**: Sprint S3.1, task S1.2 deve incluir teste manual de cada RPC no simulador.

## Risco Especial: Cross-Domain Cache (G7 RETRO_FASE2)

> [!WARNING]
> Fase 3 é a **primeira fase com 3 snapshots interdependentes**:
> - `@dosiq/stock-snapshot` (saldo, status)
> - `@dosiq/purchases-snapshot` (histórico)
> - `@dosiq/treatments-snapshot` (daysRemaining depende de consumo de tratamentos ativos)
>
> **Pattern obrigatório** (R-236 — ver §0.3): toda mutation em qualquer dos 3 hooks DEVE listar inline TODOS os snapshots que invalida. Esquecer = bug latente (refresh on focus pode salvar, mas falha em rede instável).
>
> **Caches a auditar retroativamente** (P6 do plano de ação RETRO_FASE2):
> - `useTreatmentMutation.toggleActive/create/update/delete` — passar a invalidar `stock-snapshot` (afeta daysRemaining)
> - `useProtocolMutation.create/update/delete` — idem
> - `useStockMutation.create/update/adjust` — invalida treatments-snapshot (daysRemaining recalculado)
> - LogForm dose (consume_stock_fifo) — invalida stock + treatments

---

## Changelog

### v2.1 — 2026-05-19 (alignment com archive_old/stock_refactor + bug listagem PO-9 + ajuste negativo)
- **§0.5 adicionados PO-9 + PO-10**: regra listagem expandida (hasActiveProtocol OR totalStock>0 — corrige bug produção atual via reescrita Wave 4) + regulatory_category fora escopo v1
- **§0.6.5 NOVO** — Alignment com archive_old/stock_refactor: cataloga modelo canônico (purchases/stock/stock_adjustments/stock_consumptions/medicine_stock_summary view + 4 RPCs + entry_type filter Phantom Stock fix). Define regras read-side (sempre purchases pra histórico, nunca filtro `notes LIKE`) e write-side (nunca insert direto stock, sempre RPC)
- **§0.7 NOVO** — Detalha regra PO-9 com query refactor pra Wave 4 + lista cenários quebrados em produção (med órfão / treatment finalizado / treatment pausado Fase 2.5)
- **§0.8 NOVO** — Migration pendente Wave 5: desbloqueia `apply_manual_stock_adjustment` pra delta negativo (PO-6 modo único requer; archive §1.1 regra 6 bloqueava por conservadorismo). Define comportamento novo + reasons aceitos + handoff PO aplica
- **Sprint Breakdown S3.2** reorganizado: nova S2.0 (migration negativa Opus inline) bloqueia S2.2 (StockAdjustmentScreen) · S1.8 (StockScreen) inclui fix PO-9 substituindo getStockData legacy
- **Quality Gates G1** + 2 critérios: regra listagem PO-9 + migration S2.0 aplicada
- **Delegação** atualizada com S2.0 Opus

### v2 — 2026-05-18 (pós-RETRO_FASE2 + absorção mocks designer)
- **§0 NOVO** — Cuidados aprendidos pré-Fase 3 (consolidado RETROs Fase 1+2): arquitetura compartilhada, mobile patterns, cache invalidation matrix CRÍTICA, processo SQP §§10-13, decisões PO PO-1..PO-8, helpers canônicos §0.6
- **Factory paths corrigidos**: `packages/shared-data/src/services/` → `packages/core/src/repositories/` (R-231 + ADR-045)
- **Escopo cortado** (decisões PO mocks Fase 3):
  - ❌ `useStockDelete` + `deletePurchase` + verificação consumo parcial (PO-1)
  - ❌ Variant C colapsável de indicadores (PO-5 — direto KPI grid 2×2)
  - ❌ Segmented `+ / −` em ajuste (PO-6 — só "Acertar saldo")
- **Escopo expandido**:
  - Editar compra (PO-4) — mesma tela, mode prop
  - FAB ubíquo Hub + Detail (PO-2)
  - PurchaseMedicineSheet (sheet seleção do FAB Hub — R-233)
  - Helpers canônicos `@dosiq/core/utils/stock.js` (S1.0 nova task)
- **Sprint Breakdown** reorganizado em Waves (R-237) com agentes recalibrados (SQP §4 v2.0)
- **Quality Gates** expandidos: smoke PO (R-234), cache matrix (R-236), R-233 Android API 24, AP-170 vitest config, helpers canônicos, DEVFLOW C5 pós-merge
- **Risco Especial Cross-Domain Cache** adicionado (G7 RETRO_FASE2) com lista retroativa de hooks a auditar
- **Delegação** atualizada pra cavecrew matrix v2.0 (Sonnet cap 4, Haiku cap 2, brief R-230 obrigatório)

### v1 — 14/05/2026 (inicial)
- Sprint breakdown G1/G2/G3, especificações S1.1-S2.4, estrutura diretórios, quality gates básicos
