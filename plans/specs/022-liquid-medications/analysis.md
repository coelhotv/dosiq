# Artifact Coverage Analysis: Medicamentos Líquidos (Épico)

**Feature Directory**: `plans/specs/022-liquid-medications`
**Tier**: 2 · **Revised**: 2026-06-02

> Análise ponta-a-ponta (3 camadas), substituindo as 3 análises fragmentadas das antigas specs 022/023/024.

---

## FR → Task → Evidência

| FR | Descrição | Task(s) | Path verificado | Verified? |
|----|-----------|---------|------------------|-----------|
| FR-001 | enum `mg/ml`,`ui/ml` (SQL) | T002 | `medicines.dosage_unit` CHECK (a confirmar nome — T001) | ⚠️ confirmar em C1 |
| FR-002 | `medicines.units_per_ml` (genérica, ex-`drops_per_ml` — ADR-058) | T003 | `public.medicines` (tabela existe; coluna NEW, `NUMERIC DEFAULT 20`) | ✅ |
| FR-002b | `medicines.presentation` (forma; CHECK PT; ADR-058) | T003/T016 | `public.medicines` (coluna NEW, `TEXT DEFAULT 'comprimido'`) | ✅ |
| FR-003 | `protocols.intake_unit` | T003 | `public.protocols` (existe) | ✅ |
| FR-004 | `CHECK (stock.quantity>=0)` | T003 | `stock.quantity numeric` | ✅ |
| FR-005 | migração de dados | T004 | `medicines`/`protocols` | ✅ (lógica idempotente) |
| FR-006 | RPC `consume_stock_fifo` | T005 | existe `(p_user_id,p_medicine_id,p_quantity,p_medicine_log_id)`; callers `medicineLogService.js`, `doseActions.js:96` | ✅ |
| FR-007 | enum core + refine | T009 | `medicineSchema.js:9` (`DOSAGE_UNITS`) | ✅ |
| FR-008 | `protocolSchema.intake_unit` | T010 | `protocolSchema.js:102` (`dosage_per_intake .max(1000)` já existe) | ✅ |
| FR-009 | cap-100 → 1000 | T011 | `logSchema.js:36`, `adherencePatternSchema.js:13`, `costAnalysisSchema.js:79`, `reminderOptimizerSchema.js:19` | ✅ |
| FR-010 | desmembramento RPC | T012 | `stockService.js:24`; `create_purchase_with_stock` caller `adicionar_estoque.js:128` | ✅ |
| FR-011 | `formatDose` | T013 | `doseUnit.js` (existe `formatNumberPtBR`,`pluralizeDoseUnit`) | ✅ |
| FR-012 | fração de frasco | T012/T020 | `quantity / original_quantity` (ambas `numeric`) | ✅ |
| FR-013 | dropdown form + wizard | T016/T017 | `MedicineForm.jsx`, `MedicineFormScreen.jsx` | ✅ (wizard: T015) |
| FR-014 | select `intake_unit` | T018 | `ProtocolFormDosesSection.jsx`, `ProtocolFormBody.jsx` | ✅ |
| FR-015 | StockForm frascos/ml | T019 | `StockForm.jsx`, `StockFormPurchaseDetails.jsx` (web); mobile T015 | ⚠️ mobile em C1 |
| FR-016 | banner conversão ml | T020 | `StockAlertInline.jsx` | ✅ |
| FR-017 | bot `formatDose` + débito | T021/T022 | `api/notify.js`, `doseActions.js:96` | ✅ |

---

## SC → Verificação

| SC | Cobertura C4 |
|----|--------------|
| SC-001 | T006 (líquido ml/gotas, sólido, multilote, idempotência) + T007 (contagem→0) |
| SC-002 | T014 (schemas + desmembramento + centavos) |
| SC-003 | T023 (dropdown + banner + bot + estoque zerado) |

Toda US P1/P2 tem teste independente declarado na spec. ✅

---

## Cross-file consistency

- Enum: **um** ponto de verdade textual (`DOSAGE_UNITS` core) + CHECK SQL espelhado. ✅ (resolve o drift anterior entre 022/023, onde o `/ml` faltava no enum)
- Cap-100: localizado em `logSchema` & cousins, **não** em `protocolSchema` (já `.max(1000)`). ✅ (resolve o erro de alvo anterior)
- Desmembramento via `create_purchase_with_stock`, nunca `stock.insert`. ✅
- `formatDose` estende `doseUnit.js`, não duplica. ✅ (DRY/R-231)
- Banner compara **ml vs ml** (converte `expected_dose` antes). ✅ (resolve o erro de unidade gotas-vs-ml anterior)
- Mobile = `.jsx`/`.js`, não `.ts`. ✅

---

## Data-migration completeness

Mudança de formato (`ml`/`gotas` → `mg/ml` + `intake_unit`) **tem** entregável de migração explícito (FR-005/T004), idempotente, com validação de contagem (T007). ✅ — sem isso seria CRITICAL (líquidos legados órfãos).

---

## Decisões arquiteturais (resolvidas, não chutadas)

- **Líquido derivado da unidade de concentração** (`LIKE '%/ml'`), não booleano `is_liquid` — decisão-mãe do PO, escrita 1× no Context. `presentation` (forma) é eixo **complementar**, não a reverte (ADR-058).
- **`UI` v1 = escala direta** (insulina/canetas → épico diabetes 012, ADR-052). Documentado.
- **Coordenação 012 (ADR-058):** `units_per_ml` (genérica razão→ml) e `presentation` (forma, nome EN/valores PT R-021) nascem nesta spec p/ a 012 reusar sem rename/migração dupla. Sequenciamento duro 022→012.
- **`dosage_per_pill` NULL tolerado** em legados migrados.

---

## Findings

| Sev | Item | Ação |
|-----|------|------|
| MEDIUM | Nome da constraint `dosage_unit` desconhecido | T001 resolve em C1 antes de A.1 |
| MEDIUM | Caminho do estoque mobile não confirmado | T015 resolve em C1 antes de C.3 |
| LOW | Cross-validação `_medicineIsLiquid` (form) vs. service | decidir no PR da Fase B, documentar |

Sem CRITICAL/HIGH. Os 2 MEDIUM são confirmações de C1 já agendadas como tasks-gate (T001/T015) — não bloqueiam o planejamento, bloqueiam o código da fase respectiva até resolver.
