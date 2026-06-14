# Feature Specification: Rotação de sítio de aplicação (injetáveis)

**Feature Directory**: `plans/specs/031-injection-site-rotation`
**Created**: 2026-06-14
**Status**: draft (Specifying)
**Tier**: 2 (Epic — migração em `medicine_logs` + ADR persistência/rotação-global + cross web+mobile)
**Input**: "031 - injection site rotation: log do local de aplicação durante tomada de injetáveis; recuperar último local; dropdown de locais pré-definidos; alerta se local = último; hint absorção lenta/rápida; detalhe de dose no histórico mostra local (+ outras necessidades)"

---

## Context

Pacientes DMT2 em uso de GLP-1 (Ozempic, Mounjaro, etc.) e insulinas relataram dor real:
**esquecer entre uma aplicação e outra (semanal/diária) em qual região aplicaram a última
dose** (coxa D/E, abdômen D/E, braço D/E, etc.). Sem rotação sistemática surge
**lipo-hipertrofia** (nódulos por punção repetida no mesmo ponto), que prejudica absorção e
controle glicêmico (consenso FITTER/Mayo).

Hoje o dosiq registra a dose (`medicine_logs`) mas **não captura o local corporal**. Esta
feature adiciona o sítio de aplicação como **metadado da tomada de injetáveis**, com auxílio
de rotação (último local, alerta de repetição, dica de absorção) e exibição no histórico.

### Decisões de modelagem firmadas (com PO)
- **Sítio mora em coluna `medicine_logs.injection_site`** (atributo do ato de injetar),
  **não** em `biomarkers_log` (medição numérica — glicemia/peso/PA, Fase C 012; sítio é
  categórico, sem `value/unit` → type mismatch) e **não** em tabela dedicada nova (FK
  polimórfica `dose_instances`/`medicine_logs` = ambiguidade + JOINs, sem ganho funcional
  sobre coluna; só se pagaria com roadmap de *body-map* rico: coordenadas, foto, sítio sem dose).
- **Rotação é GLOBAL no corpo**, NÃO por medicamento/tratamento. Diabéticos usam múltiplos
  injetáveis; "último sítio" por-med induziria colisão (Ozempic seg `coxa_d`, Lantus ter
  `coxa_d` = mesmo ponto → lipo-hipertrofia). O corpo é um só. Globalidade = **semântica de
  query** (NÃO filtrar por `medicine_id`/`protocol_id`), não shape de storage — coluna
  consultada global já entrega rotação corporal completa.
- **Ordenação temporal por `taken_at`** (hora real da aplicação), **nunca** `created_at`.
  `ORDER BY taken_at DESC` é avaliado na query sobre o valor da coluna → log **retroativo**
  encaixa na posição cronológica correta, independente da ordem de inserção física. Fallback
  `COALESCE(taken_at, created_at)`; desempate por `created_at`/`id`; índice parcial
  `(user_id, taken_at) WHERE injection_site IS NOT NULL` p/ performance do "último global".
- **`doseZones.js`/CON-024 NÃO se aplica** — são zonas de **horário** do dia
  (madrugada/manhã/tarde/noite), não corporais. Sítios corporais = util **global** novo no core.

### Postura regulatória (SaMD)
A 012 já carrega disciplina anti-SaMD (T026 "relatório descritivo, sem recomendação";
ADR-062 "zero cálculo de dose"). Esta feature herda: **registro + lembrete educacional**,
**sem** claim terapêutico nem prescrição de sítio. "Alerta se = último" e "hint de absorção"
são informativos (não-SaMD). "Sugerir próximo sítio" fica **fora do escopo** (evita SaMD).

---

## User Stories

### US1 — Registrar local na tomada (P1)
Como paciente aplicando um injetável, quero escolher a região corporal no momento do registro,
para manter um histórico de onde apliquei.

**Acceptance**
- Dado um medicamento **injetável** sendo registrado (qualquer fluxo: card, alarme, manual),
  Quando abro o formulário de tomada,
  Então vejo um campo de **local de aplicação** (dropdown de sítios pré-definidos).
- Dado um medicamento **não-injetável** (oral/tópico),
  Quando registro a tomada,
  Então o campo de local **não aparece** (sítio é NULL).
- Dado que não escolhi local,
  Quando confirmo a dose,
  Então a dose é registrada normalmente (local opcional, NULL).

### US2 — Recuperar último local (GLOBAL) (P1)
Como paciente, quero ver onde apliquei a última injeção — **de qualquer medicamento** —
para lembrar de rotacionar no corpo todo.

**Acceptance**
- Dado ≥1 dose injetável anterior **com local** (de **qualquer** medicamento/tratamento),
  Quando abro o formulário de tomada de um injetável,
  Então vejo "última aplicação: \<local\>" (o mais recente por `taken_at`, cross-medicamento).

