# Fase 8: Experiencia Inteligente & Wow Factor

**Versao:** 1.1
**Data:** 20/03/2026 (atualizado com aprendizados de performance mobile)
**Objetivo:** Elevar a experiencia do paciente com IA conversacional, voz e interacoes que surpreendem — criando momentos de encantamento que tornam o app insubstituivel na rotina diaria.
**Baseline:** v4.0.0 (Fase 7 completa)
**Custo:** R$0-5/mes (Groq free tier suficiente para fase inicial)
**Esforco:** 44 SP

---

## 1. Filosofia

Esta fase NAO e sobre monetizacao. E sobre entregar **conveniencia**, **encorajamento** e **fator wow** que fidelizam o paciente. O diferencial competitivo do Dosiq nao esta em cobrar por features premium — esta em oferecer gratuitamente o que ninguem mais oferece.

---

## 2. Features

### F8.1 — Chatbot IA Multi-Canal (13 SP)

**O que faz:** O paciente conversa naturalmente com o app — por texto no web, WhatsApp ou Telegram.

**Exemplos de interacao:**
- "Tomei meu remedio?" → Consulta logs do dia e responde com status real
- "Quando comprei Losartana pela ultima vez?" → Busca historico de estoque
- "Me explica pra que serve Metformina" → Informacao do medicamento (sem substituir orientacao medica)
- "Como esta minha adesao essa semana?" → Resumo com dados reais

**Arquitetura:**
```
src/features/chatbot/
  services/
    chatbotService.js        -- orquestrador (contexto + Groq API)
    contextBuilder.js        -- monta contexto do paciente (meds, logs, stock, adesao)
    safetyGuard.js           -- filtros de seguranca (disclaimer, limites de resposta)
  components/
    ChatWindow.jsx           -- interface web (drawer/modal)
    ChatMessage.jsx          -- bolha de mensagem
    ChatInput.jsx            -- input com sugestoes rapidas

server/
  chatbot/
    groqClient.js            -- wrapper Groq API
    channelRouter.js         -- roteia mensagem do canal correto
```

**Stack tecnica:**
- Groq API (free tier: 30 req/min, modelos Llama/Mixtral)
- Dependencia nova: `groq-sdk` (~20KB, server-side only)
- Nova serverless function: `api/chatbot.js` (usa 1 slot: 8/12 assumindo W01 da Fase 7 ja usou 7/12)
- System prompt inclui: medicamentos ativos, protocolos, ultimas doses, estoque, adesao 7d

> ⚠️ **Verificar budget serverless antes de iniciar** — `find api -name "*.js" -not -path "*/_*" | wc -l`. Budget atual: 6/12. Apos Fase 7 (W01): 7/12. Apos F8.1: 8/12. Restam 4 slots para futuro.

**Seguranca:**
- Disclaimer em toda interacao: "Nao substitui orientacao medica"
- Nao gera recomendacoes de dosagem ou diagnostico
- Rate limit: 30 mensagens/hora/usuario
- Dados do paciente NUNCA enviados como training data (Groq nao treina com dados de API)

**Integracao multi-canal:**
- Web: ChatWindow como drawer lateral (botao no header)
- WhatsApp/Telegram: mensagens de texto processadas pelo channelRouter
- Contexto do paciente construido a partir dos mesmos services existentes

### V01 — Registro de Dose por Voz (13 SP)

**O que faz:** "Tomei meu remedio" → o app identifica o medicamento e registra a dose.

**Stack tecnica:**
- Web Speech API (`SpeechRecognition`) — nativa do browser, custo zero
- Funciona offline em devices modernos (reconhecimento local)
- Suporte: Chrome 90+, Safari 14.1+, Edge 90+
- Graceful degradation: se browser nao suporta, botao de voz nao aparece

**Fluxo:**
1. Paciente toca botao de microfone (no header ou FAB)
2. Speech-to-text captura a frase
3. NLP basico (regex + fuzzy match) identifica:
   - Intencao: "tomei", "registrar", "tomar" → REGISTRAR_DOSE
   - Medicamento: fuzzy match contra lista de medicamentos ativos do paciente
4. Se match unico: confirma e registra
5. Se multiplos matches: mostra opcoes para selecionar
6. Se nao identifica: "Nao entendi. Qual medicamento voce tomou?"

**Componentes:**
```
src/features/voice/
  hooks/
    useSpeechRecognition.js  -- wrapper Web Speech API
    useVoiceCommand.js       -- parser de intencao + medicamento
  components/
    VoiceFAB.jsx             -- botao de microfone flutuante
    VoiceConfirmation.jsx    -- modal de confirmacao com feedback visual
```

**Acessibilidade:**
- Feedback visual durante captura (onda de audio animada)
- Feedback haptico ao confirmar (navigator.vibrate)
- Fallback para input de texto se voz falhar

### V02 — Resumo de Doses por Voz (5 SP)

**O que faz:** "O que falta hoje?" → o app fala a lista de medicamentos pendentes.

**Stack tecnica:**
- Web Speech Synthesis API (`SpeechSynthesis`) — nativa, custo zero
- Voz em pt-BR (seleciona automaticamente voz disponivel no device)

**Fluxo:**
1. Paciente pergunta "O que falta hoje?" (via microfone ou botao dedicado)
2. App consulta useDoseZones() para doses pendentes
3. Monta texto: "Voce ainda precisa tomar Losartana as 22 horas e Omeprazol as 22 horas"
4. Se tudo tomado: "Parabens! Voce ja tomou todos os medicamentos de hoje"
5. Sintese de voz reproduz o texto

**Componente:** Integrado no VoiceFAB — mesmo botao, intencao diferente.

