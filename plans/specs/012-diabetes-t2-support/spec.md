# Feature Specification: Suporte a Diabéticos Tipo 2 (Épico)

**Feature Directory**: `plans/specs/012-diabetes-t2-support`
**Created**: 2026-06-03
**Status**: Draft (Specifying — aguarda Planning)
**Tier**: 2 (épico — DB + core + UI/bot ponta-a-ponta, multi-fase, novos ADRs)
**Input**: "/devflow specifying 012 - diabetes t2"
**Pré-requisito**: **spec 022 (medicamentos líquidos) mergeada** — fornece `protocols.intake_unit`, enum `dosage_unit` com `ui/ml`, `formatDose`, e o decremento volume-aware por FIFO (`consume_stock_fifo`). O épico de diabetes **reusa** essa fundação; não a recria.
**Legacy Sources**:
- `plans/dose_instances_refactor/draft_plan_diabetic_support.md`
- `plans/dose_instances_refactor/MASTER_PLAN_REFACTOR_DOSE_INSTANCE.md` (§11 Future-proofing, FP-1..FP-4 / ADR-050)
- ADR-052 (roadmap diabetes pós-refactor; sequência líquidos→diabetes; seam de modo de adesão)

---

## Context

Diabetes move o Dosiq de "gerenciador de doses estáticas" para "registro de eventos
metabólicos correlacionados" — registrar a **causa** (insulina, GLP-1) e o **efeito**
(glicemia e outros biomarcadores), com fricção mínima, preservando *Zero Cognitive Noise* e
performance em devices low-mid (Constitution II).

**Persona-alvo v1 = Tipo 2** (público atual + foco idoso, ADR-023). T2 não é monolítico — são
3 sub-perfis, cobertos pelas fases deste épico:
1. **T2 oral puro** (metformina + pílulas) — já 100% coberto pelo dosiq atual.
2. **T2 + GLP-1** (semaglutida/tirzepatida — novo padrão de cuidado, crescente): injeção
   **semanal**, dose em **mg**, **titulação** escalonada (0,25→2,0 mg a cada ~4 semanas).
3. **T2 + insulina basal** (avançado): injeção **diária**, dose em **UI** (U-100/U-200),
   validade biológica pós-abertura.

T1 (bolus dinâmico, cálculo de carbo, CGM, meia-unidade) é **épico futuro** — fora deste escopo.

**Decisão de fundação (ADR-050, já em produção):** o refactor `dose_instances` entregou o
esqueleto `expected_dose` (planejada, congelada por instância) ↔ `quantity_taken` (aplicada),
ligados por `medicine_logs.dose_instance_id`. Titulação de GLP-1 cai **de graça** nesse modelo
(cada instância congela a dose da etapa vigente). Os colunas de dose já são `numeric` em prod
→ decimais como `0,5` já são aceitos (Zod `z.number()` sem `.int()`).

**Linha SaMD (não-negociável — ANVISA RDC 657/2022 + RDC 751/2022 Regra 11):** este épico é
**registro passivo + relatório**. O Dosiq **NUNCA** sugere nem calcula dose de insulina/bolus,
**não** armazena meta glicêmica como parâmetro de cálculo, e carboidrato (se logado) é **dado
bruto**, jamais insumo de fórmula. Calcular/sugerir dose cruzaria para dispositivo médico
regulado (Classe II). Mantém-se Classe I / fora de registro. Constitution I (Health Data Safety).

**Doses críticas (basal pontual / GLP-1 semanal):** o alerta inegociável **não** é construído
aqui — é a flag `critical_alarm` per-protocolo da **spec 010** (Alarme Nativo v2). Este épico
apenas habilita marcar tratamentos de insulina/GLP-1 como críticos; não reconstrói a malha de
alarme.

---

## Faseamento (épico único, A→E — modelo líquidos 022 / cuidador)

