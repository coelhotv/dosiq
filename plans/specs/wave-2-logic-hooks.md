# Specs Atomicas — Onda 2: Logica e Hooks

**Master doc:** [`plans/EXEC_SPEC_UX_EVOLUTION.md`](../EXEC_SPEC_UX_EVOLUTION.md)
**Visao base:** [`plans/UX_VISION_EXPERIENCIA_PACIENTE.md`](../UX_VISION_EXPERIENCIA_PACIENTE.md) v0.5
**Data:** 05/03/2026

**Pre-requisito:** Quality Gate 1 deve ter passado (Onda 1 concluida).

---

## W2-01: Hook useDoseZones()

**Objetivo:** Classificar protocolos ativos em zonas temporais deslizantes relativas ao horario atual (ATRASADAS, AGORA, PROXIMAS, MAIS TARDE, REGISTRADAS).

**Arquivo:** `src/features/dashboard/hooks/useDoseZones.js`
**Deps:** Nenhuma de Onda 1.

**Retorno:**

```javascript
/**
 * @returns {Object} Zonas de doses para o dia atual
 */
{
  zones: {
    late: DoseItem[],        // now - 2h → now (nao registradas)
    now: DoseItem[],         // now → now + 1h
    upcoming: DoseItem[],    // now + 1h → now + 4h
    later: DoseItem[],       // > now + 4h
    done: DoseItem[],        // ja registradas hoje
  },
  totals: {
    expected: number,        // total de doses esperadas hoje
    taken: number,           // total de doses registradas
    pending: number,         // expected - taken
  },
  isLoading: boolean,
  refresh: () => void,
}
```

**Tipo DoseItem:**

```javascript
{
  protocolId: string,
  medicineId: string,
  medicineName: string,
  scheduledTime: string,       // "HH:MM"
  dosagePerIntake: number,     // comprimidos por dose
  treatmentPlanId: string|null,
  treatmentPlanName: string|null,
  planBadge: { emoji: string, color: string } | null,
  isRegistered: boolean,       // se ja tomou esta dose hoje
  registeredAt: string|null,   // ISO timestamp se registrado
}
```

**Parametros do hook:**

```javascript
useDoseZones({
  lateWindowMinutes: 120,     // default 2h (decisao v0.5)
  nowWindowMinutes: 60,       // default 1h
  upcomingWindowMinutes: 240, // default 4h
})
```

**Data flow:**
- Importa `useDashboard()` para obter `protocols` (ativos, com next_dose) e `logs`
- Importa `parseLocalDate` de `@utils/dateUtils` (OBRIGATORIO para datas)
- Calcula "agora" uma vez no mount e recalcula a cada 60 segundos via `setInterval`
- Classifica cada protocolo * horario_do_dia em uma zona

**Algoritmo de classificacao:**

```javascript
import { parseLocalDate } from '@utils/dateUtils'

function classifyDose(scheduledTime, now, lateWindow, nowWindow, upcomingWindow, isRegistered) {
  if (isRegistered) return 'done'

  // scheduledTime e "HH:MM", converter para Date de hoje
  const [hours, minutes] = scheduledTime.split(':').map(Number)
  const scheduled = new Date(now)
  scheduled.setHours(hours, minutes, 0, 0)

  const diffMs = scheduled.getTime() - now.getTime()
  const diffMinutes = diffMs / 60000

  if (diffMinutes < -lateWindow) return null       // muito antiga (>2h atras) — nao mostrar
  if (diffMinutes < 0) return 'late'               // atrasada (0 a -2h)
  if (diffMinutes < nowWindow) return 'now'         // agora (0 a +1h)
  if (diffMinutes < upcomingWindow) return 'upcoming' // proximas (+1h a +4h)
  return 'later'                                     // mais tarde (>4h)
}
```

**Logica para determinar se dose foi registrada:**

```javascript
function isDoseRegistered(protocolId, scheduledTime, todayLogs) {
  // Procura no logs de hoje um registro que combine protocolId + horario
  return todayLogs.some(log =>
    log.protocol_id === protocolId &&
    isSameScheduledTime(log.created_at, scheduledTime)
  )
}

function isSameScheduledTime(logTimestamp, scheduledTime) {
  // Tolerancia de 30 min em torno do horario programado
  const logDate = new Date(logTimestamp)
  const [h, m] = scheduledTime.split(':').map(Number)
  const scheduled = new Date(logDate)
  scheduled.setHours(h, m, 0, 0)
  return Math.abs(logDate - scheduled) < 30 * 60 * 1000
}
```

