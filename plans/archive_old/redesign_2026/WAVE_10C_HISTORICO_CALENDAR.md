# Wave 10C — Histórico Calendar-Driven: Navegação por Calendário + Painel de Doses

**Status:** ✅ ENTREGUE — PR #437
**Data de criação da spec:** 2026-03-27
**Data de entrega:** 2026-03-28
**Dependências:** W0-W9 ✅ + W10A (Settings Extraction) + W10B (Profile Hub)
**Risco original:** ALTO — rewrite completo do HealthHistoryRedesign + arquitetura de dose global
**Branch:** `feature/redesign/wave-10c-historico-calendar`
**Master doc:** `WAVE_10_PERFIL_HISTORICO_SETTINGS.md`

---

## Por que esta sub-wave existe

O HealthHistory atual usa scroll infinito (Virtuoso) para listar doses. Com milhares de registros, a usabilidade degrada: o usuário não encontra facilmente "o que aconteceu em tal dia", precisa scrollar indefinidamente, e a performance cai.

O paradigma **calendar-driven** torna o calendário (que já existe como acessório) o **controle principal de navegação**. O fluxo passa a ser:

```
Selecionar mês → Clicar dia no calendário → Ver doses daquele dia → Clicar dose → Editar/Deletar
```

Isso resolve 3 problemas:
1. **Navegação:** O calendário dá orientação temporal imediata (vs. scroll infinito sem âncora)
2. **Performance:** Dados carregados por mês (1 query por mês, ~30-100 registros) vs. paginação global
3. **UX:** Responde à pergunta "o que aconteceu em tal dia?" com 2 cliques

---

## O que esta wave FAZ (entregue)

- Reescreveu `src/views/redesign/HealthHistoryRedesign.jsx` — de wrapper CSS para componente completo e independente
- Criou `src/views/redesign/history/HistoryKPICards.jsx` — KPI cards (adesão, sequência, doses/mês)
- Criou `src/views/redesign/history/HistoryDayPanel.jsx` — painel de doses do dia selecionado
- Criou `src/views/redesign/history/HistoryLogCard.jsx` — card de dose customizado (substitui LogEntry no contexto do histórico)
- Criou `src/views/redesign/history/HistoryRedesign.css` — CSS completo dedicado
- Criou `src/shared/components/ui/GlobalDoseModal.jsx` — modal global de dose disponível em todas as views
- Integrou `useComplexityMode` para mostrar/ocultar gráficos avançados (sparkline + heatmap)
- Reutilizou componentes existentes: `Calendar.jsx`, `LogForm.jsx`, `Modal.jsx`, `SparklineAdesao.jsx`, `AdherenceHeatmap.jsx`
- Eliminou dependência de `react-virtuoso` no redesign (o import de Virtuoso fica APENAS no `HealthHistory.jsx` original)
- Expandiu `logService.getByMonthSlim` para incluir `protocol_id`, `protocol(id, name)` e `medicine(dosage_per_pill, dosage_unit)`
- Melhorou `Calendar.css`: `has-log` de 5% → 15% opacity (visibilidade no tema Santuário)
- Adicionou botão "Registrar Dose" na Sidebar (desktop, todas as views)
- Adicionou FAB mobile "+ Dose" em `App.jsx` (visível apenas `< 768px`, todas as views)

## O que esta wave NÃO FAZ

- ❌ NÃO toca em `src/views/HealthHistory.jsx` (view original intacta — continua com Virtuoso)
- ❌ NÃO toca em `src/views/HealthHistory.css` (estilos originais intactos)
- ❌ NÃO modifica `LogEntry.jsx`, `LogForm.jsx`, `SparklineAdesao.jsx` ou `AdherenceHeatmap.jsx`
- ❌ NÃO implementa filtros por medicamento (desnecessários sem listagem infinita)
- ❌ NÃO implementa exportação/compartilhamento (vive no Perfil)
- ❌ NÃO altera banco de dados ou schemas

---

## Ajustes realizados durante execução (vs. spec original)

