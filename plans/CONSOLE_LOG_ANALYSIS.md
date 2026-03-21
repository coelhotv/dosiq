# Análise de Console Logs do Dashboard

**Data:** 2026-03-20
**Contexto:** Carregamento inicial do Dashboard com 7 dias de dados de aderência

## Resumo Executivo

- **Total de logs:** 50 linhas
- **Logs ÚTEIS para manter:** 6-8 logs
- **Logs para REMOVER em produção:** 12+ logs
- **Logs para OTIMIZAR (filtrar zeros):** 6 logs

---

## Análise por Origem

### 1. **[QueryCache]** — `src/shared/utils/queryCache.js`

#### Logs Atuais
```
Line 2:   [QueryCache] Hidratadas 4 entradas do LocalStorage
Lines 6-9: [QueryCache] Cache HIT (stale): {...}, revalidando...
Lines 19-23: [QueryCache] Revalidação OK: {...}
Line 24: [QueryCache] Cache MISS: logs:monthSlim
Lines 27-28: [QueryCache] Cache MISS: adherence:daily, adherence:summary
Line 26: [QueryCache] Cache HIT (fresh): logs:monthSlim
Line 37: [QueryCache] Cache MISS: adherence:pattern
Lines 40: [QueryCache] GC TTL: removidas 9 entradas expiradas
Lines 41-46: [QueryCache] Invalidadas 0 entradas para pattern: {...}
Lines 47-49: [QueryCache] Cache MISS: medicines:list, protocols:active, logs:last30d
```

| Função | Frequência | Utilidade | Recomendação |
|--------|-----------|----------|--------------|
| Hydration | 1x inicial | **BAIXA** — não afeta comportamento | ❌ **ELIMINAR** |
| Cache HIT (stale) | 4-5x | **ALTA** — debug de stale-while-revalidate | ✅ **MANTER (dev mode)** |
| Revalidação OK | 4x | **MÉDIA** — confirma revalidação background | ✅ **MANTER (dev mode)** |
| Cache MISS | 6-8x | **ALTA** — identifica queries que não foram cache | ✅ **MANTER (dev mode)** |
| Cache HIT (fresh) | 1x | **MÉDIA** — indica cache válido | ✅ **MANTER (dev mode)** |
| GC TTL | 2x | **MÉDIA** — monitor de memory leaks | ✅ **MANTER (dev mode)** |
| Invalidadas N entradas | 6x | **BAIXA** — muito verboso quando N=0 | ⚠️ **FILTRAR** — log apenas se N > 0 |

**Ação:**
- Mover logs de cache HIT/MISS/Revalidação para `if (process.env.NODE_ENV === 'development')`
- Remover log de "Hidratadas X entradas"
- Filtrar logs de "Invalidadas 0 entradas"

---

### 2. **[Dashboard]** — `src/views/Dashboard.jsx:123-130`

```
Line 3: [Dashboard] Insight data received: {insight: null, insightLoading: true, ...}
Line 10: [Dashboard] Insight data received: {insight: {...}, insightLoading: false, ...}
Line 18: [Dashboard] Insight data received: {...}
```

| Função | Frequência | Utilidade | Recomendação |
|--------|-----------|----------|--------------|
| Insight data received | 3x durante carregamento | **BAIXA** — muito verboso, dados completos já estão em Redux | ❌ **ELIMINAR** |

**Ação:** Remover linhas 123-130 de Dashboard.jsx

---

### 3. **[useInsights]** — `src/features/dashboard/hooks/useInsights.js:28-45`

```
Line 4: [useInsights] Context data: {stats, dailyAdherence, stockSummary, ...}
Line 15: [useInsights] Context data: {...}
Line 5: [useInsights] Selected insight: {id: 'default', type: 'IMPROVEMENT_OPPORTUNITY', ...}
Line 17: [useInsights] Selected insight: {...}
```

| Função | Frequência | Utilidade | Recomendação |
|--------|-----------|----------|--------------|
| Context data | 2x | **BAIXA** — logs de debug dados | ❌ **REMOVER** |
| Selected insight | 2x | **MÉDIA** — útil para rastrear qual insight foi escolhido | ⚠️ **MANTER (dev mode)** |

**Ação:**
- Envolver linhas 28-34 em `if (process.env.NODE_ENV === 'development')`
- Envolver linhas 45 em `if (process.env.NODE_ENV === 'development')`

---

### 4. **[SparklineAdesao]** — `src/features/dashboard/components/SparklineAdesao.jsx`

```
Line 11: [SparklineAdesao] Processando 7 registros
Line 12: [SparklineAdesao] chartData final: 7 dias
Line 13: [SparklineAdesao] Amostra de valores: {primeiro: {...}, último: {...}, ...}
Line 14: [SparklineAdesao] Stats: {totalDays: 7, validDays: 6, adherenceValues: [...]}
[...repetido para 30 dias: linhas 29-36, 33-36]
```