**Recalculo periodico:**

```javascript
// Atualizar zonas a cada 60 segundos
useEffect(() => {
  const interval = setInterval(() => {
    setNow(new Date())
  }, 60_000)
  return () => clearInterval(interval)
}, [])
```

**Expansao de protocolos para doses individuais:**

Cada protocolo com `time_schedule: ['08:00', '22:00']` gera 2 DoseItems.
Protocolo com `frequency: 'quando_necessario'` nao gera DoseItems (excluir).

```javascript
// Expandir protocolos em doses individuais
function expandProtocolsToDoses(protocols, logs, treatmentPlans) {
  const doses = []
  for (const protocol of protocols) {
    if (protocol.frequency === 'quando_necessario') continue
    for (const time of protocol.time_schedule || []) {
      doses.push({
        protocolId: protocol.id,
        medicineId: protocol.medicine_id,
        medicineName: protocol.medicine?.name || 'Desconhecido',
        scheduledTime: time,
        dosagePerIntake: protocol.dosage_per_intake,
        treatmentPlanId: protocol.treatment_plan_id || null,
        treatmentPlanName: findPlanName(protocol.treatment_plan_id, treatmentPlans),
        planBadge: findPlanBadge(protocol.treatment_plan_id, treatmentPlans),
        isRegistered: isDoseRegistered(protocol.id, time, todayLogs),
        registeredAt: findRegistrationTime(protocol.id, time, todayLogs),
      })
    }
  }
  return doses
}
```

**Testes esperados:** `src/features/dashboard/hooks/__tests__/useDoseZones.test.js`

```
describe('useDoseZones')
  describe('classifyDose')
    it('classifica dose 1h atras como late')
    it('classifica dose 3h atras como null (fora da janela)')
    it('classifica dose no horario atual como now')
    it('classifica dose em 30min como now')
    it('classifica dose em 2h como upcoming')
    it('classifica dose em 5h como later')
    it('classifica dose registrada como done')
  describe('hook behavior')
    it('retorna zonas vazias quando nao ha protocolos')
    it('distribui doses corretamente entre zonas')
    it('recalcula zonas quando now muda')
    it('exclui protocolos quando_necessario')
    it('expande time_schedule em doses individuais')
    it('totals.pending = expected - taken')
    it('ordena doses dentro de cada zona por scheduledTime')
```

**Criterios de aceite:**
- [ ] Zonas calculadas corretamente em relacao ao "agora"
- [ ] Recalculo automatico a cada 60 segundos
- [ ] Protocolos "quando_necessario" excluidos
- [ ] Doses registradas movidas para zona "done"
- [ ] Tolerancia de 30 min para match dose-log
- [ ] Doses >2h atrasadas nao mostram (fora da janela)
- [ ] Usa parseLocalDate() (nunca new Date() direto para datas)
- [ ] Testes com vi.useFakeTimers() para simular horarios
- [ ] Sem state desnecessario (dados derivados via useMemo)

---

## W2-02: Hook useComplexityMode()

**Objetivo:** Retornar o modo de complexidade (simple/moderate/complex) baseado na quantidade de medicamentos ativos do usuario.

**Arquivo:** `src/features/dashboard/hooks/useComplexityMode.js`
**Deps:** Nenhuma de Onda 1.

**Retorno:**

```javascript
{
  mode: 'simple' | 'moderate' | 'complex',
  medicineCount: number,
  overrideMode: string | null,   // se usuario forcou um modo
  setOverride: (mode) => void,   // persistir override em localStorage
  ringGaugeSize: 'large' | 'medium' | 'compact',  // derivado
  defaultViewMode: 'time' | 'plan',               // derivado
}
```

**Logica:**