| Spec original | Entregue | Motivo |
|---------------|----------|--------|
| `FloatingActionButton` local na HistoryRedesign | FAB removido da view — modal de nova dose via `GlobalDoseModal` (global) | Botão de registrar dose deve estar disponível em todas as views, não só no histórico |
| `LogEntry` dentro do `HistoryDayPanel` | `HistoryLogCard` customizado | Precisávamos de layout diferente: horário, dosagem (mg), protocolo, quantidade — sem badge "Tomado" e sem data |
| Sidebar com "Adicionar Med." | Sidebar com "Registrar Dose" | Ação mais relevante para o fluxo diário; "Adicionar Med." é ação rara |
| `App.jsx` intocado | `App.jsx` recebe `isDoseModalOpen` state + `GlobalDoseModal` lazy + FAB mobile | Necessário para arquitetura de dose global |
| `treatmentPlans` derivado de `protocols` (apenas IDs) | `treatmentPlans` buscado via `cachedTreatmentPlanService.getAll()` | O `LogForm` precisa de objetos completos `{id, name, protocols:[...]}` para exibir nome do plano e contar remédios |
| `logService.getByMonthSlim` intocado | Expandido para incluir `protocol_id`, `protocol(id,name)`, `medicine(dosage_per_pill, dosage_unit)` | Necessário para pré-popular o `LogForm` na edição (protocolo estava vazio) e para exibir dosagem no card |
| Classes CSS do calendário BEM-style | Classes reais do `Calendar.jsx` (`.calendar-day.has-log`, `.calendar-day.selected`, `.calendar-day.today`) | Bug: spec usava BEM errado que não correspondia às classes reais do componente |
| `hhr-section-title` com uppercase + opacity 0.6 | Mesmo estilo do `hhr-day-panel__title` (TitleCase, weight 700, sem uppercase) | Consistência visual — seções de gráfico e painel de doses devem ter o mesmo nível hierárquico |
| `dayLogs` sem ordenação explícita | `dayLogs` ordenados ascendente por `taken_at` | Histórico do dia faz mais sentido cronológico (manhã → noite) |
| Sem botão "← Voltar" | Botão "← Voltar" no header → `onNavigate('profile')` | Histórico é acessado via Perfil; usuário precisa de caminho de volta |
| Tooltip sparkline sem override | `font-size: 10px` via `.hhr-view .sparkline-tooltip-*` | Tooltip estava cortando texto por font-size grande demais no box fixo |

---

## Arquitetura de Componentes (entregue)

```
App.jsx
├── Sidebar.jsx — botão "Registrar Dose" no footer (desktop, todas as views)
│   └── GlobalDoseModal [state: isDoseModalOpen]
├── FAB ".doseFab" — mobile "+ Dose" (< 768px, todas as views)
└── GlobalDoseModal.jsx (lazy, dentro DashboardProvider)
    ├── useDashboard() — protocols, refresh
    ├── cachedTreatmentPlanService.getAll() — planos completos
    ├── LogForm.jsx — formulário de criação
    └── dispara evento 'mr:dose-saved' após salvar

HealthHistoryRedesign.jsx (REWRITE — componente principal)
├── HistoryKPICards.jsx (NOVO — 3 KPI cards)
├── Calendar.jsx (EXISTENTE — src/shared/components/ui/Calendar.jsx)
├── HistoryDayPanel.jsx (NOVO — doses do dia selecionado)
│   └── HistoryLogCard.jsx (NOVO — card customizado: horário, dosagem, protocolo, qtd)
├── SparklineAdesao.jsx (EXISTENTE — lazy, complex only)
├── AdherenceHeatmap.jsx (EXISTENTE — lazy, complex only)
└── Modal > LogForm (EXISTENTES — somente edição de dose existente)
```

**Evento global:** `window.dispatchEvent(new CustomEvent('mr:dose-saved'))` — disparado pelo `GlobalDoseModal` após salvar. `HealthHistoryRedesign` escuta esse evento e chama `loadData()` para recarregar o mês.

---

## Sprints

### S10C.1 — HealthHistoryRedesign.jsx: Rewrite Completo

**Arquivo:** `src/views/redesign/HealthHistoryRedesign.jsx`
**Ação:** REWRITE (substituiu conteúdo — era wrapper CSS, agora é componente full)

#### Props

```jsx
/**
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback de navegação (para 'profile', etc.)
 */
export default function HealthHistoryRedesign({ onNavigate })
```

#### Imports

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
import HistoryKPICards from './history/HistoryKPICards'
import HistoryDayPanel from './history/HistoryDayPanel'
import './history/HistoryRedesign.css'

