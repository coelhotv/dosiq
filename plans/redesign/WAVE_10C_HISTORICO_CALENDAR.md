# Wave 10C — Histórico Calendar-Driven: Navegação por Calendário + Painel de Doses

**Status:** ⏳ PENDENTE EXECUÇÃO (aguarda entrega de 10A + 10B)
**Data de criação da spec:** 2026-03-27
**Dependências:** W0-W9 ✅ + W10A (Settings Extraction) + W10B (Profile Hub)
**Risco:** ALTO — rewrite completo do HealthHistoryRedesign (de wrapper CSS → componente full), eliminação de Virtuoso/infinite scroll, novo paradigma de navegação
**Branch:** `feature/redesign/wave-10c-historico-calendar`
**Master doc:** `WAVE_10_PERFIL_HISTORICO_SETTINGS.md`

---

## Por que esta sub-wave existe

O HealthHistory atual usa scroll infinito (Virtuoso) para listar doses. Com milhares de registros, a usabilidade degrada: o usuário não encontra facilmente "o que aconteceu em tal dia", precisa scrollar indefinidamente, e a performance cai.

O mock do designer propõe um paradigma **calendar-driven**: o calendário (que já existe como acessório) se torna o **controle principal de navegação**. O fluxo passa a ser:

```
Selecionar mês → Clicar dia no calendário → Ver doses daquele dia → Clicar dose → Editar/Deletar
```

Isso resolve 3 problemas:
1. **Navegação:** O calendário dá orientação temporal imediata (vs. scroll infinito sem âncora)
2. **Performance:** Dados carregados por mês (1 query por mês, ~30-100 registros) vs. paginação global (potencialmente milhares)
3. **UX:** Responde à pergunta "o que aconteceu em tal dia?" com 2 cliques

---

## O que esta wave FAZ

- Reescreve `src/views/redesign/HealthHistoryRedesign.jsx` — de wrapper CSS para componente completo e independente
- Cria `src/views/redesign/history/HistoryKPICards.jsx` — KPI cards (adesão, sequência, doses/mês)
- Cria `src/views/redesign/history/HistoryDayPanel.jsx` — painel de doses do dia selecionado
- Cria `src/views/redesign/history/HistoryRedesign.css` — CSS completo dedicado
- Integra `useComplexityMode` para mostrar/ocultar gráficos avançados (sparkline + heatmap)
- Reutiliza componentes existentes: `Calendar.jsx`, `LogEntry.jsx`, `LogForm.jsx`, `Modal.jsx`, `SparklineAdesao.jsx`, `AdherenceHeatmap.jsx`
- Elimina dependência de `react-virtuoso` no redesign (o import de Virtuoso fica APENAS no `HealthHistory.jsx` original)
- FAB "Nova Dose" para criação rápida

## O que esta wave NÃO FAZ

- ❌ NÃO toca em `src/views/HealthHistory.jsx` (view original intacta — continua com Virtuoso)
- ❌ NÃO toca em `src/views/HealthHistory.css` (estilos originais intactos)
- ❌ NÃO modifica `Calendar.jsx` — usa o componente existente com suas props atuais
- ❌ NÃO modifica `LogEntry.jsx`, `LogForm.jsx`, `Modal.jsx` — reutiliza como estão
- ❌ NÃO modifica `SparklineAdesao.jsx` ou `AdherenceHeatmap.jsx`
- ❌ NÃO modifica `adherenceService.js`, `logService.js`, ou `cachedServices.js`
- ❌ NÃO modifica `useComplexityMode.js`
- ❌ NÃO modifica `App.jsx` (a rota `history` já renderiza HealthHistoryRedesign quando redesign está ativo)
- ❌ NÃO implementa filtros por medicamento (desnecessários sem listagem infinita)
- ❌ NÃO implementa exportação/compartilhamento (vive no Perfil)
- ❌ NÃO altera banco de dados ou schemas

---

## Referência Visual (Mocks do Designer)

Os mocks são **aspiracionais** — servem como guia de layout, não como spec pixel-perfect.

**Desktop (`plans/redesign/references/historico-desktop.png`):**
- KPI cards em row horizontal no topo (3 cards: Adesão 30d, Sequência Atual, Doses este Mês)
- Calendário à esquerda (~60% da largura) com dots de cores nos dias
- Painel "Adesão 30 dias" (sparkline) à direita do calendário (~40%)
- Abaixo do calendário: "Padrão por Período" (4 círculos coloridos: Manhã, Tarde, Noite, Madrugada)
- Abaixo: "Histórico Detalhado" — tabela com medicamento, dose, agendado, tomado, status
- Legenda: Em dia (verde) / Atrasado (laranja) / Esquecido (vermelho)

**Mobile (`plans/redesign/references/historico-mobile.png`):**
- KPI principal no topo: "ADESÃO 30 DIAS — 94%" com sparkline inline
- Calendário horizontal (semana visível) com seleção do dia
- "RESUMO DO DIA" com tabs Manhã/Tarde/Noite
- "Linha do Tempo" — lista vertical de doses do dia com hora, nome, nota
- Cada dose tem badge de status (verde = no horário, laranja = atrasado)
- Card "Dica de Saúde" no footer (FORA DO ESCOPO — não implementar)

### Adaptações ao escopo definido (vs. mock)

| Mock mostra | Implementação real | Motivo |
|-------------|-------------------|--------|
| Tabela "Histórico Detalhado" com filtros | Painel "Doses do Dia" sem filtros | Filtros desnecessários sem scroll infinito |
| Tabs Manhã/Tarde/Noite no resumo | Lista única das doses do dia | Complexidade desnecessária para v1 |
| Card "Dica de Saúde" | Não implementar | Fora do escopo |
| Calendário horizontal (semana) no mobile | Calendário completo (mês) no mobile | Manter componente Calendar existente |
| Padrão por período com 4 círculos | Modo Simples: não exibe / Modo Complex: heatmap 7×4 existente | Reutilizar componente existente |
| Sparkline à direita do calendário (desktop) | Sparkline abaixo do calendário (complex only) | Layout mais simples e responsivo |

---

## Arquitetura de Componentes

```
HealthHistoryRedesign.jsx (REWRITE — componente principal)
├── HistoryKPICards.jsx (NOVO — 3 KPI cards)
├── Calendar.jsx (EXISTENTE — src/shared/components/ui/Calendar.jsx)
├── HistoryDayPanel.jsx (NOVO — doses do dia selecionado)
│   └── LogEntry.jsx (EXISTENTE — src/shared/components/log/LogEntry.jsx)
├── SparklineAdesao.jsx (EXISTENTE — lazy, complex only)
├── AdherenceHeatmap.jsx (EXISTENTE — lazy, complex only)
├── FloatingActionButton.jsx (EXISTENTE)
└── Modal > LogForm (EXISTENTES — dose create/edit)
```

