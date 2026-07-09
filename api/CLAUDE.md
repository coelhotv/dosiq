# api/ — Vercel Serverless Functions

> Referência para agentes criando ou modificando endpoints API.

## REGRA #1: Function Budget (CRÍTICO)

**Vercel Hobby: máximo 12 serverless functions por deploy.**

Cada arquivo `.ts` (ou `.js` legado) na raiz do diretório `api/` conta como uma função servida pelo Vercel, EXCETO arquivos contidos em subdiretórios prefixados com `_` ou `.`.

### Budget Atual (Pós-Consolidação Épico 040)

| # | Função | Descrição | maxDuration |
|---|--------|-----------|-------------|
| 1 | `api/admin.ts` | Roteador Admin / DLQ (retry, discard, feedbacks, nudges) | default |
| 2 | `api/users.ts` | Roteador de Usuários (beta-signup, register-webpush) | default |
| 3 | `api/chatbot.ts` | Chatbot AI Endpoint | default |
| 4 | `api/generate-doses.ts` | Geração batch de doses (cron de suporte) | 60s |
| 5 | `api/notify.ts` | Cron orchestrator (reminders, digests, reports) | 60s |
| 6 | `api/share.ts` | PDF sharing via Vercel Blob | default |
| 7 | `api/telegram.ts` | Telegram webhook | 10s |

**Total: 7/12 funções → 5 slots livres**

---

## Regra de Resolução ESM (CRÍTICO)

> [!IMPORTANT]
> **Extensões de Import ESM**: A Vercel executa em ambiente ESM nativo e resolve tipos via `node16`/`nodenext`. Devido a isso, todos os imports de arquivos relativos em `api/` **devem obrigatoriamente** incluir a extensão `.js` no caminho do import, mesmo que o arquivo no disco seja `.ts`.
>
> **Exemplo correto**: `import { handleBetaSignup } from './users/_handlers/beta-signup.js'`  
> **Exemplo incorreto**: `import { handleBetaSignup } from './users/_handlers/beta-signup'` (isso causará falha de compilação/execução em produção).

---

## Antes de Criar QUALQUER Novo Arquivo em api/

1. Verificar budget: quantas funções existem? (`find api -name "*.ts" -maxdepth 1 | wc -l`)
2. Se >= 10 funções: **CONSOLIDAR** em roteador existente (como `admin.ts` ou `users.ts`) ao invés de criar um novo arquivo raiz.
3. Utilitários, auxiliares e handlers específicos **DEVEM** residir em subdiretórios com prefixo `_` para não serem contabilizados como funções separadas:
   - Exemplo: `api/admin/_handlers/`
   - Exemplo: `api/_shared/`
4. NUNCA criar arquivos `.ts` na raiz de `api/` sem avaliar o budget de 12 funções (R-090).

---