// Lazy: só carrega em modo complex
const SparklineAdesao = lazy(() => import('@dashboard/components/SparklineAdesao'))
const AdherenceHeatmap = lazy(() => import('@adherence/components/AdherenceHeatmap'))
```

**NÃO importar:**
- ❌ `FloatingActionButton` — substituído pelo `GlobalDoseModal` global
- ❌ `Virtuoso` — proibido no redesign
- ❌ `'./HealthHistoryRedesign.css'` — arquivo antigo deletado

#### State

```jsx
// ═══ States ═══
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState(null)
const [successMessage, setSuccessMessage] = useState('')
const [isModalOpen, setIsModalOpen] = useState(false)    // apenas edição de dose existente
const [editingLog, setEditingLog] = useState(null)
const [selectedDate, setSelectedDate] = useState(new Date())
const [currentMonthLogs, setCurrentMonthLogs] = useState([])
const [, setTotalLogs] = useState(0)                     // mantido para setTotalLogs no delete otimista

// Dados para modo complex (sparkline + heatmap)
const [dailyAdherence, setDailyAdherence] = useState([])
const [adherencePattern, setAdherencePattern] = useState(null)

// ═══ Context ═══
const { protocols, stats, refresh } = useDashboard()
const { mode: complexityMode } = useComplexityMode()
const isComplex = complexityMode === 'complex'

// ═══ Refs ═══
const patternLoadedRef = useRef(false)
```

**States que NÃO existem:**
- ❌ `timelineLogs` / `timelineHasMore` / `timelineOffset` / `isLoadingMore` — sem scroll infinito
- ❌ `isLoadingPatterns` / `observerRef` — sem IntersectionObserver

#### Memos

```jsx
// Planos de tratamento (para LogForm de edição — apenas IDs para derivar)
// NOTA: GlobalDoseModal usa cachedTreatmentPlanService.getAll() para nova dose
const treatmentPlans = useMemo(() => {
  const planMap = new Map()
  protocols.forEach((p) => {
    if (p.treatment_plan_id) {
      planMap.set(p.treatment_plan_id, true)
    }
  })
  return Array.from(planMap.keys())
}, [protocols])

// Doses do dia selecionado — filtradas dos logs do mês, ordenadas ascendente
const dayLogs = useMemo(() => {
  const d = selectedDate || new Date()
  return currentMonthLogs
    .filter((log) => {
      const logDate = new Date(log.taken_at)
      return (
        logDate.getFullYear() === d.getFullYear() &&
        logDate.getMonth() === d.getMonth() &&
        logDate.getDate() === d.getDate()
      )
    })
    .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at))
}, [currentMonthLogs, selectedDate])

// Datas marcadas no calendário (array de strings 'YYYY-MM-DD')
const markedDates = useMemo(
  () => currentMonthLogs.map((log) => formatLocalDate(new Date(log.taken_at))),
  [currentMonthLogs]
)

// Contadores do mês (para KPI "Doses este Mês")
const dosesThisMonth = useMemo(() => currentMonthLogs.length, [currentMonthLogs])
```

#### Effects

```jsx
// Carregamento inicial
const loadData = useCallback(async () => {
  try {
    setIsLoading(true)
    setError(null)
    const now = new Date()

    // Phase 1: UI-critical — logs do mês atual
    const logsResult = await logService.getByMonthSlim(now.getFullYear(), now.getMonth())
    setCurrentMonthLogs(logsResult.data || [])
    setTotalLogs(logsResult.total || 0)

    if (logsResult.data?.length > 0) {
      setSelectedDate(new Date(logsResult.data[0].taken_at))
    }

    setIsLoading(false)  // UI interativa aqui

    // Phase 2: Deferred (complex only) via requestIdleCallback
    if (isComplex) {
      const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))
      scheduleIdle(async () => {
        // sparkline
        try {
          const daily = await adherenceService.getDailyAdherenceFromView(90)
          setDailyAdherence(daily)
        } catch (err) { ... }

        // heatmap (carrega direto, sem IntersectionObserver)
        if (!patternLoadedRef.current) {
          try {
            const pattern = await adherenceService.getAdherencePatternFromView()
            setAdherencePattern(pattern)
            patternLoadedRef.current = true
          } catch (err) { ... }
        }
      })
    }
  } catch (err) {
    setError('Erro ao carregar dados: ' + err.message)
    setIsLoading(false)
  }
}, [isComplex])

useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  loadData()
}, [loadData])

// Escuta evento global de dose salva (GlobalDoseModal) para recarregar
useEffect(() => {
  const handleDoseSaved = () => loadData()
  window.addEventListener('mr:dose-saved', handleDoseSaved)
  return () => window.removeEventListener('mr:dose-saved', handleDoseSaved)
}, [loadData])
```

#### JSX — Render

```jsx
if (isLoading) { /* spinner */ }

return (
  <div className="hhr-view">
    {/* Header com botão ← Voltar */}
    <div className="hhr-header">
      {onNavigate && (
        <button className="hhr-back-btn" onClick={() => onNavigate('profile')}>
          ← Voltar
        </button>
      )}
      <h1 className="hhr-header__title">Histórico de Doses</h1>
      <p className="hhr-header__subtitle">...</p>
    </div>

    {/* Banners de feedback */}
    {successMessage && <div className="hhr-banner hhr-banner--success">...</div>}
    {error && <div className="hhr-banner hhr-banner--error">...</div>}

    {/* KPI Cards */}
    <HistoryKPICards
      adherenceScore={stats?.score ?? 0}
      currentStreak={stats?.currentStreak ?? 0}
      dosesThisMonth={dosesThisMonth}
    />

    {/* Calendário + Painel do Dia (flex, align-items: stretch) */}
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

    {/* Sparkline 30d (complex only) */}
    {isComplex && dailyAdherence.length > 0 && (
      <div className="hhr-chart-card">
        <h3 className="hhr-section-title">Adesão 30 Dias</h3>
        <Suspense fallback={<div className="hhr-chart-skeleton" />}>
          <SparklineAdesao adherenceByDay={dailyAdherence} size="expanded" />
        </Suspense>
      </div>
    )}

    {/* Heatmap (complex only) */}
    {isComplex && adherencePattern && (
      <div className="hhr-chart-card">
        <h3 className="hhr-section-title">Padrão por Período</h3>
        <Suspense fallback={<div className="hhr-chart-skeleton" />}>
          <AdherenceHeatmap pattern={adherencePattern} />
        </Suspense>
      </div>
    )}

    {/* SEM FAB — dose global via GlobalDoseModal em App.jsx */}

    {/* Modal — apenas edição de dose existente */}
    <Modal isOpen={isModalOpen} onClose={...}>
      <LogForm
        protocols={protocols}
        treatmentPlans={treatmentPlans}
        initialValues={editingLog}
        onSave={handleLogMedicine}
        onCancel={...}
      />
    </Modal>
  </div>
)
```

---

### S10C.2 — HistoryKPICards.jsx

**Arquivo:** `src/views/redesign/history/HistoryKPICards.jsx`

#### Props

```jsx
/**
 * @param {number} props.adherenceScore - Percentual de adesão (0-100), de stats.score
 * @param {number} props.currentStreak - Sequência atual em dias, de stats.currentStreak
 * @param {number} props.dosesThisMonth - Total de doses registradas no mês selecionado
 */
export default function HistoryKPICards({ adherenceScore, currentStreak, dosesThisMonth })
```

**REMOVIDA em relação à spec original:** `totalExpectedThisMonth` — prop não utilizada no render.

3 cards: Adesão (30 dias)% · Sequência Atual (dias) · Doses este Mês.

---

### S10C.3 — HistoryDayPanel.jsx

**Arquivo:** `src/views/redesign/history/HistoryDayPanel.jsx`

Painel que exibe as doses do dia selecionado. Quando o usuário clica em um dia no calendário, lista os `dayLogs` com `HistoryLogCard` (não mais `LogEntry`).

#### Props

```jsx
/**
 * @param {Date} props.selectedDate - Data selecionada no calendário
 * @param {Array} props.dayLogs - Logs do dia: { id, taken_at, quantity_taken, medicine, protocol }
 *   Cada log inclui medicine.dosage_per_pill e medicine.dosage_unit (expandido em getByMonthSlim)
 * @param {Function} props.onEditLog - onEditLog(log) → abre modal de edição
 * @param {Function} props.onDeleteLog - onDeleteLog(id) → deleta do state do pai
 */
