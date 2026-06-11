# Implementation Plan: Suporte a Diabéticos Tipo 2 (Épico)

**Feature Directory**: `plans/specs/012-diabetes-t2-support`
**Spec**: `spec.md`
**Created**: 2026-06-04
**Tier**: 2 (épico — 5 fases A→E, multi-PR)

---

## Summary

Épico ponta-a-ponta para diabetes T2, faseado A→E. Constrói sobre a fundação já em prod
(`dose_instances`/ADR-050, FP-1..FP-4) e sobre a spec 022 (líquidos, ADR-058: `units_per_ml` +
`presentation`). **Registro passivo** — zero cálculo/sugestão de dose (linha SaMD, ADR-062).

---

## Technical Context (evidência real verificada)

| Área | Evidência (file:line / DB) | Implicação |
|------|----------------------------|-----------|
| Tolerância | `computeTolerances` (`packages/core/src/utils/doseInstanceGenerator.js:76-94`): **não-diário → `MAX_TOLERANCE_MINUTES`=120 FIXO**; diário multi → `min(floor(gap/2),120)` | FR-007 net-new: não-diário precisa derivar do **período da frequência** (semanal=10080min) **sem cap** — hoje retorna 120 chapado |
| Tolerância (prod) | `dose_instances.tolerance_minutes` default 120; prod min 21 / max 120 (MCP) | cap de 2h confirmado em dados; só não-diário muda |
| Titulação | `protocols.titration_schedule` (jsonb), `current_stage_index`, `stage_started_at`, `titration_status` ('estável') — todos em prod (MCP). `titrationService.js`, `TitrationWizard/Timeline/Badge.jsx`, `@dosiq/core titrationUtils.js` | infra **existe** — FR-005 audita/corrige, não reconstrói |
| Dose congelada | `expected_dose numeric` (prod); gerador congela na geração (FP-1) | titulação GLP-1 cabe sem novo mecanismo (FR-006) |
| Decimais | colunas dose `numeric`; Zod `z.number()` sem `.int()` | `0,5` já aceito — sem mudança de coluna |
| `medicines` | `type` CHECK `('medicamento','suplemento')` (categoria); ✅ `presentation` + `units_per_ml` **em prod (022)**; **sem** `shelf_life_days` | `presentation`/`units_per_ml` consumidos (022, ADR-058); `shelf_life_days` é o único net-new de `medicines` (Fase A) |
| `stock` | `quantity`/`original_quantity` `numeric`; **sem** `opened_at` (MCP) | `opened_at` net-new (Fase A) |
| Timeline (R-252) | `timelineService.doseInstancesToEvents` (`timelineService.js:118`) adapter; `timeline.js` builder PURO; `eventCardRegistry.js` (web). Comentários: "biomarkers_log → adapter biomarker entra ao lado" | FR-011: Fase C adiciona adapter + card, **sem tocar builder/UI de dose** |
| formatters de dose | ✅ `doseUnit.js` tem `formatIntakeDose`/`formatDoseItem`/`formatDoseHint`/`isLiquidMedicine` (022) | FR-015 = **consumir** (R-272), não revisar; ADR-046 legado já superado |
| `biomarkers_log` | **não existe** (MCP) | net-new (Fase C) |
| `consume_stock_fifo` | assinatura `(p_user_id,p_medicine_id,p_quantity,p_medicine_log_id)`; ✅ converte `gotas` **E** `UI`→ml via `units_per_ml` (022 Fase C, migr. `20260608`); ⚠️ default `COALESCE(...,20)` é de **gotas** | FR-013 = smoke U-100/U-200; **FR-013b = única alteração na RPC**: default por unidade (UI→100) — risco clínico 5× (T021b) |
| Fast-logging mobile | **não localizado** por grep (FAB/BottomSheet) | ⚠️ UNVERIFIED — C1 da Fase C confirma o caminho real |

---

## Constitution Check

