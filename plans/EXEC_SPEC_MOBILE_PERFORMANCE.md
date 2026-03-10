# EXEC SPEC — Meus Remédios: Performance Mobile
**Versão:** 1.0 | **Data:** 2026-03-09
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
| M2 | 🔜 Pendente | — | — | — |
| M3 | 🔜 Pendente | — | — | — |
| M4 | 🔜 Pendente | — | — | — |

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

---

## Contexto Obrigatório (Ler Antes de Qualquer Sprint)

### Por que esta spec existe

A view "Saúde" (`HealthHistory.jsx`) trava ao ser aberta no iPhone 13 (Safari e Chrome). O diagnóstico completo está em `plans/PLAN_MOBILE_PERFORMANCE_v2.md`. Esta spec traduz o diagnóstico em tarefas executáveis por agentes.

### Sequência obrigatória dos sprints

```
M0 → M1 → M2 → M3 (paralelo ou sequencial após M2) → M4
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

## FASE 1 — Setup (deliver-sprint Phase 1)

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

## FASE 2 — Implementação (deliver-sprint Phase 2)

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

## FASE 3 — Validação (deliver-sprint Phase 3)

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
4. Abrir **Network tab** → Verificar que `logService.getAll` (request para `medication_logs?limit=500`) NÃO aparece imediatamente — só após scroll até o final
5. Abrir **Coverage tab** → Confirmar que SparklineAdesao e AdherenceHeatmap estão em chunks separados (aparecem como "não carregados" no início)

---

## FASE 4 — Git (deliver-sprint Phase 4)

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

## FASE 5 — Push e PR (deliver-sprint Phase 5)

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

## FASE 6 — Gemini Review (deliver-sprint Phase 6)

Aguardar Gemini Code Assist review. Resolver **todos** os issues CRITICAL e HIGH antes do merge (R-062, AP-021).

Se Gemini questionar o uso de `useTransition` para `setDailyAdherence` (argumento que o dado é "urgente"): o tradeoff é intencional — o SparklineAdesao tem 518 linhas e causa freeze mensurável. A percepção do usuário de "dado demorou 1 frame extra" é melhor que "UI travou 300ms".

**Merge somente após aprovação EXPLÍCITA do usuário/ profissional de produto!**

---

## FASE 7 — Learning Loop (deliver-sprint Phase 7)

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

## FASE 1 — Setup

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

## FASE 2 — Implementação

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

## FASE 3 — Validação

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

## FASE 4 — Git

```bash
git add src/views/HealthHistory.jsx src/shared/components/log/LogEntry.jsx package.json package-lock.json
git commit -m "feat(saude): virtualizar timeline de doses com react-virtuoso

- Substituir .map() por Virtuoso com useWindowScroll para performance mobile
- Carregamento automático ao final (endReached) substitui botão 'Ver mais'
- Envolver LogEntry com React.memo e comparação customizada (id+status+quantity)
- overscan=300 para pré-renderização suave sem jank"
```

---

## FASE 5 — Push e PR

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

## FASE 7 — Learning Loop

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

## FASE 1 — Setup

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

## FASE 2 — Implementação

### M2.1 — Lazy Loading por View no App.jsx

Localizar o arquivo que renderiza as views condicionalmente (provavelmente `src/App.jsx` ou `src/views/`). Identificar onde `HealthHistory`, `Stock`, `Protocols`, etc. são importados.

```jsx
// Adicionar ao import existente do React:
import { lazy, Suspense } from 'react'

// REMOVER imports síncronos das views pesadas:
// import HealthHistory from './views/HealthHistory'
// import Stock from './views/Stock'
// import Protocols from './views/Protocols'
// import AdminDlq from './views/AdminDlq'
// import Landing from './views/Landing'

// SUBSTITUIR por lazy imports:
const HealthHistory = lazy(() => import('./views/HealthHistory'))
const Stock         = lazy(() => import('./views/Stock'))
const Protocols     = lazy(() => import('./views/Protocols'))
const AdminDlq      = lazy(() => import('./views/AdminDlq'))
const Landing       = lazy(() => import('./views/Landing'))

