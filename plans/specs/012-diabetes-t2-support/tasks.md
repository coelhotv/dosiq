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
- [x] T006 [US1] `medicineSchema`: `shelf_life_days` (int positivo nullable); form expõe `presentation` (`injetavel`/`pomada`) + `shelf_life_days` p/ injetáveis — **prefill 28 quando `presentation='injetavel'`** (editável, copy "confira a bula"; FR-002).
- [x] T007 [P] [C4] Testes: `opened_at` inferido 1× (não re-seta); TTL expira por tempo independente do volume; injetável sem `shelf_life_days` → eixo inativo.

## Phase B — GLP-1 (mg, semanal, titulação) (PR 2) — ADR-061

- [x] T008 [C1] **Auditar titulação existente**: criar protocolo GLP-1 `semanal` com `titration_schedule`; exercitar wizard/timeline/badge; mapear regressões pós-refactor. Registrar achados.
- [x] T009 [US2] Corrigir regressões de titulação encontradas em T008 (`titrationUtils`/`titrationService`/UI).
- [x] T010 [US2] `computeTolerances` (`doseInstanceGenerator.js:76`) frequency-aware: não-diário (`semanal`/`dias_alternados`) → `floor(período/2)` **sem `MAX_TOLERANCE`**; diário inalterado (cap 120). Passar `frequency` ao gerador.
- [x] T011 [US2] Gerador congela `expected_dose` da etapa de titulação vigente na data (reusa FP-1) — confirmar p/ `semanal`. **Modelo de avanço = AUTO por cronograma** (FR-005b): `stage_started_at + duration_days` esgotado → próxima etapa; evento informativo "Etapa N iniciada conforme o cronograma" (sem CTA de dose — SaMD). T008 audita se o auto-avanço existente funciona.
- [x] T011b [US2] UX dose semanal pendente multi-dia (FR-008b): carry-over com rótulo relativo ("há 2 dias"); PriorityCard inclui dentro da tolerância; **sem re-notificação** (`notified_at` idempotente); `missed` só após tolerância (sweep R-246). Web + mobile.
- [x] T012 [P] [C4] Testes: tolerância semanal > 120 (perdão 72h coberto); diário 1×/dia mantém 120; `expected_dose` correto por etapa; **auto-avanço de etapa por tempo**; sweep `pending→missed` só após janela; **rótulo relativo multi-dia**.

## Phase B2 — Canetas/ampolas GLP-1: intake_unit='mg' + container + rendimento + titulação N1 (PR 2b) — fecha Fase B

> Modelo decidido na sessão de design 2026-06-12. Caneta/ampola = lote líquido em ml (reusa 022);
> a peça que falta é a dose em **mg** e o estoque em **aplicações**. Maior risco do épico: migração
> em CHECK de prod + RPC. **Mutação em prod só com autorização explícita do PO** (hard rule).
> Ordem de implementação: migração+RPC → Zod → formatters core → form tratamento → compra/estoque →
> titulação N1 → testes.

