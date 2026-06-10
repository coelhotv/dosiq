# Spec: Alarme Nativo v2 — Critical Alerts iOS + Crítico por-protocolo

**Feature Directory**: `plans/specs/010-native-alarm-v2`
**Created**: 2026-06-03
**Status**: delivered — PR #634 (mobile 0.10.0; ADR-055/056)
**Tier**: 2 (Epic)
**Input**: "/devflow specifying Alarm v2 — upgrade Critical Alerts iOS + expansão do modelo de protocolos pra flag opt-in de alerta crítico por-protocolo + controle de sobreposição com pushes normais + wire com dose_instances"
**Pré-requisito**: **spec 011** (Notif ← dose_instances / ADR-057). O reminder precisa já ler
`dose_instances` para o gate crítico per-dose ler `dose_instances.critical_alarm` direto (fonte
única). **C3 da 010 só inicia após a 011 mergeada.** (Reconciliação 2026-06-03 — removido o hack
de duas fontes da versão original do ADR-056.)

---

## Context

O **Alarme Nativo v1** (Spec 001, mergeado em 2026-06-03) entregou um alarme local
persistente **opt-in por-device** (toggle global em AsyncStorage, default OFF): quando
ligado, **todas** as doses do usuário disparam alarme em tela cheia, e o gate
`native_alarm_enabled` (R-258) suprime o push de dose pra aquele device. iOS ficou em
`timeSensitive` (fura Focus/DND, mas **não** o mudo físico).

O v1 é "tudo ou nada": ligar o alarme submete o usuário a alarme invasivo em **toda**
dose, e suprime o push normal de **todas**. Na prática, nem toda dose merece um alarme
crítico — só as **inegociáveis** (ex.: imunossupressor pós-transplante, anticoncepcional,
insulina). O v2 dá **granularidade por-protocolo** + sobe o teto de invasividade no iOS
(Critical Alerts, fura mudo físico) para essas doses, mantendo o push normal nas demais.

**Por que agora:** o entitlement de Critical Alerts da Apple está em avaliação; quando
aprovado, precisamos do modelo de dados + UX prontos pra promover. E o feedback de produto
do v1 foi claro: "alarme em toda dose torna o app insuportável" — a flag per-protocolo é a
resposta já sinalizada como v2 no Out-of-Scope do Spec 001.

**Relação com a base existente:**
- `dose_instances` (ADR-048/050/051) — ocorrências materializadas; o agendamento do
  alarme já lê a janela 72h via `buildDoseItemsFromInstances` (CON-024). **ADR-050 FP-2**
  já prevê "tolerância/config por protocolo" como futureproofing — o crítico per-protocolo
  encaixa nessa linha.
- Dispatcher de notificação (R-200/R-220, CON-019) — gate centralizado; o controle de
  sobreposição vive aqui (não em L1).
- Gate v1 R-258 (`native_alarm_enabled` por-device, type-aware por `kind`).

---

## User Stories

### US1 — Marcar um tratamento como "alerta crítico" (P1)
Como usuário com uma dose inegociável, quero **marcar tratamentos específicos** como
"alerta crítico" para que **só essas** doses disparem o alarme invasivo, e as demais sigam
com o lembrete normal (push).

**Acceptance:**
- **Given** um tratamento ativo, **When** abro seus detalhes/edição, **Then** vejo um
  toggle "Alerta crítico" (default OFF) com explicação clara do que muda (tela cheia + som
  tocando mesmo no silencioso).
- **Given** o toggle de um tratamento ligado, **When** chega o horário de uma dose dele,
  **Then** dispara o alarme em tela cheia (não só o push).
- **Given** um tratamento com o toggle **desligado**, **When** chega o horário de uma dose
  dele, **Then** chega o **push normal** (sem alarme), mesmo que outro tratamento do mesmo
  usuário tenha crítico ligado.

### US2 — Sem dupla notificação por dose (P1)
Como usuário, não quero receber **alarme + push** para a mesma dose crítica.

