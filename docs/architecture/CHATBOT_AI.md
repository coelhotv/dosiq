# Arquitetura — Chatbot IA Multi-Canal (F8.1)

> **Primeira integração de IA no projeto Dosiq**
> **Status:** ✅ Entregue Sprint 8.3 + Bugfix 8.3.1 + Sprint 8.4 (History Persistence)
> **Versão:** 1.2 | **Data:** 2026-03-20
> **Modelo:** Groq `llama-3.3-70b-versatile` → `groq/compound` (seleção inteligente)

---

## 📋 Visão Geral

O Chatbot IA Multi-Canal é uma assistente virtual que ajuda pacientes a:
- **Gerenciar adesão:** Horários, doses registradas, streaks
- **Consultar estoque:** Níveis, previsão de falta, alertas
- **Obter orientações:** Sempre grounded em dados do paciente, nunca em conhecimento genérico

**Diferença crítica:** Não é um Q&A genérico. É um assistente *contextualizado* que conhece exatamente:
- Quais medicamentos o paciente toma
- Quando deve tomá-los
- Quanto tem em estoque
- Seu histórico de adesão

---

## 🏗️ Arquitetura

```
Client (React)                  Serverless (Vercel)
┌──────────────────┐            ┌─────────────────────┐
│  ChatWindow.jsx  │            │  api/chatbot.js     │
│  (Drawer UI)     │            │  (Groq Handler)     │
└─────────┬────────┘            └──────────┬──────────┘
          │                                │
          ├─ contextBuilder.js   ← Monta contexto compacto
          ├─ safetyGuard.js      ← Bloqueia perguntas perigosas
          ├─ chatbotService.js   ← Rate limit + orquestração
          │
          └─ fetch('/api/chatbot')────────┬────────────┐
                                           │            │
                                    Groq API         Supabase
                                 (llama-3.3,     (dados do
                                  groq/compound)  paciente)
```

---

## 📦 Componentes Principais

### 1. **contextBuilder.js** — Monta Contexto Compacto

**Responsabilidade:** Transformar dados do paciente (medicine, protocols, logs, stock) em um string formatado para o LLM.

**Regras Críticas:**
- ❌ NUNCA incluir IDs, UUIDs, user_id
- ❌ NUNCA incluir dados de outros usuários
- ✅ SEMPRE incluir `active_ingredient` + `therapeutic_class` (bugfix 8.3.1)
- ✅ Manter `< 2000 tokens` para não estourar free tier

**Exemplo de Saída:**
```
Data: 20/03/2026
Medicamentos ativos: 2
- SeloZok [Succinato de Metoprolol, Betabloqueador] (50mg): diario, horarios 08:00 20:00, estoque 15 un.
- Metformina [Cloridrato de Metformina, Antidiabetico] (500mg): diario, horarios 08:00 20:00, estoque 20 un.
Doses registradas hoje: 2
Adesao ultimos 7 dias: 92%
```

**API:**
```javascript
buildPatientContext({ medicines, protocols, logs, stockSummary, stats })
  // → string formatado para system prompt

buildSystemPrompt(patientContext)
  // → system prompt completo com regras absolutas
```

**Bugfix 8.3.1:** Adicionado `principioAtivo` e `classeTerapeutica` para evitar que o LLM alucine farmacologia.

---

### 2. **safetyGuard.js** — Filtra Intenções Perigosas

**Responsabilidade:** Bloquear perguntas que o LLM não deve responder.

**Padrões Bloqueados:**
```javascript
const BLOCKED_PATTERNS = [
  /qual\s+(dosagem|dose)\s+(devo|posso|preciso)/i,
  /posso\s+(parar|interromper|suspender)\s+de\s+tomar/i,
  /substituir\s+.+\s+por/i,
  /receitar|prescrever/i,
  /diagnostico|diagnosticar/i,
  /efeito\s+colateral/i,
  // ... mais padrões
]
```

**API:**
```javascript
validateUserMessage(message)
  // → { blocked: true, reason: "..." } | { blocked: false }

addDisclaimerIfNeeded(response)
  // → "resposta\n\n_Não substituo orientação médica._"
  //   (adicionado se menção a medicamento/dose/tratamento)
```

---

### 3. **chatbotService.js** — Orquestração Client-Side

**Responsabilidade:**
- Rate limiting (30 msg/hora via localStorage)
- Orquestrar validação → contexto → fetch → disclaimer
- Tratamento de erros graceful

