# Wave 7.5 — Refinamentos: Dashboard "Hoje" + View de Tratamentos

**Status:** ⏳ PENDENTE EXECUÇÃO
**Data:** 2026-03-25
**Branch:** `feature/redesign/wave-7-5-refinements`
**Dependências:** W6 ✅ W6.5 ✅ W7 ✅ (todos mergeados em main)
**Estimativa:** 6 sprints sequenciais (7.5.1 → 7.5.6)
**Risco:** BAIXO — todos os arquivos tocados são componentes do redesign isolados; sem modificar Dashboard.jsx original, hooks de dados ou services.

---

## Por que esta wave existe

Com W6, W6.5 e W7 entregues, as duas views principais do redesign estão funcionais mas apresentam gaps visuais e de usabilidade identificados ao comparar com as referências de produto:

**Dashboard "Hoje" (`DashboardRedesign` + `CronogramaPeriodo`):**
- Cards de dose são linhas horizontais planas (ícone de estado + texto + botão pill à direita) — a referência exige cards verticais com ícone de medicamento, layout empilhado e botão full-width na base
- Doses já registradas ficam misturadas visualmente com as pendentes (só opacity reduzida)
- Zonas passadas 100% concluídas permanecem abertas, gerando ruído visual
- Modo `simple` recebe o mesmo layout de zonas que o modo `complex`, quando deveria ser lista cronológica plana em 1 coluna

**Tratamentos (`TreatmentsComplex` + `ProtocolRow` + `TreatmentPlanHeader`):**
- Hover e clique da linha tabular afetam apenas a primeira célula (name-cell `<button>`), não a linha inteira
- Sem opção de editar o plano de tratamento no header do grupo
- Barra de adesão colorida + pílula de estoque colorida juntas geram excesso visual ("carnaval de cores")
- Header da view (busca + filtros) é visualmente dominante demais — referência pede busca discreta à esquerda e filtros como suporte à direita

---

## O que esta wave NÃO faz

- ❌ NÃO toca em `Dashboard.jsx` ou `Treatments.jsx` (views originais intactas)
- ❌ NÃO modifica `RingGaugeRedesign.jsx`, `PriorityDoseCard.jsx`, `StockAlertInline.jsx`
- ❌ NÃO modifica `useDoseZones.js`, `useDashboardContext.jsx`, `useTreatmentList.js`
- ❌ NÃO altera schemas ou services de dados
- ❌ NÃO cria novos hooks

---

## Arquivos modificados

| Arquivo | Sprints | Tipo |
|---------|---------|------|
| `src/features/dashboard/components/CronogramaPeriodo.jsx` | 7.5.1 + 7.5.2 + 7.5.3 | Modificar |
| `src/views/redesign/DashboardRedesign.jsx` | 7.5.3 + 7.5.4 | Modificar |
| `src/features/protocols/components/redesign/ProtocolRow.jsx` | 7.5.5 | Modificar |
| `src/features/protocols/components/redesign/TreatmentPlanHeader.jsx` | 7.5.5 | Modificar |
| `src/features/protocols/components/redesign/AdherenceBar7d.jsx` | 7.5.5 | Modificar |
| `src/views/redesign/TreatmentsComplex.jsx` | 7.5.5 | Modificar |
| `src/views/redesign/TreatmentsRedesign.jsx` | 7.5.5 | Modificar |
| `src/views/redesign/TreatmentsRedesign.css` | 7.5.6 | Modificar |
| `src/shared/styles/layout.redesign.css` | 7.5.1 + 7.5.5 + 7.5.6 | Modificar |

---

## PARTE A — Dashboard "Hoje"

### Estrutura de dados disponível

**DoseItem** (de `useDoseZones.js`):
```javascript
{
  protocolId: string,
  medicineId: string,
  medicineName: string,
  scheduledTime: string,       // "HH:MM"
  dosagePerIntake: number,     // comprimidos por dose
  dosageMg: number,            // mg por comprimido (para "850mg")
  isRegistered: boolean,
  registeredAt: string|null,   // ISO timestamp
  // ...planBadge, treatmentPlanId, etc.
}
```