**Acceptance:**
- **Given** uma dose de um tratamento com crítico ON, **When** o horário chega, **Then**
  recebo **só o alarme** (o push normal daquela dose é suprimido).
- **Given** uma dose de um tratamento com crítico OFF, **When** o horário chega, **Then**
  recebo **só o push normal** (sem alarme).

### US3 — Critical Alerts iOS para doses críticas (P2)
Como usuário iOS com uma dose inegociável, quero que o alarme **fure o silencioso físico**
(não só o Focus/DND) para tratamentos marcados como crítico.

**Acceptance:**
- **Given** o entitlement de Critical Alerts aprovado e um tratamento com crítico ON,
  **When** a dose dispara com o iPhone no mudo físico, **Then** o alarme toca assim mesmo.
- **Given** o entitlement **não** aprovado (estado atual), **When** a dose crítica dispara,
  **Then** cai no fallback `timeSensitive` (comportamento v1) sem quebrar.

---

## Functional Requirements

- **FR-001** `protocols` DEVE ganhar uma coluna booleana de "alerta crítico" por-tratamento
  (default false) — a **intenção do usuário**, editável (Q1).
- **FR-001b** `dose_instances` DEVE ganhar uma coluna booleana `critical_alarm` (default
  false) **materializada** da flag do protocolo na geração da ocorrência — o **eixo por-dose**
  que o agendador e o dispatcher consomem como fonte primária (Q1/Q3). A coluna carrega só o
  **bit crítico**, NÃO a rota completa (canal é preferência por-usuário, computada live pelo
  dispatcher — evita drift em massa).
- **FR-002** O agendador de alarme (mobile) DEVE agendar alarme **somente** para
  `dose_instances` com `critical_alarm = true` (em vez de todas, como no v1).
- **FR-003** O dispatcher (server) DEVE computar a **rota** de cada dose combinando
  `dose_instances.critical_alarm` × prefs de canal do usuário (`resolveChannelsForUser`) ×
  capacidade de alarme do device: dose crítica coberta por alarme → **suprime o push normal**
  daquela dose; dose não-crítica → push normal. Granularidade **per-dose** (não per-device).
- **FR-004** O **toggle global de device** (v1, `native_alarm_enabled`) é **aposentado**: o
  controle passa a ser por-tratamento. Migração de UX: usuários que tinham o global ON DEVEM
  ver um hint de que o alarme crítico agora é configurado em cada tratamento.
- **FR-005** iOS: doses de tratamentos críticos DEVEM usar `interruptionLevel:'critical'`
  (+ entitlement) quando disponível, com fallback a `timeSensitive` quando não.
- **FR-006** A UI de detalhe/edição de tratamento DEVE expor o toggle "Alerta crítico" com
  cópia clara (idoso-friendly) e default OFF (opt-in consciente).
- **FR-006b** Ao **ligar** o toggle crítico de um tratamento, a UX DEVE checar a **permissão
  de notificação do SO** (POST_NOTIFICATIONS/iOS auth) no ponto de intenção (R-239) e guiar o
  usuário se negada. A permissão do SO é o **único requisito** do alarme local; o toggle
  in-app de push (`channel_mobile_push_enabled`) governa o push remoto (camada separada,
  ADR-047) e NÃO bloqueia o alarme — mas a UX pode alertar que, com push off, as doses
  não-críticas ficam sem lembrete.
- **FR-007** Mudança de payload/kind/rota de notificação DEVE ter ADR aceito antes de
  implementar (constitution V); enum Zod do dispatcher atualizado se houver novo kind
  (R-193/AP-115).
- **FR-008** Migração de dados: `protocols.<flag>` e `dose_instances.critical_alarm` nascem
  **false** em todas as linhas existentes (nenhuma dose vira crítica sem ação do usuário).
- **FR-009** Ligar/desligar a flag de um tratamento DEVE: (a) re-materializar `critical_alarm`
  nas `dose_instances` futuras daquele protocolo e (b) re-sincronizar os alarmes agendados
  (espelha o re-sync v1 pós-mutação de protocolo).
