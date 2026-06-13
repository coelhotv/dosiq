# Analysis — 012 Fase B3 (C1.5 Reality Check)

**Tier:** 2 (migração + RPC + cross-platform) · **ADRs:** ADR-065, ADR-066 (accepted)
**Data:** 2026-06-13 · Gate: C1.5 antes do C2.

## 1. Evidence Table (verificado contra repo + prod)

| Claim (spec/plan) | Real (file:line / prod) | ✅ | Nota |
|---|---|---|---|
| `units_per_ml` tem DEFAULT 20 | prod `information_schema`: `column_default='20'` | ✅ | blanket confirmado |
| Backfill é pequeno | prod: 6 líquidos / 111 medicines; 0 ui/ml carimbado20; 0 mg/ml sem concentração | ✅ | 3 linhas 20→NULL (Durateston, Xarope, Tresiba=ml/sem-trat); Dipirona(gotas)=20 e Lantus(UI)=100 ficam | 
| RPC blanket 20 | `consume_stock_fifo` live: `COALESCE(NULLIF(units_per_ml,0),20)` no SELECT; ramo `IN ('gotas','ui') → p_quantity/v_units_per_ml` | ✅ | trocar por unit-aware (gotas→20, UI→100) na branch |
| RPC mg usa concentração | live: ramo `mg` já usa `v_concentration=dosage_per_pill`, erro se NULL | ✅ | inalterado (B2) |
| `doseToMl` blanket 20 | `adherenceLogic.js:273` `density = unitsPerMl>0 ? unitsPerMl : 20` | ✅ | unit-aware |
| `formatIntakeDose` blanket 20 | `doseUnit.js:251` fallback `units_per_ml>0 ? ... : 20` | ✅ | unit-aware |
| coluna `concentration_volume_ml` não existe | prod: `col_ja_existe=false` | ✅ | ADD COLUMN nullable |
| RPC NÃO depende de `concentration_volume_ml` | live usa `dosage_per_pill` (já normalizado) | ✅ | denominador é só form+display |
| `intake_unit` CHECK = gotas/ml/UI/mg | migração B2 (em prod) | ✅ | domínio fechado → ELSE da RPC = ml |
| medicineSchema tem `units_per_ml` | `packages/core/src/schemas/medicineSchema.js` (B2) | ✅ | +`concentration_volume_ml` nullable (R-082/R-267) |

## 2. Behavioral Failure Modes (R-270 — por função nova/alterada)

### `densityFor(intakeUnit, unitsPerMl)` (novo helper core — FR-024)
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| unitsPerMl | NULL / 0 | gotas→20, UI→100, mg→(n/a, usa dpp), else→erro | T037 |
| intakeUnit | 'ml' | sem densidade (dose direta) | T037 |
| intakeUnit | fora do enum | não ocorre (CHECK), mas defensivo→erro | T037 |

### RPC `consume_stock_fifo` ramo líquido (FR-024)
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| units_per_ml | NULL, UI | usa 100 (não 20) | T037 (pgTAP/jest BEGIN..ROLLBACK) |
| units_per_ml | NULL, gotas | usa 20 | T037 |
| v_concentration (mg) | NULL | RAISE (já) | T037 |
| v_remaining | arredonda 0 | RAISE (já) | existente |

### Normalização denominador (FR-031 — form)
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| denominador | 0 / vazio | erro (não divide por zero) | T037d |
| denominador | 1 (default) | passthrough; coluna NULL | T037d |
| denominador | vírgula '0,5' | coerceDecimal→0.5 (R-276) | T037d |
| concentration_volume_ml | NULL na exibição | `× COALESCE(...,1)` = "por 1 mL" | T037d |

## 3. Data-Migration Completeness
- **DROP DEFAULT** `units_per_ml` + **UPDATE backfill** (derivado de `protocols.intake_unit`: UI→100, gotas→20, mg/ml-sem-trat→NULL) + **ADD COLUMN** `concentration_volume_ml NUMERIC NULL`, numa migração idempotente.
- **Verificação** pós-apply: `SELECT units_per_ml, count(*) ... GROUP BY` (esperar 3×NULL novos, Dipirona=20, Lantus=100, Mounjaro=NULL); `col_ja_existe=true`.
- RPC reescrita do `pg_get_functiondef` ao vivo (AP-217), **assinatura intacta** (AP-221) — sem novo arg, sem overload (AP-209).
- Autorização explícita do PO antes de aplicar (prod mutation).

## 4. Coverage (FR → task)
FR-023→T031/T032/T033 · FR-024→T034/T035/T037 · FR-025→T036 · FR-031→T037b(migr)/T037c(form)/T037d(test). SC-002c (B4) não entra aqui.

## Resultado
Sem CRITICAL/HIGH. Evidência ✅; cross-file consistente; migração de dados completa com verificação; failure modes mapeados com teste. **Apto a C2.** Riscos MEDIUM: tie-break multi-tratamento no backfill (mitigado — dados atuais não têm o caso) e UI→100 default silencioso (mitigado por FR-025 form obrigatório).