| Princípio | Status | Nota |
|-----------|--------|------|
| I — Health Data Safety | ✅ | glicemia é dado clínico sensível → RLS `user_id=auth.uid()` em `biomarkers_log`; testes com fixtures. **SaMD: zero cálculo de dose** (ADR-062) |
| II — Mobile-First | ✅ | fast-logging fricção-zero; timeline bounded; Zero Cognitive Noise (densidade T2 baixa) |
| III — Server-Agg | ✅ | export clínico (Fase E) agrega server-side (R-249) |
| IV — Timezone | ✅ | `measured_at`/`scheduled_for` instantes absolutos; tz do perfil ponta-a-ponta (G1 fechado) |
| V — Contract/ADR | ✅ | ADR-058 (accepted) + ADR-059..062 (este Planning); `consume_stock_fifo` mantém assinatura (CON), `biomarkers_log` nova CON |
| VI — SQP | ✅ | por fase: A=Backend(migração) · B/C/D=Web+Mobile+Core (minor, store-note) · E=Web (minor) |

---

## Arquitetura / Approach por fase

### Fase A — Forma injetável + validade biológica (TTL) — ADR-059
**Pré-req:** 022 mergeada (traz `presentation`/`units_per_ml`).
- Migração: `medicines.shelf_life_days INTEGER NULL`; `stock.opened_at TIMESTAMPTZ NULL`.
- `opened_at` **inferido na 1ª tomada** que debita o lote: setar dentro de `consume_stock_fifo`
  (ou no caminho de registro) quando `opened_at IS NULL` no lote consumido — best-effort (R-245).
- Alerta TTL = **computado** (`opened_at + shelf_life_days*interval ≤ now`), helper puro no core;
  eixo paralelo ao status 4-tiers de volume (ADR-018), render dedicado (relógio).
- **TTL também notifica** via stack existente (push/Telegram — FR-004b): kind novo no dispatcher
  (R-200/CON-019, enum Zod R-193); cadência D-3 + vencimento. Idoso que não abre o app fica sabendo.
- `presentation` ganha uso real: forms permitem `injecao`/`pomada` (UI dedicada — escopo 012).
  `shelf_life_days` com **prefill 28 quando `presentation='injecao'`** (editável — anti-feature-morta).

### Fase B — GLP-1 (mg, semanal, titulação) — ADR-061
- **Auditar titulação** (FR-005): rodar `titrationUtils` + wizard num protocolo novo, mapear
  regressões pós-refactor, corrigir. Sem reescrever o modelo.
- **Tolerância não-diária sem cap** (FR-007/ADR-061): `computeTolerances` ganha ramo
  frequency-aware — para `semanal`/`dias_alternados`, intervalo = período entre ocorrências
  (semanal=10080min, alternados=2880min); tolerância = `floor(intervalo/2)` **sem `MAX_TOLERANCE`**.
  Diário inalterado (mantém cap 120). Requer passar a `frequency` ao gerador.
- `dose_instances.expected_dose` congela a etapa de titulação vigente (reusa gerador, FP-1).
- Marcar crítico = flag `critical_alarm` (spec 010) — sem reimplementar.

### Fase C — `biomarkers_log` + fast-logging + timeline híbrida — ADR-060

> **Design prescritivo (decisões fixadas pelo PO).** Fonte canônica:
> [HANDOFF_DESIGN.md](../../backlog-native_app/MOCKS_APP_CRUD/HANDOFF_DESIGN.md) §2.6 (decisões) +
> §4 (sistema visual: tokens/ícones/primitivas) · [DESIGN_BRIEFING.md](./DESIGN_BRIEFING.md) ·
> PNGs em [design-mocks/](./design-mocks/) · componentes-mock (React puro, **sem** Zod/Supabase/
> hooks — recriar, não copiar estrutura) em
> `plans/backlog-native_app/MOCKS_APP_CRUD/project/dosiq-mocks/biomarker-screens{,-2}.jsx` (exportam
> em `window`: `MeasureCardC`/`WeekNav`/`BioChip`/`Keypad`/`BioToast`/`ScatterPlot`/`TypeChips`).
> Plataforma do mock = **Android**; web é espelho (coder adapta). **Coder em dúvida de pixel/
> comportamento → consultar esses arquivos antes de inventar.**

