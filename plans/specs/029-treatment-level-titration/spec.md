# Feature Specification: Titulação em Nível de Tratamento (N2) — DRAFT

**Feature Directory**: `plans/specs/029-treatment-level-titration`
**Created**: 2026-06-12
**Status**: **draft** — não planejada. Nasce da limitação estrutural exposta no épico 012
(titulação atual é "broken by design" p/ escadas que trocam de medicamento). Aguarda priorização
do PO. **NÃO iniciar Planning/Coding sem promoção explícita.**
**Tier**: 2 (épico — novo modelo de dados de titulação + motor de avanço cross-medicamento +
UI; multi-PR, migração, novos ADRs). Estimativa preliminar — reavaliar no Planning.
**Input**: "draft N2 — titulação plano-nível (sessão de design 012 Fase B, 2026-06-12)"
**Origem**: 012 FR-021 (titulação N1) entrega o paliativo `requires_new_medicine` (etapa que
exige troca de caneta vira **notificação-CTA**, sem mudar `expected_dose`). N2 é a solução
estrutural que N1 sinaliza mas não resolve.

---

## Context

A titulação de hoje (`protocols.titration_schedule` jsonb + `current_stage_index` +
`stage_started_at` + `titration_status`) é **intra-medicamento, intra-protocolo**: a escada muda
apenas a **dose** (`dosage`) de um mesmo medicamento dentro de um mesmo `protocol`. Modelo
adequado para:

- **Metoprolol** (titulação clássica): mesma concentração, mais comprimidos por etapa — só a dose
  numérica sobe. Funciona.

Mas **quebra por design** quando a escada prescrita exige **mudança de medicamento/apresentação**:

- **GLP-1 cross-força** (Ozempic/Wegovy/Mounjaro): a escada de introdução troca de **caneta**
  (0,25 mg → 0,5 mg → 1 mg) e cada força é, no modelo do dosiq, um **cadastro de medicamento
  diferente** (concentração/apresentação distintas, lote/compra próprios). Um `titration_schedule`
  preso a 1 `protocol`/`medicine` não consegue "saltar" de um medicamento p/ outro.
- Qualquer tratamento onde a evolução clínica = **sequência de medicamentos**, não de doses.

012 FR-021 (N1) cobre o caso GLP-1 **avisando** ("hora de trocar de caneta") sem automatizar a
transição — registro passivo do cronograma, dentro de SaMD. N2 promove a titulação a um conceito
de **nível de tratamento** (`treatment_plan`), onde cada etapa referencia **medicamento + dose** e
o avanço **pausa/ativa os `protocols` corretos** automaticamente.

> **Linha SaMD (herdada do 012/ADR-062):** o app **nunca decide** a escada — apenas executa a que
> foi prescrita e cadastrada. N2 automatiza a *transição mecânica* (pausar protocolo A, ativar
> protocolo B na data prescrita), não a *decisão clínica*. Toda etapa é cadastro do usuário/cuidador
> a partir da prescrição médica.

---

## User Stories (rascunho — refinar no Specifying formal)

- **US1 (P1)** — Como cuidador de paciente em GLP-1, quero cadastrar a escada de introdução como
  **uma sequência de etapas que trocam de caneta** (medicamento+dose+duração por etapa), para que o
  app ative a caneta certa na semana certa sem eu reconfigurar tratamentos manualmente.
  - **Given** um tratamento com escada [caneta 0,25mg ×4sem → caneta 0,5mg ×4sem → caneta 1mg
    contínuo], **when** a etapa 1 vence, **then** o protocolo da caneta 0,25 é pausado e o da
    caneta 0,5 é ativado na data prescrita, com notificação-CTA informativa (sem decisão de dose).
- **US2 (P2)** — Como paciente, quero ver na timeline/tratamento **qual etapa da escada estou** e
  qual vem a seguir (medicamento + dose + quando), para entender minha evolução.
- **US3 (P3)** — Como cuidador, quero que a titulação clássica intra-medicamento (metoprolol) **siga
  funcionando** sem migração forçada — N2 coexiste com o modelo atual, não o substitui à força.

---

## Functional Requirements (rascunho)

