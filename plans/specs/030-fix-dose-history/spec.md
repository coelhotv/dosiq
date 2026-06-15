# Feature Specification: Histórico expõe doses avulsas e PRN

**Feature Directory**: `plans/specs/030-fix-dose-history`
**Created**: 2026-06-14
**Status**: draft — descoberto no smoke da Fase B4 do 012 (2026-06-14)
**Tier**: 1 (Standard — 1 feature, web + mobile, sem migração/ADR)
**Input**: "cria um spec draft em 030-fix-dose-history"

---

## Context

O histórico de doses (web `HealthHistory`/`timelineService.getMonthTimeline` e mobile
`useHistoryData`) é montado **exclusivamente a partir de `dose_instances`** (eventos
agendados: taken/missed/pending). Qualquer `medicine_log` **sem `dose_instance_id`** é
invisível no histórico.

Dois casos reais ficam ocultos:
1. **Dose avulsa/extra** — tomada registrada além da agenda (ex.: Lantus, log de 09/jun
   `dose_instance_id=null` registrado via 1-click manual). O estoque debita (FIFO corre),
   mas o evento não aparece em nenhum histórico → saldo "não bate" com o que o usuário vê.
2. **Tratamentos `quando_necessario` (PRN)** — não geram `dose_instances` (sem cadência).
   Logo **todas** as tomadas de um PRN são `medicine_logs` órfãos → o histórico de um
   tratamento PRN fica **sempre vazio**, mesmo com doses registradas.

Descoberto durante o smoke da Fase B4 (012). Sem impacto no estoque (consumo correto);
é gap de **visibilidade/registro** no histórico.

Agregado ao spec um segundo gap de **UX no detalhe da dose (mobile)**, do mesmo smoke: o
bottom sheet de detalhe só renderiza o ícone correto para doses tomadas (check), exibindo
check-mark cinza para `pending`/`missed`/`skipped`, e não traz rótulo textual do status
(US4/US5). Vamos também alterar o ícone padrão de dose tomada para o lucide `circle-check-big` que se aproxima mais do próprio logo do Dosiq. Mesma família (read-path de histórico/detalhe de dose), Tier 1.

---

## User Stories

### US1 — Ver doses extras (P1)
Como paciente, quero que doses registradas **fora da agenda** apareçam no histórico,
para que o que vejo bata com o estoque debitado.

**Acceptance**
- Dado um `medicine_log` com `dose_instance_id=null` num dia,
  Quando abro o histórico desse dia (web e mobile),
  Então vejo um evento "dose avulsa" com horário (`taken_at`), quantidade e medicamento.

### US2 — Histórico de tratamentos PRN (P1)
Como paciente com tratamento `quando_necessario`, quero ver minhas tomadas registradas,
já que PRN não tem agenda.

**Acceptance**
- Dado um protocolo `quando_necessario` com N tomadas registradas,
  Quando abro o histórico,
  Então vejo as N tomadas (não uma lista vazia).

### US3 — Sem duplicação (P2)
- Dado um `medicine_log` **ancorado** a uma `dose_instance` (fluxo normal agendado),
  Quando o histórico une instâncias + logs órfãos,
  Então o evento aparece **uma única vez** (a instância; o log ancorado não duplica).

### US4 — Ícone correto no detalhe (mobile) (P1)
Como paciente, quero que o bottom sheet de detalhe da dose mostre o **mesmo ícone**
da listagem (por status), não um check-mark cinza genérico para tudo que não foi tomado.

**Acceptance**
- Dado uma dose com status `pending`/`missed`/`skipped` na listagem (ícone próprio),
  Quando abro o bottom sheet de detalhe dela,
  Então o ícone exibido é o **mesmo** da listagem (paridade), não um check-mark cinza.
- Dado uma dose `taken`,
  Quando abro o detalhe,
  Então o ícone de tomada (circle-check-big) é mostrado.

### US5 — Chip textual de status (mobile) (P1)
Como paciente, quero um rótulo textual do status no bottom sheet de detalhe,
porque o ícone sozinho é ambíguo.

**Acceptance**
- Dado uma dose em qualquer status,
  Quando abro o bottom sheet de detalhe,
  Então vejo um chip/legenda textual: "Tomada", "Perdida", "Pendente" ou "Pulada".

---

## Functional Requirements

- **FR-001**: O histórico (web `timelineService` + mobile `useHistoryData`) DEVE unir
  `dose_instances` com `medicine_logs` que **não** possuem `dose_instance_id`, renderizando
  estes como evento "dose avulsa" no dia do `taken_at` (timezone do usuário).
- **FR-002**: Logs órfãos DEVEM exibir horário, medicamento e quantidade na unidade de
  tomada (mesmos formatters da instância — `formatIntakeDose`/`formatDoseItem`).
- **FR-003**: A união NÃO DEVE duplicar eventos já representados por `dose_instances`
  (filtrar logs com `dose_instance_id` não-nulo).
- **FR-004**: PRN (`frequency='quando_necessario'`) — como não há instâncias, o histórico
  DEVE listar seus `medicine_logs` diretamente (caso particular de FR-001).
- **FR-005**: A navegação por dia/mês e o piso de calendário existentes DEVEM continuar
  funcionando; logs órfãos respeitam o mesmo filtro de período/timezone.
- **FR-006**: O bottom sheet de detalhe da dose (mobile) DEVE derivar o ícone do `status`
  da dose, reusando o **mesmo mapa status→ícone** da listagem (paridade visual). Proibido
  hardcodar check-mark para status não-`taken`.
- **FR-007**: O bottom sheet de detalhe (mobile) DEVE exibir um chip/legenda textual do
  status: `taken`→"Tomada", `missed`→"Perdida", `pending`→"Pendente", `skipped`→"Pulada".

## Success Criteria

- **SC-001**: O log avulso do Lantus (09/jun) aparece no histórico web e mobile.
- **SC-002**: Um tratamento PRN com ≥1 tomada mostra histórico não-vazio em ambas plataformas.
- **SC-003**: Nenhuma dose agendada-e-tomada aparece duplicada.
- **SC-004**: Abrir o detalhe de uma dose `pending`/`missed`/`skipped` mostra o ícone próprio
  do status (igual à listagem), não check-mark cinza.
- **SC-005**: O detalhe de qualquer dose exibe chip textual do status correspondente.

## Assumptions / Open Questions

- Visual da "dose avulsa": chip/linha distinta da agendada (a definir no design) — sugere-se
  rótulo "avulsa"/"extra" e, para PRN, apenas a tomada (sem status missed/pending).
- `medicine_logs` já tem `taken_at`, `quantity_taken`, `protocol_id`, `medicine_id`,
  `dose_instance_id` — fonte suficiente; sem migração prevista.
- [NEEDS CLARIFICATION: doses avulsas entram no cálculo de adesão, ou só no histórico
  visual? (adesão hoje é instance-based — FP-1/ADR-050)]
