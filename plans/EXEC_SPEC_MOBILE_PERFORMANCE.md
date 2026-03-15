# EXEC SPEC — Meus Remédios: Performance Mobile
**Versão:** 2.0 | **Data:** 2026-03-12
**Plano-base:** `plans/PLAN_MOBILE_PERFORMANCE_v2.md`
**Skill de entrega:** `/deliver-sprint`

> Documento de execução autônoma para agentes IA coder.
> Cada sprint é **auto-contido** — o agente não precisa de contexto externo para executar.
> Leia o sprint inteiro antes de escrever a primeira linha de código.

---

## Status de Entregas

| Sprint | Status | Commit | Data | Quality Gates |
|--------|--------|--------|------|----------------|
| **M0** | ✅ MERGED | `6f4be85` | 2026-03-10 | ✅ 539/539 testes, ✅ 0 lint, ✅ 2 commits, ✅ Gemini suggestions |
| **M1** | ✅ MERGED | `f7153cb` | 2026-03-10 | ✅ 539/539 testes, ✅ 0 lint, ✅ 1 commit (squash), ✅ react-virtuoso |
| **M2** | ✅ MERGED | `ddd3fbe` | 2026-03-13 | ✅ 539/539 testes, ✅ 0 lint, ✅ 1 commit (squash), ✅ manualChunks, ✅ MOBILE_PERFORMANCE.md |
| **M3** | ✅ MERGED | `e578820` | 2026-03-13 | ✅ 473/473 testes, ✅ 0 lint, ✅ 7 Gemini suggestions, ✅ DB views + indexes |
| **M4** | ✅ MERGED | `4b00d6e` | 2026-03-15 | ✅ 0 lint, ✅ build ok, ✅ 3 Gemini suggestions, ✅ OfflineBanner, ✅ useSyncExternalStore |
| **M5** | ✅ MERGED | `4822296` | 2026-03-13 | ✅ testes, ✅ 0 lint, ✅ CSS animations, favicon, font sizes |
| **M6** | ✅ MERGED | — | 2026-03-13 | ✅ testes, ✅ 0 lint, ✅ touch UX, overscroll, universal checklist |
| **M7** | ✅ MERGED | `8e52ca9` | 2026-03-13 | ✅ 539/539 testes, ✅ 0 lint, ✅ N+1 (15→6 queries), ✅ Gemini suggestions aplicadas |
| **M8** | ✅ MERGED | `c2b316f` | 2026-03-13 | ✅ 539/539 testes, ✅ 0 lint, ✅ race condition fix, ✅ ref callback pattern |

### Sprint M0 — Quality Gates Checklist

- [x] **Lint:** 0 erros em HealthHistory.jsx
- [x] **Testes:** 539/539 passando (30 test files)
- [x] **Build:** npm run build sem erros
- [x] **Dead Code:** adherencePatternData removido (0 referências)
- [x] **Commits:** 2 semânticos (principal + Gemini suggestions)
- [x] **Code Review:** Gemini #340, #341 aplicadas e fechadas
- [x] **Merge:** Squash + delete branch automático (via gh CLI)

### Sprint M1 — Quality Gates Checklist

- [x] **Lint:** 0 erros em HealthHistory.jsx e LogEntry.jsx
- [x] **Testes:** 539/539 passando (30 test files, sem regressões)
- [x] **Build:** npm run build sem erros
- [x] **Dead Code:** .map() removido, botão "Ver mais" removido (0 referências)
- [x] **Commits:** 1 semântico squash (feat + docs consolidados)
- [x] **Code Review:** PR #342 revisado e aprovado
- [x] **Merge:** Squash + delete branch automático (commit f7153cb)
- [x] **Performance:** Virtuoso com overscan=300, handlers em useCallback, LogEntry em memo

### Sprint M2 — Quality Gates Checklist

- [x] **Lint:** 0 erros em App.jsx, vite.config.js, index.html
- [x] **Testes:** 539/539 passando (30 test files, sem regressões)
- [x] **Build:** npm run build sem erros
- [x] **Bundle Analysis:** Main bundle 102.47 kB gzip (target <200kB ✓)
- [x] **Chunks Isolation:** vendor-pdf (174.37 kB), feature-medicines-db (105.30 kB), feature-history (12.47 kB) — corretamente separados
- [x] **Lazy Views:** 13 views convertidas para lazy(), Suspense fallback implementado
- [x] **Breaking Bug Fix:** Landing sem Suspense corrigido (linha 113)
- [x] **Documentation:** MOBILE_PERFORMANCE.md iniciado (Sections 1 & 2)
- [x] **Memory:** R-117 documentado em .memory/rules.md
- [x] **Code Review:** PR #391 revisado, Gemini suggestions aplicadas
- [x] **Merge:** Squash + delete branch (commit ddd3fbe)
- [x] **Tech Debt:** Issue #392 criada (refactor renderCurrentView)

### Sprint M3 — Quality Gates Checklist

- [x] **Lint:** 0 erros em adherenceService.js, SparklineAdesao.jsx, HealthHistory.jsx
- [x] **Testes:** 473/473 passando (critical suite, sem regressões)
- [x] **Build:** npm run build sem erros
- [x] **Code Review:** 7 Gemini suggestions aplicadas (COUNT*, Zod, console.log, refactoring)
- [x] **SQL Migrations:** 2 índices + 2 views testados em M3_EXECUTION_GUIDE.md
- [x] **Bugs Fixed:** 4 críticos (120%, 900%, hasEnoughData, 30-day cap)
- [x] **Performance:** 20× timeline, 3-4× sparkline, 10× heatmap
- [x] **Documentation:** M3_EXECUTION_GUIDE.md + SUPABASE_M3_EXECUTION_GUIDE.md
- [x] **Memory:** Rules R-121/R-122 + Anti-patterns AP-121/AP-122 documentados
- [x] **Journal:** 2026-W11-M3.md com análise completa de bugs e learnings
- [x] **Merge:** Squash + delete branch automático (commit e578820)

---

## Contexto Obrigatório (Ler Antes de Qualquer Sprint)

### Por que esta spec existe

A view "Saúde" (`HealthHistory.jsx`) trava ao ser aberta no iPhone 13 (Safari e Chrome). O diagnóstico completo está em `plans/PLAN_MOBILE_PERFORMANCE_v2.md`. Esta spec traduz o diagnóstico em tarefas executáveis por agentes.

### Sequência obrigatória dos sprints

```
M0 → M1 → M2 → M3 (paralelo ou sequencial após M2) → M4 → M5 → M6
```

**Não pular M0.** Os sprints M1-M4 não eliminam os freezes de abertura — só M0 resolve isso.

### Pré-requisitos para qualquer agente iniciar qualquer sprint

**CRÍTICO (R-065):** Antes de escrever qualquer código, executar:

```bash
# 1. Verificar duplicatas do arquivo-alvo
find src -name "HealthHistory*" -type f
find src -name "LogEntry*" -type f

# 2. Rastrear imports
grep -r "from.*HealthHistory" src/
grep -r "from.*LogEntry" src/

# 3. Confirmar aliases no vite.config.js
cat vite.config.js | grep -A 30 "alias"
```

Então ler:
- `.memory/rules.md` — focar em R-001, R-002, R-010, R-020, R-051, R-060, R-065
- `.memory/anti-patterns.md` — focar em AP-001, AP-004, AP-012, AP-013, AP-020, AP-021, AP-W13

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

---

# SPRINT M0 — CORREÇÕES DE EMERGÊNCIA (HealthHistory.jsx)

**Branch:** `fix/mobile-perf-m0-health-history-freezes`
**Duração estimada:** 1 dia
**Dependência:** Nenhuma — executar primeiro
**Arquivos principais:**
- `src/views/HealthHistory.jsx` (414 linhas — **único arquivo a modificar no M0**)

---

## PASSO 1 — Setup (deliver-sprint Step 1)

```bash
git checkout main && git pull origin main
git checkout -b fix/mobile-perf-m0-health-history-freezes
```

Verificar estado inicial:
```bash
# Confirmar que o arquivo correto será modificado
find src -name "HealthHistory*" -type f
# Esperado: src/views/HealthHistory.jsx (apenas um)

# Confirmar imports do arquivo
head -20 src/views/HealthHistory.jsx
```

---

## PASSO 2 — Implementação (deliver-sprint Step 2)

Executar as 5 correções **na ordem abaixo** para manter a consistência do hook order (R-010).

### M0.1 — Converter imports síncronos para lazy

**Por que:** `SparklineAdesao` (518 linhas) e `AdherenceHeatmap` são parseados e compilados pelo Safari **antes** de qualquer render. Isso cria um freeze de 200-400ms na abertura da view.

**Localização:** `HealthHistory.jsx` — linhas 1-15 (bloco de imports)

Substituir:
```jsx
// REMOVER estas duas linhas (atualmente ~linha 13-14):
import SparklineAdesao from '@dashboard/components/SparklineAdesao'
import AdherenceHeatmap from '@adherence/components/AdherenceHeatmap'
```

Adicionar ao import do React (linha 1 — já existe `{ useState, useEffect, useCallback, useMemo, useRef }`):
```jsx
// Adicionar lazy e Suspense ao import existente do React:
import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, useTransition } from 'react'

// Logo após o bloco de imports, antes da constante TIMELINE_PAGE_SIZE:
const SparklineAdesao = lazy(() => import('@dashboard/components/SparklineAdesao'))
const AdherenceHeatmap = lazy(() => import('@adherence/components/AdherenceHeatmap'))
```

**Atenção:** `useTransition` é adicionado aqui para uso nas correções M0.3 e M0.5.

---

### M0.2 — Memoizar cálculos inline do render

**Por que:** `pillsThisMonth` e `daysThisMonth` ficam inline no render (linhas 242-245), executando em **cada re-render**. Com M0.3 e M0.5 causando re-renders via `startTransition`, isso piora.

**Localização:** Bloco de `useMemo` (atualmente após `dayLogs` memo, ~linha 67)

Identificar o bloco de memos atual (deve conter `treatmentPlans` e `dayLogs`). Adicionar **após** o último `useMemo` existente, **antes** do primeiro `useEffect`:

```jsx
// Adicionar após o useMemo de dayLogs e ANTES do useEffect de loadData:
const pillsThisMonth = useMemo(
  () => currentMonthLogs.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0),
  [currentMonthLogs]
)

const daysThisMonth = useMemo(
  () =>
    new Set(
      currentMonthLogs.map((log) => new Date(log.taken_at).toLocaleDateString('pt-BR'))
    ).size,
  [currentMonthLogs]
)
```

**Depois,** localizar no bloco do render (atualmente ~linhas 242-245) e **remover** as duas declarações inline:
```jsx
// REMOVER estas linhas do render (buscar por "pillsThisMonth"):
const pillsThisMonth = currentMonthLogs.reduce((sum, log) => sum + log.quantity_taken, 0)
const daysThisMonth = new Set(
  currentMonthLogs.map((log) => new Date(log.taken_at).toLocaleDateString('pt-BR'))
).size
```

Verificar após remoção que `pillsThisMonth` e `daysThisMonth` ainda aparecem no JSX (seção Stats). Se sim, a refatoração está correta.

---

### M0.3 — Substituir useMemo/useEffect do adherencePattern por startTransition

**Por que:** `analyzeAdherencePatterns` roda **sincronamente na Main Thread** via `useMemo`, incluindo validação Zod de 500 objetos. `startTransition` permite que o React "pause" o trabalho entre frames, evitando o freeze.

**Passo 1:** Localizar e **remover** o `useMemo` do `adherencePatternData` (atualmente linhas 69-85):
```jsx
// REMOVER este bloco inteiro:
const adherencePatternData = useMemo(() => {
  try {
    if (allLogsForAnalysis.length > 0 && protocols.length > 0) {
      const pattern = analyzeAdherencePatterns({
        logs: allLogsForAnalysis,
        protocols: protocols.filter((p) => p.active),
      })
      return pattern
    }
    return null
  } catch (err) {
    console.error('Erro ao analisar padrões de adesão:', err)
    return null
  }
}, [allLogsForAnalysis, protocols])
```

**Passo 2:** Localizar e **remover** o `useEffect` que copia o memo para state (atualmente linhas 154-156):
```jsx
// REMOVER este bloco inteiro:
useEffect(() => {
  setAdherencePattern(adherencePatternData)
}, [adherencePatternData])
```

**Passo 3:** Adicionar `[, startTransition]` na seção de States (linha ~20, após os outros `useState`). O hook `useTransition` retorna `[isPending, startTransition]` — ignorar `isPending` com vírgula:
```jsx
// Adicionar na seção de States (após os useStates existentes, ANTES dos useMemos):
const [, startTransition] = useTransition()
```

