# Telegram Bot Architecture Improvements

**Date:** 2026-02-16  
**Context:** Post-20:30 incident evaluation + mandatory patterns compliance  
**Status:** Ready for Planning

---

## Executive Summary

The 20:30 incident revealed two immediate issues (now fixed):
1. ✅ Markdown `!` escaping in template literals
2. ✅ DLQ schema constraint for upsert operations

**This plan incorporates ALL mandatory patterns from:**
- [`AGENTS.md`](AGENTS.md) - Project guide with Git workflow, testing, design principles
- [`docs/PADROES_CODIGO.md`](docs/PADROES_CODIGO.md) - Code patterns and conventions

---

## Current State Assessment

### What's Working ✅
- Notification system triggers correctly via cron
- Dead Letter Queue is functional
- Error handling returns result objects
- Correlation IDs for tracing

### What's Missing ❌
- No retry mechanism for transient failures
- No alerting on notification failures
- No delivery confirmation (webhooks)
- Limited observability
- No automated tests for Telegram message formatting

---

## Mandatory Patterns (from AGENTS.md & PADROES_CODIGO.md)

### 1. Git Workflow (RIGID PROCESS - MANDATORY)

> ⚠️ **CRITICAL:** ALL code changes MUST follow this workflow exactly.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MANDATORY GITHUB WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  1️⃣  CREATE BRANCH      (Never work on main!)                           │
│  2️⃣  MAKE CHANGES       (Follow all coding standards)                   │
│  3️⃣  VALIDATE LOCALLY   (Lint + Tests + Build)                          │
│  4️⃣  COMMIT             (Atomic commits, semantic messages in Portuguese)│
│  5️⃣  PUSH BRANCH        (To origin)                                     │
│  6️⃣  CREATE PULL REQUEST (Use PR template)                             │
│  7️⃣  WAIT FOR REVIEW    (Address all comments)                          │
│  8️⃣  MERGE & CLEANUP    (--no-ff, delete branch)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Branch Naming:**
```
feature/bot-X/retry-mechanism      - New features
fix/bot-X/markdown-escaping        - Bug fixes
docs/bot-X/update-api-docs         - Documentation
```

**Commit Format (Portuguese):**
```
type(scope): description
type = feat|fix|docs|test|refactor|style|chore
examples:
  feat(bot): adicionar retry com exponential backoff
  fix(bot): corrigir escape de caracteres Markdown
  test(bot): adicionar testes para formatTelegramMessage
```

### 2. Validation Commands (Mandatory)

**Before ANY commit:**
```bash
npm run lint          # Must have 0 errors
npm run test:critical # Tests must pass
npm run build        # Production build must succeed
```

**Combined command:**
```bash
npm run validate      # Runs lint + test:critical
```

### 3. Code Style Guidelines

#### Imports Order (Mandatory)
```javascript
// 1. React e bibliotecas externas
import { useState, useEffect } from 'react'
import { z } from 'zod'

// 2. Serviços internos do bot
import { supabase } from '../services/supabase.js'
import { createLogger } from './logger.js'

// 3. Utilitários
import { getCurrentTimeInTimezone } from '../utils/timezone.js'

// 4. Funções do mesmo arquivo (no topo)
function escapeMarkdown(text) { }

// 5. CSS (sempre por último)
import './tasks.css'
```

#### Language Conventions
| Context | Language | Example |
|---------|----------|---------|
| Code (variables, functions) | English | `const medicineName = ''` |
| Error messages | Portuguese | `'Nome é obrigatório'` |
| UI (labels, buttons) | Portuguese | `Salvar Medicamento` |
| Documentation | Portuguese | Este documento |
| Commits | Portuguese | `feat: adiciona validação Zod` |
| DB tables/columns | Portuguese | `medicamentos.nome` |

#### Constants (SCREAMING_SNAKE)
```javascript
const MAX_RETRY_ATTEMPTS = 3
const TELEGRAM_PARSE_MODE = 'MarkdownV2'
```