**Dados/core:**
- Migração: tabela `biomarkers_log` (`id`,`user_id`,`type`,`value`,**`value_secondary`**,`unit`,
  `measured_at`,`context`,`source`,`notes`,`created_at`) + grants + RLS (`user_id=auth.uid()`),
  enums PT (R-021). `context` enum PT: `jejum`/`pre_refeicao`/`pos_refeicao`/`ao_deitar`/`outro`.
  **`value_secondary` (numeric NULL)** = 2º componente de medida composta — PA: sistólica=`value`,
  diastólica=`value_secondary`; NULL p/ glicemia/peso/batimentos (decisão PO 2026-06-10: duas
  colunas; sem isso a genericidade quebrava no 3º tipo prometido).
- `biomarkerLogSchema` (core) sincronizado com CHECK (R-082).
- Adapter `biomarkersToEvents` (core) → `TimelineEvent[]` `type='biomarker'` (R-252, **sem tocar**
  `timeline.js` builder). **Sem FK rígido** com `dose_instances`; correlação só temporal.

**UI — fast-logging (UX-A) [mock: `C registro tintado`, `Sheet A preterida`, `Erro valor inválido`]:**
- Bottom sheet **layout B "idoso primeiro"**: valor gigante centrado, contexto grid 2×2 (alvos
  ≥44px), tipo recolhido a 1 linha (glicemia=default 90%), unidade fixa por tipo, horário default
  "Agora" ajustável, vírgula PT-BR (R-270). Componentes: `Keypad` (chrome do sistema, **fora** do
  sheet — `DosiqBottomSheet maxHeight 85%`; estados de erro **altura-neutros**: valor 64→48px +
  caption 12px), `BioChip` (contexto), `BioToast` (sucesso/erro). Erro = transparência radical.
- **FAB do Hoje = speed-dial** (Registrar dose · Registrar medida) [mock `FAB speed-dial`].

**UI — timeline híbrida (UX-B) [mock: `C registro tintado ESCOLHIDA`]:**
- Renderer `BiomarkerEventCard` registrado em `eventCardRegistry.js` (web) + equivalente mobile,
  implementando o padrão **`MeasureCardC`**: fundo `infoSoft`, **plano**, sem sombra, sem botão,
  `IconRuler` inline. Dose permanece card branco **elevado** (elevação=ação, tinta=registro;
  **medida nunca com mais peso visual que dose**). Agrupar nos períodos da "Agenda de Hoje";
  card "Última medida" no **FIM** (dose primeiro).

**UI — área de Medidas (UX-C) [mock: `B Perfil Ferramentas Medidas`, `Hub Glicemia V1`, `Hub Peso`,
`Detalhe da medida`, `Estado zero`]:**
- Entrada A (card "Última medida" no fim do Hoje) + B (**Perfil › Ferramentas › Medidas**, entre
  Histórico de Doses e Modo Consulta) — coexistem.
- Hub v1: histórico cronológico (filtro por tipo via `TypeChips`, **sem ícone**) + tendência
  **`ScatterPlot`** (pontos/dia, 1 cor `infoRing`, **7d FIXO + `WeekNav`**, seta-presente
  desabilitada, **sem 7d/30d**, **sem zona/meta/linha** — SaMD; média = número descritivo).
- Sheet de detalhe espelha o de dose: *Editar registro* · **Ver o dia completo** (ponte timeline) ·
  *Excluir registro*. Multi-biomarcador (glicemia/peso/PA) sem redesenho.
- **Estado-zero obrigatório** (área vazia + dia vazio) — convite inline teal soft + dashed + CTA.
- Caminho real do fast-logging/navegação **mobile UNVERIFIED** → resolver em C1 (T013) antes de codar.