**StockSummary item** (de `useDashboardContext`):
```javascript
{
  medicineId: string,
  daysRemaining: number,
  stockStatus: 'critical' | 'low' | 'normal' | 'high',
}
```

**Enriquecimento de doses** (Sprint 7.5.4 — em `DashboardRedesign.jsx`):

Para exibir o badge de estoque nos cards, cruzar `medicineId → stockSummary` **antes** de passar para `CronogramaPeriodo`. Usar `useMemo` para garantir que o cruzamento não recalcula a cada render:

```javascript
const stockByMedicineId = useMemo(() => {
  const map = new Map()
  stockSummary?.items?.forEach(item => map.set(item.medicineId, item))
  return map
}, [stockSummary])

const allDosesEnriched = useMemo(() => allDoses.map(dose => ({
  ...dose,
  stockDays: stockByMedicineId.get(dose.medicineId)?.daysRemaining ?? null,
  stockStatus: stockByMedicineId.get(dose.medicineId)?.stockStatus ?? null,
})), [allDoses, stockByMedicineId])
```

Passar `allDosesEnriched` (em vez de `allDoses`) para `CronogramaPeriodo`.

---

### Sprint 7.5.1 — Card Visual: Layout Vertical + Ícone + Botão Full-Width

**Arquivo:** `CronogramaPeriodo.jsx`

**Objetivo:** Substituir o layout horizontal de linha pelo layout vertical de card conforme referência `cards-hoje-vision.png`.

**Novo layout de `CronogramaDoseItem`:**

```
┌────────────────────────────────────┐
│ [ícone Pill]  Nome do Medicamento  │  ← se stockStatus critical/low:
│               [ESTOQUE: X dias]    │    badge vermelho/âmbar à direita do nome
│               Xcp · HH:MM         │  ← dosagem + horário
│ ┌──────────────────────────────┐   │
│ │           TOMAR              │   │  ← botão full-width verde
│ └──────────────────────────────┘   │
└────────────────────────────────────┘
```

**Card registrado (zona ativa):**
```
┌────────────────────────────────────┐
│ [✅ CheckCircle2]  Nome            │  ← background surface-container-low
│                    Xcp · HH:MM     │    sem botão TOMAR
│                    tomado HH:MM    │  ← se registeredAt disponível
└────────────────────────────────────┘
```

**Especificações CSS das classes novas em `layout.redesign.css`:**

```css
/* Grid 2 colunas — modo complex */
.cronograma-doses {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* Card individual */
.cronograma-dose-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem;
  border-radius: var(--radius-lg, 1rem);
  background: var(--color-surface-container-lowest, #ffffff);
  box-shadow: var(--shadow-editorial, 0 4px 24px -4px rgba(25,28,29,0.06));
}

/* Ícone em rounded-square */
.cronograma-dose-card__icon-wrap {
  width: 2rem; height: 2rem;
  border-radius: var(--radius-sm, 0.5rem);
  background: var(--color-primary-container, #cce8e2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* Badge estoque */
.cronograma-dose-card__stock-badge {
  font-size: var(--text-label-sm, 0.625rem);
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-full, 9999px);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cronograma-dose-card__stock-badge--critical {
  background: var(--color-error-container, #ffdad6);
  color: var(--color-error, #ba1a1a);
}
.cronograma-dose-card__stock-badge--low {
  background: #fff3cd;
  color: #92400e;
}

/* Botão TOMAR */
.cronograma-dose-card__btn {
  width: 100%;
  min-height: 2.75rem;
  border: none;
  border-radius: var(--radius-md, 0.75rem);
  background: var(--color-primary, #006a5e);
  color: var(--color-on-primary, #ffffff);
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-label-md, 0.75rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 150ms ease-out;
}
.cronograma-dose-card__btn:hover {
  background: var(--color-primary-hover, #005548);
}

/* Card registrado */
.cronograma-dose-card--done {
  background: var(--color-surface-container-low, #f4f6f5);
  box-shadow: none;
}
```

**Props novas de `CronogramaDoseItem`:**
- `stockDays: number | null`
- `stockStatus: string | null` — badge visível apenas se `'critical'` ou `'low'`

**Commit:** `feat(redesign): S7.5.1 — dose card layout vertical com ícone Pill e botão full-width`

