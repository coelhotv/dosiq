# Analysis (C1.5 Reality Check) — 032 Biomarcador PA

**Tier**: 2 | **Date**: 2026-06-15 | **Gate**: rodado contra o repo real (find/grep/Read).

## 1. Evidence Table

| Spec/plan claim | Real repo (file:line) | Verified? | Note |
|---|---|---|---|
| `BIOMARKER_TYPES` inclui `pressao_arterial` | `packages/core/src/schemas/biomarkerLogSchema.js:16` | ✅ | enum já tem |
| `applyPaRefine` exige `value_secondary` p/ PA | `biomarkerLogSchema.js:86-101` | ✅ | já cruza type↔value_secondary |
| `context` = `z.enum(BIOMARKER_CONTEXTS).nullable().optional()` | `biomarkerLogSchema.js:75` | ✅ | enum único hoje |
| CHECK SQL fechado em `context` | `docs/migrations/20260614_diabetes_c_biomarkers.sql:22-24` | ✅ | `IN ('jejum','pre_refeicao','pos_refeicao','ao_deitar','outro')` — sem nome explícito de constraint |
| Exports do schema via index | `packages/core/src/schemas/index.js:85-98` | ✅ | add `BIOMARKER_PA_CONTEXTS`/labels aqui |
| `formatMeasure` local usa `/` — mobile MeasureCard | `apps/mobile/.../components/MeasureCard.jsx:14-19` | ✅ | trocar p/ helper core "por" |
| `formatMeasure` local — mobile MeasureDetailSheet | `apps/mobile/.../components/MeasureDetailSheet.jsx:12-14` | ✅ | idem |
| `formatMeasure` local — web BiomarkerEventCard | `apps/web/.../history/BiomarkerEventCard.jsx:27-33` | ✅ | idem |
| `formatMeasure` local — web LastMeasureCard | `apps/web/.../components/LastMeasureCard.jsx:10-13` | ✅ | idem |
| Cards exibem ctx via `BIOMARKER_CONTEXT_LABELS` | MeasureCard.jsx:30, BiomarkerEventCard (import) | ✅ | precisam resolver labels PA → helper `formatBiomarkerContext` |
| `UI_TYPES = ['glicemia','peso']` mobile sheet | `apps/mobile/.../components/MeasureLogSheet.jsx:28` | ✅ | add PA |
| `HUB_TYPES = ['glicemia','peso']` mobile screen | `apps/mobile/.../screens/MeasuresScreen.jsx:21` | ✅ | add PA |
| `HUB_TYPES = ['glicemia','peso']` web hub | `apps/web/.../components/MeasuresHub.jsx:5` | ✅ | add PA |
| ScatterTrend usa `it.value` (1 série) web | `apps/web/.../components/ScatterTrend.jsx:62` | ✅ | add prop isPa |
| ScatterTrend usa `item.value` (1 série) mobile | `apps/mobile/.../components/ScatterTrend.jsx` | ✅ | add prop isPa |
| `formatBiomarkerDisplay`/`formatBiomarkerContext` não existem | grep core = 0 matches | ✅ | criar (sem duplicação) |
| `coerceDecimal` existe no core (vírgula PT-BR) | importado em MeasureLogSheet.jsx:15 | ✅ | reusar p/ valueSec |

## 2. Cross-File Consistency

- spec ↔ plan ↔ tasks: **OK** após correção SC-003 (era "zero migração"; agora "1 migração DROP CONSTRAINT"). Pré-requisito do topo da spec também corrigido.
- ADR-070 ↔ R-271: **resolvido, não-contraditório.** R-271 exige CHECK em coluna TEXT de domínio finito **consumida por match exato** (RPC/trigger). `context` NÃO é consumida por match exato em nenhum RPC/trigger — é label de display. ADR-070 carve-out legítimo: domínio extensível, writer único = app.

## 3. Data-Migration Completeness

