# Artifact Coverage Analysis — 012 Fase B2 (Canetas GLP-1)

**Gerado**: 2026-06-12 (C1.5 DEVFLOW, Tier 2) · **Escopo**: FR-017..022 / T023..030
**Método**: verificado contra o repo (find/grep/Read) + prod (MCP read-only, project `kwqjtdsqkkbebfiaxubb`).

## 1. Evidence Table

| Spec claim | Real repo / prod (ref) | Verified? | Note |
|---|---|---|---|
| CHECK `protocols_intake_unit_check` = `IN ('gotas','ml','UI')` | prod MCP `pg_get_constraintdef` | ✅ | alvo: +`'mg'` (R-271 exato) |
| Enum Zod `INTAKE_UNITS = ['gotas','ml','UI']` | `packages/core/src/schemas/protocolSchema.js:74` | ✅ | alvo: +`'mg'`; mensagem L194 cita "(gotas, ml ou UI)" — atualizar |
| `consume_stock_fifo(uuid,uuid,numeric,uuid)` ramo sub-ml `IN ('gotas','ui')` | prod MCP `pg_get_functiondef` | ✅ | alvo: +`'mg'`; assinatura **inalterada** (sem AP-209/overload) |
| RPC default densidade `COALESCE(NULLIF(units_per_ml,0),20)` | mesma fn, prod | ✅ | 20 inadequado p/ mg (FR-018) — form bloqueia; RPC mantém fallback |
| `medicines_presentation_check` inclui `injetavel` | prod MCP | ✅ | container é coluna **nova**, não toca presentation |
| **sem** coluna `medicines.injection_container` | grep medicineSchema + prod | ✅ | net-new (FR-019) |
| Enum `PRESENTATIONS` + `PRESENTATION_LABELS` | `medicineSchema.js:36,46` | ✅ | injetavel L40 |
| `formatDose(v,unit)` ramo genérico `${v} ${unit}` | `doseUnit.js:159` | ✅ | **`mg` já exibe** "0,25 mg" sem mudança |
| `formatIntakeDose` líquido intake≠ml → ramo densidade | `doseUnit.js:184-191` | ✅ | mg cai aqui → "0,25 mg (≈ X ml)"; fallback 20 só p/ display |
| `stockUnitLabel`/`formatStockCount` líquido→'ml' | `doseUnit.js:54,69` | ✅ | rendimento em aplicações = helper **novo** (FR-020) |
| auto-avanço `_processProtocolTitration` + trava otimista | `server/bot/_reminderHelpers.js` (PR #659) | ✅ | N1 estende: ramo `requires_new_medicine` |
| sufixo wizard `intakeSuffix` | `TitrationWizard.jsx` (PR #659) | ✅ | reusar p/ 'mg' |

**Nenhuma claim ❌/UNVERIFIED.** Sem alvo de path errado (caller vs definição).

## 2. Cross-File Consistency
spec.md (FR-017..022) ↔ plan.md (§Fase B2) ↔ tasks.md (T023..030) — concordam: migração CHECK+RPC, container net-new, rendimento floor, N1 CTA. Sem contradição (ex.: ambos dizem RPC = **uma** alteração de corpo, assinatura intacta).

## 3. Data-Migration Completeness
- **intake_unit += 'mg'**: aditivo a CHECK — linhas existentes (gotas/ml/UI) inalteradas; sem backfill (nenhuma linha tinha 'mg'). ✅
- **injection_container**: coluna nullable nova — linhas existentes ficam NULL (fallback "unidade" no rótulo). Sem backfill obrigatório. ✅
- **RPC**: `CREATE OR REPLACE` a partir do `pg_get_functiondef` ao vivo (AP-217) — preserva guards (posse, entry_type FIFO, opened_at, SECURITY DEFINER, search_path=''). ✅
- **PostgREST cache** (AP-209): assinatura não muda → sem "function not unique"/cache stale. Aplicar migração antes de subir app por segurança. ✅

## 4. Coverage (FR→task / SC→C4)
FR-017→T024+T024b+T025+T026 · FR-018→T026(label)+T027(validação) · FR-019→T024(coluna)+T028(captura) · FR-020→T026(floor)+T028(UI) · FR-021→T029 · FR-022→T027+T028. SC-002b→T030 (RPC mg, rejeição sem densidade, floor, container fallback, CTA sem mudar dose).

## 5. Behavioral Failure Modes (novas/alteradas)

**RPC `consume_stock_fifo` (ramo mg)** — T024b:
| Input/condição | Degenerado | Esperado | Teste |
|---|---|---|---|
| `units_per_ml` p/ mg | NULL/0 | `COALESCE(...,20)` → ml errado, MAS form (FR-018) garante densidade; RPC não trava | T030 (doc + guard no form) |
| `p_quantity` mg | 0/negativo | `RAISE 'Quantidade ... maior que zero'` (já existe L:guard) | T030 |
| `mg ÷ densidade` arredonda | →0 | `RAISE 'Dose muito pequena ... 0 ml'` (já existe) | T030 |
| intake_unit caixa | `'MG'`/`'Mg'` | `lower(...) IN (...,'mg')` cobre | T030 |
| estoque < ml | — | `RAISE 'Estoque insuficiente'` (já existe) | T030 |

**Helper rendimento `formatStockApplications(ml, dosePerApplicationMl, container)`** — T026 (novo):
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| `dosePerApplicationMl` | 0/NULL | retorna saldo cru "X ml" (sem divisão por 0) — não inventa aplicações | T030 |
| `ml` | 0 | "0 aplicações" / floor 0 | T030 |
| divisão | residual (overfill) | **floor**, nunca arredonda p/ cima | T030 |
| `container` | NULL | rótulo "unidade(s)" (fallback FR-019) | T030 |
| `ml`/dose string vírgula | '1,5' | normaliza `,`→`.` antes Number (R-270/AP-167) | T030 |

**Helper rótulo `formatConcentrationLabel(mgPerMl)`** "[X] mg em [Y] mL" — T026:
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| `mgPerMl` | NULL/0 | '' (sem rótulo; form exige antes de salvar) | T030 |
| vírgula | '0,68' | normaliza | T030 |

**N1 `requires_new_medicine`** — T029:
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| etapa flag true vence | — | NÃO muda `expected_dose`; emite CTA kind novo | T030 |
| trava otimista | linha mudou sob cron | no-op (AP-185/268 reusado do #659) | T030 |
| kind novo | enum Zod desatualizado | adicionar a `dispatchInputSchema` (R-193/AP-115) senão rejeitado | T030 |

**Zod `INTAKE_UNITS += 'mg'`** — T025:
| Input | Degenerado | Esperado | Teste |
|---|---|---|---|
| cap dose mg | 0,25–15 frações | `.positive()` + cap revisado; `??` p/ 0 não aplicável (dose>0) | T030 |
| CHECK↔enum | drift | sincronizado exato (R-082/R-271) | T030 |

## Severity & Gate
Nenhum CRITICAL/HIGH. Riscos MEDIUM: (a) fallback 20 da RPC permanece p/ mg sem densidade — mitigado por FR-018 no form, não na RPC (decisão: RPC não deve falhar tomada; form é a barreira); (b) display `≈ml` em formatIntakeDose usa fallback 20 — cosmético. **Gate: PASS → C2.**
</content>