### F8.2 — Base ANVISA Interacoes Medicamentosas (13 SP)

**Pre-requisito:** Resultado positivo do spike ANVISA na Fase 5.

**O que faz:** Alerta automatico quando o paciente cadastra medicamentos que tem interacao conhecida.

**Arquitetura:**
```
src/features/interactions/
  data/
    interactions.json        -- base de interacoes (seed 50-80 pares)
  services/
    interactionService.js    -- verifica interacoes entre lista de meds
    severityClassifier.js    -- classifica: leve / moderada / grave / contraindicada
  components/
    InteractionAlert.jsx     -- alerta visual com detalhes
    InteractionBadge.jsx     -- badge no card do medicamento
```

**Base de dados:**
- JSON estatico embeddado no bundle (sem API externa) — **DEVE ser lazy-loaded** (AP-B03)
- Formato: `{ pair: [med_a, med_b], severity, description, recommendation, source }`
- Seed inicial: 50-80 interacoes de alta prevalencia

> ⚠️ **Lazy loading obrigatorio (AP-B03, R-117):** `interactions.json` e os components de interacao DEVEM ser `React.lazy()` + `import()` dinamico. Um import estatico de `interactions.json` (potencialmente 50-200KB) no MedicineForm ou no main bundle inviabiliza o trabalho de bundle optimization ja feito (M2: 989KB → 102kB). Seguir padrao: `const { interactionService } = await import('@features/interactions/services/interactionService.js')` dentro do handler de submit do MedicineForm.
  - Anti-hipertensivos x AINEs
  - Anticoagulantes x AINEs
  - Estatinas x fibratos
  - Metformina x alcool
  - PPIs x clopidogrel
  - etc.
- Source: bulas ANVISA + literatura clinica aberta

**Momentos de verificacao:**
1. Ao cadastrar novo medicamento → verifica contra todos os ativos
2. Ao ativar protocolo pausado → reverifica
3. Na geracao do PDF/Modo Consulta → secao dedicada

**UI:**
- SmartAlert tipo INTERACTION com severity-coded colors
- Badge no card do medicamento na tab Tratamento
- Secao no Modo Consulta e PDF

---

## 3. Sequencia de Implementacao

1. **V01 Registro por Voz** (13 SP) — Web Speech API nativa, zero dependencia, wow imediato
2. **V02 Resumo por Voz** (5 SP) — estende V01, complemento natural
3. **F8.1 Chatbot IA** (13 SP) — requer Groq API setup, mais complexo
4. **F8.2 ANVISA Interacoes** (13 SP) — depende do resultado do spike da Fase 5

---

## 4. Criterios de Aceitacao

- Chatbot responde em <3s (Groq free tier latencia tipica: 500ms-2s)
- Disclaimer "Nao substitui orientacao medica" visivel em toda interacao do chatbot
- Voice recognition com acuracia >85% para nomes de medicamentos em pt-BR
- Graceful degradation: botao de voz nao aparece em browsers sem suporte
- Interacoes medicamentosas verificadas no cadastro e na geracao de relatorios
- Bundle size aumento maximo: +50KB (interactions.json + voice components — lazy-loaded, sem impacto no main bundle)
- Lighthouse Performance mantido >=90

---

## 5. Metricas de Sucesso

| Metrica | Meta |
|---------|------|
| Chatbot: mensagens/dia/usuario ativo | >= 2 |
| Chatbot: satisfacao (thumbs up/down) | >= 70% positivo |
| Voz: doses registradas por voz | >= 10% do total |
| Voz: acuracia de reconhecimento | >= 85% |
| Interacoes: alertas gerados | >= 1 por usuario com >3 meds |

---

## 6. Gestao de Riscos

| Risco | Prob | Impacto | Mitigacao |
|-------|------|---------|-----------|
| Groq free tier descontinuado | Media | Medio | Alternativas: Cloudflare Workers AI (gratis), Ollama local |
| Web Speech API limitado em iOS <17 | Media | Medio | Feature flag, graceful degradation |
| Paciente confunde chatbot com medico | Baixa | Alto | Disclaimer obrigatorio, limitar escopo de respostas |
| Base ANVISA incompleta gera falsa seguranca | Media | Alto | Disclaimer "base parcial", incentivar consulta ao farmaceutico |
| Bundle size com interactions.json | Baixa | Baixo | Lazy loading do JSON, code splitting |

---

---

## Aprendizados de Performance Aplicaveis (Fases M0-M8, P1-P4, D0-D3)

| Aprendizado | Regra | Aplicacao em Fase 8 |
|-------------|-------|---------------------|
| Import estatico de componente pesado puxa chunks para main bundle | AP-B03 | `ChatWindow`, `VoiceFAB`, `InteractionAlert` DEVEM ser `React.lazy()`. Nenhum deles e critico no first load. |
| Barrel exports quebram code-splitting | AP-B04 | Nao re-exportar novos components/services da Fase 8 em `@shared/services/index.js` ou barrels existentes |
| `import()` dinamico em handlers | D0 | `interactionService`, `contextBuilder`, `groqClient` devem ser importados dinamicamente dentro dos handlers — nunca no top-level de um component React |
| Voice components: usar `React.lazy()` | R-117 | `VoiceFAB` (microfone) so aparece apos mount — lazy-load seguro |
| Auth: usar `getCurrentUser()` em cache | R-128 | Chatbot precisa de contexto do usuario — usar `getCurrentUser()` (cacheado) nao `supabase.auth.getUser()` direto |

---

*Documento criado 06/03/2026. Atualizado 20/03/2026 com aprendizados de performance mobile.*
*Substitui PRD_FASE_7_ROADMAP_2026.md.*