**Passo 4:** Localizar o `useEffect` do IntersectionObserver (o que contém `heatmapSentinelRef` e `logService.getAll(500)`). Substituir o bloco `.then(...)` interno:

```jsx
// ANTES (bloco interno do observer):
logService
  .getAll(500)
  .then((result) => setAllLogsForAnalysis(result || []))
  .catch(() => {})
  .finally(() => setIsLoadingPatterns(false))

// DEPOIS — calcular padrão com startTransition:
logService
  .getAll(500)
  .then((result) => {
    const logs = result || []
    setAllLogsForAnalysis(logs)

    // startTransition: React pode pausar entre frames — não trava a UI
    startTransition(() => {
      try {
        if (logs.length > 0 && protocols.length > 0) {
          const pattern = analyzeAdherencePatterns({
            logs,
            protocols: protocols.filter((p) => p.active),
          })
          setAdherencePattern(pattern)
        }
      } catch (err) {
        console.error('[HealthHistory] Erro ao analisar padrões de adesão:', err)
      }
    })
  })
  .catch(() => {})
  .finally(() => setIsLoadingPatterns(false))
```

**Verificar dependências do useEffect do observer:** O array de deps atualmente é `[allLogsForAnalysis.length, isLoadingPatterns]`. Após a refatoração, `protocols` também é usado dentro do callback — adicionar ao array de dependências:
```jsx
// Array de dependências do useEffect do IntersectionObserver:
}, [allLogsForAnalysis.length, isLoadingPatterns, protocols])
```

---

### M0.4 — Mover sentinel para o final do JSX

**Por que:** O `<div ref={heatmapSentinelRef} />` está na linha 318, antes de Sparkline, Stats e Timeline. Com `rootMargin: '200px'`, o IntersectionObserver dispara **ao abrir a view**, não no scroll. Isso faz `logService.getAll(500)` chamar imediatamente.

**Passo 1:** Localizar o div sentinel atual no JSX (buscar por `heatmapSentinelRef` no JSX — deve estar ~linha 318):
```jsx
// REMOVER desta posição atual:
<div ref={heatmapSentinelRef} />
```

**Passo 2:** Localizar no JSX o bloco do CTA "Registrar Dose" (atualmente o último bloco antes do `<Modal>`). Inserir o sentinel **imediatamente antes** do CTA:
```jsx
{/* Sentinel: dispara carregamento do heatmap quando usuário chega ao final */}
<div ref={heatmapSentinelRef} />

{/* Register dose CTA */}
<div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
  <Button
    variant="primary"
    onClick={() => {
      setEditingLog(null)
      setIsModalOpen(true)
    }}
  >
    Registrar Dose
  </Button>
</div>
```

**Passo 3:** Alterar `rootMargin` no `useEffect` do IntersectionObserver:
```jsx
// ANTES:
{ rootMargin: '200px' }

// DEPOIS:
{ rootMargin: '50px' }
```

---

### M0.5 — Proteger setDailyAdherence com startTransition

**Por que:** `setDailyAdherence(daily)` dispara re-render imediato com `SparklineAdesao` (518 linhas de SVG). Com `lazy()` (M0.1), o chunk já carrega sob demanda — mas o re-render ainda é urgente. `startTransition` permite que o React mantenha a UI responsiva durante o paint do SparklineAdesao.

**Localização:** Dentro de `loadData()`, no bloco que chama `setAdherenceSummary` e `setDailyAdherence` (atualmente ~linhas 118-119):

```jsx
// ANTES:
setAdherenceSummary(summary)
setDailyAdherence(daily)

// DEPOIS:
setAdherenceSummary(summary)
startTransition(() => {
  setDailyAdherence(daily)
})
```

---

### M0.6 — Envolver SparklineAdesao e AdherenceHeatmap com Suspense

**Por que:** Após `lazy()` em M0.1, os componentes precisam de `<Suspense>` com fallback para exibir skeleton enquanto o chunk carrega.

**SparklineAdesao** — localizar no JSX a seção `{dailyAdherence.length > 0 && ...}` (atualmente ~linha 335):
```jsx
// ANTES:
{dailyAdherence.length > 0 && (
  <div className="health-history-sparkline glass-card">
    <h3 className="health-history-section-title">Adesão 30 dias</h3>
    <SparklineAdesao adherenceByDay={dailyAdherence} size="expanded" />
  </div>
)}

// DEPOIS:
{dailyAdherence.length > 0 && (
  <div className="health-history-sparkline glass-card">
    <h3 className="health-history-section-title">Adesão 30 dias</h3>
    <Suspense fallback={<div className="health-history-sparkline-skeleton" aria-busy="true" />}>
      <SparklineAdesao adherenceByDay={dailyAdherence} size="expanded" />
    </Suspense>
  </div>
)}
```

**AdherenceHeatmap** — localizar o bloco `{adherencePattern && !isLoadingPatterns && ...}` (atualmente ~linha 327):
```jsx
// ANTES:
{adherencePattern && !isLoadingPatterns && (
  <div className="health-history-heatmap glass-card">
    <h3 className="health-history-section-title">Padrões de Adesão</h3>
    <AdherenceHeatmap pattern={adherencePattern} />
  </div>
)}

// DEPOIS:
{adherencePattern && !isLoadingPatterns && (
  <div className="health-history-heatmap glass-card">
    <h3 className="health-history-section-title">Padrões de Adesão</h3>
    <Suspense fallback={<div className="health-history-heatmap-skeleton" aria-busy="true" style={{ height: 120 }} />}>
      <AdherenceHeatmap pattern={adherencePattern} />
    </Suspense>
  </div>
)}
```

---

### M0.7 — Verificar dead code (AP-W13)

Após todas as alterações, executar para garantir que não há variáveis/memos órfãos:
```bash
# Verificar que adherencePatternData não aparece mais no arquivo
grep -n "adherencePatternData" src/views/HealthHistory.jsx
# Esperado: zero resultados

# Verificar que os cálculos inline foram removidos do render
grep -n "currentMonthLogs.reduce" src/views/HealthHistory.jsx
# Esperado: apenas a linha dentro do useMemo (na seção de memos, não no render)

# Verificar que pillsThisMonth e daysThisMonth ainda existem no JSX
grep -n "pillsThisMonth\|daysThisMonth" src/views/HealthHistory.jsx
# Esperado: 1 definição (useMemo) + 1-2 usos no JSX
```

---

## PASSO 3 — Validação (deliver-sprint Step 3)

### Quality Gates do M0

```bash
# Gate 1: Lint
npm run lint
# Esperado: 0 erros, 0 warnings novos

# Gate 2: Build (confirmar chunks separados)
npm run build
# Verificar no output:
# - Deve aparecer chunk separado para SparklineAdesao ou feature-history
# - Não deve haver erro de módulo não encontrado

# Gate 3: Testes
npm run validate:agent
# Esperado: todos os testes passando, sem regressões
```

### Validação Manual (Obrigatória)

Abrir no Chrome DevTools com **CPU 4x throttle + 4G simulado**:

1. Navegar para a view "Saúde"
2. Abrir **Performance tab** → Gravar → Abrir view → Parar
3. Verificar: ausência de "Long Task" (bloco vermelho > 50ms) na abertura
4. Abrir **Network tab** → Verificar que `logService.getAll` (request para `medicine_logs?limit=500`) NÃO aparece imediatamente — só após scroll até o final
5. Abrir **Coverage tab** → Confirmar que SparklineAdesao e AdherenceHeatmap estão em chunks separados (aparecem como "não carregados" no início)

---

## PASSO 4 — Git (deliver-sprint Step 4)

```bash
git add src/views/HealthHistory.jsx
git status
# Confirmar: APENAS HealthHistory.jsx modificado

git commit -m "fix(saude): eliminar freezes de abertura da view Health History

- Converter imports de SparklineAdesao e AdherenceHeatmap para lazy()
- Envolver componentes com Suspense (skeleton fallback)
- Substituir useMemo+useEffect do adherencePatternData por startTransition
- Mover setDailyAdherence para startTransition (protege render do Sparkline)
- Mover sentinel heatmap para final do JSX (rootMargin 200px→50px)
- Memoizar pillsThisMonth e daysThisMonth (era inline no render)
- Remover useEffect redundante que copiava memo para state

Resolve freezes #0 (parse/compile), #1 (IntersectionObserver imediato),
#2 (SparklineAdesao paint), #3 (analyzeAdherencePatterns síncrono)."
```

---

## PASSO 5 — Push e PR (deliver-sprint Step 5)

```bash
git push -u origin fix/mobile-perf-m0-health-history-freezes
```

Criar PR com:
- **Title:** `fix(saude): eliminar freezes de abertura da view Saúde no mobile`
- **Body:**

```markdown
## Problema
A view "Saúde" trava ao ser aberta no iPhone 13 (Safari e Chrome) devido a 3 freezes encadeados na Main Thread.

## Causa Raiz (diagnosticada linha a linha)
1. **Freeze #0:** SparklineAdesao (518 ln) e AdherenceHeatmap importados sincronamente — parse/compile antes de qualquer render
2. **Freeze #1:** sentinel IntersectionObserver na linha 318 + rootMargin:'200px' → `getAll(500)` chama na abertura, não no scroll
3. **Freeze #2:** `setDailyAdherence` causa re-render urgente com SparklineAdesao pesado sem proteção
4. **Freeze #3:** `analyzeAdherencePatterns` + Zod em 500 objetos roda sincronamente via useMemo na Main Thread

## Solução
- `lazy()` + `<Suspense>` para SparklineAdesao e AdherenceHeatmap
- Sentinel movido para fim do JSX, rootMargin reduzido para 50px
- `startTransition` protege o render do SparklineAdesao e o cálculo do heatmap
- `useMemo` elimina cálculos inline recorrentes no render

## Arquivos Alterados
- `src/views/HealthHistory.jsx` (único arquivo)

## Quality Gates
- [x] `npm run validate:agent` — sem regressões
- [x] `npm run build` — chunks separados para SparklineAdesao e AdherenceHeatmap
- [x] Chrome DevTools: ausência de "Long Task" na abertura da view
- [x] Network: `getAll(500)` não é chamado na abertura
```

---

## PASSO 6 — Gemini Review (deliver-sprint Step 6)

Aguardar Gemini Code Assist review. Resolver **todos** os issues CRITICAL e HIGH antes do merge (R-062, AP-021).

Se Gemini questionar o uso de `useTransition` para `setDailyAdherence` (argumento que o dado é "urgente"): o tradeoff é intencional — o SparklineAdesao tem 518 linhas e causa freeze mensurável. A percepção do usuário de "dado demorou 1 frame extra" é melhor que "UI travou 300ms".

**Merge somente após aprovação EXPLÍCITA do usuário/ profissional de produto!**

---

## PASSO 7 — Learning Loop (deliver-sprint Step 7)

Após merge, registrar em `.memory/anti-patterns.md`:

```markdown
| AP-P01 | IntersectionObserver com sentinel posicionado antes do fold + rootMargin alto | Observer dispara ao abrir a view — lazy load de dados vira eager load | Posicionar sentinel DEPOIS de todo conteúdo visível; rootMargin <= 50px | — |
| AP-P02 | Import síncrono de componente >200 linhas em view mobile-critical | Parse/compile JS bloqueia Main Thread antes do primeiro render | `const X = lazy(() => import('./X'))` para componentes pesados não usados no LCP | — |
| AP-P03 | `analyzeAdherencePatterns` ou qualquer O(n) síncrono em useMemo com n>100 | Freeze da Main Thread; UI não responde a input do usuário | Usar `startTransition(() => { setState(heavyComputation()) })` para marcar como não-urgente | — |
```

---

---

# SPRINT M1 — VIRTUALIZAÇÃO DA LISTA (Timeline)

**Branch:** `feat/mobile-perf-m1-timeline-virtualization`
**Dependência:** M0 merged em main
**Duração estimada:** 1-2 dias
**Arquivos:**
- `src/views/HealthHistory.jsx` (seção da timeline)
- `src/shared/components/log/LogEntry.jsx`

---

## PASSO 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b feat/mobile-perf-m1-timeline-virtualization

# Verificar duplicatas antes de qualquer edição (R-001)
find src -name "LogEntry*" -type f
grep -r "from.*LogEntry" src/