### 4. Zod Validation (Mandatory)

All services MUST validate with Zod before sending to Supabase:

```javascript
// server/services/notificationSchema.js
import { z } from 'zod'

export const notificationPayloadSchema = z.object({
  userId: z.string().uuid(),
  protocolId: z.string().uuid().optional(),
  type: z.enum(['dose_reminder', 'stock_alert', 'soft_reminder']),
  payload: z.record(z.any())
})

export function validateNotificationPayload(data) {
  const result = notificationPayloadSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`Erro de validação: ${result.error.errors.map(e => e.message).join(', ')}`)
  }
  return result.data
}
```

### 5. Testing Patterns

**Test Command Selection:**
| File Type | Command | Rationale |
|-----------|---------|-----------|
| `*.service.js` | `npm run test:critical` | Services require integration context |
| `*.schema.js` | `npm run test:critical` | Schemas have critical validation logic |
| `*.util.js` | `npm run test:light` | Pure functions, no deps |
| `server/bot/*.js` | `npm run test:critical` | Bot services |

**Unit Test Structure:**
```javascript
// tests/server/bot/tasks.test.js
import { describe, it, expect, vi } from 'vitest'
import { formatDoseReminderMessage } from '../../server/bot/tasks.js'

describe('formatDoseReminderMessage', () => {
  it('should escape all MarkdownV2 special characters', () => {
    const protocol = { medicine: { name: 'Test! Medicine?' } }
    const message = formatDoseReminderMessage(protocol, '08:00')
    
    expect(message).not.toContain('Test!')
    expect(message).toContain('Test\\!')
  })
})
```

---

## Recommended Improvements

### Phase 1: Reliability Enhancements (P1)

#### 1.1 Retry with Exponential Backoff

**File:** `server/bot/retryManager.js`

```javascript
// server/bot/retryManager.js
import { createLogger } from './logger.js'

const logger = createLogger('RetryManager')

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,    // 1 second
  maxDelay: 30000,     // 30 seconds
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    '429',
    'network'
  ]
}

/**
 * Verifica se um erro é passível de retry
 * @param {Error} error - Objeto de erro
 * @returns {boolean} true se o erro é transiente
 */
function isRetryableError(error) {
  return RETRY_CONFIG.retryableErrors.some(code =>
    error.message?.includes(code) ||
    error.code === code ||
    error.status === 429
  )
}

/**
 * Executa operação com retry automático
 * @param {Function} operation - Função async a executar
 * @param {object} context - Contexto para logging
 * @returns {Promise<any>} Resultado da operação
 */
export async function sendWithRetry(operation, context) {
  let lastError
  
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (!isRetryableError(error) || attempt === RETRY_CONFIG.maxRetries) {
        throw error
      }
      
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelay
      )
      
      logger.info(`Retry notification`, {
        attempt,
        maxRetries: RETRY_CONFIG.maxRetries,
        delay,
        ...context
      })
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
```

**Test:** `tests/server/bot/retryManager.test.js`

#### 1.2 Markdown Validation Library

**File:** `server/utils/telegramFormatter.js`

```javascript
// server/utils/telegramFormatter.js

/**
 * Escapa caracteres especiais do MarkdownV2
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
export function escapeMarkdownV2(text) {
  if (!text) return ''
  
  // Caracteres especiais do MarkdownV2 (exceto parênteses que são comuns)
  const specialChars = /[_*\[\]`~>#+\-=|{}.!]/g
  return text.replace(specialChars, '\\$&')
}

/**
 * Formata mensagem do Telegram com variáveis
 * @param {string} template - Template com placeholders {{variable}}
 * @param {object} variables - Variáveis para substituir
 * @returns {string} Mensagem formatada
 */