| Fase | Entrega | Sub-perfil servido | Depende de |
|------|---------|--------------------|-----------|
| **A** | Forma injetável + validade biológica (TTL) | fundação GLP-1 **e** insulina | spec 022 |
| **B** | GLP-1 (mg, semanal, titulação) | T2 + GLP-1 | Fase A |
| **C** | `biomarkers_log` genérico + fast-logging + timeline híbrida | todos (glicemia) | FP-3 (R-252) |
| **D** | Insulina basal (parede UI/volume) | T2 + insulina | Fases A, C, spec 022 |
| **E** | Export clínico (dose × biomarcadores por período) | todos | Fases C, D |

Ordem-chave: **GLP-1 antes de insulina** (mg evita a parede UI → valor antes); biomarkers entre
elas (insulina integra; GLP-1 opcional). Staging de PR detalhado em `tasks.md`.

---

## User Scenarios & Testing

### User Story 1 — Cadastrar medicamento injetável + validade biológica (P1) — Fase A
**Why**: insulina/GLP-1 são injetáveis com validade pós-abertura (≈28-30 dias p/ insulina);
o dosiq precisa distinguir forma injetável e avisar por **tempo de uso**, não só por volume.
**Independent Test**: cadastrar medicamento injetável; confirmar marcação de forma injetável e
`shelf_life_days`; abrir um lote (1ª tomada) e confirmar `stock.opened_at` inferido; avançar o
relógio além do TTL e confirmar alerta de validade biológica distinto do alerta de volume.

**Acceptance Scenarios**:
1. Given um medicamento com `presentation='injecao'`, When inspecionado, Then carrega a forma
   farmacêutica e `medicines.shelf_life_days` (nullable; insulina ≈ 30).
2. Given um lote (`stock`) de injetável sem `opened_at`, When a **primeira tomada** debita esse
   lote, Then `stock.opened_at` é inferido = instante da tomada (não há cenário de "abrir sem usar").
3. Given um lote com `opened_at + shelf_life_days < now`, When a timeline/estoque abre, Then
   exibe alerta de **validade biológica** (relógio), distinto e paralelo ao status 4-tiers de
   volume (ADR-018) — não substitui.
4. Given um injetável sem `shelf_life_days` (NULL), When avaliado, Then o eixo de validade
   biológica fica inativo (sem alerta), só o de volume permanece.

### User Story 2 — Tratamento com GLP-1 semanal + titulação (P1) — Fase B
**Why**: GLP-1 é o novo padrão T2 — injeção semanal, dose em mg, escalonamento de dose por
semanas. A janela de perdão clínica de uma dose semanal é dias, não horas.
**Independent Test**: criar protocolo GLP-1 `semanal` com `titration_schedule` (0,25 mg/4 sem →
0,5 mg/4 sem → …); confirmar que `dose_instances` futuras congelam a dose da etapa vigente; e que
a tolerância da instância semanal **excede** o antigo cap de 120 min.

**Acceptance Scenarios**:
1. Given um protocolo GLP-1 `frequency='semanal'` com `titration_schedule`, When as instâncias
   são geradas, Then cada `dose_instances.expected_dose` congela a dose da etapa de titulação
   vigente na data da ocorrência (ADR-050 FP-1).
2. Given a feature de titulação existente (`titration_schedule`/`current_stage_index`/
   `stage_started_at`/`titration_status`), When usada num protocolo novo, Then funciona
   ponta-a-ponta (criação no wizard, avanço de etapa, timeline) — **auditada e corrigida**
   nesta fase, pois pode ter regredido pós-refactors.
3. Given uma dose **não-diária** (`semanal`/`dias_alternados`), When `tolerance_minutes` é
   computado, Then usa "metade do intervalo entre doses" **sem o cap de 120 min** (cobre o perdão
   semanal do GLP-1). **Frequências diárias mantêm o cap de 120 min** — preserva a semântica de
   adesão do público atual 1×/dia (resolvido: remoção do cap só p/ não-diário).
4. Given uma dose GLP-1 marcada como crítica, When chega o horário, Then o alarme é regido pela
   spec 010 (`critical_alarm`) — este épico só permite ligar a flag, não reimplementa o alarme.