> **Trava SaMD (permanente):** cor diferencia *tipo* de evento (teal=dose · azul-info=medida),
> **nunca qualidade** do valor. Sem meta/zona/alvo/semáforo/linha-de-média. Médias descritivas.

### Fase D — Insulina basal (UI/volume)
- ✅ **Conversão UI→ml já em prod** (022 Fase C, `consume_stock_fifo`, migração `20260608`):
  `ml = ROUND(p_quantity/units_per_ml,2)` para `lower(intake_unit) IN ('gotas','ui')`.
- 🔴 **FR-013b (catch CPTO 2026-06-10)** — **única exceção** ao "não alterar RPC": o default
  `units_per_ml=20` (gotas) aplicado a insulina sem densidade preenchida = decremento **5× errado**
  (10 UI → 0,5 ml em vez de 0,10 ml). Fix em 2 camadas (T021b): (a) form de tratamento prefill
  `units_per_ml=100` quando `intake_unit='UI'`; (b) RPC default por unidade
  (`CASE WHEN lower(intake)='ui' THEN 100 ELSE 20 END`) — aditivo, assinatura intacta (AP-221 ok),
  migração própria + regressão gotas/ml/sólido. **Math de dose → main/opus, não delegar.**
- 🔴 **FR-013c (regressão 022, PO 2026-06-11)** — push `stock_alert` do cron serverless sem
  conversão ml: `_processUserStockAlert` (`server/bot/_reminderHelpers.js`) divide estoque em ml
  por consumo em gotas/UI → `daysRemaining` errado (falso crítico) e `remaining` exibido cru.
  Fix (T022b): select do cron += `units_per_ml`/`dosage_unit`; converter `dailyConsumption` p/ ml
  (mesma regra da RPC, default por unidade de FR-013b); payload via formatter (R-272). Serverless
  não testável em dev → testes jest obrigatórios (gotas/UI/ml/sólido) em `server/bot/__tests__/`.
  **Math de unidade → main/opus, não delegar.**
- Adesão basal = modo **binário** existente (R-248); `dose_exactness`/bolus = fora (T1).
- Exibição de dose: **reusar formatters core de 022** (`formatIntakeDose`/`formatDoseItem`/
  `formatDoseHint`, R-272) com a unidade de tomada (UI); query traz `intake_unit`+`units_per_ml`
  (R-267). `formatDoseUnit`/ADR-046 legado já substituído — **sem revisão nova**.
- Inputs numéricos (dose/densidade): normalizar vírgula PT-BR `','`→`'.'` (R-270).

### Fase E — Export clínico
- Relatório PDF cruza doses × `biomarkers_log` por período/dia, agregação **server-side** (R-249),
  **descritivo** (sem recomendação — SaMD).

---

## Data-Migration Scenarios

| Migração | Fase | Rows existentes | Verificação |
|----------|------|-----------------|-------------|
| `medicines.shelf_life_days` (NULL) | A | nascem NULL (TTL inativo) | query `shelf_life_days IS NULL` = 100% |
| `stock.opened_at` (NULL) | A | nascem NULL (lote "fechado"); inferido na 1ª tomada | nenhum lote vira "aberto" retroativo |
| `biomarkers_log` (CREATE) | C | tabela nova, vazia | grants + RLS confirmados |
| ~~`consume_stock_fifo` branch UI~~ | ~~D~~ | ✅ **JÁ EM PROD** (022 Fase C, migr. `20260608`) — Fase D não migra | smoke U-100/U-200 |
| Injetáveis legados | A | se `dosage_unit='ui'` em prod → revisar `presentation` manual | documentado, não silencioso |

---

## Target Files (canônicos — verificar single-result em C1 de cada fase)

