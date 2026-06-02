# Feature Specification: Alarme Nativo Persistente (Mobile)

**Feature Directory**: `plans/specs/001-native-alarm-persistent`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Tier**: 1 (feature mobile coesa — sem migration/contract novos; reusa `dose_instances` + `registerDose`)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md` (Tier 1 — sem `analysis.md`/`checklists/` separados)
**Legacy Source**: `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md`
**Plataforma**: 📱 Mobile ONLY (PWA não suporta alarme persistente — limitação de browser)

---

## Context

Alarme nativo persistente é a **diferenciação de usabilidade #1** do Dosiq. Push comum é silenciado por Doze Mode (Android) e Focus/DND (iOS). Pacientes idosos multi-medicamento dependem de alerta sônico insistente em tela cheia na lock screen para registrar doses.

`@notifee/react-native` orquestra os alarmes locais, **coexistindo** com `expo-notifications` (push remoto não é removido; passa a usar `push_chime.wav`, enquanto o alarme usa `alarm_dose.wav`). Ambos os assets já existem em `apps/mobile/assets/sounds/`.

> **Pré-condição:** refactor `dose_instances` (Fase 2/4, ADR-048) concluído e mergeado — a tabela materializada é a fonte de agendamento. ✅ (concluído 2026-06).

> **Reality-check (revisão 2026-06-02):** correções obrigatórias contra o repo real, herdadas com furo da fonte:
> - **Registro de tomada NÃO é `dose_instances.update({status:'taken'})` cru.** `dose_instances` **não tem coluna `taken_at`**; a tomada é gravada criando um `medicine_log` + `consume_stock_fifo` + elo bidirecional `medicine_log_id`. **Reusar `registerDose(logData, { instanceId })`** de `apps/mobile/src/features/dose/services/doseService.js` (já faz insert→consumo→âncora→rollback). Update cru pula o decremento de estoque (viola Validar→Registrar→Decrementar do CLAUDE.md).
> - **`medicine_name` não é coluna de `dose_instances`** (só `protocol_id`). Obter via `createDoseInstanceRepository` (`@dosiq/core`) / JOIN protocols→medicines.
> - **Datas no mobile vêm de `@dosiq/core`** (`parseLocalDate`, `addDays`), **não** de `@utils/dateUtils` (o `apps/mobile/src/utils` está vazio).
> - Status válidos (CHECK): `pending|taken|missed|skipped_paused|skipped_user`. Skip do usuário = `skipped_user`.

---

## User Scenarios & Testing

### User Story 1 — Recebimento de Alarme Invasivo (P1)
**Why**: evitar esquecimento de dose por idoso.
**Independent Test**: celular bloqueado em modo silencioso/DND; agendar dose; validar que o alarme toca `alarm_dose.wav` e exibe full-screen com controles grandes na lock screen.

**Acceptance Scenarios**:
1. Given Dona Maria com o celular em silencioso/DND, When chega o horário da Losartana, Then o alarme dispara (canal `importance: HIGH`, `bypassDnd: true`), toca `alarm_dose.wav` e exibe full-screen intent com botões grandes.

### User Story 2 — Registro Rápido pelo Alarme (P1)
**Why**: evitar abrir o app inteiro só pra check-in.
**Independent Test**: tocar "Tomei" na lock screen; verificar no Supabase que foi criado um `medicine_log`, o `consume_stock_fifo` debitou estoque e o `dose_instances` ficou `status='taken'` com `medicine_log_id` preenchido.

**Acceptance Scenarios**:
1. Given o alarme full-screen, When toca em "Tomei", Then chama `registerDose(logData, { instanceId })` (cria `medicine_log` → `consume_stock_fifo` → ancora `dose_instances.status='taken'` + `medicine_log_id`), silencia o alarme, descarta a notificação e invalida os snapshots de `AsyncStorage`.
2. Given o alarme full-screen, When toca em "Pular", Then `dose_instances.status='skipped_user'` (sem log, sem consumo) e os nags pendentes são cancelados.

---

## Edge Cases

- **Android Doze Mode**: agendar com `TriggerType.TIMESTAMP` + `alarmManager: { allowWhileIdle: true }`.
- **Limite de 500 alarmes exatos (Android 12+/API 31)**: janela Look-Ahead de **72h** (≤180 alarmes mesmo em tratamento extremo); nagging agendado **reativamente** sob demanda, não preventivo.
- **Background iOS**: insistência (nag) delegada ao kernel via `notifee.createTriggerNotification`, nunca `setTimeout`/`setInterval` em JS background.
- **Critical Alerts iOS**: requer entitlement Apple (2-4 semanas). v1 usa `interruptionLevel: 'timeSensitive'` como fallback; ativação do critical alert é toggle de código quando aprovado.
- **`registerDose` falha de rede/estoque**: a função já trata rollback do log e nunca lança por estoque zerado (best-effort — o `medicine_log` é a fonte de verdade da tomada). O alarme não deve travar.

---

## Requirements

### Functional Requirements

- **FR-001**: Alarme local toca em DND (Android bypass via canal `HIGH`+`bypassDnd`; iOS `timeSensitive` fallback), som `alarm_dose.wav`.
- **FR-002**: Full-screen intent na lock screen Android com botões grandes (a11y idoso, R-137/138).
- **FR-003**: Nagging — re-agenda alarme exato +5 min se ignorado, máx 3 tentativas, **reativamente** (economiza cota de alarmes exatos).
- **FR-004**: "Tomei" registra a dose via **`registerDose(logData, { instanceId })`** (mobile `@features/dose/services/doseService`) — cria `medicine_log`, dispara `consume_stock_fifo`, ancora `dose_instances` (`status='taken'` + `medicine_log_id`). "Pular" seta `status='skipped_user'` (sem log).
- **FR-005**: Após interação, invalidar snapshots `AsyncStorage` (`@dosiq/dose-instances-snapshot`, `@dosiq/stock-snapshot`, `@dosiq/adherence-snapshot`, `@dosiq/today-snapshot`).
- **FR-006**: Agendamento por janela Look-Ahead de 72h sobre `dose_instances` `status='pending'`, lido via `createDoseInstanceRepository` (`@dosiq/core`); re-sincroniza quando protocolo é criado/editado/pausado/excluído.
- **FR-007**: Toggle on/off do alarme em `SettingsScreen.jsx` (persistido).
- **FR-008**: `expo-notifications` (push remoto) preservado e funcional, usando `push_chime.wav`.

### Key Entities

- **dose_instances** (`@dosiq/core` repository): `id`, `protocol_id`, `scheduled_for` (timestamptz), `expected_dose`, `status` (`pending|taken|missed|skipped_paused|skipped_user`), `medicine_log_id`, `tolerance_minutes`, `notified_at`, `snoozed_until`. **Sem `taken_at`** (vive em `medicine_logs`). **Sem `medicine_name`** (JOIN protocols→medicines).
- **medicine_logs**: fonte de verdade da tomada (criado por `registerDose`).

---

## Success Criteria

- **SC-001**: 100% de disparo confiável em Doze Mode (Android) e iOS inativo.
- **SC-002**: "Tomei" gera `medicine_log` + consumo de estoque + `dose_instances.status='taken'` com `medicine_log_id` — verificável no Supabase. Zero update cru de status sem log.
- **SC-003**: Zero loop de agendamento / vazamento de cota (janela 72h + nag reativo). Full-screen ≥ 55fps.

---

## Assumptions

- Builds nativas de desenvolvimento (`rtk expo run:android`/`ios`) — **Expo Go decomissionado** (incompatível com Notifee).
- Entitlement de Critical Alert iOS solicitado à Apple em paralelo; v1 entrega com fallback `timeSensitive`.