---

### Sprint 7.5.2 — Zonas: Accordion para Zonas Concluídas

**Arquivo:** `CronogramaPeriodo.jsx`

**Objetivo:** Implementar abertura/fechamento inteligente de zonas baseado em estado.

**Regras de abertura:**

| Condição da zona | Estado inicial | Colapsável? |
|-----------------|---------------|-------------|
| Zona atual (hora atual dentro do range) | Sempre aberta | Não |
| Zona atual sem pendentes → próxima zona | Também aberta | Não |
| Zona futura com pendentes | Aberta | Não |
| Zona passada 100% concluída | **Fechada** | Sim — accordion |
| Zona passada parcialmente concluída | Aberta | Não |

**Lógica de "zona atual"** (sem useEffect — cálculo puro no render):
```javascript
const currentHour = new Date().getHours()

// Classificação por zona
const zoneStates = grouped.map(zone => {
  const [start, end] = zone.timeRange
  const isCurrent = currentHour >= start && currentHour < end
  const isPast = currentHour >= end
  const allDone = zone.doses.every(d => d.isRegistered)
  const isCollapsible = isPast && allDone
  return { ...zone, isCurrent, isPast, allDone, isCollapsible }
})

// Zona atual sem pendentes → abrir próxima
const currentZoneIdx = zoneStates.findIndex(z => z.isCurrent)
const currentZoneEmpty = currentZoneIdx >= 0 && zoneStates[currentZoneIdx].doses.every(d => d.isRegistered)
```

**Estado local:**
```javascript
// Inicializar zonas concluídas como fechadas
const [openZones, setOpenZones] = useState(() =>
  Object.fromEntries(grouped.map(z => [z.id, true])) // todas abertas inicialmente
)
// Após calcular zoneStates, fechar as colapsáveis:
// useEffect apenas para setar o estado inicial baseado em conclusão
```

**Header de zona concluída (accordion trigger):**
```jsx
<button
  className="cronograma-period-header cronograma-period-header--done"
  onClick={() => setOpenZones(prev => ({ ...prev, [id]: !prev[id] }))}
  aria-expanded={openZones[id]}
>
  <PeriodIcon size={16} />
  <span className="cronograma-period-header__label">{label}</span>
  <span className="cronograma-period-header__done-tag">· Concluído</span>
  <CheckCircle2 size={14} color="var(--color-primary)" />
  <ChevronRight
    size={16}
    className={`cronograma-period-header__chevron ${openZones[id] ? 'cronograma-period-header__chevron--open' : ''}`}
  />
</button>
```

**CSS:**
```css
.cronograma-period-header--done {
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cronograma-period-header__chevron {
  margin-left: auto;
  transition: transform 200ms ease-out;
}
.cronograma-period-header__chevron--open {
  transform: rotate(90deg);
}
.cronograma-period-header__done-tag {
  font-size: var(--text-label-sm, 0.625rem);
  color: var(--color-primary, #006a5e);
  font-weight: 600;
}
```

**Commit:** `feat(redesign): S7.5.2 — zonas passadas concluídas como accordion colapsável`

---

### Sprint 7.5.3 — Modo Simple: Lista Cronológica 1 Coluna

**Arquivo:** `CronogramaPeriodo.jsx`

**Objetivo:** Quando `variant="simple"`, renderizar lista plana sem agrupadores de zona.

**Prop nova:** `variant: 'complex' | 'simple'` (default: `'complex'`)

**Comportamento `variant="simple"`:**
- Ignorar `PERIODS` e agrupamento por zona
- Ordenar todas as doses por `scheduledTime` ascending
- Renderizar lista plana: sem headers de período, sem accordion
- CSS: `grid-template-columns: 1fr` (1 coluna)
- Doses registradas: checkmark + background suave, sem botão TOMAR (igual ao modo complex)

```javascript
if (variant === 'simple') {
  const sorted = [...allDoses].sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime)
  )
  return (
    <div className="cronograma-doses cronograma-doses--simple">
      {sorted.map(dose => (
        <CronogramaDoseItem
          key={`${dose.protocolId}-${dose.scheduledTime}`}
          dose={dose}
          onRegister={onRegister}
        />
      ))}
    </div>
  )
}
```