```

**Mudança vs. spec original:** usa `HistoryLogCard` em vez de `LogEntry`.

---

### S10C.4 — HistoryLogCard.jsx (NOVO — não estava na spec original)

**Arquivo:** `src/views/redesign/history/HistoryLogCard.jsx`

Card de dose customizado para o painel do histórico. Criado porque `LogEntry` não era modificável e o layout precisava ser diferente.

#### Props

```jsx
/**
 * @param {Object} props.log - { id, taken_at, quantity_taken, medicine: { name, dosage_per_pill, dosage_unit }, protocol: { name } }
 * @param {Function} props.onEdit - onEdit(log)
 * @param {Function} props.onDelete - onDelete(id)
 */
```

#### Layout de 3 linhas

```
Ansitec (10mg)        14:30
Ansiolítico
1 comprimido          [✏️] [🗑️]
```

- **Linha 1:** nome do medicamento + pílula de dosagem (`medicine.dosage_per_pill + dosage_unit`, ex: `10mg`)
- **Linha 2:** nome do protocolo (se existir), `opacity: 0.5`
- **Linha 3:** quantidade tomada (`quantity_taken + "comprimido(s)"`)
- **Horário:** `taken_at` formatado como HH:MM, alinhado à direita
- **Ações:** `PencilLine` + `Trash2` de `lucide-react`, alinhadas à direita abaixo

**Diferente do LogEntry:** sem badge "Tomado", sem data (só horário), sem confirmação inline de delete (pai lida via callback).

---

### S10C.5 — GlobalDoseModal.jsx (NOVO — não estava na spec original)

**Arquivo:** `src/shared/components/ui/GlobalDoseModal.jsx`

Modal global de registro de dose, disponível em todas as views via `App.jsx`. Resolve o problema de o botão "Registrar Dose" precisar estar acessível independente da view ativa.

#### Arquitetura

- Renderizado **dentro** do `DashboardProvider` para acessar `useDashboard()`
- Lazy-loaded: só carrega quando `isDoseModalOpen === true`
- Busca `treatmentPlans` via `cachedTreatmentPlanService.getAll()` ao abrir (objetos completos com `name` e `protocols`)
- Após salvar: chama `refresh()` + dispara `window.dispatchEvent(new CustomEvent('mr:dose-saved'))`

#### Props

```jsx
/**
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 */
```

#### Integração em App.jsx

```jsx
// State (em AppInner)
const [isDoseModalOpen, setIsDoseModalOpen] = useState(false)

// Sidebar (desktop)
<Sidebar onNewDose={() => setIsDoseModalOpen(true)} ... />

// FAB mobile (todas as views, < 768px via CSS)
<button className={appStyles.doseFab} onClick={() => setIsDoseModalOpen(true)}>
  + Dose
</button>

// Modal (lazy, dentro DashboardProvider)
{isDoseModalOpen && (
  <Suspense fallback={null}>
    <GlobalDoseModal isOpen={isDoseModalOpen} onClose={() => setIsDoseModalOpen(false)} />
  </Suspense>
)}
```

---

### S10C.6 — HistoryRedesign.css

**Arquivo:** `src/views/redesign/history/HistoryRedesign.css`
**Arquivo deletado:** `src/views/redesign/HealthHistoryRedesign.css` (substituído)

#### Blocos CSS e correções vs. spec original

| Bloco | Nota |
|-------|------|
| `.hhr-back-btn` | NOVO — botão "← Voltar" no header |
| `.hhr-calendar-section` | `align-items: stretch` — ambos os cards crescem igualmente em altura |
| `.hhr-calendar-card` | `display: flex; flex-direction: column` — permite que calendário ocupe altura total |
| `.hhr-day-panel` | `display: flex; flex-direction: column` — sem `max-height` global; overflow no `__list` |
| `.hhr-day-panel__list` | `max-height: 360px; overflow-y: auto` — scroll apenas na lista, não no card inteiro |
| `.hhr-section-title` | `font-size: 1rem; font-weight: 700` — sem `text-transform: uppercase` nem `opacity: 0.6` — mesmo estilo do `.hhr-day-panel__title` |
| `.hlc-card*` | NOVO — todos os estilos do `HistoryLogCard` |
| `.hlc-card__dosage-pill` | Pill de dosagem ao lado do nome (`10mg`, `500mg`) |
| `.hlc-card__quantity` | Terceira linha ("1 comprimido") |
| Calendar overrides | Classes corretas: `.calendar-day.has-log`, `.calendar-day.selected`, `.calendar-day.today` (NÃO BEM-style como estava na spec original) |
| Sparkline tooltip | `.hhr-view .sparkline-tooltip-date, .hhr-view .sparkline-tooltip-value { font-size: 10px !important }` |
| `.hhr-view .calendar-day.has-log` | `background: color-mix(in srgb, var(--color-primary) 20%, transparent)` — contraste legível no tema Santuário |

---

### S10C.7 — logService.getByMonthSlim: Expansão do Select

**Arquivo:** `src/shared/services/api/logService.js`

**Mudança:** Expandido o select do método `getByMonthSlim` para incluir dados necessários ao `HistoryLogCard` e ao `LogForm` na edição.

```js
// Antes
id, taken_at, quantity_taken, medicine_id,
medicine:medicines(id, name)

