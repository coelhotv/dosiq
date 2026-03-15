# Plano: Fix HealthHistory Mobile Browser Freeze — Definitivo

## Context

Apesar dos sprints M0-M8 de performance mobile, a view HealthHistory **trava completamente** no Safari mobile (iPhone). O calendário e as doses do dia carregam, mas a timeline "Últimas Doses" aparece vazia, e Sparkline/Heatmap nunca renderizam. O browser não permite nem scroll nem reload.

**Causa raiz**: Quando HealthHistory monta, dispara **12+ requisições Supabase simultâneas** em <500ms, saturando o pool de conexões HTTP/2 do Safari (max 4-6 por origem). O main thread bloqueia esperando slots de conexão enquanto tenta renderizar.

**Inventário de requisições na abertura:**
| Fase | Fonte | Queries | Cache? |
|------|-------|---------|--------|
| DashboardProvider (pai) | `useCachedQueries` | 3 | SWR ✅ |
| Phase 1 (loadData) | `getByMonth` + `getAllPaginated` | 2 | SWR ✅ |
| Phase 2 (loadData) | `getAdherenceSummary` (6 sub-queries) + `getDailyAdherenceFromView` | 7 | **NÃO** ❌ |
| Lazy (IntersectionObserver) | heatmap | 1 | **NÃO** ❌ |

As 6 sub-queries de `getAdherenceSummary` buscam `protocols` **3 vezes** independentemente (dados que o DashboardProvider já tem).

---

## Solução: 5 Camadas de Correção

### Camada 1: `cachedAdherenceService` — Cache SWR para queries de adesão

**Arquivo:** `src/shared/services/cachedServices.js`

Adicionar cache keys e wrappers:
```
ADHERENCE_SUMMARY = 'adherence:summary'
ADHERENCE_DAILY = 'adherence:daily'
ADHERENCE_PATTERN = 'adherence:pattern'
```

Criar `cachedAdherenceService` com:
- `getAdherenceSummary(period)` → cached via `cachedQuery('adherence:summary:{period}', ...)`
- `getDailyAdherenceFromView(days)` → cached via `cachedQuery('adherence:daily:{days}', ...)`
- `getAdherencePatternFromView()` → cached via `cachedQuery('adherence:pattern', ...)`

Invalidação: adicionar `adherence:*` ao `cachedLogService.create/createBulk/update/delete`.

**Impacto:** Visitas repetidas ao HealthHistory servem do cache (30s SWR). Elimina freeze em navegação de volta.

---

### Camada 2: Usar dados do DashboardProvider — Eliminar summary card bloqueante

**Arquivo:** `src/views/HealthHistory.jsx`

O DashboardProvider já provê via `useDashboard()`:
- `stats.score` — adherence score ponderado (60% adesão + 20% pontualidade + 20% estoque)
- `stats.taken` / `stats.expected` — doses tomadas/esperadas 30d
- `stats.currentStreak` — streak atual

**Mudança:** O summary card (linhas 285-306) já usa `stats.score` e `stats.currentStreak`. O único dado que vem de `adherenceSummary` é:
- `adherenceSummary.overallTaken/overallExpected` — label "X/Y doses"
- `adherenceSummary.longestStreak` — "Melhor: Xd"

**Ação:** Mover `getAdherenceSummary` para Phase 4 (background, não-bloqueante). Usar `stats.taken`/`stats.expected` no card inicialmente, e enriquecer quando o summary chegar.

---

### Camada 3: Serializar e deferir Phase 2 — Request scheduling

**Arquivo:** `src/views/HealthHistory.jsx`

Reestruturar `loadData()` em fases com gaps para render:

**Phase 1 (Bloqueante — UI critical):**
```javascript
const [logsResult, timelineResult] = await Promise.all([
  logService.getByMonth(...),
  logService.getAllPaginated(TIMELINE_PAGE_SIZE, 0),
])
setIsLoading(false) // UI pinta aqui
```

**Phase 2 (Deferido — após paint):**
```javascript
// requestIdleCallback com fallback setTimeout(100) para Safari
const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))
scheduleIdle(() => {
  cachedAdherenceService.getDailyAdherenceFromView(90)
    .then(setDailyAdherence)
    .catch(console.error)
})
```

**Phase 3 (Lazy — IntersectionObserver):** Já implementado para heatmap. Sem mudança.

**Phase 4 (Background — enrichment não-bloqueante):**
```javascript
// Após Phase 2, em outro idle callback
scheduleIdle(() => {
  cachedAdherenceService.getAdherenceSummary('90d')
    .then(setAdherenceSummary)
    .catch(console.error)
})
```

**Impacto:** Máximo de **2 requisições simultâneas** do HealthHistory em qualquer momento. DashboardProvider já está resolvido antes da view montar.

---

### Camada 4: Eliminar redundância interna do adherenceService

**Arquivo:** `src/services/api/adherenceService.js`

`getAdherenceSummary()` busca `protocols` 3 vezes (uma em cada sub-função). Refatorar:

```javascript
async getAdherenceSummary(period = '30d') {
  const userId = await getUserId()

  // Buscar protocols UMA VEZ
  const { data: protocols } = await supabase
    .from('protocols')
    .select('*, medicine:medicines(*)')
    .eq('user_id', userId).eq('active', true)

  // Passar protocols para todas sub-funções
  const results = await Promise.allSettled([
    this._calculateAdherenceWithProtocols(period, userId, protocols),
    this._calculateAllProtocolsAdherenceWithProtocols(period, userId, protocols),
    this._getCurrentStreakWithProtocols(userId, protocols),
  ])
  // ... resto inalterado
}
```

Criar variantes internas `_*WithProtocols` que aceitam protocols pré-carregados. A API pública (`calculateAdherence`, `getCurrentStreak`, etc.) permanece intacta para compatibilidade.

**Impacto:** `getAdherenceSummary` cai de 6+ queries para **4** (1 protocols + 1 HEAD count + 1 logs protocol_id + 1 logs taken_at). Economiza 2-3 round-trips.

---

### Camada 5: Slim select para timeline — Reduzir payload

**Arquivo:** `src/shared/services/api/logService.js`

`LogEntry` usa apenas: `id`, `taken_at`, `quantity_taken`, `notes`, `medicine.name`, `protocol.name`.
Atualmente: `select('*, protocol:protocols(*), medicine:medicines(*)')` — ~500 bytes/log.

Criar novo método:
```javascript
async getAllPaginatedSlim(limit = 50, offset = 0) {
  const { data, error, count } = await supabase
    .from('medicine_logs')
    .select(`
      id, taken_at, quantity_taken, notes, status, medicine_id, protocol_id,
      protocol:protocols(id, name),
      medicine:medicines(id, name)
    `, { count: 'exact' })
    .eq('user_id', await getUserId())
    .order('taken_at', { ascending: false })
    .range(offset, offset + limit - 1)
  // ...
}
```

Adicionar wrapper cached em `cachedServices.js`. Usar em HealthHistory para timeline.
Manter `getAllPaginated` (full select) para `getByMonth` que alimenta `LogForm` via `handleEditClick`.

**Impacto:** Payload da timeline cai de ~500→~100 bytes/log. Para 30 logs: **12KB economizados** por página.

---

## Contagem de Requisições Após Fix

| Fase | Timing | Queries | Concurrent |
|------|--------|---------|------------|
| DashboardProvider | App mount (já resolvido) | 3 | Antes da view montar |
| Phase 1 | View mount | 2 (calendar + timeline) | Só estas 2 |
| Phase 2 | Após paint (~100ms) | 1 (daily adherence view) | Sequencial |
| Phase 3 | On scroll | 1 (heatmap view) | Sequencial |
| Phase 4 | Background idle | 1 (summary → 4 sub-queries) | Após Phase 2 |

**Máximo simultâneo em qualquer momento: 2** (Phase 1). Safari consegue facilmente.

---

## Ordem de Implementação

1. **Camada 1** — cachedAdherenceService (base, sem breaking changes)
2. **Camada 4** — Refactor interno do adherenceService (reduz queries, sem mudança de API)
3. **Camada 5** — getAllPaginatedSlim + cached wrapper (novo método, sem breaking)
4. **Camada 3** — Serializar/deferir queries em HealthHistory (o fix principal)
5. **Camada 2** — Usar DashboardProvider stats no summary card (otimização final)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/shared/services/cachedServices.js` | + cachedAdherenceService + invalidação em log mutations |
| `src/services/api/adherenceService.js` | + _*WithProtocols variants, refactor getAdherenceSummary |
| `src/shared/services/api/logService.js` | + getAllPaginatedSlim com select mínimo |
| `src/views/HealthHistory.jsx` | Reestruturar loadData em 4 fases, usar stats do context |

Arquivos reference-only (não modificados):
- `src/features/dashboard/hooks/useDashboardContext.jsx` — confirmar stats disponíveis
- `src/shared/utils/queryCache.js` — entender API do cachedQuery

---

## Verificação

1. **Build + Lint:** `npm run validate:agent`
2. **Testes existentes:** Verificar que 473+ testes continuam passando
3. **Manual — Safari iPhone simulado (DevTools CPU 4x + 4G):**
   - Abrir HealthHistory → calendário + timeline renderizam em <1s
   - Sem "Long Task" vermelho no Performance tab durante abertura
   - Network tab: máximo 2 requests simultâneos do HealthHistory
   - Sparkline aparece ~200ms após UI interativa
   - Heatmap carrega ao scrollar
4. **Manual — Verificar invalidação:** Registrar dose → voltar ao HealthHistory → dados atualizados
5. **Manual — iPhone real se possível:** Confirmar que browser não trava

---

## Branch e Commits

**Branch:** `fix/mobile-perf-health-history-freeze`

Commits semânticos em português:
1. `feat(cache): adicionar cachedAdherenceService com SWR e invalidação`
2. `refactor(adherence): eliminar queries redundantes de protocols no getAdherenceSummary`
3. `feat(logs): getAllPaginatedSlim com select mínimo para timeline`
4. `fix(saude): serializar e deferir queries para desbloquear render mobile`
5. `perf(saude): usar DashboardProvider stats no summary card`
