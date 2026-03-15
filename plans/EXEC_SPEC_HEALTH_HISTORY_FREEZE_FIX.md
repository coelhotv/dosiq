# EXEC SPEC — Fix HealthHistory Mobile Browser Freeze

**Versão:** 1.0 | **Data:** 2026-03-15
**Plano-base:** `plans/new-plan-mobile-performance-refactor.md`
**Skill de entrega:** `/deliver-sprint`

> Documento de execução autônoma para agentes IA coder.
> Cada sprint é **auto-contido** — o agente não precisa de contexto externo para executar.
> Leia o sprint inteiro antes de escrever a primeira linha de código.

---

## Status de Entregas

| Sprint | Status | Commit | Data | Quality Gates |
|--------|--------|--------|------|---------------|
| **P1** | ✅ CONCLUÍDO | dcfccb0 | 2026-03-15 | lint ✅ build ✅ tests ✅ |
| **P2** | ✅ CONCLUÍDO | af8185a | 2026-03-15 | lint ✅ build ✅ tests ✅ |
| **P3** | ✅ CONCLUÍDO | fe26176 | 2026-03-15 | lint ✅ build ✅ tests ✅ |

---

## Contexto Obrigatório (Ler Antes de Qualquer Sprint)

### Por que esta spec existe

A view "Saúde" (`HealthHistory.jsx`) **trava completamente** o browser mobile (Safari iPhone, Chrome Android) ao ser aberta. O calendário e as doses do dia carregam, mas:
- "ÚLTIMAS DOSES" aparece com título mas sem entries (Virtuoso montado mas bloqueado)
- Sparkline e Heatmap nunca renderizam
- Browser não permite scroll, navegação, nem reload

**Screenshot do problema:** `screenshots/saude-mobile-sem-historico.PNG`
**Trace Safari:** `screenshots/trace-safari-mobile.png`

### Causa Raiz (diagnosticada com trace)

Quando HealthHistory monta, dispara **12+ requisições Supabase simultâneas** em <500ms:

| Fase | Fonte | Queries | Cache? |
|------|-------|---------|--------|
| DashboardProvider (pai) | `useCachedQueries` | 3 (medicines, protocols, logs:30d) | SWR ✅ |
| Phase 1 (loadData L89-92) | `getByMonth` + `getAllPaginated` | 2 | SWR ✅ |
| Phase 2 (loadData L107-117) | `getAdherenceSummary` (6 sub-queries) + `getDailyAdherenceFromView` | 7 | **NÃO** ❌ |
| Lazy (IntersectionObserver) | heatmap | 1 | **NÃO** ❌ |

Safari mobile tem pool de conexões HTTP/2 limitado a **4-6 por origem**. Com 12+ requests simultâneos, o main thread bloqueia esperando slots de conexão enquanto tenta renderizar.

**Redundância crítica:** `getAdherenceSummary('90d')` internamente chama 3 sub-funções que CADA UMA busca `protocols` independentemente — dados que o DashboardProvider **já tem carregados**.

### Sequência obrigatória dos sprints

```
P1 → P2 → P3
```

- **P1** adiciona cache + refatora adherenceService (foundation, sem breaking changes)
- **P2** reestrutura o HealthHistory para usar cache + deferir queries (o fix principal)
- **P3** reduz payload da timeline (otimização complementar)

### Pré-requisitos para qualquer agente iniciar qualquer sprint

**CRÍTICO (R-065):** Antes de escrever qualquer código, executar:

```bash
# 1. Verificar duplicatas dos arquivos-alvo
find src -name "HealthHistory*" -type f
find src -name "adherenceService*" -type f
find src -name "cachedServices*" -type f
find src -name "logService*" -type f

# 2. Rastrear imports
grep -r "from.*adherenceService" src/
grep -r "from.*cachedServices" src/
grep -r "cachedLogService\|cachedAdherenceService" src/

# 3. Confirmar aliases no vite.config.js
grep -A 30 "alias" vite.config.js
```

Então ler:
- `.memory/rules.md` — focar em R-001, R-010, R-051, R-060, R-065
- `.memory/anti-patterns.md` — focar em AP-001, AP-004, AP-012, AP-020, AP-021, AP-P09, AP-P10, AP-W13

### Padrões que não mudam

| Contexto | Regra |
|----------|-------|
| Nomes de variáveis | camelCase em inglês |
| Comentários JSDoc | Português |
| Commits | Português semântico (`fix(saude): ...`) |
| Hook order | States → Memos → Effects → Handlers (R-010) |
| Validação antes do push | `npm run validate:agent` obrigatório |
| PR | Nunca auto-mergear (R-060, AP-020) |
| Gemini review | Esperar e resolver CRITICAL/HIGH (R-062, AP-021) |

### Arquivos envolvidos (inventário completo)

| Arquivo | Linhas | Sprint | Tipo de mudança |
|---------|--------|--------|-----------------|
| `src/shared/services/cachedServices.js` | 367 | P1 | + cachedAdherenceService + invalidação |
| `src/shared/services/index.js` | 34 | P1 | + export cachedAdherenceService |
| `src/services/api/adherenceService.js` | 716 | P1 | + _*WithProtocols variants |
| `src/views/HealthHistory.jsx` | 457 | P2 | Reestruturar loadData em fases |
| `src/shared/services/api/logService.js` | 375 | P3 | + getAllPaginatedSlim |

---

# SPRINT P1 — CACHE + REFACTOR ADHERENCESERVICE

**Branch:** `fix/mobile-perf-p1-cache-adherence`
**Dependência:** Nenhuma — executar primeiro
**Duração estimada:** 1 dia
**Arquivos:**
- `src/shared/services/cachedServices.js` (modificar)
- `src/shared/services/index.js` (modificar)
- `src/services/api/adherenceService.js` (modificar)

---

## PASSO 1 — Setup (deliver-sprint Step 1)

```bash
git checkout main && git pull origin main
git checkout -b fix/mobile-perf-p1-cache-adherence
```