- [x] T023 [C1] **Verificar prod (MCP, read-only)** antes de codar: confirmar `protocols_intake_unit_check` = `IN ('gotas','ml','UI')` (alvo: +`'mg'`); `consume_stock_fifo(uuid,uuid,numeric,uuid)` ramo líquido `dosage_unit LIKE '%/ml'` + sub-ml `IN ('gotas','ui')` (alvo: +`'mg'`); ausência de coluna `medicines.injection_container`. Registrar baseline. **Confirmado 2026-06-12 na escrita da spec — re-verificar no momento da migração (drift).**
- [x] T024 [US2b] **Migração** `docs/migrations/2026XXXX_diabetes_b2_glp1_mg.sql` (FR-017/FR-019): (a) `ALTER ... DROP/ADD CONSTRAINT protocols_intake_unit_check` → `IN ('gotas','ml','UI','mg')` (R-271 exato); (b) `ALTER TABLE medicines ADD COLUMN injection_container text NULL` + CHECK `IN ('caneta','ampola','frasco_ampola','seringa_preenchida')`; (c) GRANTs já existem na tabela (coluna nova não precisa re-grant — confirmar). **Aplicar em prod só com autorização PO.**
- [x] T024b [US2b] **RPC `consume_stock_fifo`** (FR-017): adicionar `'mg'` ao ramo sub-ml — `lower(intake_unit) IN ('gotas','ui','mg')` → `ROUND(p_quantity/units_per_ml,2)`. **Única alteração**; assinatura inalterada (AP-221). `SET search_path=''`/`public.` qualificado preservados. Migração separada ou na mesma de T024.
- [x] T025 [US2b] **Zod** (FR-017/FR-019): enum `intake_unit` de 022 ganha `'mg'` (sincronizado com CHECK, R-082/R-271); novo enum `INJECTION_CONTAINERS` PT; cap de dose mg revisado (frações 0,25–15). `safeParse`; `.nullable().optional()`.
- [x] T026 [US2b] **Formatters core** (FR-017/FR-020): cobrir ramo `mg` em `formatIntakeDose`/`formatDoseItem` (mg lowercase, R-272 — **nenhum formatter novo**); helper de **rendimento em aplicações** `floor(ml_restante ÷ (dose_mg/units_per_ml))` + rótulo do container (FR-020); helper de **rótulo de concentração** "[X] mg em [Y] mL" (FR-018). Em `@dosiq/core`.
- [x] T027 [US2b] **Form de tratamento** (FR-018/FR-022): `intake_unit='mg'` selecionável p/ injetável; `units_per_ml` **obrigatória** quando mg (bloqueia salvar; nunca default 20) com helper "[X] mg em [Y] mL"; sufixo do wizard de titulação = "mg" (reusa `intakeSuffix`); etapa pode marcar `requires_new_medicine` (FR-021). Web (+ mobile se aplicável — confirmar em T023).
- [x] T028 [US2b] **Compra/estoque** (FR-019/FR-020/FR-022): capturar `injection_container` na 1ª compra (fallback "unidade"); informar volume do lote (ml) → exibir rendimento em aplicações (floor) no card de estoque + tela de compra. Web + mobile. Ampola → TTL biológico (FR-002) não se aplica.
- [x] T029 [US2b] **Titulação N1** (FR-021): etapa do `titration_schedule` com `requires_new_medicine: true` → no auto-avanço (FR-005b, `_processProtocolTitration`) **não altera `expected_dose`**; emite notificação-CTA "Hora de trocar de caneta" (kind/copy novos, SaMD/ADR-062). Wizard permite marcar a flag na etapa. Reusa a trava otimista (AP-221) já no cron.
- [x] T030 [P] [C4] Testes: RPC mg debita `mg÷units_per_ml=ml` (pgTAP ou jest server c/ mock); `mg` rejeitado sem `units_per_ml`; formatter mg + floor de rendimento (Ozempic 0,68/caneta 1,5ml/0,25mg → 6 aplicações); container fallback "unidade"; `requires_new_medicine` emite CTA sem mudar dose; Zod↔CHECK sincronizados.

## Phase B3 — units_per_ml default NULL + fallback unit-aware + concentração com denominador (PR 2c)

> Débito do FR-013b exposto no smoke da B2. mg já saiu da conta (usa dosage_per_pill).
> Escopo (decisão PO 2026-06-12): hardening units_per_ml (FR-023/024/025, ADR-065) **+** FR-031
> concentração com denominador (ADR-066, coluna `concentration_volume_ml`).
> Mutação em prod (DROP DEFAULT + backfill + coluna nova + RPC) só com autorização explícita do PO.
> ADR-065/066 estão **proposed** — aprovar antes do código (P2/Const. V).