| Função | Frequência | Utilidade | Recomendação |
|--------|-----------|----------|--------------|
| Processando X registros | 3x | **MUITO BAIXA** — informação óbvia | ❌ **ELIMINAR** |
| chartData final: X dias | 3x | **BAIXA** — resultado esperado | ⚠️ **REMOVER (dev mode)** |
| Amostra de valores | 3x | **MÉDIA** — útil para debug, mas verbose | ⚠️ **REMOVER (dev mode)** |
| Stats | 3x | **BAIXA** — valores já no estado do componente | ⚠️ **REMOVER (dev mode)** |

**Problema:** Componente renderiza 3x durante carregamento inicial (7d, 30d, 30d novamente?). Verificar se há renderização dupla.

**Ação:**
- Remover linhas 184, 188, 213 (logs básicos)
- Envolver linhas 215-220, 232-236 em `if (process.env.NODE_ENV === 'development')`

---

### 5. **[InsightService]** — `src/features/dashboard/services/insightService.js`

```
Line 16: [InsightService] Insight salvo no histórico: streak_achievement
```

| Função | Frequência | Utilidade | Recomendação |
|--------|-----------|----------|--------------|
| Insight salvo | 1x | **BAIXA** — confirmação de persistência, pouco útil | ❌ **ELIMINAR** |

**Ação:** Remover log de persistência do insightService

---

### 6. **[AdherenceHeatmap]** — `src/features/adherence/components/AdherenceHeatmap.jsx:30-48`

```
Line 38: [AdherenceHeatmap] Pattern recebido: {grid: Array(7), worstCell: {...}, ...}
Line 39: [AdherenceHeatmap] Renderizando grid com dados suficientes
```

| Função | Frequência | Utilidade | Recomendação |
|--------|-----------|----------|--------------|
| Pattern recebido | 1x | **BAIXA** — dados já no state do componente | ⚠️ **REMOVER (dev mode)** |
| Renderizando grid | 1x | **MUITO BAIXA** — obvio que está renderizando | ❌ **ELIMINAR** |

**Ação:**
- Remover linha 48
- Envolver linha 30-38 em `if (process.env.NODE_ENV === 'development')`

---

## Recomendações Finais

### **ELIMINAR Completamente**
```
1. queryCache.js:66 — "Hidratadas X entradas"
2. SparklineAdesao.jsx:184, 188, 213 — "Processando X registros" / "chartData final"
3. AdherenceHeatmap.jsx:48 — "Renderizando grid"
4. Dashboard.jsx:123-130 — Log completo de insight data
5. useInsights.js:28-34 — Context data logging
```

### **MANTER em Desenvolvimento (env check)**
```
1. queryCache.js:190, 196, 210 — Cache HIT (fresh/stale) / Revalidação OK
2. queryCache.js:232 — Cache MISS
3. queryCache.js:122-123 — GC TTL
4. useInsights.js:45 — Selected insight
5. SparklineAdesao.jsx:215-220, 232-236 — Amostra/Stats
6. AdherenceHeatmap.jsx:30 — Pattern recebido
```

### **OTIMIZAR (Condicional)**
```
1. queryCache.js:308 — Log "Invalidadas N entradas" → log apenas se N > 0
```

---

## Implementação Recomendada

### Helper Global
```javascript
// src/shared/utils/logger.js
export const debugLog = (tag, message, data = null) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${tag}] ${message}`, data || '')
  }
}

export const warnLog = (tag, message, error) => {
  console.warn(`[${tag}] ${message}`, error)
}
```

### Exemplo de Uso
```javascript
// src/shared/utils/queryCache.js
import { debugLog } from '@utils/logger'

// ❌ REMOVER
// console.log(`[QueryCache] Hidratadas ${cache.size} entradas do LocalStorage`)

// ✅ MANTER
debugLog('QueryCache', `Cache HIT (stale): ${key}, revalidando...`)
debugLog('QueryCache', `Cache MISS: ${key}`)
```

---

## Benefícios da Limpeza

| Métrica | Antes | Depois | Ganho |
|---------|-------|--------|--------|
| Console logs ao carregar | ~50 linhas | ~5-8 linhas | 90% redução |
| Clareza de debug | Poluído | Focado | Alto |
| UX (não assusta users) | Sim | Não | Melhor |
| Facilita troubleshooting | Difícil (ruído) | Fácil (sinal) | Alto |

---

## Nota Importante: Renderização Dupla do SparklineAdesao

Detectei que `SparklineAdesao` está renderizando **3x consecutivas** durante carregamento:
- 7 dias (primeira carga)
- 30 dias (segunda carga)
- 30 dias novamente (terceira carga)

**Investigar:**
1. Deps array do useMemo em Dashboard.jsx
2. Re-renders causadas por context changes
3. Possível renderização não-memoizada

Isso pode estar causando performance issues em mobile.