Verificar estado inicial:
```bash
# Confirmar arquivos corretos
find src -name "cachedServices*" -type f
# Esperado: src/shared/services/cachedServices.js (apenas um)

find src -name "adherenceService*" -type f
# Esperado: src/services/api/adherenceService.js (apenas um)

# Confirmar que cachedAdherenceService NÃO existe ainda
grep -n "cachedAdherenceService" src/shared/services/cachedServices.js
# Esperado: zero resultados

# Verificar API do queryCache (funções disponíveis)
grep -n "export function\|export async function" src/shared/utils/queryCache.js
# Esperado: generateCacheKey, cachedQuery, invalidateCache, etc.
```

---

## PASSO 2 — Implementação (deliver-sprint Step 2)

### P1.1 — Adicionar cachedAdherenceService em cachedServices.js

**Por que:** As queries de adesão (`getAdherenceSummary`, `getDailyAdherenceFromView`, `getAdherencePatternFromView`) não têm cache. Cada abertura do HealthHistory dispara 7+ queries frescas ao Supabase. Com cache SWR de 30s, visitas repetidas servem do cache instantaneamente.

**Localização:** `src/shared/services/cachedServices.js`

**Passo 1:** Adicionar import do adherenceService no topo do arquivo, junto aos outros imports de services:

```javascript
// Adicionar após os imports existentes (linha ~18, após treatmentPlanService):
import { adherenceService } from '@services/api/adherenceService'
```

**Passo 2:** Adicionar novos cache keys ao objeto `CACHE_KEYS` (após TREATMENT_PLAN_BY_ID):

```javascript
// Dentro de CACHE_KEYS, adicionar após TREATMENT_PLAN_BY_ID:
ADHERENCE_SUMMARY: 'adherence:summary',
ADHERENCE_DAILY: 'adherence:daily',
ADHERENCE_PATTERN: 'adherence:pattern',
```

**Passo 3:** Criar o bloco `cachedAdherenceService` ANTES do barrel export final (`export const cachedServices = {`):

```javascript
/**
 * Adherence Service com Cache
 * Queries de adesão são read-only — invalidação acontece via cachedLogService mutations.
 */
export const cachedAdherenceService = {
  async getAdherenceSummary(period = '30d') {
    const key = generateCacheKey(CACHE_KEYS.ADHERENCE_SUMMARY, { period })
    return cachedQuery(key, () => adherenceService.getAdherenceSummary(period))
  },

  async getDailyAdherenceFromView(days = 30) {
    const key = generateCacheKey(CACHE_KEYS.ADHERENCE_DAILY, { days })
    return cachedQuery(key, () => adherenceService.getDailyAdherenceFromView(days))
  },

  async getAdherencePatternFromView() {
    return cachedQuery(CACHE_KEYS.ADHERENCE_PATTERN, () =>
      adherenceService.getAdherencePatternFromView()
    )
  },
}
```

**Passo 4:** Adicionar `cachedAdherenceService` ao barrel export:

```javascript
// Localizar: export const cachedServices = {
// Adicionar adherenceService ao objeto:
export const cachedServices = {
  medicineService: cachedMedicineService,
  protocolService: cachedProtocolService,
  stockService: cachedStockService,
  logService: cachedLogService,
  treatmentPlanService: cachedTreatmentPlanService,
  adherenceService: cachedAdherenceService, // NOVO
}
```

**Passo 5:** Adicionar invalidação de `adherence:*` em TODOS os métodos de mutação do `cachedLogService`. Localizar cada método (create, createBulk, update, delete) e adicionar **após** as invalidações existentes de logs:

```javascript
// Dentro de cachedLogService.create, após invalidateCache('logs:dateRange*'):
invalidateCache(`${CACHE_KEYS.ADHERENCE_SUMMARY}*`)
invalidateCache(`${CACHE_KEYS.ADHERENCE_DAILY}*`)
invalidateCache(CACHE_KEYS.ADHERENCE_PATTERN)
```

Repetir para `createBulk`, `update`, e `delete`. São 4 métodos, cada um recebe as 3 linhas acima.

**Verificação:**
```bash
# Confirmar que invalidação foi adicionada em todos os 4 métodos:
grep -c "ADHERENCE_SUMMARY" src/shared/services/cachedServices.js
# Esperado: 6 (1 definição + 1 uso no cache + 4 invalidações)

grep -c "ADHERENCE_DAILY" src/shared/services/cachedServices.js
# Esperado: 6

grep -c "ADHERENCE_PATTERN" src/shared/services/cachedServices.js
# Esperado: 6
```

---

### P1.2 — Exportar cachedAdherenceService no barrel export

**Localização:** `src/shared/services/index.js`

Adicionar ao bloco de exports de services com cache (linha ~26-34):

```javascript
// Localizar o bloco: export { cachedMedicineService, ... } from '@shared/services/cachedServices'
// Adicionar cachedAdherenceService à lista:
export {
  cachedMedicineService,
  cachedProtocolService,
  cachedStockService,
  cachedLogService,
  cachedTreatmentPlanService,
  cachedAdherenceService, // NOVO
  cachedServices,
  CACHE_KEYS,
} from '@shared/services/cachedServices'
```

**Verificação:**
```bash
grep "cachedAdherenceService" src/shared/services/index.js
# Esperado: 1 resultado (o export)
```

---

### P1.3 — Refatorar getAdherenceSummary para buscar protocols UMA VEZ

**Por que:** `getAdherenceSummary()` chama 3 sub-funções em `Promise.allSettled`. Cada uma busca `protocols` independentemente — são 3 queries idênticas ao mesmo endpoint. Buscando uma vez e passando como parâmetro, economizamos 2 round-trips HTTP.

**Localização:** `src/services/api/adherenceService.js` — método `getAdherenceSummary` (linhas 330-356)

**Passo 1:** Substituir o método `getAdherenceSummary` completo:

```javascript
// ANTES (linhas 330-356):
async getAdherenceSummary(period = '30d') {
  const userId = await getUserId()
  const results = await Promise.allSettled([
    this.calculateAdherence(period, userId),
    this.calculateAllProtocolsAdherence(period, userId),
    this.getCurrentStreak(userId),
  ])
  // ... rest
}
```