# Instalar dependência
npm install react-virtuoso
```

Verificar que `react-virtuoso` foi adicionado ao `package.json`:
```bash
grep "react-virtuoso" package.json
```

---

## PASSO 2 — Implementação

### M1.1 — Substituir .map() por Virtuoso na Timeline

**Localização:** `HealthHistory.jsx` — seção "Últimas Doses" (~linha 362-378)

Adicionar import no topo de `HealthHistory.jsx` (após os imports existentes, antes das constantes):
```jsx
import { Virtuoso } from 'react-virtuoso'
```

Localizar o bloco atual:
```jsx
{timelineLogs.length > 0 && (
  <div className="health-history-timeline">
    <h3 className="health-history-section-title">Últimas Doses</h3>
    {timelineLogs.map((log) => (
      <LogEntry key={log.id} log={log} onEdit={handleEditClick} onDelete={handleDeleteLog} />
    ))}
    {timelineHasMore && (
      <button
        className="health-history-timeline__more"
        onClick={handleLoadMoreTimeline}
        disabled={isLoadingMore}
      >
        {isLoadingMore ? 'Carregando...' : `Ver mais ${TIMELINE_PAGE_SIZE} doses`}
      </button>
    )}
  </div>
)}
```

Substituir por:
```jsx
{timelineLogs.length > 0 && (
  <div className="health-history-timeline">
    <h3 className="health-history-section-title">Últimas Doses</h3>
    <Virtuoso
      useWindowScroll
      data={timelineLogs}
      endReached={handleLoadMoreTimeline}
      overscan={300}
      itemContent={(_index, log) => (
        <LogEntry log={log} onEdit={handleEditClick} onDelete={handleDeleteLog} />
      )}
      components={{
        Footer: () =>
          isLoadingMore ? (
            <div className="health-history-timeline__loading">Carregando...</div>
          ) : !timelineHasMore ? (
            <div className="health-history-timeline__end">Histórico completo</div>
          ) : null,
      }}
    />
  </div>
)}
```

**Atenção ao `handleLoadMoreTimeline`:** O Virtuoso chama `endReached` automaticamente quando o usuário chega ao final. A função já tem guard `if (isLoadingMore || !timelineHasMore) return` — isso é suficiente para evitar chamadas duplicadas.

---

### M1.2 — Memoizar LogEntry

**Localização:** `src/shared/components/log/LogEntry.jsx`

Verificar a assinatura atual do componente. O objetivo é envolvê-lo com `React.memo` usando comparação customizada para evitar re-renders desnecessários quando a lista atualiza.

Adicionar ao arquivo (no final, antes do `export default`):
```jsx
import { memo } from 'react' // adicionar ao import existente do React

// Envolver o componente existente:
// Se atualmente é: export default function LogEntry({ log, onEdit, onDelete }) { ... }
// Alterar para:

const LogEntryComponent = function LogEntry({ log, onEdit, onDelete }) {
  // ... implementação INALTERADA ...
}

/** Compara apenas campos que afetam a renderização visual */
const areLogEntriesEqual = (prev, next) =>
  prev.log.id === next.log.id &&
  prev.log.status === next.log.status &&
  prev.log.quantity_taken === next.log.quantity_taken

export default memo(LogEntryComponent, areLogEntriesEqual)
```

**Atenção:** Se `LogEntry` usa `onEdit` ou `onDelete` dentro do componente de forma que mudanças de referência importem, a comparação customizada acima ainda está correta — `onEdit`/`onDelete` são handlers estáveis (já envolvidos em `useCallback` em `HealthHistory.jsx`).

---

### M1.3 — Verificar handlers com useCallback

Em `HealthHistory.jsx`, confirmar que `handleEditClick` e `handleDeleteLog` estão em `useCallback`:
```bash
grep -n "useCallback" src/views/HealthHistory.jsx
```

Se `handleDeleteLog` não estiver em `useCallback`, adicionar:
```jsx
// Transformar handler existente em useCallback:
const handleDeleteLog = useCallback(async (id) => {
  // ... implementação atual inalterada ...
}, [refresh]) // deps: apenas o que o handler usa do closure
```

---

### M1.4 — Verificar dead code (AP-W13)

```bash
# Confirmar que botão "Ver mais" foi removido
grep -n "timeline__more" src/views/HealthHistory.jsx
# Esperado: 0 resultados (a classe CSS pode permanecer em HealthHistory.css)

# Confirmar que .map() da timeline foi removido
grep -n "timelineLogs.map" src/views/HealthHistory.jsx
# Esperado: 0 resultados
```

---

## PASSO 3 — Validação

```bash
# Gate 1: Lint
npm run lint

# Gate 2: Testes (LogEntry tem testes existentes — não devem regredir)
npm run test:components
# Verificar: LogEntry.test.jsx (se existir) passa sem alteração

# Gate 3: Build
npm run build

# Gate 4: Validação completa
npm run validate:agent
```

**Validação manual:**
1. Chrome DevTools > Performance com CPU 4x throttle
2. Navegar para "Saúde" → Rolar a timeline até o final
3. Verificar: FPS nunca cai abaixo de 50fps durante o scroll
4. Verificar: Ao chegar no final, novo batch carrega automaticamente (sem botão)
5. React DevTools Profiler: `LogEntry` não deve re-renderizar ao carregar o próximo batch

---

## PASSO 4 — Git

```bash
git add src/views/HealthHistory.jsx src/shared/components/log/LogEntry.jsx package.json package-lock.json
git commit -m "feat(saude): virtualizar timeline de doses com react-virtuoso

- Substituir .map() por Virtuoso com useWindowScroll para performance mobile
- Carregamento automático ao final (endReached) substitui botão 'Ver mais'
- Envolver LogEntry com React.memo e comparação customizada (id+status+quantity)
- overscan=300 para pré-renderização suave sem jank"
```

---

## PASSO 5 — Push e PR

```bash
git push -u origin feat/mobile-perf-m1-timeline-virtualization
```

**PR Body:**
```markdown
## O que muda
Virtualiza a lista "Últimas Doses" em HealthHistory usando `react-virtuoso`.

## Por que
Com `.map()`, todos os LogEntry ficam no DOM simultâneamente. Com Virtuoso, apenas os itens visíveis + overscan de 300px existem no DOM — reduz nodes de N para ~10.

## Impacto esperado
- FPS durante scroll: < 50fps → ≥ 55fps consistente (CPU 4x throttle)
- Heap memory: redução proporcional ao número de logs não visíveis
- UX: scroll infinito automático substitui o botão "Ver mais"

## Arquivos
- `src/views/HealthHistory.jsx` — substituição do .map() e import do Virtuoso
- `src/shared/components/log/LogEntry.jsx` — React.memo com comparação customizada
```

---

## PASSO 7 — Learning Loop

Registrar em `.memory/rules.md`:
```markdown
### R-120: react-virtuoso para listas longas [HIGH]
**Regra:** Listas com potencial de > 30 itens em views mobile devem usar `react-virtuoso` com `useWindowScroll`.
**Configuração padrão:** `overscan={300}`, `endReached` para pagination automática.
**Não usar:** `initialTopMostItemIndex` (causa scroll invertido — só para chat).
**Source:** Sprint M1 mobile performance
```

---

---

# SPRINT M2 — CODE SPLITTING E LAZY ROUTES

**Branch:** `feat/mobile-perf-m2-code-splitting`
**Dependência:** M1 merged em main
**Duração estimada:** 1 dia
**Arquivos:**
- `src/App.jsx` (ou entry point de navegação — verificar antes)
- `vite.config.js`

---

## PASSO 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b feat/mobile-perf-m2-code-splitting

# Identificar o entry point de navegação (pode ser App.jsx ou outro)
grep -r "HealthHistory\|currentView" src/ --include="*.jsx" -l | head -10
grep -r "lazy\|Suspense" src/App.jsx 2>/dev/null || echo "App.jsx não usa lazy ainda"

# Medir bundle atual para comparação posterior
npm run build 2>&1 | grep -E "\.js|kB|gzip"
```

---

## PASSO 2 — Implementação

### M2.1 — Lazy Loading por View no App.jsx

**Por que:** Na análise pós-M1, apenas `Consultation` estava como lazy. As 12 views restantes eram síncronas, inflando o bundle inicial com código de views que o usuário pode nunca visitar naquela sessão.

Localizar `src/App.jsx`. Identificar todos os imports de views no topo do arquivo e converter para lazy:

```jsx
// Adicionar ao import existente do React:
import { lazy, Suspense } from 'react'

// REMOVER imports síncronos de TODAS as views não-críticas:
// import HealthHistory from './views/HealthHistory'
// import Stock from './views/Stock'
// import Protocols from './views/Protocols'
// import AdminDlq from './views/AdminDlq'
// import Landing from './views/Landing'
// import Medicines from './views/Medicines'
// import Settings from './views/Settings'
// import Calendar from './views/Calendar'
// import Emergency from './views/Emergency'
// import Profile from './views/Profile'
// (Consultation já era lazy — manter)

// SUBSTITUIR por lazy imports (todos, exceto Dashboard):
const HealthHistory = lazy(() => import('./views/HealthHistory'))
const Stock         = lazy(() => import('./views/Stock'))
const Protocols     = lazy(() => import('./views/Protocols'))
const AdminDlq      = lazy(() => import('./views/AdminDlq'))
const Landing       = lazy(() => import('./views/Landing'))
const Medicines     = lazy(() => import('./views/Medicines'))
const Settings      = lazy(() => import('./views/Settings'))
const Calendar      = lazy(() => import('./views/Calendar'))
const Emergency     = lazy(() => import('./views/Emergency'))
const Profile       = lazy(() => import('./views/Profile'))

// MANTER síncrono (view padrão do cold start — precisa renderizar imediatamente):
import Dashboard from './views/Dashboard'
```

Criar o componente `ViewSkeleton` mínimo para o fallback:
```jsx
/** Placeholder exibido enquanto chunk de view carrega */
function ViewSkeleton() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '14px',
      }}
      aria-busy="true"
      aria-label="Carregando..."
    >
      Carregando...
    </div>
  )
}
```

Envolver o render condicional das views com `<Suspense>`:
```jsx
// Localizar o switch/condicional de views e envolver com Suspense único:
<Suspense fallback={<ViewSkeleton />}>
  {currentView === 'history' && <HealthHistory onNavigate={setCurrentView} />}
  {currentView === 'stock' && <Stock ... />}
  {currentView === 'protocols' && <Protocols ... />}
  {currentView === 'medicines' && <Medicines ... />}
  {currentView === 'settings' && <Settings ... />}
  {currentView === 'calendar' && <Calendar ... />}
  {currentView === 'emergency' && <Emergency ... />}
  {currentView === 'profile' && <Profile ... />}
  {currentView === 'landing' && <Landing ... />}
  {/* ... demais views lazy ... */}
</Suspense>
```

**Verificação pós-implementação:**
```bash
# Confirmar que nenhum import síncrono de view pesada permanece
grep -n "^import.*views/" src/App.jsx
# Esperado: apenas Dashboard (e Auth se existir)
```

---

### M2.2 — Lazy loading de jsPDF no trigger de exportação

**Por que:** jsPDF + html2canvas somam ~587KB no bundle atual. São carregados para TODOS os usuários mesmo que nunca exportem PDF.

Localizar o handler que dispara a exportação de PDF (provavelmente em `Stock.jsx` ou `ReportGenerator.jsx`). Substituir o import estático por dynamic import dentro do handler:

```jsx
// ANTES (import estático no topo do arquivo):
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// DEPOIS (dynamic import no momento do uso):
const handleExportPDF = async () => {
  setIsExporting(true)
  try {
    // jsPDF só carrega quando o usuário clica em "Exportar PDF"
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ])
    // ... lógica de exportação inalterada usando jsPDF e html2canvas
  } finally {
    setIsExporting(false)
  }
}
```

**Verificar impacto no build:**
```bash
npm run build 2>&1 | grep -E "jspdf|html2canvas"
# Esperado: chunks separados com nomes contendo "jspdf" e "html2canvas"
# NÃO devem aparecer no chunk index principal
```

---

### M2.3 — Chunks Manuais no vite.config.js

Localizar a seção `build` em `vite.config.js`. Adicionar `manualChunks` dentro de `rollupOptions.output`:

```js
// vite.config.js — dentro do defineConfig
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // Vendors grandes — isolados para cache duradouro
        'vendor-framer': ['framer-motion'],           // ~150KB, usado em múltiplas views
        'vendor-supabase': ['@supabase/supabase-js'], // client auth/db
        'vendor-virtuoso': ['react-virtuoso'],         // lista virtualizada (M1)
        'vendor-pdf': ['jspdf', 'html2canvas'],        // ~587KB — só ao exportar

        // Feature chunks — carregados apenas quando a view é acessada
        'feature-history': [
          './src/views/HealthHistory.jsx',
          './src/features/adherence/components/AdherenceHeatmap.jsx',
          './src/features/adherence/services/adherencePatternService.js',
        ],
        'feature-stock': ['./src/views/Stock.jsx'],
        'feature-landing': ['./src/views/Landing.jsx'],

        // Base ANVISA — 819KB, carregada apenas em Medicines/autocomplete
        'feature-medicines-db': [
          './src/features/medications/data/medicineDatabase.json',
        ],
      },
    },
  },
  // Source maps hidden: gerados mas não expostos no bundle (para debugging em produção)
  sourcemap: 'hidden',
},
```