**API:**
```javascript
sendChatMessage({ message, history, patientData })
  // → { response, blocked, rateLimited }
```

**Rate Limiting:**
```javascript
// localStorage chave: 'mr_chat_rate'
{
  windowStart: Date.now(),
  count: 5  // mensagens nesta janela (60min)
}
```

---

### 4. **api/chatbot.js** — Handler Serverless (Vercel)

**Responsabilidade:**
- Validar request com Zod
- Instanciar Groq SDK
- Chamar LLM com system prompt + history
- Retornar response

**Validação:**
```javascript
const chatbotRequestSchema = z.object({
  message: z.string().min(1).max(500),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional().default([]),
  systemPrompt: z.string().optional(),
})
```

**Parâmetros Groq (Bugfix 8.3.1):**
```javascript
temperature: 0.2,   // 0.7 → 0.2 (respostas factuais)
top_p: 1.0,         // 0.9 → 1.0 (sem nucleus sampling)
max_tokens: 300,
```

**Budget:** Slot 7/12 (Vercel Hobby limit)

---

### 5. **ChatWindow.jsx** — Componente UI

**Responsabilidade:**
- Drawer lateral responsivo
- Input de mensagens
- Display de histórico com avatar distintos (user/assistant)
- Quick suggestions
- Animação Framer Motion

**Integração:**
```jsx
// App.jsx
const ChatWindow = lazy(() => import('@features/chatbot/components/ChatWindow'))

<Suspense fallback={<ViewSkeleton />}>
  <ChatWindow isOpen={isChatOpen} onClose={setChatOpen(false)} />
</Suspense>
```

**Estilo:** CSS Modules (`ChatWindow.module.css` — 14 classes, separation of concerns)

---

## 🔄 Fluxo de Mensagem

```
User digita → Chat Input
       ↓
validateUserMessage() [safetyGuard]
   ├─ BLOQUEADO? → return { blocked: true, reason: "..." }
   └─ OK? ↓
isRateLimited() [localStorage]
   ├─ LIMITE ATINGIDO? → return { rateLimited: true }
   └─ OK? ↓
buildPatientContext() [contextBuilder]
   ↓
buildSystemPrompt()
   ↓
fetch('/api/chatbot', { message, history, systemPrompt })
       ↓
   api/chatbot.js
   ├─ Zod validation
   ├─ Groq API call
   ├─ Return response
       ↓
addDisclaimerIfNeeded() [safetyGuard]
   ↓
incrementRateCounter() [chatbotService]
   ↓
Return { response, blocked: false, rateLimited: false }
       ↓
Display em ChatWindow
```

---

## 🛡️ Segurança

### Validação em Camadas

| Camada | Responsável | Técnica |
|--------|-------------|---------|
| **Cliente** | `safetyGuard.js` | Regex patterns + localStorage rate limit |
| **Servidor** | `api/chatbot.js` | Zod schema validation |
| **LLM Prompt** | `buildSystemPrompt()` | Instrução explícita para não usar knowledge externo |
| **Response** | `safetyGuard.js` | Adiciona disclaimer em conteúdo médico |

### Proteção contra Alucinação (Bugfix 8.3.1)

**Problema:** LLM respondeu "Selozok = Sertralina" (alucinação farmacológica)

**Solução Multi-Camadas:**
1. **Grounding com Contexto:** `active_ingredient` + `therapeutic_class` no contexto
2. **Parâmetros Conservadores:** `temperature: 0.2` (era 0.7) → menos "criatividade"
3. **Modelo Inteligente:** `groq/compound` (seleção automática)

**Resultado:** LLM erra menos porque:
- Tem informação correta no contexto (SeloZok = Succinato de Metoprolol)
- Parâmetros baixos favorecem tokens de alta probabilidade
- Modelo escolhido conforme complexidade da pergunta

---

## 📊 Estrutura de Dados

### Patient Context (String)
```
Data: DD/MM/YYYY
Medicamentos ativos: N
- NomeMedicamento [PrincipioAtivo, Classe] (dosagem): frequencia, horarios H:MM, estoque N un.
Doses registradas hoje: N
Adesao ultimos 7 dias: N%
```

### Message History (Array)
```javascript
[
  { role: 'user', content: 'Qual meu estoque de metformina?' },
  { role: 'assistant', content: 'Você tem 20 unidades de Metformina...' },
  // ...max 10 mensagens mantidas no historico
]
```