```css
.cronograma-doses--simple {
  grid-template-columns: 1fr;
}
```

**Commit:** `feat(redesign): S7.5.3 — modo simple: lista cronológica plana em 1 coluna`

---

### Sprint 7.5.4 — DashboardRedesign: Enriquecimento + Título + Variant

**Arquivo:** `DashboardRedesign.jsx`

**1. Enriquecimento de doses com dado de estoque** (ver seção "Estrutura de dados" acima)

**2. Header do cronograma atualizado:**
```jsx
{/* antes: <h2>Cronograma de Hoje</h2> */}
<div style={{ marginBottom: '1rem' }}>
  <h2 style={{ margin: 0, /* ... */ }}>Cronograma Compacto</h2>
  <p style={{ margin: '0.25rem 0 0', /* color outline, label-md */ }}>{today}</p>
</div>
```
A variável `today` já está calculada no componente como `"Sexta-feira, 24 de maio"`.

**3. Passar `variant` para `CronogramaPeriodo`:**
```jsx
<CronogramaPeriodo
  allDoses={allDosesEnriched}
  onRegister={(dose) => handleRegisterDoseQuick(dose.medicineId, dose.protocolId, dose.dosagePerIntake)}
  variant={complexityMode === 'simple' ? 'simple' : 'complex'}
/>
```

**Commit:** `feat(redesign): S7.5.4 — dashboard enriquece doses com estoque + título + variant`

---

## PARTE B — View de Tratamentos (Modo Complex)

---

### Sprint 7.5.5 — Tratamentos: Hover de Linha + Editar Plano + Adesão Neutra

Este sprint agrupa 3 melhorias relacionadas ao modo complex da view de tratamentos.

---

#### B1 — Hover e Clique em Toda a Linha (não só na primeira célula)

**Problema:** Em `ProtocolRow` `variant="tabular"`, o componente retorna 4 elementos filhos diretos do grid (1 `<button>` + 3 `<div>`). O hover CSS está apenas no `<button>` da célula 1. As células 2, 3 e 4 (`<div>`) não recebem hover nem respondem a clique.

**Causa raiz:** O wrapper em `TreatmentsComplex.jsx` tem `style={{ display: 'contents' }}` — correto para o grid — mas não há mecanismo de hover compartilhado entre as 4 células de uma mesma linha.

**Solução — estado de hover em `TreatmentsComplex.jsx`:**

```jsx
// Adicionar estado local
const [hoveredRow, setHoveredRow] = useState(null)

// No render, no wrapper de cada item:
<div
  key={item.id}
  style={{ display: 'contents' }}
  onMouseEnter={() => setHoveredRow(item.id)}
  onMouseLeave={() => setHoveredRow(null)}
  onClick={() => onEdit?.(item)}
  role="row"
  aria-label={`Editar protocolo de ${item.medicineName}`}
>
  <ProtocolRow
    item={item}
    isComplex={true}
    onEdit={onEdit}
    activeTab={activeTab}
    variant="tabular"
    isHovered={hoveredRow === item.id}
  />
</div>
```

**Em `ProtocolRow` `variant="tabular"`:**
- Receber prop `isHovered: boolean`
- Remover `onClick` da célula 1 (o clique agora está no wrapper)
- Aplicar classe `.protocol-row-tabular__cell--hovered` em todas as células quando `isHovered === true`

```jsx
const hoverClass = isHovered ? 'protocol-row-tabular__cell--hovered' : ''

// Célula 1 — sem onClick (clique no wrapper pai)
<div className={`protocol-row-tabular__cell protocol-row-tabular__name-cell ${hoverClass}`}>
  ...
</div>

// Células 2, 3, 4 — mesma classe
<div className={`protocol-row-tabular__cell protocol-row-tabular__schedule-cell ${hoverClass}`}>
```

**Nota:** A célula 1 deixa de ser `<button>` e vira `<div>` — o clique é tratado pelo wrapper com `role="row"`. Manter `tabIndex` e `onKeyDown` no wrapper para acessibilidade.

