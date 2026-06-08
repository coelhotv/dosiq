# Tasks: Estratégia de Ativação (Épico 026)

> **Fasamento**: Fase 1 = NudgeBanner (este sprint) · Fase 2 = Régua E-mail/Brevo (sprint futura).
> **Ordem**: Mobile-first — nudges de versão/push têm impacto quase exclusivo em iOS/Android.
> Web (1C) é extensão opcional; mobile entregue e validado já fecha a Fase 1.

---

## Fase 1A: Banco de Dados — Nudges (DB)

- [ ] `T001` `[US1]` Criar migração SQL `plans/specs/026-activation-strategy/migrations/001_create_in_app_nudges.sql` para tabela `in_app_nudges` com RLS (leitura authenticated, escrita service_role), index em `target_view`, grants obrigatórios.
- [ ] `T001b` Aplicar migration no Supabase (MCP `apply_migration`).

## Fase 1B: Core — Lógica Pura (packages/core)

- [ ] `T005` `[US1]` Criar `packages/core/src/utils/semver.js` — `compareSemver(a,b)` e `satisfiesSemver(version,min,max)` puros.
- [ ] `T006` `[US1]` Criar `packages/core/src/utils/nudgeScheduler.js` — `buildNudgeList(remoteNudges, localNudges, opts)`: filtro por plataforma/datas/versão, dismiss via `opts.storage`, priorização.
- [ ] `T006b` Adicionar re-exports em `packages/core/src/utils/index.js`.
- [ ] `T007` `[US2]` Criar constante `TZ_RECONCILE_NUDGE` em `nudgeScheduler.js` (`id:'tz-reconcile', version:1`); documentar migração de dismiss key legada (`dosiq_tz_nudge_dismissed → tz-reconcile:1`) para aplicar em `useNudges.js` de cada plataforma.

## Fase 1C: UI Mobile ⭐ (prioridade — valida onde dói)

- [ ] `T008m` `[US2]` Criar `apps/mobile/src/shared/components/ui/NudgeBanner.jsx` (React Native).
- [ ] `T009m` Criar `apps/mobile/src/features/profile/hooks/useNudges.js` — busca `in_app_nudges` Supabase, injeta nudge local TzReconcile, migra dismiss key legada, `AsyncStorage` como storage.
- [ ] `T010m` `[US1]` Integrar `<NudgeBanner targetView="dashboard" />` em `apps/mobile/src/features/dashboard/screens/TodayScreen.jsx` (slot quando sem doses urgentes).
- [ ] `T011m` `[US2]` Integrar `<NudgeBanner targetView="profile" />` em `apps/mobile/src/features/profile/screens/ProfileScreen.jsx`, substituindo `TzNudgeCard`.
- [ ] `T012m` Remover `apps/mobile/src/features/profile/components/TzNudgeCard.jsx`.

## Fase 1D: UI Web (opcional neste sprint — após validação mobile)

- [ ] `T008w` `[US2]` Criar `apps/web/src/shared/components/ui/NudgeBanner.jsx` + `NudgeBanner.css`.
- [ ] `T009w` Criar `apps/web/src/features/profile/hooks/useNudges.js` — mesmo padrão mobile, `localStorage` como storage.
- [ ] `T010w` `[US1]` Integrar `<NudgeBanner targetView="dashboard" />` em `apps/web/src/views/redesign/DashboardColumnLeft.jsx` (slot `else` de `urgentDoses.length > 0`).
- [ ] `T011w` `[US2]` Integrar `<NudgeBanner targetView="profile" />` em `apps/web/src/views/redesign/Profile.jsx`, substituindo `TzNudge`.
- [ ] `T012w` Remover `apps/web/src/views/redesign/profile/TzNudge.jsx` e limpar `.ph-tz-nudge*` de `ProfileRedesign.css`.

## Fase 1E: Testes & C5

- [ ] `T013` `[C4]` Criar `packages/core/src/utils/__tests__/semver.test.js`.
- [ ] `T014` `[C4]` Criar `packages/core/src/utils/__tests__/nudgeScheduler.test.js`.
- [ ] `T015` `[C4]` Rodar `rtk npm run validate:agent` — regressão zero.
- [ ] `T016` `[C5]` Promover ADR-063 e ADR-064 para `accepted`. Atualizar DEVFLOW (journal, state.json, CHANGELOG.md).

---

## Fase 2 (Sprint Futura) — Régua de E-mail/Brevo

> **Não implementar neste sprint.**

- `T-F2A` Criar migration `002_create_user_email_marketing_logs.sql`.
- `T-F2B` Criar `server/utils/brevoService.js` (REST Brevo).
- `T-F2C` Integrar `syncBrevoContacts` em `api/notify.js`.
- `T-F2D` Testar fluxos de régua (boas-vindas D+1, tratamento órfão, versão).
