# Arquitetura — Chatbot IA Multi-Canal (F8.1)

> **Primeira integração de IA no projeto Meus Remédios**
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

## 🔌 Extensões Futuras

### 1. **Integração com Telegram Bot** ✅ Sprint 8.3.2

Implementado em `server/bot/` com arquitetura server-side:

```
Telegram msg (texto)
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

**Diferenças em relação ao canal Web:**

| Aspecto | Web (ChatWindow) | Telegram |
|---------|-----------------|----------|
| Rate limit | localStorage | Map em memória |
| Dados paciente | DashboardContext | Supabase direto |
| Groq call | `/api/chatbot` (Vercel) | Groq SDK direto |
| Histórico | Estado React | Map por userId |
| Graceful degradation | Mensagem UI | Silencioso (não vinculado) |

**Env var necessária no servidor:** `GROQ_API_KEY`

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

## ✅ Checklist Pré-Produção

- [x] contextBuilder: sem IDs/UUIDs, < 2000 tokens
- [x] safetyGuard: bloqueia dosagem/diagnóstico/parar/efeito colateral
- [x] chatbotService: rate limit 30/hora via localStorage
- [x] api/chatbot.js: Zod validation, Groq SDK no handler
- [x] ChatWindow: lazy-loaded, CSS Modules, animação Framer
- [x] Testes: 33/33 passando, localStorage mock (AP-T03)
- [x] Bugfix 8.3.1: active_ingredient + therapeutic_class, temperature 0.2
- [x] Documentação: AGENTS.md + CLAUDE.md atualizado

---

*Última atualização: 2026-03-20*
*Versão: 1.2 (Sprint 8.4 — Chat History Persistence)*
*Status: ✅ Production Ready (Web + Telegram + History)*