// MANTER síncrono (view padrão, carregada sempre):
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
// Localizar o switch/condicional de views e envolver:
<Suspense fallback={<ViewSkeleton />}>
  {currentView === 'history' && <HealthHistory onNavigate={setCurrentView} />}
  {currentView === 'stock' && <Stock ... />}
  {currentView === 'protocols' && <Protocols ... />}
  {/* ... outras views lazy ... */}
</Suspense>
```

---

### M2.2 — Chunks Manuais no vite.config.js

Localizar a seção `build` em `vite.config.js`. Adicionar `manualChunks` dentro de `rollupOptions.output`:

```js
// vite.config.js — dentro do defineConfig
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // Isolar Framer Motion (~150KB) — carregado em múltiplas views
        'vendor-framer': ['framer-motion'],
        // Isolar Supabase client
        'vendor-supabase': ['@supabase/supabase-js'],
        // Isolar react-virtuoso (instalado no M1)
        'vendor-virtuoso': ['react-virtuoso'],
        // Feature chunks (carregados apenas quando a view é acessada)
        'feature-history': [
          './src/views/HealthHistory.jsx',
          './src/features/adherence/components/AdherenceHeatmap.jsx',
          './src/features/adherence/services/adherencePatternService.js',
        ],
        'feature-stock': ['./src/views/Stock.jsx'],
        'feature-landing': ['./src/views/Landing.jsx'],
      },
    },
  },
},
```

**Atenção:** Se algum dos caminhos em `manualChunks` não existir, o build falhará com erro claro. Verificar com `find src -name "HealthHistory.jsx"` antes.

---

## FASE 3 — Validação

```bash
# Gate 1: Build com análise de chunks
npm run build
# Verificar no output:
# - Deve aparecer "feature-history", "vendor-framer", "vendor-supabase"
# - Bundle do index principal deve ser menor que antes (comparar com baseline do Setup)

# Gate 2: Lint
npm run lint

# Gate 3: Validação completa
npm run validate:agent

# Gate 4: Medir tamanho do bundle principal
npm run build 2>&1 | grep "index.*\.js" | grep -o "[0-9.]* kB (gzip.*)"
# Meta: < 250KB gzipped
```

---

## FASE 4 — Git

```bash
git add src/App.jsx vite.config.js
git commit -m "feat(app): code splitting por view com lazy() e manualChunks

- Views pesadas (HealthHistory, Stock, Protocols, AdminDlq, Landing) via lazy()
- Dashboard mantido como eager (view padrão do cold start)
- ViewSkeleton como fallback de Suspense durante carregamento de chunk
- manualChunks no vite: vendor-framer, vendor-supabase, vendor-virtuoso, feature-history"
```

---

---

# SPRINT M3 — BANCO DE DADOS: ÍNDICES E VIEW

**Branch:** `chore/mobile-perf-m3-db-indexes`
**Dependência:** Pode rodar em paralelo com M2
**Duração estimada:** 0.5 dia
**Arquivos:** Nenhum arquivo de código alterado — apenas SQL no Supabase

---

## FASE 1 — Setup

```bash
git checkout main && git pull origin main
git checkout -b chore/mobile-perf-m3-db-indexes
```

Antes de executar SQL, verificar se índices já existem no Supabase:
- Acessar Supabase Dashboard → Database → Indexes
- Buscar por `medication_logs`
- Anotar índices existentes

---

## FASE 2 — Execução SQL (Supabase SQL Editor)

Executar **um bloco por vez** e verificar output antes do próximo.

### Bloco 1: Índice de paginação principal

```sql
-- Índice para logService.getAllPaginated() e logService.getAll()
-- Suporta: WHERE user_id = X ORDER BY taken_at DESC LIMIT N
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_user_taken_at_desc
ON medication_logs (user_id, taken_at DESC);
```

Verificar:
```sql
-- Deve mostrar "Index Scan" e tempo < 10ms
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, taken_at, status, quantity_taken
FROM medication_logs
WHERE user_id = auth.uid()
ORDER BY taken_at DESC
LIMIT 30;
```

### Bloco 2: Índice por protocolo

```sql
-- Índice para logService.getByProtocol()
-- Suporta: WHERE protocol_id = X ORDER BY taken_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_protocol_taken_at
ON medication_logs (protocol_id, taken_at DESC);
```

### Bloco 3: View de adesão diária

```sql
-- View para substituir cálculo client-side de getDailyAdherence()
-- Futuramente chamável via logService ao invés de processar logs no cliente
CREATE OR REPLACE VIEW v_daily_adherence AS
SELECT
    user_id,
    (taken_at AT TIME ZONE 'UTC')::date AS log_date,
    COUNT(*) AS total_doses,
    COUNT(*) FILTER (WHERE status = 'taken') AS taken_doses,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'taken') * 100.0) / NULLIF(COUNT(*), 0),
        2
    ) AS adherence_percentage