**Atenção:** Se algum dos caminhos em `manualChunks` não existir, o build falhará com erro claro. Verificar antes:
```bash
find src -name "medicineDatabase.json" -type f
find src -name "AdherenceHeatmap.jsx" -type f
```

---

### M2.4 — Preload hint no index.html

**Por que:** O browser descobre o bundle principal apenas ao parsear o HTML, causando atraso na cadeia de carregamento. `modulepreload` instrui o browser a buscar o chunk imediatamente.

Localizar `index.html` na raiz do projeto. Adicionar preload:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Meus Remédios</title>
    <!-- Preload: instrui browser a buscar o chunk principal antes do parser chegar ao <script> -->
    <link rel="modulepreload" href="/src/main.jsx" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Nota:** O Vite em modo build substitui `/src/main.jsx` pelo hash real do chunk. O preload é inserido automaticamente pelo Vite para chunks detectados como críticos — verificar no output do build se `modulepreload` aparece no HTML gerado. Se sim, este passo é redundante e pode ser omitido.

---

## PASSO 3 — Validação

```bash
# Gate 1: Build com análise de chunks
npm run build
# Verificar no output (chunks obrigatórios):
# - "feature-history" — view Saúde + AdherenceHeatmap
# - "vendor-framer" — Framer Motion isolado
# - "vendor-supabase" — Supabase client isolado
# - "vendor-pdf" — jsPDF + html2canvas NÃO no bundle principal
# - "feature-medicines-db" — base ANVISA isolada
# - Bundle do index principal MENOR que baseline do Setup

# Gate 2: Lint
npm run lint

# Gate 3: Validação completa
npm run validate:agent

# Gate 4: Medir tamanho do bundle principal
npm run build 2>&1 | grep "index.*\.js" | grep -o "[0-9.]* kB (gzip.*)"
# Meta: < 200KB gzipped (baseline pré-M2 era ~989KB não-gzipped)

# Gate 5: Confirmar que jsPDF não está no chunk inicial
# Abrir Chrome DevTools > Network > recarregar app
# Filtrar por "jspdf" — NÃO deve aparecer no carregamento inicial
# Deve aparecer apenas quando "Exportar PDF" for clicado
```

---

## PASSO 4 — Git

```bash
git add src/App.jsx vite.config.js index.html
git commit -m "feat(app): code splitting completo — lazy views + jsPDF dinâmico + manualChunks

- Todas as views não-críticas via lazy() (Dashboard único eager)
- jsPDF + html2canvas: dynamic import no handler de exportação (-587KB do bundle inicial)
- ViewSkeleton como fallback de Suspense durante carregamento de chunk
- manualChunks: vendor-framer, vendor-supabase, vendor-virtuoso, vendor-pdf,
  feature-history, feature-stock, feature-landing, feature-medicines-db
- sourcemap: 'hidden' para debugging em produção sem expor no bundle
- index.html: lang='pt-BR' corrigido"
```

---

## PASSO 7 — Learning Loop + Documentação

Após merge, **iniciar** `docs/standards/MOBILE_PERFORMANCE.md` com as seções 1 e 2:

```markdown
# Guia de Performance Mobile — Meus Remédios

> Documento vivo. Construído incrementalmente nos sprints M2–M6.
> Leia ANTES de adicionar qualquer view, componente pesado ou biblioteca.

## 1. Princípios Gerais (Dispositivos Mid-Low Tier)

**Contexto:** O usuário-alvo usa iPhone 8 / Android mid-range em redes 4G instáveis.
Limites práticos:
- JS parse + compile: budget de 50ms na main thread por interação
- Bundle inicial: < 200KB gzipped para TTI < 3s em 4G
- Heap memory: manter < 50MB para evitar OOM em dispositivos com 2GB RAM

**Regras base:**
- `Dashboard` é a única view eager. Todas as outras: `lazy()`
- Bibliotecas > 100KB NUNCA no bundle inicial: isolá-las em vendor chunks
- Dados pesados (bases JSON, PDFs): sempre dynamic import no ponto de uso

## 2. JavaScript: Lazy Loading & Code Splitting

### 2.1 Views com `React.lazy()`

```jsx
// ✅ CORRETO — view carrega só quando acessada
const HealthHistory = lazy(() => import('./views/HealthHistory'))

// ❌ ERRADO — vai para o bundle inicial mesmo sem o usuário abrir a view
import HealthHistory from './views/HealthHistory'
```

**Quando usar eager (import estático):** apenas a view padrão do cold start (Dashboard).

### 2.2 Bibliotecas pesadas: dynamic import no handler

```jsx
// ✅ CORRETO — jsPDF só baixa quando usuário clica "Exportar"
const handleExport = async () => {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])
  // usar jsPDF e html2canvas normalmente
}

// ❌ ERRADO — 587KB no bundle inicial, impacta todos os usuários
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
```

### 2.3 manualChunks obrigatórios no vite.config.js

```js
manualChunks: {
  'vendor-framer': ['framer-motion'],           // ~150KB
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-virtuoso': ['react-virtuoso'],
  'vendor-pdf': ['jspdf', 'html2canvas'],       // só carrega ao exportar
  'feature-medicines-db': ['./src/features/medications/data/medicineDatabase.json'], // 819KB
}
```

### 2.4 Verificação pós-build

```bash
npm run build 2>&1 | grep -E "vendor-pdf|feature-medicines-db"
# Esperado: chunks aparecem SEPARADOS do index principal
```
```markdown
**Source:** Sprint M2 — code splitting completo
```

---

---

# SPRINT M3 — BANCO DE DADOS: ÍNDICES E VIEW

**Branch:** `chore/mobile-perf-m3-db-indexes`
**Dependência:** Pode rodar em paralelo com M2
**Duração estimada:** 0.5 dia
**Arquivos:** Nenhum arquivo de código alterado — apenas SQL no Supabase

---

## PASSO 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b chore/mobile-perf-m3-db-indexes
```

Antes de executar SQL, verificar se índices já existem no Supabase:
- Acessar Supabase Dashboard → Database → Indexes
- Buscar por `medicine_logs`
- Anotar índices existentes

---

## PASSO 2 — Execução SQL (Supabase SQL Editor)

Executar **um bloco por vez** e verificar output antes do próximo.

### Bloco 1: Índice de paginação principal

```sql
-- Índice para logService.getAllPaginated() e logService.getAll()
-- Suporta: WHERE user_id = X ORDER BY taken_at DESC LIMIT N
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_user_taken_at_desc
ON medicine_logs (user_id, taken_at DESC);
```

Verificar:
```sql
-- Deve mostrar "Index Scan" e tempo < 10ms
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, taken_at, status, quantity_taken
FROM medicine_logs
WHERE user_id = auth.uid()
ORDER BY taken_at DESC
LIMIT 30;
```

### Bloco 2: Índice por protocolo

```sql
-- Índice para logService.getByProtocol()
-- Suporta: WHERE protocol_id = X ORDER BY taken_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_protocol_taken_at
ON medicine_logs (protocol_id, taken_at DESC);
```

### Bloco 3: View de adesão diária (pré-agregação COMPLETA)

```sql
-- Objetivo: Eliminar agregação O(N) no client-side
-- Estratégia: JOIN protocols (doses esperadas) × medicine_logs (doses tomadas)
-- Retorna: Adesão % pré-calculada por dia
-- Cliente apenas LEITURA — zero processamento
CREATE OR REPLACE VIEW v_daily_adherence AS
SELECT
    p.user_id,
    ml.log_date,
    COUNT(DISTINCT p.id) AS expected_doses,
    COUNT(DISTINCT ml.id) AS taken_doses,
    ROUND(
        (COUNT(DISTINCT ml.id)::numeric / NULLIF(COUNT(DISTINCT p.id), 0)) * 100.0,
        2
    ) AS adherence_percentage
FROM (
    SELECT id, protocol_id, user_id, (taken_at AT TIME ZONE 'UTC')::date AS log_date
    FROM medicine_logs
) ml
LEFT JOIN protocols p
    ON p.id = ml.protocol_id
    AND p.user_id = ml.user_id
    AND ml.log_date >= p.start_date
    AND (p.end_date IS NULL OR ml.log_date <= p.end_date)
    AND p.active = true
WHERE p.start_date IS NOT NULL
GROUP BY p.user_id, ml.log_date;
```

Verificar criação da view:
```sql
SELECT * FROM v_daily_adherence
WHERE user_id = auth.uid()
ORDER BY log_date DESC
LIMIT 7;
-- Deve retornar linhas com [user_id, log_date, expected_doses, taken_doses, adherence_percentage]
```

---

## PASSO 3 — Validação

```bash
# Não há código para validar — documentar resultados do EXPLAIN ANALYZE
# Criar arquivo de evidência para o PR:
cat > /tmp/db-validation.txt << 'EOF'
[Preencher com output real do EXPLAIN ANALYZE]
Índice idx_medicine_logs_user_taken_at_desc: [Index Scan / Seq Scan]
Tempo de execução: X ms
View v_daily_adherence: [criada com sucesso]
Rows retornadas: N
EOF
```

---

## PASSO 4 — Git (documentar migrações)

Criar arquivo de documentação da migração:
```bash
# Registrar SQL aplicado (sem criar funções serverless novas — R-090)
cat > docs/migrations/2026-03-mobile-perf-indexes.sql << 'EOF'
-- Sprint M3: Índices de performance mobile
-- Aplicado em: 2026-03-XX
-- Supabase projeto: [nome do projeto]

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_user_taken_at_desc
ON medicine_logs (user_id, taken_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_protocol_taken_at
ON medicine_logs (protocol_id, taken_at DESC);

CREATE OR REPLACE VIEW v_daily_adherence AS
-- [SQL da view com JOIN protocols ⨝ medicine_logs]
EOF

git add docs/migrations/
git commit -m "chore(db): índices compostos e view de adesão para performance mobile

- idx_medicine_logs_user_taken_at_desc: acelera getAllPaginated (user_id + taken_at DESC)
- idx_medicine_logs_protocol_taken_at: acelera getByProtocol
- v_daily_adherence: view de aggregação server-side para futura migração do getDailyAdherence
- Constraint chk_medicine_logs_status: previne status inválidos

EXPLAIN ANALYZE: Index Scan confirmado, <10ms com 10k logs."
```

---

## PASSO 5 — Learning Loop + Documentação

Após merge, **adicionar Seção 6** a `docs/standards/MOBILE_PERFORMANCE.md`:

```markdown
## 6. Banco de Dados: Índices e Views para Performance Mobile

### 6.1 Princípio: pré-calcular no servidor, não no cliente

Calcular adesão diária, streaks ou agregações em JavaScript com N logs é O(N) na main thread do mobile. O PostgreSQL faz o mesmo em <10ms com índice adequado.

**Regra:** Qualquer agregação que processa > 100 rows deve ter uma view ou função no banco.

### 6.2 Índices compostos para paginação

```sql
-- Padrão: (partition_key, sort_key DESC)
-- Suporta WHERE user_id = X ORDER BY taken_at DESC LIMIT N
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_user_taken_at_desc
ON medicine_logs (user_id, taken_at DESC);
```

**Por que `CONCURRENTLY`:** Não bloqueia leituras durante a criação. Obrigatório em produção.
**Por que `IF NOT EXISTS`:** Idempotente — safe para re-executar.

### 6.3 Views de agregação server-side (pré-agregação COMPLETA)

```sql
-- Padrão: VIEW com JOIN protocols ⨝ medicine_logs para pré-calcular adesão
-- Elimina O(N) processamento no client JavaScript
CREATE OR REPLACE VIEW v_daily_adherence AS
SELECT
    p.user_id,
    ml.log_date,
    COUNT(DISTINCT p.id) AS expected_doses,
    COUNT(DISTINCT ml.id) AS taken_doses,
    ROUND(
        (COUNT(DISTINCT ml.id)::numeric / NULLIF(COUNT(DISTINCT p.id), 0)) * 100.0,
        2
    ) AS adherence_percentage
FROM (
    SELECT id, protocol_id, user_id, (taken_at AT TIME ZONE 'UTC')::date AS log_date
    FROM medicine_logs
) ml
LEFT JOIN protocols p
    ON p.id = ml.protocol_id
    AND p.user_id = ml.user_id
    AND ml.log_date >= p.start_date
    AND (p.end_date IS NULL OR ml.log_date <= p.end_date)
    AND p.active = true
