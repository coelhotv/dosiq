# Feature Specification: Suporte a Diabéticos Tipo 2 (Épico)

**Feature Directory**: `plans/specs/012-diabetes-t2-support`
**Created**: 2026-06-03
**Status**: in-progress — **Fases A+B delivered** (PR #658 2026-06-11: injetável + TTL biológico, migração+backfill prod; PR #659 2026-06-12: GLP-1 base — tolerância frequency-aware ADR-061, titulação ressuscitada shape canônico + auto-avanço por cronograma, carry-over multi-dia). Fases C-E pendentes. **Re-sincronizada com 022 As-Built em 2026-06-08** (pós-merge #652); Planning finalizado 2026-06-08 — plan.md/analysis.md/tasks.md verificados contra repo+prod, ADR-058..062 accepted.
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
1. Given um medicamento com `presentation='injetavel'`, When inspecionado, Then carrega a forma
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
    *Excluir registro* (mock `Detalhe da medida`).
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
  PT — `comprimido`/`capsula`/`liquido`/`injetavel`/`pomada`/`spray`/`outro`, alinha `MEDICINE_TYPES`
  Zod existente). Cobre injetável (este épico), pomada e líquido num eixo único — distinto de
  `medicines.type` (categoria `medicamento`/`suplemento`). Injetável = `presentation='injetavel'`.
  Default + migração de linhas existentes definidos no Planning (ADR). **Coordenação cross-spec
  resolvida:** a spec 022 foi **amendada (2026-06-03, FR-002b)** para já criar `presentation` na
  origem; a 012 **consome** essa coluna (`='injetavel'`). A natureza líquida do decremento segue
  derivada de `dosage_unit LIKE '%/ml'` (decisão-mãe da 022); `presentation` é o eixo de forma
  complementar.
