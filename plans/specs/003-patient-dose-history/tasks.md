# Tasks: Patient Dose History

**Feature Directory**: `plans/specs/003-patient-dose-history`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/003-patient-dose-history/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/003-patient-dose-history/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar a integração do pacote `@dosiq/core` no mobile e verificar se chaves aliases estão ativas no `tsconfig.json`/`babel.config.js`.
- [ ] **T002** [C1] Verificar se a branch base está sincronizada com a reta final da Fase 4 do refactor de `dose_instances`.

## Phase 2: Implementation

### Core / Repositories
- [ ] **T003** [US1] Adicionar métodos de busca por range de datas e mutação (taken/missed/pending) de `dose_instances` em `packages/core/src/repositories/doseInstanceRepository.js` de acordo com a R-021.

### Mobile UI Components
- [ ] **T004** [US1] Criar o componente de calendário expansível horizontal `apps/mobile/src/features/history/components/AdherenceCalendar.jsx` com botões acessíveis de área ≥ 60px.
- [ ] **T005** [US1] Criar a lista cronológica virtualizada `apps/mobile/src/features/history/components/DoseHistoryList.jsx` baseada em `FlatList` nativo para garantir performance fluida.
- [ ] **T006** [US1] Criar a bottom sheet nativa de ações retroativas e exclusão `apps/mobile/src/features/history/components/DoseActionSheet.jsx`.
- [ ] **T007** [US1] Integrar os componentes na tela principal `apps/mobile/src/features/history/screens/HistoryScreen.jsx` utilizando o hook de SWR queries locais.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T008** [C4] Executar `rtk lint` em `packages/core` e `apps/mobile/` e corrigir warnings.
- [ ] **T009** [C4] Escrever testes unitários para a lógica do repositório core e para os hooks de histórico do mobile nativo.
- [ ] **T010** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T011** [C4] **Verificação de DoD Independente (Mandatório):** Abrir `DoseActionSheet.jsx`, localizando e citando os trechos exatos de código que efetuam o descarte ou a gravação retroativa do status no Supabase e que invalidam o cache SWR.
- [ ] **T012** [C4] **Smoke PO Manual:** Testar no simulador móvel o fluxo de clique no dia anterior, registro retroativo de Losartana e verificação da atualização imediata do layout do dia de hoje.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T013** [C5] Atualizar a versão do aplicativo em `apps/mobile/app.config.js` (`APP_VERSION`).
- [ ] **T014** [C5] Registrar a entrada descritiva em português no topo do arquivo `CHANGELOG.md` na seção `[Unreleased]`.
- [ ] **T015** [C5] Gravar a evidência SQP R-221 nos registros de C5.
- [ ] **T016** [C5] Registrar a entrada no journal e atualizar `state.json` com status `'completed'`.
