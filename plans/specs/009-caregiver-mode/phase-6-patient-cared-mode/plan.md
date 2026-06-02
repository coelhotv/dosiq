# Implementation Plan: Patient Cared Mode & Upstream Signals (Caregiver Mode — Phase 6)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-6-patient-cared-mode`
**Epic**: [Modo Cuidador](../EPIC.md) · **Spec**: [spec.md](./spec.md)

---

## Technical Context

UI simplificada no mobile (modo cuidado) + canal de sinais upstream paciente→cuidador. Reusa o transporte de notificação da phase-4 (direção inversa) e o `registerDose` canônico. Modo cuidado é ativado pela presença de `caregiver_links manager` para o `user_id` do device (contexto da phase-0).

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ | Sinais informativos, não destrutivos; só entre vínculo ativo. |
| **II. Mobile-First / Acessibilidade** | ✅ | AAA: ≥7:1, toque ≥60px, ≤2 toques. |
| **IV. Timezone Correctness** | ✅ | Registro retroativo via `@dosiq/core` (parseLocalDate). |
| **R-090** | ✅ | Transporte reusa phase-4; sem função serverless nova. |

---

## Target Files (verificar em C1)

| Path | Purpose |
|:---|:---|
| `apps/mobile/src/features/dose/` (Home cuidado) [MOD/NEW] | modo cuidado: agenda + "Tomei" + atalhos de sinal; oculta edição. |
| `apps/mobile/src/features/.../PatientSignalSheet.jsx` [NEW] | sheet de sinais (estoque acabando / perdi / não consegui). |
| `packages/core/src/repositories/createCaregiverRepository.js` [MOD] | `sendPatientSignal(type, payload)` + fila offline. |
| `docs/migrations/<data>_patient_signals.sql` (se tabela própria) | conforme Open Question. |

> **Verificar em C1:** estrutura de `notification_log` para reuso bidirecional; como o app detecta "modo cuidado" (contexto da phase-0).

---

## Architecture / Approach

- **Ativação do modo:** se `getContexts()` (phase-0) indica que o `user_id` do device tem `caregiver_links manager` → renderiza Home cuidado simplificada.
- **Sinais:** `sendPatientSignal()` grava + dispara via transporte da phase-4 ao cuidador-alvo. Fila offline em AsyncStorage; sync ao reconectar.
- **Não-destrutivo:** sinais são informativos; ajuste de estoque efetivo é ação do cuidador (não da Maria).

---

## R-221 SQP
- Plataformas: **Mobile** + **Shared/Core** (+DB se tabela própria).
- SemVer: **minor**.
- Changelog `[Unreleased]` PT + store-note (mobile).
- Gates: `rtk lint` + `rtk npm run validate:agent`.
