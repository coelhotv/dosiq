# Plano Técnico: Estratégia de Ativação (Épico 026)

**Feature Directory**: `plans/specs/026-activation-strategy`
**Criado**: 2026-06-08 · **Tier**: 2 · **Status**: planned
**Fasamento**: **Fase 1 = NudgeBanner** (este sprint) · Fase 2 = Régua E-mail/Brevo (sprint futura)

---

## Clarificações (P1.5)

- **Q1 — Plataforma NudgeBanner**: Cross-platform. `useNudgeScheduler` em `packages/core/src/utils/nudgeScheduler.js`. Cada plataforma implementa seu próprio `NudgeBanner` (web em `@shared/components/ui/`, mobile em `apps/mobile/src/shared/components/ui/`).
- **Q2 — TzNudge**: Substituir. `TzNudge.jsx` (web) e `TzNudgeCard.jsx` (mobile) são removidos; o nudge de timezone vira um nudge local injetado via `useNudgeScheduler` com `id: 'tz-reconcile'`, `version: 1`, dismiss key `tz-reconcile:1`.

---

## Constitution Check

- **I (Health Data Safety)**: `in_app_nudges` não contém dados de saúde; leitura autenticada. ✅
- **II (Mobile-First Reliability)**: nudges buscados em batch único; TzNudge removal é simplificação. ✅
- **V (Contract & ADR Discipline)**: ADR-063/ADR-064 promover a `accepted` no início do C3. ✅
- **VII (Human-Controlled Delivery)**: merge sempre pelo PO. ✅

---

## Sumário Técnico

### Camada 1 — DB (Supabase)
Duas novas tabelas: `in_app_nudges` (admin-managed nudges remotos) e `user_email_marketing_logs` (dedup de envio de e-mail).

### Camada 2 — Backend (servidor)
- `server/utils/brevoService.js`: helper REST Brevo (sincronizar atributos de contato).
- `api/notify.js`: recebe nova rotina `syncBrevoContacts` no cron diário — **não cria novo arquivo** (R-090 budget 10/12 → OK).

### Camada 3 — Core (packages/core)
- `packages/core/src/utils/nudgeScheduler.js`: lógica pura (SemVer compare, filtro por plataforma/datas/dismiss, prioridade). Exporta `buildNudgeList(remoteNudges, localNudges, opts)`.
- `packages/core/src/utils/semver.js`: `compareSemver(a, b)` e `satisfiesSemver(version, min, max)` — puro, sem deps.
- Storage injetado via `opts.storage` (`{ getItem, setItem }`) → web usa `localStorage`, mobile usa `AsyncStorage` wrapper.

### Camada 4 — UI Web
- `apps/web/src/shared/components/ui/NudgeBanner.jsx` + `NudgeBanner.css`
- `apps/web/src/features/profile/hooks/useNudges.js`: busca `in_app_nudges` + injeta nudge local TzReconcile; chama `buildNudgeList`.
- `apps/web/src/views/redesign/DashboardColumnLeft.jsx`: `<NudgeBanner targetView="dashboard" />` no slot `else` de `urgentDoses.length > 0`.
- `apps/web/src/views/redesign/Profile.jsx`: substituir `TzNudge` por `<NudgeBanner targetView="profile" />`.
- Remover `apps/web/src/views/redesign/profile/TzNudge.jsx` + CSS associado.

### Camada 5 — UI Mobile
- `apps/mobile/src/shared/components/ui/NudgeBanner.jsx` (RN).
- `apps/mobile/src/features/profile/hooks/useNudges.js`: mesmo padrão web, AsyncStorage.
- `apps/mobile/src/features/dashboard/screens/TodayScreen.jsx`: nudge no slot quando sem doses.
- `apps/mobile/src/features/profile/screens/ProfileScreen.jsx`: substituir `TzNudgeCard` por `NudgeBanner`.
- Remover `apps/mobile/src/features/profile/components/TzNudgeCard.jsx`.

---

## Arquivos-alvo (Target Files)