export function formatTelegramMessage(template, variables = {}) {
  let message = template
  
  // Escape de todas as variáveis (proteção contra injeção)
  Object.entries(variables).forEach(([key, value]) => {
    const escapedValue = escapeMarkdownV2(String(value))
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), escapedValue)
  })
  
  return message
}
```

**Test:** `tests/server/utils/telegramFormatter.test.js`

#### 1.3 Alerting on Failure Rates

**File:** `api/metrics.js`

```javascript
// api/metrics.js
import { supabase } from '../server/services/supabase.js'

export default async function handler(req, res) {
  const { data: stats } = await supabase
    .rpc('get_dlq_stats')
  
  const ALERT_THRESHOLD = {
    maxPendingDLQ: 50,
    maxFailedPerHour: 10
  }
  
  const pendingCount = stats?.find(s => s.status === 'pending')?.count || 0
  
  res.json({
    pending: pendingCount,
    threshold: ALERT_THRESHOLD.maxPendingDLQ,
    needsAlert: pendingCount > ALERT_THRESHOLD.maxPendingDLQ
  })
}
```

---

## Implementation Checklist

### Files to Create/Modify

| File | Action | Validation |
|------|--------|------------|
| `server/bot/retryManager.js` | Create | `npm run lint` + `npm run test:critical` |
| `server/utils/telegramFormatter.js` | Create | `npm run lint` + `npm run test:critical` |
| `tests/server/bot/retryManager.test.js` | Create | `npm run test:critical` |
| `tests/server/utils/telegramFormatter.test.js` | Create | `npm run test:critical` |
| `api/metrics.js` | Create | `npm run lint` |
| `server/bot/tasks.js` | Modify | `npm run validate` |

### Git Workflow Steps

```bash
# 1. Create branch
git checkout -b feature/bot-X/retry-mechanism

# 2. Make changes
# ... edit files ...

# 3. Validate (ALL MUST PASS)
npm run lint
npm run test:critical
npm run build

# 4. Commit
git add -A
git commit -m "feat(bot): adicionar retry com exponential backoff"

# 5. Push
git push origin feature/bot-X/retry-mechanism

# 6. Create PR (use template)
gh pr create --title "feat(bot): adicionar retry mechanism" \
             --body-file docs/PULL_REQUEST_TEMPLATE.md

# 7. Wait for review
# 8. Merge (--no-ff)
```

---

## Memory Entry (for .roo/rules/memory.md)

```markdown
## Memory Entry — 2026-02-16 HH:MM
**Contexto / Objetivo**
- Melhorar confiabilidade do bot Telegram após falha de parsing Markdown
- Implementar retry mechanism e alertas

**O que foi feito (mudanças)**
- server/bot/retryManager.js - Criado com exponential backoff
- server/utils/telegramFormatter.js - Criado com escapeMarkdownV2
- server/bot/tasks.js - Integrado retry mechanism

**O que deu certo**
- Retry mechanism com delay exponencial reduz transient failures
- Telegram formatter centraliza escaping de caracteres

**Regras locais para o futuro (lições acionáveis)**
- TODAS as mensagens Telegram DEVEM usar telegramFormatter
- Retry mechanism padrão para todas as chamadas de API
- Alerts em produção quando DLQ > 50 itens

**Pendências / próximos passos**
- Implementar webhook para delivery confirmation
- Adicionar métricas ao dashboard
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Notification success rate | ~95% | >99% |
| Time to detect failure | Manual | <5 min |
| Markdown parsing errors | 1+ | 0 |
| Retry success rate | 0% | >80% |

---

## Next Steps

1. **Review** this plan
2. **Select** Phase 1 items for implementation
3. **Create branch** following Git workflow
4. **Implement** with validation at each step
5. **Create PR** using template
6. **Merge** after review

---

## References

- [`AGENTS.md`](AGENTS.md) - Mandatory Git workflow, testing commands
- [`docs/PADROES_CODIGO.md`](docs/PADROES_CODIGO.md) - Code patterns, Zod validation
- [`.roo/rules/memory.md`](.roo/rules/memory.md) - Lessons learned