WHERE p.start_date IS NOT NULL
GROUP BY p.user_id, ml.log_date;
```
```markdown
**Source:** Sprint M3 — DB indexes e views (M3 CONCLUÍDO ✅)
```

---

---

# SPRINT M4 — SERVICE WORKER E OFFLINE FIRST

**Branch:** `feat/mobile-perf-m4-offline-banner`
**Dependência:** M2 merged em main (M4 não depende de M3)
**Duração estimada:** 1-2 dias
**Arquivos:**
- `src/shared/components/ui/OfflineBanner.jsx` (novo)
- `src/App.jsx` (ou layout principal — onde o Banner será inserido)

> **Nota para o agente:** A parte do Service Worker (estratégias de cache Workbox) depende da configuração atual de PWA do projeto. **Antes de qualquer implementação**, verificar se existe `vite-plugin-pwa` no `package.json` e se há um `sw.js` em `public/`. O OfflineBanner é independente e deve ser implementado primeiro.

---

## PASSO 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b feat/mobile-perf-m4-offline-banner

# Auditar configuração atual de PWA
grep "vite-plugin-pwa\|workbox" package.json
ls public/ | grep -i "sw\|worker\|manifest"
cat public/manifest.json 2>/dev/null | head -20

# Verificar se há SW existente
find . -name "sw.js" -not -path "*/node_modules/*"
find . -name "service-worker*" -not -path "*/node_modules/*"
```

---

## PASSO 2 — Implementação

### M4.1 — OfflineBanner Component

Verificar que o diretório existe:
```bash
ls src/shared/components/ui/
# Deve existir (Button.jsx, Loading.jsx, etc. estão aqui)
```

Criar `src/shared/components/ui/OfflineBanner.jsx`:
```jsx
import { useEffect, useState } from 'react'
import './OfflineBanner.css'

/**
 * Banner fixo exibido quando o usuário perde conexão com a internet.
 * Desaparece automaticamente ao reconectar.
 * Posicionado acima do BottomNav para não ser coberto.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline  = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      Sem conexão — exibindo dados salvos
    </div>
  )
}
```

Criar `src/shared/components/ui/OfflineBanner.css`:
```css
.offline-banner {
  position: fixed;
  bottom: 64px; /* acima do BottomNav (altura estimada: 60-64px) */
  left: 0;
  right: 0;
  background: var(--color-warning, #f59e0b);
  color: var(--color-text-on-warning, #1a1a1a);
  text-align: center;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  z-index: 100;
  contain: layout style; /* evita layout thrash no toggle */
}
```

**Verificar variáveis CSS:** Conferir que `--color-warning` existe em `src/shared/styles/`. Se não existir, usar valor hexadecimal direto como fallback (já incluído acima).

### M4.2 — Integrar OfflineBanner no layout

Localizar o componente de layout principal (provavelmente `src/App.jsx` ou o componente que contém `BottomNav`). Adicionar o banner:

```jsx
import { OfflineBanner } from '@shared/components/ui/OfflineBanner'

// No JSX, logo antes de fechar o container principal:
<OfflineBanner />
<BottomNav ... />
```

### M4.3 — Auditoria e documentação do SW (se existir)

Se existir `sw.js` em `public/` ou configuração `vite-plugin-pwa`:
- Documentar estratégias de cache atuais
- Verificar se Supabase Auth está em `NetworkOnly` (tokens não devem ser cacheados)
- **Não alterar SW** neste sprint se a configuração for complexa — abrir issue para sprint separado

---

## PASSO 3 — Validação

```bash
# Gate 1: Lint
npm run lint

# Gate 2: Testes
npm run validate:agent

# Gate 3: Validação manual do OfflineBanner
# Chrome DevTools > Network > Online → Offline
# Verificar: banner aparece imediatamente
# Online → Verificar: banner desaparece
```

---

## PASSO 4 — Git

```bash
git add src/shared/components/ui/OfflineBanner.jsx \
        src/shared/components/ui/OfflineBanner.css \
        src/App.jsx  # ou o arquivo onde o banner foi integrado

git commit -m "feat(pwa): banner de status offline para conexões instáveis

- OfflineBanner: componente fixo acima do BottomNav com aria-live
- Detecta navigator.onLine + eventos online/offline
- CSS com contain: layout style para evitar layout thrash

Contexto: conexões 4G instáveis são frequentes no Brasil em trânsito.
Usuário recebe feedback imediato ao invés de spinner eterno."
```

---

## PASSO 5 — Learning Loop + Documentação

Após merge, **adicionar Seção 7 (parcial)** a `docs/standards/MOBILE_PERFORMANCE.md`:

```markdown
## 7. Touch, UX Mobile e Feedback de Conectividade

### 7.1 Feedback de conectividade (OfflineBanner pattern)
```
```jsx
// ✅ PADRÃO: OfflineBanner acima do BottomNav, aria-live para screen readers
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on  = () => setIsOffline(false)
    const off = () => setIsOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!isOffline) return null
  return <div className="offline-banner" role="alert" aria-live="polite">...</div>
}
```
```markdown
**CSS obrigatório:**
```
```css
.offline-banner {
  position: fixed;
  bottom: 64px; /* acima do BottomNav */
  contain: layout style; /* evita layout thrash no toggle */
  z-index: 100;
}
```
```markdown
**Regra:** NUNCA exibir spinner eterno em mobile. Dar feedback claro de estado offline com dados em cache.

> ⚠️ Seção 7 será completada no Sprint M6.

**Source:** Sprint M4 — offline banner
```

---

# SPRINT M5 ✅ DELIVERED — ASSETS, CSS E FONT SIZES

**Status:** ✅ MERGED (commit `4822296`, 2026-03-13)
**Branch:** `fix/mobile-perf-m5-assets-css`
**Dependência:** Nenhuma
**Duração estimada:** 1 dia
**Arquivos:**
- `src/shared/components/ui/animations/Animations.css`
- `public/favicon.svg` (novo) / `public/favicon.png` (comprimido)
- `index.html` (referência ao favicon)
- `src/features/dashboard/components/SparklineAdesao.css`
- `src/features/stock/components/StockAlertsWidget.css`
- `src/views/Landing.css`

---

## PASSO 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b fix/mobile-perf-m5-assets-css

# Verificar arquivos-alvo (sem duplicatas)
find src -name "Animations.css" -type f
find src -name "SparklineAdesao.css" -type f
find src -name "StockAlertsWidget.css" -type f
find src -name "Landing.css" -type f
find public -name "favicon*" -type f
```

---

## PASSO 2 — Implementação

### M5.1 — Remover @import incorreto de JS em Animations.css

**Por que:** `Animations.css` contém:
```css
@import url('https://cdnjs.cloudflare.com/ajax/libs/canvas-confetti/1.6.0/confetti.browser.min.js');
```
Isso é um `@import` CSS apontando para um arquivo JavaScript. O browser tenta baixar um JS via CSS pipeline — requisição na critical chain que não serve para nada. O confetti real do projeto é implementado com CSS keyframes próprios (`confetti-fall`, `confetti-burst`) e não usa a lib canvas-confetti. **Remover esta linha.**

**Localização:** `src/shared/components/ui/animations/Animations.css` — linha ~12

```bash
# Confirmar a linha antes de remover
grep -n "confetti.browser.min.js" src/shared/components/ui/animations/Animations.css
# Esperado: 1 resultado

# Confirmar que canvas-confetti NÃO é chamada em nenhum .js/.jsx
grep -r "confetti(" src/ --include="*.jsx" --include="*.js"
# Se zero resultados → a lib não é usada → remoção é segura
```

Remover a linha `@import url('...')` do arquivo.

---

### M5.2 — Comprimir favicon

**Por que:** `public/favicon.png` tem 192KB — extremamente grande para um favicon. O browser baixa o favicon antes do primeiro render (impacta LCP). Meta: < 10KB.

**Abordagem preferida: SVG (vector, < 1KB)**

Verificar se o favicon tem forma simples (logo/ícone geométrico):
```bash
file public/favicon.png
# Analisar visualmente — se for ícone de comprimido/remédio, pode ser recriado em SVG
```

Criar `public/favicon.svg` como ícone SVG mínimo representando o app (pílula estilizada). Exemplo de estrutura SVG:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <!-- ícone simplificado do app -->
</svg>
```

Atualizar `index.html`:
```html
<!-- ANTES: -->
<link rel="icon" type="image/png" href="/favicon.png" />

<!-- DEPOIS: -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<!-- Fallback para browsers que não suportam SVG favicon: -->
<link rel="icon" type="image/png" href="/favicon.png" sizes="32x32" />
```

**Se SVG não for viável** (favicon complexo/fotográfico), comprimir `favicon.png` com:
```bash
# Instalar pngquant se não disponível
which pngquant || brew install pngquant

# Comprimir: 192KB → alvo < 10KB
pngquant --quality=65-80 --output public/favicon-optimized.png public/favicon.png
ls -lh public/favicon-optimized.png
# Se < 15KB: renomear para favicon.png
```

**Verificação:**
```bash
ls -lh public/favicon.svg  # ou favicon.png
# Esperado: < 10KB
```

---

### M5.3 — Corrigir font sizes < 12px

**Por que:** Chrome Lighthouse flagra texto < 12px como ilegível em mobile. Os tamanhos encontrados (8px, 9px) tornam rótulos invisíveis em telas de baixa resolução.

**Contexto:** SparklineAdesao e StockAlertsWidget são componentes SVG com espaço limitado. Os valores não podem ser simplesmente dobrados — o aumento deve ser proporcional ao espaço disponível.

**SparklineAdesao.css** — localizar as linhas com `font-size: 9px` e `font-size: 8px`:

```bash
grep -n "font-size.*[89]px" src/features/dashboard/components/SparklineAdesao.css
```

Elevar para o mínimo prático dentro de componentes SVG:
```css
/* ANTES (ilegível em mobile): */
font-size: 9px;  /* → */  font-size: 11px;
font-size: 8px;  /* → */  font-size: 10px;
```

**StockAlertsWidget.css** — mesma abordagem:
```bash
grep -n "font-size.*[89]px" src/features/stock/components/StockAlertsWidget.css
```

```css
/* ANTES: */
font-size: 9px;  /* → */  font-size: 11px;
font-size: 8px;  /* → */  font-size: 10px;
```

**Verificação visual (obrigatória):** Após ajuste, abrir o app em viewport 375px (iPhone SE) e confirmar que os rótulos do Sparkline e StockAlerts são legíveis.

---

### M5.4 — Converter animações width para transform: scaleX()

**Por que:** `@keyframes` que animam `width` causam **layout reflow por frame** — o browser recalcula o layout completo a cada passo da animação. `transform: scaleX()` é GPU-accelerated e não causa reflow.

**Localização:** `src/views/Landing.css` — keyframes `fillBar10` e `fillBar80`

Localizar os keyframes:
```bash
grep -n "fillBar\|width: 0\|width: 10%\|width: 80%" src/views/Landing.css
```

Substituir:
```css
/* ANTES (causa reflow): */
@keyframes fillBar10 {
  from { width: 0; }
  to   { width: 10%; }
}

@keyframes fillBar80 {
  from { width: 0; }
  to   { width: 80%; }
}

/* DEPOIS (GPU-accelerated, zero reflow): */
@keyframes fillBar10 {
  from { transform: scaleX(0); }
  to   { transform: scaleX(0.1); }
}

@keyframes fillBar80 {
  from { transform: scaleX(0); }
  to   { transform: scaleX(0.8); }
}
```

**Obrigatório:** Adicionar `transform-origin: left` e `will-change: transform` nos elementos que usam estes keyframes:
```css
/* Localizar seletores .fill / .stock-bar .fill em Landing.css e adicionar: */
.stock-bar .fill {
  transform-origin: left center;
  will-change: transform;
}
```

**Verificação:**
```bash
# Confirmar zero animações de width restantes nos keyframes
grep -A3 "@keyframes fill" src/views/Landing.css
# Esperado: apenas "transform: scaleX()" — sem "width:"
```

---

## PASSO 3 — Validação

```bash
# Gate 1: Lint
npm run lint

# Gate 2: Validação completa
npm run validate:agent
# Confirmar: sem regressões em testes relacionados a Landing, Sparkline, StockAlerts

# Gate 3: Build
npm run build
# Confirmar: sem erros de módulo

# Gate 4: Lighthouse (opcional mas recomendado)
# Rodar Lighthouse antes e depois — comparar LCP e TBT
# Esperado: FCP melhora (favicon menor) + TBT melhora (sem @import JS)
```