### User Story 3 — Registrar glicemia (e outros biomarcadores) com fricção mínima (P1) — Fase C
**Why**: rastrear só a dose conta metade da história; paciente e médico cruzam dose × glicemia.
O modelo precisa nascer **genérico** (glicemia, peso, pressão arterial, batimentos) para crescer
sem migration e para abrir a porta a import via HealthKit/Google Fit/Health Connect no futuro.
**Independent Test**: registrar glicemia (mg/dL) com contexto manual (jejum) via fast-logging;
confirmar linha em `biomarkers_log` com `type`/`value`/`unit`/`measured_at`/`context`/`source`;
ver o evento ordenado por instante na timeline ao lado das doses.

**Acceptance Scenarios**:
1. Given o fast-logging, When registro glicemia `110 mg/dL` em jejum, Then cria
   `biomarkers_log` (`type='glicemia'`, `value=110`, `unit='mg/dL'`, `context='jejum'` **manual**,
   `source='manual'`, `measured_at` = instante).
2. Given a tabela `biomarkers_log`, When inspecionada, Then o shape é **genérico** (suporta
   `type ∈ {glicemia, peso, pressao_arterial, batimentos, ...}` sem nova coluna) e tem `source`
   extensível (`manual` v1; `healthkit`/`google_fit`/`health_connect`/`cgm_*` futuros — sem
   migration).
3. Given glicemia + doses no mesmo dia, When a timeline renderiza, Then ordena por **instante
   absoluto** (FP-3 / R-252) — o biomarcador entra por **adapter + renderizador**, sem tocar o
   builder puro nem a UI existente. **Sem meta/alvo, só log.**
4. Given a linha SaMD, When um biomarcador é registrado, Then o app **só exibe/armazena** —
   nenhuma sugestão de dose é derivada dele.

### User Story 4 — Tratamento com insulina basal (UI / volume) (P1) — Fase D
**Why**: insulina basal é diária, dosada em UI (U-100 = 100 UI/ml), debitada do volume físico
do refil. A "parede de unidades" (FP-4) precisa do decremento UI→ml correto.
**Independent Test**: cadastrar insulina U-100; criar protocolo basal com dose em UI; registrar
tomada de `10 UI` e confirmar decremento de `0,10 ml` do lote por FIFO (reusa `consume_stock_fifo`).
**Acceptance Scenarios**:
1. Given uma insulina com concentração U-100 (100 UI/ml), When uma tomada de `10 UI` é
   registrada, Then o decremento converte `10/100 = 0,10 ml` e debita por FIFO do lote ativo
   (reusa a RPC volume-aware de 022). A concentração vem de uma **coluna genérica de densidade/
   razão** em `medicines` cujo significado **se adapta à `dosage_unit`** escolhida: gotas→`20`
   (gotas/ml, o `drops_per_ml` de 022), insulina U-100→`100` (UI/ml), etc. **Generaliza o
   `drops_per_ml` da 022 num único campo razão→ml.**
2. Given um lote de insulina aberto, When o TTL biológico (Fase A) é atingido antes do volume
   zerar, Then o alerta de validade dispara mesmo com volume restante.
3. Given a adesão de um protocolo basal (dose fixa), When calculada, Then usa o modo **binário**
   (tomou/não tomou) já existente (R-248) — bolus variável/`dose_exactness` é T1 futuro, fora.
4. Given a unidade de administração, When dose/estoque são exibidos, Then respeitam a unidade
   do medicamento (FP-4) — nunca cravam "comprimido" (revisar `formatDoseUnit`/ADR-046).

### User Story 5 — Exportação clínica (dose × biomarcadores) (P2) — Fase E
**Why**: comunicação ruim com o médico é fator de não-adesão; um relatório que cruza dose e
glicemia por período do dia ajuda a decisão clínica.
**Independent Test**: gerar relatório de um período; confirmar que cruza doses e biomarcadores
agrupados por período/dia, em PDF, com agregação server-side (Constitution III).
**Acceptance Scenarios**:
1. Given histórico de doses + biomarcadores num período, When o relatório é gerado, Then cruza
   ambos por período do dia (agrupamento), server-side (R-249), em PDF.
