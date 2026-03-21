# Quick Reference — Console Log Cleanup

## 📋 Mapa Visual de Ações

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOGS DO DASHBOARD                           │
└─────────────────────────────────────────────────────────────────┘

📄 queryCache.js
├─ ❌ [line 66] "Hidratadas X entradas" → REMOVER
├─ ⚠️ [line 190] "Cache HIT (fresh)" → debugLog()
├─ ⚠️ [line 196] "Cache HIT (stale)" → debugLog()
├─ ⚠️ [line 210] "Revalidação OK" → debugLog()
├─ ⚠️ [line 232] "Cache MISS" → debugLog()
├─ ⚠️ [line 123] "GC TTL" → debugLog() (se N > 0)
├─ ⚠️ [line 308] "Invalidadas N" → debugLog() (se N > 0)
├─ ⚠️ [line 323] "Prefetch" → debugLog()
└─ ⚠️ [line 375] "Cache limpo" → debugLog()

📄 Dashboard.jsx
├─ ❌ [lines 123-130] "Insight data received" → REMOVER COMPLETAMENTE
└─ ⚠️ [line 52] Add import: import { debugLog } from '@utils/logger'

📄 useInsights.js
├─ ❌ [lines 28-34] "Context data" → REMOVER COMPLETAMENTE
├─ ⚠️ [line 45] "Selected insight" → debugLog()
└─ ⚠️ [line 2] Add import: import { debugLog } from '@utils/logger'

📄 SparklineAdesao.jsx
├─ ❌ [line 184] "Sem dados" → REMOVER
├─ ❌ [line 188] "Processando X registros" → REMOVER
├─ ❌ [line 238] "AVISO: Nenhum dia" → REMOVER
├─ ⚠️ [line 213] "chartData final" → debugLog()
├─ ⚠️ [lines 215-220] "Amostra de valores" → debugLog()
├─ ⚠️ [lines 232-236] "Stats" → debugLog()
└─ ⚠️ [line 20] Add import: import { debugLog } from '@utils/logger'

📄 AdherenceHeatmap.jsx
├─ ❌ [line 48] "Renderizando grid" → REMOVER COMPLETAMENTE
├─ ⚠️ [line 30] "Pattern recebido" → debugLog()
├─ ⚠️ [lines 34-38] "Dados insuficientes" → debugLog()
└─ ⚠️ [line 2] Add import: import { debugLog } from '@utils/logger'
```

---

## 🎯 Categorias de Logs

### 🔴 REMOVER COMPLETAMENTE (7 logs)
```javascript
1. queryCache.js:66 — "Hidratadas X entradas"
2. Dashboard.jsx:123-130 — "Insight data received"
3. useInsights.js:28-34 — "Context data"
4. SparklineAdesao.jsx:184 — "Sem dados"
5. SparklineAdesao.jsx:188 — "Processando X registros"
6. SparklineAdesao.jsx:238 — "AVISO: Nenhum dia"
7. AdherenceHeatmap.jsx:48 — "Renderizando grid"
```

### 🟠 CONVERTER PARA debugLog() (13 logs)
```javascript
1. queryCache.js:190 — "Cache HIT (fresh)"
2. queryCache.js:196 — "Cache HIT (stale)"
3. queryCache.js:210 — "Revalidação OK"
4. queryCache.js:232 — "Cache MISS"
5. queryCache.js:123 — "GC TTL" (com condition N > 0)
6. queryCache.js:308 — "Invalidadas N" (com condition N > 0)
7. queryCache.js:323 — "Prefetch"
8. queryCache.js:375 — "Cache limpo"
9. useInsights.js:45 — "Selected insight"
10. SparklineAdesao.jsx:213 — "chartData final"
11. SparklineAdesao.jsx:215-220 — "Amostra de valores"
12. SparklineAdesao.jsx:232-236 — "Stats"
13. AdherenceHeatmap.jsx:30 — "Pattern recebido"
14. AdherenceHeatmap.jsx:34-38 — "Dados insuficientes"
```

---

## 📊 Impacto por Arquivo

| Arquivo | Remover | Converter | Imports | Resultado |
|---------|---------|-----------|---------|-----------|
| queryCache.js | 1 | 8 | 1 | ✅ Limpo |
| Dashboard.jsx | 8 | 0 | 0 | ✅ Limpo |
| useInsights.js | 7 | 1 | 1 | ✅ Limpo |
| SparklineAdesao.jsx | 3 | 5 | 1 | ✅ Limpo |
| AdherenceHeatmap.jsx | 1 | 3 | 1 | ✅ Limpo |
| insightService.js | 1* | 0 | 0 | ✅ Limpo |
| **logger.js** | - | - | **NEW** | ✅ Criado |
| **TOTAL** | **21** | **17** | **4** | **20 arquivos afetados** |

*insightService.js tem um log de persistência que também deve ser removido (linha ~150-160)

---

## 💡 Padrão de Conversão

### ❌ Antes (console.log)
```javascript
console.log('[SparklineAdesao] Processando', adherenceByDay.length, 'registros')
console.log('[SparklineAdesao] chartData final:', data.length, 'dias')
```

### ✅ Depois (debugLog)
```javascript
import { debugLog } from '@utils/logger'

