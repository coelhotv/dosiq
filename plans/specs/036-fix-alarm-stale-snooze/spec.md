# Spec 036 — Fix: alarme de soneca dispara obsoleto após dose resolvida por outra superfície

**Feature Directory:** `plans/specs/036-fix-alarm-stale-snooze`
**Created:** 2026-06-17
**Status:** specified
**Tier:** 1 (Standard — bug de produção, mobile-only, ~3 arquivos, sem migração/ADR/contrato novo)
**Input:** Relato PO: (1) com alarme crítico, soneca + dose marcada tomada por outra via antes do
re-disparo → alarme full-screen reabre numa dose já resolvida, sem saída; (2) a full-screen não
mostra **concentração** nem **quantidade a tomar** → risco clínico (dona Maria toma o remédio/dose
errados).

---

## Context

Bug de produção (0.19.0, presente desde a soneca v1 / spec 001; a 025 fechou só metade).

Fluxo do bug:
1. Alarme crítico dispara. Usuário toca **Soneca 5 min** → `scheduleSnooze` agenda um Notifee
   trigger +5min com `id = doseInstanceId` ([alarmService.js:401-454](../../../apps/mobile/src/platform/alarms/alarmService.js)) e persiste `snoozed_until` (025).
2. Antes do re-disparo, o usuário marca a dose **tomada por outra superfície** (FAB/timeline do
   app via `registerDose`/`registerDoseMany`, web ou bot) → `status='taken'`.
3. **Nada cancela o trigger +5min já agendado.** `registerDose`/`registerDoseMany`
   ([doseService.js:321,416](../../../apps/mobile/src/features/dose/services/doseService.js)) **não** chamam `cancelAlarm` nem emitem `triggerAlarmResync`
   (esse só é emitido em mutação de tratamento — [useProtocolMutation.js:22](../../../apps/mobile/src/features/treatments/hooks/useProtocolMutation.js)). `syncAlarms` só re-roda em
   `AppState→active`, mutação de protocolo, ou mudança de `userId/tz/protocols` — **não** no
   registro de dose. `snoozed_until` persistido só evita **re-agendar** num próximo sync; não
   cancela o trigger já colocado.
4. O trigger dispara → `AlarmFullScreen` abre numa dose já `taken`. A tela **não revalida status**
   ([AlarmFullScreen.jsx](../../../apps/mobile/src/features/dose/screens/AlarmFullScreen.jsx)) e exige Tomei/Soneca/Pular pra fechar → double-count no Tomei,
   re-snooze, ou corromper `taken`→`skipped_user`.

**Causa raiz:** falta idempotência cross-superfície do alarme — (a) nenhuma resolução fora dos
botões do alarme cancela o trigger; (b) a full-screen não se auto-dismissa pra dose já resolvida.

---

## User Stories

### US1 — Resolver a dose por qualquer via cancela o alarme/soneca (P1)
Como usuário, quando marco a dose tomada/pulada por **qualquer** superfície, quero que o alarme
(incl. soneca/nag pendentes) **pare**, pra não reabrir numa dose já resolvida.

**Acceptance:**
- **Given** uma dose com soneca/nag pendente, **When** registro a tomada pelo FAB/timeline do app
  (`registerDose`/`registerDoseMany`), **Then** o trigger pendente daquela `instanceId` é
  **cancelado** (`cancelAlarm`), e o full-screen **não** reabre.
- **Given** registro em lote, **When** resolvo N doses, **Then** o alarme de **cada** `instanceId`
  resolvida é cancelado.

### US2 — Full-screen auto-dismiss em dose já resolvida (P1)
Como usuário, se o alarme full-screen abrir numa dose que **não está mais pendente** (resolvida
por outra via, web/bot, ou corrida), quero que ele **feche sozinho** sem me forçar a uma ação.

**Acceptance:**
- **Given** o `AlarmFullScreen` montando para uma `instanceId` cujo `status ≠ pending`, **When**
  a tela revalida o status no mount/focus, **Then** chama `cancelAlarm` e **fecha**
  (`goBack`/TABS), sem exigir Tomei/Soneca/Pular.
- **Given** `status = pending`, **When** revalida, **Then** a tela funciona normalmente.

---

### US3 — Transparência clínica total na full-screen (P1 — risco clínico)
Como paciente idoso (dona Maria), preciso ver **qual concentração** e **quanto** tomar agora, pra
não tomar o remédio/dose errados.

**Acceptance:**
- **Given** o alarme full-screen de uma dose, **When** abre, **Then** mostra (além do nome +
  horário): a **concentração do medicamento** (ex.: "Selozok 25 mg", "Lantus 100 UI/mL") e a
  **quantidade a tomar** (ex.: "2 un.", "10 UI", "5 mL").
- **Given** medicamento **líquido/injetável** (012), **When** abre, **Then** a unidade exibida é a
  correta do tipo (UI/mL/gotas), **nunca** "un." fixo.
