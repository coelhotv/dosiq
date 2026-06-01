# Tasks: Caregiver Dashboard

**Feature Directory**: `plans/specs/011-caregiver-dashboard`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/011-caregiver-dashboard/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/011-caregiver-dashboard/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar a correta estruturação do `@dosiq/core` e mapeamento de chaves aliases para hooks SWR locais.
- [ ] **T002** [C1] Verificar se no PWA/Web as rotas para o painel de cuidador estão configuradas e prontas para receber os novos widgets.

## Phase 2: Implementation

### Shared / Core Services
- [ ] **T003** [US1] Criar os métodos de consulta parametrizada por UUID de dependente no arquivo `packages/core/src/repositories/caregiverDashboardRepository.js`.

### Mobile App components
- [ ] **T004** [US1] Desenhar o dropdown selector `PatientDropdownSelector.jsx` na barra superior (Header) do mobile nativo com área de clique mínima de 60px.
- [ ] **T005** [US1] Construir a tela agregadora `CaregiverHomeScreen.jsx` que gerencia de forma reativa a alternância do fuso e grade de alarmes do dependente selecionado.

### Web Client Components (PWA)
- [ ] **T006** [US2] Construir o painel web desktop consolidado `WebCaregiverDashboard.jsx` com cards individuais, histórico consolidado, alertas atrasados e status de saldo de estoque estimado.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T008** [C4] Criar testes unitários para a alternância parametrizada de chaves SWR no repositório do core.
- [ ] **T009** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T010** [C4] **Verificação de DoD Independente:** Confirmar que chaves SWR são isoladas por UUID e que ao alternar do perfil do pai (Seu João) para o da mãe (Dona Maria), nenhum dado do Seu João permanece no cache ou tela da Home.
- [ ] **T011** [C4] **Smoke PO Manual:** Testar no simulador móvel o clique no dropdown e verificar a velocidade de recarga dos componentes da Home (< 200ms).

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e na web (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
