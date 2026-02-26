# Plano de Consolidacao — Serverless Functions (Vercel Hobby)

**Versao:** 1.0
**Data:** 24/02/2026
**Status:** Aprovado — execucao imediata
**Motivacao:** Vercel Hobby limita 12 serverless functions por deploy. Projeto atingiu 13.
**Objetivo:** Consolidar de 13 para 6 funcoes, liberando 6 slots para roadmap 2026.

---

## 1. Problema

O Vercel Hobby plan tem limite rigido de **12 serverless functions por deployment**. Cada `.js` dentro de `api/` e contado como funcao, EXCETO arquivos em diretorios prefixados com `_` ou `.`.

### Inventario Atual: 13 funcoes (ACIMA DO LIMITE)

| # | Arquivo | Tipo | Metodo | Auth |
|---|---------|------|--------|------|
| 1 | `api/dlq.js` | Handler | GET | Supabase JWT + Admin |
| 2 | `api/dlq/[id]/discard.js` | Handler | POST | Supabase JWT + Admin |
| 3 | `api/dlq/[id]/retry.js` | Handler | POST | Supabase JWT + Admin |
| 4 | `api/gemini-reviews/batch-update.js` | Handler | POST | Webhook Secret |
| 5 | `api/gemini-reviews/create-issues.js` | Handler | POST | GitHub Actions JWT |
| 6 | `api/gemini-reviews/persist.js` | Handler | POST | GitHub Actions JWT |
| 7 | `api/gemini-reviews/shared/logger.js` | **Utilitario** | — | — |
| 8 | `api/gemini-reviews/shared/security.js` | **Utilitario** | — | — |
| 9 | `api/gemini-reviews/update-status.js` | Handler | POST | GitHub Actions JWT |
| 10 | `api/health/notifications.js` | Handler | GET | Nenhuma |
| 11 | `api/notify.js` | Handler | GET/POST | Cron Secret |
| 12 | `api/share.js` | Handler | POST | Supabase JWT |
| 13 | `api/telegram.js` | Handler | POST | Webhook URL |

**Nota:** Funcoes 7 e 8 sao utilitarios (nao HTTP handlers) mas o Vercel os conta como funcoes porque o diretorio `shared/` nao tem prefixo `_`.

---

## 2. Estrategia: 3 Tiers de Consolidacao

### Tier 1 — Quick Win: Renomear `shared/` para `_shared/` (13 → 11)

Diretorio prefixado com `_` e excluido da contagem.

**Acoes:**
1. `git mv api/gemini-reviews/shared api/gemini-reviews/_shared`
2. Atualizar imports em 3 arquivos:
   - `api/gemini-reviews/persist.js`: `./shared/` → `./_shared/`
   - `api/gemini-reviews/create-issues.js`: `./shared/` → `./_shared/`
   - `api/gemini-reviews/update-status.js`: `./shared/` → `./_shared/`

**Nota:** `batch-update.js` NAO importa de `shared/` — sem mudanca.

**Resultado:** 13 → 11 funcoes (-2)

---

### Tier 2 — Consolidar Gemini Reviews: 4 handlers → 1 router (11 → 8)

Criar router unico `api/gemini-reviews.js` que despacha por URL path segment.

**Arquitetura final:**
```
api/gemini-reviews.js                         ← ROUTER (unica funcao contada)
api/gemini-reviews/_shared/logger.js          ← nao contado (prefixo _)
api/gemini-reviews/_shared/security.js        ← nao contado (prefixo _)
api/gemini-reviews/_handlers/persist.js       ← nao contado (prefixo _)
api/gemini-reviews/_handlers/create-issues.js ← nao contado (prefixo _)
api/gemini-reviews/_handlers/update-status.js ← nao contado (prefixo _)
api/gemini-reviews/_handlers/batch-update.js  ← nao contado (prefixo _)
```

