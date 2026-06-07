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

---

## Failure Modes & Degenerate Inputs — `consume_stock_fifo` (R-270)

> Tabela obrigatória pós-PR #650 (revisor pegou 7 defeitos comportamentais que o reality-check estrutural não viu). Toda função/RPC nova das Fases B/C herda este formato ANTES de codar.

| Input / condição | Degenerado | Esperado | Coberto (commit) |
|------------------|-----------|----------|------------------|
| `p_user_id` | NULL | raise 'user_id obrigatório' | ✅ |
| `p_quantity` | NULL / ≤0 | raise 'quantidade > 0' | ✅ |
| `p_medicine_log_id` | NULL / log inexistente | raise (guard de posse) | ✅ G3 |
| `units_per_ml` | `0` / NULL | `COALESCE(NULLIF(.,0),20)` — sem div/0 | ✅ 53d3c09f |
| dose líquida | arredonda p/ `0.00` ml | raise 'dose muito pequena' (não no-op) | ✅ 53d3c09f |
| `protocol_id` no log | NULL (avulso) | `COALESCE(intake_unit,'ml')` — nunca tratar gotas como ml | ✅ 53d3c09f (persistir unit em logs = follow-up B) |
| `entry_type` | NULL | NULL-safe `(IS NULL OR != 'legacy_unrecoverable')` — não excluir | ✅ 53d3c09f |
| múltiplos lotes | dose cruza frascos | zera 1º, debita saldo do próximo, atômico | ✅ teste |
| sólido | — | caminho linear inteiro | ✅ teste |

Teste: harness `BEGIN … ROLLBACK` no DB ao vivo (prod intocado), incluindo os casos que **devem** levantar exceção (dose minúscula confirmado RAISE).

---

## C1 Reality Check — Fase B (Core) — 2026-06-07

**Evidence table (verificado on-disk):**
| Claim do plan | Real repo | Verified? | Nota |
|---------------|-----------|-----------|------|
| `DOSAGE_UNITS` em medicineSchema:9 | `['mg','mcg','g','ml','ui','un','gotas']` | ✅ | vira `['mg','mcg','g','ui','un','mg/ml','ui/ml']` |
| `dosage_per_intake .max(1000)` já existe | protocolSchema:105 `.max(1000)` | ✅ | NÃO mexer cap; só ADD `intake_unit` |
| cap-100 `logSchema:36` | `.max(100,'…100')` | ✅ | →1000 |
| cap-100 `costAnalysisSchema:79` | `.max(100,'…')` | ✅ | →1000 |
| cap-100 `adherencePatternSchema:13` | `.max(100)` | ✅ | →1000 |
| cap-100 `reminderOptimizerSchema:19` | `.max(100)` | ✅ | →1000 |
| `doseUnit.js` tem `formatNumberPtBR`+`pluralizeDoseUnit` | ✅ | ✅ | `formatDose` estende |
| **FR-010 alvo**: `stockService.js` (web+mobile) | wrappers thin; `createPurchase` definido em **`packages/core/src/repositories/createPurchaseRepository.js:122`** | ❌→corrigido | ver gap B1 |

**Gaps Fase B:**
| # | Sev | Gap | Correção |
|---|-----|-----|----------|
| B1 | HIGH | Desmembramento miraria os 2 `stockService` (apps), mas a lógica vive no **core** `createPurchaseRepository`; duplicar nos apps viola fonte-única. Web mapeia métodos explícito; mobile usa spread `{...purchaseRepo}`. | Novo método `createLiquidPurchase` **no core repo**; web wrapper +1 linha passthrough; mobile herda via spread. |
| B2 | MEDIUM | `validation.test.js:181` ('rejeitar quantidade muito alta') usa `quantity_taken:150` + msg '100' → quebra com cap→1000 | Atualizar teste: `quantity_taken: 1500` + msg '1000' (preserva intenção do cap) |
| B3 | MEDIUM | `stockSchema` (validateStockCreate) pode capar `quantity`/exigir campos — desmembramento passa `quantity=volumePerBottle` (ex: 100/1000 ml) | Confirmar stockSchema aceita volume ml ao codar; ajustar se houver cap restritivo |
| B4 | LOW | cross-validação `_medicineIsLiquid` no protocolSchema (form injeta) vs service | injetar `_medicineIsLiquid` no form (Fase C); documentar |

## Failure Modes & Degenerate Inputs — funções novas Fase B (R-270)

**`formatDose(value, unit)`** (doseUnit.js):
| Input | Degenerado | Esperado |
|-------|-----------|----------|
| value | `null`/`undefined` | `''` (não 'NaN') |
| value | `1` + unit `gotas` | `'1 gota'` (singular) |
| value | decimal `2.5` | `'2,5 ml'` (vírgula via formatNumberPtBR) |
| value | `3000` | `'3.000 …'` (milhar, não `.replace` ingênuo) |
| unit | desconhecido/`null` | `'<n> <unit||''>'.trim()` sem crash |

**`createLiquidPurchase`** (core repo):
| Input | Degenerado | Esperado |
|-------|-----------|----------|
| numBottles | `0`/negativo | rejeitar (loop não roda; sem div/0 em `total/numBottles`) |
| numBottles | `1` | 1 chamada, sem compensação |
| totalPrice | divisão inexata (R$10/3) | 2× `round`, último compensa centavo → Σ = total exato |
| volumePerBottle | `0` | rejeitar (evita unit_price = price/0) |
| validateStockCreate | falha Zod | throw com msg (não silencioso) |

**medicineSchema.superRefine** (`/ml` ⇒ units_per_ml obrigatório): unit `mg/ml` sem units_per_ml → issue; `dosage_per_pill` NULL tolerado (legado).
**protocolSchema.superRefine** (líquido ⇒ intake_unit): `_medicineIsLiquid=true` sem intake_unit → issue; sólido → intake_unit NULL ok.

Cada modo → teste unitário (vitest core, T014). Reality check **PASS** com B1 corrigido (target = core repo).
