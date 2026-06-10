# Tasks: Suporte a Diabéticos Tipo 2 (Épico)

**Spec**: `spec.md` · **Plan**: `plan.md` · **Tier**: 2
**Sequência:** ✅ 022 mergeada (#652, 2026-06-08) → A → (B ∥ C) → D → E. 1 PR por fase.
> **Nota 2026-06-08:** Fase D teve o núcleo (conversão UI→ml em `consume_stock_fifo`) **entregue
> antecipadamente pela 022 Fase C**. T020/T021/T024 viraram verificação/smoke. Formatters de dose
> (R-272) e read-path (R-267) reusam 022.
> **Exceção (revisão CPTO 2026-06-10):** T021b reabre a RPC num único ponto — default de densidade
> por unidade (UI→100, não 20) — risco clínico de decremento 5× errado (FR-013b).

---

## Phase A — Forma injetável + TTL biológico (PR 1) — ADR-059

- [x] T001 [C1] Confirmar 022 mergeada (colunas `presentation`/`units_per_ml` em prod). Verificar caminho de registro de tomada que debita lote (`consume_stock_fifo` callers).
- [x] T002 [US1] Migração `docs/migrations/2026XXXX_diabetes_a_injectable_ttl.sql`: `medicines.shelf_life_days INTEGER NULL`; `stock.opened_at TIMESTAMPTZ NULL`.
- [x] T003 [US1] Inferir `stock.opened_at` na 1ª tomada que debita o lote (`opened_at IS NULL` → setar `now()`), best-effort (R-245). Cross-superfície (web/mobile/bot).
- [x] T004 [US1] Helper puro core: `isBiologicallyExpired(stock, medicine)` = `opened_at + shelf_life_days ≤ now`. Eixo paralelo ao status volume (ADR-018).
- [x] T005 [US1] UI alerta validade biológica (relógio) — web + mobile; distinto do alerta de volume.
- [x] T005b [US1] Alerta TTL via stack de notificação (push/Telegram, FR-004b): kind novo no dispatcher (R-200/CON-019, enum Zod R-193; ADR se payload mudar). Cadência D-3 + vencimento (não diário).
- [x] T006 [US1] `medicineSchema`: `shelf_life_days` (int positivo nullable); form expõe `presentation` (`injecao`/`pomada`) + `shelf_life_days` p/ injetáveis — **prefill 28 quando `presentation='injecao'`** (editável, copy "confira a bula"; FR-002).
- [x] T007 [P] [C4] Testes: `opened_at` inferido 1× (não re-seta); TTL expira por tempo independente do volume; injetável sem `shelf_life_days` → eixo inativo.

## Phase B — GLP-1 (mg, semanal, titulação) (PR 2) — ADR-061

- [ ] T008 [C1] **Auditar titulação existente**: criar protocolo GLP-1 `semanal` com `titration_schedule`; exercitar wizard/timeline/badge; mapear regressões pós-refactor. Registrar achados.
- [ ] T009 [US2] Corrigir regressões de titulação encontradas em T008 (`titrationUtils`/`titrationService`/UI).
- [ ] T010 [US2] `computeTolerances` (`doseInstanceGenerator.js:76`) frequency-aware: não-diário (`semanal`/`dias_alternados`) → `floor(período/2)` **sem `MAX_TOLERANCE`**; diário inalterado (cap 120). Passar `frequency` ao gerador.
- [ ] T011 [US2] Gerador congela `expected_dose` da etapa de titulação vigente na data (reusa FP-1) — confirmar p/ `semanal`. **Modelo de avanço = AUTO por cronograma** (FR-005b): `stage_started_at + duration_days` esgotado → próxima etapa; evento informativo "Etapa N iniciada conforme o cronograma" (sem CTA de dose — SaMD). T008 audita se o auto-avanço existente funciona.
- [ ] T011b [US2] UX dose semanal pendente multi-dia (FR-008b): carry-over com rótulo relativo ("há 2 dias"); PriorityCard inclui dentro da tolerância; **sem re-notificação** (`notified_at` idempotente); `missed` só após tolerância (sweep R-246). Web + mobile.
- [ ] T012 [P] [C4] Testes: tolerância semanal > 120 (perdão 72h coberto); diário 1×/dia mantém 120; `expected_dose` correto por etapa; **auto-avanço de etapa por tempo**; sweep `pending→missed` só após janela; **rótulo relativo multi-dia**.

## Phase C — biomarkers_log + fast-logging + timeline híbrida (PR 3) — ADR-060

> **Design prescritivo (decisões PO fixadas).** Consultar SEMPRE em dúvida de pixel/comportamento:
> `HANDOFF_DESIGN.md` §2.6/§4 · `DESIGN_BRIEFING.md` · `design-mocks/*.png` · componentes-mock
> `plans/backlog-native_app/MOCKS_APP_CRUD/project/dosiq-mocks/biomarker-screens{,-2}.jsx`
> (`MeasureCardC`/`WeekNav`/`BioChip`/`Keypad`/`BioToast`/`ScatterPlot`/`TypeChips`). Mobile Android
> = fonte; web = espelho. **SaMD: cor=tipo, nunca qualidade; sem meta/zona/linha-de-média.**

- [ ] T013 [C1] Confirmar caminho real **mobile** do fast-logging + FAB + navegação da área de Medidas (UNVERIFIED no plan). Comparar com mocks Android. Registrar antes de codar.
- [ ] T014 [US3] Migração `docs/migrations/2026XXXX_diabetes_c_biomarkers.sql`: `biomarkers_log` (`id,user_id,type,value,`**`value_secondary`**`,unit,measured_at,context,source,notes,created_at`) + GRANTs + RLS (`user_id=auth.uid()`) + REVOKE anon. Enums PT (R-021). **`value_secondary` numeric NULL = 2º componente de medida composta (PA: sistólica=value, diastólica=value_secondary; NULL p/ demais) — decisão PO 2026-06-10 (duas colunas).**
- [ ] T015 [US3] `biomarkerLogSchema.js` (core) — sincronizado com CHECK (R-082); `safeParse`; `.nullable().optional()`. `context` enum PT: `jejum`/`pre_refeicao`/`pos_refeicao`/`ao_deitar`/`outro` (nullable, opcional). `type` default `glicemia`; `source` default `manual`. **`value_secondary` nullable; superRefine: `type='pressao_arterial'` ⇒ `value_secondary` obrigatório; demais tipos ⇒ NULL.**
- [ ] T016 [US3] Adapter `biomarkersToEvents` em `timelineService.js` → `TimelineEvent[]` `type='biomarker'` (R-252; **não tocar** `timeline.js`). Agrupar nos períodos da "Agenda de Hoje"; card "Última medida" no FIM (dose primeiro).
- [ ] T017 [US3] `BiomarkerEventCard.jsx` (padrão **`MeasureCardC`**: `infoSoft`/plano/sem sombra/sem botão/`IconRuler` inline) + registrar `biomarker` em `eventCardRegistry.js` (web) + equivalente mobile. **Medida nunca com mais peso visual que dose** (elevação=ação, tinta=registro). Mock `C registro tintado ESCOLHIDA`.
- [ ] T017b [US3] Reservar `IconRuler` = **ícone `ruler` do lucide** em `dosiq-icons` (web/mobile shared) como marca única de biomarcador/medida (chips de tipo ficam **sem ícone**). Web: `lucide-react`; mobile: `lucide-react-native` (ou path SVG do glifo `ruler` se ícone shared for custom). Handoff §4.2.
- [ ] T018 [US3] Fast-logging UI (web + mobile): bottom sheet **layout B "idoso primeiro"** (valor gigante, contexto grid 2×2 ≥44px, tipo recolhido, unidade fixa, "Agora" ajustável, vírgula PT-BR R-270). `Keypad` chrome do sistema FORA do sheet (`maxHeight 85%`; erro **altura-neutro** 64→48px+caption 12px). `BioChip`/`BioToast`. Erro = transparência radical (o que falhou/nada salvo/dados mantidos/retry). Mocks `C registro tintado`/`Erro valor inválido`. Reusa AP-180.
- [ ] T018b [US3] **FAB do Hoje = speed-dial** (Registrar dose · Registrar medida) — web + mobile. Mock `FAB speed-dial expandido`.
- [ ] T018c [US3b] **Área de Medidas** (web + mobile): entrada A (card "Última medida" no fim do Hoje) + B (**Perfil › Ferramentas › Medidas**, entre Histórico de Doses e Modo Consulta). Hub v1 = histórico cronológico (filtro `TypeChips` sem ícone) + tendência `ScatterPlot` (pontos/dia, 1 cor `infoRing`, **7d FIXO + `WeekNav`**, seta-presente desabilitada, **sem 7d/30d, sem zona/meta/linha** — SaMD; média=número). Sheet detalhe espelha dose (*Editar*·**Ver o dia completo**·*Excluir*) — **inclui service CRUD completo de biomarcador (update/delete), não só create**. PA = 2 campos no fast-logging (`value`+`value_secondary`). Multi-biomarcador sem redesenho. **Estado-zero obrigatório** (área+dia vazios, convite inline). Mocks `B Perfil Ferramentas`/`Hub Glicemia V1`/`Hub Peso`/`Detalhe da medida`/`Estado zero`/`Dia vazio`.
- [ ] T019 [P] [C4] Testes: biomarcador cria linha; aparece na timeline por instante (sem tocar builder); sem FK dose; sem meta; RLS isola por user; `WeekNav` clampa no presente; estado-zero e erro renderizam; **checklist SaMD** (sem cor/copy de qualidade, sem linha de média).

## Phase D — Insulina basal (UI/volume) (PR 4)

- [ ] T020 [C1] Verificar em prod (MCP): `consume_stock_fifo` já converte `UI`→ml (`lower(intake_unit) IN ('gotas','ui')`, migr. `20260608`). ✅ **núcleo entregue por 022** — Fase D não recria a conversão; **única alteração permitida na RPC = T021b** (default densidade por unidade; AP-221: atualizar callers se assinatura mudasse — não muda).
- [ ] T021 [US4] Smoke insulina U-100: tomada `10 UI` → debita `0,10 ml` por FIFO. Cobrir U-200 (`units_per_ml=200`) se aplicável. Confirmar densidade capturada no tratamento (form de protocolo, `intake_unit='UI'`).
- [ ] T021b [US4] 🔴 **Fix default densidade p/ UI (FR-013b — risco clínico 5×)**: (a) form de tratamento prefill `units_per_ml=100` quando `intake_unit='UI'` (editável; nunca vazio→20); (b) RPC `consume_stock_fifo` default por unidade — `CASE WHEN lower(intake)='ui' THEN 100 ELSE 20 END` (aditivo, assinatura intacta; migração própria); (c) regressão completa gotas/ml/sólido. **Anula a nota "não alterar RPC" SÓ neste ponto.**
- [ ] T022 [US4] Auditar superfícies de dose de insulina (dashboard/histórico/timeline/estoque/emergência/consulta): query traz `intake_unit`+`units_per_ml` (R-267) e render via `formatIntakeDose`/`formatDoseItem`/`formatDoseHint` (R-272, **reusa 022**) — nunca `dosage_unit` cru. Inputs numéricos normalizam vírgula PT-BR (R-270).
- [ ] T023 [US4] Adesão basal = modo binário (R-248) — confirmar dose fixa; `dose_exactness` fora.
- [ ] T024 [P] [C4] Testes/smoke: 10 UI → 0,10 ml (U-100) por FIFO (verificação, não nova impl.); TTL antes do volume; render via formatter (R-272); regressão sólido/gotas/ml intacta.

## Phase E — Export clínico (PR 5)

- [ ] T025 [C1] Mapear o caminho real do relatório PDF clínico (Spec 007 base).
- [ ] T026 [US5] Relatório cruza dose × `biomarkers_log` por período/dia, server-side (R-249), descritivo (sem recomendação — SaMD).
- [ ] T027 [P] [C4] Testes: agregação server-side; PDF sem cálculo de dose.

## Quality Gates & Record (cada PR)

- [ ] T028 [C4] `rtk npm run validate:agent` + smoke PO (mobile) antes do PR (R-234).
- [ ] T029 [C5] SQP (R-221): A=Backend/infra · B/C/D=Web+Mobile+Core (minor, store-note diabetes) · E=Web (minor). CHANGELOG [Unreleased] por plataforma.
- [ ] T030 [C5] ADR-059..062 → accepted antes do código da fase respectiva; catalogar CON `biomarkers_log`. PR por fase; Gemini + smoke PO + aprovação humana (R-060). Nunca auto-merge.

## Dependencies
022 mergeada → A. B e C paralelizáveis após A. D depende de C. E depende de C+D.

## Traceability
FR-001..004 + 002(prefill)/004b → A (T002–T007, T005b) · FR-005..008 + 005b/008b → B (T008–T012, T011b) · FR-009/010/011/012 + 010b/011b/012b → C (T014–T019, T017b, T018b, T018c) · FR-013/013b/014/015 → D (T021–T024, **T021b**) · FR-016 → E (T026). US3b → T018c.

## Orquestração (model tiering — ver plan.md §Orquestração & Model Tiering)
Pré-spawn obrigatório: **AP-169 Branch Sync Ritual** (`git fetch` + sync) em qualquer task que toque `packages/*` ou `apps/*/src/features/*`. Sub-agentes nunca commitam main (R-060). cavecrew-reviewer ≠ gate (revisor = Gemini). Haiku só folha trivial — nunca math de dose/UI→ml/tolerância/RLS.

> **Trap SaMD de render (delegação de UI clínica):** sub-agente barato tende a "ajudar" pondo
> faixa-alvo/cor alto-baixo/linha de média no scatter ou cards — **viola ADR-062**. Prompt DEVE:
> espelhar o mock exatamente (nunca melhorar); cor=tipo nunca qualidade; média=número nunca linha.
> **Main revisa todo render clínico** contra checklist SaMD antes do PR (plan.md §Orquestração).

| Task | Agente / modelo |
|------|-----------------|
| T001 / T008 / T013 / T020 / T025 [C1] | cavecrew-investigator (haiku/sonnet). T013 compara mock Android; C1 do hub investiga reuso de `WeekNav` |
| T002 / T014 (migração SQL, RLS/grants) | sonnet |
| T004 / T015 / T016 (helper/schema/adapter bounded) | cavecrew-builder ou sonnet |
| T005 / T006 / T017 (cards/forms render) | sonnet (espelha mock); **main** valida SaMD/R-267/R-272 |
| T017b reservar `IconRuler` (1 ícone shared) | folha trivial — cavecrew-builder/haiku |
| **T018 fast-log sheet** (tela mais importante) | sonnet (+ui-design-brain); **main valida a11y ≥44px + overflow sheet/teclado + SaMD** |
| **T018b FAB speed-dial** (muda Dashboard vivo) | sonnet render; **main integra** |
| **T018c área de Medidas — DECOMPOR** | sub-unidades (WeekNav/ScatterPlot/TypeChips/lista/sheet/estado-zero `[P]`) sonnet/cavecrew; **main retém nav + valida SaMD do scatter** (plan.md §Decomposição T018c) |
| T022 / T023 / T026 (render dose / export) | sonnet; **main** valida SaMD/R-267/R-272 |
| T007 / T012 / T019 / T024 [P] (testes) | sonnet (paraleliza) |
| **T003 / T010 / T021b** (write-path AP-193 / tolerância clínica / **default densidade UI na RPC — math de dose**) | **main / opus** — não delegar |
| T005b (kind notificação TTL) / T011b (carry-over multi-dia) | sonnet; **main** valida payload (R-193/CON-019) e UX do Hoje |
| T021 / T024 (smoke insulina) | humano (PO) |
| T028 / T029 / T030 [C4/C5] (gates/SQP/record) | **main / opus** |
