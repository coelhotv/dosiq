# Chatbot IA — Persistência de Histórico de Conversa

> Sprint: 8.4 (sugestão)
> Status: Planejado
> Autor: Claude (planejamento automático)
> Data: 2026-03-20

---

## Contexto

O chatbot IA (`ChatWindow.jsx`) reinicia do zero toda vez que o usuário fecha e abre o painel. O estado `messages` é puramente in-memory e reseta no unmount. Isso força o usuário a repetir perguntas e perde o fluxo de conversa entre navegações.

**Objetivo:** Persistir as últimas N interações localmente, recarregando o histórico ao abrir o chat, e exibir informação de tempo nas mensagens para contextualizar respostas sensíveis ao tempo (adesão, doses do dia, estoque etc).

---

## Decisão de Design

### Storage: localStorage (não DB)
- Rate limiting já usa `localStorage` (`mr_chat_rate`) — padrão consistente
- Histórico é device-specific: aplicativo pessoal, sem necessidade de sync cross-device
- Sem latência de rede, sem migrações de schema, sem RLS
- Chave nova: `mr_chat_history` (consistente com `mr_chat_rate`)

### N mensagens: 20 mensagens (10 turnos)
- Alinhado com `CHATBOT_MAX_HISTORY = 10` (limite enviado ao LLM)
- Suficiente para recuperar contexto sem UI poluída
- Tamanho estimado: ~5–10 KB por conversa (bem abaixo dos 5 MB do localStorage)

### Estrutura da mensagem (nova)
```js
// Antes
{ role: 'user' | 'assistant', content: string }

// Depois
{ role: 'user' | 'assistant', content: string, timestamp: number }  // unix ms
```
O campo `timestamp` é strip antes de enviar ao LLM (apenas `{role, content}` vai ao histórico da API).

### Exibição de tempo
| Quando | Formato |
|--------|---------|
| Hoje | `às 14:30` |
| Ontem | `Ontem às 09:15` |
| Mais antigo | `15/03 às 17:42` |

---

## Escopo de Alterações

### 1. `chatbotConfig.js` — adicionar constantes
```js
export const CHATBOT_HISTORY_STORAGE_KEY = 'mr_chat_history'
export const CHATBOT_HISTORY_MAX_DISPLAY = 20   // mensagens persistidas/exibidas
```

### 2. `chatbotService.js` — funções de persistência

Adicionar três funções exportadas:

**`loadPersistedHistory()`**
- Lê `mr_chat_history` do localStorage
- Valida estrutura mínima: array de `{role, content, timestamp}`
- Retorna `[]` em caso de parse error ou ausência
- Descarta entradas sem `timestamp` (backward compat — histórico antigo sem timestamp é descartado silenciosamente)

**`savePersistedHistory(messages)`**
- Filtra a mensagem de boas-vindas inicial (não persistir)
- Mantém apenas os últimos `CHATBOT_HISTORY_MAX_DISPLAY` itens
- Serializa para `mr_chat_history`

**`clearPersistedHistory()`**
- Remove `mr_chat_history` do localStorage
- Usado pelo botão "Limpar conversa" na UI

Não altera `sendChatMessage()` — o `history` enviado à API já é sliced para `MAX_HISTORY` e apenas usa `{role, content}`.

### 3. `ChatWindow.jsx` — carregamento, salvamento e display

**Inicialização com histórico:**
```jsx
// Antes
const [messages, setMessages] = useState([welcomeMessage])

// Depois
const [messages, setMessages] = useState(() => {
  const persisted = loadPersistedHistory()
  return persisted.length > 0 ? persisted : [welcomeMessageWithTimestamp]
})
```
A mensagem de boas-vindas também recebe `timestamp: Date.now()` para consistência.

**Timestamp ao adicionar mensagem:**
```jsx
// Ao adicionar mensagem do usuário
{ role: 'user', content: userMessage, timestamp: Date.now() }

// Ao adicionar resposta do assistente
{ role: 'assistant', content: result.response, timestamp: Date.now() }
```

**Salvar após cada resposta:**
```jsx
setMessages(prev => {
  const next = [...prev, { role: 'assistant', content: result.response, timestamp: Date.now() }]
  savePersistedHistory(next)
  return next
})
```