```javascript
const STORAGE_KEY = 'mr_complexity_override'

function useComplexityMode() {
  const { medicines } = useDashboard()
  const [overrideMode, setOverrideMode] = useState(() =>
    localStorage.getItem(STORAGE_KEY)
  )

  const activeMedicines = useMemo(() =>
    medicines.filter(m => /* tem pelo menos 1 protocolo ativo */),
    [medicines]
  )

  const autoMode = useMemo(() => {
    const count = activeMedicines.length
    if (count <= 3) return 'simple'
    if (count <= 6) return 'moderate'
    return 'complex'
  }, [activeMedicines])

  const mode = overrideMode || autoMode

  const setOverride = useCallback((newMode) => {
    if (newMode === null) {
      localStorage.removeItem(STORAGE_KEY)
      setOverrideMode(null)
    } else {
      localStorage.setItem(STORAGE_KEY, newMode)
      setOverrideMode(newMode)
    }
  }, [])

  // Derivados
  const ringGaugeSize = mode === 'simple' ? 'large' : mode === 'moderate' ? 'medium' : 'compact'
  const defaultViewMode = mode === 'complex' ? 'plan' : 'time'

  return {
    mode,
    medicineCount: activeMedicines.length,
    overrideMode,
    setOverride,
    ringGaugeSize,
    defaultViewMode,
  }
}
```

**Testes esperados:** `src/features/dashboard/hooks/__tests__/useComplexityMode.test.js`

```
describe('useComplexityMode')
  it('retorna simple para 0-3 meds')
  it('retorna moderate para 4-6 meds')
  it('retorna complex para 7+ meds')
  it('ringGaugeSize corresponde ao mode')
  it('defaultViewMode e plan para complex')
  it('override persiste em localStorage')
  it('setOverride(null) limpa override')
  it('override sobrescreve auto-detection')
```

**Criterios de aceite:**
- [ ] Calculo correto por faixa (<=3, 4-6, 7+)
- [ ] Override via localStorage funciona
- [ ] setOverride(null) volta para auto-detection
- [ ] ringGaugeSize derivado corretamente
- [ ] defaultViewMode derivado corretamente
- [ ] Nao usa localStorage em testes (checar NODE_ENV)
- [ ] Hook order: States -> Memos -> Callbacks

---

## W2-03: DoseZoneList

**Objetivo:** Componente que renderiza a lista de zonas temporais com suas doses, suportando modos hora e plano.

**Arquivo:** `src/features/dashboard/components/DoseZoneList.jsx`
**CSS:** `src/features/dashboard/components/DoseZoneList.css`
**Deps:** W2-01 (useDoseZones)

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `zones` | `Object` | Sim | Output de useDoseZones().zones |
| `totals` | `Object` | Sim | Output de useDoseZones().totals |
| `viewMode` | `'time'\|'plan'` | Sim | Modo de visualizacao atual |
| `complexityMode` | `'simple'\|'moderate'\|'complex'` | Sim | Modo de complexidade |
| `onRegisterDose` | `Function(protocolId, dosagePerIntake)` | Sim | Callback de registro |
| `onBatchRegister` | `Function(doseItems[])` | Sim | Callback de lote |
| `onToggleSelection` | `Function(protocolId, scheduledTime)` | Sim | Toggle selecao lote |
| `selectedDoses` | `Set<string>` | Sim | IDs selecionados (protocolId:time) |

**State interno:**
- `expandedZones` (Set<string>) — quais zonas estao expandidas (controlled)
- Defaults: late=expandido, now=expandido, upcoming=expandido se <=4 itens, later=colapsado, done=colapsado

**Renderizacao (modo time):**

```
// Cada zona e uma secao colapsavel
<ZoneHeader icon="warning" label="ATRASADAS" count={late.length} color="warning" expanded />
  {late.map(dose => <DoseCard dose={dose} mode="time" />)}

<ZoneHeader icon="play" label="AGORA" count={`${takenInZone}/${totalInZone}`} color="primary" expanded />
  {now.map(dose => <DoseCard dose={dose} mode="time" />)}
  <BatchButton label={`Registrar ${pendingInZone} pendentes`} />

<ZoneHeader icon="clock" label="PROXIMAS" count={upcoming.length} color="muted" expanded={shouldExpand} />
  {upcoming.map(dose => <DoseCard dose={dose} mode="time" />)}

<ZoneHeader icon="calendar" label="MAIS TARDE" count={later.length} color="subtle" expanded={false} />
  {later.map(dose => <DoseCard dose={dose} mode="time" />)}

<ZoneHeader icon="check" label={`${done.length} registradas`} color="success" expanded={false} />
  {done.map(dose => <DoseCard dose={dose} mode="time" done />)}
```

**Renderizacao (modo plan):**

Dentro de cada zona, agrupar por treatmentPlanId e renderizar TreatmentAccordion existente:

```
<ZoneHeader label="AGORA" ...>
  <TreatmentAccordion protocol={cardiovascularPlan}>
    {dosesDoPlan.map(dose => <SwipeRegisterItem ... />)}
  </TreatmentAccordion>
  <TreatmentAccordion protocol={suplementosPlan}>
    {dosesDoPlan.map(dose => <SwipeRegisterItem ... />)}
  </TreatmentAccordion>
  {/* Avulsos (sem plano) */}
  {dosesAvulsos.map(dose => <SwipeRegisterItem ... />)}
```

**Logica de expand automatico por complexidade:**

```javascript
function getDefaultExpanded(zone, itemCount, complexityMode) {
  if (zone === 'late') return true                          // sempre expandido
  if (zone === 'now') return true                           // sempre expandido
  if (zone === 'upcoming') {
    if (complexityMode === 'complex') return false          // colapsado em complex
    return itemCount <= 4                                   // expandido se poucos itens
  }
  if (zone === 'later') return false                        // sempre colapsado
  if (zone === 'done') return false                         // sempre colapsado
  return false
}
```

**CSS:**

```css
.dose-zone-list { display: flex; flex-direction: column; gap: var(--space-2); }
.zone-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3); cursor: pointer; border-radius: var(--radius-md); }
.zone-header--late { background: color-mix(in srgb, var(--color-warning) 10%, transparent); }
.zone-header--now { background: color-mix(in srgb, var(--color-success) 10%, transparent); }
.zone-header--upcoming { background: var(--bg-surface); }
.zone-header--later { background: var(--bg-surface); opacity: 0.7; }
.zone-header--done { background: color-mix(in srgb, var(--color-success) 5%, transparent); }
.zone-header__label { font-size: var(--font-size-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.zone-header__count { font-size: var(--font-size-xs); color: var(--text-secondary); }
.zone-header__chevron { transition: transform var(--transition-fast); }
.zone-header__chevron--expanded { transform: rotate(180deg); }
.zone-content { overflow: hidden; }
```

**Animacoes:**
- Zone expand/collapse: Framer Motion `AnimatePresence` + height auto
- Items dentro da zona: stagger entrance `staggerChildren: 0.03`

**Testes esperados:** `src/features/dashboard/components/__tests__/DoseZoneList.test.jsx`

```
describe('DoseZoneList')
  it('renderiza secoes para cada zona nao vazia')
  it('nao renderiza zona quando vazia')
  it('expande late e now por padrao')
  it('colapsa later por padrao')
  it('modo time mostra doses em lista flat')
  it('modo plan agrupa por treatmentPlanId')
  it('chama onRegisterDose ao registrar')
  it('chama onBatchRegister com doses selecionadas')
  it('complex mode colapsa upcoming')
```

**Criterios de aceite:**
- [ ] Renderiza zonas corretamente em ambos os modos (time/plan)
- [ ] Expand/collapse funciona com animacao
- [ ] Modo plan reutiliza TreatmentAccordion existente
- [ ] Logica de expand automatico por complexidade
- [ ] Batch register funciona
- [ ] Zonas vazias nao renderizam
- [ ] CSS usa tokens do design system

---

## W2-04: ViewModeToggle

**Objetivo:** Toggle compacto "Hora | Plano" que alterna a visualizacao das zonas entre temporal e por tratamento.

**Arquivo:** `src/features/dashboard/components/ViewModeToggle.jsx`
**CSS:** `src/features/dashboard/components/ViewModeToggle.css`
**Deps:** W2-01 (saber se toggle faz sentido — so mostra se existem planos de tratamento)

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `mode` | `'time'\|'plan'` | Sim | Modo atual |
| `onChange` | `Function(mode)` | Sim | Callback de mudanca |
| `hasTreatmentPlans` | `boolean` | Sim | Se false, nao renderizar (nao faz sentido) |

**State interno:** Nenhum (controlled component).

**Persistencia:** O componente pai (Dashboard) persiste a escolha em localStorage:
```javascript
const STORAGE_KEY = 'mr_view_mode'
const [viewMode, setViewMode] = useState(() =>
  localStorage.getItem(STORAGE_KEY) || defaultViewMode
)
const handleViewModeChange = (mode) => {
  setViewMode(mode)
  localStorage.setItem(STORAGE_KEY, mode)
}
```

**Renderizacao:**

```
┌─────────────────────┐
│ [⏰ Hora] [📋 Plano] │  ← segmented control
└─────────────────────┘
```