- **FR-002**: `public.medicines` ganha `shelf_life_days` (`integer`, nullable) — TTL pós-abertura
  (propriedade do produto; distinto de `expiration_date` da caixa). **Captura (anti-feature-morta):**
  idoso não sabe/não preenche → form **sugere default 28** quando `presentation='injetavel'` (prefill
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

**Fase B2 — Canetas/ampolas GLP-1 (`intake_unit='mg'` + container + rendimento + titulação N1)**
> Modelo decidido na sessão de design 2026-06-12 (estresse de cenários
> Ozempic/Wegovy `mg/ml` e Mounjaro `mg/0,5ml`). Princípio: caneta/ampola = **lote líquido em
> ml** (reusa toda a fundação de líquidos da 022); a peça que falta é registrar a **dose em mg** e
> apresentar o estoque em **aplicações**, não em ml cru.

- **FR-017 — `intake_unit='mg'` (núcleo)**: GLP-1 é dosado em mg sobre um líquido de concentração
  `mg/ml` (`dosage_unit='mg/ml'`, `units_per_ml`=mg por ml, já capturada no form de tratamento via
  022). Habilitar `'mg'` como unidade de tomada:
  - **Migração CHECK** `protocols_intake_unit_check`: `IN ('gotas','ml','UI')` → **+`'mg'`**
    (R-271 — CHECK e enum Zod sincronizados, exato).
  - **RPC `consume_stock_fifo(uuid,uuid,numeric,uuid)`**: GLP-1 já cai no ramo líquido
    (`dosage_unit LIKE '%/ml'` TRUE). Adicionar `'mg'` ao ramo sub-ml de conversão por densidade:
    `lower(intake_unit) IN ('gotas','ui','mg')` → `v_remaining := ROUND(p_quantity/units_per_ml,2)`
    (`mg ÷ mg/ml = ml`). **Única alteração na RPC**; assinatura inalterada (AP-221: nenhum caller
    muda). `units_per_ml=0/NULL` cai no default `20` herdado — **inadequado p/ mg** → ver FR-018.
  - **Zod**: enum de `intake_unit` ganha `'mg'`; caps revisados (mg de GLP-1 são frações: 0,25–15).
  - **Formatters core (022)**: exibir dose em `mg` (lowercase, R-272); reusar `formatIntakeDose`/
    `formatDoseItem` — **nenhum formatter novo**, só cobrir o ramo `mg`.

- **FR-018 — concentração obrigatória p/ mg (segurança clínica)**: com `intake_unit='mg'` a
  densidade `units_per_ml` é **obrigatória e não pode cair no default 20** (erro 80× — Ozempic é
  0,68 mg/ml). Validação no form de tratamento: GLP-1 (injetável + dose em mg) exige `units_per_ml`
  preenchida antes de salvar. Helper de rótulo no input: **"[X] mg em [Y] mL"** (ex.: "0,68 mg em
  1 mL") computa/confirma a densidade que o usuário lê na bula/caneta — reduz erro de digitação.
  Mesma natureza do FR-013b (risco de default silencioso), mas para mg.

- **FR-019 — `medicines.injection_container` (enum, net-new)**: nem todo injetável é caneta
  (tirzepatida tem ampola/frasco). Coluna nova `injection_container text NULL` com CHECK
  `IN ('caneta','ampola','frasco_ampola','seringa_preenchida')`. **Capturada na 1ª compra** do lote
  (não no cadastro do medicamento — é atributo da apresentação comprada); fallback de rótulo
  **"unidade"** quando NULL. Grants + RLS conforme template (CLAUDE.md). Não afeta o cálculo de
  estoque — só rótulos da UI.

- **FR-020 — estoque exibido em APLICAÇÕES, nunca ml cru**: o lote é guardado em ml
  (`stock.quantity`), mas o usuário pensa em "quantas aplicações restam". Exibir
  **`floor(ml_restante ÷ ml_por_aplicação)`** com o rótulo do container (FR-019): "≈ 3 aplicações"
  / "≈ 3 canetas". `ml_por_aplicação = dose_mg ÷ units_per_ml`. **Floor** (nunca arredonda p/ cima
  — overfill da caneta não é dose disponível). Superfícies: card de estoque (web+mobile), tela de
  compra (rendimento estimado ao informar volume/quantidade). Ampola → **TTL biológico (FR-002) não
  se aplica** (dose única); caneta multi-dose mantém o TTL.

- **FR-021 — titulação N1 cross-força (etapa que troca de medicamento)**: a titulação de hoje
  (FR-005) muda só a **dose** dentro do mesmo medicamento — serve metoprolol (mais comprimidos,
  mesma concentração), mas **quebra para GLP-1** quando a escada exige concentração maior = **novo
  cadastro** (ex.: caneta de introdução 0,25 → caneta 0,5). Marcar a etapa do `titration_schedule`
  com **`requires_new_medicine: true`**: ao vencer, o auto-avanço (FR-005b) **não muda
  `expected_dose`** — emite uma **notificação-CTA** *"Hora de trocar de caneta: a próxima etapa usa
  uma apresentação diferente"* (registro passivo do cronograma prescrito → dentro de SaMD/ADR-062;
  o app não escolhe a caneta, só avisa que a etapa cadastrada pede troca). Titulação plano-nível
  completa (etapas referenciando medicamento+dose, pausa/ativa protocolos) = **spec N2 futura**,
  fora do 012.

- **FR-022 — UX de cadastro→tratamento→compra (3 etapas, deltas vs hoje)**:
  - **Medicamento**: sem mudança (forma já tem `presentation` da Fase A).
  - **Tratamento**: ao escolher `intake_unit='mg'` (injetável), exibir o helper de rótulo "[X] mg em
    [Y] mL" (FR-018) e tornar `units_per_ml` obrigatória; sufixo do wizard de titulação passa a
    "mg" (reusa `intakeSuffix` da Fase B); etapa pode marcar `requires_new_medicine` (FR-021).
  - **Compra/estoque**: capturar `injection_container` (FR-019) na 1ª compra; informar volume do
    lote (ml — ex.: caneta 1,5 ml) → exibir rendimento em aplicações (FR-020). Volume vive **na
    compra**, sem coluna nova em medicines.
  - **Nota (B2 As-Built):** decidiu-se que `mg` usa a **concentração = `dosage_per_pill`** (já
    cadastrada), NÃO `units_per_ml` — o form de mg não pede densidade. A "obrigatoriedade de
    `units_per_ml` p/ mg" do rascunho foi superada; B3 trata o default de `units_per_ml`.

**Fase B3 — `units_per_ml` default `NULL` + fallback unit-aware (hardening, fecha o débito do FR-013b)**
> Débito técnico exposto no smoke da B2 (2026-06-12). `units_per_ml` tem **default `20`** (gotas/ml)
> na coluna — "carimba" 20 em TODO líquido, inclusive insulina (UI ≈ 100/ml) → conversão UI→ml 5×
> errada se a densidade faltar (origem do FR-013b/CPTO). O problema não é "20 vs null", é o default
> ser **único (blanket)**. mg já saiu dessa conta na B2 (usa `dosage_per_pill`).

- **FR-023 — coluna `medicines.units_per_ml` default `NULL` + backfill derivado do tratamento**:
  migração `ALTER COLUMN ... DROP DEFAULT` (novas linhas não nascem com 20). **Backfill** (decisão PO
  2026-06-12 — mesma lógica do fallback unit-aware, FR-024): pra cada medicine, inspecionar a unidade
  de tomada dos `protocols` associados (`protocols.intake_unit`) e derivar `units_per_ml`:
  `UI → 100`, `gotas → 20`, `mg → NULL` (mg usa `dosage_per_pill`). Medicine **sem tratamento
  associado** ou de **apresentação não-líquida** → `NULL`. Assim backfill e runtime concordam: o
  valor carimbado reflete a densidade real da unidade de tomada, não um 20 cego. (Medicine com
  múltiplos tratamentos de unidades divergentes: priorizar a unidade que exige densidade — UI > gotas;
  caso raro, registrar no log da migração.)
- **FR-024 — fallback unit-aware na conversão (não blanket)**: `doseToMl`, RPC `consume_stock_fifo`
  e `formatIntakeDose` aplicam o padrão **pela unidade de tomada**, não um 20 global:
  `gotas → 20` (dropper universal, baixo risco), `UI → 100`, `mg → dosage_per_pill` (já na B2).
  Sem valor E sem padrão seguro p/ a unidade → **erro explícito** (Const. IX: não chuta dose).
  Remove o `COALESCE(...,20)` blanket do ramo gotas/UI da RPC.
- **FR-025 — forms reforçam densidade obrigatória p/ gotas/UI**: o form de tratamento já exige
  `units_per_ml` e mostra hint do padrão (gotas 20 / UI 100) — garantir que nenhum caminho salve
  líquido gotas/UI sem densidade (o default da coluna não pode mais mascarar a ausência). mg
  inalterado (não pede densidade — usa `dosage_per_pill`).
- **FR-031 — entrada de concentração com denominador (anti-armadilha Mounjaro)** (decisão de design
  2026-06-12): alguns rótulos exibem a concentração **por denominador ≠ 1 mL**. Caso real hoje =
  **Mounjaro** "2,5 mg/0,5 mL" (exceção única no BR; Ozempic e demais rotulam sempre por `/1 mL`).
  Insulina U-100/U-200/U-300 (Fase D) reusa o mesmo seletor. Usuário digita o número da caixa
  (`2,5`) no campo `mg/ml` e grava concentração errada (real = 5 mg/ml), silenciosamente. **Solução
  (Opção 1):** o campo de concentração no form de **medicamento** ganha um **seletor de denominador**
  — `[2,5] mg / [0,5] mL` (denominador default `1`, editável com o valor do rótulo). Ao salvar, **normaliza p/
  mg/ml** = `valor ÷ denominador` (2,5 ÷ 0,5 = 5). **Armazenamento segue mg/ml** (invariante "número =
  por 1 mL" intacto → zero drift em RPC/`doseToMl`/formatters/custo). Mesmo mecanismo cobre
  `mg/0,8ml` e U-100/200/300 (Fase D) **sem unidades novas**.
  - **Persistência do denominador (decisão PO 2026-06-12 — ADR-066):** coluna nova
    `medicines.concentration_volume_ml` (NUMERIC, nullable; `NULL` = "por 1 mL"). Guarda o volume
    que o rótulo referencia (Mounjaro = `0,5`). Reexibe fiel: `amount = dosage_per_pill ×
    concentration_volume_ml` → "2,5 mg/0,5 mL". **Nome sem "display"** de propósito: a coluna É o
    `volume` do par `(amount, volume)` — **1º passo do modelo de concentração** da spec futura
    (Opção 3); quando ela chegar, `amount` deixa de ser derivado e a coluna já existe (sem rename).
  - **Decisão registrada:** *rejeitada* a unidade literal `mg/0,5ml` em `dosage_unit` — quebraria a
    detecção de líquido (`LIKE '%/ml'`), o invariante por-1-mL e geraria explosão combinatória de
    denominadores. A razão é normalizada na **entrada**, não no armazenamento.
  - **Backlog (Opção 3, futura):** armazenar a concentração como par `(amount, volume)` direto
    (razão derivada); `concentration_volume_ml` é a semente. Spec própria.

**Fase B4 — Modelo de estoque dose-primário (frequência ≠ diário)**
> Falha conceitual exposta no smoke da B2 (2026-06-12). O modelo atual conta **dias corridos**
> (`estoque / consumo_médio_dia`), fundindo dois conceitos distintos num número só. Pra freq ≠
> diário isso (a) mostra "28 dias" pra 4 canetas semanais — engana; (b) **quebra o custo**:
> detalhe de estoque exibe "consumo/dia 0,071…" ilegível e calcula custo/dose R$60,71 quando o
> real é R$425 (R$1700 ÷ 4 doses). Decisão de design 2026-06-12: **a dose é a unidade
> fundamental; o dia é projeção derivada**. Não entregar suporte DMT2 no 012 com UI/UX que
> confunde por falha conceitual. Depende da **B3** (densidade certa → `dosesRemaining` de líquido
> correto).

- **FR-026 — modelo de 3 quantidades (dose-primário)**: `packages/core/src/utils/stock.js` calcula,
  considerando **tomadas por dia de tomada**:
  - `tomadasPorDia = time_schedule.length` (quantas tomadas num dia ativo — pode ser >1 mesmo em
    frequências espaçadas);
  - `diasDeTomadaRestantes = estoque / (dosePorTomada × tomadasPorDia)` — **o número exibido**
    (líquido: doseMl via doseToMl da B2/B3; sólido: unidades). Frequency-agnostic;
  - `runwayDias = diasDeTomadaRestantes / frequencyDailyFactor(p)` — dias corridos, **derivado**.

  Diário: `diasDeTomadaRestantes == runwayDias` (sem regressão visual). Casos-verdade:
  **Mounjaro** semanal 1x 0,5ml, estoque 2ml → 2÷(0,5×1)=**4** dias de tomada / runway 4÷(1/7)=28d;
  **dias_alternados 2x/dia** dose 1u, estoque 20 → 20÷(1×2)=**10** dias de tomada / runway 10÷0,5=20d
  corridos. (Injetável 1×/dia: dia de tomada = 1 aplicação; o rótulo "aplicações" reusa o singular do
  container — FR-028.)
- **FR-027 — custo por dose (não por dia)**: `costAnalysisService` expõe `custoPorDose =
  precoUnidade / dosesPorUnidade` como número primário (R$425, não R$60,71). `custoPorDia` vira
  derivado opcional (`custoPorDose × dosesPorDia`) e **formatado** (limite de decimais — fim do
  `0,071428…`). Schema `costAnalysisSchema` ganha `custoPorDose`; testes atualizados.
- **FR-028 — display em doses, cor em runway (freq ≠ diário)**: chip/badge de estoque (web
  `StockCardRedesign`/`StockPill` + mobile `StockLevelBadge`/`StockItem`) exibem **"N doses"**
  (injetável: "N aplicações" via `INJECTION_CONTAINER_SINGULAR`); a **cor/status**
  (CRITICAL<7/LOW<14/NORMAL<30) continua medindo **runwayDias** — recompra é cronológica
  (lead time independe da frequência). Freq diário inalterado ("N dias"). Detalhe de estoque
  (web + mobile) mostra doses restantes + custo/dose como primários, runway como linha secundária.
- **FR-030 — `injection_container` por LOTE, não por medicamento** (smoke PO 2026-06-12): a B2
  cravou o container em `medicines` (valor único, capturado na 1ª compra). **Errado** — a
  apresentação é atributo do **lote comprado**, igual ao volume: o paciente pode comprar canetas
  pré-preenchidas e depois migrar p/ refis (mais econômico) no mesmo tratamento. Mover a coluna p/
  `stock`/`purchases` (`injection_container` por lote); rendimento (FR-020) calculado **por lote**
  ("≈3 canetas" no lote A + "≈2 refis" no lote B). Form de compra exibe o campo em **toda** compra
  (não só a 1ª, não omitido nas subsequentes). `medicines.injection_container` vira **default
  opcional** (sugestão do último lote) ou é aposentada — decidir na migração. Migração move/copia
  os valores existentes p/ os lotes correspondentes. Corrige FR-019/FR-020 (que assumiram
  medicine-level).
- **FR-029 — propagar dose-primário aos consumidores de display**: `refillPredictionService`
  (data de recompra = hoje + runwayDias derivado), PDF/consultation (`_pdfSectionBuilders`,
  `consultationPdfDataBuilder`) e Telegram `/estoque` (`server/bot/commands/estoque.js`) exibem
  doses como número-base, runway como contexto. Sem mudança de schema de dados — só camada de
  apresentação + cálculo derivado. Serverless: `dosesPorDia` reusa `frequencyDailyFactor` do core.

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
- **FR-013c** 🔴 **(regressão 022 — push de estoque errado)** ⏪ **PUXADO PARA A FASE B4** (decisão PO
  2026-06-13, ADR-067 — raiz comum com o modelo dose-primário; ver T045). Mantido aqui só como
  referência; a entrega ocorre na B4. — o cron
  serverless de alerta de estoque (`_processUserStockAlert`) calcula
  `daysRemaining = stock.qty / dailyConsumption` **sem conversão de unidades**: para líquidos o
  estoque está em **ml** (022), mas `dailyConsumption` soma `dosage_per_intake` na unidade de
  tomada (gotas/UI) — ex.: frasco 10 ml com 40 gotas/dia → `10/40 = 0 dias` → alerta crítico
  falso. O payload ainda exibe `remaining` cru (ml rotulado como "doses"). Mesmo padrão
  AP-221/R-267: o web converteu via `units_per_ml`, o read-path do cron ficou para trás.
  Correção na Fase D (mesmo domínio de unidades/insulina): (a) select do cron traz
  `units_per_ml` + `dosage_unit` do medicine; (b) `dailyConsumption` convertido para ml quando
  `lower(intake_unit) IN ('gotas','ui')` (mesma regra da RPC, incl. default por unidade de
  FR-013b); (c) payload formata `remaining` na unidade correta (R-272). Serverless não roda em
  dev → cobertura obrigatória por testes jest em `server/bot/__tests__/` (casos gotas/UI/ml/
  sólido) + considerar dry-run via env var para validação em prod.
- **FR-014**: Adesão de basal usa modo **binário** existente (R-248). `dose_exactness`/bolus = fora.
- **FR-015** ✅ **RESOLVIDO POR 022 + R-272**: exibição de dose de insulina usa os formatters
  core de 022 (`formatIntakeDose`/`formatDoseItem`/`formatDoseHint`, decisão via `isLiquidMedicine`)
  com a unidade de tomada (UI) — **nunca** `dosage_unit` cru nem "comprimido" hardcoded (R-272).
  Fase D apenas **garante** que as superfícies de insulina (dashboard, histórico, timeline,
  estoque, emergência, consulta, export) carregam `intake_unit`+`units_per_ml` na query (R-267) e
  passam pelos formatters. ADR-046/`formatDoseUnit` legado: substituído pelos formatters core.
- **FR-015b** 🔴 **(smoke PO 2026-06-11 — push/alarme crítico com frase errada p/ líquidos)**: o
  builder de payload de push (`formatDose` local em
  `server/notifications/payloads/_payloadBuilders.js:16`) ignora a unidade de tomada e força
  lowercase: dose líquida sai "Lantus (100ui/ml) · 10 un. — 12:00" em vez de "10 UI"; acrônimos
  (`UI`, `ui/ml`→`UI/ml`) devem ser **uppercase** na exibição. Mesmo padrão de FR-015/FR-013c:
  superfície serverless fora dos formatters core de 022. Correção na Fase D: (a) payload de
  dose carrega `intake_unit`+`units_per_ml` (R-267) — schema Zod do kind atualizado (R-193);
  (b) frase via formatters core (`formatIntakeDose`/`formatDoseItem`, R-272) — eliminar o
  `formatDose` local (fallback "1 un." p/ mg/ml também é lossy); (c) display de unidade com
  case canônico (`UI` uppercase; `mg`/`ml` lowercase). Cobre push, Telegram e alarme crítico
  (mesmos builders). Testes jest em `server/` (sólido/gotas/ml/UI + case).

**Fase E — Export clínico**
- **FR-016**: Relatório PDF cruza doses × biomarcadores por período/dia, agregação server-side
  (R-249, Constitution III), descritivo (sem recomendação de dose — SaMD).

### Key Entities
- **Medicine**: `presentation` (enum PT — FR-001; **já existe em prod via 022**) + `units_per_ml`
  (razão→ml genérica — FR-013; **já existe em prod via 022**, capturada no tratamento) + **net-new
  desta spec:** `shelf_life_days` (FR-002) + `injection_container` (enum caneta/ampola/frasco_ampola/
  seringa_preenchida, nullable — FR-019, capturado na 1ª compra). Injetável = `presentation='injetavel'`.
- **Stock**: + `opened_at` (inferido na 1ª tomada). Lote = unidade física de doses (caneta/cartucho
  transparente). `quantity` = UI/ml restantes; exibição em **aplicações** (floor — FR-020), nunca ml cru.
- **Protocol**: reusa `titration_schedule`/`current_stage_index`/`stage_started_at`/
  `titration_status` (existentes) + `intake_unit` (de 022, **+`'mg'` net-new FR-017**). Etapa do
  schedule pode marcar `requires_new_medicine` (FR-021). Cadência `semanal` (existente).
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
- **SC-002b** (Fase B2): GLP-1 em mg funciona ponta-a-ponta — `intake_unit='mg'` aceito (CHECK+Zod
  sincronizados); `consume_stock_fifo` debita `mg ÷ dosage_per_pill = ml` correto via FIFO
  (**a concentração mg/ml É o `dosage_per_pill`, não `units_per_ml`** — `units_per_ml` é null p/ mg;
  decisão de design 2026-06-12); concentração (`dosage_per_pill`) obrigatória p/ mg, sem ela →
  `RAISE EXCEPTION` (nunca chuta dose); helper "[X] mg em [Y] mL"; `injection_container` capturado
  na 1ª compra **web + mobile** (fallback "unidade"); estoque exibido em **aplicações** com floor;
  etapa de titulação `requires_new_medicine` emite notificação-CTA de troca sem alterar
  `expected_dose` (SaMD). **Decisões as-built do smoke:** default de unidade p/ `mg/ml` = **gotas**
  (mg é exceção opt-in); edição de tratamento carrega `intake_unit`+`units_per_ml` exatos do DB;
  consumo diário de estoque aplica `frequencyDailyFactor` (semanal/alternados não consomem todo dia).
  Cobertura por testes (RPC mg, formatters core mg, dailyIntake por frequência, floor de rendimento).
- **SC-002c** (Fase B4): estoque modelado em **doses** como métrica primária — `dosesRemaining =
  estoque / dosePorTomada` (frequency-agnostic); `runwayDias` derivado de `dosesRemaining /
  dosesPorDia`. Freq ≠ diário: chip/detalhe exibem **doses/aplicações** (cor por runway); custo
  exposto como **custo/dose** (R$425, não R$60,71/dia) com decimais formatados. Freq diário sem
  regressão (`doses == dias`). Propagado a refill/PDF/Telegram. Cobertura: core stock.js (doses ×
  runway por frequência), costAnalysis (custo/dose), badges web+mobile. **`injection_container`
  movido p/ o lote** (FR-030): rendimento por lote, campo em toda compra, migração move valores de
  `medicines` p/ `stock`/`purchases`.
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
2. ✅ **Forma (FR-001):** nova coluna **`medicines.presentation`** (enum geral — injetavel/pomada/
   liquido/…), não booleano `is_injectable`; cobre múltiplas formas num eixo único.
3. ✅ **Concentração (FR-013):** coluna genérica razão→ml que se adapta à `dosage_unit`.
   **Nome final em prod (022): `medicines.units_per_ml`** (gotas→20, ui/ml→100). 012 reusa.

**Coordenação cross-spec com 022 (✅ CONCLUÍDA — 022 mergeada 2026-06-08, #650/#651/#652):**
- `presentation`: ✅ coluna **em prod** (`medicines.presentation`, enum PT, CHECK
  `medicines_presentation_check`, default `comprimido`). 012 consome (`='injetavel'`). `is_liquid`
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