| # | Arquivo | Ação | Plataforma |
|---|---------|------|------------|
| 1 | `plans/specs/026-activation-strategy/migrations/001_create_in_app_nudges.sql` | criar | DB |
| 2 | `plans/specs/026-activation-strategy/migrations/002_create_user_email_marketing_logs.sql` | criar | DB |
| 3 | `server/utils/brevoService.js` | criar | Backend |
| 4 | `api/notify.js` | editar (+syncBrevoContacts) | Backend |
| 5 | `packages/core/src/utils/semver.js` | criar | Core |
| 6 | `packages/core/src/utils/nudgeScheduler.js` | criar | Core |
| 7 | `packages/core/src/utils/index.js` | editar (re-export) | Core |
| 8 | `apps/web/src/shared/components/ui/NudgeBanner.jsx` | criar | Web |
| 9 | `apps/web/src/shared/components/ui/NudgeBanner.css` | criar | Web |
| 10 | `apps/web/src/features/profile/hooks/useNudges.js` | criar | Web |
| 11 | `apps/web/src/views/redesign/DashboardColumnLeft.jsx` | editar | Web |
| 12 | `apps/web/src/views/redesign/Profile.jsx` | editar (remove TzNudge, add NudgeBanner) | Web |
| 13 | `apps/web/src/views/redesign/profile/TzNudge.jsx` | remover | Web |
| 14 | `apps/web/src/views/redesign/profile/ProfileRedesign.css` | editar (remover `.ph-tz-nudge*`) | Web |
| 15 | `apps/mobile/src/shared/components/ui/NudgeBanner.jsx` | criar | Mobile |
| 16 | `apps/mobile/src/features/profile/hooks/useNudges.js` | criar | Mobile |
| 17 | `apps/mobile/src/features/dashboard/screens/TodayScreen.jsx` | editar | Mobile |
| 18 | `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` | editar (remove TzNudgeCard, add NudgeBanner) | Mobile |
| 19 | `apps/mobile/src/features/profile/components/TzNudgeCard.jsx` | remover | Mobile |
| 20 | `packages/core/src/utils/__tests__/nudgeScheduler.test.js` | criar | Core |
| 21 | `packages/core/src/utils/__tests__/semver.test.js` | criar | Core |

---

## Contratos & ADRs

- **ADR-063** (Brevo cron diário): promover `proposed → accepted` em C3.
- **ADR-064** (dismiss `nudge_id:version`): promover `proposed → accepted` em C3.
- **Sem CON-NNN novos**: `useNudgeScheduler` é utilitário core interno; `NudgeBanner` é componente de UI sem interface cross-package nova.

---

## Riscos

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| TzNudge DISMISS_KEY legado (`dosiq_tz_nudge_dismissed`) ≠ novo formato `tz-reconcile:1` — usuário que dispensou vê de novo | MEDIUM | Migrar no `useNudges.js`: se `dosiq_tz_nudge_dismissed === '1'` → pré-setar `tz-reconcile:1` no novo formato. |
| `api/notify.js` timeout 60s + Brevo sync em lote pode exceder | MEDIUM | `brevoService.js` com timeout 30s + max 100 contatos por chamada; log e continua. |
| Mobile: `AsyncStorage.getItem` assíncrono → flash de nudge no mount | LOW | `visible` começa `false`; setar `true` só após verificação (padrão `TzNudgeCard` já adotado). |
| `in_app_nudges` sem index em `target_view` → scan completo em escala | LOW | Adicionar `CREATE INDEX` na migration. |
| R-090: budget `api/` não exceder 12 | LOW | Não criar novo `.js`; rotina Brevo vai em `notify.js`. Confirmar count antes de C3. |

---

## Sequência C3 (Fase 1 — NudgeBanner) — Mobile-First

> **Rationale**: nudges de versão de app e ativação de push têm impacto quase exclusivo em iOS/Android.
> Mobile valida onde dói; web é extensão futura se houver valor.

```
C3.1  Migration in_app_nudges (T001 + T001b) — apply via MCP supabase
C3.2  packages/core: semver.js + nudgeScheduler.js (T005 + T006 + T006b)
C3.3  TzNudge → nudge local (T007 — constante + migração dismiss key AsyncStorage)
C3.4  Mobile: NudgeBanner.jsx + useNudges.js (T008m + T009m)
C3.5  Mobile: integrar TodayScreen + Profile; remover TzNudgeCard (T010m + T011m + T012m)
C3.6  Web: NudgeBanner.jsx + useNudges.js (T008w + T009w)   ← se validado no mobile
C3.7  Web: integrar Dashboard + Profile; remover TzNudge (T010w + T011w + T012w)
C3.8  Testes unitários core (T013 + T014) + validate:agent (T015)
C3.9  C5: ADRs → accepted; journal; state.json (T016)
```

> C3.6–C3.7 (web) são opcionais neste sprint. Mobile entregue e validado pelo PO já fecha a Fase 1.
> Fase 2 (Brevo/e-mail): sprint futura. Tasks catalogadas em tasks.md mas não implementadas aqui.

---

## Gates C4

```bash
rtk npm run test:critical          # core + web utils
rtk npm run validate:agent         # lint + vitest (kill switch 600s)
rtk find api -name "*.js" -not -path "*/_*" -not -path "*/.*" | wc -l   # ≤ 12
```

SQP: Web **patch** (v4.0.1 → novo componente, sem breaking); Mobile **minor** (v0.3.4 → remove TzNudgeCard, comportamento novo no hub).
