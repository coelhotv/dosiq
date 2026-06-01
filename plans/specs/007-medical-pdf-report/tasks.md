# Tasks: Medical PDF Report

**Feature Directory**: `plans/specs/007-medical-pdf-report`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/007-medical-pdf-report/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/007-medical-pdf-report/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar a instalação das bibliotecas `expo-print` e `expo-sharing` no monorepo mobile e conferir dependências nativas no `package.json`.
- [ ] **T002** [C1] Verificar se no PWA/Web a chamada do `jsPDF` está encapsulada em carregamento dinâmico lazy-loaded (AP-B03).

## Phase 2: Implementation

### Mobile App Services & Components
- [ ] **T003** [US1] Criar o serviço `pdfGeneratorService.js` contendo o template HTML clínico (identificação, medicamentos ativos, adesão, histórico) e estilização inline robusta.
- [ ] **T004** [US1] Integrar o método de impressão e escrita do arquivo temporário com o `expo-print`.
- [ ] **T005** [US2] Criar o botão de UI `ExportPdfButton.jsx` na aba correspondente do mobile integrado com a API do `expo-sharing`.

### Web App Optimizations
- [ ] **T006** [US2] Otimizar o serviço correspondente `webPdfService.js` no PWA para garantir a correta importação assíncrona baseada em promessas.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T008** [C4] Escrever testes unitários mockando o `expo-print` e validando o HTML inline estruturado.
- [ ] **T009** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T010** [C4] **Verificação de DoD Independente (AP-B03):** Confirmar via console do Lighthouse ou depuração de rede que o bundle inicial do PWA não foi inflado e que o carregamento do `jsPDF` só ocorre sob demanda ao clicar no botão da web.
- [ ] **T011** [C4] **Smoke PO Manual:** Testar no simulador móvel o clique no botão "Exportar PDF", verificar se o visualizador do SO abre e se o layout exibe o cabeçalho e histórico correto.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e no PWA (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