| Path | Fase | Purpose | Evidence |
|------|------|---------|----------|
| `docs/migrations/2026XXXX_diabetes_a_injectable_ttl.sql` | A | [NEW] `shelf_life_days` + `stock.opened_at` | migration |
| `packages/core/src/utils/doseInstanceGenerator.js` | B | `computeTolerances` frequency-aware (não-diário sem cap) | `:76` verificado |
| `packages/core/src/utils/titrationUtils.js` | B | auditar/corrigir | verificado |
| `apps/web/src/features/protocols/services/titrationService.js` | B | auditar/corrigir | verificado |
| `docs/migrations/2026XXXX_diabetes_c_biomarkers.sql` | C | [NEW] `biomarkers_log` + grants + RLS | migration |
| `packages/core/src/schemas/biomarkerLogSchema.js` | C | [NEW] schema Zod (enums PT) | NEW |
| `packages/core/src/services/timelineService.js` | C | adicionar `biomarkersToEvents` (adapter) | `:118` verificado |
| `apps/web/src/views/redesign/history/eventCardRegistry.js` | C | registrar `biomarker` | verificado |
| `apps/web/src/views/redesign/history/BiomarkerEventCard.jsx` | C | [NEW] card padrão `MeasureCardC` (infoSoft/plano/IconRuler) | NEW · mock `C registro tintado` |
| Fast-logging sheet + FAB speed-dial (web) | C | [NEW] sheet layout B + FAB dose/medida | mock `FAB speed-dial`/`C registro tintado` |
| Área de Medidas — hub web (histórico + `ScatterPlot`/`WeekNav`/`TypeChips`) | C | [NEW] Perfil›Ferramentas›Medidas + entrada "Última medida" no Hoje | mock `Hub Glicemia V1`/`B Perfil Ferramentas` |
| Fast-logging + FAB + área Medidas **mobile** | C | **UNVERIFIED** — C1 (T013) confirma caminho real | ⚠️ mock Android é a fonte |
| `IconRuler` (= lucide `ruler`) em `dosiq-icons` (web/mobile shared) | C | marca única de biomarcador (reserva semântica) | mock §4.2 handoff |
| `packages/core/src/utils/doseUnit.js` | D | ✅ formatters líquidos já existem (022) — só **consumir** (R-272), não revisar | verificado |
| ~~`docs/migrations/...diabetes_d_consume_ui.sql`~~ | ~~D~~ | ✅ **REMOVIDO** — conversão UI→ml já em prod (022 `20260608`) | n/a |
| Export PDF (Fase E) | E | cruzar dose×biomarker server-side | a mapear em C1/E |

---

## Contracts and ADRs

- **ADR-058** (accepted) — `units_per_ml` + `presentation` (origem 022; consumidos aqui).
- **ADR-059** (proposed) — TTL biológico: `stock.opened_at` (inferido 1ª tomada) + `medicines.shelf_life_days`; eixo paralelo a ADR-018.
- **ADR-060** (proposed) — `biomarkers_log` genérico + adapter timeline (R-252); sem FK rígido; sem meta (SaMD).
- **ADR-061** (proposed) — tolerância não-diária derivada do período da frequência, sem cap; diário mantém 120.
- **ADR-062** (proposed) — fronteira SaMD: registro passivo, zero cálculo/sugestão de dose (ANVISA RDC 657/751).
- **CON (novo)** — `biomarkers_log` shape + `biomarkerLogSchema` (catalogar em C5).
- **CON** — `consume_stock_fifo` assinatura `(p_user_id,p_medicine_id,p_quantity,p_medicine_log_id)`
  e conversão UI→ml **já em prod (022 Fase C)** — Fase D **não toca** a RPC. Se algum dia mudar a
  assinatura: atualizar TODOS os callers (web/mobile/bot) na mesma fase + smoke (AP-221).

---

## Risks + Quality Gates