**Regra fundamental:** Nenhum componente existente é modificado. Toda a lógica nova vive em `HealthHistoryRedesign.jsx`, `HistoryKPICards.jsx`, `HistoryDayPanel.jsx`, e `HistoryRedesign.css`.

---

## Sprints

### S10C.1 — HealthHistoryRedesign.jsx: Rewrite Completo

**Arquivo:** `src/views/redesign/HealthHistoryRedesign.jsx`
**Ação:** REWRITE (substituir conteúdo atual — era wrapper CSS, agora é componente full)
**Estimativa:** ~280-350 linhas JSX
**Dependência:** Nenhuma outra sub-task de 10C

#### Props

```jsx
/**
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback de navegação (para 'profile', etc.)
 */
export default function HealthHistoryRedesign({ onNavigate })
```

#### Imports (COPIAR EXATAMENTE)

```jsx
import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { cachedLogService as logService } from '@shared/services'
import { cachedAdherenceService as adherenceService } from '@shared/services'
import { formatLocalDate } from '@utils/dateUtils'
import Calendar from '@shared/components/ui/Calendar'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import FloatingActionButton from '@shared/components/ui/FloatingActionButton'
import HistoryKPICards from './history/HistoryKPICards'
import HistoryDayPanel from './history/HistoryDayPanel'
import './history/HistoryRedesign.css'

// Lazy: só carrega em modo complex
const SparklineAdesao = lazy(() => import('@dashboard/components/SparklineAdesao'))
const AdherenceHeatmap = lazy(() => import('@adherence/components/AdherenceHeatmap'))
```

**ATENÇÃO — imports que NÃO devem existir neste arquivo:**
- ❌ `import { Virtuoso } from 'react-virtuoso'` — PROIBIDO no redesign
- ❌ `import CalendarWithMonthCache` — usar `Calendar` diretamente (CalendarWithMonthCache é deprecated wrapper)
- ❌ `import HealthHistory` — NÃO wrapa mais o original
- ❌ `import './HealthHistoryRedesign.css'` — arquivo CSS antigo, usar `'./history/HistoryRedesign.css'`

#### State (ordem obrigatória: States → Memos → Effects → Handlers)

```jsx
// ═══ States ═══
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState(null)
const [successMessage, setSuccessMessage] = useState('')
const [isModalOpen, setIsModalOpen] = useState(false)
const [editingLog, setEditingLog] = useState(null)
const [selectedDate, setSelectedDate] = useState(new Date())
const [currentMonthLogs, setCurrentMonthLogs] = useState([])
const [totalLogs, setTotalLogs] = useState(0)

// Dados para modo complex (sparkline + heatmap)
const [dailyAdherence, setDailyAdherence] = useState([])
const [adherencePattern, setAdherencePattern] = useState(null)
const [adherenceSummary, setAdherenceSummary] = useState(null)

// ═══ Context ═══
const { protocols, stats, refresh } = useDashboard()
const { mode: complexityMode } = useComplexityMode()
const isComplex = complexityMode === 'complex'

// ═══ Refs ═══
const patternLoadedRef = useRef(false)
```

**IMPORTANTE — States que NÃO existem mais (vs. HealthHistory.jsx original):**
- ❌ `timelineLogs` — não há timeline/scroll infinito
- ❌ `timelineHasMore` — não há paginação global
- ❌ `timelineOffset` — não há offset de paginação
- ❌ `isLoadingMore` — não há "carregar mais"
- ❌ `isLoadingPatterns` — heatmap carrega direto (sem IntersectionObserver)
- ❌ `observerRef` — sem IntersectionObserver
- ❌ `isLoadingPatternsRef` — sem observer

#### Memos (COPIAR EXATAMENTE)

```jsx
// Planos de tratamento (para LogForm)
const treatmentPlans = useMemo(() => {
  const planMap = new Map()
  protocols.forEach((p) => {
    if (p.treatment_plan_id) {
      planMap.set(p.treatment_plan_id, true)
    }
  })
  return Array.from(planMap.keys())
}, [protocols])

// Doses do dia selecionado — filtra dos logs do mês carregado
const dayLogs = useMemo(() => {
  const d = selectedDate || new Date()
  return currentMonthLogs.filter((log) => {
    const logDate = new Date(log.taken_at)
    return (
      logDate.getFullYear() === d.getFullYear() &&
      logDate.getMonth() === d.getMonth() &&
      logDate.getDate() === d.getDate()
    )
  })
}, [currentMonthLogs, selectedDate])

// Datas marcadas no calendário (array de strings 'YYYY-MM-DD')
const markedDates = useMemo(
  () => currentMonthLogs.map((log) => formatLocalDate(new Date(log.taken_at))),
  [currentMonthLogs]
)

// Contadores do mês (para KPI "Doses este Mês")
const dosesThisMonth = useMemo(() => currentMonthLogs.length, [currentMonthLogs])
const pillsThisMonth = useMemo(
  () => currentMonthLogs.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0),
  [currentMonthLogs]
)
```

#### Effect — loadData (carregamento inicial)

```jsx
const loadData = useCallback(async () => {
  try {
    setIsLoading(true)
    setError(null)
    const now = new Date()

    // Phase 1: UI-critical — logs do mês atual (calendário + day panel)
    const logsResult = await logService.getByMonthSlim(now.getFullYear(), now.getMonth())
    setCurrentMonthLogs(logsResult.data || [])
    setTotalLogs(logsResult.total || 0)

    // Selecionar dia mais recente com dose (ou hoje)
    if (logsResult.data?.length > 0) {
      setSelectedDate(new Date(logsResult.data[0].taken_at))
    }

    // UI fica interativa AQUI
    setIsLoading(false)

    // Phase 2: Dados deferidos (só se complex)
    if (isComplex) {
      const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))
      scheduleIdle(async () => {
        try {
          const daily = await adherenceService.getDailyAdherenceFromView(90)
          setDailyAdherence(daily)
        } catch (err) {
          console.error('[HistoryRedesign] Erro daily adherence:', err.message)
        }

        try {
          const summary = await adherenceService.getAdherenceSummary('90d')
          setAdherenceSummary(summary)
        } catch (err) {
          console.error('[HistoryRedesign] Erro summary:', err.message)
        }

        // Heatmap: carregar direto (sem IntersectionObserver)
        if (!patternLoadedRef.current) {
          try {
            const pattern = await adherenceService.getAdherencePatternFromView()
            setAdherencePattern(pattern)
            patternLoadedRef.current = true
          } catch (err) {
            console.error('[HistoryRedesign] Erro pattern:', err.message)
          }
        }
      })
    }
  } catch (err) {
    setError('Erro ao carregar dados: ' + err.message)
    setIsLoading(false)
  }
}, [isComplex])

useEffect(() => {
  loadData()
}, [loadData])
```