- [x] T031 [C1] Verificar prod (MCP, read-only): default atual de `medicines.units_per_ml` (= 20?); contar líquidos `ui/ml` com `units_per_ml=20` (candidatos a backfill errado); confirmar que `dosage_per_pill` está presente nos `mg/ml`. Registrar baseline.
- [x] T032 [US3b] **Backfill derivado do tratamento (FR-023, decidido 2026-06-12)**: query que, por medicine, deriva `units_per_ml` da unidade de tomada dos `protocols` associados — `UI→100`, `gotas→20`, `mg→NULL`; sem tratamento ou não-líquido → `NULL`. Validar contra baseline da T031 (quantos linhas mudam); medicine com unidades divergentes → priorizar UI>gotas e logar.
- [x] T033 [US3b] **Migração** `docs/migrations/2026XXXX_units_per_ml_null_default.sql`: `ALTER TABLE medicines ALTER COLUMN units_per_ml DROP DEFAULT` + UPDATE de backfill (T032). Aplicar em prod só com autorização PO.
- [x] T034 [US3b] **RPC `consume_stock_fifo`** (FR-024): remover `COALESCE(...,20)` blanket; fallback unit-aware — `gotas→20`, `ui→100`, `mg→dosage_per_pill` (já), sem padrão seguro → `RAISE EXCEPTION`. Assinatura intacta (AP-221); corpo do `pg_get_functiondef` ao vivo (AP-217).
- [x] T035 [US3b] **Core** (FR-024): `doseToMl`/`formatIntakeDose` aplicam fallback unit-aware (gotas 20 / UI 100 / mg dosage_per_pill); sem padrão → retorno honesto (sem conversão fantasma).
- [x] T036 [US3b] **Forms** (FR-025): garantir que web+mobile não salvem líquido gotas/UI sem `units_per_ml` (default da coluna não mascara mais). Hints de padrão mantidos (20/100).
- [x] T037 [P] [C4] Testes: RPC UI sem densidade → erro (não 20); doseToMl unit-aware; gotas mantém 20; form bloqueia gotas/UI sem densidade; mg inalterado.
- [x] T037b [US3b] **Migração coluna denominador (FR-031, ADR-066)**: `ALTER TABLE medicines ADD COLUMN IF NOT EXISTS concentration_volume_ml NUMERIC DEFAULT NULL` (NULL = "por 1 mL"). Grants já existem na tabela; sem CHECK (numérico livre > 0 validado no Zod). Aplicar em prod só com autorização PO. Schema Zod `medicineSchema` + `concentration_volume_ml` (nullable, R-082); R-267 read-path (select dos forms/detalhe).
- [x] T037c [US3b] **Form concentração com denominador (web+mobile)**: campo `[amount] mg / [denominador] mL` — default `1` (editável; valor copiado do rótulo, ex.: `0,5` Mounjaro); ao salvar normaliza `dosage_per_pill = amount ÷ denominador` (storage mg/ml); denominador `1` → `concentration_volume_ml = NULL`, ≠1 → grava o valor. Reexibe `amount = dosage_per_pill × COALESCE(concentration_volume_ml, 1)` → "2,5 mg/0,5 mL". Inputs decimais = `text inputMode=decimal` + `coerceDecimal` (R-276). NÃO criar unidade literal em `dosage_unit`.
- [x] T037d [P] [C4] Testes denominador: default 1 (passthrough, coluna NULL); 2,5 mg/0,5 mL → dosage_per_pill 5 + volume 0,5; reexibição reconstrói o rótulo da caixa; vírgula PT-BR aceita; denominador 0 ou vazio → erro (não divide por zero — R-270).

## Phase B4 — Modelo de estoque dose-primário (freq ≠ diário) (PR 2d) — ADR-067 + ADR-068

> Falha conceitual exposta no smoke da B2: dias corridos enganam (4 canetas=28d) e quebram custo
> (custo/dose R$425 mostrado como R$60,71/dia). Decisão design 2026-06-12: dose = unidade
> fundamental, dia = projeção derivada. Display=doses, cor=runway (freq ≠ diário). **Depende da B3**
> (densidade certa). FR-026..029 sem mutação de dados; **FR-030 muta schema** (move container p/ lote + DROP).
> **ADR-067/068 proposed — aprovar antes do código.** Analysis: `analysis-b4.md`.