| Risco | Mitigação |
|-------|-----------|
| Titulação regredida (FR-005) | auditoria dedicada na Fase B antes de confiar no fluxo GLP-1 |
| Tolerância sem cap afrouxar adesão | mudança **só** não-diário; diário mantém 120 (testes de regressão de adesão) |
| `opened_at` inferido em caminho errado | setar no consumo de lote, best-effort (R-245); teste cross-superfície (web/bot/mobile) |
| Fast-logging mobile path desconhecido | C1 da Fase C resolve antes de codar |
| SaMD drift | ADR-062 + revisão: nenhuma fórmula de bolus/carbo; sem meta glicêmica |
| `biomarkers_log` sem RLS | template CLAUDE.md (grants + RLS + REVOKE anon) |

**Gates por fase:** `rtk npm run validate:agent` (lint 0 + crítica) + smoke PO (mobile) + Gemini review + aprovação humana (R-060). Nunca auto-merge.

> **Sequenciamento duro:** 022 mergeada antes do C-coding desta spec. Fases internas A→B→C→D→E
> (B e C podem paralelizar após A; D depende de C; E depende de C+D).

---

## Orquestração & Model Tiering

Estratégia para acelerar a entrega e economizar quota do plano Claude Pro: delegar **tarefas-folha
bounded** a sub-agentes em modelos mais baratos (sonnet/haiku), mantendo julgamento clínico e
integração no main thread (opus). Economia real vem de (a) modelo mais barato por tarefa e
(b) output cavecrew comprimido (~60% menos tokens reinjetados no main) — **não** do spawn em si.

### Invariantes (não-negociáveis)

- **AP-169 — Branch Sync Ritual:** antes de spawnar agente que toca `packages/*` ou
  `apps/*/src/features/*`: `git fetch origin` → confirmar branch sync com origin → só então spawnar.
  Agente em branch desatualizada duplica arquivos (custo: 15+ min reset hard).
- **Sub-agentes NUNCA commitam na main.** Sempre branch + PR + aprovação humana (R-060).
- **cavecrew-reviewer NÃO é gate de review.** Revisor oficial = Gemini no PR. cavecrew só para
  localizar/editar/investigar, nunca como porta de aprovação.
- **cavecrew-builder recusa 3+ arquivos** — só edição cirúrgica 1-2 files.
- **SaMD/Health (Constitution I + ADR-062):** lógica de dose/estoque/tolerância/UI→ml é clínica.
  O main thread RETÉM C1.5 reality-check, C4 DoD file-by-file, integração cross-superfície
  (ancoragem write-path AP-193) e a fronteira SaMD. Não delegar julgamento.
- **Haiku:** só tarefa-folha trivial (boilerplate, copy PT, scaffolding). **NUNCA** em math de
  dose, conversão UI→ml, tolerância ou RLS/grants — risco clínico > economia.
- **Trap SaMD de render (UI clínica delegada):** modelo barato tende a "ajudar" adicionando
  faixa-alvo, cor alto/baixo, "faixa normal" ou **linha de média** no scatter/cards de medida —
  isso **viola SaMD (ADR-062)**. Os mocks **não** têm nenhum desses. Prompt de qualquer sub-agente
  de UI clínica DEVE: (a) **espelhar o mock exatamente, nunca "melhorar"**; (b) cor = só tipo de
  evento (teal=dose · azul-info=medida), nunca qualidade; (c) média da semana = **número**, jamais
  linha. **Main revisa todo output de render clínico contra o checklist SaMD** antes do PR — não
  confiar no sub-agente.
- **Espelhar mock, não inventar:** tarefa de UI com mock fixo → sub-agente consulta
  `design-mocks/*.png` + `biomarker-screens{,-2}.jsx` e reproduz; **recria** nos componentes reais
  (mock é React puro sem Zod/Supabase), não copia estrutura nem adiciona afunção fora do mock.
- **Antes de criar `WeekNav`/`ScatterPlot`: investigar reuso.** Handoff diz que `WeekNav` é "mesmo
  padrão do Histórico de Doses" → C1 verifica se já existe equivalente no código real (evitar
  duplicata — R-231/AP-169).

### Núcleo não-delegável (main / opus)

