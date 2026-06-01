# Tasks: Voice Dose Summary

**Feature Directory**: `plans/specs/017-voice-dose-summary`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/017-voice-dose-summary/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/017-voice-dose-summary/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar se a biblioteca `expo-speech` está listada e linkada no diretório mobile.
- [ ] **T002** [C1] Validar se as chaves aliases de importação do core estão ativas no mobile.

## Phase 2: Implementation

### Shared / Core Services
- [ ] **T003** [US1] Escrever o construtor lógico de strings pt-BR para áudio `voiceTextBuilder.js` em `packages/core/src/services/`.

### Mobile App Components
- [ ] **T004** [US1] Desenhar o botão de controle de áudio proeminente `VoiceSummaryButton.jsx` na Home integrado com `expo-speech`.
- [ ] **T005** [US1] Configurar intercepção de exceções de hardware de áudio no mobile.

### Web Client Components (PWA)
- [ ] **T006** [US2] Criar o botão correspondente `WebVoiceSummary.jsx` encapsulando as chaves da `SpeechSynthesis` API no PWA/Web.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T008** [C4] Criar testes unitários para o construtor lógico de strings `voiceTextBuilder.js` testando casos com doses pendentes e cumprimento perfeito.
- [ ] **T009** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T010** [C4] **Verificação de DoD Independente (R-060):** Confirmar que ao desativar o suporte de hardware no navegador de teste, o botão web mascara-se de forma limpa na UI.
- [ ] **T011** [C4] **Smoke PO Manual:** Testar no simulador móvel o clique no ícone de som, verificando que o sintetizador de voz do SO dita o histórico na hora local corretamente.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e no core (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
