# Implementation Plan: AI Chatbot Mobile

**Feature Directory**: `plans/specs/015-ai-chatbot-mobile`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/015-ai-chatbot-mobile/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` §1. Chatbot IA Contextual, §1. F8.1

---

## Technical Context

Esta feature realiza o port da UI do Chatbot para o aplicativo nativo. O backend (`api/chatbot.js`) e as lógicas de segurança em Node.js já estão prontos e operacionais na web.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Uso do motor de regras `safetyGuard.js` em produção na API que barra diagnósticos médicos perigosos pela IA. |
| **II. Mobile-First Reliability** | ✅ PASS | Uso de lista virtualizada `FlatList` invertida para renderização eficiente do histórico. |
| **IV. Timezone Correctness** | ✅ PASS | O prontuário clínico enviado à IA no header de contexto calcula posologia sob fuso local GMT-3. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/chatbot/screens/ChatbotScreen.jsx` | Tela nativa de conversação móvel com FlatList invertido e entrada de texto. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `apps/mobile/src/features/chatbot/components/TypingIndicator.jsx` | Indicador animado de digitação ("Aguardando resposta..."). | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `apps/mobile/src/features/chatbot/services/chatCacheService.js` | Serviço de persistência e expurgação do histórico local em AsyncStorage. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `packages/core/src/config/chatbotConfig.js` | Compartilhamento e centralização das configurações de tokens, keyword blocks e disclaimers. | `@dosiq/core` optimization |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> A persistência e conexões seguras REST de longo período dependem de compilações nativas. Todo teste local de chat deve ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Portabilidade e Reuso do Backend
* **A Conexão com o Servidor:** A tela `ChatbotScreen.jsx` efetua chamadas assíncronas HTTP POST para `dosiq.app/api/chatbot` enviando no payload o `user_id` e o array histórico de mensagens.
* **Filtros e Configurações no Core:** As constantes `CHATBOT_MAX_HISTORY`, `CHATBOT_DISCLAIMER` e `CHATBOT_HEALTH_KEYWORDS` são centralizadas em `packages/core/src/config/chatbotConfig.js` e importadas por aliases de caminhos no mobile e no PWA, garantindo paridade de comportamento clínica perfeita (Gate Loop G2).

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado como **minor** (port da interface visual do Chatbot de IA para o mobile).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada da tela do Assistente Inteligente IA no aplicativo nativo.
* **Quality Commands:**
  * Executar `rtk lint` no core e no mobile.
  * Executar `rtk npm run validate:agent` e garantir sucesso total.