```javascript
// DEPOIS:
async getAdherenceSummary(period = '30d') {
  const userId = await getUserId()

  // Buscar protocols UMA VEZ — evita 3 queries idênticas nas sub-funções
  const { data: protocols, error: protocolError } = await supabase
    .from('protocols')
    .select('*, medicine:medicines(*)')
    .eq('user_id', userId)
    .eq('active', true)

  if (protocolError) throw protocolError

  // Passa protocols pré-carregados para todas as sub-funções
  const results = await Promise.allSettled([
    this._calculateAdherenceWithProtocols(period, userId, protocols),
    this._calculateAllProtocolsAdherenceWithProtocols(period, userId, protocols),
    this._getCurrentStreakWithProtocols(userId, protocols),
  ])

  const overall =
    results[0].status === 'fulfilled' ? results[0].value : { score: 0, taken: 0, expected: 0 }
  const protocolScores = results[1].status === 'fulfilled' ? results[1].value : []
  const streaks =
    results[2].status === 'fulfilled'
      ? results[2].value
      : { currentStreak: 0, longestStreak: 0 }

  return {
    overallScore: overall.score,
    overallTaken: overall.taken,
    overallExpected: overall.expected,
    period,
    protocolScores,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
  }
},
```

**Passo 2:** Adicionar 3 métodos internos `_*WithProtocols` DENTRO do objeto `adherenceService`, logo após `getAdherencePatternFromView` (antes do `}` que fecha o objeto, ~linha 504):

```javascript
/**
 * @private Variante de calculateAdherence que recebe protocols pré-carregados
 */
async _calculateAdherenceWithProtocols(period, userId, protocols) {
  const { startDate, endDate, days } = _getDateRangeForPeriod(period)

  // HEAD request — apenas count, zero dados transferidos
  const { count, error: logError } = await supabase
    .from('medicine_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('taken_at', startDate.toISOString())
    .lte('taken_at', endDate.toISOString())

  if (logError) throw logError

  const expectedDoses = calculateExpectedDoses(protocols, days, endDate)
  const takenDoses = count || 0
  const score = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0

  return {
    score: Math.min(score, 100),
    taken: takenDoses,
    expected: expectedDoses,
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }
},

/**
 * @private Variante de calculateAllProtocolsAdherence que recebe protocols pré-carregados
 */
async _calculateAllProtocolsAdherenceWithProtocols(period, userId, protocols) {
  const { startDate, endDate, days } = _getDateRangeForPeriod(period)

  if (!protocols || protocols.length === 0) return []

  // Batch: APENAS protocol_id — ~50 bytes por log ao invés de ~500
  const { data: allLogs, error: logError } = await supabase
    .from('medicine_logs')
    .select('protocol_id')
    .eq('user_id', userId)
    .gte('taken_at', startDate.toISOString())
    .lte('taken_at', endDate.toISOString())

  if (logError) throw logError

  // Agrupar por protocol_id client-side: O(M) uma vez
  const takenByProtocol = new Map()
  ;(allLogs || []).forEach((log) => {
    if (log.protocol_id) {
      takenByProtocol.set(log.protocol_id, (takenByProtocol.get(log.protocol_id) || 0) + 1)
    }
  })

  return protocols.map((protocol) => {
    const expected = calculateExpectedDoses([protocol], days, endDate)
    const taken = takenByProtocol.get(protocol.id) || 0
    const score = expected > 0 ? Math.min(Math.round((taken / expected) * 100), 100) : 0
    return {
      protocolId: protocol.id,
      name: protocol.name,
      medicineName: protocol.medicine?.name,
      score,
      taken,
      expected,
      error: false,
    }
  })
},

/**
 * @private Variante de getCurrentStreak que recebe protocols pré-carregados
 */
async _getCurrentStreakWithProtocols(userId, protocols) {
  if (!protocols || protocols.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 90)

  const { data: logs, error } = await supabase
    .from('medicine_logs')
    .select('taken_at')
    .eq('user_id', userId)
    .gte('taken_at', startDate.toISOString())
    .lte('taken_at', endDate.toISOString())
    .order('taken_at', { ascending: false })

  if (error) throw error

  if (!logs || logs.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  const logsByDay = groupLogsByDay(logs)
  const { currentStreak, longestStreak } = calculateStreaks(logsByDay, protocols)

  return { currentStreak, longestStreak }
},
```

**IMPORTANTE:** Os métodos públicos originais (`calculateAdherence`, `calculateAllProtocolsAdherence`, `getCurrentStreak`) permanecem INALTERADOS. Eles são chamados diretamente por outros componentes (Dashboard widgets, etc.). Apenas `getAdherenceSummary` usa as variantes `_*WithProtocols`.

**Verificação:**
```bash
# Confirmar que os 3 métodos internos existem
grep -n "_calculateAdherenceWithProtocols\|_calculateAllProtocolsAdherenceWithProtocols\|_getCurrentStreakWithProtocols" \
  src/services/api/adherenceService.js
# Esperado: 3 definições + 3 chamadas em getAdherenceSummary = 6 resultados

# Confirmar que os métodos públicos originais continuam intactos
grep -n "async calculateAdherence\b\|async calculateAllProtocolsAdherence\b\|async getCurrentStreak\b" \
  src/services/api/adherenceService.js
# Esperado: 3 resultados (os métodos públicos originais)

# Confirmar que getAdherenceSummary agora busca protocols diretamente
grep -n "from('protocols')" src/services/api/adherenceService.js | head -10
# Deve incluir a nova query dentro de getAdherenceSummary
```

---

### P1.4 — Verificar dead code (AP-W13)

```bash
# Confirmar que nenhuma variável foi deixada órfã
npm run lint
# Esperado: 0 erros

# Confirmar que as funções helper (calculateExpectedDoses, groupLogsByDay, calculateStreaks)
# são acessíveis pelas novas funções _*WithProtocols
# (estão no module scope do mesmo arquivo — OK)
grep -n "^function calculateExpectedDoses\|^function groupLogsByDay\|^function calculateStreaks" \
  src/services/api/adherenceService.js
# Esperado: 3 resultados (funções no escopo do módulo)
```

---

