# Tasks: ANVISA Local Interactions

**Feature Directory**: `plans/specs/018-anvisa-interactions-local`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/018-anvisa-interactions-local/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/018-anvisa-interactions-local/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Criar a base JSON estática `packages/core/src/interactions/interactions.json` contendo a curadoria de 50-80 pares de alta prevalência no Brasil (AINEs, anti-hipertensivos, anticoagulantes).
- [ ] **T002** [C1] Mapear aliases do monorepo core para carregamento dinâmico.

## Phase 2: Implementation

### Shared / Core Engine
- [ ] **T003** [US1] Escrever o serviço de comparação fuzzy e mapeamento fonético `packages/core/src/services/interactionService.js`.

### Mobile UI Components
- [ ] **T004** [US1] Desenhar a modal nativa de alerta `SmartAlertModal.jsx` com chips coloridos de gravidade e disclaimer de segurança obrigatório.
- [ ] **T005** [US2] Integrar o import dinâmico assíncrono no formulário de cadastro de medicamentos móvel nativo.

### Web Client Components (PWA)
- [ ] **T006** [US2] Construir o componente de alerta `WebSmartAlert.jsx` no formulário web e integrar a importação sob demanda no submit.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T008** [C4] Criar testes unitários completos de isolamento para o serviço `interactionService.js` cobrando casos de normalização fonética fuzzy e acertos positivos/negativos.
- [ ] **T009** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T010** [C4] **Verificação de DoD Independente (AP-B03):** Confirmar via console de depuração e tamanho de build da web que o JSON estático de interações e a engine são carregados estritamente sob demanda no evento de clique de submissão do formulário.
- [ ] **T011** [C4] **Smoke PO Manual:** Testar no simulador móvel o cadastro de Ibuprofeno tendo Losartana já cadastrada e atestar a correta renderização do modal SmartAlert.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e no core (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