**DIFERENÇAS vs. HealthHistory.jsx original (ATENÇÃO):**
1. Apenas 1 request na Phase 1 (não 2) — sem timeline, só `getByMonthSlim`
2. Phase 2 só executa se `isComplex === true`
3. Heatmap carrega direto na Phase 2 (sem IntersectionObserver/sentinel)
4. Sem `timelineResult`, `setTimelineLogs`, `setTimelineHasMore`, `setTimelineOffset`

#### Handler — handleCalendarLoadMonth (mudança de mês)

```jsx
const handleCalendarLoadMonth = useCallback(async (year, month) => {
  try {
    const result = await logService.getByMonthSlim(year, month)
    setCurrentMonthLogs(result.data || [])
    setTotalLogs(result.total || 0)
    // Selecionar primeiro dia com dose no novo mês, ou dia 1
    if (result.data?.length > 0) {
      setSelectedDate(new Date(result.data[0].taken_at))
    } else {
      setSelectedDate(new Date(year, month, 1))
    }
    return result
  } catch (err) {
    console.error('[HistoryRedesign] Erro ao carregar mês:', err)
    return { data: [], total: 0 }
  }
}, [])
```

#### Handler — handleDayClick (seleção de dia no calendário)

```jsx
const handleDayClick = useCallback((date) => {
  setSelectedDate(date)
}, [])
```

**IMPORTANTE:** Este handler é passado como `onDayClick` para o `Calendar`. Quando o usuário clica em um dia, o `Calendar` chama esta função com um objeto `Date`. O `dayLogs` memo recalcula automaticamente filtrando `currentMonthLogs` pelo dia selecionado, e o `HistoryDayPanel` re-renderiza com as doses do novo dia.

#### Handler — handleLogMedicine (criar/editar dose)

```jsx
const handleLogMedicine = useCallback(async (logData) => {
  try {
    if (logData.id) {
      await logService.update(logData.id, logData)
      showSuccess('Registro atualizado!')
    } else if (Array.isArray(logData)) {
      await logService.createBulk(logData)
      showSuccess('Plano registrado!')
    } else {
      await logService.create(logData)
      showSuccess('Dose registrada!')
    }
    setIsModalOpen(false)
    setEditingLog(null)
    await loadData()
    refresh()
  } catch (err) {
    throw new Error(err.message)
  }
}, [loadData, refresh])
```

**NOTA:** `showSuccess` é definido antes deste handler (ver abaixo). A dependência `showSuccess` NÃO precisa estar no array de deps porque `showSuccess` é estável (useCallback com deps []).

#### Handler — handleDeleteLog (deletar dose)

```jsx
const handleDeleteLog = useCallback(async (id) => {
  try {
    await logService.delete(id)
    showSuccess('Registro removido!')
    // Remover do state local (otimismo) — evita reload completo
    setCurrentMonthLogs((prev) => prev.filter((log) => log.id !== id))
    setTotalLogs((prev) => Math.max(0, prev - 1))
    refresh()
  } catch (err) {
    setError('Erro ao remover: ' + err.message)
  }
}, [refresh])
```

#### Handler — handleEditClick (abrir modal de edição)

```jsx
const handleEditClick = useCallback((log) => {
  setEditingLog(log)
  setIsModalOpen(true)
}, [])
```

#### Handler — showSuccess (toast)

```jsx
const showSuccess = useCallback((msg) => {
  setSuccessMessage(msg)
  setTimeout(() => setSuccessMessage(''), 3000)
}, [])
```

#### JSX — Render (COPIAR ESTRUTURA EXATAMENTE)

```jsx
if (isLoading) {
  return (
    <div className="hhr-view">
      <div className="hhr-loading">
        <div className="hhr-loading__spinner" />
        <span>Carregando histórico...</span>
      </div>
    </div>
  )
}

return (
  <div className="hhr-view">
    {/* ── Header ── */}
    <div className="hhr-header">
      <h1 className="hhr-header__title">Histórico de Doses</h1>
      <p className="hhr-header__subtitle">
        Acompanhe sua jornada de saúde e adesão ao tratamento.
      </p>
    </div>

    {/* ── Feedback messages ── */}
    {successMessage && (
      <div className="hhr-banner hhr-banner--success">{successMessage}</div>
    )}
    {error && (
      <div className="hhr-banner hhr-banner--error">{error}</div>
    )}

    {/* ── KPI Cards ── */}
    <HistoryKPICards
      adherenceScore={stats?.score ?? 0}
      currentStreak={stats?.currentStreak ?? 0}
      dosesThisMonth={dosesThisMonth}
      totalExpectedThisMonth={totalLogs}
    />

    {/* ── Calendar + Day Panel ── */}
    <div className="hhr-calendar-section">
      <div className="hhr-calendar-card">
        <Calendar
          selectedDate={selectedDate}
          onDayClick={handleDayClick}
          onLoadMonth={handleCalendarLoadMonth}
          markedDates={markedDates}
          enableLazyLoad={true}
          enableSwipe={true}
          enableMonthPicker={true}
        />
      </div>

      <HistoryDayPanel
        selectedDate={selectedDate}
        dayLogs={dayLogs}
        onEditLog={handleEditClick}
        onDeleteLog={handleDeleteLog}
      />
    </div>

    {/* ── Sparkline 30d (complex only) ── */}
    {isComplex && dailyAdherence.length > 0 && (
      <div className="hhr-chart-card">
        <h3 className="hhr-section-title">Adesão 30 dias</h3>
        <Suspense fallback={<div className="hhr-chart-skeleton" aria-busy="true" />}>
          <SparklineAdesao adherenceByDay={dailyAdherence} size="expanded" />
        </Suspense>
      </div>
    )}

    {/* ── Adherence Heatmap (complex only) ── */}
    {isComplex && adherencePattern && (
      <div className="hhr-chart-card">
        <h3 className="hhr-section-title">Padrão por Período</h3>
        <Suspense fallback={<div className="hhr-chart-skeleton" aria-busy="true" />}>
          <AdherenceHeatmap pattern={adherencePattern} />
        </Suspense>
      </div>
    )}

    {/* ── FAB: Nova Dose ── */}
    <FloatingActionButton
      onClick={() => {
        setEditingLog(null)
        setIsModalOpen(true)
      }}
    >
      + Nova Dose
    </FloatingActionButton>

    {/* ── Modal: LogForm ── */}
    <Modal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false)
        setEditingLog(null)
      }}
    >
      <LogForm
        protocols={protocols}
        treatmentPlans={treatmentPlans}
        initialValues={editingLog}
        onSave={handleLogMedicine}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingLog(null)
        }}
      />
    </Modal>
  </div>
)
```