**Renderização com timestamp:**
```jsx
{messages.map((msg, i) => (
  <>
    {/* Separador de data (quando msg i e i-1 são de dias diferentes) */}
    {shouldShowDateSeparator(messages, i) && (
      <div className={styles.dateSeparator}>{formatDaySeparator(msg.timestamp)}</div>
    )}
    <div className={styles.messageBubble} ...>
      {msg.content}
      {msg.timestamp && (
        <span className={styles.messageTime}>{formatMessageTime(msg.timestamp)}</span>
      )}
    </div>
  </>
))}
```

**Botão "Limpar conversa":**
- Ícone lixeira no header do ChatWindow (ao lado do botão fechar)
- Ao clicar: `clearPersistedHistory()` + reset para `[welcomeMessageWithTimestamp]`

### 4. `ChatWindow.module.css` — estilos novos

```css
/* Timestamp abaixo da bolha */
.messageTime {
  display: block;
  font-size: 0.65rem;
  opacity: 0.5;
  text-align: right;
  margin-top: 3px;
}

/* Separador de data entre dias */
.dateSeparator {
  text-align: center;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  opacity: 0.6;
  margin: 8px 0;
  position: relative;
}
.dateSeparator::before,
.dateSeparator::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 35%;
  height: 1px;
  background: var(--color-border, #333);
}
.dateSeparator::before { left: 0; }
.dateSeparator::after { right: 0; }
```

---

## Funções Utilitárias a Criar (inline em ChatWindow.jsx)

```js
// Formato de hora da mensagem
function formatMessageTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString()
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `às ${timeStr}`
  if (isYesterday) return `Ontem às ${timeStr}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${timeStr}`
}

// Verifica se deve mostrar separador de dia
function shouldShowDateSeparator(messages, index) {
  if (index === 0) return false
  const prev = new Date(messages[index - 1].timestamp).toDateString()
  const curr = new Date(messages[index].timestamp).toDateString()
  return prev !== curr
}

// Label do separador de dia
function formatDaySeparator(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString()
  if (isToday) return 'Hoje'
  if (isYesterday) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}
```

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/features/chatbot/config/chatbotConfig.js` | +2 constantes: `CHATBOT_HISTORY_STORAGE_KEY`, `CHATBOT_HISTORY_MAX_DISPLAY` |
| `src/features/chatbot/services/chatbotService.js` | +3 funções: `loadPersistedHistory`, `savePersistedHistory`, `clearPersistedHistory` |
| `src/features/chatbot/components/ChatWindow.jsx` | Inicialização lazy com histórico, timestamps em mensagens, separadores de data, botão limpar |
| `src/features/chatbot/components/ChatWindow.module.css` | +2 classes: `.messageTime`, `.dateSeparator` |
| `src/features/chatbot/__tests__/chatbotService.test.js` | +testes para as 3 novas funções de persistência |

---

## O que NÃO muda

- `api/chatbot.js` (serverless) — sem alterações; a API continua recebendo `{role, content}[]`
- `server/bot/services/chatbotServerService.js` (Telegram) — histórico server-side já é in-memory por userId, adequado para Telegram
- Rate limiting (`mr_chat_rate`) — sem alterações
- LLM context building — sem alterações; timestamps são removidos antes de enviar ao Groq

---

## Verificação (como testar)

1. Abrir o chatbot, enviar 2–3 mensagens
2. Fechar (✕) e reabrir (FAB 🤖) — histórico deve aparecer com timestamps
3. Navegar para outra view, voltar e reabrir — histórico mantido
4. Recarregar a página — histórico mantido
5. Confirmar separador de data aparece ao testar com mensagens de ontem (manipular `Date.now` no console ou aguardar meia-noite)
6. Clicar "Limpar conversa" — volta para apenas a mensagem de boas-vindas
7. Verificar localStorage: `JSON.parse(localStorage.getItem('mr_chat_history'))` deve ter array com `timestamp`

---

## Estimativa de Esforço

- `chatbotService.js`: ~30 linhas adicionais
- `ChatWindow.jsx`: ~40 linhas adicionais (inicialização + render + botão)
- `ChatWindow.module.css`: ~20 linhas adicionais
- `chatbotConfig.js`: 2 linhas
- Testes: ~50 linhas

**Total estimado: ~140 linhas** — sprint pequeno, baixo risco.