### Rate Limit (localStorage)
```javascript
{
  windowStart: 1711000000000,  // timestamp ms
  count: 5                      // mensagens nesta janela
}
```

---

## 🧪 Testes

**Arquivo:** `src/features/chatbot/__tests__/`

| Teste | Arquivo | Coverage |
|-------|---------|----------|
| `contextBuilder.test.js` | Contexto compacto, ausência de IDs, therapeutic_class | 11 testes ✅ |
| `safetyGuard.test.js` | Bloqueio de padrões, disclaimer, ausência de null | 15 testes ✅ |
| `chatbotService.test.js` | Rate limit, validação, fetch, error handling | 7 testes ✅ |

**Total:** 33/33 testes ✅ (Sprint 8.3.1)

**Mock localStorage (AP-T03):**
```javascript
const mockLocalStorage = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
vi.stubGlobal('localStorage', mockLocalStorage)
```

---

## 📈 Performance & Budget

### Bundle Impact
- **ChatWindow chunk:** 3.23 kB gzip (lazy-loaded)
- **groq-sdk:** 20 KB (server-side only, não no client bundle)
- **Main bundle:** 0 KB adicionado (tudo lazy)

### Serverless Budget
- **Função:** `api/chatbot.js` (slot 7/12)
- **maxDuration:** default (padrão do Vercel, ~30s)
- **Rate Limit Groq:** 30 req/min (free tier)

### Rate Limit Client
- **Limite:** 30 mensagens por hora
- **Armazenamento:** localStorage (sessão persistida)
- **Implementação:** Janela deslizante com timestamp

---

## 💾 Persistência de Histórico (Sprint 8.3.3)

### Visão Geral

O usuário pode agora recuperar o histórico de conversas anteriores ao fechar e reabrir o painel do chatbot. As conversas são persistidas no `localStorage` com timestamps relativos para contexto temporal.

### Armazenamento

**Chave localStorage:** `mr_chat_history`

**Estrutura:**
```javascript
[
  {
    role: 'user' | 'assistant',
    content: string,
    timestamp: number  // unix ms
  },
  // ... max 20 mensagens (10 turnos)
]
```

### Componentes Novos / Modificados

**chatbotConfig.js:**
```javascript
export const CHATBOT_HISTORY_STORAGE_KEY = 'mr_chat_history'
export const CHATBOT_HISTORY_MAX_DISPLAY = 20
export function createWelcomeMessage() // → mensagem inicial reutilizável
```

**chatbotService.js:**
```javascript
export function loadPersistedHistory()         // → carrega do localStorage
export function savePersistedHistory(messages) // → salva com limite
export function clearPersistedHistory()        // → limpa ao usuario pedir
```

**ChatWindow.jsx:**
- Lazy init: `useState(() => loadPersistedHistory() || [createWelcomeMessage()])`
- Helper `addMessage()` — encapsula duplicação de save + setState
- Funções puras movidas para fora do componente (performance):
  - `formatMessageTime(timestamp)` — "às 14:30", "Ontem às 09:15"
  - `shouldShowDateSeparator(msgs, idx)` — compara `toDateString()`
  - `formatDaySeparator(timestamp)` — "Hoje", "Ontem", "15/03"
- Fix DST: `yesterday.setDate(now.getDate() - 1)` (não `now - 86400000`)
- Botão "Limpar conversa" (🗑️) com confirmação

**ChatWindow.module.css:**
```css
.messageTime       /* timestamp abaixo da bolha */
.dateSeparator     /* separador com linhas decorativas */
.headerActions     /* flex container para botões */
.clearButton       /* trash icon com hover */
```

### UX Improvements

| Antes | Depois |
|-------|--------|
| Chat sempre começa vazio | Histórico recuperado |
| Sem informação de tempo | Timestamps relativos + separadores de data |
| Sem forma de limpar | Botão "Limpar conversa" com confirmação |
| Funções recreadas a cada render | Funções puras fora do componente |

### Backward Compatibility

- Histórico antigo sem timestamps é graciosamente descartado
- Primeiro load com histórico vazio = mensagem de boas-vindas

---

## ⚡ Groq Prompt Caching Strategy (Sprint 8.5)

### Visão Geral

Implementação de **Groq Prompt Caching** para otimizar custo e latência em conversas multi-turn. Groq oferece **50% desconto em tokens já processados** (_cached_prompt_tokens_), permitindo reutilização de conteúdo estático.

### Arquitetura de Cache

**Objetivo:** Estruturar prompts para maximizar cache hit rate.