**Verificação manual em mobile (375px viewport):**
1. Abrir app → verificar que favicon carrega rápido (< 1s visible no Network)
2. Abrir view Saúde → SparklineAdesao: rótulos legíveis em iPhone SE (375px)
3. Abrir view Estoque → StockAlertsWidget: badges e labels legíveis
4. Abrir Landing → animações das barras de estoque suaves (sem jank)

---

## PASSO 4 — Git

```bash
git add \
  src/shared/components/ui/animations/Animations.css \
  public/favicon.svg \
  index.html \
  src/features/dashboard/components/SparklineAdesao.css \
  src/features/stock/components/StockAlertsWidget.css \
  src/views/Landing.css

git commit -m "fix(perf): assets e CSS para performance e legibilidade mobile

- Remover @import incorreto de JS (confetti.browser.min.js) em Animations.css
- Comprimir favicon: 192KB → SVG <1KB (reduz LCP)
- Font sizes mínimos: SparklineAdesao e StockAlertsWidget (8px/9px → 10px/11px)
- Animações fillBar: width → transform:scaleX() (GPU-accelerated, zero reflow)

Lighthouse: FCP deve melhorar ~200ms, TBT melhora com remoção da requisição JS na critical chain."
```

---

## PASSO 5 — Push e PR

```bash
git push -u origin fix/mobile-perf-m5-assets-css
```

**PR Body:**
```markdown
## O que muda
Correções de assets e CSS para performance e legibilidade no mobile.

## Problemas corrigidos

### 1. @import de JS em Animations.css (critical chain)
`@import url('...confetti.browser.min.js')` era CSS importando um arquivo JS.
O browser fazia uma requisição desnecessária na critical rendering chain.
A lib canvas-confetti nunca era chamada — confetti é implementado com keyframes próprios.
**Fix:** linha removida.

### 2. favicon.png 192KB → SVG <1KB
Favicon grande impacta LCP — browser baixa favicon antes do primeiro render.
**Fix:** favicon.svg criado, index.html atualizado com fallback PNG.

### 3. Font sizes 8-9px ilegíveis em mobile
SparklineAdesao e StockAlertsWidget tinham text de 8-9px — invisível em telas mid-low.
**Fix:** elevado para 10-11px (mínimo prático para componentes SVG com espaço limitado).

### 4. Animações width → transform:scaleX() (Landing.css)
fillBar10 e fillBar80 animavam `width` → layout reflow por frame.
**Fix:** `transform: scaleX()` + `transform-origin: left` (GPU-accelerated).

## Quality Gates
- [x] `npm run validate:agent` — sem regressões
- [x] `npm run build` — sem erros
- [x] `npm run lint` — 0 erros
- [x] Verificação visual em 375px: rótulos legíveis
```

---

## PASSO 6 — Gemini Review

Aguardar Gemini Code Assist. Resolver todos CRITICAL/HIGH antes do merge.

Se Gemini questionar os valores de font-size escolhidos (10-11px ao invés de 12px): o tradeoff é intencional — componentes SVG têm espaço fixo de renderização. 10-11px é o mínimo que preserva o layout visual sem quebrar o componente. 12px poderia sobrepor elementos em telas pequenas.

---

## PASSO 7 — Learning Loop + Documentação

Após merge, **adicionar Seções 3 e 4** a `docs/standards/MOBILE_PERFORMANCE.md`:

```markdown
## 3. CSS: Animações, Critical Path e Armadilhas

### 3.1 Animações compositas vs. não-compositas

**Regra:** Animar apenas `transform` e `opacity`. NUNCA animar propriedades que causam reflow.
```
```css
/* ✅ GPU-accelerated — zero layout reflow */
@keyframes slideIn {
  from { transform: translateX(-100%); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}

/* ❌ Causa layout reflow por frame — janky em mobile */
@keyframes expandWidth {
  from { width: 0;   }
  to   { width: 80%; }
}

/* ✅ Equivalente correto para barras de progresso */
@keyframes expandWidth {
  from { transform: scaleX(0);   }
  to   { transform: scaleX(0.8); }
}
/* Elemento pai: transform-origin: left center; */
```
```markdown
**Propriedades seguras:** `transform`, `opacity`, `filter`
**Propriedades proibidas em keyframes:** `width`, `height`, `top`, `left`, `margin`, `padding`

### 3.2 @import em CSS: cuidados
```
```css
/* ✅ OK: importar outro arquivo CSS */
@import url('./tokens.css');

/* ❌ NUNCA: importar arquivo .js via @import CSS */
@import url('https://cdn.example.com/lib.min.js');
/* O browser tenta baixar como CSS → requisição na critical chain → sem serventia */
```
```markdown
### 3.3 Font sizes mínimos para legibilidade mobile

| Contexto | Mínimo recomendado | Mínimo absoluto |
|----------|-------------------|-----------------|
| Texto de corpo | 16px | 14px |
| Labels UI | 12px | 11px |
| Labels em SVG (espaço restrito) | 11px | 10px |

Abaixo de 10px: invisível em telas mid-low tier. Lighthouse flagra < 12px como reprovação.

## 4. Assets: Imagens, Favicons e Otimização

### 4.1 Favicon
```
```html
<!-- ✅ SVG preferido: vector, < 1KB, escala perfeita -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<!-- Fallback para browsers sem suporte a SVG favicon -->
<link rel="icon" type="image/png" href="/favicon.png" sizes="32x32" />

<!-- ❌ PNG sem compressão: pode ter centenas de KB, impacta LCP -->
<link rel="icon" type="image/png" href="/favicon.png" />
```
```markdown
**Budget:** favicon < 10KB. Acima de 50KB: DEVE ser otimizado.

### 4.2 Imagens gerais
```
```html
<!-- ✅ lazy loading para imagens fora da viewport inicial -->
<img src="..." loading="lazy" decoding="async" />

<!-- ✅ Dimensões explícitas previnem CLS -->
<img src="..." width="300" height="200" loading="lazy" />
```
```markdown
**Source:** Sprint M5 — assets e CSS fixes
```

---

---

# SPRINT M6 — MOBILE TOUCH E UX

**Branch:** `fix/mobile-perf-m6-touch-ux`
**Dependência:** M5 merged em main
**Duração estimada:** 0.5 dia
**Arquivos:**
- `src/shared/styles/index.css`
- `vite.config.js`

---

## PASSO 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b fix/mobile-perf-m6-touch-ux

# Verificar arquivos-alvo
find src/shared/styles -name "index.css" -type f
# Esperado: apenas src/shared/styles/index.css
```

---

## PASSO 2 — Implementação

### M6.1 — Remover tap highlight (flash em toque)

**Por que:** iOS Safari e Chrome Android mostram um flash azul/cinza ao tocar elementos clicáveis. Isso torna o app parecido com um site web genérico, não um PWA nativo.

**Localização:** `src/shared/styles/index.css` — seção de reset global (próxima ao `body { ... }`)

```css
/* Adicionar na seção de reset global — após body {} ou junto com * {} */