## PASSO 3 — Validação (deliver-sprint Step 3)

```bash
# Gate 1: Lint
npm run lint
# Esperado: 0 erros, 0 warnings novos

# Gate 2: Build
npm run build
# Esperado: sem erros de módulo

# Gate 3: Testes
npm run validate:agent
# Esperado: todos os testes passando, sem regressões
# Foco: adherenceService tests, cachedServices tests
```

---

## PASSO 4 — Git (deliver-sprint Step 4)

```bash
git add src/shared/services/cachedServices.js \
        src/shared/services/index.js \
        src/services/api/adherenceService.js
git status
# Confirmar: APENAS estes 3 arquivos modificados

git commit -m "feat(cache): cachedAdherenceService + refactor getAdherenceSummary

- Adicionar cachedAdherenceService com SWR para summary, daily e pattern
- Invalidação automática em todos os mutations de cachedLogService
- Refatorar getAdherenceSummary: buscar protocols 1× (era 3×)
- Criar _*WithProtocols variants para sub-funções internas
- API pública (calculateAdherence, getCurrentStreak, etc.) inalterada

Resultado: queries de adesão cacheadas 30s + 2 round-trips eliminados.
Próximo: P2 reestrutura loadData do HealthHistory para usar cache."
```

---

## PASSO 5 — Push e PR (deliver-sprint Step 5)

```bash
git push -u origin fix/mobile-perf-p1-cache-adherence
```

Criar PR com:
- **Title:** `feat(cache): cachedAdherenceService + refactor getAdherenceSummary`
- **Body:**

```markdown
## Problema
Queries de adesão (getAdherenceSummary, getDailyAdherenceFromView, getAdherencePatternFromView)
não tinham cache. Cada abertura do HealthHistory disparava 7+ queries frescas ao Supabase.
Além disso, getAdherenceSummary buscava `protocols` 3× internamente (uma por sub-função).

## Solução
1. **cachedAdherenceService** — SWR cache (30s) para as 3 queries de adesão
2. **Invalidação automática** — log mutations (create/update/delete) invalidam `adherence:*`
3. **_*WithProtocols variants** — getAdherenceSummary busca protocols 1× e passa para sub-funções

## Impacto
- Visitas repetidas ao HealthHistory: queries servidas do cache (0 HTTP requests)
- getAdherenceSummary: 6 queries → 4 (2 round-trips eliminados)
- API pública inalterada — sem breaking changes

## Quality Gates
- [x] `npm run validate:agent` — sem regressões
- [x] `npm run build` — sem erros
- [x] `npm run lint` — 0 erros
```

---

## PASSO 6 — Gemini Review (deliver-sprint Step 6)

Aguardar Gemini Code Assist. Resolver CRITICAL/HIGH antes do merge.

Se Gemini questionar a duplicação entre métodos públicos e `_*WithProtocols`:
- Os métodos públicos são chamados isoladamente por outros componentes (Dashboard widgets)
- As variantes `_*WithProtocols` são internas (prefixo `_`) e usadas apenas por `getAdherenceSummary`
- Manter ambos evita breaking changes nos consumidores existentes

---

## PASSO 7 — Learning Loop (deliver-sprint Step 7)

Registrar em `.memory/rules.md`:

```markdown
### R-125: Cache SWR para queries de adesão [HIGH]
**Regra:** Queries de leitura do adherenceService DEVEM usar cachedAdherenceService.
**Cache keys:** adherence:summary:{period}, adherence:daily:{days}, adherence:pattern
**Invalidação:** Automática via cachedLogService mutations.
**Source:** Sprint P1 — fix HealthHistory mobile freeze
```

Registrar em `.memory/anti-patterns.md`:

```markdown
### AP-P12: Mesma query Supabase chamada N vezes em sub-funções paralelas [HIGH]
**Problema:** getAdherenceSummary chamava 3 sub-funções que cada uma buscava `protocols` independentemente = 3 queries idênticas.
**Fix:** Buscar dados compartilhados UMA VEZ na função orquestradora e passar como parâmetro.
**Fonte:** Sprint P1 — refactor getAdherenceSummary
```

---

---

# SPRINT P2 — REESTRUTURAR HEALTHHISTORY LOADDATA

**Branch:** `fix/mobile-perf-p2-serialize-requests`
**Dependência:** P1 merged em main
**Duração estimada:** 1 dia
**Arquivo principal:** `src/views/HealthHistory.jsx`

---

## PASSO 1 — Setup (deliver-sprint Step 1)

```bash
git checkout main && git pull origin main
git checkout -b fix/mobile-perf-p2-serialize-requests

# Verificar que P1 está merged
grep "cachedAdherenceService" src/shared/services/cachedServices.js | head -3
# Esperado: definição do cachedAdherenceService presente

# Verificar estado do HealthHistory
find src -name "HealthHistory*" -type f
# Esperado: src/views/HealthHistory.jsx (apenas um)

# Ler estado atual do loadData
grep -n "loadData\|adherenceService\|getDailyAdherence\|getAdherenceSummary" \
  src/views/HealthHistory.jsx
```

---

## PASSO 2 — Implementação (deliver-sprint Step 2)

### P2.1 — Trocar import do adherenceService para cached version

**Localização:** `src/views/HealthHistory.jsx` — linha 6

```javascript
// ANTES (linha 6):
import { adherenceService } from '@services/api/adherenceService'

// DEPOIS:
import { cachedAdherenceService as adherenceService } from '@shared/services'
```

**Por que:** Usar a versão cacheada transparentemente. Como `cachedAdherenceService` expõe a mesma API que `adherenceService`, nenhuma outra mudança é necessária para esse import funcionar.

---

### P2.2 — Reestruturar loadData em fases serializadas

**Por que:** O `loadData` atual (linhas 82-125) dispara Phase 1 e Phase 2 em sequência direta — sem dar ao browser tempo de renderizar após `setIsLoading(false)`. As 7 queries de adherence competem com o render do Virtuoso por slots de conexão HTTP/2. Deferindo Phase 2 com `requestIdleCallback`, o browser pinta a UI primeiro.

**Localização:** `src/views/HealthHistory.jsx` — substituir todo o `loadData` useCallback (linhas 82-125)