2. Given a linha SaMD, When o relatório é gerado, Then é **descritivo** (registro/tendência) —
   sem recomendação de dose.

---

## Edge Cases

- **GLP-1 dose perdida**: janela de perdão clínica ~72 h (3 dias). A tolerância da instância
  semanal deve cobrir isso; sweep `pending→missed` (R-246/AP-190) só marca missed após a janela.
- **Caneta descartável vs cartucho recarregável**: **transparente** ao dosiq. O que importa é a
  compra de um **lote** de doses e seu registro em `stock` (volume em UI/ml). Não há entidade
  "caneta"; o decremento e o `opened_at` vivem no lote (reusa modelo `purchases`+`stock` de 022).
- **Injetável sem `shelf_life_days`**: eixo de validade biológica inativo; só o eixo de volume.
- **Biomarcador sem dose associada**: glicemia é evento independente — não exige FK para
  `dose_instances`; correlação é só **temporal** na timeline (sem elo rígido).
- **Decimais de dose**: `0,5`/`1,5` já aceitos (`numeric` + Zod sem `.int()`). Insulina basal e
  GLP-1 (0,25 mg) cabem. Revisar caps Zod onde a semântica "100 comprimidos" não se aplica (UI/mg)
  — alinhado ao teto revisado de 022 (R-022).
- **Migração de dados injetáveis legados**: medicamentos hoje com `dosage_unit='ui'` (se houver)
  podem precisar marcação de forma injetável retroativa — definir no Planning.
- **Estoque zerado na confirmação (bot/app)**: best-effort (R-245/R-246) — log é a fonte de
  verdade; nunca lançar exceção.

---

## Requirements

### Functional Requirements

**Fase A — Forma injetável + validade biológica**
- **FR-001**: `public.medicines` ganha coluna **`presentation`** (forma farmacêutica geral, enum
  PT — `comprimido`/`capsula`/`liquido`/`injecao`/`pomada`/`spray`/`outro`, alinha `MEDICINE_TYPES`
  Zod existente). Cobre injetável (este épico), pomada e líquido num eixo único — distinto de
  `medicines.type` (categoria `medicamento`/`suplemento`). Injetável = `presentation='injecao'`.
  Default + migração de linhas existentes definidos no Planning (ADR). **Coordenação cross-spec
  resolvida:** a spec 022 foi **amendada (2026-06-03, FR-002b)** para já criar `presentation` na
  origem; a 012 **consome** essa coluna (`='injecao'`). A natureza líquida do decremento segue
  derivada de `dosage_unit LIKE '%/ml'` (decisão-mãe da 022); `presentation` é o eixo de forma
  complementar.
- **FR-002**: `public.medicines` ganha `shelf_life_days` (`integer`, nullable) — TTL pós-abertura
  (propriedade do produto; distinto de `expiration_date` da caixa).
- **FR-003**: `public.stock` ganha `opened_at` (`timestamptz`, nullable) — **inferido na 1ª
  tomada** que debita o lote (não há "abrir sem usar"). Decisão: estender `stock`, **sem tabela
  nova** (TTL é propriedade 1:1 do lote → join inútil).
- **FR-004**: Alerta de validade biológica = **computado** (`opened_at + shelf_life_days ≤ now`),
  eixo paralelo ao status de volume (ADR-018), não o substitui. Render dedicado (relógio vs gota).

**Fase B — GLP-1 (mg, semanal, titulação)**
- **FR-005**: Auditar e **corrigir** a feature de titulação existente (`protocols.titration_schedule`
  jsonb, `current_stage_index`, `stage_started_at`, `titration_status`; `titrationService`,
  `TitrationWizard`/`TitrationTimeline`/`TitrationBadge`; `@dosiq/core` `titrationUtils`) —
  garantir funcionamento ponta-a-ponta pós-refactors.
- **FR-006**: Geração de `dose_instances` congela `expected_dose` = dose da etapa de titulação
  vigente na data da ocorrência (ADR-050 FP-1; reusa `doseInstanceGenerator`).
