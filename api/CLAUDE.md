# api/ — Vercel Serverless Functions

> Referencia para agentes criando ou modificando endpoints API.

## REGRA #1: Function Budget (CRITICO)

**Vercel Hobby: maximo 12 serverless functions por deploy.**

Cada `.js` dentro de `api/` conta como funcao, EXCETO arquivos em diretorios prefixados com `_` ou `.`.

### Budget Atual

| # | Funcao | Descricao | maxDuration |
|---|--------|-----------|-------------|
| 1 | `api/dlq.js` | Router DLQ (list + retry + discard) | default |
| 2 | `api/gemini-reviews.js` | Router Gemini (persist + create-issues + update-status + batch-update) | default |
| 3 | `api/health/notifications.js` | Health check do sistema de notificacoes | default |
| 4 | `api/notify.js` | Cron orchestrator | 60s |
| 5 | `api/share.js` | PDF sharing via Vercel Blob | default |
| 6 | `api/telegram.js` | Telegram webhook | 10s |

**Total: 6/12 funcoes → 6 slots livres**

### Projecao de Budget (Roadmap 2026)

| Fase | Novos endpoints | Total | Livres |
|------|----------------|-------|--------|
| Fase 5 (atual) | `share.js` ja adicionado | 6 | 6 |
| Fase 5.5 | Nenhum (client-side) | 6 | 6 |
| Fase 6 | `whatsapp.js` | 7 | 5 |
| Fase 7 | `portal.js`, `chatbot.js`, `ocr.js` | 8-10 | 2-4 |

### Antes de Criar QUALQUER Novo Arquivo .js em api/

1. Verificar budget: quantas funcoes existem? (`find api -name "*.js" -not -path "*/_*" -not -path "*/.*" | wc -l`)
2. Se >=10 funcoes: CONSOLIDAR em router existente ao inves de criar novo
3. Utilitarios/helpers DEVEM estar em diretorios com prefixo `_`:
   - `api/gemini-reviews/_shared/` — logger, security
   - `api/gemini-reviews/_handlers/` — handler functions
   - `api/dlq/_handlers/` — handler functions
4. NUNCA criar `.js` na raiz de `api/` sem verificar se cabe no budget

---

## Padrao de Endpoint

```javascript
// api/exemplo.js
import { createClient } from '@supabase/supabase-js'

// Validacao de env vars NO STARTUP (fail fast)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // 1. Metodo HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 2. Autenticacao (se necessario)
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // 3. Validacao de input (Zod recomendado)
    const { data, error } = validateInput(req.body)
    if (error) return res.status(400).json({ error })

    // 4. Logica de negocio
    const result = await processData(data)

    // 5. Response — SEMPRE res.status(code).json(body)
    return res.status(200).json({ success: true, data: result })

  } catch (err) {
    console.error('[exemplo] Error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

## Padrao de Router (para consolidar endpoints)

```javascript
// api/domain.js — Router pattern
import { handleAction1 } from './domain/_handlers/action1.js'
import { handleAction2 } from './domain/_handlers/action2.js'

const ROUTES = {
  'action1': handleAction1,
  'action2': handleAction2,
}

export default async function handler(req, res) {
  // Se auth e compartilhada, fazer ANTES do dispatch
  // Se auth difere por action, fazer DENTRO de cada handler

  const action = req.query.action  // via rewrite query params
  // OU extrair do URL path: req.url.split('?')[0].split('/').pop()

  const routeHandler = ROUTES[action]
  if (!routeHandler) {
    return res.status(404).json({ error: `Unknown action: ${action}` })
  }

  return routeHandler(req, res)
}
```

**vercel.json rewrite para router:**
```json
{ "source": "/api/domain/:id/action1", "destination": "/api/domain.js?action=action1&id=:id" }
```

---

## REGRAS CRITICAS

### Response Format
```javascript
// CORRETO — Vercel serverless
return res.status(200).json({ data })
return res.status(400).json({ error: 'Bad request' })
return res.status(500).json({ error: 'Internal error' })

// ERRADO — estilo Express (NAO funciona no Vercel)
return res.json({ data })        // NAO USAR
return res.send({ data })        // NAO USAR
```

### Environment Variables
```javascript
// SEMPRE fornecer fallback
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