```javascript
// ANTES (linhas 82-125):
const loadData = useCallback(async () => {
  try {
    setIsLoading(true)
    setError(null)
    const now = new Date()

    const [logsResult, timelineResult] = await Promise.all([
      logService.getByMonth(now.getFullYear(), now.getMonth()),
      logService.getAllPaginated(TIMELINE_PAGE_SIZE, 0),
    ])

    setCurrentMonthLogs(logsResult.data || [])
    setTotalLogs(logsResult.total || 0)
    setTimelineLogs(timelineResult.data || [])
    setTimelineHasMore(timelineResult.hasMore || false)
    setTimelineOffset(TIMELINE_PAGE_SIZE)

    if (logsResult.data?.length > 0) {
      setSelectedCalendarDate(new Date(logsResult.data[0].taken_at))
    }

    setIsLoading(false)

    const [summary, daily] = await Promise.all([
      adherenceService.getAdherenceSummary('90d').catch((err) => {
        console.error('[HealthHistory] ERRO ao carregar summary:', err.message, err)
        return null
      }),
      adherenceService.getDailyAdherenceFromView(90).catch((err) => {
        console.error('[HealthHistory] ERRO ao carregar daily adherence:', err.message, err)
        return []
      }),
    ])

    setAdherenceSummary(summary)
    setDailyAdherence(daily)
  } catch (err) {
    setError('Erro ao carregar dados: ' + err.message)
    setIsLoading(false)
  }
}, [])
```

```javascript
// DEPOIS:
const loadData = useCallback(async () => {
  try {
    setIsLoading(true)
    setError(null)
    const now = new Date()

    // ── Phase 1: UI-critical (calendar + timeline) ──
    // Máximo 2 requests simultâneos. Cache SWR resolve em <5ms se fresh.
    const [logsResult, timelineResult] = await Promise.all([
      logService.getByMonth(now.getFullYear(), now.getMonth()),
      logService.getAllPaginated(TIMELINE_PAGE_SIZE, 0),
    ])

    setCurrentMonthLogs(logsResult.data || [])
    setTotalLogs(logsResult.total || 0)
    setTimelineLogs(timelineResult.data || [])
    setTimelineHasMore(timelineResult.hasMore || false)
    setTimelineOffset(TIMELINE_PAGE_SIZE)

    if (logsResult.data?.length > 0) {
      setSelectedCalendarDate(new Date(logsResult.data[0].taken_at))
    }

    // UI fica interativa AQUI — browser pode pintar calendário + timeline
    setIsLoading(false)

    // ── Phase 2: Deferido — sparkline + summary após paint ──
    // requestIdleCallback permite ao browser completar o paint antes de disparar queries.
    // Safari não suporta requestIdleCallback — fallback para setTimeout(100ms).
    const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))

    scheduleIdle(() => {
      // Sparkline: 1 query leve (v_daily_adherence view, ~30 rows)
      adherenceService
        .getDailyAdherenceFromView(90)
        .then((daily) => setDailyAdherence(daily))
        .catch((err) =>
          console.error('[HealthHistory] ERRO ao carregar daily adherence:', err.message)
        )
        .then(() => {
          // Phase 3: Summary completo — APÓS sparkline resolver
          // Serializado para nunca ter >1 query ativa do HealthHistory
          adherenceService
            .getAdherenceSummary('90d')
            .then((summary) => setAdherenceSummary(summary))
            .catch((err) =>
              console.error('[HealthHistory] ERRO ao carregar summary:', err.message)
            )
        })
    })
  } catch (err) {
    setError('Erro ao carregar dados: ' + err.message)
    setIsLoading(false)
  }
}, [])
```

**Pontos críticos desta mudança:**

1. **Phase 1** continua idêntica — 2 queries paralelas, `setIsLoading(false)` ao final
2. **Phase 2** agora é deferida via `requestIdleCallback` (ou `setTimeout(100)` no Safari)
3. **Sparkline** carrega primeiro (1 query leve — `v_daily_adherence` view, ~30 rows)
4. **Summary** carrega DEPOIS do sparkline resolver (serializado, nunca paralelo)
5. **Heatmap** continua via IntersectionObserver (Phase 3 lazy, sem mudança)

**Resultado:** Máximo de 2 requests simultâneos do HealthHistory em qualquer momento.

---

### P2.3 — Usar stats do DashboardProvider no summary card

**Por que:** O summary card (linhas 285-306) já usa `stats.score` e `stats.currentStreak` do DashboardProvider. Os dados de `adherenceSummary` (`overallTaken/overallExpected`, `longestStreak`) são enriquecimento — não devem bloquear o render.

**Localização:** `src/views/HealthHistory.jsx` — linhas 265-268 (antes do return)

```javascript
// ANTES (linhas 265-268):
const score = stats?.score ?? 0
const streak = stats?.currentStreak ?? 0
const bestStreak = adherenceSummary?.longestStreak ?? streak

// DEPOIS (sem mudança funcional, mas adicionar fallbacks mais ricos):
const score = stats?.score ?? 0
const streak = stats?.currentStreak ?? 0
const bestStreak = adherenceSummary?.longestStreak ?? streak
const overallTaken = adherenceSummary?.overallTaken ?? stats?.taken ?? 0
const overallExpected = adherenceSummary?.overallExpected ?? stats?.expected ?? 0
```

Atualizar o JSX do summary card para usar os novos fallbacks (linha ~291-295):

```jsx
// ANTES (linha 291-295):
{adherenceSummary && (
  <span className="health-history-summary__detail">
    {adherenceSummary.overallTaken}/{adherenceSummary.overallExpected} doses
  </span>
)}

// DEPOIS — sempre mostra (usa stats como fallback enquanto summary não carregou):
{(overallExpected > 0) && (
  <span className="health-history-summary__detail">
    {overallTaken}/{overallExpected} doses
  </span>
)}
```

**Impacto:** O summary card renderiza completo imediatamente com dados do DashboardProvider. Quando `adherenceSummary` chegar (Phase 3), os valores se atualizam automaticamente via re-render.

---