```jsx
if (!hasTreatmentPlans) return null

<div className="view-mode-toggle">
  <button
    className={`view-mode-toggle__btn ${mode === 'time' ? 'view-mode-toggle__btn--active' : ''}`}
    onClick={() => onChange('time')}
    aria-pressed={mode === 'time'}
  >
    Hora
  </button>
  <button
    className={`view-mode-toggle__btn ${mode === 'plan' ? 'view-mode-toggle__btn--active' : ''}`}
    onClick={() => onChange('plan')}
    aria-pressed={mode === 'plan'}
  >
    Plano
  </button>
</div>
```

**CSS:**

```css
.view-mode-toggle { display: inline-flex; background: var(--bg-surface); border-radius: var(--radius-md); padding: 2px; border: 1px solid var(--color-border); }
.view-mode-toggle__btn { padding: var(--space-1) var(--space-3); font-size: var(--font-size-xs); font-weight: 500; border: none; background: transparent; color: var(--text-secondary); border-radius: calc(var(--radius-md) - 2px); cursor: pointer; transition: all var(--transition-fast); }
.view-mode-toggle__btn--active { background: var(--color-primary); color: white; }
```

**Testes esperados:** `src/features/dashboard/components/__tests__/ViewModeToggle.test.jsx`

```
describe('ViewModeToggle')
  it('renderiza dois botoes (Hora e Plano)')
  it('marca botao ativo com classe --active')
  it('chama onChange com o modo selecionado')
  it('retorna null quando hasTreatmentPlans=false')
  it('tem aria-pressed correto')
```

**Criterios de aceite:**
- [ ] Renderiza segmented control com 2 opcoes
- [ ] Nao renderiza quando nao ha planos de tratamento
- [ ] Chama onChange corretamente
- [ ] aria-pressed para acessibilidade
- [ ] CSS usa tokens do design system
- [ ] Nao tem state interno (controlled)

---

## W2-05: PlanBadge

**Objetivo:** Badge visual (emoji + cor) que identifica o plano de tratamento de uma dose.

**Arquivo:** `src/features/dashboard/components/PlanBadge.jsx`
**CSS:** `src/features/dashboard/components/PlanBadge.css`
**Deps:** Nenhuma.

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `emoji` | `string` | Sim | Emoji do plano (ex: "heart") |
| `color` | `string` | Sim | Cor CSS (ex: "var(--color-error)") |
| `planName` | `string` | Nao | Nome do plano (para tooltip) |
| `size` | `'sm'\|'md'` | Nao | Default: 'sm' |
| `onClick` | `Function` | Nao | Tap handler (mostra tooltip) |

**State interno:** Nenhum.

**Renderizacao:**

```jsx
<span
  className={`plan-badge plan-badge--${size}`}
  style={{ '--badge-color': color }}
  title={planName}
  onClick={onClick}
  role={onClick ? 'button' : undefined}
  tabIndex={onClick ? 0 : undefined}
>
  {emoji}
</span>
```

**CSS:**

```css
.plan-badge { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-full); background: color-mix(in srgb, var(--badge-color) 15%, transparent); }
.plan-badge--sm { width: 20px; height: 20px; font-size: 12px; }
.plan-badge--md { width: 28px; height: 28px; font-size: 16px; }
```

**Testes esperados:** `src/features/dashboard/components/__tests__/PlanBadge.test.jsx`

```
describe('PlanBadge')
  it('renderiza emoji correto')
  it('aplica cor como CSS custom property')
  it('mostra title com planName')
  it('chama onClick ao clicar')
  it('sem role=button quando nao tem onClick')
  it('aplica tamanho sm e md')
```

**Criterios de aceite:**
- [ ] Renderiza emoji com background colorido
- [ ] Title/tooltip mostra nome do plano
- [ ] Tamanhos sm e md funcionam
- [ ] Acessibilidade: role=button + tabindex quando clicavel

---

## W2-06: BatchRegisterButton

**Objetivo:** Botao proeminente de registro em lote que adapta seu label conforme o contexto (por horario ou por plano).

**Arquivo:** `src/features/dashboard/components/BatchRegisterButton.jsx`
**CSS:** `src/features/dashboard/components/BatchRegisterButton.css`
**Deps:** W2-04 (saber o viewMode para adaptar label)

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `pendingCount` | `number` | Sim | Quantidade de doses pendentes |
| `label` | `string` | Sim | Texto do botao (ex: "Registrar 3 pendentes") |
| `onClick` | `Function` | Sim | Callback de registro |
| `disabled` | `boolean` | Nao | Default: false |
| `variant` | `'primary'\|'outline'` | Nao | Default: 'primary' |

