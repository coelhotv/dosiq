# Fase 8 — Experiência Inteligente & Wow Factor (Dosiq 2026)

> **Versão:** 1.1 — Revisão de 30/05/2026  
> **Changelog v1.0→v1.1:** P8-01 (chatbot já existe — tag [PORTAR]), P8-02 (ref contextBuilder/safetyGuard existentes), P8-03 (decisão voice lib pendente), P8-04 (ref spike ANALISE_FONTES_INTERACOES), P8-05 (Safari iOS WebSpeech risk).

Este documento especifica os requisitos de engenharia e a arquitetura técnica para a **Fase 8**, focando na implementação de recursos inteligentes de inteligência artificial (Groq SDK), interface de voz (Speech Recognition) e segurança clínica local (Interações Medicamentosas ANVISA).

> **Estado real:** Ao contrário do que o backlog anterior sugeria, **vários componentes da Fase 8 já existem em produção** no PWA e Telegram. O trabalho é majoritariamente de port para mobile + execução de pipeline de dados.

---

## 1. Chatbot IA Contextual (Groq SDK)

### Status por Superfície

| Superfície | Status | Referência |
|-----------|--------|-----------|
| PWA/Web | ✅ **Já existe e funcional** | Feature completa em `apps/web/src/features/chatbot/` |
| Telegram | ✅ **Já existe e funcional** | `server/bot/services/chatbotServerService.js` |
| API Serverless | ✅ **Já existe e funcional** | `api/chatbot.js` (modelo `groq/compound`, 300 tokens, temp 0.2) |
| Mobile | 🆕 **Portar UI** (~5 SP) | Criar tela de chat React Native, reutilizar API existente |

### Arquitetura Existente

```
  [ Canal de Entrada ] (Web ✅, WhatsApp ⬚, Telegram ✅, Mobile 🆕)
            │
            ▼
  [ api/chatbot.js ] ✅ ──► [ contextBuilder.js ] ✅ (Lê dados de Meds, Logs, Estoque)
            │
            ▼
  [ safetyGuard.js ] ✅ (Aplica disclaimer médico e barra diagnósticos)
            │
            ▼
  [ Groq API SDK ] (modelo: groq/compound, max_tokens: 300, temp: 0.2)
            │
            ▼
  [ Resposta Formatada para o Usuário ]
```

### 📱 F8.1 — Portar Chatbot para Mobile [PORTAR]

O backend está 100% pronto. O trabalho é criar a **UI de chat nativa** no React Native:

*   **Config existente a reutilizar:** [chatbotConfig.js](../apps/web/src/features/chatbot/config/chatbotConfig.js) — constantes `CHATBOT_MAX_TOKENS`, `CHATBOT_TEMPERATURE`, `CHATBOT_TOP_P`, `CHATBOT_MAX_HISTORY`, `CHATBOT_RATE_LIMIT_MAX`, `CHATBOT_BLOCKED_PATTERNS`, `CHATBOT_DISCLAIMER`, `CHATBOT_HEALTH_KEYWORDS`.
*   **Context Builder existente:** [contextBuilder.js](../apps/web/src/features/chatbot/services/contextBuilder.js) — monta persona clínica do paciente com medicamentos, logs, estoque.
*   **Safety Guard existente:** [safetyGuard.js](../apps/web/src/features/chatbot/services/safetyGuard.js) — filtra mensagens perigosas, insere disclaimer automático.
*   **Testes existentes:** `chatbotService.test.js`, `contextBuilder.test.js`, `safetyGuard.test.js`.
*   **O que construir no mobile:**
    *   Tela de chat com input de texto + scroll de mensagens (use `FlatList` invertido).
    *   Integração com `api/chatbot.js` via `fetch()` (mesmo endpoint que o PWA usa).
    *   Armazenamento de histórico local em `AsyncStorage` (equivalente ao `localStorage` do PWA).
    *   Migrar config para `packages/core` via Gate Loop G2 (ou importar direto do path web temporariamente).

**Esforço estimado: ~5 SP** (vs. ~13 SP se fosse do zero).

---

## 🎙️ 2. Registro e Resumo de Doses por Voz

Permite ao paciente interagir com o sistema falando naturalmente no celular ou computador, simplificando a usabilidade diária.

### 📱 V01 — Registro por Voz Nativo & Web Speech [NOVO]

| Superfície | Status |
|-----------|--------|
| Mobile | 🆕 Novo — reconhecimento de voz nativo |
| PWA | 🆕 Novo — Web Speech API |

*   **No App Nativo:** Utiliza o módulo nativo de reconhecimento de voz do dispositivo.
    *   **⚠️ Decisão pendente:** Escolher entre `expo-speech` e `react-native-voice`. Critérios:
        *   `expo-speech` — mais integrado ao ecossistema Expo, mas foco em TTS (text-to-speech), não STT.
        *   `react-native-voice` — foco em STT (speech-to-text), mais maduro para reconhecimento.
        *   **Recomendação:** `react-native-voice` para V01 (STT), `expo-speech` para V02 (TTS).
    *   Processamento local embarcado dos sistemas operacionais (iOS/Android) com acurácia elevada em português pt-BR.
