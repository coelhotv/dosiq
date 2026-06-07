# Tasks: Estratégia de Ativação (Épico 026)

## Fase A: Banco de Dados & Backend Setup (DB + API)
- [ ] `T001` `[US1]` Criar migração SQL `plans/specs/026-activation-strategy/migrations/001_create_in_app_nudges.sql` para tabela `in_app_nudges` com RLS restritivo.
- [ ] `T002` `[US3]` Criar migração SQL `plans/specs/026-activation-strategy/migrations/002_create_user_email_marketing_logs.sql` para log de emails enviados.
- [ ] `T003` `[US3]` Criar helper de integração `server/utils/brevoService.js` para sincronizar contatos e atributos personalizados (`HAS_ACTIVE_TREATMENT`, `HAS_ACTIVE_PUSH_TOKEN`, `TELEGRAM_CONNECTED`) via API REST do Brevo.
- [ ] `T004` `[US3]` Integrar rotina de sincronização de contatos no Brevo em `api/notify.js` (ou `api/admin.js`) rodando no cron diário.


## Fase B: Componentes Frontend & Lógica de Nudges (Core + UI)
- [ ] `T005` `[US1]` Criar hook/serviço `useNudgeScheduler` em `packages/core/src/utils/nudgeScheduler.js` que baixa nudges, compara semver de versão de app e filtra baseando-se em data e local dismiss list.
- [ ] `T006` `[US2]` Criar componente reusable `<NudgeBanner targetView="..." />` em `@shared/components/` (integrado nos canais mobile/web).
- [ ] `T007` `[US2]` Adaptar o nudge local de timezone do perfil para ser injetado como nudge local no agendador.

## Fase C: Integração final, Testes & Documentação (UI + QA + C5)
- [ ] `T008` `[US1]` Incluir o componente `<NudgeBanner targetView="dashboard" />` na timeline principal (Dashboard/Hoje).
- [ ] `T009` `[US2]` Incluir o componente `<NudgeBanner targetView="profile" />` na tela de perfil.
- [ ] `T010` `[C4]` Escrever testes unitários para a comparação SemVer e lógica de filtragem em `useNudgeScheduler.test.js`.
- [ ] `T011` `[C4]` Rodar linter com `rtk lint` e testes com `rtk npm run test:critical` para verificar regressão zero.
- [ ] `T012` `[C5]` Criar walkthrough em `walkthrough.md` e atualizar o diário do DEVFLOW.