/* Remove o flash de highlight ao tocar em elementos no mobile */
* {
  -webkit-tap-highlight-color: transparent;
}
```

**Atenção:** Isso remove o feedback visual de foco para todos os elementos. **Obrigatório** manter `:focus-visible` para acessibilidade de teclado:

```css
/* Garantir que :focus-visible ainda funciona (já deve estar em index.css) */
:focus-visible {
  outline: 2px solid var(--color-focus, #00e5ff);
  outline-offset: 2px;
}
```

Verificar se `:focus-visible` já existe:
```bash
grep -n "focus-visible" src/shared/styles/index.css
# Se zero resultados → adicionar junto com M6.1
```

---

### M6.2 — touch-action: manipulation em botões

**Por que:** iOS Safari tem delay de 300ms antes de disparar `click` em elementos sem `touch-action: manipulation`. Este delay foi introduído para detectar double-tap zoom. Com `manipulation`, o browser dispara `click` imediatamente ao detectar o tap.

**Localização:** `src/shared/styles/index.css` — junto ao reset de `button, a, [role="button"]`

```css
/* Remove delay de 300ms do tap em iOS Safari */
button,
a,
[role="button"],
input[type="submit"],
input[type="button"],
label[for] {
  touch-action: manipulation;
  cursor: pointer;
}
```

**Verificação:**
```bash
grep -n "touch-action" src/shared/styles/index.css
# Esperado: 1 resultado (o que acabamos de adicionar)
```

---

### M6.3 — overscroll-behavior nos containers de scroll

**Por que:** Sem `overscroll-behavior`, o scroll de um modal ou lista pode propagar para o body e causar o efeito de "rubber-band" (bouncing) do iOS no container pai. Isso é especialmente ruim na timeline de doses — quando o usuário chega ao final da lista, o app inteiro oscila.

**Localização:** `src/shared/styles/index.css` — adicionar regras globais

```css
/* Previne rubber-band indesejado em containers de scroll internos */
.overflow-scroll,
.overflow-y-auto,
[data-scroll-container] {
  overscroll-behavior: contain;
}

/* Para o body: allow-page pull-to-refresh nativo do browser */
body {
  overscroll-behavior-y: auto; /* mantém pull-to-refresh do browser */
}
```

**Containers que precisam de `overscroll-behavior: contain` identificados:**
- Modal de dose (`.modal-content`)
- Timeline de logs (`.health-history-timeline`)
- Lista de estoque (`.stock-list`)

Verificar os seletores reais antes de aplicar:
```bash
grep -n "overflow-y.*auto\|overflow.*scroll" src/shared/styles/index.css
```

Adicionar `overscroll-behavior: contain` nos seletores de scroll já existentes, ao invés de criar classes novas.

---

### M6.4 — Source maps hidden no vite.config.js

**Por que:** Source maps ausentes dificultam debugging de erros em produção (Sentry, DevTools remotos). `'hidden'` gera os arquivos `.map` sem incluir o `//# sourceMappingURL` no bundle — disponíveis para ferramentas de debugging mas não expostos para usuários finais.

**Localização:** `vite.config.js` — seção `build`

```js
// Dentro de defineConfig
build: {
  sourcemap: 'hidden', // gera .map files sem expor no bundle
  rollupOptions: {
    // ... manualChunks (adicionado no M2) ...
  },
},
```

**Verificar no build:**
```bash
npm run build
ls dist/assets/*.js.map
# Esperado: arquivos .map gerados para cada chunk
# O HTML gerado NÃO deve conter referências a .map
```

---

## PASSO 3 — Validação

```bash
# Gate 1: Lint
npm run lint

# Gate 2: Validação completa
npm run validate:agent

# Gate 3: Build + source maps
npm run build
ls dist/assets/*.js.map  # deve existir
grep "sourceMappingURL" dist/assets/index*.js  # deve estar vazio (hidden)

# Gate 4: Verificação manual de touch (dispositivo físico ou emulação)
# Chrome DevTools > Toggle Device Toolbar > iPhone SE (375px)
# 1. Tap em botões → sem flash azul/cinza
# 2. Tap em botão → resposta imediata (sem delay de 300ms)
# 3. Scroll da timeline até o final → sem rubber-band no container pai
```

---

## PASSO 4 — Git

```bash
git add src/shared/styles/index.css vite.config.js

git commit -m "fix(ux): touch experience e source maps para debugging mobile

- tap-highlight-color: transparent — remove flash azul/cinza em iOS/Android
- touch-action: manipulation em buttons/links — remove delay 300ms do tap (iOS Safari)
- overscroll-behavior: contain nos containers de scroll — previne rubber-band no pai
- :focus-visible mantido para acessibilidade de teclado
- build.sourcemap: 'hidden' — .map files gerados para debugging em produção"
```

---

## PASSO 5 — Push e PR

```bash
git push -u origin fix/mobile-perf-m6-touch-ux
```

**PR Body:**
```markdown
## O que muda
Correções de UX táctil e configuração de source maps.

## Problemas corrigidos

### Flash de highlight no tap (iOS/Android)
Botões e links mostravam flash azul/cinza ao ser tocados — visual de site antigo.
`-webkit-tap-highlight-color: transparent` remove o flash em todos os elementos.
`:focus-visible` mantido para acessibilidade de teclado.

### Delay de 300ms no tap (iOS Safari)
`touch-action: manipulation` em buttons/links remove o delay de double-tap detection.
Resultado: resposta tátil imediata ao invés de espera de 300ms.

### Rubber-band indesejado em scroll interno
Scroll da timeline propagava para o body → app inteiro oscilava ao chegar no final.
`overscroll-behavior: contain` isola o scroll nos containers internos.

### Source maps para debugging em produção
`build.sourcemap: 'hidden'` gera arquivos .map sem expor no bundle.
Permite debugging de stack traces reais em Sentry/DevTools remotos.

## Quality Gates
- [x] `npm run validate:agent` — sem regressões
- [x] `npm run build` — dist/assets/*.js.map gerados
- [x] Verificação manual em emulação iOS 375px
```

---

## PASSO 6 — Gemini Review

Aguardar Gemini Code Assist. Resolver todos CRITICAL/HIGH antes do merge.

---

## PASSO 7 — Learning Loop + Documentação Final

Após merge, **completar Seção 7 e adicionar Seção 5 e 8** a `docs/standards/MOBILE_PERFORMANCE.md`:

```markdown
## 5. React: Patterns de Performance Mobile

### 5.1 Lazy + Suspense (M0, M2)
Ver Seção 2 — aplicar para componentes pesados DENTRO de views também (não só views).

### 5.2 startTransition para cálculos pesados (M0)
```
```jsx
// ✅ React pode pausar entre frames — não trava a UI
const [, startTransition] = useTransition()

startTransition(() => {
  const pattern = analyzeAdherencePatterns({ logs, protocols })
  setAdherencePattern(pattern)
})

// ❌ Bloqueia main thread — freeze visível em mobile
const pattern = analyzeAdherencePatterns({ logs, protocols })
setAdherencePattern(pattern)
```
```markdown
**Usar quando:** cálculo leva > 16ms (1 frame) e o dado não é urgente para o LCP.

### 5.3 React.memo com comparação customizada (M1)
```
```jsx
// ✅ Compara apenas campos que afetam o render
const areEqual = (prev, next) =>
  prev.log.id === next.log.id &&
  prev.log.status === next.log.status

export default memo(LogEntry, areEqual)
```
```markdown
**Usar quando:** componente renderizado em lista longa (>30 itens).

### 5.4 react-virtuoso para listas longas (M1)
```
```jsx
// ✅ Apenas ~10 itens no DOM — independe do tamanho total da lista
<Virtuoso
  useWindowScroll
  data={items}
  endReached={loadMore}
  overscan={300}
  itemContent={(_i, item) => <Item item={item} />}
/>

// ❌ Todos os N itens no DOM — memory + render proporcional a N
{items.map(item => <Item key={item.id} item={item} />)}
```
```markdown
**Configuração padrão:** `overscan={300}`, `useWindowScroll` (não height fixo).

### 5.5 IntersectionObserver para lazy loading de seções (M0)
```
```jsx
// ✅ Carrega dados pesados só quando usuário rola até o elemento
const sentinelRef = useCallback((node) => {
  if (!node) return
  const observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) loadHeavyData() },
    { rootMargin: '50px' }  // ≤ 50px — não disparar ao abrir a view
  )
  observer.observe(node)
}, [loadHeavyData])

// Sentinel posicionado DEPOIS de todo conteúdo visível
<div ref={sentinelRef} />
```
```markdown
**Armadilha:** `rootMargin > 100px` + sentinel no topo = carrega ao abrir = eager load.

## 7. Touch, UX Mobile e Feedback de Conectividade (completo)

### 7.2 Touch highlights e delays (M6)
```
```css
/* Remove flash de highlight ao tocar */
* { -webkit-tap-highlight-color: transparent; }

/* Remove delay de 300ms do tap em iOS Safari */
button, a, [role="button"] { touch-action: manipulation; }

/* Manter foco visível para acessibilidade de teclado */
:focus-visible { outline: 2px solid var(--color-focus); }
```
```markdown
### 7.3 Overscroll em containers de scroll (M6)
```
```css
/* Isola rubber-band dentro do container — não propaga para o body */
.timeline-container,
.modal-content,
.stock-list {
  overscroll-behavior: contain;
}
```
```markdown
## 8. Checklist Universal (Pré-PR)

Execute antes de criar qualquer PR que modifique views, componentes ou configuração de build:

### JavaScript & Bundle
- [ ] Novas views adicionadas com `lazy()` em App.jsx (nunca sync)
- [ ] Bibliotecas > 100KB: dynamic import no ponto de uso
- [ ] `npm run build` → chunk do index principal < 200KB gzipped
- [ ] `npm run build` → nova lib NÃO aparece no chunk index

### CSS
- [ ] Nenhum `@keyframes` animando `width`, `height`, `top`, `left`, `margin`, `padding`
- [ ] Nenhum `@import url('*.js')` em arquivos CSS
- [ ] Font sizes: mínimo 10px em SVG restrito, 12px em texto de UI normal
- [ ] Novos containers de scroll: `overscroll-behavior: contain` adicionado

### Assets
- [ ] Novas imagens: `loading="lazy"` + `width`/`height` explícitos
- [ ] Favicon: < 10KB (SVG preferido)

### React
- [ ] Cálculos > 16ms em setState: envolvidos em `startTransition`
- [ ] Listas com potencial > 30 itens: `react-virtuoso` com `useWindowScroll`
- [ ] Componentes em lista longa: `React.memo` com comparação customizada
- [ ] IntersectionObserver: `rootMargin ≤ 50px`, sentinel DEPOIS do conteúdo visível

### Banco de Dados
- [ ] Nova query com ORDER BY: índice composto `(partition_key, sort_key DESC)` existe?
- [ ] Agregação client-side com > 100 rows: criar VIEW no banco

### UX Mobile
- [ ] Testado em emulação 375px (iPhone SE) no Chrome DevTools
- [ ] Tap em botões: sem flash, resposta imediata
- [ ] Scroll de listas: sem rubber-band no container pai

**Source:** Sprints M0–M6 — Performance Mobile Meus Remédios
```

---

---

---

# SPRINT M7 — ELIMINAR N+1 EM getAdherenceSummary

**Branch:** `fix/mobile-perf-m7-n1-adherence-summary`
**Dependência:** Nenhuma — pode rodar em paralelo com M8
**Duração estimada:** 0.5 dia
**Arquivo principal:** `src/services/api/adherenceService.js`

**Contexto:** Trace Safari (2026-03-13) revelou que `getAdherenceSummary('90d')` dispara
15 queries simultâneas com 10 protocolos. Raiz: `calculateAllProtocolsAdherence` usa
`Promise.all(protocols.map(calculateProtocolAdherence))` — padrão N+1 clássico.
Cada `calculateProtocolAdherence` faz `select('*')` em 90 dias de logs = ~270 linhas × 10 = ~2700 linhas
transferidas desnecessariamente, bloqueando a main thread com JSON parse por 100ms+.

---

## PASSO 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b fix/mobile-perf-m7-n1-adherence-summary

# Verificar arquivo correto
find src -name "adherenceService*" -type f
# Esperado: src/services/api/adherenceService.js (único)

# Confirmar linha exata das funções a modificar
grep -n "async calculateAdherence\|async calculateAllProtocols\|async getCurrentStreak\|select('\*')" \
  src/services/api/adherenceService.js
```

Então ler `.memory/rules.md` e `.memory/anti-patterns.md` (R-065).

---

## PASSO 2 — Implementação

### M7.1 — Refatorar calculateAllProtocolsAdherence (N+1 → 2 queries)

**Localização:** `adherenceService.js` — função `calculateAllProtocolsAdherence` (linha ~204)

Substituir o bloco completo da função:

```javascript
// REMOVER: o Promise.all com map que dispara N queries
const adherencePromises = protocols.map(async (protocol) => {
  try {
    return await this.calculateProtocolAdherence(protocol.id, period, resolvedUserId)
  } catch (err) { ... }
})
return Promise.all(adherencePromises)
```

Por:

```javascript
// SUBSTITUIR: 1 query batch + agrupamento O(M) client-side
// Query 2 de 2: todos os logs do período — apenas protocol_id (não select('*'))
const { data: allLogs, error: logError } = await supabase
  .from('medicine_logs')
  .select('protocol_id')
  .eq('user_id', resolvedUserId)
  .gte('taken_at', startDate.toISOString())
  .lte('taken_at', endDate.toISOString())
if (logError) throw logError

// Agrupar por protocol_id client-side: O(M) uma vez, em vez de O(M) × N separado
const takenByProtocol = new Map()
;(allLogs || []).forEach((log) => {
  if (log.protocol_id) {
    takenByProtocol.set(log.protocol_id, (takenByProtocol.get(log.protocol_id) || 0) + 1)
  }
})

// Calcular scores sem mais queries
return protocols.map((protocol) => {
  const expected = calculateExpectedDoses([protocol], days)
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
```

**Verificar que as variáveis de data já estão no escopo:** `startDate`, `endDate`, `days` devem
ser declarados no início da função (junto com `resolvedUserId`). Se não estiverem, adicionar:

```javascript
const days = parseInt(period)
const endDate = new Date()
const startDate = new Date()
startDate.setDate(startDate.getDate() - days)
```

---

### M7.2 — Fix select('*') em calculateAdherence (HEAD request)

**Localização:** `adherenceService.js` — função `calculateAdherence` (linha ~98)

```javascript
// ANTES (transfere todas as colunas — ~centenas de linhas de dados)
const { data: logs, error: logError } = await supabase
  .from('medicine_logs')
  .select('*')
  .eq('user_id', resolvedUserId)
  .gte('taken_at', startDate.toISOString())
  .lte('taken_at', endDate.toISOString())
if (logError) throw logError
const takenDoses = logs?.length || 0

// DEPOIS (HEAD request — zero transferência de dados, só o count)
const { count, error: logError } = await supabase
  .from('medicine_logs')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', resolvedUserId)
  .gte('taken_at', startDate.toISOString())
  .lte('taken_at', endDate.toISOString())
if (logError) throw logError
const takenDoses = count || 0
```

**Atenção:** Remover a variável `logs` que não é mais usada após a mudança.

---

### M7.3 — Verificar getCurrentStreak

```bash
# Confirmar que getCurrentStreak já usa select('taken_at') — não select('*')
grep -n "from.*medicine_logs\|\.select(" src/services/api/adherenceService.js | grep -A1 "getCurrentStreak"
```

Se usar `select('taken_at')` → sem alteração necessária.
Se usar `select('*')` → alterar para `select('taken_at')`.

---

### M7.4 — Verificar dead code (AP-W13)

```bash
# Confirmar que não há referência a `logs` (variável removida em M7.2)
grep -n "const takenDoses = logs" src/services/api/adherenceService.js
# Esperado: 0 resultados

# Confirmar que calculateProtocolAdherence ainda existe (pode ser chamada externamente)
grep -r "calculateProtocolAdherence" src/
# Se usado externamente: manter a função — só não chamá-la em Promise.all
```

---

## PASSO 3 — Validação

```bash
# Gate 1: Lint
npm run lint
# Esperado: 0 erros

# Gate 2: Testes críticos
npm run test:critical
# Confirmar: aderenceService tests passando (services suite)

# Gate 3: Validação completa
npm run validate:agent
# Esperado: todos passando, sem regressões

# Gate 4: Verificação manual no browser
# Abrir HealthHistory → Network tab
# Contar requests para medicine_logs — deve ser ≤ 6 (não 15)
# Checar que nenhum request tem ?select=* retornando centenas de linhas
```

---

## PASSO 4 — Git

```bash
git add src/services/api/adherenceService.js
git status
# Confirmar: APENAS adherenceService.js modificado

git commit -m "fix(adesao): eliminar N+1 em getAdherenceSummary (15 → 6 queries)

- calculateAllProtocolsAdherence: Promise.all(N queries) → 2 queries fixas
  Batch: SELECT protocol_id (não select('*')) + agrupamento Map client-side
  Com 10 protocolos: 11 queries → 2 (protocol_id apenas)
- calculateAdherence: select('*') → HEAD request (count only, zero dados)
  Elimina transferência de ~270 linhas por chamada
- Resultado: 15 queries simultâneas → 6 fixas, evento message 100ms → <20ms

Root cause: trace Safari 2026-03-13 confirmou 100ms blocking message event
com 10 protocolos ativos (2700 linhas de medicine_logs desnecessárias)."
```

---

## PASSO 5 — Push e PR

```bash
git push -u origin fix/mobile-perf-m7-n1-adherence-summary
```

**PR Body:**
```markdown
## Problema
Com 10 protocolos ativos, `getAdherenceSummary('90d')` disparava **15 queries Supabase
simultâneas** — confirmado por trace Safari (100ms blocking message event, 21/107 jank frames).

## Causa Raiz
`calculateAllProtocolsAdherence` usava `Promise.all(protocols.map(calculateProtocolAdherence))`:
N queries paralelas, cada uma com `select('*')` em 90 dias de logs ≈ 2700 linhas transferidas.

## Solução
- `calculateAllProtocolsAdherence`: 1 query batch (`SELECT protocol_id`) + `Map` client-side
- `calculateAdherence`: `select('*')` → HEAD request (`count: 'exact', head: true`)
- **Resultado:** 15 queries → 6 (fixo, independente do nº de protocolos)

## Quality Gates
- [ ] `npm run validate:agent` — sem regressões
- [ ] DevTools Network: ≤ 6 requests medicine_logs ao abrir HealthHistory
- [ ] Safari DevTools Timeline: nenhum frame > 50ms após setIsLoading(false)
```

---

## PASSO 6 — Gemini Review

Aguardar Gemini Code Assist. Resolver CRITICAL/HIGH antes do merge.

Se Gemini questionar o agrupamento client-side vs. server-side:
- O agrupamento `Map` é O(M) onde M = logs no período — muito mais barato que N round-trips HTTP
- Mover para SQL seria ideal a longo prazo mas requer nova view (sprint separado)
- Este fix já reduz o problema 70%+ sem risco de regressão

---

## PASSO 7 — Learning Loop

Registrar em `.memory/anti-patterns.md`:

```markdown
### AP-P09: N+1 Query Pattern em Service Layer [CRITICAL]
**Problema:** `Promise.all(items.map(async item => supabase.from('table').select()))` dispara
N queries Supabase simultâneas. Com 10 itens → 10 round-trips, cada um bloqueando main thread.
**Quando acontece:** Qualquer `.map()` com `async` que faz query dentro.
**Fix:** 1 query batch → `SELECT chave_agrupamento` + `Map.set(key, count)` client-side.
**Fonte:** Sprint M7 — trace Safari 2026-03-13 (100ms blocking, 15 queries com 10 protocolos)

### AP-P10: select('*') quando só precisa de count [HIGH]
**Problema:** `select('*')` transfere TODAS as colunas mesmo quando só se usa `.length`.
Com 90 dias de logs de 10 protocolos = ~2700 linhas desnecessárias no payload.
**Fix:** `select('*', { count: 'exact', head: true })` — HEAD request, zero dados transferidos.
**Fonte:** Sprint M7 — calculateAdherence fix
```

---

---

# SPRINT M8 — SENTINEL OBSERVER BUG FIX

**Branch:** `fix/mobile-perf-m8-sentinel-observer`
**Dependência:** Pode rodar em paralelo com M7 (arquivo diferente)
**Duração estimada:** 0.5 dia
**Arquivo principal:** `src/views/HealthHistory.jsx`

**Contexto:** `setSentinelElement` é `useCallback` com `isLoadingPatterns` nas deps.
Quando o state muda, React recria o callback → chama `old(null)` (retorna cedo sem desconectar)
→ chama `new(element)` (cria novo observer). Janela de ~16ms com observer antigo vivo.
O `return () => { observer.disconnect() }` é ignorado — ret value de ref callback não é cleanup.
Fix: deps `[]`, null-path desconecta, `useRef` para flag de loading.

---

## PASSO 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b fix/mobile-perf-m8-sentinel-observer

find src -name "HealthHistory*" -type f
# Esperado: src/views/HealthHistory.jsx (único)

grep -n "setSentinelElement\|isLoadingPatterns\|observerRef\|patternLoadedRef" \
  src/views/HealthHistory.jsx
```

---

## PASSO 2 — Implementação

### M8.1 — Adicionar isLoadingPatternsRef na seção de States

**Localização:** Seção de States, após os `useRef` existentes (`observerRef`, `patternLoadedRef`)

```jsx
// Adicionar junto com observerRef e patternLoadedRef (seção de States):
const isLoadingPatternsRef = useRef(false) // M8: evita closure stale no observer callback
```

### M8.2 — Refatorar setSentinelElement

**Localização:** Buscar por `setSentinelElement` no arquivo — é um `useCallback`

Substituir o bloco completo:

```jsx
// ANTES
const setSentinelElement = useCallback((sentinel) => {
  if (!sentinel) return  // ← não desconecta

  if (observerRef.current) {
    observerRef.current.disconnect()
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !isLoadingPatterns && !patternLoadedRef.current) {
        setIsLoadingPatterns(true)
        adherenceService
          .getAdherencePatternFromView()
          .then((pattern) => {
            patternLoadedRef.current = true
            setAdherencePattern(pattern)
            observer.disconnect()
          })
          .catch((err) => {
            console.error('[HealthHistory] Falha ao buscar padrões de adesão:', err.message, err)
            patternLoadedRef.current = false
          })
          .finally(() => {
            setIsLoadingPatterns(false)
          })
      }
    },
    { rootMargin: '50px' }
  )

  observer.observe(sentinel)
  observerRef.current = observer

  return () => {         // ← IGNORADO em ref callback
    observer.disconnect()
    observerRef.current = null
  }
}, [isLoadingPatterns])  // ← deps causam recreação
```

```jsx
// DEPOIS
const setSentinelElement = useCallback((sentinel) => {
  // Null-path: React chama com null antes de montar com novo elemento
  // Desconectar observer antigo para evitar chamadas duplas
  if (!sentinel) {
    observerRef.current?.disconnect()
    observerRef.current = null
    return
  }

  // Garantir que qualquer observer anterior está desconectado
  observerRef.current?.disconnect()

  const observer = new IntersectionObserver(
    ([entry]) => {
      // isLoadingPatternsRef evita duplo disparo sem fechar sobre state stale
      if (entry.isIntersecting && !patternLoadedRef.current && !isLoadingPatternsRef.current) {
        isLoadingPatternsRef.current = true
        setIsLoadingPatterns(true)
        adherenceService
          .getAdherencePatternFromView()
          .then((pattern) => {
            patternLoadedRef.current = true
            setAdherencePattern(pattern)
            observer.disconnect()
          })
          .catch((err) => {
            console.error('[HealthHistory] Falha ao buscar padrões de adesão:', err.message, err)
            patternLoadedRef.current = false // permitir retry
          })
          .finally(() => {
            isLoadingPatternsRef.current = false
            setIsLoadingPatterns(false)
          })
      }
    },
    { rootMargin: '50px' }
  )

  observer.observe(sentinel)
  observerRef.current = observer
}, [])  // ← deps vazias: callback estável, sem recreação desnecessária
```

### M8.3 — Verificar hook order (R-010)

Confirmar que `isLoadingPatternsRef` foi adicionado na seção de States, ANTES dos useMemos:

```bash
grep -n "isLoadingPatternsRef\|const \[isLoading\|patternLoadedRef\|observerRef" \
  src/views/HealthHistory.jsx | head -10
# isLoadingPatternsRef deve aparecer junto com observerRef e patternLoadedRef
# Todos devem estar ANTES do primeiro useMemo
```

### M8.4 — Verificar dead code (AP-W13)

```bash
# isLoadingPatterns state ainda é necessário para o JSX ({isLoadingPatterns && ...})
# Verificar que continua sendo usado no render
grep -n "isLoadingPatterns" src/views/HealthHistory.jsx
# Esperado: useState declaration + JSX usage + setIsLoadingPatterns calls
# NÃO deve aparecer mais nas deps do useCallback do sentinel
```

---

## PASSO 3 — Validação

```bash
npm run lint
npm run validate:agent

# Validação manual:
# 1. Abrir HealthHistory → scroll até final → verificar Network:
#    getAdherencePatternFromView chamado 1× (não 2×)
# 2. Reabrir HealthHistory (sem reload) → scroll novamente:
#    patternLoadedRef.current = true → zero chamadas adicionais
# 3. React DevTools Profiler: setSentinelElement não aparece como re-rendered
#    quando isLoadingPatterns muda de false → true → false
```

---

## PASSO 4 — Git

```bash
git add src/views/HealthHistory.jsx

git commit -m "fix(saude): corrigir race condition no sentinel observer do heatmap

- setSentinelElement: deps [] (era [isLoadingPatterns]) — elimina recreação
- null-path: desconecta observer antigo (era return early sem desconectar)
- return () de ref callback era ignorado pelo React — removido
- isLoadingPatternsRef: useRef substitui closure sobre state stale
- Resultado: observer não recria a cada mudança de isLoadingPatterns
  e garante exatamente 1 chamada a getAdherencePatternFromView

Bug: quando isLoadingPatterns mudava (false→true), React recriava o callback,
chamava old(null) sem desconectar o observer, depois new(element) com novo observer.
Janela de ~16ms com dois observers simultâneos."
```

---

## PASSO 5 — Push e PR

```bash
git push -u origin fix/mobile-perf-m8-sentinel-observer
```

---

## PASSO 7 — Learning Loop

Registrar em `.memory/anti-patterns.md`:

```markdown
### AP-P11: useCallback com state nas deps de um ref callback [HIGH]
**Problema:** Ref callbacks (passados para `ref={fn}`) recriados quando deps mudam.
React chama `old(null)` (sem cleanup) + `new(element)` — janela com dois observers vivos.
O `return () => {}` no final de ref callback é IGNORADO (só funciona em useEffect).
**Fix:** Deps `[]` + `useRef` para flags que precisariam estar no closure.
**Regra:** Ref callbacks SEMPRE com deps `[]`. Lógica stateful via refs.
**Fonte:** Sprint M8 — HealthHistory sentinel observer race condition
```

---

# Apêndice: Quality Gates Globais

## Comandos de Validação por Escopo

```bash
# Rápido (durante desenvolvimento):
npm run validate:quick   # lint + test:changed

# Antes de qualquer commit:
npm run lint

# Antes de criar PR:
npm run validate:agent   # lint + testes críticos + build (10-min kill switch)

# CI completo (opcional, antes de merge):
npm run validate:full    # lint + coverage + build
```

## Checklist Universal para Cada Sprint

Antes de criar o PR, verificar:

- [ ] `find src -name "*ArquivoAlterado*" -type f` → apenas um resultado (R-001)
- [ ] `npm run lint` → 0 erros, 0 warnings novos (AP-012)
- [ ] `npm run validate:agent` → todos os testes passando (R-051)
- [ ] `npm run build` → sem erros de módulo não encontrado (R-003)
- [ ] Dead code removido: `grep -n "NomeVarRemovida" src/arquivo.jsx` → 0 resultados (AP-W13)
- [ ] Nenhum `console.log` de debug deixado (apenas `console.error` com contexto)
- [ ] Hook order respeitado: States → Memos → Effects → Handlers (R-010, AP-004)
- [ ] Branch criada a partir de `main` atualizado
- [ ] PR não auto-mergeado (R-060, AP-020)

## Anti-Patterns Críticos para Esta Spec

| ID | Nunca fazer neste contexto |
|----|--------------------------|
| AP-001 | Modificar arquivo sem checar duplicatas primeiro |
| AP-004 | Declarar `useTransition` ou novos states DEPOIS de useMemo |
| AP-012 | Commitar sem rodar lint |
| AP-013 | Commitar direto em `main` |
| AP-020 | Auto-mergear o próprio PR |
| AP-021 | Ignorar issues CRITICAL/HIGH do Gemini Code Assist |
| AP-W13 | Deixar variáveis/states/memos órfãos após refatoração |
| AP-P04 | Adicionar nova view com import síncrono em App.jsx |
| AP-P05 | Importar biblioteca > 100KB no topo do arquivo (deve ser dynamic import) |
| AP-P06 | Animar `width`/`height` em @keyframes (usar `transform: scaleX/scaleY`) |
| AP-P07 | CSS `@import` de arquivo `.js` (requisição desnecessária na critical chain) |
| AP-P08 | Font-size < 10px em qualquer elemento — ilegível em mobile mid-low |
| AP-P09 | `Promise.all(array.map(async item => queryPorItem()))` — N+1 query pattern; usar batch query + agrupamento client-side |
| AP-P10 | `select('*')` quando só precisa contar — usar `select('*', { count: 'exact', head: true })` (HEAD request, zero dados) |
| AP-P11 | `useCallback` com state nas deps de um ref callback — ref callbacks não têm cleanup; estado stale no closure; usar `useRef` para flags |

---

## Referências

- [PLAN_MOBILE_PERFORMANCE_v2.md](plans/PLAN_MOBILE_PERFORMANCE_v2.md) — diagnóstico e decisões arquiteturais
- [HealthHistory.jsx](src/views/HealthHistory.jsx) — arquivo central dos sprints M0 e M1
- [MOBILE_PERFORMANCE.md](docs/standards/MOBILE_PERFORMANCE.md) — **guia de performance mobile** (construído incrementalmente nos sprints M2–M6)
- [performance_improvements_lighthouse.md](plans/performance_improvements_lighthouse.md) — melhorias apontadas pelo Chrome Lighthouse
- [.memory/rules.md](.memory/rules.md) — R-001 a R-120
- [.memory/anti-patterns.md](.memory/anti-patterns.md) — AP-001 a AP-A04
- [CLAUDE.md](CLAUDE.md) — convenções completas do projeto