**ATENÇÃO — O que NÃO existe no JSX (vs. HealthHistory.jsx original):**
- ❌ Sem `<Virtuoso>` — não há timeline com scroll infinito
- ❌ Sem sentinel `<div ref={setSentinelElement} />` — sem IntersectionObserver
- ❌ Sem seção "Stats do Mês" (grid Doses/Dias/Comprimidos) — KPI cards substituem
- ❌ Sem botão "← Minha Saúde" — header simplificado (BottomNav cuida de navegação)
- ❌ Sem seção "Últimas Doses" — doses são exibidas por dia no HistoryDayPanel

---

### S10C.2 — HistoryKPICards.jsx

**Arquivo:** `src/views/redesign/history/HistoryKPICards.jsx`
**Ação:** CRIAR
**Estimativa:** ~60-80 linhas JSX

#### Propósito

3 cards horizontais no topo da view exibindo métricas de adesão rápidas. Layout compacto que dá visão geral antes de explorar o calendário.

#### Props (COPIAR EXATAMENTE)

```jsx
/**
 * KPI cards para o topo do Histórico de Doses.
 *
 * @param {Object} props
 * @param {number} props.adherenceScore - Percentual de adesão (0-100), de stats.score
 * @param {number} props.currentStreak - Sequência atual em dias, de stats.currentStreak
 * @param {number} props.dosesThisMonth - Total de doses registradas no mês selecionado
 * @param {number} props.totalExpectedThisMonth - Total de logs do mês (para exibir "X doses")
 */
export default function HistoryKPICards({
  adherenceScore,
  currentStreak,
  dosesThisMonth,
  totalExpectedThisMonth,
})
```

#### Implementação completa

```jsx
export default function HistoryKPICards({
  adherenceScore,
  currentStreak,
  dosesThisMonth,
  totalExpectedThisMonth,
}) {
  return (
    <div className="hhr-kpi-row">
      {/* Card 1: Adesão 30d */}
      <div className="hhr-kpi-card">
        <span className="hhr-kpi-card__label">Adesão (30 dias)</span>
        <span className="hhr-kpi-card__value hhr-kpi-card__value--primary">
          {adherenceScore}%
        </span>
      </div>

      {/* Card 2: Sequência Atual */}
      <div className="hhr-kpi-card">
        <span className="hhr-kpi-card__label">Sequência Atual</span>
        <span className="hhr-kpi-card__value">
          {currentStreak} <span className="hhr-kpi-card__unit">dias</span>
        </span>
      </div>

      {/* Card 3: Doses este Mês */}
      <div className="hhr-kpi-card">
        <span className="hhr-kpi-card__label">Doses este Mês</span>
        <span className="hhr-kpi-card__value hhr-kpi-card__value--accent">
          {dosesThisMonth}
        </span>
      </div>
    </div>
  )
}
```

**NÃO adicionar:**
- ❌ useState ou useEffect (componente puro/presentational)
- ❌ Lógica de carregamento (o pai lida com loading)
- ❌ Ícones ou emojis (design clean)
- ❌ Trend indicator (↑↓) — simplificação para v1

---

### S10C.3 — HistoryDayPanel.jsx

**Arquivo:** `src/views/redesign/history/HistoryDayPanel.jsx`
**Ação:** CRIAR
**Estimativa:** ~80-110 linhas JSX

#### Propósito

Painel que exibe as doses do dia selecionado no calendário. Quando o usuário clica em um dia no calendário, este painel mostra a lista de doses daquele dia. Se não há doses, mostra mensagem vazia.

Click em uma dose individual abre edição (via `onEditLog` callback).

#### Props (COPIAR EXATAMENTE)

```jsx
import LogEntry from '@shared/components/log/LogEntry'

/**
 * Painel de doses do dia selecionado no calendário.
 *
 * @param {Object} props
 * @param {Date} props.selectedDate - Data selecionada no calendário (objeto Date)
 * @param {Array} props.dayLogs - Array de logs filtrados para o dia selecionado.
 *   Cada log tem: { id, taken_at, quantity_taken, notes, medicine: { name }, protocol: { name } }
 * @param {Function} props.onEditLog - Callback chamado com o objeto log quando usuário quer editar.
 *   Assinatura: onEditLog(log) → abre modal de edição no componente pai.
 * @param {Function} props.onDeleteLog - Callback chamado com o id do log quando usuário quer deletar.
 *   Assinatura: onDeleteLog(logId) → deleta e remove do state no componente pai.
 */
export default function HistoryDayPanel({
  selectedDate,
  dayLogs,
  onEditLog,
  onDeleteLog,
})
```

#### Implementação completa

```jsx
import LogEntry from '@shared/components/log/LogEntry'

export default function HistoryDayPanel({
  selectedDate,
  dayLogs,
  onEditLog,
  onDeleteLog,
}) {
  // Formatar data para exibição
  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

  // Capitalizar primeira letra (pt-BR retorna minúsculo)
  const formattedDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

  return (
    <div className="hhr-day-panel">
      <div className="hhr-day-panel__header">
        <h3 className="hhr-day-panel__title">Doses do Dia</h3>
        <span className="hhr-day-panel__date">{formattedDate}</span>
      </div>

      {dayLogs.length === 0 ? (
        <div className="hhr-day-panel__empty">
          <span className="hhr-day-panel__empty-text">
            Nenhuma dose registrada neste dia.
          </span>
        </div>
      ) : (
        <div className="hhr-day-panel__list">
          {dayLogs.map((log) => (
            <LogEntry
              key={log.id}
              log={log}
              onEdit={onEditLog}
              onDelete={onDeleteLog}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Decisões de design:**
- Usa `LogEntry` existente para renderizar cada dose (reutiliza edit/delete UI)
- O `LogEntry` já tem confirmação de delete internamente (dialog "Tem certeza?")
- O `LogEntry` já exibe nome do medicamento, hora, quantidade, notas, botões Edit/Delete
- NÃO implementar tabs Manhã/Tarde/Noite (simplificação — mock aspiracional)
- NÃO implementar status badges (no horário/atrasado) — LogEntry não tem essa info e adicioná-la requereria mudanças no service

---

### S10C.4 — HistoryRedesign.css

**Arquivo:** `src/views/redesign/history/HistoryRedesign.css`
**Ação:** CRIAR
**Estimativa:** ~350-400 linhas CSS

#### Diretório

Criar o diretório `src/views/redesign/history/` se não existir.

#### Tokens obrigatórios (design system Santuário — COPIAR do SettingsRedesign.css)

```css
/* Todas as variáveis CSS abaixo JÁ existem em tokens.redesign.css
   NÃO redefinir — apenas referenciar com var() */