- [x] T038 [C1] Mapear consumidores de `daysRemaining`/`dailyConsumption` (já levantado: `stock.js` core `resolveStockStatus`, `costAnalysisService` web, `refillPredictionService`, badges `StockPill`(web)/`StockCardRedesign`(web)/`StockLevelBadge`+`StockItem`(mobile), PDF `_pdfSectionBuilders`/`consultationPdfDataBuilder`, Telegram `estoque.js`). Confirmar contrato esperado por cada antes de mexer (R-267 read-path). ⚠️ `resolveStockStatus` muda semântica do input (consumo/dia → runwayDias p/ cor) — listar TODOS os callers.
- [x] T039 [US2b] **Core `stock.js`** (FR-026, ADR-067): `stockDoseMetrics(...)` → `tomadasPorDia = time_schedule?.length || 1`; `diasDeTomadaRestantes = estoque / (dosePorTomada × tomadasPorDia)` (líquido via `doseToMl` B2/B3; sólido via unidades); `runwayDias = diasDeTomadaRestantes / frequencyDailyFactor(p)`. Diário: `diasDeTomada == runway` (sem regressão). Exportar via `utils/index.js`. **Legacy edge folded-in (R-277):** envolver `qty × dosagePerPill` de `formatActiveIngredientShort` (doseUnit.js:386) em `cleanFloat` — artefato de float no chip de estoque.
- [x] T040 [US2b] **costAnalysis** (FR-027, ADR-067): `custoPorDose = precoUnidade / dosesPorUnidade` como primário; `custoPorDia` derivado e **formatado** (limite decimais — fim do `0,071…`). `costAnalysisSchema` += `custoPorDose`. Convenção de `dosesPorUnidade` p/ sólido (unidades por embalagem) vs líquido (rendimento FR-020) decidida aqui e documentada no service.
- [x] T041 [US2b] **Badges/chips** (FR-028, ADR-067): web `StockCardRedesign`/`StockPill` + mobile `StockLevelBadge`/`StockItem` exibem "N doses" ("N aplicações" injetável via `INJECTION_CONTAINER_SINGULAR`) p/ freq ≠ diário; **cor/status continua por `runwayDias`** (7/14/30). Diário inalterado ("N dias").
- [x] T042 [US2b] **Detalhe estoque** (FR-028): web + mobile mostram doses restantes + custo/dose primários, runway como linha secundária.
- [x] T043 [US2b] **Consumidores de display** (FR-029): `refillPredictionService` (data = hoje + runwayDias derivado), PDF (`_pdfSectionBuilders`/`consultationPdfDataBuilder`), Telegram `estoque.js` exibem doses + runway-contexto. Serverless: `dosesPorDia` reusa `frequencyDailyFactor` do core.
- [x] T044b [US2b] **`injection_container` por lote** (FR-030, ADR-068) — ⏭️ **PR DEDICADO** (decisão PO 2026-06-13: migração prod DROP COLUMN + UX de container separada do slice display; slice 2 = T039..T046 sem T044b): migração move coluna `medicines.injection_container` → `stock`/`purchases` (copiar valores existentes p/ lotes) e **DROPA `medicines.injection_container`** (decisão PO 2026-06-13 — fonte única = lote, sem default/sync). Coluna nova no lote com CHECK `INJECTION_CONTAINERS` (R-271) + Grants + RLS (template CLAUDE.md). Rendimento (FR-020) recalculado por lote; form de compra (web+mobile) exibe o campo em TODA compra (remover o `!isEdit`/`!medicine?.injection_container` que omitia subsequentes). Schema Zod: `medicineSchema` perde `injection_container`; schema de stock/purchase ganha (R-082/R-267). Mutação prod só com autorização PO.
- [x] T045 [US2b] **Cron de alerta de estoque (FR-013c, puxado D→B4, ADR-067)**: `_processUserStockAlert` ([_reminderHelpers.js:511](../../../server/bot/_reminderHelpers.js#L511)) — `dailyConsumption` converte intake→ml via `doseToMl` (B3 unit-aware) e aplica `frequencyDailyFactor` (hoje conta ml÷UI cru → Lantus "0 dias" falso); só dispara quando `runwayDias` real < limiar; payload `stock_alert` ([_payloadBuilders.js:148](../../../server/notifications/payloads/_payloadBuilders.js#L148)) exibe doses + unidade correta (R-272), não `stock.qty` ml rotulado "doses". Serverless não roda em dev → **teste jest obrigatório** `server/bot/__tests__/` (gotas/UI/ml/sólido + não-dispara-quando-ok).
- [x] T046 [US2b] **Convergência card de tratamento (web, ADR-067)**: `predictRefill` ([refillPredictionService.js:54](../../../apps/web/src/features/stock/services/refillPredictionService.js#L54)) aplica `frequencyDailyFactor` no consumo teórico (hoje trata dose semanal como diária → Mounjaro "0 dias" no card de tratamento vs "28 dias" no card de estoque). Resultado: card de tratamento e card de estoque convergem no mesmo `runwayDias`. Teste: Mounjaro semanal → mesmo valor em ambas as superfícies.
- [x] T044 [P] [C4] Testes: `stock.js` diasDeTomada × runway por frequência (diário; **Mounjaro semanal 1x 0,5ml estoque 2ml → 4 dias-tomada / 28 corridos**; **dias_alternados 2x/dia dose 1u estoque 20 → 10 dias-tomada / 20 corridos**); failure modes (estoque 0, dosePorTomada 0/NULL, time_schedule vazio); costAnalysis custo/dose (R$425); diário sem regressão; badge label doses vs dias; cleanFloat em formatActiveIngredientShort. **Regressões absorvidas:** cron Lantus 5,3ml/10UI/dia → 53 dias (não 0), não dispara alerta; predictRefill Mounjaro converge com stock card.

## Phase C — biomarkers_log + fast-logging + timeline híbrida — ADR-060

> **Escopo UI v1 (Planning 2026-06-14):** entrada de **glicemia + peso** (fast-logging + hub). **PA =
> schema-ready** (`value_secondary` na tabela/Zod; **sem UI 2-campos** nesta fase). Peso = 1 campo,
> unidade fixa `kg`, sem contexto de refeição.
> **Entrega SPLIT — mobile primeiro (PR 3a), web espelha (PR 3b):** PR 3a = migração + core
> (schema/adapter) + UI mobile; PR 3b = UI web (reusa core/migração mergeados). Smoke PO mobile no 3a;
> smoke web no 3b (R-234).
> **Mocks = visão direcional (não spec de pixel):** latitude de impl React puro; **travas SaMD
> permanecem** (cor=tipo, sem meta/zona/linha-de-média). Ver plan.md §Clarifications.
>
> **Design (referência, não contrato de pixel).** Consultar em dúvida de comportamento/intenção:
> `HANDOFF_DESIGN.md` §2.6/§4 · `DESIGN_BRIEFING.md` · `design-mocks/*.png` · componentes-mock
> `plans/backlog-native_app/MOCKS_APP_CRUD/project/dosiq-mocks/biomarker-screens{,-2}.jsx`
> (`MeasureCardC`/`WeekNav`/`BioChip`/`Keypad`/`BioToast`/`ScatterPlot`/`TypeChips`). Mobile Android
> = fonte; web = espelho. **SaMD: cor=tipo, nunca qualidade; sem meta/zona/linha-de-média.**

- [x] T013 [C1] Confirmar caminho real **mobile** do fast-logging + FAB + navegação da área de Medidas (UNVERIFIED no plan). Comparar com mocks Android. Registrar antes de codar.
- [x] T014 [US3] Migração `docs/migrations/2026XXXX_diabetes_c_biomarkers.sql`: `biomarkers_log` (`id,user_id,type,value,`**`value_secondary`**`,unit,measured_at,context,source,notes,created_at`) + GRANTs + RLS (`user_id=auth.uid()`) + REVOKE anon. Enums PT (R-021). **`value_secondary` numeric NULL = 2º componente de medida composta (PA: sistólica=value, diastólica=value_secondary; NULL p/ demais) — decisão PO 2026-06-10 (duas colunas).**
- [x] T015 [US3] [PR3a] `biomarkerLogSchema.js` (core) — sincronizado com CHECK (R-082); `safeParse`; `.nullable().optional()`. `context` enum PT: `jejum`/`pre_refeicao`/`pos_refeicao`/`ao_deitar`/`outro` (nullable, opcional). `type` default `glicemia`; `source` default `manual`. **`value_secondary` nullable; superRefine: `type='pressao_arterial'` ⇒ `value_secondary` obrigatório; demais tipos ⇒ NULL.** **PA é schema-ready (Planning 2026-06-14): regra fica no schema, mas v1 NÃO expõe UI de PA — superRefine separa BaseSchema (sem refine) + Schema (com), `BaseSchema.partial()` no update (R-274).** `peso` (kg) e `glicemia` (mg/dL) são os tipos com UI no v1; unidade fixa por tipo.
- [x] T016 [US3] Adapter `biomarkersToEvents` em `timelineService.js` → `TimelineEvent[]` `type='biomarker'` (R-252; **não tocar** `timeline.js`). Agrupar nos períodos da "Agenda de Hoje"; card "Última medida" no FIM (dose primeiro).
- [x] T017 [US3] `BiomarkerEventCard.jsx` (padrão **`MeasureCardC`**: `infoSoft`/plano/sem sombra/sem botão/`IconRuler` inline) + registrar `biomarker` em `eventCardRegistry.js` (web) + equivalente mobile. **Medida nunca com mais peso visual que dose** (elevação=ação, tinta=registro). Mock `dashboard_timeline_medidas.png`.
- [x] T017b [US3] Reservar `IconRuler` = **ícone `ruler` do lucide** em `dosiq-icons` (web/mobile shared) como marca única de biomarcador/medida (chips de tipo ficam **sem ícone**). Web: `lucide-react`; mobile: `lucide-react-native` (ou path SVG do glifo `ruler` se ícone shared for custom). Handoff §4.2.
- [x] T018 [US3] Fast-logging UI — **mobile (PR3a) → web espelha (PR3b)**: bottom sheet **layout B "idoso primeiro"** (valor gigante, contexto grid 2×2 ≥44px, tipo recolhido, unidade fixa, "Agora" ajustável, vírgula PT-BR R-270). **v1: glicemia (contexto refeição) + peso (kg, 1 campo, SEM contexto); PA fora da UI (schema-ready).** `Keypad` chrome do sistema FORA do sheet (`maxHeight 85%`; erro **altura-neutro** 64→48px+caption 12px). `BioChip`/`BioToast`. Erro = transparência radical (o que falhou/nada salvo/dados mantidos/retry). Mock = visão direcional (`C registro tintado`/`Erro valor inválido`); latitude React puro; trava SaMD. Reusa AP-180.
- [x] T018b [US3] **FAB do Hoje = speed-dial** (Registrar dose · Registrar medida) — **mobile (PR3a) → web (PR3b)**. Toca Dashboard vivo; main integra. Mock `FAB speed-dial expandido` (visão).
- [x] T018c [US3b] **Área de Medidas — mobile (PR3a) → web espelha (PR3b)**: entrada A (card "Última medida" no fim do Hoje) + B (**Perfil › Ferramentas › Medidas**, entre Histórico de Doses e Modo Consulta). Hub v1 = histórico cronológico (filtro `TypeChips` sem ícone) + tendência `ScatterPlot` (pontos/dia, 1 cor `infoRing`, **7d FIXO + `WeekNav`**, seta-presente desabilitada, **sem 7d/30d, sem zona/meta/linha** — SaMD; média=número). Sheet detalhe espelha dose (*Editar*·**Ver o dia completo**·*Excluir*) — **inclui service CRUD completo de biomarcador (update/delete), não só create**. **v1 multi-tipo = glicemia + peso** (TypeChips com 2 tipos reais); **PA não entra na UI** (schema-ready). Hub genérico sem redesenho ao ligar PA depois. **Estado-zero obrigatório** (área+dia vazios, convite inline). Mock = visão direcional (`B Perfil Ferramentas`/`Hub Glicemia V1`/`Hub Peso`/`Detalhe da medida`/`Estado zero`/`Dia vazio`).
- [x] T019 [P] [C4] Testes: biomarcador cria linha; aparece na timeline por instante (sem tocar builder); sem FK dose; sem meta; RLS isola por user; `WeekNav` clampa no presente; estado-zero e erro renderizam; **glicemia + peso ponta-a-ponta**; superRefine PA (value_secondary obrigatório p/ PA, NULL demais) **mesmo sem UI**; **checklist SaMD** (sem cor/copy de qualidade, sem linha de média).

> **Split de PR (Planning 2026-06-14):**
> - **PR 3a (mobile + core):** T013 (C1 mobile path), T014 (migração `biomarkers_log`), T015 (schema core),
>   T016 (adapter core), T017+T017b (card+ícone), T018/T018b/T018c **mobile**, T019 (testes core+mobile).
>   Migração e core entram aqui (web reusa). Smoke PO mobile → PR.
> - **PR 3b (web espelha):** T017 card web (`eventCardRegistry`), T018/T018b/T018c **web** reusando
>   core/migração do 3a; testes web. Smoke web → PR.
> Core/schema/adapter/migração **não** se duplicam (R-231); web importa de `@dosiq/core`.

## Phase D — Insulina basal (UI/volume) (PR 4)

- [x] T020 [C1] Verificar em prod (MCP): `consume_stock_fifo` já converte `UI`→ml (`lower(intake_unit) IN ('gotas','ui')`, migr. `20260608`). ✅ **núcleo entregue por 022** — Fase D não recria a conversão; **única alteração permitida na RPC = T021b** (default densidade por unidade; AP-221: atualizar callers se assinatura mudasse — não muda).
- [x] T021 [US4] Smoke insulina U-100: tomada `10 UI` → debita `0,10 ml` por FIFO. Cobrir U-200 (`units_per_ml=200`) se aplicável. Confirmar densidade capturada no tratamento (form de protocolo, `intake_unit='UI'`).
- [x] T021b [US4] 🔴 **Fix default densidade p/ UI (FR-013b — risco clínico 5×)**: (a) form de tratamento prefill `units_per_ml=100` quando `intake_unit='UI'` (editável; nunca vazio→20); (b) RPC `consume_stock_fifo` default por unidade — `CASE WHEN lower(intake)='ui' THEN 100 ELSE 20 END` (aditivo, assinatura intacta; migração própria); (c) regressão completa gotas/ml/sólido. **Anula a nota "não alterar RPC" SÓ neste ponto.**
- [x] T022 [US4] Auditar superfícies de dose de insulina (dashboard/histórico/timeline/estoque/emergência/consulta): query traz `intake_unit`+`units_per_ml` (R-267) e render via `formatIntakeDose`/`formatDoseItem`/`formatDoseHint` (R-272, **reusa 022**) — nunca `dosage_unit` cru. Inputs numéricos normalizam vírgula PT-BR (R-270).
- [x] T022b [US4] 🔴 **Fix push `stock_alert` líquidos (FR-013c — regressão 022)**: `_processUserStockAlert` (`server/bot/_reminderHelpers.js`) calcula `daysRemaining` sem converter consumo gotas/UI→ml (estoque líquido em ml desde 022) → falso alerta crítico; payload exibe `remaining` cru. Fix: (a) select do cron += `units_per_ml`+`dosage_unit` (R-267); (b) `dailyConsumption` ÷ `units_per_ml` quando `lower(intake_unit) IN ('gotas','ui')` — mesma regra da RPC, incl. default por unidade do T021b; (c) `remaining` formatado na unidade certa no builder (R-272). Serverless sem dev → testes jest `server/bot/__tests__/` cobrindo gotas/UI/ml/sólido; avaliar dry-run via env var. **Math de unidade: main/opus.**
- [x] T022c [US4] ✅ **ENTREGUE Fase D (PR 4, branch `feature/012-diabetes/phase-d`)** — **As-built (reality check C1.5 corrigiu o diagnóstico):** o caminho live `formatDoseReminder`→`formatMedicineDescription` JÁ é intake-aware (correto); o `buildDoseReminderPayload`+`formatDose` local nomeados na spec eram **código morto** (sem caller) → removidos. A **única superfície live quebrada** era `daily_digest` (consome `formatDose` lossy). Fix: digest via `formatDoseItem` (@dosiq/core) + read-path `_reminderHelpers` digest carrega `intake_unit`/`units_per_ml`/`dosage_per_pill` (R-267) + schema aditivo (R-193); concentração do lembrete com case canônico via `DOSAGE_UNIT_LABELS`. Testes vitest server 192/0. (Backfill de `intake_unit` NULL **não** foi necessário: o caminho live já trata `intakeUnit ?? null` e exibe a unidade correta quando presente.) ~~`formatDose` local~~
- [~] ~~T022c (texto original)~~: `formatDose` local em `server/notifications/payloads/_payloadBuilders.js:16` ignora `intake_unit` e força lowercase → líquido sai "Lantus (100ui/ml) · 10 un. — 12:00" em vez de "10 UI". Fix: (a) payload de dose carrega `intake_unit`+`units_per_ml` (R-267; schema Zod do kind atualizado — R-193); (b) frase via formatters core de 022 (`formatIntakeDose`/`formatDoseItem`, R-272) — **eliminar `formatDose` local** (fallback "1 un." p/ mg/ml também é lossy); (c) case canônico de unidade na exibição (`UI`/`UI/ml` uppercase; `mg`/`ml` lowercase). Cobre push, Telegram e alarme crítico (mesmos builders). Testes jest `server/` sólido/gotas/ml/UI + case. **Diagnóstico 2026-06-11 (investigação pré-Fase D):** o caminho do screenshot é `formatDoseReminder`→`formatMedicineDescription` (`buildNotificationPayload.js:159`) — esse caller JÁ passa `intakeUnit` (`_reminderHelpers.js:268`) e o helper JÁ o usaria; o "10 un." indica `protocols.intake_unit` **NULL no banco** (protocolo pré-022?) → T022c DEVE incluir verificação/backfill de dados (`intake_unit` de protocolos líquidos ativos) além do código; o "(100ui/ml)" é `dosage_unit` cru lowercase (case canônico = código). O `formatDose` de `_payloadBuilders.js:16` é um SEGUNDO formatter lossy (digest/builders antigos) — consolidar ambos nos formatters core.
- [x] T023 [US4] Adesão basal = modo binário (R-248) — confirmar dose fixa; `dose_exactness` fora.
- [x] T024 [P] [C4] Testes/smoke: 10 UI → 0,10 ml (U-100) por FIFO (verificação, não nova impl.); TTL antes do volume; render via formatter (R-272); regressão sólido/gotas/ml intacta.

## Phase E — Export clínico (PR 5) — 🚫 DESCOPED 2026-06-15 → realocada p/ spec 007

> Decisão PO 2026-06-15: a Fase E **não** será executada no escopo do 012. O FR-016
> (cruzamento dose × biomarcador no PDF) foi movido p/ a **spec 007**; os conceitos do 012
> (líquidos/injetáveis/biomarkers) foram absorvidos por 005/006/007/008. Tasks abaixo
> mantidas como referência histórica (não executar aqui).

- [~] ~~T025 [C1] Mapear o caminho real do relatório PDF clínico (Spec 007 base).~~ → spec 007
- [~] ~~T026 [US5] Relatório cruza dose × `biomarkers_log` por período/dia, server-side (R-249), descritivo (SaMD).~~ → spec 007 (FR-016)
- [~] ~~T027 [P] [C4] Testes: agregação server-side; PDF sem cálculo de dose.~~ → spec 007

## Quality Gates & Record (cada PR)

- [ ] T028 [C4] `rtk npm run validate:agent` + smoke PO (mobile) antes do PR (R-234).
- [ ] T029 [C5] SQP (R-221): A=Backend/infra · B/C/D=Web+Mobile+Core (minor, store-note diabetes) · E=Web (minor). CHANGELOG [Unreleased] por plataforma.
- [ ] T030 [C5] ADR-059..062 → accepted antes do código da fase respectiva; catalogar CON `biomarkers_log`. PR por fase; Gemini + smoke PO + aprovação humana (R-060). Nunca auto-merge.

## Dependencies
022 mergeada → A. B e C paralelizáveis após A. D depende de C. ~~E depende de C+D.~~ (E descoped → 007)

## Traceability
FR-001..004 + 002(prefill)/004b → A (T002–T007, T005b) · FR-005..008 + 005b/008b → B (T008–T012, T011b) · FR-009/010/011/012 + 010b/011b/012b → C (T014–T019, T017b, T018b, T018c) · FR-013/013b/013c/014/015/015b → D (T021–T024, **T021b**, **T022b**, **T022c**) · FR-016 → E (T026). US3b → T018c.

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
| **T003 / T010 / T021b / T022b** (write-path AP-193 / tolerância clínica / **default densidade UI na RPC — math de dose**) | **main / opus** — não delegar |
| T005b (kind notificação TTL) / T011b (carry-over multi-dia) | sonnet; **main** valida payload (R-193/CON-019) e UX do Hoje |
| T021 / T024 (smoke insulina) | humano (PO) |
| T028 / T029 / T030 [C4/C5] (gates/SQP/record) | **main / opus** |