### US3 — Alerta de repetição (GLOBAL) (P1)
Como paciente, quero ser avisado se escolher o mesmo local da última injeção (qualquer
medicamento), para não reaplicar no mesmo ponto ao alternar entre medicamentos.

**Acceptance**
- Dado que a última aplicação **global** foi `coxa_d` (independente do medicamento),
  Quando seleciono `coxa_d` numa nova tomada,
  Então vejo um alerta **não-bloqueante** (ex.: "mesmo local da última aplicação — considere
  rotacionar"), mas **posso confirmar mesmo assim**.

### US4 — Dica de absorção (P2)
Como paciente, quero entender que regiões absorvem em ritmos diferentes, como informação
educacional.

**Acceptance**
- Dado um local selecionado,
  Quando o vejo no formulário,
  Então há um hint informativo de absorção (ex.: abdômen "rápida", coxa "mais lenta"),
  **sem** recomendar ou prescrever (texto educacional).

### US5 — Local no histórico (P1)
Como paciente, quero ver o local registrado no detalhe da dose no histórico.

**Acceptance**
- Dado uma dose injetável tomada com local registrado,
  Quando abro o detalhe dela no histórico (web e mobile),
  Então vejo o local de aplicação.
- Dado uma dose sem local (legado/oral),
  Quando abro o detalhe,
  Então o campo de local simplesmente não aparece (sem placeholder vazio).

### US6 — Editar local pós-registro (P2)
Como paciente que logou por um fluxo rápido (1-click/alarme/bulk), quero adicionar/corrigir o
local depois, já que não houve form na hora.

**Acceptance**
- Dado uma dose **injetável** registrada sem local (NULL),
  Quando abro o detalhe dela no histórico,
  Então posso **escolher/editar** o local de aplicação e salvar.
- Dado uma dose com local,
  Quando edito,
  Então o novo local persiste e passa a valer para a rotação global (`taken_at` inalterado).


---

## Functional Requirements

- **FR-001**: Tomadas de medicamentos **injetáveis** DEVEM aceitar um campo opcional
  `injection_site` (enum corporal PT) persistido em `medicine_logs`.
- **FR-002**: O conjunto de sítios DEVE viver em util **compartilhado** novo no core
  (web↔mobile, sem duplicação — R-231), com labels PT e laterália (D/E).
- **FR-003**: O campo de local DEVE aparecer **apenas** para injetáveis; demais formas gravam
  `injection_site = NULL`.
- **FR-004**: O formulário de tomada DEVE exibir o **último local registrado GLOBAL**
  (cross-medicamento, mais recente por `taken_at`) do usuário (US2), quando existir.
- **FR-005**: Selecionar o mesmo local da última aplicação **global** DEVE disparar alerta
  **não-bloqueante** (US3); a confirmação da dose nunca é impedida pelo local.
- **FR-005a**: A consulta de "último local" DEVE ordenar por `taken_at` (NÃO `created_at`),
  com `COALESCE(taken_at, created_at)` de fallback, para que logs **retroativos** não
  distorçam a sequência cronológica de rotação.
- **FR-006**: Cada local DEVE ter um hint informativo de absorção (US4), texto educacional,
  **sem** recomendação clínica/prescrição (não-SaMD).
- **FR-007**: O detalhe de dose no histórico (web `timelineService`/`HistoryDayPanel` +
  mobile) DEVE exibir o local quando presente (US5); ausência = campo oculto.
- **FR-008**: `injectionSiteSchema`/enum no core DEVE sincronizar com o CHECK constraint SQL
  (R-271/R-082); `.nullable().optional()`; `safeParse`.
- **FR-009**: A migração DEVE ser **aditiva** (coluna nullable + CHECK), sem afetar logs
  existentes, FIFO de estoque, nem cálculo de adesão.
- **FR-010**: O sítio NUNCA pode ser **obrigatório**; fluxos sem form (urgent dose web,
  alarme crítico, bulk/multidose, Telegram, voz) gravam `injection_site = NULL` por padrão.
- **FR-011**: O detalhe de dose injetável no histórico DEVE permitir **editar/adicionar** o
  local pós-registro (US6), persistindo em `medicine_logs` sem alterar `taken_at`.

## Success Criteria

- **SC-001**: Registrar dose injetável permite escolher local; oral/tópico não mostra o campo.
- **SC-002**: Após registrar `coxa_d` em **qualquer** injetável, a próxima tomada de **qualquer
  outro** injetável mostra "última: coxa D" (rotação global cross-medicamento).
- **SC-002a**: Inserir um log **retroativo** (`taken_at` antigo) NÃO altera o "último local"
  se já houver aplicação mais recente; a ordenação por `taken_at` mantém a cronologia.
- **SC-003**: Selecionar local = último dispara alerta não-bloqueante; dose ainda confirma.
- **SC-004**: Detalhe de dose no histórico (web+mobile) mostra o local registrado.
- **SC-005**: Doses legadas (sem local) e orais aparecem sem campo de local (sem regressão).
- **SC-006**: Enum core ↔ CHECK SQL sincronizados (teste de paridade).

## Edge Cases

- Medicamento muda de oral→injetável (ou vice-versa) após logs existentes: histórico antigo
  mantém local NULL; novos seguem o tipo atual.
- Múltiplos injetáveis ativos: "último local" é **GLOBAL** (cross-medicamento) — corpo é um
  só. Evita colisão ao alternar doses entre medicamentos.
- Registro retroativo/bulk (plan/protocol arrays): local aplicado por item ou ausente; a
  ordenação por `taken_at` garante cronologia correta mesmo com inserção fora de ordem.
- PRN injetável (`quando_necessario`): também captura local (sem dose_instance — alinha 030).
- **Caminhos de log SEM form (não há onde escolher sítio inline)** — restrição central, ver
  seção dedicada abaixo: urgent dose web (1-click), alarme crítico fullscreen (`<tomei>`),
  bulk/multidose (só marca medicamento, sem editar quantidade/detalhes), Telegram, voz.

## Caminhos de log sem formulário (restrição de captura)

Vários fluxos registram a dose **sem abrir form** — não há ponto natural p/ escolher o sítio:

| Fluxo | Comportamento atual | Captura sítio? |
|---|---|---|
| **Urgent dose (web)** | 1-click, sem form | não inline |
| **Alarme crítico fullscreen** | loga direto pelo `<tomei>`, sem form | não inline |
| **Bulk/multidose (forms/modais)** | só marca QUAL medicamento foi tomado; sem editar quantidade/detalhes | não inline |
| **Telegram** | callbacks 1-tap | não inline |
| **Voz** | comando rápido | não inline |

Implicação: o sítio NÃO pode ser obrigatório em nenhum fluxo, e esses caminhos gravam
`injection_site = NULL` por padrão. Estratégias possíveis (decidir no Planning, NÃO chutar):
- **(a) NULL silencioso** + editar local depois no detalhe da dose (histórico).
- **(b) Quick-pick pós-log**: após 1-click, oferecer um seletor rápido opcional de sítio
  (chip/bottom-sheet) sem reabrir o form completo — preserva o fluxo rápido.
- **(c) Prompt mínimo só p/ injetável**: inserir um micro-passo de sítio apenas quando o item
  é injetável (degrada o "1-click" — avaliar custo UX).

Recomendação inicial: **(a)+(b)** — nunca bloquear o fluxo rápido; oferecer captura opcional
imediata e edição posterior. Confirmar no Planning + definir se bulk multidose ganha sítio
por-item ou fica NULL.

## Key Entities

- **`medicine_logs.injection_site`** (novo): enum corporal PT nullable + CHECK. **8 sítios**
  (região + laterália, granularidade definida com PO):
  `abdomen_e, abdomen_d, coxa_e, coxa_d, braco_e, braco_d, gluteo_e, gluteo_d`.
- **`injectionSites` (core util GLOBAL novo)**: lista canônica `{ value, label, absorption }`
  compartilhada web↔mobile (R-231). `absorption` = hint educacional (abdômen rápida, braço
  moderada, coxa lenta, glúteo mais lenta). Não confundir com `doseZones` (horário).
- **"Último local global"**: derivado por query sobre `medicine_logs` (sem filtro de med,
  `ORDER BY taken_at DESC`), não é entidade persistida nova.

## Assumptions / Open Questions

- Injetável é detectável pelo tipo de medicamento (`injetavel`) / forma já existente — read-path
  reusa essa flag (sem novo gate).

### Resolvido com PO (2026-06-14)
- **Granularidade**: 8 sítios (região + laterália E/D). Sem sub-quadrante na v1.
- **Persistência**: coluna `medicine_logs.injection_site` apenas (NÃO `dose_instances`, NÃO
  tabela nova). `dose_instances` alcança o sítio via `medicine_log.dose_instance_id` quando
  necessário.
- **Escopo da rotação**: GLOBAL no corpo (cross-medicamento), via query — não per-med.
- **Ordenação**: por `taken_at` (tolerante a log retroativo).
- **SaMD / "sugerir próximo" (ex-US6)**: FORA do escopo — não esbarrar em SaMD por ora.

### Open / Planning
- Flows secundários (Telegram, voz) capturam local na v1? Default = NULL se omitido — decidir
  no Planning.
- ADR a registrar no Planning: "sítio de injeção como coluna em `medicine_logs` + rotação
  global por query" (documenta a escolha vs. tabela dedicada / biomarkers_log).