**State interno:** Nenhum.

**Renderizacao:**

```jsx
if (pendingCount === 0) return null

<motion.button
  className={`batch-btn batch-btn--${variant}`}
  onClick={onClick}
  disabled={disabled}
  whileTap={{ scale: 0.97 }}
>
  {label} ({pendingCount})
</motion.button>
```

**Criterios de aceite:**
- [ ] Nao renderiza quando pendingCount === 0
- [ ] Label dinamico com contagem
- [ ] whileTap feedback
- [ ] Variantes primary e outline
- [ ] disabled state funciona

---

## W2-07: AdaptiveLayout

**Objetivo:** Wrapper que ajusta o layout dos children conforme o modo de complexidade (simple/moderate/complex).

**Arquivo:** `src/features/dashboard/components/AdaptiveLayout.jsx`
**CSS:** `src/features/dashboard/components/AdaptiveLayout.css`
**Deps:** W2-02 (useComplexityMode)

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `mode` | `'simple'\|'moderate'\|'complex'` | Sim | Modo de complexidade |
| `children` | `ReactNode` | Sim | Conteudo a renderizar |

**State interno:** Nenhum.

**Renderizacao:**

```jsx
<div className={`adaptive-layout adaptive-layout--${mode}`}>
  {children}
</div>
```

**CSS:**

```css
/* Base: moderate (padrao) */
.adaptive-layout { display: flex; flex-direction: column; gap: var(--space-3); }

/* Simple: mais espaco, cards maiores */
.adaptive-layout--simple { gap: var(--space-4); }
.adaptive-layout--simple .dose-card { padding: var(--space-4); }

/* Complex: compacto, menos espaco */
.adaptive-layout--complex { gap: var(--space-1); }
.adaptive-layout--complex .dose-card { padding: var(--space-2); }
.adaptive-layout--complex .zone-header { padding: var(--space-2); }
```

**Testes esperados:** `src/features/dashboard/components/__tests__/AdaptiveLayout.test.jsx`

```
describe('AdaptiveLayout')
  it('aplica classe --simple para modo simple')
  it('aplica classe --moderate para modo moderate')
  it('aplica classe --complex para modo complex')
  it('renderiza children corretamente')
```

**Criterios de aceite:**
- [ ] Aplica classe CSS correta por modo
- [ ] Children renderizam sem alteracao
- [ ] CSS cascata afeta dose-card e zone-header children

---

## W2-08: Integrar RingGauge no Dashboard

**Objetivo:** Substituir HealthScoreCard pelo RingGauge no Dashboard, com tamanho adaptado ao modo de complexidade.

**Arquivo:** `src/views/Dashboard.jsx` (EDITAR — mudanca MINIMA)
**Deps:** W1-01 (RingGauge), W2-02 (useComplexityMode)

**Mudancas exatas:**

1. Adicionar imports:
```javascript
import RingGauge from '@dashboard/components/RingGauge'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
```

2. Dentro do componente, adicionar hook:
```javascript
const { ringGaugeSize } = useComplexityMode()
```