C1.5 reality-check por fase · C4 DoD file-by-file (citar linha) · integração cross-superfície
(web/mobile/bot) · decisão SaMD · merge de outputs de sub-agentes em PR coerente.

### Paralelismo

- **Inter-fase:** B ∥ C após A (já no faseamento). 1 branch/PR por fase.
- **Intra-fase:** apenas tarefas marcadas `[P]` (independentes) podem rodar em sub-agentes
  concorrentes. Tarefas com dependência de ordem ficam sequenciais no main.

### Mapa de tier por tarefa

| Task | Tipo | Agente / modelo |
|------|------|-----------------|
| T001/T013/T020/T025 [C1] | investigação/verificação read-only | cavecrew-investigator (haiku/sonnet) |
| T008 auditar titulação | investigação read-only | cavecrew-investigator (sonnet) |
| T002/T014 migração SQL (RLS/grants) | mecânico, security-crítico | sonnet (nunca haiku) |
| T010 `computeTolerances` freq-aware | lógica clínica (tolerância) | **main / opus** (ou sonnet-high) |
| T003 inferir `opened_at` cross-superfície | integração write-path (AP-193) | **main / opus** |
| T004 helper `isBiologicallyExpired` | puro, bounded 1-2 files | cavecrew-builder (sonnet) |
| T015 `biomarkerLogSchema` | schema Zod bounded | sonnet |
| T016 adapter `biomarkersToEvents` | bounded, R-252 (não toca builder) | sonnet |
| T005/T017 cards (MeasureCardC) | UI bounded c/ mock fixo | sonnet (+ui-design-brain, espelha mock); **main** valida SaMD |
| T017b reservar `IconRuler` | folha trivial (1 ícone shared web+mobile) | cavecrew-builder (sonnet) ou haiku |
| T018 fast-log sheet (layout B) | **tela mais importante** (a11y idoso ≥44px + sheet/teclado maxH 85% + SaMD) | sonnet (+ui-design-brain); **main** valida a11y + overflow do sheet + SaMD |
| T018b FAB speed-dial | muda nav do Dashboard existente (web+mobile) | sonnet (render); **main** integra (toca tela viva, não greenfield) |
| **T018c área de Medidas (DECOMPOR)** | telas novas + nav + scatter SaMD | ver decomposição abaixo — **não** 1 spawn único |
| T006/T022/T023 forms/render dose | UI + read-path (R-267/R-272) | sonnet (render); **main** valida SaMD |
| T026 export PDF clínico | agregação server-side + SaMD | sonnet; **main** valida fronteira |
| T007/T012/T019/T024 [P] testes | cobertura | sonnet (paraleliza) |
| T021/T024 smoke insulina | manual/PO | humano (n/a) |
| T028/T029/T030 [C4/C5] gates/SQP/record | quality gate + memória | **main / opus** |

### Decomposição de T018c (área de Medidas — grande demais p/ 1 sub-agente)

Quebrar em sub-unidades; **main retém wiring de navegação + validação SaMD do scatter**:

| Sub-unidade | Tipo | Agente |
|-------------|------|--------|
| `WeekNav` (reusar se já existir — investigar em C1) | componente bounded reusável | cavecrew-builder/sonnet |
| `ScatterPlot` (pontos/dia, 1 cor, **sem zona/meta/linha** — SaMD) | render clínico bounded | sonnet (espelha mock); **main valida SaMD** |
| `TypeChips` (filtro por tipo, sem ícone) | folha trivial | cavecrew-builder/sonnet |
| Lista histórico cronológico + sheet detalhe (Editar/Ver dia/Excluir) | UI bounded | sonnet |
| Estados-zero (área + dia vazios) | folha (copy + convite inline) | sonnet/haiku |
| **Wiring de navegação** (Perfil›Ferramentas›Medidas + card "Última medida" no fim do Hoje) | **integração cross-tela** | **main / opus** |

Sub-unidades de render rodam `[P]` após a nav existir; o card `MeasureCardC` (T017) é pré-req visual.