### P2.4 — Trocar adherenceService no IntersectionObserver

O IntersectionObserver (setSentinelElement) já chama `adherenceService.getAdherencePatternFromView()` — como trocamos o import em P2.1, automaticamente usa a versão cacheada. **Nenhuma mudança adicional necessária.**

Verificar:
```bash
grep -n "adherenceService" src/views/HealthHistory.jsx
# Esperado: import da cachedAdherenceService + chamadas no loadData e setSentinelElement
# NÃO deve haver import direto do @services/api/adherenceService
```

---

### P2.5 — Verificar dead code (AP-W13)

```bash
# Confirmar que não há imports não-usados
npm run lint
# Esperado: 0 erros

# Confirmar que adherenceSummary state ainda é necessário (para bestStreak e overallTaken/Expected)
grep -n "adherenceSummary" src/views/HealthHistory.jsx
# Esperado: useState + setAdherenceSummary + uso no render
```

---

## PASSO 3 — Validação (deliver-sprint Step 3)

```bash
# Gate 1: Lint
npm run lint
# Esperado: 0 erros

# Gate 2: Build
npm run build
# Esperado: sem erros

# Gate 3: Testes
npm run validate:agent
# Esperado: todos passando, sem regressões

# Gate 4: Verificação manual (OBRIGATÓRIA)
# Chrome DevTools > Network tab + CPU 4x throttle + 4G simulado
# 1. Navegar para "Saúde"
# 2. Verificar: calendário + timeline renderizam em <1s
# 3. Network: máximo 2 requests medicine_logs simultâneos na abertura
# 4. Verificar: sparkline aparece ~200ms após UI interativa
# 5. Verificar: "X/Y doses" no summary card aparece imediatamente (usando stats)
# 6. Performance tab: ausência de "Long Task" (>50ms) durante abertura
# 7. Scroll até final: heatmap carrega via IntersectionObserver
```

---

## PASSO 4 — Git (deliver-sprint Step 4)

```bash
git add src/views/HealthHistory.jsx
git status
# Confirmar: APENAS HealthHistory.jsx modificado

git commit -m "fix(saude): serializar e deferir queries para desbloquear render mobile

- loadData reestruturado em fases: Phase 1 (UI) → Phase 2 (deferido) → Phase 3 (lazy)
- requestIdleCallback (fallback setTimeout 100ms) defere queries de adesão
- Sparkline e Summary serializados: nunca mais de 1 query ativa após Phase 1
- Import trocado para cachedAdherenceService (cache SWR 30s)
- Summary card usa stats do DashboardProvider como fallback imediato
- Máximo de 2 requests simultâneos (era 12+)

Root cause: Safari mobile HTTP/2 pool (4-6 conexões) saturado com 12+ requests
simultâneos → main thread bloqueado → browser travava completamente."
```

---

## PASSO 5 — Push e PR (deliver-sprint Step 5)

```bash
git push -u origin fix/mobile-perf-p2-serialize-requests
```

Criar PR com:
- **Title:** `fix(saude): serializar queries para desbloquear render mobile`
- **Body:**

```markdown
## Problema
HealthHistory travava completamente em mobile Safari/Chrome ao abrir.
Causa: 12+ requisições Supabase simultâneas em <500ms, saturando o pool HTTP/2 do Safari (4-6 conexões).

## Solução
Reestruturar `loadData()` em fases serializadas:

1. **Phase 1 (bloqueante):** Calendar + Timeline — 2 requests paralelos
2. **Phase 2 (deferido via requestIdleCallback):** Sparkline → Summary — serializados
3. **Phase 3 (lazy via IntersectionObserver):** Heatmap — já implementado

## Detalhes
- Import trocado para `cachedAdherenceService` (P1) — cache SWR 30s
- Summary card usa `stats` do DashboardProvider como fallback imediato
- Max concurrent requests: **2** (era 12+)

## Quality Gates
- [x] `npm run validate:agent` — sem regressões
- [x] `npm run build` — sem erros
- [x] Chrome DevTools: ≤2 requests simultâneos na abertura
- [x] Chrome DevTools Performance: 0 Long Tasks na abertura
```

---

## PASSO 6 — Gemini Review (deliver-sprint Step 6)

Aguardar Gemini. Resolver CRITICAL/HIGH.

Se Gemini questionar o encadeamento `.then().then()`:
- É intencional — serializa as queries para nunca saturar o connection pool
- Async/await dentro de `scheduleIdle` callback não é possível pois `requestIdleCallback` não é async-aware
- O `.catch()` em cada chamada garante que falha de uma não bloqueia a outra

---

## PASSO 7 — Learning Loop (deliver-sprint Step 7)

Registrar em `.memory/rules.md`:

```markdown
### R-126: Serializar queries Supabase em views mobile [CRITICAL]
**Regra:** Views mobile-critical NUNCA devem disparar >4 requests Supabase simultâneos.
**Padrão:** Phase 1 (UI-blocking, max 2 paralelos) → Phase 2 (deferido via requestIdleCallback) → Phase 3 (lazy via IntersectionObserver).
**Safari:** Não suporta requestIdleCallback — usar fallback setTimeout(100ms).
**Source:** Sprint P2 — fix HealthHistory mobile freeze (12→2 concurrent requests)
```

Registrar em `.memory/anti-patterns.md`:

```markdown
### AP-P13: Disparar queries de background imediatamente após setIsLoading(false) [CRITICAL]
**Problema:** setIsLoading(false) permite o React agendar um render, mas queries disparadas na mesma stack frame competem com o paint por HTTP/2 connection slots.
**Resultado:** Browser mobile trava — main thread bloqueada esperando slots de conexão.
**Fix:** Usar requestIdleCallback (ou setTimeout(100ms) no Safari) para deferir queries não-urgentes APÓS o browser completar o paint.
**Fonte:** Sprint P2 — HealthHistory mobile freeze (Safari trace confirmou saturação do pool HTTP/2)
```

---

---

# SPRINT P3 — SLIM SELECT PARA TIMELINE

