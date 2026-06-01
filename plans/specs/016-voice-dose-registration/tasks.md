# Tasks: Voice Dose Registration

**Feature Directory**: `plans/specs/016-voice-dose-registration`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/016-voice-dose-registration/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/016-voice-dose-registration/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar a instalação e configuração das chaves de Config Plugins do `react-native-voice` no arquivo de manifesto do Expo (`app.json` / `app.config.js`).
- [ ] **T002** [C1] Mapear os endpoints HTTP de homologação para testes de transações de dose remota.

## Phase 2: Implementation

### Shared / Core Services
- [ ] **T003** [US1] Escrever o processador NLP Fuzzy e cálculo de distância de edição Levenshtein em `packages/core/src/services/fuzzyMatchService.js`.

### Mobile App Components
- [ ] **T004** [US1] Desenhar o botão de microfone `VoiceRecordButton.jsx` integrado com listeners da API de áudio nativa do `react-native-voice`.
- [ ] **T005** [US1] Integrar o gatilho de busca fuzzy na Home do mobile nativo.

### Web Client Components (PWA)
- [ ] **T006** [US2] Criar o botão web `WebVoiceButton.jsx` encapsulando as chaves de interface da Web Speech API (`SpeechRecognition`) com tratamento de graceful degradation.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T008** [C4] Criar testes unitários para a engine `fuzzyMatchService.js` cobrando casos de stopwords e limites de tolerância (distância Levenshtein).
- [ ] **T009** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T010** [C4] **Verificação de DoD Independente (R-060):** Validar via testes que ao simular entrada por voz em navegador sem suporte, a UI oculta de forma limpa o botão de microfone, sem disparar exceções de runtime no console.
- [ ] **T011** [C4] **Smoke PO Manual:** Testar no simulador móvel o clique e fala *"Tomei Losartana"*, verificando que transcreve e marca o check-in na hora local de forma estável.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e no core (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