*   **No PWA/Web:** Utiliza o wrapper nativo da **Web Speech API** (`SpeechRecognition`), com *graceful degradation* (o botão de microfone some em navegadores sem suporte).
    *   **⚠️ Risco técnico:** Web Speech API **não funciona** em Safari iOS sem HTTPS e em browsers baseados em WebKit com media capabilities restritas. Testar fallback.
*   **Intenção NLP Fuzzy:** A frase capturada (ex: *"Tomei a losartana agora"*) é processada por um algoritmo local de casamento de padrões fuzzy contra os medicamentos ativos do paciente, registrando a dose automaticamente caso encontre um match inequívoco.
*   **CI/CD:** Voice recognition **não é testável** em CI automatizado. Estratégia: mock do módulo de voz nos testes unitários + teste manual no QA Gate.

### 📱 V02 — Resumo Falado das Doses Pendentes [NOVO]

| Superfície | Status |
|-----------|--------|
| Mobile | 🆕 Novo — `expo-speech` (TTS) |
| PWA | 🆕 Novo — `SpeechSynthesis` API |

*   **O que faz:** O paciente clica no microfone e pergunta: *"O que falta hoje?"*. O app utiliza o motor de síntese de voz local (`SpeechSynthesis` na Web, ou `expo-speech` no Mobile) para ditar a lista de pendências:
    > *"Você ainda precisa tomar a Losartana às 22 horas e a Metformina às 22 horas."*
*   Se tudo já estiver concluído no dia, reproduz: *"Parabéns! Você já tomou todas as doses agendadas para hoje."*

---

## 💊 3. Base de Interações Medicamentosas ANVISA Local

Adiciona segurança clínica ao alertar o paciente e o cuidador durante o cadastro de medicamentos com interações graves conhecidas.

### Status: Spike Completo ✅ — Falta Executar Pipeline

O trabalho de pesquisa e definição de fontes **já foi realizado** em [ANALISE_FONTES_INTERACOES.md](../backlog-roadmap_v4/ANALISE_FONTES_INTERACOES.md). Destaques:

*   **Fonte primária:** CRF-MG Detecta Interações (~330 DDIs validadas por 37 especialistas, API Swagger, PT-BR, gratuito).
*   **Complemento:** Interage API IntMed (78K DDIs, trial gratuito).
*   **Validação cruzada:** DDInter 2.0 (302K DDIs, bulk CSV, acesso aberto).
*   **Schema JSON já definido:**
    ```json
    {
      "pair": ["losartana potássica", "ibuprofeno"],
      "severity": "moderada",
      "description": "AINEs podem reduzir o efeito anti-hipertensivo e aumentar o risco de lesão renal.",
      "recommendation": "Monitorar pressão arterial. Preferir paracetamol para dor.",
      "category": "anti-hipertensivo-aine",
      "source": "CRF-MG Detecta Interações"
    }
    ```
*   **Pipeline de extração:** 5 scripts propostos em `scripts/seed-interactions/`.
*   **Estimativa:** 6-8h para abordagem híbrida (API + curadoria manual dos guias clínicos Rio Saúde + UFG).
*   **Escopo final:** 50-80 pares de alta prevalência no Brasil (anti-hipertensivos, anticoagulantes, estatinas, IBPs, antidiabéticos).

### Implementação

*   **Arquivo estático:** `packages/core/src/interactions/interactions.json` (50-80 pares).
*   **Lazy-Loading Obrigatório (AP-B03 / R-117):**
    ```javascript
    // Import dinâmico dentro do handler de submit do formulário
    const validateInteractions = async (newMedicineId, activeMedicines) => {
      const { checkInteractions } = await import('@core/services/interactionService');
      const alerts = checkInteractions(newMedicineId, activeMedicines);
      if (alerts.length > 0) {
        showInteractionModal(alerts);
      }
    };
    ```
*   **Interface:** SmartAlert dinâmico colorido codificado por gravidade (Leve, Moderada, Grave, Contraindicada) na tela de confirmação de cadastro do medicamento e destaque no Modo Consulta médica.
*   **Disclaimer obrigatório:** *"Base parcial de interações conhecidas. Consulte seu médico para referência completa."*

---

## 📋 Qualidade & Critérios de Aceitação (QA Gates)

*   **Gate G1 (Mobile Voice):** As chamadas de voz nativas no simulador devem processar o áudio pt-BR com acurácia de intenção fuzzy ≥ 85%. Testes unitários usam mock do módulo de voz.
*   **Gate G2 (Interações Core):** A engine de validação de interações ANVISA deve rodar em isolamento com 100% de cobertura de testes unitários sobre os pares do JSON. Fonte e `source` de cada par rastreável.
*   **Gate G3 (Bundle Web):** O carregamento do JSON de interações e componentes de chat na web deve ser feito sob demanda via `React.lazy()`, garantindo que o bundle principal gzip permaneça ≤ 110kB.
*   **Gate G4 (Chatbot Mobile):** Chatbot mobile deve produzir respostas idênticas ao PWA (mesmo endpoint, mesma config). Teste de comparação lado-a-lado.

---

*Backlog unificado de inteligência e usabilidade acessível - Dosiq 2026.*  
*Versão 1.1 — Estado real por superfície, refs a código existente, spike de interações linkado.*
