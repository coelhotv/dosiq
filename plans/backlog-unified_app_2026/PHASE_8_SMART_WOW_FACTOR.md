# Fase 8 — Experiência Inteligente & Wow Factor (Dosiq 2026)

Este documento especifica os requisitos de engenharia e a arquitetura técnica para a **Fase 8**, focando na implementação de recursos inteligentes de inteligência artificial (Groq SDK), interface de voz (Speech Recognition) e segurança clínica local (Interações Medicamentosas ANVISA).

---

## 1. Chatbot IA Contextual (Groq SDK)

O objetivo é disponibilizar um assistente inteligente com o contexto real do paciente que responda dúvidas sobre medicamentos, estoque e aderência, de forma rápida e segura.

```
  [ Canal de Entrada ] (Web, WhatsApp, Telegram)
            │
            ▼
  [ api/chatbot.js ] ──► [ contextBuilder.js ] (Lê dados de Meds, Logs, Estoque)
            │
            ▼
  [ safetyGuard.js ] (Aplica disclaimer médico e barra diagnósticos)
            │
            ▼
  [ Groq API SDK ] (Free Tier, Llama 3 70B, <1s de resposta)
            │
            ▼
  [ Resposta Formatada para o Usuário ]
```

### 🛠️ F8.1 — Arquitetura de Integração Groq
*   **Context Builder (`contextBuilder.js`):** Monta dinamicamente a persona clínica do paciente para a chamada do LLM. O contexto inclui:
    *   Medicamentos e posologias ativas.
    *   Logs das doses tomadas nos últimos 7 dias.
    *   Previsão de reposição de estoque atual.
*   **Filtro de Segurança (`safetyGuard.js`):** Garante a inserção obrigatória do disclaimer: *"Não substituo orientações médicas profissionais. Em caso de dúvidas ou sintomas graves, consulte seu médico."*
*   **Roteador de Canais:**
    *   **PWA/Web:** Exibido em uma gaveta lateral deslizante (*ChatWindow drawer*) lazy-loaded (**AP-B03**).
    *   **WhatsApp/Telegram:** Roteado internamente via `api/webhooks.js` a partir das mensagens de texto enviadas pelos usuários aos bots.

---

## 🎙️ 2. Registro e Resumo de Doses por Voz

Permite ao paciente interagir com o sistema falando naturalmente no celular ou computador, simplificando a usabilidade diária.

### 📱 V01 — Registro por Voz Nativo & Web Speech
*   **No App Nativo:** Utiliza o módulo nativo de reconhecimento de voz do dispositivo (`expo-speech` ou `react-native-voice`), aproveitando o processamento local embarcado dos sistemas operacionais (iOS/Android) com acurácia elevada em português pt-BR.
*   **No PWA/Web:** Utiliza o wrapper nativo da **Web Speech API** (`SpeechRecognition`), com *graceful degradation* (o botão de microfone some em navegadores ou sistemas sem suporte, como Safari em versões antigas).
*   **Intenção NLP Fuzzy:** A frase capturada (ex: *"Tomei a losartana agora"*) é processada por um algoritmo local de casamento de padrões fuzzy contra os medicamentos ativos do paciente, registrando a dose automaticamente caso encontre um match inequívoco.

### 📱 V02 — Resumo Falado das Doses Pendentes
*   **O que faz:** O paciente clica no microfone e pergunta: *"O que falta hoje?"*. O app utiliza o motor de síntese de voz local (`SpeechSynthesis` na Web, ou `expo-speech` no Mobile) para ditar a lista de pendências:
    > *"Você ainda precisa tomar a Losartana às 22 horas e a Metformina às 22 horas."*
*   Se tudo já estiver concluído no dia, reproduz: *"Parabéns! Você já tomou todas as doses agendadas para hoje."*

---

## 💊 3. Base de Interações Medicamentosas ANVISA Local

Adiciona segurança clínica ao alertar o paciente e o cuidador durante o cadastro de medicamentos com interações graves conhecidas.

*   **Implementação Estática e Leve:** A base de interações (JSON com ~80 pares de alta relevância clínica, ex: Hipertensivos x AINEs) vive em um arquivo estático embeddado no monorepo: `packages/core/src/interactions/interactions.json`.
*   **Lazy-Loading Obrigatório (AP-B03 / R-117):**
    *   Para não inflar o tamanho do bundle principal (preservando o trabalho de otimização de performance), os componentes e o JSON de interações devem ser importados dinamicamente apenas quando a ação de validação for executada.
    ```javascript
    // Exemplo de import dinâmico dentro do handler de submit do formulário
    const validateInteractions = async (newMedicineId, activeMedicines) => {
      const { checkInteractions } = await import('@core/services/interactionService');
      const alerts = checkInteractions(newMedicineId, activeMedicines);
      if (alerts.length > 0) {
        showInteractionModal(alerts);
      }
    };
    ```
*   **Interface:** Exibe um SmartAlert dinâmico colorido codificado por gravidade (Leve, Moderada, Grave) na tela de confirmação de cadastro do medicamento e destaca no Modo Consulta médica.

---

## 📋 Qualidade & Critérios de Aceitação (QA Gates)

*   **Gate G1 (Cópia/Mobile):** As chamadas de voz nativas no simulador devem processar o áudio pt-BR com acurácia de intenção fuzzy ≥ 85%.
*   **Gate G2 (Extração Core):** A engine de validação de interações ANVISA deve rodar em isolamento com 100% de cobertura de testes unitários sobre os pares do JSON.
*   **Gate G3 (Adoção Web):** O carregamento do JSON de interações e componentes de chat na web deve ser feito sob demanda via `React.lazy()`, garantindo que o bundle principal gzip permaneça ≤ 110kB.

---

*Backlog unificado de inteligência e usabilidade acessível - Dosiq 2026.*