debugLog('SparklineAdesao', `Processando ${adherenceByDay.length} registros`)
debugLog('SparklineAdesao', `chartData final: ${data.length} dias`)
```

---

## 🚀 Ordem de Implementação

1. ✅ Criar `src/shared/utils/logger.js` (5 min)
2. ✅ Atualizar `queryCache.js` (10 min)
3. ✅ Atualizar `Dashboard.jsx` (2 min)
4. ✅ Atualizar `useInsights.js` (3 min)
5. ✅ Atualizar `SparklineAdesao.jsx` (5 min)
6. ✅ Atualizar `AdherenceHeatmap.jsx` (3 min)
7. ✅ Verificar `insightService.js` (2 min)
8. ✅ Testar em dev e prod (5 min)
9. ✅ Update `.memory/anti-patterns.md` (2 min)
10. ✅ Commit (2 min)

**Tempo total:** ~40 min

---

## 🧪 Comandos de Teste Rápido

```bash
# Teste dev (logs aparecem)
npm run dev
# Abrir DevTools → Console
# Navegar para Dashboard
# Verificar que [QueryCache], [Dashboard], etc. aparecem

# Teste produção (logs desaparecem)
npm run build
npm run preview
# Abrir DevTools → Console
# Navegar para Dashboard
# Verificar que console está limpo
```

---

## 📌 Notas Importantes

### Environment Detection
```javascript
// process.env.NODE_ENV é automaticamente definido pelo Vite:
// - 'development' → npm run dev
// - 'production' → npm run build / preview
```

### Diferença Entre os Logs

| Tipo | Quando Usa | Exemplo |
|------|-----------|---------|
| **REMOVER** | Info óbvia, não afeta debug | "Processando X registros" |
| **debugLog()** | Info útil para troubleshooting | "Cache MISS: user:123" |
| **console.error()** | Erros reais | Falhas de rede |
| **console.warn()** | Avisos | Dados inválidos |

---

## ⚡ Benefício Final

### Antes (50+ linhas):
```
[QueryCache] Hidratadas 4 entradas
[Dashboard] Insight data received: {...}
[useInsights] Context data: {...}
[SparklineAdesao] Processando 7 registros
[SparklineAdesao] chartData final: 7 dias
[SparklineAdesao] Amostra de valores: {...}
[SparklineAdesao] Stats: {...}
[QueryCache] Cache HIT (stale): medicines:list
...50+ mais linhas
```

### Depois em Development (5-8 linhas):
```
[QueryCache] Cache HIT (stale): medicines:list
[QueryCache] Cache MISS: adherence:daily
[QueryCache] Revalidação OK: medicines:list
[useInsights] Selected insight: streak_achievement
```

### Depois em Production (0 linhas):
```
[console limpo]
```

---

## 🐛 Possíveis Issues Ao Implementar

| Problema | Solução |
|----------|---------|
| Import cycles | Use lazy import em logger.js: `const isDev = process.env.NODE_ENV === 'development'` |
| TypeScript errors | logger.js não precisa ser tipado, é JS puro |
| Linter complaints | Adicionar eslint-disable se necessário |
| Build fails | Rodar `npm run validate:quick` após mudanças |