- **FR-N2-001**: Novo modelo de titulação ancorado no `treatment_plan` (não no `protocol`): uma
  **escada** cujas **etapas referenciam `medicine_id` + dose + `intake_unit` + duração**. Decisão
  de dados em aberto (ver Open Questions): nova tabela `titration_plans`/`titration_steps` vs.
  extensão do jsonb atual com `medicine_id` por etapa.
- **FR-N2-002**: Motor de avanço cross-medicamento: ao vencer uma etapa (`stage_started_at +
  duration`), **pausar** o(s) `protocol`(s) da etapa anterior e **ativar/criar** o(s) da próxima,
  na data prescrita. Reusa a disciplina de auto-avanço por cronograma (012 FR-005b) e a **trava
  otimista** (AP-221) já no cron.
- **FR-N2-003**: Geração de `dose_instances` respeita a etapa vigente **com o medicamento certo**
  (não só a dose) — extensão de FP-1/ADR-050 p/ trocar a referência de `medicine`/`protocol`.
- **FR-N2-004**: Notificação-CTA de transição (reusa/estende a copy de 012 FR-021): "Etapa N
  iniciada: [medicamento] [dose]" — informativo, sem recomendação de dose (SaMD).
- **FR-N2-005**: Coexistência com titulação intra-medicamento (012 FR-005): metoprolol continua no
  modelo simples; N2 é opt-in p/ escadas cross-medicamento. Migração de dados **não-destrutiva**.
- **FR-N2-006**: UI de cadastro da escada (web + mobile): cada etapa escolhe medicamento +
  dose/`intake_unit` + duração; estado `requires_new_medicine` do N1 (012) é absorvido/promovido.
- **FR-N2-007**: Estoque/compra por etapa: cada caneta da escada tem seu próprio lote/rendimento
  (reusa 012 FR-020 — aplicações/floor); transição não perde estoque da etapa anterior.

---

## Success Criteria (rascunho)

- **SC-N2-001**: Escada GLP-1 cross-força ponta-a-ponta — cadastro→avanço automático de etapa que
  **troca de medicamento**→`dose_instances` com a caneta certa→notificação-CTA, sem reconfiguração
  manual e sem violar SaMD.
- **SC-N2-002**: Titulação intra-medicamento (metoprolol) inalterada; nenhuma migração destrutiva.
- **SC-N2-003**: Transição de etapa idempotente sob o cron (trava otimista AP-221); estoque por
  etapa preservado.

---

## Assumptions / Open Questions

- **[NEEDS CLARIFICATION — modelo de dados]**: nova(s) tabela(s) `titration_plans`/`titration_steps`
  (normalizado, FK p/ `medicines`/`protocols`) **vs.** estender o `titration_schedule` jsonb atual
  com `medicine_id` por etapa. Decisão **arquitetural** → marcador, não palpite (lição 012: derivar
  default arquitetural errado é o fracasso mais caro). Resolver no Specifying/Planning formal.
- **[NEEDS CLARIFICATION — relação protocol↔etapa]**: cada etapa cria um `protocol` próprio (ativa/
  pausa) **vs.** um único `protocol` que troca de `medicine_id`? Impacta histórico de adesão,
  `dose_instances` e estoque.
- **[NEEDS CLARIFICATION — escopo de migração]**: tratamentos GLP-1 já cadastrados no modelo N1
  (012) migram p/ N2 ou coexistem? Política de migração não-destrutiva a definir.
- **Dependência**: requer 012 Fase B2 (canetas GLP-1, `intake_unit='mg'`, container, rendimento)
  entregue — N2 reusa essa fundação.
- **SaMD**: toda automação é transição **mecânica** do cronograma prescrito; zero recomendação de
  dose. Constitution I/V + ADR-062 (012) regem.

---

## Out of Scope (deste draft)

- Recomendação/ajuste automático de dose por resposta clínica (fora da linha SaMD — proibido).
- Plano técnico, Target Files, ADRs — só no Planning formal pós-promoção.

---

> **Próximo passo:** aguardar priorização do PO. Quando promovido: `/devflow specifying` (refinar
> US/FR + resolver os [NEEDS CLARIFICATION]) → Planning (modelo de dados + ADR). Indexado no
> `plans/specs/README.md` como **draft**.