/* Cores */
--color-primary              /* Verde saúde #006a5e */
--color-primary-bg           /* Verde claro para backgrounds */
--color-surface-container-lowest  /* Fundo dos cards */
--color-surface-container-low     /* Hover states */
--color-surface-container-high    /* Skeleton placeholders */
--color-on-surface           /* Texto principal */
--color-on-surface-variant   /* Texto secundário */
--color-outline-ghost        /* Borders sutis rgba(25,28,29,0.08) */
--color-error                /* Vermelho para badges/alertas */
--color-error-bg             /* Background vermelho claro */
--color-success              /* Verde para sucesso */
--color-warning              /* Laranja para avisos */

/* Tipografia */
--font-display               /* Títulos, KPI values */
--font-body                  /* Corpo, labels */

/* Sombras */
--shadow-ambient             /* Elevação sutil dos cards */
```

#### CSS completo (COPIAR INTEGRALMENTE)

```css
/* ============================================================
   HistoryRedesign.css — Wave 10C
   Estilos do Histórico Calendar-Driven (redesign).
   Escopo: .hhr-view (componente principal)
   ============================================================ */

/* ── View container ────────────────────────────────────────── */
.hhr-view {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
  padding-bottom: 6rem; /* espaço para FAB + BottomNav */
}

/* ── Header ────────────────────────────────────────────────── */
.hhr-header {
  margin-bottom: 1.25rem;
}

.hhr-header__title {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0 0 0.25rem 0;
}

.hhr-header__subtitle {
  font-size: 0.875rem;
  color: var(--color-on-surface-variant, var(--color-on-surface));
  opacity: 0.6;
  margin: 0;
}

/* ── Feedback banners ──────────────────────────────────────── */
.hhr-banner {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.hhr-banner--success {
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
  color: var(--color-success);
}

.hhr-banner--error {
  background: var(--color-error-bg, #ffdad6);
  color: var(--color-error);
}

/* ── KPI Cards Row ─────────────────────────────────────────── */
.hhr-kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.hhr-kpi-card {
  background: var(--color-surface-container-lowest);
  border-radius: 1.25rem;
  box-shadow: var(--shadow-ambient);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hhr-kpi-card__label {
  font-size: 0.75rem;
  color: var(--color-on-surface);
  opacity: 0.55;
  font-weight: 500;
}

.hhr-kpi-card__value {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-on-surface);
  line-height: 1.1;
}

.hhr-kpi-card__value--primary {
  color: var(--color-primary);
}

.hhr-kpi-card__value--accent {
  color: var(--color-primary);
}

.hhr-kpi-card__unit {
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 0.6;
}

/* ── Calendar Section (calendar + day panel) ───────────────── */
.hhr-calendar-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.hhr-calendar-card {
  flex: 1;
  background: var(--color-surface-container-lowest);
  border-radius: 1.25rem;
  box-shadow: var(--shadow-ambient);
  padding: 1rem;
  min-width: 0; /* prevent overflow */
}

/* ── Day Panel ─────────────────────────────────────────────── */
.hhr-day-panel {
  flex: 0 0 340px;
  background: var(--color-surface-container-lowest);
  border-radius: 1.25rem;
  box-shadow: var(--shadow-ambient);
  padding: 1.25rem;
  max-height: 480px;
  overflow-y: auto;
}

.hhr-day-panel__header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.08));
}

.hhr-day-panel__title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0 0 0.25rem 0;
}

.hhr-day-panel__date {
  font-size: 0.8rem;
  color: var(--color-on-surface);
  opacity: 0.5;
}

.hhr-day-panel__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.hhr-day-panel__empty-text {
  font-size: 0.875rem;
  color: var(--color-on-surface);
  opacity: 0.4;
  text-align: center;
}