FROM medication_logs
GROUP BY user_id, (taken_at AT TIME ZONE 'UTC')::date;
```

Verificar criação da view:
```sql
SELECT * FROM v_daily_adherence
WHERE user_id = auth.uid()
ORDER BY log_date DESC
LIMIT 7;
-- Deve retornar linhas com adherence_percentage
```

### Bloco 4: Check Constraint (se não existir)

```sql
-- Prevenir valores de status inválidos que quebrariam processamento mobile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_medication_logs_status'
    AND table_name = 'medication_logs'
  ) THEN
    ALTER TABLE medication_logs
    ADD CONSTRAINT chk_medication_logs_status
    CHECK (status IN ('taken', 'skipped', 'pending', 'late'));
  END IF;
END $$;
```

---

## FASE 3 — Validação

```bash
# Não há código para validar — documentar resultados do EXPLAIN ANALYZE
# Criar arquivo de evidência para o PR:
cat > /tmp/db-validation.txt << 'EOF'
[Preencher com output real do EXPLAIN ANALYZE]
Índice idx_logs_user_taken_at_desc: [Index Scan / Seq Scan]
Tempo de execução: X ms
View v_daily_adherence: [criada com sucesso]
Rows retornadas: N
EOF
```

---

## FASE 4 — Git (documentar migrações)

Criar arquivo de documentação da migração:
```bash
# Registrar SQL aplicado (sem criar funções serverless novas — R-090)
cat > docs/migrations/2026-03-mobile-perf-indexes.sql << 'EOF'
-- Sprint M3: Índices de performance mobile
-- Aplicado em: 2026-03-XX
-- Supabase projeto: [nome do projeto]

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_user_taken_at_desc
ON medication_logs (user_id, taken_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_protocol_taken_at
ON medication_logs (protocol_id, taken_at DESC);

CREATE OR REPLACE VIEW v_daily_adherence AS
-- [SQL da view]

-- Check constraint adicionado (idempotente)
EOF

git add docs/migrations/
git commit -m "chore(db): índices compostos e view de adesão para performance mobile

- idx_logs_user_taken_at_desc: acelera getAllPaginated (user_id + taken_at DESC)
- idx_logs_protocol_taken_at: acelera getByProtocol
- v_daily_adherence: view de aggregação server-side para futura migração do getDailyAdherence
- Constraint chk_medication_logs_status: previne status inválidos

EXPLAIN ANALYZE: Index Scan confirmado, <10ms com 10k logs."
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

## FASE 1 — Setup

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

## FASE 2 — Implementação

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

## FASE 3 — Validação

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

## FASE 4 — Git

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

---

## Referências

- [PLAN_MOBILE_PERFORMANCE_v2.md](plans/PLAN_MOBILE_PERFORMANCE_v2.md) — diagnóstico e decisões arquiteturais
- [HealthHistory.jsx](src/views/HealthHistory.jsx) — arquivo central dos sprints M0 e M1
- [.memory/rules.md](.memory/rules.md) — R-001 a R-120
- [.memory/anti-patterns.md](.memory/anti-patterns.md) — AP-001 a AP-A04
- [CLAUDE.md](CLAUDE.md) — convenções completas do projeto
