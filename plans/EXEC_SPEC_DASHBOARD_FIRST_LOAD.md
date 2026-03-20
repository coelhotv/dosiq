# EXEC SPEC — Dashboard First Load Performance

**Versão:** 1.0 | **Data:** 2026-03-20
**Skill de entrega:** `/deliver-sprint`
**Evidência:** `bug-logs/first-load.har` + `bug-logs/trace-localhost-dashboard.gz`
**Pré-requisito:** PR #403 mergeado (P4: slim selects, getUserId cache, calculateStreaks fix)

> Documento de execução autônoma para agentes IA coder.
> Cada sprint é **auto-contido** — o agente não precisa de contexto externo para executar.
> Leia o sprint inteiro antes de escrever a primeira linha de código.

---

## Problema

O primeiro carregamento do Dashboard (cache vazio) em dispositivo móvel mid-tier com 4G instável (cenário Brasil real) é excessivamente lento. Análise do HAR (`first-load.har`) revela:

| Métrica | Valor | Impacto |
|---------|-------|---------|
| Waterfall total | 44.7s | App inutilizável por quase 1 minuto |
| Requests Supabase | 50 (25 GET + 25 OPTIONS/CORS) | Saturação de conexões |
| Auth roundtrips | 13x `GET auth/user` × ~620ms | **~8s só em auth** (corrigido no PR #403) |
| Queries duplicadas | protocols 3x, treatment_plans 2x, user_settings 2x | ~4s de RTT desperdiçado |
| Cascata de effects | 4 useEffects independentes no Dashboard.jsx | Serializa requests desnecessariamente |

### Breakdown das 50 requisições Supabase

```
13x GET auth/user              (~8s RTT) ← CORRIGIDO PR #403 (getUserId cache)
13x OPTIONS auth/user           (CORS preflight)
 3x GET protocols               (duplicadas)
 3x OPTIONS protocols
 3x GET medicine_logs           (1 falhou com 400, 2 ok)
 3x OPTIONS medicine_logs
 2x GET treatment_plans         (duplicadas)
 2x OPTIONS treatment_plans
 2x GET user_settings           (duplicadas)
 2x OPTIONS user_settings
 1x GET medicines               (ok)
 1x OPTIONS medicines
```

### Fontes de duplicação identificadas (HAR + grep)

| Tabela | Fonte 1 | Fonte 2 | Fonte 3 |
|--------|---------|---------|---------|
| `protocols` | `DashboardProvider` → `protocolService.getActive()` | `Dashboard.jsx:252` → `adherenceService.getDailyAdherence(7)` (refetch interno) | `adherenceService.getAdherenceSummary` (via HealthHistory) |
| `treatment_plans` | `Dashboard.jsx:224` → `treatmentPlanService.getAll()` | Cache key mismatch: Treatment.jsx usa `'treatmentPlans:all'` vs cachedService usa `'treatmentPlans'` | — |
| `user_settings` | `OnboardingProvider.jsx:30` → `select('onboarding_completed')` | `Settings.jsx:35` / `Profile.jsx:44` → `select('*')` | — |
| `medicine_logs` | `DashboardProvider` → `logService.getByDateRangeSlim()` | `Dashboard.jsx:252` → `adherenceService.getDailyAdherence(7)` (query independente) | `adherenceService` internals |

---

## Metas

| Meta | Baseline (HAR) | Target | Métrica |
|------|----------------|--------|---------|
| Requests Supabase (GET) | 25 | ≤12 | `-52%` |
| Auth roundtrips | 13 | 1 | **Já corrigido** (PR #403) |
| Queries protocols | 3 | 1 | `-67%` |
| Queries treatment_plans | 2 | 1 | `-50%` |
| Time-to-interactive (estimado) | ~15s (4G) | <5s (4G) | `-67%` |

---

## Sprints

### D1 — Eliminar queries duplicadas de protocols (Alto Impacto)

**Problema:** `adherenceService.getDailyAdherence(7)` e `adherenceService.getAdherenceSummary('90d')` fazem seus próprios `from('protocols').select('*').eq('active', true)` internamente, duplicando a query que o DashboardProvider já faz via `protocolService.getActive()`.

**Solução:** Modificar os métodos do adherenceService para aceitar `protocols` pré-carregados como parâmetro opcional. Quem já possui os protocolos (Dashboard via context) passa direto; quem não possui (bot, API) continua buscando.

**Arquivos a modificar:**

1. **`src/services/api/adherenceService.js`**
   - `getDailyAdherence(days, userId, protocols)` — se `protocols` passado, skip query
   - `getAdherenceSummary(period)` já faz 1 query de protocols e repassa via `_calculateAdherenceWithProtocols`, `_calculateAllProtocolsAdherenceWithProtocols`, `_getCurrentStreakWithProtocols` — está OK internamente, mas o `getDailyAdherence` (chamado separadamente pelo Dashboard) refaz a query

2. **`src/views/Dashboard.jsx`** — Line 250-261
   - Passar `protocols` do context para `adherenceService.getDailyAdherence(7, null, protocols)`

**Impacto:** -2 queries protocols (3 → 1)

**Testes:**
- Adaptar mocks em testes existentes do adherenceService
- Verificar que `getDailyAdherence` funciona com E sem protocols passados

**Quality gates:**
- [ ] `npm run validate:agent` passa (10-min kill switch)
- [ ] 0 erros de lint
- [ ] Dashboard.jsx não faz mais query de protocols própria

---

### D2 — Eliminar query duplicada de treatment_plans (Médio Impacto)

**Problema:** `Dashboard.jsx:224` chama `treatmentPlanService.getAll()` direto em um useEffect. Isso duplica a chamada quando o cache key não bate.

**Solução:** Consolidar treatment_plans no DashboardProvider (ou usar cache consistente).

**Opção A (recomendada):** Adicionar `treatmentPlans` ao DashboardProvider

O DashboardProvider já centraliza medicines, protocols e logs. Treatment plans são usados no Dashboard (`TreatmentAccordion`) e em Treatment view. Adicionar ao provider elimina a duplicação e mantém o padrão "custo zero".

**Arquivos a modificar:**

1. **`src/features/dashboard/hooks/useDashboardContext.jsx`**
   - Adicionar query `{ key: 'treatmentPlans:all', fetcher: () => treatmentPlanService.getAll() }` ao array `queries`
   - Expor `treatmentPlans` no value do context

2. **`src/views/Dashboard.jsx`**
   - Remover `useState(rawTreatmentPlans)` + useEffect de `loadInitialData`
   - Consumir `treatmentPlans` direto do context: `const { ..., treatmentPlans } = useDashboard()`
   - **NOTA:** `getCurrentUser()` para userName precisa continuar no useEffect (não é query de dados compartilhados)

3. **`src/features/dashboard/hooks/__tests__/useDashboardContext.test.jsx`**
   - Adicionar mock para `treatmentPlanService.getAll`
   - Verificar que `treatmentPlans` está no context

**Opção B (alternativa simples):** Alinhar cache keys
   - `cachedServices.js` usa `CACHE_KEYS.TREATMENT_PLANS = 'treatmentPlans'`
   - `Treatment.jsx:35` usa `useCachedQuery('treatmentPlans:all', ...)`
   - Alinhar para a mesma key resolve o duplicate se ambos rodam na mesma sessão
   - **Desvantagem:** Não resolve o duplicate no Dashboard first load (Dashboard e Treatment são views diferentes)

**Impacto:** -1 query treatment_plans, -1 getUserId (se removido do useEffect separado)

**Quality gates:**
- [ ] `npm run validate:agent` passa
- [ ] 0 erros de lint
- [ ] `TreatmentAccordion` renderiza corretamente com dados do context

---

### D3 — Consolidar getCurrentUser no DashboardProvider (Médio Impacto)

**Problema:** `Dashboard.jsx:224` faz `getCurrentUser()` no useEffect que chama `supabase.auth.getUser()` — mais um roundtrip de auth. Mesmo com o cache de `getUserId()`, `getCurrentUser()` não é cacheado.

**Solução:** Cachear `getCurrentUser()` com o mesmo padrão de coalescência do `getUserId()` em `supabase.js`.

**Arquivos a modificar:**

1. **`src/shared/utils/supabase.js`**
   - Cachear resultado de `getCurrentUser()` em `_cachedUser`
   - Coalescência: `_currentUserPromise` para múltiplas chamadas simultâneas
   - Invalidar no `onAuthStateChange` (SIGNED_IN/SIGNED_OUT)

**Impacto:** -1 auth roundtrip no Dashboard first load

**Quality gates:**
- [ ] `npm run validate:agent` passa
- [ ] Login → Dashboard carrega userName sem delay extra
- [ ] Sign out → Sign in com outro user → userName atualiza corretamente

---

### D4 — Deduplicar user_settings/onboarding (Baixo Impacto)

**Problema:** `OnboardingProvider.jsx:30` faz `select('onboarding_completed')` enquanto `Settings.jsx:35` faz `select('*')` — duas queries para a mesma tabela.

**Solução:** Criar um `UserSettingsProvider` (ou consolidar no `OnboardingProvider`) que carrega user_settings UMA VEZ e compartilha via context.

**NOTA:** Este sprint tem impacto menor porque:
- OnboardingProvider roda em TODA navegação (app-level)
- Settings/Profile só rodam quando o usuário navega para essas views
- A duplicação no first load pode ser artifact do React StrictMode em dev

**Avaliação recomendada:** Medir em produção antes de implementar. Se a duplicação não ocorre em prod (StrictMode), baixar prioridade.

**Quality gates:**
- [ ] `npm run validate:agent` passa
- [ ] Onboarding wizard ainda aparece para novos usuários
- [ ] Settings carrega corretamente sem query extra

---

### D5 — Eliminar DailyAdherence query independente no Dashboard (Alto Impacto)

**Problema:** `Dashboard.jsx:250-261` faz `adherenceService.getDailyAdherence(7)` em useEffect separado. Internamente, este método:
1. Chama `getUserId()` (1 auth roundtrip — agora cacheado)
2. Faz `from('protocols').select('*').eq('active', true)` (query duplicada)
3. Faz `from('medicine_logs').select('taken_at')` (query adicional)

O DashboardProvider já possui `protocols` e `logs` (últimos 30 dias). A daily adherence de 7 dias pode ser **calculada client-side** a partir dos dados já disponíveis no context.

**Solução:** Mover cálculo de `dailyAdherence` para o DashboardProvider como um `useMemo`, eliminando a chamada ao adherenceService e suas 2-3 queries internas.

**Arquivos a modificar:**

1. **`src/features/dashboard/hooks/useDashboardContext.jsx`**
   - Adicionar `dailyAdherence` como useMemo derivado de `logsResult.data` + `protocolsResult.data`
   - Lógica: agrupar logs por dia (últimos 7 dias), contar taken vs expected por protocolo
   - Expor `dailyAdherence` no context value

2. **`src/views/Dashboard.jsx`**
   - Remover useEffect de `loadAdherence()` (lines 248-261)
   - Remover `const [dailyAdherence, setDailyAdherence] = useState([])`
   - Remover `const [, setIsAdherenceLoading] = useState(true)`
   - Consumir `dailyAdherence` do context

3. **`src/features/dashboard/hooks/__tests__/useDashboardContext.test.jsx`**
   - Verificar que `dailyAdherence` está disponível no context
   - Verificar que é array com format `{ date, adherence, taken, expected }`

**Impacto:** -2 queries (protocols + medicine_logs), -1 useEffect no Dashboard

**Quality gates:**
- [ ] `npm run validate:agent` passa
- [ ] SparklineAdesao renderiza corretamente com dados do context
- [ ] Cálculo client-side produz resultados equivalentes ao adherenceService

---

### D6 — Reduzir CORS preflight com Supabase headers (Baixo Impacto)

**Problema:** Cada query Supabase gera um `OPTIONS` preflight (CORS). Com 12+ queries, são 12+ roundtrips extras (~50-100ms cada em 4G).

**Solução:** O Supabase client permite configurar `headers` globais. Se o `Access-Control-Max-Age` for alto o suficiente, o browser reutiliza o preflight para requests subsequentes ao mesmo endpoint.

**Investigação necessária:**
- Verificar se o Supabase server retorna `Access-Control-Max-Age` adequado
- Se não, verificar se é configurável no dashboard Supabase
- Se não configurável, esta otimização é do lado servidor e sai do escopo

**NOTA:** Este sprint pode não ser implementável do lado client. Avaliar primeiro.

---

## Ordem de execução recomendada

```
D5 → D1 → D2 → D3 → D4 → D6
```

**Justificativa:**
- **D5 primeiro** (mais impacto: elimina 2-3 queries + 1 useEffect, dados já estão no context)
- **D1 segundo** (elimina refetch de protocols no adherenceService)
- **D2 terceiro** (consolida treatment_plans no provider)
- **D3** (cache getCurrentUser — quick win)
- **D4** (user_settings — medir antes, pode não ser necessário)
- **D6** (CORS — investigação necessária, pode ser inviável do client)

---

## Impacto estimado (cumulativo)

| Após Sprint | Queries GET | Auth Roundtrips | Estimativa 4G |
|-------------|-------------|-----------------|---------------|
| Baseline | 25 | 13 | ~15s |
| PR #403 (getUserId cache) | 25 | 1 | ~8s |
| + D5 (dailyAdherence client) | 22 | 1 | ~7s |
| + D1 (protocols dedup) | 20 | 1 | ~6s |
| + D2 (treatment_plans provider) | 19 | 1 | ~5.5s |
| + D3 (getCurrentUser cache) | 19 | 1 | ~5s |
| **Target** | **≤12** | **1** | **<5s** |

---

## Validação final

Após implementar D1-D5, regravar HAR com cache limpo e comparar:

```bash
# No Chrome DevTools → Network → "Disable cache" → Reload
# Exportar como HAR
# Comparar com bug-logs/first-load.har (baseline)
```

**Métricas a comparar:**
- Total de requests Supabase (GET)
- Waterfall span total
- Time-to-first-contentful-paint
- Time-to-interactive

---

## Referências

- `bug-logs/first-load.har` — Baseline network (206 requests, 44.7s waterfall)
- `bug-logs/trace-localhost-dashboard.gz` — Chrome Performance trace (dashboard)
- `bug-logs/trace-localhost-history.gz` — Chrome Performance trace (HealthHistory)
- `plans/archive_old/mobile_performance/EXEC_SPEC_MOBILE_PERFORMANCE.md` — Sprints M0-M8
- `.memory/rules.md` — R-117 (lazy loading), R-125-R-128 (performance patterns)
- `.memory/anti-patterns.md` — AP-P12, AP-P13 (payload + GC)
- `CLAUDE.md` — Seção "Mobile Performance"