// SEMPRE validar no startup
if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
```

### Vercel Blob (Storage)
```javascript
// Blobs privados REQUEREM autenticacao
const token = process.env.BLOB_READ_WRITE_TOKEN
const response = await fetch(blobUrl, {
  headers: { Authorization: `Bearer ${token}` }
})
```

### Proibicoes
- NUNCA `process.exit()` — usar `throw new Error()` (serverless termina a funcao)
- NUNCA `res.json()` sem `.status()` antes
- NUNCA commitar env vars ou secrets
- NUNCA criar `.js` em `api/` sem verificar function budget (R-090)
- NUNCA colocar utilitarios em `api/` sem prefixo `_` no diretorio (R-091)

---

## Arquitetura de Routers

### DLQ Router (`api/dlq.js`)

| Rota | Metodo | Action | Descricao |
|------|--------|--------|-----------|
| `/api/dlq` | GET | — | Lista entries com paginacao |
| `/api/dlq/:id/retry` | POST | retry | Retry de notificacao falhada |
| `/api/dlq/:id/discard` | POST | discard | Descartar notificacao |

**Auth:** Compartilhada — `verifyAdminAccess()` (Supabase JWT + ADMIN_CHAT_ID) executada UMA VEZ no router.
**Handlers:** `api/dlq/_handlers/retry.js`, `api/dlq/_handlers/discard.js`

### Gemini Reviews Router (`api/gemini-reviews.js`)

| Rota | Action | Auth | Descricao |
|------|--------|------|-----------|
| `/api/gemini-reviews/persist` | persist | JWT | Persistir reviews do Gemini |
| `/api/gemini-reviews/create-issues` | create-issues | JWT | Criar issues no GitHub |
| `/api/gemini-reviews/update-status` | update-status | JWT | Atualizar status de review |
| `/api/gemini-reviews/batch-update` | batch-update | Webhook Secret | Batch update de agente |

**Auth:** NAO compartilhada — cada handler faz sua propria (JWT vs webhook secret).
**Handlers:** `api/gemini-reviews/_handlers/*.js`
**Utilitarios:** `api/gemini-reviews/_shared/logger.js`, `api/gemini-reviews/_shared/security.js`

### Standalone Handlers

| Endpoint | Metodo | Auth | Descricao |
|----------|--------|------|-----------|
| `/api/notify` | GET/POST | `CRON_SECRET` | Cron de notificacoes (maxDuration: 60s) |
| `/api/telegram` | POST | Webhook URL | Telegram bot webhook (maxDuration: 10s) |
| `/api/share` | POST | Supabase JWT | Upload PDF para Vercel Blob |
| `/api/health/notifications` | GET | Nenhuma | Health check |

---

## vercel.json — Rewrites

Ao adicionar novo endpoint, adicionar rewrite ANTES do catch-all:

```json
{
  "rewrites": [
    { "source": "/api/novo-endpoint", "destination": "/api/novo-endpoint.js" },
    // ... outros rewrites ...
    { "source": "/(.*)", "destination": "/index.html" }  // CATCH-ALL — SEMPRE POR ULTIMO
  ]
}
```

Para router com query params:
```json
{ "source": "/api/domain/:id/action", "destination": "/api/domain.js?action=action&id=:id" }
```

Tambem adicionar config de funcao se necessario:
```json
{
  "functions": {
    "api/novo-endpoint.js": { "maxDuration": 30 }
  }
}
```

---

## Mecanismos de Auth

| Padrao | Usado por | Mecanismo |
|--------|-----------|-----------|
| Supabase Auth JWT | DLQ router, share.js | `supabase.auth.getUser(token)` ou `verifyAdminAccess()` |
| GitHub Actions JWT | Gemini persist/create-issues/update-status | `jwt.verify(token, VERCEL_GITHUB_ACTIONS_SECRET)` |
| Webhook Secret | Gemini batch-update | `crypto.timingSafeEqual` vs `AGENT_WEBHOOK_SECRET` |
| Cron Secret | notify.js | Comparacao direta vs `CRON_SECRET` |

---

## Logging Estruturado

```javascript
// Padrao de log para endpoints
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  endpoint: '/api/exemplo',
  correlationId: req.headers['x-correlation-id'] || crypto.randomUUID(),
  action: 'process_request',
  duration_ms: Date.now() - startTime
}))
```

---

## Cron Jobs

O cron principal esta em `api/notify.js`, acionado por cron-job.org com Bearer token (`CRON_SECRET`).

Schedule (timezone: America/Sao_Paulo):
- Cada minuto: dose reminders
- 23:00 diario: daily digest
- 09:00 diario: stock alerts + DLQ digest
- 08:00 diario: titulation alerts
- 23:00 domingos: adherence reports
- 10:00 dia 1: monthly report

Para adicionar novo cron: estender a logica em `api/notify.js` com novo horario/condicao.

---

## Estrutura de Arquivos

```
api/
  CLAUDE.md                          ← este arquivo (nao e funcao)
  dlq.js                             ← FUNCAO 1 (router DLQ)
  dlq/
    _handlers/
      retry.js                       ← handler extraido (nao contado)
      discard.js                     ← handler extraido (nao contado)
  gemini-reviews.js                  ← FUNCAO 2 (router Gemini)
  gemini-reviews/
    _shared/
      logger.js                      ← utilitario (nao contado)
      security.js                    ← utilitario (nao contado)
    _handlers/
      persist.js                     ← handler extraido (nao contado)
      create-issues.js               ← handler extraido (nao contado)
      update-status.js               ← handler extraido (nao contado)
      batch-update.js                ← handler extraido (nao contado)
  health/
    notifications.js                 ← FUNCAO 3
  notify.js                          ← FUNCAO 4 (maxDuration: 60)
  share.js                           ← FUNCAO 5
  telegram.js                        ← FUNCAO 6 (maxDuration: 10)
```

---

*Ultima atualizacao: 24/02/2026*
*Plano de consolidacao: `plans/SERVERLESS_CONSOLIDATION.md`*