**Router (`api/gemini-reviews.js`):**
```javascript
import { handlePersist }       from './gemini-reviews/_handlers/persist.js'
import { handleCreateIssues }  from './gemini-reviews/_handlers/create-issues.js'
import { handleUpdateStatus }  from './gemini-reviews/_handlers/update-status.js'
import { handleBatchUpdate }   from './gemini-reviews/_handlers/batch-update.js'

const ROUTES = {
  'persist':        handlePersist,
  'create-issues':  handleCreateIssues,
  'update-status':  handleUpdateStatus,
  'batch-update':   handleBatchUpdate,
}

export default async function handler(req, res) {
  const segments = req.url.split('?')[0].split('/')
  const action = segments[segments.length - 1]
  const routeHandler = ROUTES[action]

  if (!routeHandler) {
    return res.status(404).json({
      success: false,
      error: `Unknown action: ${action}. Valid: ${Object.keys(ROUTES).join(', ')}`
    })
  }

  return routeHandler(req, res)
}
```

**Migracao dos handlers:**
- Mover corpo de cada `.js` para `_handlers/{nome}.js` como `export async function handle{Nome}(req, res)`
- Atualizar imports internos: `./_shared/` → `../_shared/` (um nivel mais profundo)
- Auth permanece DENTRO de cada handler (nao no router) — `batch-update` usa auth diferente

**Deletar:** `persist.js`, `create-issues.js`, `update-status.js`, `batch-update.js` (originais)

**GitHub Actions:** URLs chamadas pelo workflow (`gemini-review.yml` linhas 588, 1099, 1236) sao preservadas pelo rewrite wildcard — **zero mudancas no YAML**.

**Resultado:** 11 → 8 funcoes (-3)

---

### Tier 3 — Consolidar DLQ: 3 handlers → 1 router (8 → 6)

Expandir `api/dlq.js` existente para router que absorve retry e discard.

**Arquitetura final:**
```
api/dlq.js                     ← ROUTER (GET list + POST retry + POST discard)
api/dlq/_handlers/retry.js     ← nao contado (prefixo _)
api/dlq/_handlers/discard.js   ← nao contado (prefixo _)
```

**Router (`api/dlq.js` reescrito):**
```javascript
import { handleRetry }   from './dlq/_handlers/retry.js'
import { handleDiscard } from './dlq/_handlers/discard.js'

export default async function handler(req, res) {
  // Env vars validation
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || !adminChatId) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  // Auth compartilhada (todos os DLQ endpoints usam o mesmo mecanismo)
  const authResult = await verifyAdminAccess(req.headers['authorization'])
  if (!authResult.authorized) {
    return res.status(401).json({ error: authResult.error })
  }

  const action = req.query.action
  const method = req.method

  if (method === 'GET' && !action) return handleList(req, res)
  if (method === 'POST' && action === 'retry') return handleRetry(req, res)
  if (method === 'POST' && action === 'discard') return handleDiscard(req, res)

  return res.status(405).json({ error: 'Method not allowed' })
}
```

**Rewrites em vercel.json:**
```json
{ "source": "/api/dlq/:id/retry", "destination": "/api/dlq.js?action=retry&id=:id" },
{ "source": "/api/dlq/:id/discard", "destination": "/api/dlq.js?action=discard&id=:id" }
```

**Deletar:** `api/dlq/[id]/retry.js`, `api/dlq/[id]/discard.js`, diretorio `api/dlq/[id]/`

**Resultado:** 8 → 6 funcoes (-2)

---

## 3. vercel.json Final

