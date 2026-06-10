# Feature Specification: Suporte a Diabéticos Tipo 2 (Épico)

**Feature Directory**: `plans/specs/012-diabetes-t2-support`
**Created**: 2026-06-03
**Status**: planned — aguarda Coding (Fase A). **Re-sincronizada com 022 As-Built em 2026-06-08** (pós-merge #652); Planning finalizado 2026-06-08 — plan.md/analysis.md/tasks.md verificados contra repo+prod, ADR-058..062 accepted.
**Tier**: 2 (épico — DB + core + UI/bot ponta-a-ponta, multi-fase, novos ADRs)
**Input**: "/devflow specifying 012 - diabetes t2"
**Pré-requisito**: ✅ **spec 022 (medicamentos líquidos) MERGEADA** (#650 Fase A, #651 Fase B, #652 Fase C — 2026-06-08). Fornece, **já em produção**: `protocols.intake_unit` (`'gotas'|'ml'|'UI'`, CHECK exato R-271), enum `dosage_unit` com `ui/ml`, coluna `medicines.units_per_ml` (razão→ml genérica), `medicines.presentation`, formatters core (`formatIntakeDose`/`formatDoseItem`/`formatDoseHint`/`isLiquidMedicine`/`doseToMl`/`calculateDailyIntake`), e — **crítico** — `consume_stock_fifo` que **já converte `UI`→ml** (migração `20260608_fix_consume_fifo_ui_conversion.sql`). O épico de diabetes **reusa** essa fundação; não a recria. **Impacto:** o núcleo do decremento UI da Fase D já está entregue (ver FR-013).
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
5. Given o Dashboard do Hoje, When o usuário toca o FAB, Then ele **expande em speed-dial** com 2
   ações: *Registrar dose* · *Registrar medida* (mock `FAB speed-dial expandido`).
6. Given *Registrar medida*, When o sheet abre, Then usa o **layout B "idoso primeiro"** (valor
   gigante centrado, contexto em grid 2×2 com alvos ≥44px, tipo recolhido a 1 linha, unidade fixa
   por tipo, horário default "Agora" ajustável, vírgula PT-BR aceita) — mock `C registro tintado`/
   `Sheet A preterida` (layout A descartado).
7. Given a timeline híbrida do Hoje, When um biomarcador aparece, Then é renderizado como
   **`MeasureCardC` "registro tintado"** (fundo `infoSoft`, **plano/sem sombra/sem botão**, ícone
   `IconRuler` inline) — distinto da dose (card branco **elevado** com botão Tomar). **Elevação =
   ação, tinta = registro**; dose nunca perde prioridade visual (mock `C registro tintado ESCOLHIDA`).
8. Given valor inválido ou falha de rede, When o registro é tentado, Then erro inline **específico**
   (campo encolhe 64→48px p/ caber caption 1 linha) ou banner dizendo **o que falhou, que nada foi
   salvo e que os dados digitados foram mantidos** + "Tentar novamente" — nunca sucesso falso (mock
   `Erro valor inválido`).

> **Referência de design (Fase C):** decisões fixadas pelo PO em
> [HANDOFF_DESIGN.md](../../backlog-native_app/MOCKS_APP_CRUD/HANDOFF_DESIGN.md) §2.6/§4 ·
> briefing [DESIGN_BRIEFING.md](./DESIGN_BRIEFING.md) · mocks em [design-mocks/](./design-mocks/) ·
> componentes-mock (React puro, sem lógica) em
> `plans/backlog-native_app/MOCKS_APP_CRUD/project/dosiq-mocks/biomarker-screens{,-2}.jsx`.
> Em dúvida de pixel/comportamento durante o dev → consultar esses arquivos. Mobile Android é a
> fonte; web é espelho (coder adapta). **Trava SaMD permanente:** cor diferencia *tipo* de evento,
> nunca *qualidade* do valor; sem meta/zona/alvo/semáforo; médias são descritivas.

### User Story 3b — Área de Medidas: histórico + tendência (P1) — Fase C
**Why**: o paciente/médico precisa de uma área para ver o histórico de medidas ao longo do tempo,
além do registro pontual. Entra como **ferramenta**, multi-biomarcador desde a arquitetura.
**Independent Test**: abrir Perfil › Ferramentas › Medidas; ver histórico cronológico + hub de
tendência (scatter 7d com `WeekNav`); confirmar ausência de zona/meta/linha-alvo.

**Acceptance Scenarios**:
1. Given a navegação, When procuro a área de Medidas, Then há **dois acessos coexistentes**: (A)
   card "Última medida" no **FIM** da timeline do Hoje (rotina — nunca antes da agenda: dose
   primeiro); (B) **Perfil › Ferramentas › Medidas** (canônica), entre Histórico de Doses e Modo
   Consulta (mock `B Perfil Ferramentas Medidas`).
2. Given o Hub de Medidas v1, When abro a tendência, Then é **scatter (pontos por dia), uma cor,
   7d FIXO + `WeekNav`** (seta → desabilitada na semana atual; **sem seletor 7d/30d**); média da
   semana como **NÚMERO** (sem linha desenhada — seria lida como meta). Por contexto (jejum/pós) =
   evolução v2 (mock `Hub Glicemia V1`).
3. Given multi-biomarcador, When troco de tipo, Then o mesmo hub serve peso (kg)/PA/batimentos sem
   redesenho — chips de tipo **sem ícone** (só texto); `IconRuler` é a marca única de medida (mock
   `Hub Peso genericidade`).
4. Given o sheet de detalhe de uma medida, When abro, Then espelha o de dose: *Editar registro* ·
   **Ver o dia completo** (ponte p/ a timeline) · *Excluir registro* (mock `Detalhe da medida`).
5. Given nenhuma medida registrada, When abro a área, Then **estado-zero** dedicado (mocks
   `Estado zero` / `Dia vazio` — convite inline teal soft + dashed + CTA).

### User Story 4 — Tratamento com insulina basal (UI / volume) (P1) — Fase D
**Why**: insulina basal é diária, dosada em UI (U-100 = 100 UI/ml), debitada do volume físico
do refil. A "parede de unidades" (FP-4) precisa do decremento UI→ml correto.
**Independent Test**: cadastrar insulina U-100; criar protocolo basal com dose em UI; registrar
tomada de `10 UI` e confirmar decremento de `0,10 ml` do lote por FIFO. ⚠️ **A conversão UI→ml já
está em produção** (`consume_stock_fifo`, migração `20260608`): o teste é de **verificação/smoke**,
não de implementação do núcleo.
**Acceptance Scenarios**:
1. Given uma insulina com concentração U-100 (100 UI/ml), When uma tomada de `10 UI` é
   registrada, Then o decremento converte `10/100 = 0,10 ml` e debita por FIFO do lote ativo —
   **comportamento JÁ ENTREGUE pela 022** (`consume_stock_fifo` converte `lower(intake_unit) IN
   ('gotas','ui')` via `units_per_ml`; só `ml` é direto). A concentração vem da coluna
   **`medicines.units_per_ml`** (a "coluna genérica razão→ml" de 022, NÃO um `drops_per_ml`
   dedicado): gotas→`20`, insulina U-100→`100`, default `20` (`COALESCE(NULLIF(units_per_ml,0),20)`).
   **A densidade é capturada no TRATAMENTO** (form de protocolo quando `intake_unit ∈ {gotas,UI}`)
   e persistida no medicamento — não no form de medicamento (decisão UX 022 Fase C). Fase D
   **não cria nem altera** a RPC; só adiciona UX/validade biológica.
2. Given um lote de insulina aberto, When o TTL biológico (Fase A) é atingido antes do volume
   zerar, Then o alerta de validade dispara mesmo com volume restante.
3. Given a adesão de um protocolo basal (dose fixa), When calculada, Then usa o modo **binário**
   (tomou/não tomou) já existente (R-248) — bolus variável/`dose_exactness` é T1 futuro, fora.
4. Given a unidade de administração, When dose/estoque são exibidos, Then respeitam a **unidade de
   tomada** (`intake_unit`: UI) via os **formatters core de 022** (`formatIntakeDose`/`formatDoseItem`/
   `formatDoseHint`) — **nunca** renderizar `dosage_unit` cru nem cravar "comprimido" (**R-272**;
   regra estabelecida no smoke 022 Fase C). Toda query que alimenta render de dose de insulina
   traz `intake_unit`+`units_per_ml` (**R-267** read-path completeness).

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
- **Vírgula decimal PT-BR (lição 022 Fase C)**: todo input numérico de dose/densidade (UI, mg,
  `units_per_ml`) DEVE normalizar `','`→`'.'` antes de `Number()`/`parseFloat` — teclado PT-BR
  (`decimal-pad`) emite vírgula → `Number('0,25')` = `NaN` → grava inválido ou cai em fallback
  silencioso. Cobrir por failure-mode no preflight (**R-270**) e `maxLength` nos campos.
- **Render de dose nunca usa enum cru (R-272)**: insulina exibida via `formatIntakeDose` em
  UI — `dosage_unit` (`ui/ml`) jamais aparece na UI (evita "10 ui/ml" onde deveria "10 UI").
- **Transparência de falha (Princípio IX — constituição v0.2.0)**: falha parcial em fast-logging
  de biomarcador OU registro de dose NUNCA é silenciada — mensagem específica ao paciente do que
  falhou e por quê (estabelecido na 022 Fase C, bulk dose). Vale ao SaMD: omitir ≠ proteger.
- **Drift de assinatura de RPC (AP-221)**: Fase D **reusa `consume_stock_fifo` como está** (UI já
  convertido). Se algum dia a assinatura mudar, atualizar TODOS os callers (web+mobile+bot) na
  mesma fase + smoke write-path — `PGRST202` só aparece em runtime.
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
  (propriedade do produto; distinto de `expiration_date` da caixa). **Captura (anti-feature-morta):**
  idoso não sabe/não preenche → form **sugere default 28** quando `presentation='injecao'` (prefill
  editável, copy guiada "validade após aberto — confira a bula"); sem constraint DB (nullable segue).
- **FR-004b**: Alerta de validade biológica também via **stack de notificação existente**
  (push/Telegram) — idoso que não abre o app precisa saber da caneta vencendo. Reusar dispatcher
  (R-200/CON-019); kind novo de notificação exige enum Zod atualizado (R-193) e ADR se mudar payload
  (constitution V). Cadência anti-spam: 1 aviso em D-3 + 1 no vencimento (não diário).
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
- **FR-005b — modelo de avanço de etapa (decisão de produto)**: **auto-avanço por cronograma**
  (`stage_started_at + duration_days` esgotado → próxima etapa). Seguir o cronograma **prescrito
  pelo médico** é registro passivo da prescrição, não sugestão de dose — **dentro da linha SaMD**
  (ADR-062): o app nunca decide a escada, só executa a que foi cadastrada. Transparência: evento
  informativo na timeline/nudge *"Etapa N iniciada conforme o cronograma do tratamento"* (sem CTA
  de dose). Avanço manual (confirmação do idoso a cada 4 semanas) rejeitado: esquecimento congelaria
  `expected_dose` errada nas instâncias. Auditoria T008 verifica se o auto-avanço existente funciona.
- **FR-006**: Geração de `dose_instances` congela `expected_dose` = dose da etapa de titulação
  vigente na data da ocorrência (ADR-050 FP-1; reusa `doseInstanceGenerator`).
- **FR-007**: `tolerance_minutes` passa a usar "metade do intervalo entre doses" **removendo o
  cap de 120 min**, habilitando a janela de perdão semanal do GLP-1. Escopo da remoção: ver
  NEEDS CLARIFICATION em US2.3.
- **FR-008**: Marcar tratamento GLP-1/insulina como crítico reusa a flag `critical_alarm` da
  spec 010 — sem reimplementar alarme.
- **FR-008b — dose semanal pendente multi-dia (UX)**: as superfícies do Hoje foram desenhadas p/
  janela de horas; dose semanal fica `pending` por até 3,5 dias. Comportamento definido: aparece na
  seção de carry-over com **rótulo relativo** ("há 2 dias", não "ontem"); PriorityCard a inclui
  enquanto dentro da tolerância; **sem re-notificação** além do disparo original (`notified_at`
  idempotente — evita spam de 3 dias); após a tolerância vira `missed` pelo sweep normal (R-246).

**Fase C — `biomarkers_log` + fast-logging + timeline híbrida**
- **FR-009**: Nova tabela `public.biomarkers_log` genérica: `id`, `user_id`, `type` (text, default
  `'glicemia'`; extensível peso/PA/batimentos), `value` (numeric), **`value_secondary` (numeric,
  nullable — 2º componente de medidas compostas: PA = sistólica em `value` + diastólica em
  `value_secondary`; NULL p/ glicemia/peso/batimentos)**, `unit` (text), `measured_at`
  (timestamptz), `context` (text, **manual**), `source` (text, default `'manual'`; extensível
  healthkit/google_fit/health_connect/cgm_*), `notes`, `created_at`. Grants + RLS
  (`user_id=auth.uid()`) conforme template CLAUDE.md. Enums em PT (R-021). **Sem `value_secondary`
  a promessa de genericidade quebraria no 3º tipo (PA = "12 por 8", dois valores) — decisão PO
  2026-06-10: duas colunas, não duas linhas.** Fast-logging de PA = 2 campos no mesmo sheet.
- **FR-010**: Fast-logging (web + mobile) registra biomarcador com fricção mínima. **Design fixado:**
  bottom sheet **layout B "idoso primeiro"** (valor gigante centrado, contexto em grid 2×2 alvos
  ≥44px, tipo recolhido a 1 linha, unidade fixa por tipo, horário default "Agora" ajustável). Vírgula
  PT-BR aceita (R-270). Contextos de glicemia: `jejum`/`pre_refeicao`/`pos_refeicao`/`ao_deitar` +
  "Outro" livre — **opcionais** (1 toque). Teclado decimal nativo é **chrome do sistema** (fora do
  sheet; sheet termina acima; `DosiqBottomSheet maxHeight 85%` → estados de erro **altura-neutros**).
  Componentes-mock: `Keypad`/`BioChip`/`BioToast`. Reusa bottom-sheet/`FormSelect` hardenizado (AP-180).
- **FR-010b**: **FAB do Hoje = speed-dial** com 2 ações ao expandir: *Registrar dose* · *Registrar
  medida* (mock `FAB speed-dial expandido`). Fast-logging a 1 toque de qualquer lugar relevante.
- **FR-011**: Biomarcador entra na timeline como **evento tipado** via adapter + renderizador
  (R-252 / FP-3), ordenado por instante absoluto — **sem tocar o builder puro nem a UI de dose**.
  Sem meta/alvo. Sem elo FK rígido com dose (correlação temporal). **Design fixado:** card de medida
  = **`MeasureCardC` "registro tintado"** (fundo `infoSoft`, plano, sem sombra, sem botão, `IconRuler`
  inline) — dose permanece card branco **elevado** com botão Tomar (elevação=ação, tinta=registro;
  AP-018 do handoff: medida nunca com mais peso visual que dose). Agenda híbrida = **evolução da
  "Agenda de Hoje"**, agrupada nos períodos existentes (madrugada/manhã/tarde/noite); card "Última
  medida" no **FIM** da timeline (nunca antes da agenda).
- **FR-011b**: **Área de Medidas** (Fase C): (a) acesso A = card "Última medida" no fim do Hoje +
  (b) acesso B = **Perfil › Ferramentas › Medidas** (canônica). Hub v1 = histórico cronológico
  (filtrável por tipo) + **tendência scatter** (pontos/dia, uma cor, **7d FIXO + `WeekNav`**, sem
  seletor 7d/30d, **sem zona/meta/linha-alvo** — SaMD; média da semana como número). Chips de tipo
  **sem ícone**. Multi-biomarcador sem redesenho. Componentes-mock: `ScatterPlot`/`WeekNav`/`TypeChips`.
  Sheet de detalhe espelha o de dose (*Editar* · *Ver o dia completo* · *Excluir*).
- **FR-012**: Schema Zod `biomarkerLogSchema` em `packages/core/src/schemas/` (enums PT,
  `safeParse`, `.nullable().optional()` onde aplicável; sincronizado com CHECK SQL — R-082).
  `context` enum PT: `jejum`/`pre_refeicao`/`pos_refeicao`/`ao_deitar`/`outro` (nullable).
- **FR-012b**: **Estado-zero obrigatório** (regra do PO) em toda superfície nova de medida (área
  vazia, dia vazio) + **transparência radical** de erro (o que falhou, nada salvo, dados mantidos,
  retry) — nunca sucesso falso. Mocks `Estado zero`/`Dia vazio`/`Erro valor inválido`.

**Fase D — Insulina basal (UI/volume)**
- **FR-013** ✅ **NÚCLEO JÁ ENTREGUE POR 022 (Fase C, #652)**: a concentração é a coluna
  **`medicines.units_per_ml`** (numeric, nullable) cujo significado se adapta à `dosage_unit`:
  `gotas`→gotas/ml, `ui/ml`→UI/ml (U-100=`100`), default `20` (`COALESCE(NULLIF(units_per_ml,0),20)`).
  `consume_stock_fifo` **já converte** `lower(intake_unit) IN ('gotas','ui')` → ml (`p_quantity /
  units_per_ml`, `ROUND(...,2)`); só `ml` é direto; sólidos/linear intactos (migração
  `20260608_fix_consume_fifo_ui_conversion.sql`, em prod). **Densidade capturada no tratamento**
  (form de protocolo, `intake_unit ∈ {gotas,UI}`) e persistida no medicamento (UX 022 Fase C).
  → **Escopo restante da Fase D para FR-013 = ZERO no núcleo**: apenas verificação/smoke da insulina
  U-100 e (se necessário) U-200 (`units_per_ml=200`). **Não criar coluna.**
- **FR-013b** 🔴 **(catch CPTO 2026-06-10 — risco clínico)**: o default `units_per_ml=20` da RPC é
  herdado de **gotas**. Insulina com densidade não preenchida (idoso não sabe "U-100") debitaria
  `10/20 = 0,5 ml` em vez de `0,10 ml` — **estoque esgota 5× rápido, alertas errados**. Correção em
  2 camadas: (a) **form de tratamento**: quando `intake_unit='UI'`, prefill `units_per_ml=100`
  (U-100 = padrão global; U-200 editável) — nunca deixar vazio cair no default de gotas; (b)
  **defesa em profundidade na RPC**: default por unidade — `COALESCE(NULLIF(units_per_ml,0),
  CASE WHEN lower(intake)='ui' THEN 100 ELSE 20 END)`. Mudança **aditiva** (assinatura intacta,
  gotas/ml/sólidos inalterados — AP-221 respeitado); migração própria + regressão completa.
  **Fase D deixa de ser smoke-only por causa deste item.**
- **FR-014**: Adesão de basal usa modo **binário** existente (R-248). `dose_exactness`/bolus = fora.
- **FR-015** ✅ **RESOLVIDO POR 022 + R-272**: exibição de dose de insulina usa os formatters
  core de 022 (`formatIntakeDose`/`formatDoseItem`/`formatDoseHint`, decisão via `isLiquidMedicine`)
  com a unidade de tomada (UI) — **nunca** `dosage_unit` cru nem "comprimido" hardcoded (R-272).
  Fase D apenas **garante** que as superfícies de insulina (dashboard, histórico, timeline,
  estoque, emergência, consulta, export) carregam `intake_unit`+`units_per_ml` na query (R-267) e
  passam pelos formatters. ADR-046/`formatDoseUnit` legado: substituído pelos formatters core.

**Fase E — Export clínico**
- **FR-016**: Relatório PDF cruza doses × biomarcadores por período/dia, agregação server-side
  (R-249, Constitution III), descritivo (sem recomendação de dose — SaMD).

### Key Entities
- **Medicine**: `presentation` (enum PT — FR-001; **já existe em prod via 022**) + `units_per_ml`
  (razão→ml genérica — FR-013; **já existe em prod via 022**, capturada no tratamento) + **novo
  net-new desta spec:** `shelf_life_days` (FR-002). Injetável = `presentation='injecao'`.
- **Stock**: + `opened_at` (inferido na 1ª tomada). Lote = unidade física de doses (caneta/cartucho
  transparente). `quantity` = UI/ml restantes.
- **Protocol**: reusa `titration_schedule`/`current_stage_index`/`stage_started_at`/
  `titration_status` (existentes) + `intake_unit` (de 022). Cadência `semanal` (existente).
- **dose_instances**: `expected_dose` congela etapa de titulação (FP-1); `tolerance_minutes`
  sem cap (FR-007); `critical_alarm` (spec 010).
- **biomarkers_log** (net-new): genérico, RLS, ordenação temporal na timeline (FP-3).
- **Core/Schemas**: `biomarkerLogSchema` (novo), `titrationUtils` (auditar), formatters de dose
  (REUSAR de 022 — `formatIntakeDose`/`formatDoseItem`/`formatDoseHint`/`isLiquidMedicine`/
  `doseToMl`/`calculateDailyIntake`; não recriar), caps Zod (revisar p/ UI/mg).

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
- **SC-004**: Insulina basal debita UI→ml correto por FIFO (**já em prod via 022 —
  `consume_stock_fifo`; Fase D valida por smoke, não reimplementa**); adesão binária; unidade de
  administração respeitada via formatters core (R-272, sem suposição pill-cêntrica); inputs
  numéricos normalizam vírgula PT-BR (R-270).
- **SC-005**: Export clínico cruza dose × biomarcador server-side, descritivo (zero recomendação
  de dose — linha SaMD preservada em todo o épico).
- **SC-006**: Constitution: Health Data Safety (I), Mobile-First (II), Server-Agg (III), Timezone
  (IV), Contract/ADR (V) e **Transparência Radical (IX — v0.2.0: falha nunca silenciada)**
  respeitados; novos schemas Zod↔SQL sincronizados (R-082/R-271); render de dose via formatter
  core (R-272); read-path completo (R-267); preflight de migração/numérico (R-270, incl. vírgula
  PT-BR); lint 0, `validate:agent` verde, smoke PO por fase com entrega mobile.

---

## Assumptions / Open Questions

**Assumptions:**
- ✅ spec 022 (líquidos) mergeada (#650/#651/#652, 2026-06-08) — dependência dura satisfeita.
- Refactor `dose_instances` em prod (FP-1..FP-4 / ADR-050) — fundação pronta.
- Spec 010 (`critical_alarm`) cobre o alarme crítico — este épico só liga a flag.
- Decimais já aceitos (`numeric` + Zod) — sem mudança de tipo de coluna.
- T1 (bolus dinâmico, carbo, CGM, meia-unidade) fora — épico futuro.

**Resolvidas pelo operador (2026-06-03):**
1. ✅ **Tolerância cap (US2.3 / FR-007):** remoção do cap **só para frequências não-diárias**;
   diárias mantêm 120 min (preserva adesão do público 1×/dia).
2. ✅ **Forma (FR-001):** nova coluna **`medicines.presentation`** (enum geral — injecao/pomada/
   liquido/…), não booleano `is_injectable`; cobre múltiplas formas num eixo único.
3. ✅ **Concentração (FR-013):** coluna genérica razão→ml que se adapta à `dosage_unit`.
   **Nome final em prod (022): `medicines.units_per_ml`** (gotas→20, ui/ml→100). 012 reusa.

**Coordenação cross-spec com 022 (✅ CONCLUÍDA — 022 mergeada 2026-06-08, #650/#651/#652):**
- `presentation`: ✅ coluna **em prod** (`medicines.presentation`, enum PT, CHECK
  `medicines_presentation_check`, default `comprimido`). 012 consome (`='injecao'`). `is_liquid`
  derivado de `dosage_unit LIKE '%/ml'` (decisão-mãe da 022, inalterada) — eixos complementares.
- Coluna razão→ml: ✅ **em prod** como `medicines.units_per_ml` (gotas→20, ui/ml→100, default 20).
  012 reusa direto (U-100=100) — **sem nova coluna, sem migração**.
- Conversão UI→ml: ✅ **em prod** (`consume_stock_fifo`, `lower(intake_unit) IN ('gotas','ui')`).
  Núcleo do decremento de insulina da Fase D **já entregue**.
- **Sequenciamento:** ✅ 022 mergeada; bloqueio liberado. O Planning da 012 deve **verificar o
  estado real em prod** (colunas/RPC/CHECK/schemas Zod) via grep/MCP antes de planejar — não
  reespecificar o que já existe (R-267/R-270 preflight).

**Coordenação com specs do backlog (revisão CPTO 2026-06-10):**
- **008 (export LGPD — backlog, não entregue):** `biomarkers_log` é dado sensível de saúde →
  **DEVE** entrar no export. Decisão: requisito adicionado **na 008** (origem, mais barato — nota
  de coordenação lá); a 012 não carrega a entrega.
- **007 (PDF médico — backlog, não entregue):** cruzamento dose×biomarcador fica na **Fase E da
  012** (já especificado, FR-016); a 007 ganhou nota p/ não duplicar e reusar a agregação da Fase E.
- **009 (modo cuidador — spec'ed, NÃO implementado; próximo grande épico):** permissões de
  visualização/registro de **medidas** pelo cuidador adicionadas como requisito na 009 (nota de
  coordenação) — RLS de `biomarkers_log` nasce `user_id=auth.uid()` na 012; o modelo de acesso do
  cuidador é problema da 009.

**Outras (não-bloqueantes, Planning):**
- Migração retroativa: popular `presentation` de medicamentos existentes; injetáveis legados
  (se houver `dosage_unit='ui'` em prod).
- Caminho real do fast-logging mobile (verificar em P/C1, não assumir paridade de nome com web).
- ✅ Shape de `context`: enum PT fechado (`jejum`/`pre_refeicao`/`pos_refeicao`/`ao_deitar`/`outro`).