**Branch:** `perf/mobile-perf-p3-slim-timeline`
**Dependência:** P2 merged em main
**Duração estimada:** 0.5 dia
**Arquivos:**
- `src/shared/services/api/logService.js` (modificar)
- `src/shared/services/cachedServices.js` (modificar)
- `src/views/HealthHistory.jsx` (modificar)

---

## PASSO 1 — Setup (deliver-sprint Step 1)

```bash
git checkout main && git pull origin main
git checkout -b perf/mobile-perf-p3-slim-timeline

# Verificar que P2 está merged
grep "cachedAdherenceService" src/views/HealthHistory.jsx
# Esperado: import presente

# Verificar campos usados pelo LogEntry
grep -n "log\." src/shared/components/log/LogEntry.jsx
# Campos usados: log.taken_at, log.medicine?.name, log.protocol.name,
# log.quantity_taken, log.notes, log.id
# Também: onEdit(log) passa o log completo — MAS apenas para abrir o modal.
# O LogForm recebe initialValues que precisa de mais campos.
```

**ATENÇÃO:** `onEdit(log)` passa o objeto `log` completo para `handleEditClick`, que seta `editingLog` e abre o modal `LogForm`. O `LogForm` pode precisar de campos como `medicine_id`, `protocol_id`, `status`. Verificar:

```bash
grep -n "initialValues\." src/shared/components/log/LogForm.jsx | head -20
# Identificar quais campos do log o LogForm usa
```

Se o LogForm precisar de campos além do slim select, o approach muda: a timeline precisa do log completo para edição, mas pode usar slim select para **renderização**. A solução é: re-fetch o log completo quando o usuário clica em "Editar".

---

## PASSO 2 — Implementação (deliver-sprint Step 2)

### P3.1 — Adicionar getAllPaginatedSlim em logService.js

**Localização:** `src/shared/services/api/logService.js` — após `getAllPaginated` (linha ~294)

```javascript
/**
 * Timeline: dados mínimos para renderização (sem relações completas)
 * LogEntry usa: id, taken_at, quantity_taken, notes, medicine.name, protocol.name
 * ~100 bytes/log (vs ~500 bytes com select('*') + full relations)
 */
getAllPaginatedSlim: async (limit = 50, offset = 0) => {
  const { data, error, count } = await supabase
    .from('medicine_logs')
    .select(
      `
      id, taken_at, quantity_taken, notes, status, medicine_id, protocol_id,
      protocol:protocols(id, name),
      medicine:medicines(id, name)
    `,
      { count: 'exact' }
    )
    .eq('user_id', await getUserId())
    .order('taken_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return {
    data: normalizeTimestamps(data) || [],
    total: count || 0,
    hasMore: offset + limit < (count || 0),
  }
},
```

**Verificação:**
```bash
grep -n "getAllPaginatedSlim" src/shared/services/api/logService.js
# Esperado: 1 resultado (a definição)
```

---

### P3.2 — Adicionar cached wrapper em cachedServices.js

**Localização:** `src/shared/services/cachedServices.js` — dentro de `cachedLogService`, após `getAllPaginated`

```javascript
// Dentro de cachedLogService, adicionar após getAllPaginated:
async getAllPaginatedSlim(limit, offset) {
  const key = generateCacheKey('logs:paginatedSlim', { limit, offset })
  return cachedQuery(key, () => logService.getAllPaginatedSlim(limit, offset))
},
```

Adicionar invalidação nos métodos de mutação (create, createBulk, update, delete):

```javascript
// Em cada método de mutação do cachedLogService, adicionar junto com as outras invalidações de logs:
invalidateCache('logs:paginatedSlim*')
```

**Verificação:**
```bash
grep -c "paginatedSlim" src/shared/services/cachedServices.js
# Esperado: 6 (1 key + 1 wrapper + 4 invalidações)
```

---

### P3.3 — Usar getAllPaginatedSlim no HealthHistory

**Localização:** `src/views/HealthHistory.jsx`

**Mudança 1:** Na Phase 1 do loadData, trocar `getAllPaginated` por `getAllPaginatedSlim`:

```javascript
// ANTES:
logService.getAllPaginated(TIMELINE_PAGE_SIZE, 0),

// DEPOIS:
logService.getAllPaginatedSlim(TIMELINE_PAGE_SIZE, 0),
```

**Mudança 2:** No handleLoadMoreTimeline (linha ~247-260):

```javascript
// ANTES:
const result = await logService.getAllPaginated(TIMELINE_PAGE_SIZE, timelineOffset)

// DEPOIS:
const result = await logService.getAllPaginatedSlim(TIMELINE_PAGE_SIZE, timelineOffset)
```

**Mudança 3:** Adaptar handleEditClick para re-fetch o log completo quando necessário:

```javascript
// ANTES (linha 242-245):
const handleEditClick = useCallback((log) => {
  setEditingLog(log)
  setIsModalOpen(true)
}, [])

// DEPOIS — busca log completo para o LogForm:
const handleEditClick = useCallback(async (log) => {
  try {
    // Re-fetch log completo com todas as relações para o LogForm
    const fullLogs = await logService.getByMonth(
      new Date(log.taken_at).getFullYear(),
      new Date(log.taken_at).getMonth()
    )
    const fullLog = fullLogs.data?.find((l) => l.id === log.id) || log
    setEditingLog(fullLog)
    setIsModalOpen(true)
  } catch {
    // Fallback: usa o log slim (pode faltar alguns campos para edição)
    setEditingLog(log)
    setIsModalOpen(true)
  }
}, [])
```

**NOTA:** O `getByMonth` já retorna logs completos com full relations E já é cacheado (SWR). Para o mês corrente, a resposta vem do cache em <5ms. Para meses anteriores, é uma query mínima (dados do mês já carregados).

**Alternativa mais simples** — se o LogForm funciona com os campos slim (id, taken_at, quantity_taken, notes, status, medicine_id, protocol_id, medicine.name, protocol.name), o handleEditClick NÃO precisa de re-fetch. Verificar antes de implementar:

```bash
# Verificar quais campos o LogForm usa de initialValues
grep -n "initialValues\.\|initialValues\[" src/shared/components/log/LogForm.jsx | head -20
```

Se os campos slim forem suficientes, manter o handleEditClick original.

