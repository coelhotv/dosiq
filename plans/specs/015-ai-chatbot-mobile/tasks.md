# Tasks: AI Chatbot Mobile

**Feature Directory**: `plans/specs/015-ai-chatbot-mobile`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/015-ai-chatbot-mobile/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/015-ai-chatbot-mobile/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar a correta centralização das constantes de configuração no core (`packages/core/src/config/chatbotConfig.js`) e criar alias de exportação.
- [ ] **T002** [C1] Validar se o endpoint `api/chatbot.js` está respondendo em homologação com os parâmetros esperados.

## Phase 2: Implementation

### Core Configs
- [ ] **T003** [US1] Centralizar as configurações e disclaimers no arquivo config do monorepo core.

### Mobile UI Components
- [ ] **T004** [US1] Construir a tela nativa `ChatbotScreen.jsx` desenhando mensagens e caixa de input, e integrando FlatList com inversão de índice.
- [ ] **T005** [US2] Criar o componente `TypingIndicator.jsx` contendo micro-animações de aguardo de resposta.
- [ ] **T006** [US1] Desenvolver o serviço local `chatCacheService.js` para persistência e teto limitador de histórico em AsyncStorage.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em `packages/core` e `apps/mobile/` corrigindo warnings.
- [ ] **T008** [C4] Criar testes unitários para a persistência local e limites do histórico de conversas móvel.
- [ ] **T009** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T010** [C4] **Verificação de DoD Independente (AP-B03):** Validar que ao digitar uma pergunta de saúde proibida (ex: pedir indicação de calmantes fortes), o assistente retorna imediatamente o disclaimer padrão clínico configurado, sem repassar a pergunta para a API da Groq.
- [ ] **T011** [C4] **Smoke PO Manual:** Interagir com o chatbot no simulador móvel, atestando a rolagem fluida e o recarregamento instantâneo do histórico local ao fechar e reabrir a tela.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e no core (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
