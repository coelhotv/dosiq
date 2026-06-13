# Analysis — 012 Fase B4 (C1.5 Reality Check)

**Tier:** 2 (cálculo core + cross-platform display + migração schema) · **ADRs:** ADR-067, ADR-068 (proposed)
**Data:** 2026-06-13 · Gate: C1.5 antes do C2. **Depende da B3** (densidade certa → doseMl correto).

## 1. Evidence Table (claim × repo real)

| Claim (spec/plan) | Real (file:line) | ✅ | Nota |
|---|---|---|---|
| `stock.js` conta dias corridos | `resolveStockStatus` `daysRemaining=qty/dailyConsumption` ([stock.js:56](../../../packages/core/src/utils/stock.js#L56)) | ✅ | métrica única atual; B4 adiciona doses |
| `frequencyDailyFactor(p)` existe | [adherenceLogic.js:287](../../../packages/core/src/utils/adherenceLogic.js#L287), exportado `utils/index.js:49` | ✅ | reuso direto p/ runway |
| `time_schedule` é array no protocol | adherenceLogic.js:65/321 `time_schedule?.length \|\| 1` | ✅ | `tomadasPorDia` = `.length` (fallback 1) |
| `doseToMl(dosage,intakeUnit,unitsPerMl,mgConcentration)` | [adherenceLogic.js:265](../../../packages/core/src/utils/adherenceLogic.js#L265) | ✅ | líquido → doseMl (já unit-aware pós-B3) |
| `costAnalysisService` é web-only | `apps/web/.../costAnalysisService.js`; `monthlyCost=dailyIntake×avgUnitPrice×30` | ✅ | +`custoPorDose`; `costAnalysisSchema` |
| `refillPredictionService` existe | `apps/web/src/features/stock/services/refillPredictionService.js` | ✅ | data = hoje + runwayDias |
| badges: `StockPill`(web) | `apps/web/src/features/protocols/components/redesign/StockPill.jsx` | ✅ | "N doses/aplicações" |
| `StockCardRedesign`(web) | `apps/web/src/features/stock/components/redesign/StockCardRedesign.jsx` | ✅ | detalhe: doses+custo/dose primários |
| `StockLevelBadge`+`StockItem`(mobile) | `apps/mobile/src/features/stock/components/` | ✅ | espelho mobile |
| Telegram `/estoque` | `server/bot/commands/estoque.js` | ✅ | doses + runway-contexto |
| `INJECTION_CONTAINER_SINGULAR` | medicineSchema.js:78 (enum tem `refil`) | ✅ | rótulo "N aplicações" |
| `injection_container` em medicines | [medicineSchema.js:202](../../../packages/core/src/schemas/medicineSchema.js#L202) + migr. `20260612_b2_injection_container_refil.sql` | ✅ | **medicine-level → ADR-068 move p/ lote + DROP** |
| `formatActiveIngredientShort` sem cleanFloat | [doseUnit.js:386](../../../packages/core/src/utils/doseUnit.js#L386) `formatNumberPtBR(total)` | ✅ | legacy edge folded-in (R-277) |
| cron conta ml÷UI cru (FR-013c) | [_reminderHelpers.js:511-530](../../../server/bot/_reminderHelpers.js#L511) `dailyConsumption` soma `dosage_per_intake` cru; `floor(stock.qty/dailyConsumption)` | ✅ | Lantus 5,3ml/10UI→0; sem `doseToMl`/`frequencyDailyFactor` |
| payload rotula ml como "doses" | [_payloadBuilders.js:148-156](../../../server/notifications/payloads/_payloadBuilders.js#L148) `remaining: stock.qty` → "Restam X doses" | ✅ | T045 corrige unidade (R-272) |
| `predictRefill` sem frequencyDailyFactor | [refillPredictionService.js:54-59](../../../apps/web/src/features/stock/services/refillPredictionService.js#L54) `activeIntakePerDay` sem fator | ✅ | converte ml mas trata semanal=diário → diverge do stock card |

## 2. Behavioral Failure Modes (R-270 — por função nova/alterada)

### `stockDoseMetrics(...)` (novo — FR-026, ADR-067)
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| estoque | 0 / NULL | `diasDeTomada=0` (não NaN/∞) | T044 |
| dosePorTomada | 0 / NULL | retorno honesto (sem divisão → 0 ou null, nunca ∞) | T044 |
| `time_schedule` | `[]` / undefined | `tomadasPorDia=1` (fallback existente) | T044 |
| `frequencyDailyFactor` | freq não mapeada | factor seguro (1) ou erro explícito — não `runway=∞` | T044 |
| líquido sem densidade | `doseToMl`→null (B3) | propaga honesto (sem doseMl fantasma) | T044 |
| diário | factor=1 | `diasDeTomada == runway` (sem regressão) | T044 |

### `custoPorDose` (FR-027, ADR-067)
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| dosesPorUnidade | 0 | sem custo/dose (não ÷0) | T044 |
| sem preço | hasPriceData=false | custo/dose 0 (consistente com monthlyCost atual) | T044 |
| custoPorDia derivado | dízima `0,0714…` | **formatado** (limite casas) | T044 |

### `resolveStockStatus` (semântica do input muda — ADR-067)
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| runwayDias | usado p/ cor (não doses) | CRITICAL<7/LOW<14/NORMAL<30 sobre **runway** | T044 |
| diário | doses==runway | cor idêntica à de hoje (sem regressão) | T044 |

## 3. Data-Migration Completeness (ADR-068)
- **Mover + DROP**: copiar `medicines.injection_container` p/ os lotes (`stock`/`purchases`) correspondentes,
  depois `ALTER TABLE medicines DROP COLUMN injection_container`. Idempotente; `IF EXISTS`.
- Coluna nova no lote: `injection_container text NULL` com CHECK = `INJECTION_CONTAINERS` (R-271), Grants+RLS
  conforme template CLAUDE.md.
- **Verificação** pós-apply: cada lote de injetável tem container herdado do medicine; `medicines` não tem
  mais a coluna; form de compra grava em lote novo.
- FR-026..029 **sem migração de dados** (camada de cálculo/apresentação).
- Autorização explícita PO antes de aplicar (prod mutation).

### Cron `_processUserStockAlert` (FR-013c, ADR-067) — T045
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| líquido UI sem conversão | Lantus 5,3ml/10UI/dia | runway≈53d → **não dispara** (não "0 dias") | T045 jest |
| `frequencyDailyFactor` | semanal | runway corrigido (não conta dose diária) | T045 jest |
| payload `remaining` | ml | exibe doses + unidade correta (R-272), não "X doses"=ml | T045 jest |
| sólido | inalterado | regressão zero | T045 jest |

### `predictRefill` (ADR-067) — T046
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| semanal (Mounjaro) | sem fator → conta diário | aplica `frequencyDailyFactor` → 28d (= stock card) | T046 |
| diário | fator=1 | sem regressão | T046 |

## 4. Coverage (FR → task)
FR-026→T039/T044 · FR-027→T040/T044 · FR-028→T041/T042/T044 · FR-029→T043 · FR-030→T044b (migração+forms) ·
**FR-013c→T045** (cron, puxado D→B4) · **regressão card tratamento→T046** · legacy edge cleanFloat→T039 (mesma fase).
SC-002c → T044 (doses×runway por frequência, custo/dose, diário sem regressão, label).

## 5. Cross-file consistency
spec FR-026..030 ↔ plan B4 (ADR-067/068) ↔ tasks T038..T044b ↔ este analysis: **concordam**. Ajuste vs rascunho:
FR-030 `medicines.injection_container` **dropado** (não "default opcional") — decisão PO 2026-06-13, refletida em
ADR-068, plan e tasks.

## Resultado
Sem CRITICAL/HIGH. Evidência ✅ (todos os alvos verificados em disco); cross-file consistente; migração ADR-068
completa com verificação; failure modes mapeados com teste. **Apto a C2** (após aprovação dos ADRs 067/068 — proposed).
Riscos MEDIUM: (a) `resolveStockStatus` muda semântica do input → mapear TODOS callers em T038 (R-267); (b) custo/dose
para sólido (dosesPorUnidade) precisa convenção clara — derivar de rendimento FR-020/unidades por embalagem em T040.