## Padrão de Endpoint (TypeScript)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Validação de env vars no startup (fail fast)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 2. Autenticação (se necessário)
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // 3. Validação de input (Zod recomendado)
    const { data, error } = validateInput(req.body)
    if (error) return res.status(400).json({ error })

    // 4. Lógica de negócio
    const result = await processData(data)

    // 5. Response — SEMPRE res.status(code).json(body)
    return res.status(200).json({ success: true, data: result })

  } catch (err: any) {
    console.error('[exemplo] Error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

---

## Padrão de Roteador (para consolidar endpoints)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAction1 } from './domain/_handlers/action1.js'
import { handleAction2 } from './domain/_handlers/action2.js'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<any>

const ROUTES: Record<string, ApiHandler> = {
  'action1': handleAction1,
  'action2': handleAction2,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extrair ação da query (ex: via rewrite query params ou query string direta)
  const { action } = req.query

  const routeHandler = action && Object.prototype.hasOwnProperty.call(ROUTES, action)
    ? ROUTES[action as string]
    : null

  if (!routeHandler) {
    return res.status(404).json({ error: `Unknown action: ${action}` })
  }

  // Lógicas comuns de segurança ou CORS podem ser executadas aqui antes do dispatch
  return routeHandler(req, res)
}
```

**Exemplo de config no vercel.json para roteadores:**
```json
{ "source": "/api/domain/:id/action1", "destination": "/api/domain.ts?action=action1&id=:id" }
```

---

## REGRAS CRÍTICAS

### Formato de Response
```typescript
// CORRETO — Vercel serverless
return res.status(200).json({ data })
return res.status(400).json({ error: 'Bad request' })
return res.status(500).json({ error: 'Internal error' })

// ERRADO — estilo Express (NÃO funciona consistentemente no Vercel)
return res.json({ data })        // NÃO USAR
return res.send({ data })        // NÃO USAR
```

### Variáveis de Ambiente
```typescript
// SEMPRE fornecer fallback
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

// SEMPRE validar no startup
if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
```

### Proibições
- NUNCA chamar `process.exit()` — lance um erro (`throw new Error()`), o runtime de serverless cuidará do ciclo de vida da função.
- NUNCA usar `res.json()` sem anteceder com `.status()`.
- NUNCA commitar arquivos `.env` ou chaves privadas/tokens no repositório.
- NUNCA criar arquivos na raiz de `api/` sem validar o function budget (R-090).
- NUNCA colocar handlers secundários ou arquivos auxiliares em `api/` fora de pastas prefixadas com `_` (R-091).

---

## Arquitetura de Roteadores Existentes

### Admin Roteador (`api/admin.ts`)

| Rota | Método | Action | Descrição |
|------|--------|--------|-----------|
| `/api/admin/dlq` | GET | (default) | Lista entradas falhadas do DLQ com paginação |
| `/api/admin/:id/retry` | POST | retry | Executa retry de notificação falhada no DLQ |
| `/api/admin/:id/discard` | POST | discard | Descarta notificação no DLQ |
| `/api/admin/feedbacks` | GET/POST | feedbacks | Gerencia feedbacks dos usuários |
| `/api/admin/nudges` | POST | nudges | Dispara nudges informativos/alerta |

**Auth:** Administrador (validação via Supabase JWT + Admin Chat ID).  
**Handlers:** `api/admin/_handlers/{retry.ts, discard.ts, feedbacks.ts, nudges.ts}`

### Users Roteador (`api/users.ts`)

| Rota | Método | Action | Descrição |
|------|--------|--------|-----------|
| `/api/users/beta-signup` | POST | beta-signup | Inscrição na lista de espera beta |
| `/api/users/register-webpush` | POST | register-webpush | Registro de inscrições WebPush |

**Auth:** Conforme endpoint (ex: `beta-signup` é pública com rate-limit por IP; `register-webpush` exige JWT).  
**Handlers:** `api/users/_handlers/{beta-signup.ts, register-webpush.ts}`

---

## Cron Jobs

O cron principal está em `api/notify.ts`, acionado de forma segura por autenticação baseada em segredo cron (`CRON_SECRET`).

Schedule (fuso horário: America/Sao_Paulo):
- A cada minuto: dose reminders (envio de lembretes imediatos)
- 08:00 diário: titration alerts (atualizações de titulação)
- 09:00 diário: stock alerts + DLQ digest (alertas de estoque baixo e sumário de erros ao admin)
- 23:00 diário: daily digest (resumo geral do dia)
- 23:00 domingos: adherence reports (relatório de adesão semanal)
- 10:00 dia 1: monthly report (relatório mensal)

---

## Estrutura de Arquivos

```
api/
  CLAUDE.md                          ← este arquivo (não é função)
  tsconfig.json                      ← config TS do subprojeto (não é função)
  admin.ts                           ← FUNÇÃO 1 (roteador de admin)
  admin/
    _handlers/
      discard.ts                     ← handler (não contado)
      feedbacks.ts                   ← handler (não contado)
      nudges.ts                      ← handler (não contado)
      retry.ts                       ← handler (não contado)
  users.ts                           ← FUNÇÃO 2 (roteador de usuários)
  users/
    _handlers/
      beta-signup.ts                 ← handler (não contado)
      register-webpush.ts            ← handler (não contado)
  chatbot.ts                         ← FUNÇÃO 3
  generate-doses.ts                  ← FUNÇÃO 4 (maxDuration: 60)
  notify.ts                          ← FUNÇÃO 5 (maxDuration: 60)
  share.ts                           ← FUNÇÃO 6
  telegram.ts                        ← FUNÇÃO 7 (maxDuration: 10)
```

---

*Última atualização: 2026-07-09*
