# Plano de Limpeza de Console Logs

## 1️⃣ Criar Utility de Logger (Helper)

**Arquivo:** `src/shared/utils/logger.js`

```javascript
/**
 * Logger com suporte a development mode
 * Reduz poluição de console em produção
 */

const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

/**
 * Log de debug (só em development)
 * @param {string} tag - Prefixo [tag] do log
 * @param {string} message - Mensagem principal
 * @param {*} data - Dados adicionais (opcionais)
 */
export function debugLog(tag, message, data) {
  if (isDev) {
    if (data !== undefined) {
      console.log(`[${tag}] ${message}`, data)
    } else {
      console.log(`[${tag}] ${message}`)
    }
  }
}

/**
 * Log de erro/warning (sempre, mas formatado)
 * @param {string} tag - Prefixo [tag]
 * @param {string} message - Mensagem
 * @param {Error} error - Erro opcional
 */
export function errorLog(tag, message, error) {
  console.error(`[${tag}] ${message}`, error || '')
}

/**
 * Log condicional (quando expressão é true)
 * @param {boolean} condition - Condição
 * @param {string} tag - Prefixo
 * @param {string} message - Mensagem
 * @param {*} data - Dados
 */
export function conditionalLog(condition, tag, message, data) {
  if (condition) {
    debugLog(tag, message, data)
  }
}
```

---

## 2️⃣ Corrigir `queryCache.js`

**Arquivo:** `src/shared/utils/queryCache.js`

### ❌ Remover (linha 66)
```javascript
console.log(`[QueryCache] Hidratadas ${cache.size} entradas do LocalStorage`)
```

### ⚠️ Manter como debugLog (linhas 190, 196, 210)
```javascript
// ANTES
console.log(`[QueryCache] Cache HIT (fresh): ${key}`)
console.log(`[QueryCache] Cache HIT (stale): ${key}, revalidando...`)
console.log(`[QueryCache] Revalidação OK: ${key}`)

// DEPOIS
debugLog('QueryCache', `Cache HIT (fresh): ${key}`)
debugLog('QueryCache', `Cache HIT (stale): ${key}, revalidando...`)
debugLog('QueryCache', `Revalidação OK: ${key}`)
```

### ⚠️ Manter debugLog (linha 232)
```javascript
// ANTES
console.log(`[QueryCache] Cache MISS: ${key}`)

// DEPOIS
debugLog('QueryCache', `Cache MISS: ${key}`)
```

### ⚠️ Manter debugLog (linhas 122-123)
```javascript
// ANTES
console.log(`[QueryCache] GC TTL: removidas ${removedByTTL} entradas expiradas`)

// DEPOIS
if (removedByTTL > 0) {
  debugLog('QueryCache', `GC TTL: removidas ${removedByTTL} entradas expiradas`)
}
```

### ⚠️ OTIMIZAR (linha 308) — log only if N > 0
```javascript
// ANTES
console.log(`[QueryCache] Invalidadas ${invalidatedCount} entradas para pattern: ${pattern}`)

// DEPOIS
if (invalidatedCount > 0) {
  debugLog('QueryCache', `Invalidadas ${invalidatedCount} entradas para pattern: ${pattern}`)
}
```

### ⚠️ Manter debugLog (linha 323)
```javascript
// ANTES
console.log(`[QueryCache] Prefetch: ${key}`)

// DEPOIS
debugLog('QueryCache', `Prefetch: ${key}`)
```

### ⚠️ Manter debugLog (linha 375)
```javascript
// ANTES
console.log(`[QueryCache] Cache limpo. ${size} entradas removidas.`)

// DEPOIS
debugLog('QueryCache', `Cache limpo. ${size} entradas removidas.`)
```

---

## 3️⃣ Corrigir `useInsights.js`

**Arquivo:** `src/features/dashboard/hooks/useInsights.js`

### ❌ Remover (linhas 28-34)
```javascript
// REMOVER COMPLETAMENTE
console.log('[useInsights] Context data:', {
  stats,
  dailyAdherence: dailyAdherence?.length || 0,
  stockSummary: stockSummary?.length || 0,
  logs: logs?.length || 0,
  hasOnNavigate: !!onNavigate,
})
```

### ⚠️ Converter para debugLog (linha 45)
```javascript
// ANTES
console.log('[useInsights] Selected insight:', selectedInsight)

// DEPOIS
import { debugLog } from '@utils/logger'
debugLog('useInsights', 'Selected insight:', selectedInsight)
```

---

## 4️⃣ Corrigir `Dashboard.jsx`

**Arquivo:** `src/views/Dashboard.jsx`

### ❌ Remover (linhas 123-130)
```javascript
// REMOVER COMPLETAMENTE
console.log('[Dashboard] Insight data received:', {
  insight,
  insightLoading,
  stats,
  dailyAdherence: dailyAdherence?.length || 0,
  stockSummary: stockSummary?.length || 0,
  logs: logs?.length || 0,
})
```

---

## 5️⃣ Corrigir `SparklineAdesao.jsx`

