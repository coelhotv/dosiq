# Feature Specification: Snooze de Dose no Telegram

**Feature Directory**: `plans/specs/021-telegram-snooze-dose`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: specified — não iniciado
**Tier**: 1 (feature coesa Telegram-only; **sem migração** — reusa colunas existentes; sem contrato/ADR novo)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Source**: `plans/backlog-notifications/EXEC_SPEC_SNOOZE_DOSE.md`

---

## Context

O alerta de dose individual do bot oferece `✅ Tomar` e `⏭️ Pular`. O `⏰ Adiar` (Snooze) foi removido por falta de backend. Com `dose_instances` (ADR-048) tz-aware em produção, o Snooze atualiza diretamente `dose_instances.snoozed_until` — sem tabela de jobs paralela. Opções fixas 15/30/60 min, respeitando a janela clínica de 2h (`tolerance`) ancorada em `scheduled_for`.

> **Reality-check (revisão 2026-06-02) — correções contra o repo real:**
> - **`dose_instances` já tem `snoozed_until timestamptz` + `notified_at timestamptz`** (`docs/migrations/20260528_create_dose_instances.sql`). **Sem migração.**
> - **Não existe `packages/core/schemas/actionSchema.js`.** As ações são definidas **inline**: `buildNotificationPayload.js:183-184` (`{id:'take'}`, `{id:'skip'}`) e codificadas em `telegramChannel.js:19-22` (`take_:`, `skip_:`, `takeplan:`). O snooze adiciona `{id:'snooze'}` na array de ações + `case 'snooze'` no encode. Não criar `actionSchema.js`.
> - **Timezone é por usuário** (F4.3 multi-tz, já entregue): ler `user_settings.timezone` via `notificationPreferenceRepository` (`:84`, default `'America/Sao_Paulo'` como fallback). **Não cravar `America/Sao_Paulo`** nas confirmações — usar o tz do usuário.
> - Cron real em `api/notify.js`: blocos `withCorrelation((ctx)=>fn, { correlationId, jobType })` (jobTypes `reminders`/`daily_digest`/`daily_adherence_report`). O runner de snooze é mais um bloco (`jobType: 'snooze_reminders'`).

---

## User Scenarios & Testing

### User Story 1 — Solicitar Adiamento (P1)
**Why**: flexibilidade quando o paciente não pode tomar no instante exato.
**Independent Test**: disparar alerta de dose; clicar `⏰ Adiar`; ver o teclado inline ser editado com `⏰ 15 min`, `⏰ 30 min`, `⏰ 1 hora` (só as opções ainda válidas na janela de 2h).

**Acceptance Scenarios**:
1. Given alerta de dose individual, When clica `⏰ Adiar`, Then o bot limpa o teclado e exibe as opções válidas (`now + min < scheduled_for + 120min`).

### User Story 2 — Executar o Snooze (P1)
**Why**: persistência e re-alerta corretos no fuso do usuário.
**Independent Test**: selecionar `⏰ 30 min`; ver a mensagem editada com confirmação no **fuso do usuário** e `dose_instances.snoozed_until = now() + 30min`.

**Acceptance Scenarios**:
1. Given as opções visíveis, When clica `⏰ 30 min`, Then persiste `snoozed_until` e edita a mensagem: *"⏰ Lembrete adiado! Vou te lembrar novamente às HH:MM."* (HH:MM no `user_settings.timezone`).

### User Story 3 — Inelegibilidade por Alta Frequência (P2)
**Why**: evitar confusão/sobredosagem se as doses são muito próximas.
**Independent Test**: protocolo com doses a cada 1h; clicar `⏰ Adiar`; bot bloqueia com pop-up explicativo.

**Acceptance Scenarios**:
1. Given protocolo com gap mínimo entre doses adjacentes ≤ 2h, When clica `⏰ Adiar`, Then pop-up: *"Este protocolo tem doses muito próximas. Adiar poderia causar confusão com a próxima dose."*.

---

## Edge Cases

- **Opção expira durante a seleção**: se o re-alerta ultrapassar `scheduled_for + 120min`, recusar no clique com pop-up *"Esta opção não está mais disponível. A janela de 2h está se encerrando."*.
- **Adiar dose já adiada**: permitido enquanto o novo `snoozed_until` ≤ `scheduled_for + 120min` (âncora fixa = `scheduled_for`).
- **Protocolo inativado após o snooze**: o cron, ao não achar protocolo ativo, marca a instância como descartada e não dispara mensagem.
- **Concorrência com tomada manual**: tomar no app vira `status='taken'`; o cron busca só `status='pending'` → re-alerta pendente é anulado automaticamente.

---

## Requirements

### Functional Requirements

- **FR-001**: O snooze controla re-alertas via `dose_instances.snoozed_until` (sem tabela de jobs paralela).
- **FR-002**: Botão `⏰ Adiar` no alerta individual, entre `✅ Tomar` e `⏭️ Pular` (inline, linha única) — adicionando `{id:'snooze'}` em `buildNotificationPayload.js`.
- **FR-003**: Ao clicar `⏰ Adiar`, calcular opções (15/30/60) cujo `now + min < scheduled_for + 120min`.
- **FR-004**: Elegibilidade revogada se o menor gap entre doses adjacentes do protocolo (incl. gap circular fim-do-dia→manhã) ≤ 2h. Dose única = sempre elegível.
- **FR-005**: Callbacks curtos (<64 bytes): `snooze_:${doseInstanceId}` e `snooze_pick:${minutes}:${doseInstanceId}` — codificados em `telegramChannel.js` (`case 'snooze'`), não em `actionSchema.js` (inexistente).
- **FR-006**: Runner a cada minuto (`api/notify.js`, bloco `withCorrelation` `jobType:'snooze_reminders'`) busca `dose_instances` com `snoozed_until <= now() AND status='pending' AND notified_at IS NOT NULL`, re-alerta via dispatcher, e seta `snoozed_until = null` + `notified_at = now()`.
- **FR-007**: Re-alertas decorados: `⏰ ` no título + linha *"Lembrete adiado (original: HH:MM)"* (HH:MM no tz do usuário).

### Key Entities

- **dose_instances**: campos `snoozed_until`, `notified_at`, `scheduled_for` (âncora da janela), `status`.

---

## Success Criteria

- **SC-001**: `⏰ Adiar` em linha única sem quebrar o layout.
- **SC-002**: Re-alerta no minuto configurado, decorado, marcando a instância após envio.
- **SC-003**: 100% de conformidade com a janela de 2h e com o **fuso do usuário** (`user_settings.timezone`) nas confirmações — não hardcode SP.

---

## Assumptions

- Cron a cada minuto ativo acionando `api/notify.js`.
- Chat Telegram vinculado (`user_settings.telegram_chat_id`).