**CSS em `layout.redesign.css`:**
```css
.protocol-row-tabular__cell--hovered {
  background: var(--color-primary-container, #cce8e2);
  cursor: pointer;
}
```

---

#### B2 — Editar Plano de Tratamento no Header do Grupo

**Contexto:** `TreatmentPlanHeader` hoje só exibe nome + count + chevron. A referência mostra um ícone de edição no header quando o grupo é um plano real (não fallback de classe terapêutica).

**Identificar se é plano real:** O objeto `group` de `useTreatmentList` tem `group.isPlan: boolean` (plano real) vs fallback (classe terapêutica ou "Medicamentos Avulsos"). Verificar no hook se esse campo existe; se não, inferir por `group.groupKey.startsWith('plan-')`.

**Ícone de edição:** Usar `PencilLine` do Lucide (16px) — discreto, alinhado ao design system. Não usar emoji ✏️.

**Em `TreatmentPlanHeader.jsx`:**
```jsx
export default function TreatmentPlanHeader({ group, isCollapsed, onToggle, onEditPlan }) {
  const isPlan = group.isPlan ?? group.groupKey?.startsWith('plan-')

  return (
    <div className="plan-header-wrap">
      <button className="plan-header" onClick={onToggle} style={{ '--plan-color': group.groupColor }}>
        <span className="plan-header__dot" style={{ background: group.groupColor }} />
        <span className="plan-header__emoji">{group.groupEmoji}</span>
        <span className="plan-header__label">{group.groupLabel}</span>
        <span className="plan-header__count">{group.items.length}×</span>
        {group.hasAlert && <span className="plan-header__alert">⚠</span>}
        <span className="plan-header__chevron">{isCollapsed ? '▼' : '▲'}</span>
      </button>

      {isPlan && onEditPlan && (
        <button
          className="plan-header__edit-btn"
          onClick={(e) => { e.stopPropagation(); onEditPlan(group) }}
          aria-label={`Editar plano ${group.groupLabel}`}
          title="Editar plano de tratamento"
        >
          <PencilLine size={15} />
        </button>
      )}
    </div>
  )
}
```

**CSS:**
```css
.plan-header-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.plan-header-wrap .plan-header {
  flex: 1;
}
.plan-header__edit-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-outline, #6d7a76);
  display: flex;
  align-items: center;
  padding: 0.375rem;
  border-radius: var(--radius-sm, 0.5rem);
  min-height: 2rem;
  transition: color 150ms, background 150ms;
}
.plan-header__edit-btn:hover {
  color: var(--color-on-surface, #191c1d);
  background: var(--color-surface-container, #edf1f0);
}
```

**Fluxo de edição em `TreatmentsComplex.jsx`:**
Passar `onEditPlan` para `TreatmentPlanHeader`. O handler abre o modal de edição do plano. Este modal vive em `TreatmentsRedesign.jsx` (onde já existe o padrão de Modal para ProtocolForm).

**Em `TreatmentsComplex.jsx`:** receber prop `onEditPlan` e repassar para cada `TreatmentPlanHeader`.

**Em `TreatmentsRedesign.jsx`:**
```jsx
const [planFormOpen, setPlanFormOpen] = useState(false)
const [planToEdit, setPlanToEdit] = useState(null)

async function handleEditPlan(group) {
  try {
    const fullPlan = await treatmentPlanService.getById(group.planId)
    setPlanToEdit(fullPlan)
    setPlanFormOpen(true)
  } catch (err) {
    setErrorMessage('Erro ao carregar plano. Tente novamente.')
  }
}

async function handlePlanSave(planData) {
  try {
    await treatmentPlanService.update(planToEdit.id, planData)
    setPlanFormOpen(false)
    setPlanToEdit(null)
    refetch()
  } catch (err) {
    setErrorMessage('Erro ao salvar plano. Tente novamente.')
  }
}

// No JSX:
<Modal isOpen={planFormOpen} onClose={() => { setPlanFormOpen(false); setPlanToEdit(null) }}>
  {planToEdit && (
    <TreatmentPlanForm
      plan={planToEdit}
      onSave={handlePlanSave}
      onCancel={() => { setPlanFormOpen(false); setPlanToEdit(null) }}
    />
  )}
</Modal>
```

