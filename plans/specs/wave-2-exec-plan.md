# Plano — Wave 2: Lógica e Hooks

## Contexto

Onda 1 concluída (PR #237, merged). Onda 2 entrega a lógica por trás dos componentes visuais: hooks de classificação temporal (useDoseZones), complexidade adaptativa (useComplexityMode), e os componentes de UI que os consomem — culminando na integração de tudo no Dashboard.jsx, substituindo as seções de tratamento pelo novo sistema de zonas temporais.

**Pré-requisito:** Quality Gate 1 passou (Onda 1 concluída). Spec completa: `plans/specs/wave-2-logic-hooks.md`.

---

## Ordem de Execução (menor → maior risco)

| # | Task | Arquivo(s) | Dep |
|---|------|------------|-----|
| 1 | W2-02 | `src/features/dashboard/hooks/useComplexityMode.js` | nenhuma |
| 2 | W2-01 | `src/features/dashboard/hooks/useDoseZones.js` | useDashboard |
| 3 | W2-05 | `src/features/dashboard/components/PlanBadge.jsx` + CSS | nenhuma |
| 4 | W2-04 | `src/features/dashboard/components/ViewModeToggle.jsx` + CSS | nenhuma |
| 5 | W2-06 | `src/features/dashboard/components/BatchRegisterButton.jsx` + CSS | nenhuma |
| 6 | W2-07 | `src/features/dashboard/components/AdaptiveLayout.jsx` + CSS | nenhuma |
| 7 | W2-03 | `src/features/dashboard/components/DoseZoneList.jsx` + CSS | W2-01, W2-05, W2-04, W2-06 |
| 8 | W2-08 | `src/views/Dashboard.jsx` (RingGauge) | W1-01, W2-02 |
| 9 | W2-09 | `src/views/Dashboard.jsx` (StockBars) | W1-02 |
| 10 | W2-10 | `src/views/Dashboard.jsx` (DoseZoneList) | W2-03, W2-07, W2-01, W2-02, W2-04 |

---

## Detalhes Críticos por Task

### W2-02: useComplexityMode
**Arquivo:** `src/features/dashboard/hooks/useComplexityMode.js`

- Importa `useDashboard()` para `medicines` e `protocols`
- `overrideMode` state: `localStorage.getItem(STORAGE_KEY)` no initializer, com guarda `process.env.NODE_ENV !== 'test'`
- `activeMedicines`: medicines com ao menos 1 protocolo ativo (join por medicine_id)
- Thresholds: <=3 → simple | <=6 → moderate | 7+ → complex
- Derivados: `ringGaugeSize` (large/medium/compact) e `defaultViewMode` (time/plan)
- `setOverride(null)` limpa o override
- Testes: 8 it() (spec completa), mock de `useDashboardContext.jsx`

### W2-01: useDoseZones
**Arquivo:** `src/features/dashboard/hooks/useDoseZones.js`

- Importa `useDashboard()` → `protocols`, `logs`
- `now` state: `new Date()` no mount, recalcula via `setInterval(60_000)` — cleanup no return
- Expande `time_schedule[]` → DoseItems (skip `frequency === 'quando_necessario'`)
- `isDoseRegistered(protocolId, time, todayLogs)`: filtra logs de hoje, tolerância ±30min
- `classifyDose(scheduledTime, now, lateWindow, nowWindow, upcomingWindow, isRegistered)`:
  - isRegistered → 'done'
  - diffMin < -lateWindow(120) → null (não mostrar)
  - diffMin < 0 → 'late'
  - diffMin < nowWindow(60) → 'now'
  - diffMin < upcomingWindow(240) → 'upcoming'
  - else → 'later'
- todayLogs: filtrar `logs` onde `taken_at` é de hoje (`parseLocalDate(getTodayLocal())`)
- Retorna: `{ zones: {late, now, upcoming, later, done}, totals: {expected, taken, pending}, isLoading, refresh }`
- Testes: vi.useFakeTimers() obrigatório, 13 it() (spec completa)

### W2-05: PlanBadge
**Arquivo:** `src/features/dashboard/components/PlanBadge.jsx`

Props: `emoji`, `color`, `planName?`, `size='sm'|'md'`, `onClick?`.
CSS `--badge-color`, `color-mix()` com `@supports not` fallback (R-097).
Testes: 6 it().

### W2-04: ViewModeToggle
Controlled component. Props: `mode`, `onChange`, `hasTreatmentPlans`.
Retorna `null` quando `!hasTreatmentPlans`. `aria-pressed` em cada botão. Sem estado interno.
Testes: 5 it().

### W2-06: BatchRegisterButton
Retorna `null` quando `pendingCount === 0`.
`motion.button` com `whileTap={{ scale: 0.97 }}`.
Props: `pendingCount`, `label`, `onClick`, `disabled?`, `variant='primary'|'outline'`.

### W2-07: AdaptiveLayout
Wrapper simples. CSS cascata afeta `.dose-card` e `.zone-header` filhos. Testes: 4 it().

### W2-03: DoseZoneList
**Arquivo:** `src/features/dashboard/components/DoseZoneList.jsx`

Estado interno: `expandedZones` (Set<string>) com defaults da spec.
Zonas vazias não renderizam.

**Modo time (⏰ Hora):** lista flat de DoseCards por zona. BatchRegisterButton na zona 'now'.
DoseCard interno (não necessita ser componente separado): `scheduledTime` | `medicineName` + `PlanBadge` (se pertence a plano) | `dosagePerIntake` | checkbox de seleção | botão de registrar / SwipeRegisterItem.

**Modo plan (📋 Plano):** dentro de cada zona, agrupar por `treatmentPlanId`, renderizar `TreatmentAccordion` existente para cada grupo (com `SwipeRegisterItem` como children), avulsos (sem plano) ao final como lista flat. O accordion funciona exatamente como antes.

**Princípio-chave:** accordion, swipe e lote são PRESERVADOS — só a organização ao redor muda. Em modo time, o PlanBadge fornece o contexto do plano. Em modo plan, o accordion fornece a estrutura visual agrupada.

**Animações:** `AnimatePresence` para expand/collapse zonas, stagger `0.03` por item.

**Props:**
```
zones, totals, viewMode, complexityMode,
onRegisterDose(protocolId, dosagePerIntake),
onBatchRegister(doseItems[]),
onToggleSelection(protocolId, scheduledTime),
selectedDoses: Set<string>
```

Testes: 9 it() (spec completa). Mock de useDoseZones não necessário (recebe dados via props).

---

### W2-08: Dashboard — RingGauge (EDITAR)
Mudanças mínimas em `src/views/Dashboard.jsx` (≤15 linhas):

```javascript
// Novo import
import RingGauge from '@dashboard/components/RingGauge'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'

// Adicionar hook ANTES dos states (seguir hook order: hooks → states → memos)
const { ringGaugeSize } = useComplexityMode()

// Substituir HealthScoreCard no JSX
<RingGauge
  score={stats.score}
  streak={stats.currentStreak}
  trend={trend}
  trendPercentage={percentage}
  size={ringGaugeSize}
  sparklineData={dailyAdherence}
  onClick={() => setIsHealthDetailsOpen(true)}
/>
```

Manter `import HealthScoreCard` (não remover ainda).

---

### W2-09: Dashboard — StockBars (EDITAR, ≤25 linhas)
```javascript
import StockBars from '@dashboard/components/StockBars'

// Memo após stockSummary
const stockBarsItems = useMemo(() =>
  (stockSummary || []).map(s => ({
    medicineId: s.medicine?.id,
    name: s.medicine?.name || 'Desconhecido',
    currentStock: s.total || 0,
    dailyConsumption: s.dailyIntake || 0,
    daysRemaining: s.daysRemaining || 0,
    level: s.isZero ? 'critical' : s.isLow ? 'low' : s.daysRemaining >= 30 ? 'high' : 'normal',
  })),
  [stockSummary]
)

// JSX após seção de tratamentos
{stockBarsItems.length > 0 && (
  <StockBars
    items={stockBarsItems}
    showOnlyCritical={complexityMode === 'complex'}
    maxItems={complexityMode === 'complex' ? 3 : undefined}
    onItemClick={(medicineId) => onNavigate?.('stock', { medicineId })}
  />
)}
```

Manter `StockAlertsWidget` existente (não remover).

---

### W2-10: Dashboard — DoseZoneList (EDITAR — mais sensível)

**Imports a adicionar:**
```javascript
import DoseZoneList from '@dashboard/components/DoseZoneList'
import AdaptiveLayout from '@dashboard/components/AdaptiveLayout'
import ViewModeToggle from '@dashboard/components/ViewModeToggle'
import { useDoseZones } from '@dashboard/hooks/useDoseZones'
```

**Hooks a adicionar (ANTES dos states — seguir hook order):**
```javascript
const { zones, totals } = useDoseZones()
// useComplexityMode já adicionado em W2-08: const { ringGaugeSize, mode: complexityMode, defaultViewMode } = useComplexityMode()
```

**States a adicionar (junto com outros states):**
```javascript
const [viewMode, setViewMode] = useState(() =>
  localStorage.getItem('mr_view_mode') || defaultViewMode
)
const [selectedDoses, setSelectedDoses] = useState(new Set())
```

**Adapters (junto com handlers existentes):**
```javascript
// Adapter: DoseZoneList chama (protocolId, dosagePerIntake), handleRegisterDose precisa de medicineId
const handleRegisterFromZone = useCallback((protocolId, dosagePerIntake) => {
  const protocol = rawProtocols.find(p => p.id === protocolId)
  if (protocol) handleRegisterDose(protocol.medicine_id, protocolId, dosagePerIntake)
}, [rawProtocols])

// Adapter: DoseZoneList chama com array de DoseItems
const handleBatchRegisterDoses = useCallback(async (doseItems) => {
  try {
    const logsToSave = doseItems.map(d => ({
      protocol_id: d.protocolId,
      medicine_id: d.medicineId,
      quantity_taken: d.dosagePerIntake || 1,
      taken_at: new Date().toISOString(),
    }))
    await logService.createBulk(logsToSave)
    setSelectedDoses(new Set())
    refresh()
  } catch (err) {
    console.error('Erro no registro em lote:', err)
    alert('Erro ao registrar lote. Tente novamente.')
  }
}, [refresh])

const handleToggleDoseSelection = useCallback((protocolId, scheduledTime) => {
  const key = `${protocolId}:${scheduledTime}`
  setSelectedDoses(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })
}, [])
```

**JSX — substituir seções "TRATAMENTO" e "PRÓXIMAS DOSES" por:**
```jsx
<section className={styles.section}>
  <AdaptiveLayout mode={complexityMode}>
    <ViewModeToggle
      mode={viewMode}
      onChange={(m) => { setViewMode(m); localStorage.setItem('mr_view_mode', m) }}
      // UX Vision v0.4: sem toggle em modo simple (pacientes com ≤3 meds)
      hasTreatmentPlans={treatmentPlans.length > 0 && complexityMode !== 'simple'}
    />
    <DoseZoneList
      zones={zones}
      totals={totals}
      viewMode={viewMode}
      complexityMode={complexityMode}
      onRegisterDose={handleRegisterFromZone}
      onBatchRegister={handleBatchRegisterDoses}
      onToggleSelection={handleToggleDoseSelection}
      selectedDoses={selectedDoses}
    />
  </AdaptiveLayout>
</section>
```

**Guardrails W2-10:**
- `treatmentPlans` memo permanece (usado pelo DoseZoneList modo plan para agrupar)
- `standaloneProtocols` memo permanece (pode ser usado pelo DoseZoneList modo time)
- `selectedMedicines` e `toggleMedicineSelection` ficam (usados pelo TreatmentAccordion interno ao DoseZoneList modo plan)
- `handleBatchRegister(plan, selectedIds)` permanece para uso pelo TreatmentAccordion
- `complexityMode` no W2-09 JSX: extrair de `useComplexityMode()` que já foi chamado em W2-08
- Accordion + Swipe + Lote são PRESERVADOS — reorganizados dentro de DoseZoneList, não removidos (Princípio 2 da visão)

---

## Arquivos a Criar/Modificar

| Ação | Arquivo |
|------|---------|
| Criar | `src/features/dashboard/hooks/useComplexityMode.js` |
| Criar | `src/features/dashboard/hooks/useDoseZones.js` |
| Criar | `src/features/dashboard/components/PlanBadge.jsx` + `.css` |
| Criar | `src/features/dashboard/components/ViewModeToggle.jsx` + `.css` |
| Criar | `src/features/dashboard/components/BatchRegisterButton.jsx` + `.css` |
| Criar | `src/features/dashboard/components/AdaptiveLayout.jsx` + `.css` |
| Criar | `src/features/dashboard/components/DoseZoneList.jsx` + `.css` |
| Criar | 7 arquivos de teste correspondentes |
| Editar | `src/views/Dashboard.jsx` (3x: W2-08, W2-09, W2-10) |
| Editar | `plans/EXEC_SPEC_UX_EVOLUTION.md` (status Onda 2) |

---

## Decisões de Arquitetura Documentadas (para agentes futuros)

### D-01: Adapters em vez de refatorar handlers existentes no Dashboard.jsx
**Contexto:** O Dashboard.jsx tem `handleRegisterDose(medicineId, protocolId, quantityTaken)` e `handleBatchRegister(plan, selectedIds)`. O DoseZoneList precisa de `onRegisterDose(protocolId, dosagePerIntake)` e `onBatchRegister(doseItems[])`.

**Decisão:** Criar funções adapter (`handleRegisterFromZone`, `handleBatchRegisterDoses`, `handleToggleDoseSelection`) que chamam os handlers existentes internamente. Os handlers originais NÃO são renomeados ou removidos — o TreatmentAccordion interno ao DoseZoneList ainda os usa via props passadas.

**Alternativa rejeitada:** Refatorar os handlers originais para unificar a interface. Risco alto de regressão em Dashboard.jsx (932 linhas, sem testes de integração).

**Impacto Onda 3:** Em Wave 3, quando o TreatmentAccordion for removido do Dashboard principal (ou reorganizado para a tab Tratamento), os handlers originais podem ser limpos ou unificados com os adapters.

### D-02: Estado `selectedMedicines` com posição irregular no Dashboard.jsx
**Contexto:** O estado `const [selectedMedicines, setSelectedMedicines] = useState({})` está na linha 535, misturado com handlers (após `handleRegisterDose` na linha 519). Viola o padrão "States → Memos → Effects → Handlers".

**Decisão:** NÃO mover em Wave 2 — o risco de quebrar algo em arquivo de 932 linhas sem testes não justifica. Os novos estados (`viewMode`, `selectedDoses`) são adicionados no bloco correto de states (topo do componente). Em Wave 3, quando o Dashboard for substancialmente refatorado, esse estado deve ser movido.

### D-03: `useDashboard()` chamado múltiplas vezes (Dashboard + hooks internos)
**Contexto:** Dashboard.jsx já chama `useDashboard()`. `useComplexityMode` e `useDoseZones` internamente também chamam `useDashboard()`.

**Decisão:** Aceito. React Context pode ser consumido múltiplas vezes — todos obtêm o mesmo objeto. Sem performance penalty (React otimiza re-renders por referência de contexto). Alternativa seria passar os dados via props para os hooks (mas hooks não aceitam props por design).

---

## Processo (mesmo da Onda 1)

1. `git checkout -b feature/wave-2/logic-hooks`
2. Implementar na ordem da tabela — commit atômico por task (W2-NN)
3. `npm run validate:agent` após W2-01, W2-03, W2-10 (tasks mais sensíveis)
4. Atualizar `.memory/` ao final (lições aprendidas)
5. PR + aguardar Gemini review → aplicar sugestões válidas → merge

---

## Verificação

1. `npm run validate:agent` — lint + testes + build (10min kill switch)
2. `npm run test:changed` — testes dos arquivos alterados desde main
3. Smoke manual: zonas de dose no Dashboard, toggle hora/plano funciona, registro de dose funciona
4. `npm run build` sem warnings
