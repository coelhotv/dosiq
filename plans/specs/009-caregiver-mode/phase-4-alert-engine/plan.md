# Implementation Plan: Alert Engine (Caregiver Mode — Phase 4)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-4-alert-engine`
**Epic**: [Modo Cuidador](../EPIC.md) · **Spec**: [spec.md](./spec.md)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/DRAFT_CAREGIVER_MODE.md` §Tabela de Eventos · §Motor
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §3

---

## Technical Context

Engine de detecção + disparo no backend. **Sem novo endpoint serverless** (R-090): consome o cron existente de notificações/estoque (`server/bot/` tasks + scheduler) e as `dose_instances` materializadas. Resolve o cuidador-alvo via `caregiver_links` (JOIN por `patient_id` = `user_id` do paciente) e o canal via `notification_channel`.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ | Só dados do paciente vinculado; canal `none` respeitado. |
| **IV. Timezone Correctness** | ✅ | Delays no fuso do paciente (`user_settings.timezone`), `parseLocalDate`/core. |
| **R-090 (≤12 serverless)** | ✅ | Reusa cron existente; **zero função nova**. |
| **VI. SQP** | ✅ | Minor backend/core. |

---

## Target Files (a verificar canonicamente em C1)

| Path | Purpose |
|:---|:---|
| `server/bot/` (scheduler/tasks existentes) [MOD] | adicionar avaliação de eventos do cuidador ao tick de cron existente. |
| `server/bot/_adherenceHelpers.js` [MOD] | reusar cálculo de adesão/atraso (não duplicar). |
| `packages/core/src/repositories/createCaregiverRepository.js` [MOD/NEW] | `getCaregiversToNotify(patientId, event)` + resolução de canal. |
| `apps/web` / `apps/mobile` Configurações [MOD] | UI de escolha do `notification_channel` pelo cuidador. |
| `docs/migrations/<data>_caregiver_channel_enum.sql` (se mudar enum) | ajustar CHECK de `notification_channel` (ver Open Question). |

> **Verificar em C1:** path real do scheduler de cron; estrutura do `notification_log` para reusar como marca de idempotência; se `dose_instances.notified_at` já serve.

---

## Architecture / Approach

- **Idempotência:** antes de disparar, checar flag de envio (NotificationLog ou `dose_instances.notified_at`); marcar após enviar. Nunca reenviar por tick.
- **Abstração de canal:** reusar `INotificationChannel` do bot (push/telegram/email). WhatsApp = adapter plugável da Fase 7B — não implementar aqui.
- **Push-first:** alerta ao cuidador só após esgotar tolerância do paciente (não competir com alarme nativo da spec 001).

---

## R-221 SQP

- Plataformas: **Backend/Infra** + **Shared/Core**.
- SemVer: **minor**.
- Changelog `[Unreleased]` PT.
- Gates: `rtk lint` + `rtk npm run validate:agent`.
