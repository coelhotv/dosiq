# Implementation Plan: Identity & Context Model (Caregiver Mode — Phase 0)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-0-identity-model`
**Epic**: [Modo Cuidador](../EPIC.md) · **Spec**: [spec.md](./spec.md)

---

## Technical Context

Fase de **fundação de modelagem**. Define como contas/contextos/provisionamento funcionam — pré-requisito de phase-1 (tabelas/RLS), phase-2 (setup) e phase-3 (seletor de contexto). Toca: Supabase Auth (contas anônimas), `@dosiq/core` (modelo de contexto), e o roteamento de cold-start no mobile.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ | Conta anônima sem PII; owner=paciente desde criação. |
| **R-090 (≤12 serverless)** | ✅ | Cron de descarte reusa scheduler existente; sem função nova. |
| **VI. SQP** | ✅ | Minor core + mobile + infra. |

---

## Target Files (verificar canonicamente em C1)

| Path | Purpose |
|:---|:---|
| `packages/core/src/repositories/createCaregiverRepository.js` [MOD/NEW] | `provisionPatientAccount()`, `claimPatientAccount(code, deviceUid)`, `getContexts(accountId)`. |
| `apps/mobile` cold-start router [MOD] | garantir default = auto-gestão; fork de papel só em deeplink/QR. |
| `docs/migrations/<data>_provisional_accounts.sql` (se necessário) | colunas/flags de conta provisória + índice p/ cron de descarte. |
| `server/bot/` cron [MOD] | descarte de contas provisórias + convites não reivindicados em X dias. |

> **Verificar em C1:** se Supabase **Anonymous Sign-Ins** está habilitado/possível no projeto; como o claim faz upgrade de conta anônima → plena sem perder o `uid`.

---

## Architecture / Approach

- **Provisionamento (Opção A):** `provisionPatientAccount()` cria `auth.users` anônimo → grava entidades sob esse `uid`.
- **Claim:** `claimPatientAccount(code, deviceUid)` vincula o device à conta provisória (sessão anônima no device do paciente assume o `uid`). Upgrade de auth (telefone/e-mail/social) é **posterior e opcional**.
- **Invariante owner=paciente:** o `uid` provisionado é o `uid` final → nenhuma migração no claim nem na revogação.
- **Contexto:** `getContexts()` retorna `self` + `managed[]` (de `caregiver_links`). Default ativo = `self`.

---

## R-221 SQP
- Plataformas: **Shared/Core** + **Mobile** + **Infra/Supabase**.
- SemVer: **minor**.
- Changelog `[Unreleased]` PT.
- Gates: `rtk lint` + `rtk npm run validate:agent`.