**Padrão aplicado em TODAS as versões do prompt:**

```
┌─────────────────────────────────────┐
│ PARTE ESTÁTICA (reutilizável)       │  ← Cacheada a cada request
│ - Instruções de sistema             │  ← 50% desconto em tokens
│ - Regras absolutas                  │
│ - Contexto de app (Dosiq)   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ PARTE DINÂMICA (muda por conversa)  │
│ - Dados do paciente (medicamentos)  │
│ - Adesão, estoque, etc.             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ MENSAGEM ATUAL (muda a cada turn)   │
│ - Pergunta do usuário               │
└─────────────────────────────────────┘
```

**Benefício:** Sistema prompt (primeira 20+ linhas) é reutilizado em **100% das conversas**, ganhando 50% de desconto em ~50% dos tokens.

### Implementação

#### 1. Refatoração de buildSystemPrompt (Web + Telegram)

**Nova função helper:**
```javascript
// contextBuilder.js (web) + chatbotServerService.js (Telegram)

export function buildStaticSystemRules() {
  return [
    'Você é um assistente virtual do app Meus Remedios.',
    'Você ajuda o paciente a gerenciar seus medicamentos de forma amigavel.',
    'REGRAS ABSOLUTAS:',
    '- NUNCA recomende dosagens, diagnosticos ou substituicoes de medicamentos.',
    '- NUNCA sugira parar ou alterar tratamento sem consultar o medico.',
    // ... 10+ linhas de regras
  ].join('\n')  // ~20 linhas, ~200 tokens
}

export function buildSystemPrompt(patientContext) {
  const staticRules = buildStaticSystemRules()  // cache-friendly
  return [
    staticRules,
    '',
    'DADOS DO PACIENTE:',
    patientContext,
  ].join('\n')
}
```

**Resultado:**
- **Regras estáticas:** ~200 tokens (reutilizadas 100% das vezes)
- **Contexto dinâmico:** ~100-150 tokens (diferente por paciente)
- **Total:** ~300-350 tokens por request

#### 2. Logging de Cache Hit Rate

**Implementado em:**
- `api/chatbot.js` (Vercel serverless, web/PWA)
- `server/bot/services/chatbotServerService.js` (Telegram)

**Métricas capturadas:**

```javascript
const promptTokens = completion.usage?.prompt_tokens || 0
const cachedTokens = completion.usage?.cached_prompt_tokens || 0
const cacheHitRate = (cachedTokens / promptTokens) * 100
const estimatedSavings = cachedTokens * 0.5  // 50% desconto

logger.info('✅ Groq respondeu', {
  promptTokens,           // 300
  cachedTokens,           // 100 (cache hit)
  cacheHitRate: '33%',    // cálculo
  estimatedTokenSavings: 50,  // tokens economizados
})
```

**Exemplo de log esperado (Vercel):**
```json
{
  "timestamp": "2026-03-20T21:48:00Z",
  "service": "chatbot-api",
  "promptTokens": 300,
  "cachedTokens": 100,
  "cacheHitRate": "33%",
  "estimatedTokenSavings": 50
}
```

### Impacto Econômico

**Cenário:** Conversa multi-turn com 5 turnos (user → bot × 5)

| Métrica | Sem Cache | Com Cache | Economia |
|---------|-----------|-----------|----------|
| Prompt tokens por turn | 300 | 150 (cached 50%) | 150 tokens |
| Custo por turn | 300 × base | (150 + 75 desconto) | -50% |
| Total 5 turns | 1500 tokens | 900 tokens | **-40%** |
| Free tier (10k tokens) | ~33 conversas | ~55 conversas | **+67%** |

### Monitoramento

**Como verificar cache hit rate em produção:**

1. **Vercel Logs:**
   ```bash
   vercel logs --prod | grep cacheHitRate
   ```

2. **Local (dev):**
   ```bash
   npm run dev
   # Enviar mensagem ao chatbot
   # Verificar console logs com "cachedTokens", "cacheHitRate"
   ```

3. **Alertas sugeridos:**
   - Alerta se `cacheHitRate < 20%` → possível regressão ou mudança de estrutura
   - Alerta se `estimatedTokenSavings < expected` → cache behavior alterado

### Próximas Otimizações (Roadmap)

1. **Separar contexto paciente dinâmico:** Colocar em sub-mensagem para cache max
2. **Pré-aquecimento de cache:** Enviar sistema prompt vazio antes de primeiro turn real
3. **Análise de cache hit rate:** Dashboard visualizando economia de tokens
4. **Groq Pro (futuro):** Se volume crescer, Groq Pro oferece cache ainda mais otimizado