- Mudança: remover CHECK de `context`. Migração `20260616_drop_biomarker_context_check.sql` (T006).
- ⚠️ **Nome real da constraint desconhecido** — CREATE TABLE usou CHECK inline sem `CONSTRAINT <nome>`; Postgres gera nome implícito (provável `biomarkers_log_context_check`). T005 confirma via `pg_constraint` antes do DROP. `DROP CONSTRAINT IF EXISTS` torna idempotente.
- Linhas legadas: nenhuma migração de dados necessária — remover CHECK só **afrouxa**; valores existentes (`jejum` etc.) continuam válidos.

## 4. Coverage

| FR | Task | C4 |
|---|---|---|
| FR-001 (2 campos) | T020-T023 | T061/T063/T064 |
| FR-002 (refine) | (existe) + T008b | T063 |
| FR-002b (contexto PA) | T005-T008b, T024, T045/46, T115/16 | T007/T061 |
| FR-003 (display "por") | T010-T011b, T040/41, T110/11 | T061/T141 |
| FR-004 (tendência dual) | T050-T054, T120-T124 | T062/T142 |
| FR-005 (chips) | T030, T100 | T061/T141 |
| FR-006 (espelho web) | T100-T124 | T141-T143 |
| SC-001 | T061 (CRUD e2e) | ✅ |
| SC-002 (sem SaMD-risco) | T065 | ✅ |
| SC-003 (1 migração) | T006 | T007 |

## 5. Behavioral Failure Modes

### `formatBiomarkerDisplay(item)` (novo)
| Input | Degenerado | Esperado | Coberto (test) |
|---|---|---|---|
| `value_secondary` | NULL | só `"V unit"` (sem "por") | T012 |
| `value` | número | `"120 mg/dL"` (vírgula se decimal) | T012 |
| PA | `value=120, value_secondary=80` | `"120 por 80 mmHg"` | T012 |
| `value` decimal | `120.5` | `"120,5 ..."` (`.`→`,`) | T012 |

### `formatBiomarkerContext(context)` (novo)
| Input | Degenerado | Esperado | Coberto |
|---|---|---|---|
| context glicemia | `jejum` | `"Jejum"` | T012 |
| context PA | `em_repouso` | `"Em repouso"` | T012 |
| desconhecido (DB livre pós-ADR-070) | `'xyz'`/NULL | retorna `null` (oculta, sem crash) | T012 |

### `applyPaRefine` guard estendido (T008b)
| Input | Degenerado | Esperado | Coberto |
|---|---|---|---|
| PA + contexto PA | `pressao_arterial`+`em_repouso` | aceito | T009 |
| PA + contexto glicemia | `pressao_arterial`+`jejum` | rejeitado | T009 |
| glicemia + contexto PA | `glicemia`+`em_repouso` | rejeitado | T009 |
| PA sem value_secondary | só value | rejeitado (já existia) | (existe) |
| PA + contexto NULL | sem context | aceito (contexto opcional) | T009 |

### `MeasureLogSheet` handleSave (PA)
| Input | Degenerado | Esperado | Coberto |
|---|---|---|---|
| diastólica vazia | `valueSec=''` | erro, não grava | T063 |
| diastólica vírgula | `'8,5'` | `coerceDecimal`→8.5 | T064 |
| sistólica `0`/NaN | `'0'` | erro `> 0` | T063 |

### `ScatterTrend` isPa
| Input | Degenerado | Esperado | Coberto |
|---|---|---|---|
| PA sem dados na semana | `[]` | estado vazio, sem crash em 2 séries | T142 |
| leitura sem value_secondary em modo PA | dados legados | série diastólica ignora ponto faltante (não NaN no scale) | T142 |

## Gate Result

**PASS com riscos MEDIUM (não-bloqueantes):**
- M1: nome da constraint a confirmar em runtime (T005 cobre; `IF EXISTS` mitiga).
- M2: dados PA legados sem `value_secondary` em modo dual scatter — defensivo no filtro (não assumir presença).

Nenhum CRITICAL/HIGH. Prossegue p/ C2.