// Depois
id, taken_at, quantity_taken, medicine_id, protocol_id,
medicine:medicines(id, name, dosage_per_pill, dosage_unit),
protocol:protocols(id, name)
```

**Motivo:** Sem `protocol_id` + `protocol`, o `LogForm` não conseguia pré-popular o protocolo ao editar uma dose. Sem `dosage_per_pill` + `dosage_unit`, o `HistoryLogCard` não conseguia exibir a pílula de dosagem.

**Impacto no payload:** ~80 bytes/log → ~140 bytes/log (estimado). Aceitável dado o volume típico (~30-100 logs/mês).

---

### S10C.8 — Calendar.css: Melhoria de Contraste

**Arquivo:** `src/shared/components/ui/Calendar.css`

```css
/* Antes — quase invisível no tema Santuário (fundo claro) */
.calendar-day.has-log {
  background: rgba(0, 255, 136, 0.05);
}

/* Depois — visível em ambos os temas */
.calendar-day.has-log {
  background: rgba(0, 255, 136, 0.15);
  box-shadow: 0 0 0 1px rgba(0, 255, 136, 0.2);
}
```

O override no escopo `.hhr-view` (em `HistoryRedesign.css`) usa `color-mix` com `--color-primary` para ainda mais contraste no contexto do Santuário.

---

### S10C.9 — Sidebar.jsx + App.module.css: Dose Global

**Sidebar.jsx:**
- Nova prop `onNewDose` (Function)
- Botão footer mudou de `onClick={() => setCurrentView('medicines')}` → `onClick={onNewDose}`
- Label: "Adicionar Med." → "Registrar Dose"

**App.module.css:**
- `.doseFab`: FAB pill centralizado horizontalmente, gradiente primário, `display: none` por padrão, `display: flex` em `@media (max-width: 767px)`

---

## Referência Visual

**Desktop:** KPI cards no topo → Calendário (flex: 1) + Painel do Dia (flex: 0 0 340px) lado a lado → Sparkline (complex) → Heatmap (complex)

**Mobile:** Stack vertical — KPI cards → Calendário full width → Painel do Dia → Sparkline → Heatmap. FAB "+ Dose" centralizado acima do BottomNav.

**≥ 1200px:** Day panel expande para 400px; view max-width 1100px.

---

## Checklist de Validação Manual

- [ ] Calendário: dias com dose marcados com destaque visível (verde ~20% no Santuário)
- [ ] Clique no dia → HistoryLogCard com horário, dosagem (mg), protocolo e quantidade
- [ ] Navegar entre meses → calendário recarrega, primeiro dia com dose selecionado
- [ ] Botão "← Voltar" navega para perfil
- [ ] Editar dose → protocolo pré-populado corretamente no LogForm
- [ ] Deletar dose → remove otimisticamente do state local
- [ ] Botão "Registrar Dose" na sidebar (desktop) → GlobalDoseModal com planos corretos (nome + qtd de remédios)
- [ ] FAB "+ Dose" no mobile (< 768px) → mesmo modal
- [ ] Após salvar no GlobalDoseModal → histórico recarrega automaticamente
- [ ] Modo complex: sparkline 30d e heatmap carregam via requestIdleCallback
- [ ] Tooltip sparkline: texto legível sem overflow
