# Tasks: Medical Observer Dashboard

**Feature Directory**: `plans/specs/012-medical-observer-dashboard`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/012-medical-observer-dashboard/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/012-medical-observer-dashboard/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Criar arquivo de migração SQL `supabase/migrations/20260601003000_observer_permissions.sql` contendo politicas RLS de leitura de medicamentos e instâncias exclusivas para `role='observer'`.
- [ ] **T002** [C1] Confirmar o mapeamento de rotas Next.js/Vite para a visualização do médico no PWA.

## Phase 2: Implementation

### Database & Core Repository
- [ ] **T003** [US1] Executar a migration e validar políticas RLS locais no Supabase.
- [ ] **T004** [US2] Codificar os métodos de consulta clínica consolidadas em `packages/core/src/repositories/doctorRepository.js` no core.

### Web Client Components (PWA)
- [ ] **T005** [US1] Desenhar a tela desktop consolidada `DoctorDashboard.jsx` contendo a listagem de pacientes vinculados.
- [ ] **T006** [US1] Construir o componente de linha `PatientRow.jsx` contendo adesão 7d, posologia ativa e chips indicadores de tendências.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` no core e na web, corrigindo warnings.
- [ ] **T008** [C4] Criar testes unitários para a busca consolidada de dados no repositório do core.
- [ ] **T009** [C4] Criar testes de integração no Supabase validando que requisições de mutação (INSERT/UPDATE/DELETE) efetuadas com `role='observer'` falham com erro de permissão negada.
- [ ] **T010** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T011** [C4] **Verificação de DoD Independente (R-060):** Confirmar que ao deletar a linha de relacionamento de chaves em `caregiver_links`, as queries subsequentes do Dr. Marcos falham de imediato no Supabase (zero cache residual).

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do monorepo core e da web (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
