# api/ — Vercel Serverless Functions

> Referencia para agentes criando ou modificando endpoints API.

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

Tambem adicionar config de funcao se necessario:
```json
{
  "functions": {
    "api/novo-endpoint.js": { "maxDuration": 30 }
  }
}
```

## Endpoints Existentes

| Endpoint | Metodo | Funcao | Max Duration |
|----------|--------|--------|-------------|
| `/api/notify` | GET | Cron de notificacoes (dose reminders, digests, stock) | 60s |
| `/api/telegram` | POST | Webhook do Telegram bot | 10s |
| `/api/dlq` | GET | Lista DLQ (paginado) | default |
| `/api/dlq/:id/retry` | POST | Retry de notificacao falhada | default |
| `/api/dlq/:id/discard` | POST | Descartar notificacao | default |
| `/api/health/notifications` | GET | Health check do sistema de notificacoes | default |
| `/api/gemini-reviews/persist` | POST | Persistir reviews do Gemini (JWT auth) | default |
| `/api/gemini-reviews/create-issues` | POST | Criar issues no GitHub (JWT auth) | default |
| `/api/gemini-reviews/update-status` | POST | Atualizar status de review (JWT auth) | default |

## Logging Estruturado

```javascript
// Padrao de log para endpoints
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  endpoint: '/api/exemplo',
  correlationId: req.headers['x-correlation-id'] || crypto.randomUUID(),
  action: 'process_request',
  pr_number: body.pr_number,
  duration_ms: Date.now() - startTime
}))
```

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