**Import novo em `TreatmentsRedesign.jsx`:**
```javascript
import TreatmentPlanForm from '@protocols/components/TreatmentPlanForm'
```

**Verificar se `treatmentPlanService` já tem `getById`** — se não, usar o objeto do grupo diretamente (o group já tem `groupLabel`, `groupColor`, `groupEmoji`; verificar se `group.planId` está disponível via `useTreatmentList`).

---

#### B3 — Adesão Neutra: Cor Apenas Quando Abaixo do Threshold

**Problema:** `AdherenceBar7d` usa `--adherence-color` via classes `good` (verde) / `medium` (âmbar) / `poor` (vermelho), que junto com as cores vibrantes da `StockPill` criam excesso visual.

**Nova lógica de cor para adesão:**

| Score | Classe | Cor da barra | Cor do label |
|-------|--------|-------------|-------------|
| ≥ 70% | `adherence-bar7d--neutral` | `var(--color-on-surface-variant)` (cinza escuro) | idem |
| < 70% | `adherence-bar7d--warning` | `var(--color-warning-amber, #d97706)` (âmbar) | idem |

> Threshold em 70% — equivale a perder mais de 2 dias numa semana (< 5/7 doses). É o limiar clínico relevante de adesão irregular. Não usar vermelho na barra de adesão — o estoque já usa vermelho para crítico. Reservar vermelho para estoque.

**Em `AdherenceBar7d.jsx`:**
```javascript
// Antes:
const statusClass = pct >= 80 ? 'adherence-bar7d--good' : pct >= 60 ? 'adherence-bar7d--medium' : 'adherence-bar7d--poor'

// Depois:
const statusClass = pct >= 70 ? 'adherence-bar7d--neutral' : 'adherence-bar7d--warning'
```

**CSS — substituir variáveis em `layout.redesign.css`:**
```css
/* Remover --adherence-good / --adherence-medium / --adherence-poor */

.adherence-bar7d--neutral {
  --adherence-color: var(--color-on-surface-variant, #3e4946);
}
.adherence-bar7d--warning {
  --adherence-color: #d97706; /* âmbar — atenção sem alarme */
}
```

**Commit:** `feat(redesign): S7.5.5 — hover de linha + editar plano + adesão neutra threshold 75%`

---

### Sprint 7.5.6 — Header da View de Tratamentos: Busca Discreta + Filtros Suporte

**Referência:** `complex-tratamentos-desktop.png` — busca à esquerda (não full-width), filtros (Ativos/Pausados/Finalizados) alinhados à direita como texto com underline ativo, não como tabs destacadas.

**Arquivos:** `TreatmentsRedesign.jsx` (layout) + `TreatmentsRedesign.css` (estilo) + `layout.redesign.css` (tab bar)

**Layout alvo:**
```
┌─────────────────────────────────────────────────────┐
│  [🔍 Buscar medicamento ou sintoma...]   Ativos  Pausados  Finalizados  │
└─────────────────────────────────────────────────────┘
```

Desktop (≥ 1024px): busca + filtros em uma única linha, `display: flex`, `justify-content: space-between`.
Mobile (< 1024px): busca full-width em cima, filtros abaixo (comportamento atual mantido).

**Mudanças em `TreatmentTabBar`:**

Alterar estilo das tabs para variante "discreta":
- Remover background do tab ativo (`pill` ativo colorido)
- Usar `font-weight: 600` + `border-bottom: 2px solid var(--color-primary)` no tab ativo
- Tabs inativos: `color: var(--color-outline)`, sem sublinhado
- Remover `background` do container das tabs

```css
/* Novo estilo para tabs discretas */
.treatment-tab-bar {
  display: flex;
  gap: 1.5rem;
  border-bottom: 1px solid var(--color-outline-variant, #c1cac6);
  padding-bottom: 0;
}
.treatment-tab-bar__tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 0;
  margin-bottom: -1px;
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-label-lg, 0.875rem);
  font-weight: 500;
  color: var(--color-outline, #6d7a76);
  cursor: pointer;
  transition: color 150ms, border-color 150ms;
}
.treatment-tab-bar__tab--active {
  color: var(--color-primary, #006a5e);
  font-weight: 600;
  border-bottom-color: var(--color-primary, #006a5e);
}
```