### Referências

- **Groq Prompt Caching Docs:** https://console.groq.com/docs/caching
- **Implementação:** `src/features/chatbot/services/contextBuilder.js`, `api/chatbot.js`, `server/bot/services/chatbotServerService.js`
- **Branch de implementação:** `feature/8-5-chatbot-groq-optimization` (merged)
- **Journal entry:** `.memory/journal/2026-W12.md` (Sprint 8.5)

---

## 🔌 Extensões Futuras

### 1. **Integração com Telegram Bot** ✅ Sprint 8.3.2 + Sprint 8.5 (Debug Fix)

Implementado em `server/bot/` com arquitetura server-side:

```
Telegram msg (texto)
  → webhook handler (api/telegram.js — Vercel entry point)
      → logs estruturados AQUI (visível em Vercel prod)
      → dispatch: command vs message vs callback_query
      ↓ (para textos livres)
  → handleChatbotMessage (server/bot/commands/chatbot.js)
      → getUserIdByChatId() — verifica vinculação
      → sendTelegramChatMessage() (server/bot/services/chatbotServerService.js)
          → validateServerMessage() — safetyGuard patterns
          → isServerRateLimited() — 30 msg/hora via Map em memória
          → fetchPatientData() — busca Supabase (medicines + protocols + logs + stock)
          → buildServerContext() + buildServerSystemPrompt()
          → Groq SDK (temperature 0.2, top_p 1.0)
          → addServerDisclaimer()
          → updateConversationHistory() — histórico por userId (max 10)
      → bot.sendMessage(chatId, response)
```

**Debugging Journey (Sprint 8.5):**

User testou chatbot IA no Telegram → "não aconteceu nada" → 3-layer bug fix:

| Camada | Problema | Root Cause | Fix | Impacto |
|--------|----------|-----------|-----|---------|
| **1. Observabilidade** | Logs não visíveis em Vercel | Structured logging em `server/bot/**` (Node context) invisível para Vercel | Adicionar logging em `api/telegram.js` (serverless entry point) | Logs agora visíveis em prod (R-132) |
| **2. Lógica** | Mensagens sem sessão ignoradas silenciosamente | Router não tinha fallback para mensagens livres | Adicionar `else { handleChatbotMessage() }` em conversational.js | Textos livres agora routeados (R-133) |
| **3. API Compatibility** | `bot.sendChatAction is not a function` | Mock bot adapter incompleto (faltava sendChatAction) | Implementar method no adapter | Typing indicator funcionando |

**Lições de Integração:**

1. **Logging em contextos diferentes:** Node.js server vs Vercel serverless são VMs separadas. Logs estruturados DEVEM estar no entry point Vercel (`api/telegram.js`), não em níveis inferiores.

2. **Event-driven dispatch:** Quando múltiplos handlers competem (commands específicos vs fallback conversacional), SEMPRE ter fallback explícito + logging. Casos não-capturados caem silenciosamente.

3. **Mock completeness:** Testar localmente que mock bot implementa TODOS os métodos que handlers chamam. Interface incompleta = erro silencioso em produção.

4. **Multi-channel adaptation:** Web chatbot reutiliza contextBuilder + safetyGuard + Groq. Telegram precisa de adaptação:
   - Dados: DashboardContext → Supabase queries direto
   - Rate limit: localStorage → Map em memória
   - Groq call: `/api/chatbot` endpoint → SDK direto

**Diferenças em relação ao canal Web:**

| Aspecto | Web (ChatWindow) | Telegram |
|---------|-----------------|----------|
| Rate limit | localStorage (30 msg/hora) | Map em memória (30 msg/hora) |
| Dados paciente | DashboardContext (React context) | Supabase queries (server-side) |
| Groq call | Vercel endpoint `/api/chatbot` | Groq SDK direto no server |
| Histórico | Estado React (Suspense) | Map por userId (em memória) |
| Graceful degradation | Mensagem UI "chatbot disabled" | Silencioso (não vinculado = sem resposta) |
| Logging | Console + Vercel (ChatWindow.jsx logs) | Structured logs em `api/telegram.js` |

**Env vars necessárias no servidor:** `GROQ_API_KEY` (requerido), `LOG_LEVEL` (optional, default: INFO)