- **FR-007**: `tolerance_minutes` passa a usar "metade do intervalo entre doses" **removendo o
  cap de 120 min**, habilitando a janela de perdão semanal do GLP-1. Escopo da remoção: ver
  NEEDS CLARIFICATION em US2.3.
- **FR-008**: Marcar tratamento GLP-1/insulina como crítico reusa a flag `critical_alarm` da
  spec 010 — sem reimplementar alarme.

**Fase C — `biomarkers_log` + fast-logging + timeline híbrida**
- **FR-009**: Nova tabela `public.biomarkers_log` genérica: `id`, `user_id`, `type` (text, default
  `'glicemia'`; extensível peso/PA/batimentos), `value` (numeric), `unit` (text), `measured_at`
  (timestamptz), `context` (text, **manual**), `source` (text, default `'manual'`; extensível
  healthkit/google_fit/health_connect/cgm_*), `notes`, `created_at`. Grants + RLS
  (`user_id=auth.uid()`) conforme template CLAUDE.md. Enums em PT (R-021).
- **FR-010**: Fast-logging (web + mobile) registra biomarcador com fricção mínima (teclado
  numérico, contexto manual). Reusa bottom-sheet/`FormSelect` nativo já hardenizado.
- **FR-011**: Biomarcador entra na timeline como **evento tipado** via adapter + renderizador
  (R-252 / FP-3), ordenado por instante absoluto — **sem tocar o builder puro nem a UI de dose**.
  Sem meta/alvo. Sem elo FK rígido com dose (correlação temporal).
- **FR-012**: Schema Zod `biomarkerLogSchema` em `packages/core/src/schemas/` (enums PT,
  `safeParse`, `.nullable().optional()` onde aplicável; sincronizado com CHECK SQL — R-082).

**Fase D — Insulina basal (UI/volume)**
- **FR-013**: Concentração modelada por **coluna genérica de densidade/razão** em `medicines`
  (numeric, nullable) cujo significado se adapta à `dosage_unit`: `gotas`→gotas/ml (=`drops_per_ml`
  da 022), `ui/ml`→UI/ml (U-100=100). **Generaliza `drops_per_ml` num campo único razão→ml.**
  `consume_stock_fifo` usa essa razão p/ converter a tomada→ml e debitar por FIFO (reusa a RPC de
  022; sólidos/linear intactos). **Coordenação cross-spec resolvida:** a 022 foi **amendada
  (2026-06-03, FR-002)** para já nascer com a coluna genérica razão→ml (em vez de `drops_per_ml`
  específico); a 012 **reusa** o mesmo campo (`100` p/ U-100), sem nova coluna nem migração dupla.
- **FR-014**: Adesão de basal usa modo **binário** existente (R-248). `dose_exactness`/bolus = fora.
- **FR-015**: `formatDoseUnit`/exibição respeitam a unidade de administração (FP-4) — revisar
  ADR-046 (que hoje retorna sempre "unidade(s)") para UI/ml/mg.

**Fase E — Export clínico**
- **FR-016**: Relatório PDF cruza doses × biomarcadores por período/dia, agregação server-side
  (R-249, Constitution III), descritivo (sem recomendação de dose — SaMD).

### Key Entities
- **Medicine**: + `presentation` (forma farmacêutica geral, enum PT — FR-001), + `shelf_life_days`,
  + coluna genérica de densidade/razão (generaliza `drops_per_ml` da 022 — FR-013). Injetável =
  `presentation='injecao'`.
- **Stock**: + `opened_at` (inferido na 1ª tomada). Lote = unidade física de doses (caneta/cartucho
  transparente). `quantity` = UI/ml restantes.
- **Protocol**: reusa `titration_schedule`/`current_stage_index`/`stage_started_at`/
  `titration_status` (existentes) + `intake_unit` (de 022). Cadência `semanal` (existente).
- **dose_instances**: `expected_dose` congela etapa de titulação (FP-1); `tolerance_minutes`
  sem cap (FR-007); `critical_alarm` (spec 010).