---

### P3.4 — Verificar dead code

```bash
npm run lint
# Esperado: 0 erros

# Confirmar que LogEntry ainda renderiza corretamente com dados slim
# (medicine.name, protocol.name, taken_at, quantity_taken, notes estão no slim select)
grep -n "log\." src/shared/components/log/LogEntry.jsx
# Todos os campos devem estar no slim select
```

---

## PASSO 3 — Validação (deliver-sprint Step 3)

```bash
# Gate 1: Lint
npm run lint

# Gate 2: Build
npm run build

# Gate 3: Testes
npm run validate:agent

# Gate 4: Verificação manual
# Chrome DevTools > Network tab
# 1. Abrir HealthHistory → verificar payload do primeiro request de timeline
#    Deve conter apenas: id, taken_at, quantity_taken, notes, status, medicine_id, protocol_id,
#    medicine:{id, name}, protocol:{id, name}
# 2. Scroll timeline → verificar que doses aparecem corretamente
# 3. Clicar "Editar" em uma dose → verificar que LogForm abre com dados corretos
# 4. Verificar: payload ~100 bytes/log (vs ~500 bytes anteriormente)
```

---

## PASSO 4 — Git (deliver-sprint Step 4)

```bash
git add src/shared/services/api/logService.js \
        src/shared/services/cachedServices.js \
        src/views/HealthHistory.jsx
git status

git commit -m "perf(saude): slim select para timeline — reduzir payload 80%

- Adicionar getAllPaginatedSlim: select mínimo (id, taken_at, quantity, notes, names)
- Cached wrapper com invalidação em log mutations
- HealthHistory usa slim para timeline (rendering) e full para edição (LogForm)
- Payload: ~500 bytes/log → ~100 bytes/log (~80% redução)
- Para 30 logs por página: 15KB → 3KB economizados"
```

---

## PASSO 5 — Push e PR (deliver-sprint Step 5)

```bash
git push -u origin perf/mobile-perf-p3-slim-timeline
```

**PR Body:**

```markdown
## O que muda
Timeline de doses usa select mínimo com apenas os campos que LogEntry renderiza.

## Por que
O select atual (`*, protocol:protocols(*), medicine:medicines(*)`) transfere ~500 bytes por log.
LogEntry só usa: id, taken_at, quantity_taken, notes, medicine.name, protocol.name.

## Impacto
- Payload por log: ~500 → ~100 bytes (80% redução)
- Por página (30 logs): ~15KB → ~3KB
- Em 4G com latência 200ms: ~120ms mais rápido por página

## Quality Gates
- [x] `npm run validate:agent` — sem regressões
- [x] LogEntry renderiza corretamente com dados slim
- [x] Edição de dose abre LogForm com dados completos
```

---

## PASSO 6 — Gemini Review

Aguardar Gemini. Resolver CRITICAL/HIGH.

---

## PASSO 7 — Learning Loop

Registrar em `.memory/rules.md`:

```markdown
### R-127: Select mínimo em queries Supabase para listas [HIGH]
**Regra:** Queries para listas/timelines devem selecionar apenas colunas usadas no render.
**Padrão:** `select('id, campo1, campo2, relation:table(id, name)')` ao invés de `select('*, relation:table(*)')`.
**Exceção:** Queries que alimentam formulários de edição precisam de full select.
**Source:** Sprint P3 — slim timeline select (80% payload reduction)
```

---

---

# Apêndice: Contagem Final de Requisições

## Antes do Fix (estado atual)

```
t=0ms    DashboardProvider: 3 queries (cached SWR)
t=10ms   Phase 1: 2 queries paralelas (getByMonth + getAllPaginated)
t=500ms  Phase 2: 7 queries paralelas (getAdherenceSummary=6 + getDailyAdherenceFromView=1)
t=600ms  Phase 3: 1 query (IntersectionObserver → heatmap)
─────────────────────────────────────────────────
TOTAL:   13 queries, 9+ simultâneas no pico
         Safari HTTP/2 pool: SATURADO → browser trava
```

## Depois do Fix (P1+P2+P3)

```
t=0ms    DashboardProvider: 3 queries (cached SWR, já resolvidas antes da view)
t=10ms   Phase 1: 2 queries paralelas (getByMonth + getAllPaginatedSlim)
t=500ms  setIsLoading(false) → browser pinta UI
t=600ms  requestIdleCallback → Phase 2: 1 query (getDailyAdherenceFromView, cached)
t=800ms  Phase 2 resolve → 1 query (getAdherenceSummary, cached, 4 sub-queries internas)
         (scroll) Phase 3: 1 query (heatmap, IntersectionObserver)
─────────────────────────────────────────────────
TOTAL:   8 queries (4 menos), máximo 2 simultâneas
         Cache SWR: visitas repetidas = 0 queries novas (30s window)
         Safari HTTP/2 pool: NUNCA saturado
```

---

# Apêndice: Checklist Universal por Sprint

Antes de criar PR, verificar:

- [ ] `find src -name "*ArquivoAlterado*" -type f` → apenas um resultado (R-001)
- [ ] `npm run lint` → 0 erros (AP-012)
- [ ] `npm run validate:agent` → todos os testes passando (R-051)
- [ ] `npm run build` → sem erros (R-003)
- [ ] Dead code removido (AP-W13)
- [ ] Hook order: States → Memos → Effects → Handlers (R-010)
- [ ] Branch criada a partir de `main` atualizado
- [ ] PR NÃO auto-mergeado (R-060, AP-020)

---

# Referências

- `plans/archive_old/mobile_performance/EXEC_SPEC_MOBILE_PERFORMANCE.md` — sprints M0-M8 (concluídos)
- `docs/standards/MOBILE_PERFORMANCE.md` — guia de performance mobile
- `.memory/rules.md` — R-001 a R-127
- `.memory/anti-patterns.md` — AP-001 a AP-P13
- `CLAUDE.md` — convenções completas do projeto
- `screenshots/saude-mobile-sem-historico.PNG` — screenshot do bug
- `screenshots/trace-safari-mobile.png` — trace Safari confirmando saturação HTTP/2
