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

---

## C1 Reality Check — Fase A (executado 2026-06-07, projeto kwqjtdsqkkbebfiaxubb)

**T001 resolvido (evidência DB ao vivo):**
| Claim do plan | Repo/DB real | Verified? | Nota |
|---------------|--------------|-----------|------|
| `medicines_dosage_unit_check` p/ DROP/recreate (A.1) | **Nenhum CHECK existe** — `dosage_unit text` livre, default `'mg'` | ✅ | A.1 vira **ADD** CHECK (não drop/recreate) |
| Valores legados `ml`/`gotas` | `ml`=3, `gotas`=**0**; resto mg/ui/un/g/mcg ∈ enum-alvo | ✅ | migração toca só 3 linhas `ml`; ADD CHECK seguro |
| `units_per_ml`/`presentation`/`protocols.intake_unit` ausentes | confirmado ausentes | ✅ | NEW |
| `stock.quantity` sem negativos | `negative_stock=0` | ✅ | CHECK(quantity>=0) seguro |
| `consume_stock_fifo` = 1 função (4-arg) | **2 overloads**: 3-arg (`auth.uid()`) + 4-arg (`p_user_id`) | ❌→ | plan assumiu 1 |

**Gaps HIGH no plan A.4 (corpo da RPC) — corpo proposto diverge do real, causaria regressão:**

| # | Sev | Gap | Real (DB) | Plan propôs | Ação |
|---|-----|-----|-----------|-------------|------|
| G1 | HIGH | Caller faltando | `conversational.js:319` chama a **3-arg** (chatbot dose) | plan só lista doseActions+medicineLogService (4-arg) | líquido não debitaria por volume no chatbot |
| G2 | HIGH | Filtro `entry_type != 'legacy_unrecoverable'` | presente nos 2 (SUM + loop) | **omitido** | consumiria estoque legacy_unrecoverable = regressão |
| G3 | HIGH | Guard `medicine_logs` existência (log↔user↔medicine) | presente nos 2 | **omitido** | perderia validação de posse |
| G4 | MEDIUM | FIFO ordering | `purchase_date ASC, created_at, id` (FIFO puro) | `expiration_date ASC NULLS LAST, ...` (FEFO) | muda ordem p/ sólidos também — **decisão** |
| G5 | LOW | `SET search_path` | `TO 'public'` | `= ''` + `public.` qualificado (hardening CLAUDE.md) | OK adotar `''`, mas exige todas refs qualificadas |

**Decisões abertas (operador) antes de A.4:**
- **D1 (G1):** cobrir a 3-arg? Opção (a) extrair helper privado `_consume_stock_fifo_impl(user,med,qty,log)` c/ lógica líquida e ambos overloads delegam (DRY, cobre chatbot); (b) migrar `conversational.js` p/ 4-arg + DROP 3-arg.
- **D2 (G4):** FIFO atual (`purchase_date`) ou mudar p/ FEFO (`expiration_date` primeiro)? FEFO melhor p/ líquidos com validade, mas altera comportamento dos sólidos.

G2/G3 = correções obrigatórias (preservar comportamento), sem decisão. ADD CHECK em `dosage_unit` com set legacy-safe `{mg,mcg,g,ml,ui,un,gotas,mg/ml,ui/ml}`.

**Decisões resolvidas (operador, 2026-06-07):**
- **D1 → migrar caller + DROP 3-arg.** `conversational.js:319` passa a 4-arg (`p_user_id: userId` — `userId` já em escopo em `_createLogAndDecrementStock`). `DROP FUNCTION public.consume_stock_fifo(uuid,numeric,uuid)`. Único caller 3-arg (grep server/apps/api/packages confirmou). A.4 mexe em código bot (cross-fase, aceito).
- **D2 → manter FIFO `purchase_date`** (sem FEFO; menor blast radius, sólidos inalterados).
- **G2/G3 preservados** no novo corpo 4-arg (filtro `legacy_unrecoverable` + guard `medicine_logs`). **G5:** adotar `SET search_path = ''` + refs `public.` qualificadas (hardening).

Gaps resolvidos → reality check **PASS**. Escopo Fase A revisado: A.1 ADD CHECK · A.2 colunas · A.3 migração (só 3 `ml`) · A.4 RPC 4-arg líquida + DROP 3-arg + edit `conversational.js`.