- **Given** dose **agrupada**, **When** abre, **Then** cada linha mostra nome + concentração +
  quantidade pela mesma regra (sem "un." hardcoded).

## Functional Requirements

- **FR-001** `registerDose` (mobile) DEVE, após resolução bem-sucedida (`taken`), chamar
  `alarmService.cancelAlarm(instanceId)` para a `instanceId` resolvida (best-effort, não bloqueia
  o registro nem o estoque — R-245/246).
- **FR-002** `registerDoseMany` DEVE cancelar o alarme de **cada** `instanceId` resolvida no lote.
- **FR-003** O cancelamento DEVE cobrir o trigger principal **e** os triggers de nag/soneca
  derivados (já coberto por `cancelAlarm`, que limpa `:nag:N` e reusa o id da soneca).
- **FR-004** `AlarmFullScreen` DEVE revalidar o `status` da(s) `instanceId`(s) no mount/focus; se
  **nenhuma** estiver `pending` → `cancelAlarm` + auto-dismiss. Para grupos, dismiss só quando
  **todas** as instâncias do grupo não estão mais `pending`.
- **FR-005** Sem regressão: os caminhos dos botões do alarme (Tomei/Pular já chamam `cancelAlarm`,
  [quickDoseRegistration.js:41,93](../../../apps/mobile/src/platform/alarms/quickDoseRegistration.js)) seguem idempotentes (cancelar 2× é no-op).
- **FR-006** `AlarmFullScreen` (ramo single) DEVE exibir a **concentração** via core
  `formatMedicineConcentration` ([doseUnit.js:61](../../../packages/core/src/utils/doseUnit.js)) e a **quantidade a tomar** via core
  `formatDoseItem` ([doseUnit.js:346](../../../packages/core/src/utils/doseUnit.js)) — reuso, não reinventar (R-231).
- **FR-007** O ramo **agrupado** DEVE trocar o `({dosagePerPill}{dosageUnit}) - {qty} un.`
  hardcoded ([AlarmFullScreen.jsx:102-103](../../../apps/mobile/src/features/dose/screens/AlarmFullScreen.jsx)) pelos mesmos formatters core (corrige unidade errada p/
  líquido/injetável — bug latente da 012).
- **FR-008** Os campos necessários DEVEM ser plumbados ponta-a-ponta até a tela: `scheduleAlarm`
  data (single + `groupedDoses`) e os params de `openAlarmScreen` ([AlarmSchedulerBridge.jsx:43-57](../../../apps/mobile/src/platform/alarms/AlarmSchedulerBridge.jsx))
  ganham `dosagePerPill`, `dosageUnit`, `concentrationVolumeMl`, `dosagePerIntake`, `intakeUnit`,
  `unitsPerMl` (origem: `buildDoseItemsFromInstances`, [doseZones.js:139-155](../../../packages/core/src/utils/doseZones.js)).

---

## Success Criteria

- **SC-001** Soneca → marcar tomada no FAB/timeline (mesma sessão, sem background) → o full-screen
  **não** reabre em +5min. Smoke no device.
- **SC-002** Full-screen aberto numa dose já resolvida (forçar via DevHub / resolver no web) →
  **fecha sozinho**, sem ação. Smoke.
- **SC-003** Registro em lote resolve N doses → nenhum alarme remanescente. Smoke.
- **SC-004** Sem double-count nem `taken→skipped_user`: dose resolvida não muda de status por
  alarme obsoleto.
- **SC-005** `rtk lint` 0 erros + jest mobile (doseService/AlarmFullScreen) verdes + smoke PO.
- **SC-006** Full-screen (single + grupo) mostra concentração + quantidade corretas: sólido "N un./
  N mg", líquido/injetável "N UI/mL/gotas" (nunca "un." fixo). Smoke com 1 sólido (Selozok) + 1
  injetável (Lantus/UI).

---

## Assumptions / Open Questions

- `cancelAlarm(instanceId)` já cancela trigger principal + nags ([alarmService.js:343-350](../../../apps/mobile/src/platform/alarms/alarmService.js)); a soneca
  reusa o id da instância → coberta.
- Resolução via **web/bot** não roda código no device; o cancelamento nessas vias depende do
  `syncAlarms` no próximo `AppState→active` (já existe) **+** o auto-dismiss da FR-004 como rede
  pra corrida — suficiente pro hotfix (não exige push de invalidação cross-device).
- `AlarmFullScreen` tem acesso à `instanceId`/`doseInstanceIds` via params (route) — revalida
  status lendo `dose_instances` (repo core `getWindow`/leitura pontual por id).
- Mobile-only; sem migração, sem ADR, sem contrato novo. Snooze cap/`snoozed_until` intactos.

## Out of Scope

- Unificação web↔mobile do registro no core → **spec 035** (`unified-dose-log-stock-core`); este
  hotfix entra direto no `doseService` mobile, e a 035 depois absorve o hook.
- Invalidação cross-device por push (resolver no web cancelar alarme no celular em tempo real) —
  desnecessário; `AppState→active` + auto-dismiss cobrem.