- **biomarkers_log** (net-new): genérico, RLS, ordenação temporal na timeline (FP-3).
- **Core/Schemas**: `biomarkerLogSchema` (novo), `titrationUtils` (auditar), `formatDoseUnit`
  (revisar), caps Zod (revisar p/ UI/mg).

---

## Success Criteria

- **SC-001**: Injetável detectável + `shelf_life_days`; `stock.opened_at` inferido na 1ª tomada;
  alerta de validade biológica dispara por tempo (independente do volume) e coexiste com o status
  4-tiers de volume.
- **SC-002**: GLP-1 semanal com titulação funciona ponta-a-ponta (criação→geração→timeline);
  `expected_dose` congela a etapa correta; tolerância semanal cobre a janela de perdão (>120 min);
  titulação existente auditada/corrigida.
- **SC-003**: `biomarkers_log` genérico registra glicemia (e suporta peso/PA/batimentos sem
  migration); fast-logging com contexto manual; biomarcador na timeline por instante via adapter
  (zero alteração do builder/UI de dose); sem meta.
- **SC-004**: Insulina basal debita UI→ml correto por FIFO; adesão binária; unidade de
  administração respeitada (sem suposição pill-cêntrica).
- **SC-005**: Export clínico cruza dose × biomarcador server-side, descritivo (zero recomendação
  de dose — linha SaMD preservada em todo o épico).
- **SC-006**: Constitution: Health Data Safety (I), Mobile-First (II), Server-Agg (III), Timezone
  (IV) e Contract/ADR (V) respeitados; novos schemas Zod↔SQL sincronizados (R-082); lint 0,
  `validate:agent` verde, smoke PO por fase com entrega mobile.

---

## Assumptions / Open Questions

**Assumptions:**
- spec 022 (líquidos) mergeada antes do início (dependência dura).
- Refactor `dose_instances` em prod (FP-1..FP-4 / ADR-050) — fundação pronta.
- Spec 010 (`critical_alarm`) cobre o alarme crítico — este épico só liga a flag.
- Decimais já aceitos (`numeric` + Zod) — sem mudança de tipo de coluna.
- T1 (bolus dinâmico, carbo, CGM, meia-unidade) fora — épico futuro.

**Resolvidas pelo operador (2026-06-03):**
1. ✅ **Tolerância cap (US2.3 / FR-007):** remoção do cap **só para frequências não-diárias**;
   diárias mantêm 120 min (preserva adesão do público 1×/dia).
2. ✅ **Forma (FR-001):** nova coluna **`medicines.presentation`** (enum geral — injecao/pomada/
   liquido/…), não booleano `is_injectable`; cobre múltiplas formas num eixo único.
3. ✅ **Concentração (FR-013):** **coluna genérica de densidade/razão** que se adapta à
   `dosage_unit` (generaliza `drops_per_ml` da 022), não `units_per_ml` dedicada.

**Coordenação cross-spec com 022 (RESOLVIDA — 022 amendada 2026-06-03):**
- `presentation`: 022 FR-002b cria a coluna na origem; 012 consome (`='injecao'`). `is_liquid`
  segue derivado de `dosage_unit` (decisão-mãe da 022, inalterada) — eixos complementares.
- Coluna genérica razão→ml: 022 FR-002 já nasce genérica (em vez de `drops_per_ml`); 012 reusa.
- **Sequenciamento duro reforçado:** 022 mergeada antes do C-coding da 012. Re-sync pendente dos
  downstream da 022 (`plan.md`/`tasks.md`/`analysis.md`/`contracts/`) no próximo Planning da 022.

**Outras (não-bloqueantes, Planning):**
- Migração retroativa: popular `presentation` de medicamentos existentes; injetáveis legados
  (se houver `dosage_unit='ui'` em prod).
- Caminho real do fast-logging mobile (verificar em P/C1, não assumir paridade de nome com web).
- Shape exato de `context` de `biomarkers_log` (enum PT vs texto livre).