- **FR-010** A ação **Soneca** do alarme DEVE persistir `dose_instances.snoozed_until` (coluna
  já existente no schema, hoje **não** usada — gap do v1: a soneca vive só no trigger local do
  Notifee, não sobrevive a restart nem é visível cross-superfície). Persistir torna o
  adiamento **durável e cross-superfície**: o re-sync do agendador respeita `snoozed_until` ao
  reagendar, e o dispatcher pode considerá-lo ao decidir a rota (não re-disparar push/alarme
  de uma dose adiada). Limpar `snoozed_until` quando a dose for resolvida (taken/skipped) ou a
  soneca esgotar. [NOTA: web/bot apenas LEEM `snoozed_until`; a escrita nasce do alarme mobile.]

---

## Success Criteria

- **SC-001** Com 2 tratamentos (A=crítico ON, B=OFF): dose de A → alarme tela cheia + sem
  push; dose de B → push normal + sem alarme. Verificável em smoke + unit do gate.
- **SC-002** Nenhuma dose dispara alarme + push simultâneos (zero duplicata por dose).
- **SC-003** iOS com entitlement aprovado: dose crítica fura o mudo físico; sem entitlement,
  fallback `timeSensitive` sem crash.
- **SC-004** Migração: 100% dos tratamentos existentes ficam com flag=OFF; nenhuma dose
  histórica/futura vira crítica sem ação do usuário.
- **SC-005** Lint 0 erros, `validate:agent` verde, smoke PO aprovado (constitution VII).
- **SC-006** Soneca persiste `dose_instances.snoozed_until`; após restart do app, o re-sync
  do agendador respeita o adiamento (não re-dispara antes de `snoozed_until`); limpo ao
  resolver a dose. Verificável em smoke + unit.

---

## Edge Cases

- Tratamento crítico **pausado/excluído** → alarmes cancelados + push volta ao normal.
- Dose de tratamento crítico **registrada via web/bot** antes do alarme → alarme cancelado
  (idempotência cross-superfície, como v1).
- Device com toggle global v1 ligado **e** tratamentos com flags mistas → comportamento
  definido por Q2 (não pode haver ambiguidade).
- Usuário liga crítico num tratamento mas **nega** a permissão de notificação no SO → sem
  alarme; UX deve guiar (R-239 ponto de intenção).
- Múltiplas doses críticas no mesmo minuto → agrupar? (v1 alarme é por-instância; push é
  1/bloco por R-191 — definir se alarme crítico agrupa ou dispara N).
- Entitlement Critical Alerts **revogado/expirado** → fallback `timeSensitive`.
- Dose com `snoozed_until` no futuro → agendador/dispatcher **não** re-disparam alarme/push
  antes de `snoozed_until`; ao atingir, dispara conforme a flag crítica. Dose resolvida
  (taken/skipped) ou soneca esgotada → `snoozed_until` limpo.

---

## Key Entities

- **Tratamento (`protocols`)** — ganha a coluna booleana de alerta crítico (intenção do
  usuário, editável). Fonte da materialização no `dose_instances`.
- **`dose_instances`** — ocorrência materializada (CON-024). Ganha `critical_alarm` (booleano,
  materializado do protocolo na geração) = **eixo por-dose** + **fonte primária do dispatcher**
  pra decidir a rota. Re-materializado ao editar a flag do protocolo (FR-009). Passa a USAR a
  coluna **`snoozed_until`** (já no schema, hoje ociosa) — escrita pela soneca do alarme (FR-010).
- **`notification_devices`** — toggle global v1 aposentado; permanece (possível rename) um
  sinal de **capacidade de alarme do device** que o dispatcher consulta antes de suprimir o
  push crítico.
- **Payload/rota de notificação** — `kind`/`metadata` (CON-019/CON-021); a **rota** é computada
  pelo dispatcher (crítico × canais × capacidade). Mudança exige ADR (constitution V).

---

## Assumptions / Open Questions