.hhr-day-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ── Override LogEntry styling inside day panel ────────────── */
.hhr-day-panel .log-entry {
  background: var(--color-surface-container-low, #f5f5f5) !important;
  border: none !important;
  border-radius: 0.75rem !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

/* ── Chart cards (Sparkline + Heatmap) ─────────────────────── */
.hhr-chart-card {
  background: var(--color-surface-container-lowest);
  border-radius: 1.25rem;
  box-shadow: var(--shadow-ambient);
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.hhr-section-title {
  font-family: var(--font-display);
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface);
  opacity: 0.6;
  margin: 0 0 1rem 0;
}

.hhr-chart-skeleton {
  height: 120px;
  background: var(--color-surface-container-high);
  border-radius: 0.75rem;
  animation: hhr-pulse 1.5s ease-in-out infinite;
}

/* ── Override Sparkline/Heatmap colors (same as old HealthHistoryRedesign.css) ── */

/* Sparkline SVG overrides */
.hhr-view .sparkline-line,
.hhr-view .recharts-line-curve {
  stroke: var(--color-primary) !important;
  filter: none !important;
}

.hhr-view .sparkline-area,
.hhr-view .recharts-area-area {
  fill: var(--color-primary) !important;
  opacity: 0.1 !important;
  filter: none !important;
}

.hhr-view .sparkline-dot,
.hhr-view .recharts-dot {
  fill: var(--color-primary) !important;
  stroke: var(--color-surface-container-lowest) !important;
  filter: none !important;
}

/* Heatmap cell overrides */
.hhr-view .heatmap-cell--high {
  background: var(--color-primary) !important;
  box-shadow: none !important;
}

.hhr-view .heatmap-cell--medium {
  background: var(--color-primary-fixed, var(--color-primary)) !important;
  box-shadow: none !important;
}

.hhr-view .heatmap-cell--low {
  background: var(--color-warning, #f59e0b) !important;
  box-shadow: none !important;
}

.hhr-view .heatmap-cell--none {
  background: var(--color-surface-container-high) !important;
}

/* Calendar overrides */
.hhr-view .calendar-day--full,
.hhr-view .calendar-day--taken {
  background: var(--color-primary) !important;
  color: var(--color-on-primary, #fff) !important;
  box-shadow: none !important;
}

.hhr-view .calendar-day--partial {
  background: var(--color-secondary-fixed) !important;
  color: var(--color-on-surface) !important;
  box-shadow: none !important;
}

.hhr-view .calendar-day--missed,
.hhr-view .calendar-day--empty {
  background: var(--color-error-bg, #ffdad6) !important;
  color: var(--color-error) !important;
  box-shadow: none !important;
}

.hhr-view .calendar-day--selected {
  outline: 2px solid var(--color-primary) !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}

.hhr-view .calendar-day--today {
  border: 2px solid var(--color-primary) !important;
  box-shadow: none !important;
}

/* ── Loading state ─────────────────────────────────────────── */
.hhr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 1rem;
  color: var(--color-on-surface);
  opacity: 0.5;
}

.hhr-loading__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-outline-ghost, rgba(25,28,29,0.08));
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: hhr-spin 0.8s linear infinite;
}

/* ── Animations ────────────────────────────────────────────── */
@keyframes hhr-spin {
  to { transform: rotate(360deg); }
}

@keyframes hhr-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

/* ============================================================
   RESPONSIVE — Mobile (< 768px)
   ============================================================ */
@media (max-width: 767px) {
  .hhr-view {
    padding: 0.75rem;
    padding-bottom: 6rem;
  }

  .hhr-header__title {
    font-size: 1.375rem;
  }

  /* KPI: stack em 1 coluna ou 3 colunas compactas */
  .hhr-kpi-row {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .hhr-kpi-card {
    padding: 0.75rem;
  }

  .hhr-kpi-card__value {
    font-size: 1.375rem;
  }

  .hhr-kpi-card__label {
    font-size: 0.65rem;
  }

  /* Calendar Section: stack vertical (calendário em cima, day panel embaixo) */
  .hhr-calendar-section {
    flex-direction: column;
  }

  .hhr-day-panel {
    flex: none;
    max-height: none; /* sem scroll interno no mobile — conteúdo flui */
  }
}

/* ============================================================
   RESPONSIVE — Large Desktop (≥ 1200px)
   ============================================================ */
@media (min-width: 1200px) {
  .hhr-view {
    max-width: 1100px;
  }

  .hhr-day-panel {
    flex: 0 0 400px;
  }
}
```

---

### S10C.5 — Limpeza: Remover HealthHistoryRedesign.css antigo

**Arquivo:** `src/views/redesign/HealthHistoryRedesign.css`
**Ação:** DELETAR (todo o arquivo)
**Motivo:** Os overrides CSS que estavam neste arquivo (Wave 9) foram incorporados ao novo `HistoryRedesign.css` (seções de override de calendar, heatmap, sparkline). O arquivo antigo não é mais importado por nenhum componente.

**VERIFICAÇÃO OBRIGATÓRIA antes de deletar:**
```bash
grep -r "HealthHistoryRedesign.css" src/
```
Deve retornar 0 resultados (o antigo `HealthHistoryRedesign.jsx` importava esse CSS, mas agora importa `./history/HistoryRedesign.css`).

---

## Layout — Desktop vs. Mobile

### Desktop (≥ 768px)

```
╭─────────────────────────────────────────────────────────────╮
│  Histórico de Doses                                         │
│  Acompanhe sua jornada de saúde e adesão ao tratamento.     │
╰─────────────────────────────────────────────────────────────╯

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Adesão 30d  │  │ Sequência   │  │ Doses este  │
│   94%       │  │  12 dias    │  │ Mês: 128    │
└─────────────┘  └─────────────┘  └─────────────┘

┌─────────────────────────────┐  ┌──────────────────────────┐
│         CALENDÁRIO          │  │     Doses do Dia         │
│                             │  │  Terça-feira, 25 março   │
│   < Janeiro 2026 >         │  │                          │
│                             │  │  ┌────────────────────┐  │
│  DOM SEG TER QUA QUI SEX SAB│  │  │ Losartana 50mg     │  │
│   ..  ..  ..  ..  1   2   3 │  │  │ 08:00 · 1 comp     │  │
│   4   5  [6]  7   8   9  10│  │  │         Edit Delete │  │
│  11  12  13  14  15  16  17 │  │  └────────────────────┘  │
│  18  19  20  21  22  23  24 │  │  ┌────────────────────┐  │
│  25  26  27  28  29  30  31 │  │  │ Vitamina D         │  │
│                             │  │  │ 13:00 · 2 gotas    │  │
│  ● Em dia  ● Parcial  ● —  │  │  │         Edit Delete │  │
└─────────────────────────────┘  │  └────────────────────┘  │
                                 │  ┌────────────────────┐  │
                                 │  │ Metformina 850mg   │  │
                                 │  │ 21:40 · ATRASADO   │  │
                                 │  │         Edit Delete │  │
                                 │  └────────────────────┘  │
                                 └──────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ADESÃO 30 DIAS (sparkline)              ← complex only     │
│  ~~~~~~~~~~~~~~~~~~~~~/\~/\~~                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PADRÃO POR PERÍODO (heatmap 7×4)        ← complex only     │
│  SEG ██ ██ ░░ ██                                            │
│  TER ██ ██ ██ ░░                                            │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)

```
╭──────────────────────────────╮
│  Histórico de Doses          │
│  Acompanhe sua jornada...    │
╰──────────────────────────────╯

┌────────┐ ┌────────┐ ┌────────┐
│Adesão  │ │Sequên. │ │Doses   │
│ 94%    │ │12 dias │ │ 128    │
└────────┘ └────────┘ └────────┘

┌──────────────────────────────┐
│         CALENDÁRIO           │
│   < Janeiro 2026 >          │
│  DOM SEG TER QUA QUI SEX SAB│
│   ..  ..  ..  ..  1   2   3 │
│   4   5  [6]  7   8   9  10 │
│  ...                         │
└──────────────────────────────┘

┌──────────────────────────────┐
│  Doses do Dia                │
│  Terça-feira, 25 de março    │
│                              │
│  ┌────────────────────────┐  │
│  │ Losartana 50mg         │  │
│  │ 08:00 · 1 comp         │  │
│  │             Edit Delete│  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Vitamina D             │  │
│  │ 13:00 · 2 gotas        │  │
│  │             Edit Delete│  │
│  └────────────────────────┘  │
└──────────────────────────────┘

  (sparkline + heatmap: complex)
  
  (FAB "+ Nova Dose": canto inf. esq.)
```

**Regras de layout:**
1. **Desktop:** Calendar e Day Panel lado a lado (flex row), Day Panel com `flex: 0 0 340px` e scroll interno (`max-height: 480px`)
2. **Mobile:** Calendar e Day Panel empilhados (flex column), Day Panel sem scroll interno (conteúdo flui naturalmente)
3. **KPI cards:** Sempre 3 colunas (grid), compactam no mobile via padding/font menor
4. **Sparkline + Heatmap:** Full width abaixo da seção calendário, SÓ exibidos se `isComplex === true`

---

## Fluxo de Dados — Diagrama

```
┌──────────────────────┐
│   HealthHistory      │     LOAD INICIAL
│   Redesign.jsx       │─── logService.getByMonthSlim(year, month) ───▶ currentMonthLogs
│                      │
│   selectedDate ◄─────│─── Calendar.onDayClick(date) ◄── usuário clica dia
│                      │
│   dayLogs = useMemo( │    ← filtra currentMonthLogs pelo selectedDate
│     currentMonthLogs │
│     + selectedDate)  │
│                      │
│   ┌─────────────┐    │
│   │ HistoryDay  │◄───│─── dayLogs (array de doses do dia)
│   │ Panel       │    │
│   │             │────│──▶ onEditLog(log) → setEditingLog + setIsModalOpen
│   │             │────│──▶ onDeleteLog(id) → logService.delete + refresh
│   └─────────────┘    │
│                      │
│   ┌─────────────┐    │
│   │ LogForm     │◄───│─── editingLog (initialValues)
│   │ (Modal)     │────│──▶ handleLogMedicine → logService.create/update + loadData + refresh
│   └─────────────┘    │
│                      │    MUDANÇA DE MÊS
│   Calendar           │─── onLoadMonth(year, month)
│                      │    → logService.getByMonthSlim → setCurrentMonthLogs
│                      │    → setSelectedDate(primeiro dia com dose)
│                      │
│   ┌─────────────┐    │    SÓ SE isComplex
│   │ Sparkline   │◄───│─── adherenceService.getDailyAdherenceFromView(90)
│   │ Heatmap     │◄───│─── adherenceService.getAdherencePatternFromView()
│   └─────────────┘    │
└──────────────────────┘
```

---

## Densidade / Modo Complexidade

| Modo | Quem vê | O que exibe | O que NÃO exibe |
|------|---------|-------------|-----------------|
| `simple` | ≤3 medicamentos ativos | Header + KPI cards + Calendário + Day Panel + FAB | Sparkline, Heatmap |
| `complex` | 4+ medicamentos | Tudo acima + Sparkline 30d + Heatmap padrão por período | — |

**Implementação:**
```jsx
const { mode: complexityMode } = useComplexityMode()
const isComplex = complexityMode === 'complex'
```

- `isComplex` controla a renderização condicional dos blocos sparkline e heatmap
- `isComplex` também controla o carregamento (Phase 2 só executa se complex)
- Em modo `simple`, o componente carrega APENAS 1 query na Phase 1 (ultra rápido)

**NOTA:** `complexityMode` pode retornar `'moderate'` para 4-6 medicamentos. Como `moderate !== 'complex'`, o modo moderate se comporta como simple (sem gráficos). Isso é intencional — moderate foi removido como opção de UI mas o hook ainda pode retornar esse valor internamente. O check `=== 'complex'` é deliberado.

---

## Ordem de Execução dos Sprints

| Sprint | Descrição | Deps | Commit junto? |
|--------|-----------|------|---------------|
| S10C.1 | HealthHistoryRedesign.jsx rewrite | — | Sim, com S10C.2-4 |
| S10C.2 | HistoryKPICards.jsx | — | Sim, com S10C.1 |
| S10C.3 | HistoryDayPanel.jsx | — | Sim, com S10C.1 |
| S10C.4 | HistoryRedesign.css | — | Sim, com S10C.1 |
| S10C.5 | Deletar HealthHistoryRedesign.css antigo | S10C.1-4 | Sim, com S10C.1-4 |

**Recomendação:** Todos os 5 sprints devem ser commitados juntos num único commit. Eles formam uma unidade atômica — o rewrite não funciona parcialmente.

**Commit sugerido:**
```
feat(redesign): wave 10C — histórico calendar-driven

- Rewrite HealthHistoryRedesign como componente independente (sem Virtuoso)
- KPI cards (adesão, sequência, doses/mês) no topo
- Calendário como controle principal de navegação
- Painel de doses do dia selecionado com edit/delete
- Sparkline + heatmap apenas em modo complex
- CSS dedicado com layout responsivo (desktop side-by-side, mobile stacked)
- Remove CSS wrapper antigo (Wave 9)
```

---

## Checklist de Validação

### Funcionalidade Core
- [ ] View carrega sem erros (console limpo, sem warnings de React)
- [ ] KPI cards exibem: adesão % (de stats.score), sequência em dias, doses do mês
- [ ] Calendário renderiza com dias marcados (dots) nos dias que têm dose registrada
- [ ] Clicar em dia no calendário → Day Panel atualiza com doses daquele dia
- [ ] Clicar em dia sem doses → Day Panel mostra "Nenhuma dose registrada neste dia."
- [ ] Navegar entre meses (← →) recarrega dados do mês (nova query)
- [ ] Month Picker (dropdown de meses) funciona
- [ ] Swipe lateral no calendário muda o mês (mobile)
- [ ] Cada dose no Day Panel tem nome do medicamento, horário, botões Edit/Delete

### Edição/Deleção
- [ ] Click em Edit → abre Modal com LogForm preenchido com dados da dose
- [ ] Editar dose e salvar → atualiza dados (dose aparece atualizada no Day Panel)
- [ ] Click em Delete → confirmação → remove dose → Day Panel atualiza
- [ ] Após editar/deletar, Dashboard context é refreshed (`refresh()` chamado)

### Criação
- [ ] FAB "+ Nova Dose" visível no canto inferior esquerdo (bottom do side bar no desktop; acima do bottom bar no mobile)
- [ ] Click no FAB → abre Modal com LogForm vazio
- [ ] Criar dose → dose aparece no Day Panel do dia correspondente
- [ ] Criar dose via "Plano Completo" (bulk) → todas as doses registradas

### Densidade
- [ ] Modo simple (≤3 medicamentos): NÃO exibe sparkline, NÃO exibe heatmap
- [ ] Modo complex (4+ medicamentos): exibe sparkline 30d + heatmap padrão
- [ ] Sparkline e heatmap carregam com Suspense fallback (skeleton)
- [ ] Em modo simple, apenas 1 query é disparada (getByMonthSlim) — verificar Network tab

### Layout Responsivo
- [ ] Desktop (≥ 768px): Calendário e Day Panel lado a lado
- [ ] Desktop: Day Panel tem scroll interno quando muitas doses (max-height 480px)
- [ ] Mobile (< 768px): Calendário em cima, Day Panel embaixo (stacked)
- [ ] Mobile: Day Panel sem scroll interno (conteúdo flui)
- [ ] KPI cards: 3 colunas em ambos os modos (compactam no mobile)
- [ ] Large Desktop (≥ 1200px): max-width 1100px, Day Panel 400px

### Visual (Design System Santuário)
- [ ] Sem glass/backdrop-filter em nenhum card
- [ ] Sem neon glow em nenhum elemento
- [ ] Cards usam `--color-surface-container-lowest` + `--shadow-ambient` + `border-radius: 1.25rem`
- [ ] Títulos de seção: uppercase, letter-spacing, opacity 0.6
- [ ] Sparkline: cor primária (verde saúde), sem glow filter
- [ ] Heatmap: cells usam cores do design system (primary, warning, surface-high)
- [ ] Calendar days: cores Santuário (sem box-shadow)

### Não-Regressão
- [ ] `HealthHistory.jsx` (original) continua funcionando quando redesign está desligado
- [ ] `HealthHistory.css` (original) não foi modificado
- [ ] `Calendar.jsx` não foi modificado
- [ ] `LogEntry.jsx`, `LogForm.jsx`, `Modal.jsx` não foram modificados
- [ ] `SparklineAdesao.jsx`, `AdherenceHeatmap.jsx` não foram modificados
- [ ] `adherenceService.js`, `logService.js`, `cachedServices.js` não foram modificados
- [ ] ESLint: 0 errors
- [ ] Nenhum import de `react-virtuoso` no redesign

---

## Mapeamento de Arquivos

| Arquivo | Ação | Sprint | Linhas est. |
|---------|------|--------|-------------|
| `src/views/redesign/HealthHistoryRedesign.jsx` | REWRITE | S10C.1 | ~300 |
| `src/views/redesign/history/HistoryKPICards.jsx` | CRIAR | S10C.2 | ~60 |
| `src/views/redesign/history/HistoryDayPanel.jsx` | CRIAR | S10C.3 | ~80 |
| `src/views/redesign/history/HistoryRedesign.css` | CRIAR | S10C.4 | ~380 |
| `src/views/redesign/HealthHistoryRedesign.css` | DELETAR | S10C.5 | -135 |

**Diretório a criar:** `src/views/redesign/history/`

### Arquivos NÃO tocados (NUNCA)

- `src/views/HealthHistory.jsx` (view original)
- `src/views/HealthHistory.css` (estilos originais)
- `src/shared/components/ui/Calendar.jsx`
- `src/shared/components/ui/CalendarWithMonthCache.jsx`
- `src/shared/components/log/LogEntry.jsx`
- `src/shared/components/log/LogForm.jsx`
- `src/shared/components/ui/Modal.jsx`
- `src/shared/components/ui/FloatingActionButton.jsx`
- `src/features/dashboard/components/SparklineAdesao.jsx`
- `src/features/adherence/components/AdherenceHeatmap.jsx`
- `src/services/api/adherenceService.js`
- `src/shared/services/api/logService.js`
- `src/shared/services/cachedServices.js`
- `src/features/dashboard/hooks/useComplexityMode.js`
- `src/App.jsx` (rota já existe e já renderiza HealthHistoryRedesign quando redesign ativo)

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| LogEntry.jsx não renderiza bem dentro do Day Panel | Baixa | Médio | CSS overrides scoped (`.hhr-day-panel .log-entry`) |
| Calendar.jsx props incompatíveis | Baixa | Alto | Props documentadas e testadas na Wave 9 |
| Performance com mês de muitas doses (100+) | Baixa | Baixo | dayLogs filtra apenas o dia (max ~10-20 doses/dia) |
| useComplexityMode requer DashboardProvider | Nenhuma | — | DashboardProvider já wrapa toda a app |
| Sparkline/Heatmap não carregam (lazy) | Baixa | Baixo | Suspense fallback garante UI estável |
| CSS conflicts com HealthHistory.css original | Baixa | Médio | Escopo via `.hhr-view` (redesign) vs `.health-history-view` (original) |

---

## FAQ para o Agente Executor

**P: Preciso modificar o App.jsx?**
R: NÃO. A rota `history` já renderiza `HealthHistoryRedesign` quando redesign está ativo. O rewrite do componente é transparente para o App.jsx.

**P: Posso usar `CalendarWithMonthCache` ao invés de `Calendar`?**
R: NÃO. `CalendarWithMonthCache` é um wrapper deprecated que só redireciona para `Calendar`. Importe `Calendar` diretamente de `@shared/components/ui/Calendar`.

**P: Preciso instalar alguma dependência nova?**
R: NÃO. Todos os componentes e services já existem. Nenhum `npm install` necessário.

**P: Posso usar `import Loading from '@shared/components/ui/Loading'` para o loading state?**
R: Pode, mas a spec define um spinner inline mais leve (`.hhr-loading`). Usar o spinner inline é preferível para evitar o salto visual do componente Loading completo.

**P: O `logService.getByMonthSlim` retorna que campos?**
R: Retorna objetos com campos reduzidos (slim): `id`, `taken_at`, `quantity_taken`, `notes`, `medicine` (join: `{name}`), `protocol` (join: `{name}`). Suficiente para o Day Panel e o calendário.

**P: O que acontece se `stats` ou `adherenceSummary` estão null?**
R: Os KPI cards usam `stats?.score ?? 0` e `stats?.currentStreak ?? 0` com fallback para 0. Isso é safe para o carregamento inicial.

**P: E se o usuário mudar de modo complex → simple enquanto a página está aberta?**
R: O `isComplex` recalcula, os blocos condicionais removem sparkline/heatmap do DOM. Os dados carregados ficam no state mas não causam problemas (são ignorados). Na próxima vez que o usuário abrir History em modo simple, a Phase 2 não executa (economia de queries).

**P: Devo criar testes unitários?**
R: NÃO nesta wave. Testes serão avaliados após validação manual da 10C completa. Os componentes reutilizados (Calendar, LogEntry, etc.) já têm cobertura.

**P: O arquivo `HealthHistoryRedesign.css` antigo será deletado. E se alguém ainda importa?**
R: VERIFICAR com `grep -r "HealthHistoryRedesign.css" src/` antes de deletar. O único lugar que importava era o antigo `HealthHistoryRedesign.jsx`, que agora é reescrito e importa `./history/HistoryRedesign.css`.