3. Substituir JSX do HealthScoreCard:
```jsx
// ANTES:
<HealthScoreCard
  score={stats.score}
  streak={stats.currentStreak}
  trend={trend}
  trendPercentage={percentage}
  magnitude={magnitude}
  onClick={() => setIsHealthDetailsOpen(true)}
/>

// DEPOIS:
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

**O que NAO mudar:**
- Nao remover o import de HealthScoreCard (manter para referencia, sera limpo depois)
- Nao alterar nenhuma outra parte do Dashboard
- Nao alterar state, effects ou handlers existentes

**Testes esperados:** Nenhum teste novo — os testes existentes do Dashboard devem continuar passando. Se precisar, ajustar mocks para o RingGauge.

**Criterios de aceite:**
- [ ] RingGauge renderiza no lugar do HealthScoreCard
- [ ] Tamanho adapta por complexidade (large/medium/compact)
- [ ] sparklineData passa dados de 7 dias
- [ ] Click continua abrindo HealthScoreDetails
- [ ] Dashboard funciona normalmente (sem regressao)
- [ ] Mudanca no Dashboard.jsx <= 15 linhas

---

## W2-09: Integrar StockBars no Dashboard

**Objetivo:** Adicionar o widget StockBars no Dashboard, entre os tratamentos e as ultimas doses.

**Arquivo:** `src/views/Dashboard.jsx` (EDITAR — mudanca MINIMA)
**Deps:** W1-02 (StockBars)

**Mudancas exatas:**

1. Adicionar import:
```javascript
import StockBars from '@dashboard/components/StockBars'
```

2. Preparar dados (useMemo, apos stockSummary existente):
```javascript
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
```

3. Adicionar JSX (apos secao de tratamentos, antes de ultimasDoses):
```jsx
{stockBarsItems.length > 0 && (
  <StockBars
    items={stockBarsItems}
    showOnlyCritical={complexityMode === 'complex'}
    maxItems={complexityMode === 'complex' ? 3 : undefined}
    onItemClick={(medicineId) => onNavigate('stock', { medicineId })}
  />
)}
```

**O que NAO mudar:**
- Nao remover StockAlertsWidget existente (manter ambos por enquanto)
- Nao alterar state ou handlers existentes

**Criterios de aceite:**
- [ ] StockBars renderiza com dados reais do stockSummary
- [ ] Complex mode mostra so criticos (max 3)
- [ ] Click navega para Estoque
- [ ] StockAlertsWidget existente inalterado
- [ ] Mudanca no Dashboard.jsx <= 25 linhas

---

## W2-10: Integrar DoseZoneList no Dashboard

**Objetivo:** Adicionar a lista de zonas temporais como visualizacao alternativa/complementar no Dashboard.

**Arquivo:** `src/views/Dashboard.jsx` (EDITAR — mudanca MINIMA)
**Deps:** W2-03 (DoseZoneList), W2-07 (AdaptiveLayout), W2-01 (useDoseZones), W2-02 (useComplexityMode), W2-04 (ViewModeToggle)

**Mudancas exatas:**

1. Adicionar imports:
```javascript
import DoseZoneList from '@dashboard/components/DoseZoneList'
import AdaptiveLayout from '@dashboard/components/AdaptiveLayout'
import ViewModeToggle from '@dashboard/components/ViewModeToggle'
import { useDoseZones } from '@dashboard/hooks/useDoseZones'
```

2. Adicionar hooks:
```javascript
const { zones, totals } = useDoseZones()
const { mode: complexityMode, defaultViewMode } = useComplexityMode()
const [viewMode, setViewMode] = useState(() =>
  localStorage.getItem('mr_view_mode') || defaultViewMode
)
```

3. Adicionar JSX (substituir secao de tratamentos atual):
```jsx
<AdaptiveLayout mode={complexityMode}>
  <ViewModeToggle
    mode={viewMode}
    onChange={(m) => { setViewMode(m); localStorage.setItem('mr_view_mode', m) }}
    hasTreatmentPlans={enrichedPlans.length > 0}
  />
  <DoseZoneList
    zones={zones}
    totals={totals}
    viewMode={viewMode}
    complexityMode={complexityMode}
    onRegisterDose={handleRegisterDose}
    onBatchRegister={handleBatchRegister}
    onToggleSelection={toggleMedicineSelection}
    selectedDoses={selectedMedicines}
  />
</AdaptiveLayout>
```

**ATENCAO — esta e a task mais sensivel da Onda 2:**
- A secao de tratamentos atual (TreatmentAccordion loop) sera SUBSTITUIDA pela DoseZoneList
- A DoseZoneList no modo "plan" REUTILIZA TreatmentAccordion internamente
- Preservar TODA a logica de handleRegisterDose, handleBatchRegister, toggleMedicineSelection
- Se algo quebrar, reverter e investigar

**Criterios de aceite:**
- [ ] DoseZoneList renderiza com zonas temporais reais
- [ ] Toggle hora/plano funciona
- [ ] Registro de dose continua funcionando (handleRegisterDose)
- [ ] Registro em lote continua funcionando (handleBatchRegister)
- [ ] AdaptiveLayout aplica modo correto
- [ ] Dashboard funciona end-to-end sem regressao
- [ ] `npm run validate:agent` passa
- [ ] `npm run build` passa

---

*Ultima atualizacao: 05/03/2026*
*Proximas specs: Wave 3 (navegacao) — arquivo separado*