**Assumptions:**
- O agendador de alarme v1 (mobile, look-ahead 72h via dose_instances) é reusado — só muda
  o **filtro** (quais instâncias viram alarme).
- O dispatcher centralizado (R-200) é o lugar do controle de sobreposição (não L1).
- Default OFF em tudo (opt-in consciente, constitution + padrão v1).

## Clarifications (resolvidas pelo operador — 2026-06-03)

- **Q1 → A:** **Nova coluna em `protocols`** (intenção do usuário, editável) **+ nova coluna
  `critical_alarm` em `dose_instances`** materializada da flag do protocolo na geração. O
  `dose_instances` é a **fonte primária do dispatcher** (alinha Q3). Recomendação aceita:
  materializar **só o booleano crítico** por dose — a rota completa (push/telegram/web/none)
  é **computada pelo dispatcher** (bit crítico × `resolveChannelsForUser` × capacidade do
  device), nunca um enum de rota por-dose (evita drift de prefs de canal em massa).
  `dose_instances.critical_alarm` é **booleano puro** (crítica sim/não) — canais **jamais**
  moram nele. O ADR no Planning trata da **lógica de roteamento no dispatcher**, não do shape
  da coluna. Relaciona ADR-050 FP-2.

- **Q2 → A:** **Aposentar o toggle global de device** (v1 `native_alarm_enabled` como
  master-switch). Controle 100% por-tratamento. **Hint de migração de UX** pros usuários que
  tinham o global ON. Permanece (possivelmente renomeado) um sinal de **capacidade de alarme
  do device** que o dispatcher consulta antes de suprimir o push crítico (senão, device sem
  permissão perderia a notificação) — shape → ADR no Planning.

- **Q2b (permissão) → A:** O alarme local exige **só a permissão de notificação do SO**
  (+ entitlements iOS). O toggle in-app de push é camada separada (ADR-047) e **não** bloqueia
  o alarme; a UX checa a permissão do SO no ponto de intenção (R-239) ao ligar o crítico.

- **Q3 → A:** Fonte primária do dispatcher = **`dose_instances`** com a coluna `critical_alarm`
  (Q1). Gate **per-dose**: suprime o push normal só das doses críticas cobertas por alarme.

**Pendente p/ Planning (vira ADR):** lógica de roteamento no dispatcher (como cruza
`critical_alarm` booleano × canais do usuário × capacidade do device); shape do sinal de
capacidade de device pós-aposentadoria do toggle global; agrupamento de múltiplas doses
críticas no mesmo minuto (R-191). (As colunas são booleanas — sem ambiguidade de shape.)

---

## Data-Migration Scenario (Tier 2 obrigatório)

Duas colunas novas → migração obrigatória:
- `protocols.<flag>` **default false** — nenhum tratamento existente vira crítico.
- `dose_instances.critical_alarm` **default false** — nenhuma dose materializada/futura vira
  crítica retroativamente. O gerador de `dose_instances` passa a materializar a coluna a
  partir da flag do protocolo (ocorrências novas); ocorrências `pending` futuras podem ser
  backfilladas ao ligar a flag (FR-009).
- Grants + RLS conforme template (CLAUDE.md migrações). `dose_instances` tem RLS
  (`user_id=auth.uid()`) — se alguma **view** consumir a coluna nova, declarar
  `security_invoker=true` (AP-201).
- Se a materialização entrar via RPC/função, atenção ao AP-209 (overload/schema cache,
  aplicar migration ANTES de soltar o app).
- Verificação: queries confirmando 100% de `protocols.<flag>=false` e
  `dose_instances.critical_alarm=false` pós-migração.

---

## Out of Scope

- Quiet-hours / interação com modos de notificação (ADR-035 Wave N2) — fora deste épico.
- Loop do som já entregue no v1 — sem mudança. (A **soneca** muda: passa a persistir
  `snoozed_until` — FR-010.)
- Telegram/web critical (este épico é mobile-nativo + gate server).
- Aprovação do entitlement Critical Alerts pela Apple (processo externo; o código fica
  pronto pra promover com fallback).