```json
{
  "version": 2,
  "functions": {
    "api/notify.js": { "maxDuration": 60 },
    "api/telegram.js": { "maxDuration": 10 }
  },
  "rewrites": [
    {
      "source": "/api/dlq/:id/retry",
      "destination": "/api/dlq.js?action=retry&id=:id"
    },
    {
      "source": "/api/dlq/:id/discard",
      "destination": "/api/dlq.js?action=discard&id=:id"
    },
    {
      "source": "/api/telegram",
      "destination": "/api/telegram.js"
    },
    {
      "source": "/api/notify",
      "destination": "/api/notify.js"
    },
    {
      "source": "/api/dlq",
      "destination": "/api/dlq.js"
    },
    {
      "source": "/api/health/:path*",
      "destination": "/api/health/:path*.js"
    },
    {
      "source": "/api/gemini-reviews/:action",
      "destination": "/api/gemini-reviews.js"
    },
    {
      "source": "/api/share",
      "destination": "/api/share.js"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 4. Estado Final: 6 Funcoes

| # | Funcao | Descricao |
|---|--------|-----------|
| 1 | `api/dlq.js` | Router DLQ (list + retry + discard) |
| 2 | `api/gemini-reviews.js` | Router Gemini (persist + create-issues + update-status + batch-update) |
| 3 | `api/health/notifications.js` | Health check do sistema de notificacoes |
| 4 | `api/notify.js` | Cron orchestrator (maxDuration: 60) |
| 5 | `api/share.js` | PDF sharing via Vercel Blob |
| 6 | `api/telegram.js` | Telegram webhook (maxDuration: 10) |

**Budget: 6/12 usados → 6 slots livres**

---

## 5. Projecao de Budget por Fase do Roadmap

| Fase | Novos endpoints | Total | Slots livres |
|------|----------------|-------|-------------|
| Atual (pos-consolidacao) | — | 6 | 6 |
| Fase 5 (em andamento) | `share.js` ja adicionado | 6 | 6 |
| Fase 5.5 | Nenhum (client-side) | 6 | 6 |
| Fase 6 | `whatsapp.js` (webhook) | 7 | 5 |
| Fase 7 | `portal.js`, `chatbot.js`, `ocr.js` (condicional) | 8-10 | 2-4 |

Mesmo no cenario maximo da Fase 7, ficamos dentro do limite com folga.

---

## 6. Sequencia de Execucao

Tudo em um unico PR: `refactor/consolidar-serverless-functions`

| Passo | Tier | Acao |
|-------|------|------|
| 1 | T1 | `git mv api/gemini-reviews/shared api/gemini-reviews/_shared` |
| 2 | T1 | Atualizar 3 imports (`persist`, `create-issues`, `update-status`) |
| 3 | T2 | Criar `api/gemini-reviews/_handlers/` com 4 handlers extraidos |
| 4 | T2 | Criar `api/gemini-reviews.js` (router) |
| 5 | T2 | Deletar 4 arquivos originais |
| 6 | T3 | Criar `api/dlq/_handlers/` com `retry.js` e `discard.js` |
| 7 | T3 | Reescrever `api/dlq.js` como router |
| 8 | T3 | Deletar `api/dlq/[id]/` (diretorio inteiro) |
| 9 | All | Atualizar `vercel.json` |
| 10 | All | `npm run validate:agent` |

---

## 7. Verificacao

1. **Pre-deploy:** `npm run validate:agent`
2. **Pos-deploy (Vercel preview):**
   - Dashboard Vercel mostra exatamente 6 funcoes
   - `GET /api/dlq` → responde 401 ou 200
   - `POST /api/dlq/{uuid}/retry` → responde 401 ou executa
   - `POST /api/dlq/{uuid}/discard` → responde 401 ou executa
   - GitHub Actions workflow funciona (persist, create-issues, update-status)
   - `GET /api/health/notifications` → responde 200
   - `POST /api/share` → responde 401 (sem auth)
3. **Nao-regressao:** `notify.js` e `telegram.js` nao sao tocados

---

## 8. Detalhes Tecnicos

### Auth por Router

**Gemini Reviews Router:** NAO faz auth. Cada handler mantem sua propria:
- `persist`, `create-issues`, `update-status` → JWT (`VERCEL_GITHUB_ACTIONS_SECRET`)
- `batch-update` → `crypto.timingSafeEqual` (`AGENT_WEBHOOK_SECRET`)

**DLQ Router:** Faz auth UMA VEZ antes do dispatch (todos usam `verifyAdminAccess`).

### Rate Limiter

O `rateLimitMap` em `_shared/security.js` e in-memory por instancia. Apos consolidacao, todos os actions Gemini compartilham a mesma instancia warm — melhoria de seguranca (rate limit global por IP).

### maxDuration

- `notify.js`: 60s (nao pode ser merged com endpoints rapidos)
- `telegram.js`: 10s (nao pode ser merged com endpoints longos)
- Routers DLQ e Gemini: default (300s com Fluid Compute)

---

*Documento gerado em: 24/02/2026*
*Referencia: Vercel Hobby Plan Limits, EXEC_SPEC_FASE_5.md*
