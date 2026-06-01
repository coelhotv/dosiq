# Tasks: Caregiver Demand Teaser

**Feature Directory**: `plans/specs/002-caregiver-demand-teaser`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/002-caregiver-demand-teaser/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/002-caregiver-demand-teaser/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Executar a migration `rename_beta_signups_platform_to_feature.sql` no banco Supabase utilizando o editor SQL ou ferramentas MCP para adequar a tabela `beta_signups`.
- [ ] **T002** [C1] Verificar o `API_BASE_URL` ou a constante de rede no aplicativo mobile para garantir chamadas de rede absolutas.

## Phase 2: Implementation

### Mobile Nativo
- [ ] **T003** [US1] Criar o botão destacados com borda indigo `apps/mobile/src/features/profile/components/CaregiverTeaserButton.jsx`.
- [ ] **T004** [US1] Criar a bottom sheet explicativa `apps/mobile/src/features/profile/components/CaregiverTeaserSheet.jsx` contendo o `TextInput` pré-preenchido com `user.email`, tratamento de teclado (`KeyboardAvoidingView`) e disparos de serviços/analytics.
- [ ] **T005** [US1] Integrar o botão e instanciar a bottom sheet em `apps/mobile/src/features/profile/screens/ProfileScreen.jsx`.

### PWA Web
- [ ] **T006** [US2] Criar a modal centralizada `apps/web/src/shared/components/CaregiverTeaserModal.jsx` lazy-loaded (em conformidade com AP-B03).
- [ ] **T007** [US2] Integrar o botão e instanciar a modal na interface web em `apps/web/src/views/ProfileView.jsx`.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T008** [C4] Executar `rtk lint` em `apps/mobile/` e `apps/web/` e resolver qualquer erro.
- [ ] **T009** [C4] Escrever os testes unitários da bottom sheet mobile e da modal web em seus respectivos diretórios `__tests__`.
- [ ] **T010** [C4] Executar `rtk npm run validate:agent` e garantir sucesso total.
- [ ] **T011** [C4] **Verificação de DoD Independente (Mandatório):** Abrir individualmente os arquivos `ProfileScreen.jsx` e `ProfileView.jsx`, validando o import correto e o envio da variável `user.email`.
- [ ] **T012** [C4] **Smoke PO Manual:** Testar o fluxo de waitlist no mobile e no web, validando a inserção correta e sem duplicados na tabela `beta_signups` no painel Supabase.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T013** [C5] Atualizar os arquivos de versão `apps/web/package.json` e `apps/mobile/app.config.js` (`APP_VERSION`).
- [ ] **T014** [C5] Registrar a entrada descritiva em português no arquivo `CHANGELOG.md` na seção `[Unreleased]`.
- [ ] **T015** [C5] Gravar a evidência SQP R-221 nos registros de C5.
- [ ] **T016** [C5] Registrar a entrada final no journal e atualizar o `state.json` com status `'completed'`.