### 2. **Multi-Canal** (Roadmap)
- WhatsApp Business API
- SMS (IVRY)
- Voice (Google Duplex)

### 3. **Fine-Tuning** (Phase 9+)
- Treinar modelo com histórico de pacientes
- Melhorar factual recall sobre medicamentos brasileiros

### 4. **Offline Mode** (Phase 8+)
- Cache de respostas frequentes
- Fallback quando Groq indisponível

---

## 🎓 Decisões de Design

### 1. **ChatWindow chama `useDashboard()` diretamente**
❌ **Evitado:** Prop drilling via App.jsx
✅ **Motivo:** App.jsx é wrapper, não filho do DashboardProvider

### 2. **Groq SDK instanciado no handler**
❌ **Evitado:** No topo do módulo
✅ **Motivo:** Evita crash quando `GROQ_API_KEY` indefinida

### 3. **contextBuilder usa `stockSummary` + fallback**
❌ **Evitado:** Assumir estrutura de DashboardContext
✅ **Motivo:** Sempre verificar retorno real do hook antes de implementar

### 4. **Rate limit no cliente**
❌ **Evitado:** Rate limit só no servidor
✅ **Motivo:** Feedback instantâneo ao usuário, reduce API calls

### 5. **Temperature 0.2 + top_p 1.0**
❌ **Evitado:** Parâmetros altos (0.7 + 0.9) = alucinação
✅ **Motivo:** LLM médico precisa ser conservador

---

## 📚 Referências

| Tópico | Arquivo |
|--------|---------|
| **Rules** | `.memory/rules.md` (R-060, R-062, R-090, R-117) |
| **Anti-patterns** | `.memory/anti-patterns.md` (AP-T03, AP-B01, AP-B02) |
| **Journal** | `.memory/journal/2026-W12.md` (Sprint 8.3 + 8.3.1) |
| **Execução** | `plans/EXEC_SPEC_FASE_8.md` (seção 7 + 7.9) |
| **Zod** | `docs/reference/SCHEMAS.md` |
| **Mobile Perf** | `docs/standards/MOBILE_PERFORMANCE.md` (lazy loading) |

---

## ✅ Checklist Pré-Produção (Web)

- [x] contextBuilder: sem IDs/UUIDs, < 2000 tokens
- [x] safetyGuard: bloqueia dosagem/diagnóstico/parar/efeito colateral
- [x] chatbotService: rate limit 30/hora via localStorage
- [x] api/chatbot.js: Zod validation, Groq SDK no handler
- [x] ChatWindow: lazy-loaded, CSS Modules, animação Framer
- [x] Testes: 33/33 passando, localStorage mock (AP-T03)
- [x] Bugfix 8.3.1: active_ingredient + therapeutic_class, temperature 0.2
- [x] Documentação: AGENTS.md + CLAUDE.md atualizado

## ✅ Checklist Telegram Integration (Sprint 8.5 — Debug & Fix)

- [x] api/telegram.js: Logging estruturado no entry point Vercel (R-132)
- [x] server/bot/callbacks/conversational.js: Fallback listener para mensagens livres (R-133)
- [x] api/telegram.js bot adapter: Implementar `sendChatAction` (R-134)
- [x] Verificar mock completeness: todos `bot.*` chamados existem no adapter
- [x] Testes: 539/539 ainda passando (zero regressão)
- [x] Logs: cadeia completa visível em Vercel (webhook → roteamento → contexto → Groq → resposta)
- [x] Manual test: resposta correta do chatbot no Telegram

## ✅ Checklist Groq Prompt Caching (Sprint 8.5 — Performance Optimization)

- [x] Refatorar buildSystemPrompt em contextBuilder.js: extrair buildStaticSystemRules()
- [x] Refatorar buildSystemPrompt em chatbotServerService.js: extrair buildStaticSystemRules()
- [x] Implementar logging de cache hit rate em api/chatbot.js
- [x] Implementar logging de cache hit rate em chatbotServerService.js
- [x] Padronizar nomes de métricas (promptTokens, cachedTokens, etc.) entre canais
- [x] Documentação de estratégia de caching em CHATBOT_AI.md
- [x] Testes: 539/539 ainda passando (zero regressão)
- [x] Verificação: ambos canais (web + Telegram) com mesma estrutura de prompt

---

*Última atualização: 2026-03-20*
*Versão: 1.4 (Sprint 8.5 — Groq Prompt Caching Optimization)*
*Status: ✅ Production Ready (Web + Telegram + History + Caching Optimized)*
