# Tasks: Complete Data Export (LGPD)

**Feature Directory**: `plans/specs/008-complete-data-export-lgpd`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/008-complete-data-export-lgpd/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/008-complete-data-export-lgpd/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar a instalação das bibliotecas `expo-file-system` e `expo-sharing` no monorepo mobile e conferir dependências nativas no `package.json`.
- [ ] **T002** [C1] Verificar se no PWA/Web a exportação baseada em blobs de navegador e elementos `<a>` permanece isolada e funcional.

## Phase 2: Implementation

### Mobile App Services & Components
- [ ] **T003** [US1] Criar o serviço `exportService.js` contendo lógica de agrupamento e escrita local baseada em `expo-file-system`.
- [ ] **T004** [US1] Implementar métodos de formatação em string JSON e CSV estruturada.
- [ ] **T005** [US2] Construir a tela `ExportDataScreen.jsx` no mobile com checkboxes e gatilho de compartilhamento `expo-sharing`.

### Web App Optimizations
- [ ] **T006** [US2] Otimizar o serviço correspondente `webExportService.js` no PWA garantindo compatibilidade multiplataforma.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T008** [C4] Escrever testes unitários mockando o `expo-file-system` e validando os formatos estruturados.
- [ ] **T009** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T010** [C4] **Verificação de DoD Independente:** Confirmar que no mobile nenhuma API `Blob` ou elemento browser `<a>` é utilizado na exportação nativa, garantindo que o arquivo `.csv` ou `.json` gerado na pasta temporária é disponibilizado pelo Share nativo.
- [ ] **T011** [C4] **Smoke PO Manual:** Testar no simulador móvel o clique no botão "Exportar JSON", verificar se o visualizador do SO abre e se o arquivo contém as chaves correspondentes.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e no PWA (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