**Arquivo:** `src/features/dashboard/components/SparklineAdesao.jsx`

### ❌ Remover (linhas 184, 188)
```javascript
// REMOVER
console.log('[SparklineAdesao] Sem dados:', { adherenceByDay })
console.log('[SparklineAdesao] Processando', adherenceByDay.length, 'registros')
```

### ⚠️ Converter para debugLog (linha 213)
```javascript
// ANTES
console.log('[SparklineAdesao] chartData final:', data.length, 'dias')

// DEPOIS
import { debugLog } from '@utils/logger'
debugLog('SparklineAdesao', `chartData final: ${data.length} dias`)
```

### ⚠️ Converter para debugLog (linhas 215-220)
```javascript
// ANTES
console.log('[SparklineAdesao] Amostra de valores:', {
  primeiro: data[0],
  ultimo: data[data.length - 1],
  todosAdherencia: data.map((d) => d.adherence),
})

// DEPOIS
debugLog('SparklineAdesao', 'Amostra de valores:', {
  primeiro: data[0],
  ultimo: data[data.length - 1],
  todosAdherencia: data.map((d) => d.adherence),
})
```

### ⚠️ Converter para debugLog (linhas 232-236)
```javascript
// ANTES
console.log('[SparklineAdesao] Stats:', {
  totalDays: chartData.length,
  validDays: validData.length,
  adherenceValues: chartData.map((d) => d.adherence),
})

// DEPOIS
debugLog('SparklineAdesao', 'Stats:', {
  totalDays: chartData.length,
  validDays: validData.length,
  adherenceValues: chartData.map((d) => d.adherence),
})
```

### ❌ Remover (linha 238)
```javascript
// REMOVER
console.log('[SparklineAdesao] AVISO: Nenhum dia com adherence > 0!')
```

---

## 6️⃣ Corrigir `AdherenceHeatmap.jsx`

**Arquivo:** `src/features/adherence/components/AdherenceHeatmap.jsx`

### ⚠️ Converter para debugLog (linha 30)
```javascript
// ANTES
console.log('[AdherenceHeatmap] Pattern recebido:', pattern)

// DEPOIS
import { debugLog } from '@utils/logger'
debugLog('AdherenceHeatmap', 'Pattern recebido:', pattern)
```

### ⚠️ Converter para debugLog (linhas 34-38)
```javascript
// ANTES
console.log('[AdherenceHeatmap] Dados insuficientes:', {
  hasPattern: !!pattern,
  hasEnoughData: pattern?.hasEnoughData,
  narrative: pattern?.narrative,
})

// DEPOIS
debugLog('AdherenceHeatmap', 'Dados insuficientes:', {
  hasPattern: !!pattern,
  hasEnoughData: pattern?.hasEnoughData,
  narrative: pattern?.narrative,
})
```

### ❌ Remover (linha 48)
```javascript
// REMOVER COMPLETAMENTE
console.log('[AdherenceHeatmap] Renderizando grid com dados suficientes')
```

---

## 7️⃣ Adicionar ao `.memory/anti-patterns.md`

```markdown
## AP-LOG-001: Console.log() não-filtrado em dashboard

**Problema:** Dashboard poluía console com 50+ logs durante carregamento inicial.

**Impacto:** Difícil debug, confunde users, performance hits em 4G.

**Solução:** Criar `logger.js` com `debugLog()` que respeita `NODE_ENV === 'development'`.

**Como evitar:**
- Sempre usar `debugLog(tag, msg, data)` em vez de `console.log()`
- Logs de status/confirmação são DEBUG, não INFO
- Remover logs "óbvios" como "Processando X registros"
```

---

## ✅ Checklist de Implementação

- [ ] Criar `src/shared/utils/logger.js`
- [ ] Atualizar imports em `queryCache.js` (+9 mudanças)
- [ ] Atualizar imports em `useInsights.js` (remover 1, converter 1)
- [ ] Remover logs de `Dashboard.jsx` (remove 8 linhas)
- [ ] Atualizar `SparklineAdesao.jsx` (remover 2, converter 5)
- [ ] Atualizar `AdherenceHeatmap.jsx` (remover 1, converter 3)
- [ ] Testar em dev mode: `npm run dev` (logs aparecem)
- [ ] Testar em prod mode: Build local (logs não aparecem)
- [ ] Atualizar `.memory/anti-patterns.md`
- [ ] Rodar `npm run validate:agent`

---

## 🧪 Como Testar

### Dev Mode (logs aparecem)
```bash
npm run dev
# Abrir Dashboard
# Verificar que logs aparecem no console
```

### Produção (logs desaparecem)
```bash
npm run build
npm run preview
# Abrir Dashboard
# Verificar que console está LIMPO
```

### Environment Check
```javascript
// browser console
console.log(process.env.NODE_ENV)  // 'development' ou 'production'
```

---

## 📊 Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Console logs ao carregar Dashboard | 50+ | 5-8 (dev) / 0 (prod) |
| Linhas de código de log | 120+ | ~20 |
| Clareza de debug | ⭐⭐ | ⭐⭐⭐⭐⭐ |