**Em `TreatmentsRedesign.jsx` — layout desktop do header:**
```jsx
{/* Desktop: busca + filtros em linha */}
<div className="treatments-redesign__controls">
  <AnvisaSearchBar ... />
  <TreatmentTabBar ... />
</div>
```

```css
/* Mobile: coluna */
.treatments-redesign__controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

/* Desktop: linha */
@media (min-width: 1024px) {
  .treatments-redesign__controls {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }
  .treatments-redesign__controls > :first-child {
    flex: 1;
    max-width: 28rem; /* busca não ocupa mais de ~450px */
  }
}
```

**Commit:** `feat(redesign): S7.5.6 — header tratamentos discreto: busca esquerda + filtros suporte direita`

---

## Checklist de Validação

### Dashboard "Hoje"

- [ ] Cards com layout vertical: ícone → nome/badge → dosagem → botão
- [ ] Botão TOMAR full-width (não pill à direita)
- [ ] Ícone `Pill` em rounded square nos cards pendentes
- [ ] Ícone `CheckCircle2` verde nos cards registrados
- [ ] Badge de estoque aparece **apenas** em `critical` e `low`
- [ ] Cards registrados com background `surface-container-low`, sem botão TOMAR
- [ ] Zona atual sempre aberta; próxima também aberta se zona atual sem pendentes
- [ ] Zona passada 100% concluída: accordion fechado por padrão
- [ ] Accordion abre/fecha ao clicar no header da zona
- [ ] Modo `simple`: lista plana 1 coluna, sem headers de zona, ordem cronológica
- [ ] Header "Cronograma Compacto" + data do dia
- [ ] `variant` passado corretamente por `DashboardRedesign` baseado em `complexityMode`

### Tratamentos (Modo Complex)

- [ ] Hover ilumina **todas as 4 células** da linha (não só a primeira)
- [ ] Clique em qualquer célula da linha abre o modal de edição do protocolo
- [ ] Botão de editar plano (`PencilLine`) aparece **apenas** em grupos que são planos reais
- [ ] Botão de editar plano **não aparece** em fallbacks (classe terapêutica, "Medicamentos Avulsos")
- [ ] Clicar no botão de editar plano abre `TreatmentPlanForm` preenchido com dados do plano
- [ ] Salvar o form atualiza o plano e faz `refetch()` da lista
- [ ] Barra de adesão ≥ 70%: cor neutra (cinza escuro)
- [ ] Barra de adesão < 70%: cor âmbar (alerta — equivale a > 2 dias perdidos na semana)
- [ ] Nenhuma barra de adesão usa verde ou vermelho — esses tons são exclusivos do estoque
- [ ] Header da view: busca + filtros em linha no desktop (≥ 1024px)
- [ ] Header da view: busca acima + filtros abaixo no mobile

### Geral

- [ ] Todos os touch targets ≥ 56px (botões, headers de zona, accordion, edit plan)
- [ ] Accordion usa `<button>` com `aria-expanded` correto
- [ ] `npm run validate:agent` passa (546+ testes, 0 lint errors)
- [ ] Nenhum arquivo fora do escopo desta wave foi modificado

---

## Referências Visuais

- `screenshots/cards-hoje-vision.png` — cards do cronograma (layout alvo)
- `screenshots/new-dashboard-atual.png` — dashboard atual implementado
- `screenshots/new-dashboard-vision.png` — visão geral do dashboard alvo
- `screenshots/new-treatment-hover.png` — bug: hover só na primeira célula
- `plans/redesign/references/complex-tratamentos-desktop.png` — referência completa da view de tratamentos

---

## Não-objetivos desta wave

- Melhorias no painel esquerdo do dashboard (Ring Gauge maior, hierarquia de Adesão Diária) — wave posterior
- Linha expandida de protocolo com titulação/notas — já implementada; apenas hover/click corrigidos aqui
- Modo `simple` da view de tratamentos — já funcional; apenas dashboard simple é tocado aqui
- Estilo dos cards no modo `simple` da view de tratamentos — escopo de wave posterior
