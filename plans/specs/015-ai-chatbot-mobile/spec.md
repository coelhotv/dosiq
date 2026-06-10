# Feature Specification: AI Chatbot Mobile

**Feature Directory**: `plans/specs/015-ai-chatbot-mobile`  
**Created**: 2026-06-01  
**Status**: draft
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` §1. Chatbot IA Contextual, §1. F8.1

---

## Context

Para prover uma interface amigável e interativa no esclarecimento de dúvidas posológicas gerais e controle de estoque, o Dosiq conta com um Chatbot IA contextual. Enquanto o backend serverless (`api/chatbot.js`), as lógicas de proteção clínica (`safetyGuard.js`) e a construção do prontuário em memória (`contextBuilder.js`) já estão 100% construídos e em produção no PWA e Telegram, esta feature especifica o port da interface visual do chat para o aplicativo móvel nativo, com histórico persistente no cliente.

---

## User Scenarios & Testing

### User Story 1 - Conversação com Foco Posológico (Priority: P1)
**Why this priority**: Ajuda o paciente a tirar dúvidas sobre o seu tratamento programado a partir de conversas naturais.
**Independent Test**: Abrir a tela de chat no celular, enviar a mensagem *"Qual o meu próximo remédio?"*, validando que a resposta exibe os medicamentos corretos recuperados do contexto em fuso local.

**Acceptance Scenarios**:
1. Given que Dona Maria abriu o Chatbot no app nativo, When ela perguntar *"Que horas preciso tomar a Metformina?"*, Then o app deve enviar a requisição para `api/chatbot.js` contendo o prontuário local de Dona Maria em fuso GMT-3.
2. When a resposta da IA for recebida, Then a tela de chat deve exibir a resposta formatada em Markdown, incluindo o disclaimer clínico padrão e seguro.

### User Story 2 - Disclaimer de Segurança (Safety Guard) (Priority: P1)
**Why this priority**: Evita diagnósticos médicos perigosos ou recomendações incorretas pela IA.
**Independent Test**: Enviar a mensagem *"Estou com muita dor de cabeça, o que posso tomar?"*, verificando que o safetyGuard bloqueia recomendações de medicamentos de tarja preta e insere o disclaimer de busca de auxílio médico presencial.

**Acceptance Scenarios**:
1. Given o Chatbot aberto no mobile, When o paciente solicitar diagnósticos ou medicamentos de prescrição restrita, Then a resposta deve exibir obrigatoriamente o disclaimer padrão: *"O Dosiq é um assistente de rotina. Para diagnósticos e prescrições de remédios, consulte seu médico."*.

---

## Edge Cases

- **Sem Conectividade de Internet:** Se o paciente tentar interagir offline, a UI de chat deve desativar o botão de envio e mostrar o aviso: *"O assistente inteligente precisa de conexão com a internet para responder."*.
- **Histórico Gigante de Conversas:** Conversas muito longas persistidas no AsyncStorage podem degradar a performance de renderização da lista. O histórico deve ser limitado a no máximo 20 mensagens no cache (`CHATBOT_MAX_HISTORY`).

---

## Requirements

### Functional Requirements

- **FR-001:** Criar tela de chat nativa no aplicativo móvel com entrada de texto (`TextInput`) e rolagens fluidas usando `FlatList` invertido.
- **FR-002:** Reutilizar o endpoint serverless ativo `api/chatbot.js` da Vercel via chamada `fetch()` padrão (mesma rota que o PWA utiliza).
- **FR-003:** Persistir o histórico local de conversações no cache móvel (`AsyncStorage`) com teto rígido de 20 mensagens.
- **FR-004:** Exibição obrigatória de disclaimer clínico em todas as interações e filtragem de termos sensíveis utilizando as configurações canônicas de `chatbotConfig.js`.
- **FR-005:** Exibir estados de carregamento animado (Chips de digitação "digitando...") enquanto aguarda a resposta da API Groq.

### Key Entities

- **ChatMessage:** Objeto contendo remetente (`user` ou `bot`), timestamp e corpo do texto.
- **ChatHistorySnapshot:** Snapshot persistido localmente em JSON no AsyncStorage.

---

## Success Criteria

- **SC-001:** Respostas renderizadas na tela móvel de forma idêntica e com a mesma assertividade de contexto clínico do PWA.
- **SC-002:** Performance da rolagem de mensagens mantida em taxa estável ≥ 55fps.
