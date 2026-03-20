# EXEC SPEC — Dashboard First Load Performance

**Versão:** 2.0 | **Data:** 2026-03-20
**Skill de entrega:** `/deliver-sprint`
**Evidência:** `bug-logs/first-load_production.har` + `bug-logs/trace-production.gz`
**Pré-requisito:** PR #403 mergeado (P4: slim selects, getUserId cache, calculateStreaks fix)

> Documento de execução autônoma para agentes IA coder.
> Cada sprint é **auto-contido** — o agente não precisa de contexto externo para executar.
> Leia o sprint inteiro antes de escrever a primeira linha de código.

---

## Problema

O primeiro carregamento do Dashboard (cache vazio) em produção carrega **757KB de JavaScript desnecessário** e faz **queries Supabase evitáveis**. Análise do HAR de produção (`first-load_production.har`) revela:

| Métrica | Valor (produção) | Impacto |
|---------|-------------------|---------|
| JS total carregado | 1435KB (8 chunks) | **757KB são de chunks que deveriam ser lazy** |
| Chunks eager indevidos | 4 (vendor-pdf, feature-stock, feature-history, feature-landing) | ~1.7s de download em 4G |
| Requests Supabase | 21 (7 GET + 7 OPTIONS + 3 auth GET + 3 auth OPTIONS + 1 misc) | Otimizável para 5 GET |
| Auth roundtrips | 3x `GET auth/user` × ~230ms | ~690ms em auth (PR #403 reduziu de 13→3, não 1) |
| Waterfall span | 1.9s | Razoável, mas comprimível |

### Correção de baseline: localhost vs produção

A versão 1.0 deste plano usava HAR de **localhost** (44.7s, 206 requests, 50 Supabase). Dados de **produção** mostram cenário radicalmente diferente:

| Métrica | localhost (v1.0) | produção (v2.0) | Causa da diferença |
|---------|------------------|------------------|--------------------|
| Total requests | 206 | 39 | StrictMode dobra effects em dev |
| Supabase total | 50 | 21 | StrictMode + HMR artifacts |
| Auth GET | 13 | 3 | PR #403 + StrictMode |
| Waterfall | 44.7s | 1.9s | Latência local + dev overhead |
| treatment_plans | 2x | **1x** | Duplicata era StrictMode |
| user_settings | 2x | **1x** | Duplicata era StrictMode |

### Breakdown das 21 requisições Supabase (produção)

```
 3x GET auth/user              (~690ms RTT total)
 3x OPTIONS auth/user           (CORS preflight)
 2x GET protocols               (queries DIFERENTES — ver análise abaixo)
 2x OPTIONS protocols
 2x GET medicine_logs           (slim 30d + dailyAdherence 7d)
 2x OPTIONS medicine_logs
 1x GET treatment_plans         (ok — não duplicada)
 1x OPTIONS treatment_plans
 1x GET medicines               (ok)
 1x OPTIONS medicines
 1x GET user_settings           (ok — não duplicada)
 1x OPTIONS user_settings
```

### Análise das 2 queries de protocols (NÃO são duplicatas simples)

```
GET protocols?select=*&active=eq.true                                          → 6.8KB
GET protocols?select=*,medicine:medicines(*),treatment_plan:(id,name,emoji,color)&active=eq.true → 11.6KB
```

A 1ª é `protocolService.getActive()` (DashboardProvider — select simples).
A 2ª é uma query com **joins de medicines + treatment_plans** — usada pelo adherenceService ou componentes que precisam dos dados enriquecidos. Para unificar, o DashboardProvider precisa passar a fazer a query com joins desde o início.

### Root cause do lazy loading quebrado

```
Dashboard.jsx (eager — main bundle)
  ↓ import (line 29)
ReportGenerator.jsx
  ↓ import (line 8)
pdfGeneratorService.js
  ↓ import (line 10)
stockService.js ← PUXA feature-stock para o main bundle
  ↓ transitive deps
vendor-pdf, feature-stock, feature-history, feature-landing
```

O `ReportGenerator` é importado **estaticamente** no Dashboard. Internamente, `pdfGeneratorService.js` importa `stockService`, `adherenceService`, `protocolService` e `chartRenderer` no top-level. Isso cria uma cadeia de dependências que puxa todos os chunks para o main bundle.

O Vite detecta essas dependências transitivas e gera `<link rel="modulepreload">` no `dist/index.html`, forçando o browser a baixar tudo imediatamente:

```html
<link rel="modulepreload" href="/assets/vendor-pdf-BNED_fl3.js">     <!-- 589KB! -->
<link rel="modulepreload" href="/assets/feature-stock-iTFS-CAb.js">  <!-- 139KB -->
<link rel="modulepreload" href="/assets/feature-history-BkKC8STs.js">
<link rel="modulepreload" href="/assets/feature-landing-BJH_M0j3.js">
```

---

## Metas

| Meta | Baseline (produção) | Target | Métrica |
|------|----------------------|--------|---------|
| JS carregado no first load | 1435KB | ≤678KB | `-53%` |
| Chunks eager indevidos | 4 | 0 | `-100%` |
| Requests Supabase (GET) | 7 | ≤5 | `-29%` |
| Auth roundtrips | 3 | 1 | `-67%` |
| Time-to-interactive (4G estimado) | ~3.5s | <2s | `-43%` |

---

## Sprints

### D0 — Corrigir lazy loading quebrado (PRIORIDADE MÁXIMA)

**Problema:** `Dashboard.jsx` importa `ReportGenerator` estaticamente (line 29). `ReportGenerator` importa `pdfGeneratorService.js`, que por sua vez importa `stockService`, `chartRenderer`, `adherenceService` e `protocolService` no top-level. Isso cria uma cadeia de dependências transitivas que puxa `vendor-pdf` (589KB), `feature-stock` (139KB), `feature-history` (35KB) e `feature-landing` (12KB) para o main bundle — **757KB desperdiçados**.

**Solução:** Converter o import de `ReportGenerator` em `Dashboard.jsx` para `React.lazy()`, e converter os imports de services pesados dentro de `pdfGeneratorService.js` para `import()` dinâmico nos handlers (já que PDF só é gerado sob ação do usuário).

**Arquivos a modificar:**

1. **`src/views/Dashboard.jsx`** — Line 29
   - DE: `import ReportGenerator from '@features/reports/components/ReportGenerator'`
   - PARA: `const ReportGenerator = lazy(() => import('@features/reports/components/ReportGenerator'))`
   - Envolver uso do `<ReportGenerator>` em `<Suspense fallback={null}>` (componente só aparece ao clicar "Gerar Relatório", não precisa de skeleton)

2. **`src/features/reports/services/pdfGeneratorService.js`** — Lines 7-11
   - Converter imports estáticos de services pesados para `import()` dinâmico dentro das funções que os usam:
   ```js
   // ANTES (top-level — puxa tudo para o main bundle)
   import { renderAdherenceChart, renderStockChart } from './chartRenderer.js'
   import { stockService } from '@features/stock/services/stockService.js'

   // DEPOIS (dinâmico — carrega sob demanda quando o usuário gera PDF)
   // Dentro de cada função que precisa:
   const { renderAdherenceChart, renderStockChart } = await import('./chartRenderer.js')
   const { stockService } = await import('@features/stock/services/stockService.js')
   ```
   - **NOTA:** `adherenceService` e `protocolService` podem continuar estáticos se não forem os que puxam chunks pesados. Verificar com `npm run build` após mudança.

3. **Verificação pós-build:**
   - Rodar `npm run build` e conferir que `dist/index.html` **NÃO** tem `<link rel="modulepreload">` para `vendor-pdf`, `feature-stock`, `feature-history`, `feature-landing`
   - Confirmar que main bundle (`index-*.js`) diminuiu significativamente

**Impacto:** -757KB no first load (~53% redução), -1.7s estimado em 4G

**Testes:**
- Verificar que geração de PDF ainda funciona (o import dinâmico carrega os módulos sob demanda)
- Verificar que Dashboard renderiza sem delay (ReportGenerator carrega lazy ao abrir)
- `npm run build` — confirmar chunks não são mais preloaded

**Quality gates:**
- [ ] `npm run validate:agent` passa (10-min kill switch)
- [ ] 0 erros de lint
- [ ] `dist/index.html` sem modulepreload de vendor-pdf, feature-stock, feature-history, feature-landing
- [ ] Main bundle ≤ 110kB gzip (era 102kB, pode variar com mudanças de import)

---

### D1 — Eliminar query de dailyAdherence no Dashboard (Alto Impacto)

**Problema:** `Dashboard.jsx:250-261` faz `adherenceService.getDailyAdherence(7)` em useEffect separado. Internamente, este método:
1. Chama `getUserId()` (1 auth roundtrip — cacheado, mas contribui para as 3x auth/user)
2. Faz `from('medicine_logs').select('taken_at')` para 7 dias (query adicional, 4.2KB)

Visível no HAR de produção como a **14ª request** (última do waterfall):
```
04:55:28.201 GET medicine_logs?select=taken_at&taken_at=gte.2026-03-12...  205.9ms  4161B
```

O DashboardProvider já possui `protocols` e `logs` (últimos 30 dias). A daily adherence de 7 dias pode ser **calculada client-side** a partir dos dados já disponíveis no context.

**Solução:** Mover cálculo de `dailyAdherence` para o DashboardProvider como um `useMemo`, eliminando a chamada ao adherenceService e suas queries internas.

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

**Impacto:** -1 query medicine_logs (206ms), -1 auth roundtrip indireto (getUserId interno)

**Quality gates:**
- [ ] `npm run validate:agent` passa (10-min kill switch)
- [ ] 0 erros de lint
- [ ] SparklineAdesao renderiza corretamente com dados do context
- [ ] Cálculo client-side produz resultados equivalentes ao adherenceService

---

### D2 — Unificar queries de protocols no DashboardProvider (Médio Impacto)

**Problema:** Em produção existem 2 queries GET de protocols com selects diferentes:

```
GET protocols?select=*&active=eq.true                                          → 6.8KB  249ms
GET protocols?select=*,medicine:medicines(*),treatment_plan:(id,name,emoji,color)&active=eq.true → 11.6KB  233ms
```

A 1ª vem do `DashboardProvider` via `protocolService.getActive()` (select simples).
A 2ª vem de outro consumer que precisa dos dados com joins (medicines + treatment_plans).

**Solução:** Modificar a query do DashboardProvider para usar o select enriquecido (com joins) desde o início. Assim, todos os consumers usam os mesmos dados e a 2ª query é eliminada.

**Arquivos a modificar:**

1. **`src/features/dashboard/hooks/useDashboardContext.jsx`**
   - Alterar o fetcher de protocols para usar `protocolService.getActiveWithRelations()` (ou equivalente) que retorna protocols com joins de medicines e treatment_plans
   - Se `getActiveWithRelations()` não existe, criar no protocolService

2. **`src/features/protocols/services/protocolService.js`**
   - Adicionar `getActiveWithRelations()` se não existir:
     ```js
     async getActiveWithRelations() {
       const { data } = await supabase
         .from('protocols')
         .select('*, medicine:medicines(*), treatment_plan:treatment_plans(id, name, emoji, color)')
         .eq('user_id', await getUserId())
         .eq('active', true)
       return data || []
     }
     ```

3. **Consumidores da 2ª query** — Identificar quem faz a query com joins e fazê-lo consumir do context ou receber protocols como parâmetro. Provavelmente é um dos componentes do Dashboard (ProtocolCard, TreatmentAccordion) ou o adherenceService.

**NOTA:** A query com joins retorna 11.6KB vs 6.8KB sem joins. O aumento de payload (4.8KB) é insignificante comparado à economia de 1 roundtrip (~233ms em 4G).

**Impacto:** -1 query protocols (233ms), +4.8KB payload (trade-off favorável)

**Quality gates:**
- [ ] `npm run validate:agent` passa (10-min kill switch)
- [ ] 0 erros de lint
- [ ] Componentes que usam protocols com relations continuam renderizando corretamente
- [ ] HAR pós-fix mostra apenas 1 GET protocols

---

### D3 — Cachear getCurrentUser com coalescência (Baixo Impacto)

**Problema:** `auth/user` é chamado 3x em produção (~690ms total). O PR #403 cacheou `getUserId()`, mas `getCurrentUser()` (usado no Dashboard para obter `userName`) faz sua própria chamada `supabase.auth.getUser()`.

**Solução:** Cachear `getCurrentUser()` com o mesmo padrão de coalescência de promises usado em `getUserId()`.

**Arquivos a modificar:**

1. **`src/shared/utils/supabase.js`**
   - Cachear resultado de `getCurrentUser()` em `_cachedUser`
   - Coalescência: `_currentUserPromise` para múltiplas chamadas simultâneas
   - Invalidar no `onAuthStateChange` (SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED)

**Impacto:** -2 auth roundtrips (3 → 1), ~460ms economia

**Quality gates:**
- [ ] `npm run validate:agent` passa (10-min kill switch)
- [ ] Login → Dashboard carrega userName sem delay extra
- [ ] Sign out → Sign in com outro user → userName atualiza corretamente

---

## Sprints cancelados (v1.0 → v2.0)

| Sprint v1.0 | Motivo do cancelamento |
|-------------|----------------------|
| D2 (treatment_plans dedup) | Produção mostra **1x query** — duplicata era artifact do React StrictMode em dev |
| D4 (user_settings dedup) | Produção mostra **1x query** — duplicata era artifact do React StrictMode em dev |
| D6 (CORS preflight) | OPTIONS já são rápidos em produção (~30-80ms). Otimização de `Access-Control-Max-Age` é server-side e fora do escopo |

---

## Ordem de execução

```
D0 → D1 → D2 → D3
```

**Justificativa:**
- **D0 primeiro** (MÁXIMO impacto: -757KB JS, ~1.7s economia — maior que todos os outros combinados)
- **D1 segundo** (elimina query + useEffect de dailyAdherence, ~206ms)
- **D2 terceiro** (unifica protocols, ~233ms)
- **D3 por último** (cache auth, ~460ms — baixo risco, quick win)

---

## Impacto estimado (cumulativo)

| Após Sprint | JS First Load | REST GETs | Auth GETs | Economia estimada (4G) |
|-------------|---------------|-----------|-----------|------------------------|
| Baseline produção | 1435KB | 7 | 3 | — |
| + D0 (fix lazy loading) | **678KB** | 7 | 3 | **~1.7s** |
| + D1 (dailyAdherence client) | 678KB | 6 | 3 | ~206ms |
| + D2 (protocols unificado) | 678KB | 5 | 3 | ~233ms |
| + D3 (getCurrentUser cache) | 678KB | 5 | **1** | ~460ms |
| **Target final** | **≤678KB (-53%)** | **5 (-29%)** | **1 (-67%)** | **~2.6s economia** |

---

## Validação final

Após implementar D0-D3, regravar HAR de produção com cache limpo e comparar:

```bash
# No Chrome DevTools → Network → "Disable cache" → Reload
# Exportar como HAR
# Comparar com bug-logs/first-load_production.har (baseline)
```

**Métricas a comparar:**
- JS total carregado (bytes) — target: ≤678KB
- `dist/index.html` — zero modulepreload de chunks lazy
- Total de requests Supabase (GET) — target: ≤5
- Auth roundtrips — target: 1
- Waterfall span total

**Validação de build (D0):**
```bash
npm run build
# Verificar dist/index.html — NÃO deve ter modulepreload para:
#   vendor-pdf, feature-stock, feature-history, feature-landing
grep "modulepreload" dist/index.html
```

---

## Referências

- `bug-logs/first-load_production.har` — Baseline produção (39 requests, 1.9s waterfall)
- `bug-logs/trace-production.gz` — Chrome Performance trace (produção)
- `bug-logs/first-load.har` — Baseline localhost (206 requests, 44.7s — apenas referência histórica)
- `bug-logs/trace-localhost-dashboard.gz` — Chrome Performance trace localhost (referência histórica)
- `plans/archive_old/mobile_performance/EXEC_SPEC_MOBILE_PERFORMANCE.md` — Sprints M0-M8
- `.memory/rules.md` — R-117 (lazy loading), R-125-R-128 (performance patterns)
- `.memory/anti-patterns.md` — AP-P12, AP-P13 (payload + GC)
- `CLAUDE.md` — Seção "Mobile Performance"
