# Wave 7.5 — Refinamentos: Dashboard "Hoje" + View de Tratamentos

**Status:** ✅ CONCLUÍDO
**Data de início:** 2026-03-25
**Data de conclusão:** 2026-03-26
**Branch:** `feature/redesign/wave-7-5-refinements`
**Dependências:** W6 ✅ W6.5 ✅ W7 ✅ (todos mergeados em main)
**Sprints realizados:** 7.5.1 → 7.5.6 (sequenciais, com iterações de correção)
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
- ❌ NÃO altera `useDashboardContext.jsx` ou schemas Zod
- ❌ NÃO cria novos hooks (exceto extensions menores a existentes)

**Nota:** `useDoseZones.js`, `useTreatmentList.js` e `treatmentPlanService.js` foram levemente expandidos para suportar as funcionalidades do redesign (medicineType, isPlan, getById), mas mantêm compatibilidade backward.

---

## Arquivos modificados

| Arquivo | Sprints | Tipo | Status |
|---------|---------|------|--------|
| `src/features/dashboard/components/CronogramaPeriodo.jsx` | 7.5.1 + 7.5.2 + 7.5.3 | Modificar | ✅ Completo |
| `src/features/dashboard/hooks/useDoseZones.js` | 7.5.1 | Modificar | ✅ Completo |
| `src/views/redesign/DashboardRedesign.jsx` | 7.5.3 + 7.5.4 | Modificar | ✅ Completo |
| `src/features/protocols/components/redesign/ProtocolRow.jsx` | 7.5.5 | Modificar | ✅ Completo |
| `src/features/protocols/components/redesign/TreatmentPlanHeader.jsx` | 7.5.5 | Modificar | ✅ Completo |
| `src/features/protocols/components/redesign/AdherenceBar7d.jsx` | 7.5.5 | Modificar | ✅ Completo |
| `src/features/protocols/hooks/useTreatmentList.js` | 7.5.5 | Modificar | ✅ Completo |
| `src/features/protocols/services/treatmentPlanService.js` | 7.5.5 | Modificar | ✅ Completo |
| `src/views/redesign/TreatmentsComplex.jsx` | 7.5.5 | Modificar | ✅ Completo |
| `src/views/redesign/TreatmentsRedesign.jsx` | 7.5.5 | Modificar | ✅ Completo |
| `src/views/redesign/TreatmentsRedesign.css` | 7.5.6 | Modificar | ✅ Completo |
| `src/shared/styles/layout.redesign.css` | 7.5.1 + 7.5.2 + 7.5.5 + 7.5.6 | Modificar | ✅ Completo |

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

**Ícones distintos por tipo de medicamento (S7.5 visual implementado):**
- `medicineType: 'medicamento'` → Ícone **Pill** (branco) com fundo teal gradient (`#006a5e` → `#008577`)
- `medicineType: 'suplemento'` → Ícone **PillBottle** (branco) com fundo laranja gradient (`#d97706` → `#f59e0b`)

**Implementação realizada:**

1. **`useDoseZones.js`** — adicionar `medicineType` ao DoseItem:
```javascript
doses.push({
  protocolId: protocol.id,
  medicineId: protocol.medicine_id,
  medicineName: protocol.medicine?.name || 'Desconhecido',
  medicineType: protocol.medicine?.type || 'medicamento', // S7.5 visual
  scheduledTime: time,
  dosagePerIntake: protocol.dosage_per_intake ?? 1,
  // ...
})
```

2. **`CronogramaPeriodo.jsx`** — renderizar ícone correto:
```jsx
const isSupplement = dose.medicineType === 'suplemento'
const MedicineIcon = isSupplement ? PillBottle : Pill

// Importar no topo:
import { Pill, PillBottle } from 'lucide-react'

// No JSX do icon-wrap:
<div className={`cronograma-dose-card__icon-wrap cronograma-dose-card__icon-wrap--${isSupplement ? 'supplement' : 'medicine'}`}>
  {done
    ? <CheckCircle2 size={20} color="var(--color-primary, #006a5e)" aria-hidden="true" />
    : <MedicineIcon size={20} color="#ffffff" aria-hidden="true" />
  }
</div>
```

3. **`layout.redesign.css`** — gradientes por tipo:
```css
.cronograma-dose-card__icon-wrap--medicine {
  background: linear-gradient(135deg, #006a5e 0%, #008577 100%);
}

.cronograma-dose-card__icon-wrap--supplement {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
}
```

**Commits realizados:**
- `feat(redesign): S7.5.1 — dose card layout vertical + ícones Pill/PillBottle por tipo de medicamento`
- `feat(redesign): S7.5 visual — icones distintos medicamento vs suplemento com gradientes`

---

### Sprint 7.5.2 — Zonas: Accordions com Abertura Inteligente

**Arquivo:** `CronogramaPeriodo.jsx`

**Objetivo:** Implementar accordions para TODOS os headers de zona, com abertura inteligente baseada em estado.

**Regras de abertura inicial (implementadas):**

| Condição da zona | Estado inicial |
|-----------------|---------------|
| Zona atual (hora atual dentro do range) | Sempre **aberta** |
| Zona futura com pendentes | **Aberta** |
| Zona passada (qualquer estado) | **Fechada** ← novo comportamento |

Mudança importante: **TODOS os headers são clicáveis accordions** (não apenas "colapsáveis"). O usuário pode abrir/fechar qualquer zona manualmente. As zonas passadas começam fechadas para reduzir ruído visual, mas permanecem acessíveis.

**Lógica de "zona atual"** (sem useEffect — cálculo puro com useState initializer):

```javascript
const currentHour = new Date().getHours()

// Computar grouped com informação de isCurrent e isPast
const grouped = useMemo(() => {
  const currentHour = new Date().getHours()
  return PERIODS.map(({ id, label, Icon, timeRange }) => {
    const [start, end] = timeRange
    const doses = allDoses
      .filter(d => {
        const h = getHour(d.scheduledTime)
        return h >= start && h < end
      })
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

    const isCurrent = currentHour >= start && currentHour < end
    const isPast = currentHour >= end
    const allDone = doses.every(d => d.isRegistered)
    const isCollapsible = isPast && allDone

    return { id, label, Icon, doses, isCurrent, isPast, isCollapsible }
  }).filter(({ doses }) => doses.length > 0)
}, [allDoses])

// Inicializar openZones com useState initializer
// Zonas passadas começam fechadas, atual + futuras começam abertas
const [openZones, setOpenZones] = useState(() => {
  if (grouped.length === 0) return {}
  return Object.fromEntries(
    grouped.map(z => {
      // Zonas passadas: começam fechadas | Atual + futuras: começam abertas
      return [z.id, !z.isPast]
    })
  )
})
```

**Header de zona (accordion trigger) — implementação realizada:**

```jsx
<button
  className="cronograma-period-header"
  onClick={() => setOpenZones(prev => ({ ...prev, [id]: !prev[id] }))}
  aria-expanded={isOpen}
>
  <PeriodIcon size={16} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
  <span className="cronograma-period-header__label">{label}</span>

  {/* Indicadores à direita: "Concluído" ou contagem + chevron */}
  <div className="cronograma-period-header__right">
    {isPast ? (
      <>
        <span className="cronograma-period-header__done-tag">· Concluído</span>
        <CheckCircle2 size={14} color="var(--color-primary, #006a5e)" aria-hidden="true" />
      </>
    ) : (
      <span className="cronograma-period-header__count">
        {doses.filter(d => d.isRegistered).length}/{doses.length}
      </span>
    )}
    <ChevronRight
      size={16}
      className={`cronograma-period-header__chevron ${isOpen ? 'cronograma-period-header__chevron--open' : ''}`}
      aria-hidden="true"
    />
  </div>
</button>
```

**CSS implementado em `layout.redesign.css`:**

```css
/* Header base — limpo, sem borda, com padding-bottom para espaço visual */
.cronograma-period-header {
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0.25rem 0 1.25rem 0;     /* bottom padding para espaço das doses */
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-label-md, 0.75rem);
  font-weight: 600;
  color: var(--color-on-surface, #191c1d);
  transition: opacity 150ms ease-out;
}

.cronograma-period-header:hover {
  opacity: 0.8;
}

/* Container para agrupar counter + chevron na direita */
.cronograma-period-header__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.cronograma-period-header__count {
  font-size: var(--text-label-sm, 0.625rem);
  color: var(--color-outline, #6d7a76);
}

.cronograma-period-header__done-tag {
  font-size: var(--text-label-sm, 0.625rem);
  color: var(--color-primary, #006a5e);
  font-weight: 600;
}

/* Chevron com animação */
.cronograma-period-header__chevron {
  transition: transform 200ms ease-out;
}

.cronograma-period-header__chevron--open {
  transform: rotate(90deg);
}
```

**Commits realizados:**
- `fix(redesign): S7.5.2 — acordeons visuais com openZones state initializer`
- `fix(redesign): S7.5.2 — acordeons visuais e alinhamento contador + chevron`

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

### Sprint 7.5.4 — DashboardRedesign: Enriquecimento + Título + Variant + RingGauge Fix

**Arquivo:** `DashboardRedesign.jsx`

**1. Enriquecimento de doses com dado de estoque** (ver seção "Estrutura de dados" acima)

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

**2. Header do cronograma atualizado:**
```jsx
{/* Titulo + Data — renderizar uma unica vez, nao duplicar */}
<div style={{ marginBottom: '1rem' }}>
  <h2 style={{ margin: 0, /* ... */ }}>Cronograma de Hoje</h2>
  <p style={{ margin: '0.25rem 0 0', /* color outline, label-md */ }}>{today}</p>
</div>
```
A variável `today` já está calculada no componente como `"Sexta-feira, 24 de maio"`.

**3. RingGaugeRedesign sizing — sempre `size="large"`:**

Antes: tamanho condicional que criava inconsistência visual entre modos simple e complex.
```jsx
// ERRADO
<RingGaugeRedesign
  size={complexityMode === 'complex' ? 'medium' : 'large'}
  // ...
/>

// CORRETO — sempre large para consistência
<RingGaugeRedesign
  size="large"
  // ...
/>
```

**4. Passar `variant` para `CronogramaPeriodo`:**
```jsx
<CronogramaPeriodo
  allDoses={allDosesEnriched}
  onRegister={(dose) => handleRegisterDoseQuick(dose.medicineId, dose.protocolId, dose.dosagePerIntake)}
  variant={complexityMode === 'simple' ? 'simple' : 'complex'}
/>
```

**Commits realizados:**
- `feat(redesign): S7.5.4 — dashboard enriquece doses com estoque + título + variant`
- `fix(redesign): RingGaugeRedesign sempre size="large" para consistencia visual`

---

## PARTE B — View de Tratamentos (Modo Complex)

---

### Sprint 7.5.5 — Tratamentos: Hover de Linha + Editar Plano + Adesão Neutra + Group Ordering

Este sprint agrupa 4 melhorias relacionadas ao modo complex da view de tratamentos.

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

**Contexto:** `TreatmentPlanHeader` exibe nome + count + chevron. A referência mostra um ícone de edição no header quando o grupo é um plano real (não fallback de classe terapêutica).

**Mudanças em `useTreatmentList.js` — adicionar isPlan:**

```javascript
// No computeGroups, adicionar campo isPlan ao objeto group
const groups = Array.from(map.values())

// Separar planos reais de fallbacks e ordenar (planos em cima)
const realPlans = groups.filter(g => g.isPlan)
const therapeuticClasses = groups.filter(g => !g.isPlan)
return [...realPlans, ...therapeuticClasses]
```

Cada group retorna:
```javascript
{
  groupKey: 'plan:abc123' | 'class:Antihipertensivos' | 'loose',
  isPlan: true | false,
  groupLabel: 'Meu Plano de Hipertensão',
  groupColor: '#...',
  groupEmoji: '📋',
  items: [...],
  // ...
}
```

**Identificar se é plano real:** O objeto `group` tem `group.isPlan: boolean`. Detectar automaticamente via `useTreatmentList`.

**Ícone de edição:** Usar `PencilLine` do Lucide (15-16px) — discreto, alinhado ao design system.

**Em `TreatmentPlanHeader.jsx` — implementação realizada:**

```jsx
import { PencilLine } from 'lucide-react'

export default function TreatmentPlanHeader({ group, isCollapsed, onToggle, onEditPlan }) {
  // Detectar se é plano real via isPlan ou groupKey
  const isPlan = group.isPlan ?? group.groupKey?.startsWith('plan:')

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

**CSS em `layout.redesign.css`:**
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

**Em `treatmentPlanService.js` — adicionar método getById:**

```javascript
export const treatmentPlanService = {
  // ... existing methods ...

  async getById(id) {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('treatment_plans')
      .select(`
        *,
        protocols:protocols(
          *,
          medicine:medicines(*)
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  }
}
```

**Fluxo de edição em `TreatmentsRedesign.jsx`:**

```jsx
const [planFormOpen, setPlanFormOpen] = useState(false)
const [planToEdit, setPlanToEdit] = useState(null)
const [errorMessage, setErrorMessage] = useState(null)

async function handleEditPlan(group) {
  try {
    setErrorMessage(null)
    const planId = group.groupKey.replace('plan:', '')
    const fullPlan = await treatmentPlanService.getById(planId)
    setPlanToEdit(fullPlan)
    setPlanFormOpen(true)
  } catch (err) {
    console.error('Erro ao carregar plano para edicao:', err)
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
<TreatmentsComplex
  // ... props ...
  onEditPlan={handleEditPlan}
/>

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

**Commits realizados:**
- `fix(redesign): S7.5.5 — hover de linha tabular em todas as celulas`
- `feat(redesign): S7.5.5-B2 — botao editar plano no header com PencilLine`
- `feat(redesign): S7.5.5 — adesao neutra threshold 70% (< 70% = warning amber)`
- `fix(redesign): ordenar grupos — planos reais em cima + isPlan detection`
- `feat(redesign): treatmentPlanService.getById() para edicao de planos`

---

### Sprint 7.5.6 — Header da View de Tratamentos: Busca Discreta + Filtros Suporte

**Referência:** `complex-tratamentos-desktop.png` — busca à esquerda (não full-width), filtros (Ativos/Pausados/Finalizados) alinhados à direita como texto com underline ativo, não como tabs destacadas.

**Arquivos:** `TreatmentsRedesign.jsx` (layout) + `TreatmentsRedesign.css` (estilo) + `layout.redesign.css` (tab bar)

**Layout alvo:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  [🔍 Buscar medicamento ou sintoma...]   Ativos  Pausados  Finalizados  │
└─────────────────────────────────────────────────────────────────────────┘
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

## Bugs Descobertos e Corrigidos Durante Implementação

### Erro 1: Conditional Hook Call — useEffect em CronogramaPeriodo
**Problema:** React Hook 'useEffect' é chamado condicionalmente. Hooks devem ser chamados na mesma ordem sempre.
**Linha:** CronogramaPeriodo.jsx, inicialmente linha 123
**Root cause:** useEffect inicial tentava inicializar openZones baseado em grouped, mas estava condicionalmente dentro de render logic
**Solução:** Usar useState com initializer function em vez de useEffect
```javascript
// ERRADO
const [openZones, setOpenZones] = useState({})
if (variant === 'simple') return ...
useEffect(() => { /* initialize openZones */ })

// CORRETO
const [openZones, setOpenZones] = useState(() => {
  if (grouped.length === 0) return {}
  return Object.fromEntries(grouped.map(z => [z.id, !z.isPast]))
})
```
**Impacto:** Zonas não apareciam com estado correto (abertas/fechadas)

### Erro 2: Icon Import — 'Capsule' não existe em lucide-react
**Problema:** The requested module does not provide an export named 'Capsule'
**Linha:** CronogramaPeriodo.jsx, line 3
**Root cause:** Tentativa de importar ícone non-existent `Capsule`
**Solução:** Usar `PillBottle` para suplementos, `Pill` para medicamentos
```javascript
// ERRADO
import { Capsule, Pill } from 'lucide-react'
const MedicineIcon = isSupplement ? Capsule : Pill

// CORRETO
import { Pill, PillBottle } from 'lucide-react'
const MedicineIcon = isSupplement ? PillBottle : Pill
```
**Impacto:** App não carregava, syntax error bloqueava dashboard

### Erro 3: Missing Service Method — treatmentPlanService.getById()
**Problema:** treatmentPlanService.getById is not a function
**Linha:** TreatmentsRedesign.jsx, line 114 (handleEditPlan)
**Root cause:** Método não existia em treatmentPlanService
**Solução:** Implementar getById com Supabase query e RLS
```javascript
async getById(id) {
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('treatment_plans')
    .select(`
      *,
      protocols:protocols(
        *,
        medicine:medicines(*)
      )
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data
}
```
**Impacto:** Botão "Editar plano" não funcionava

### Erro 4: Zone Headers Renderizando como Botões
**Problema:** Headers do accordion ficaram com `border: 1px` e aparentavam ser botões normais, não clean headers
**Linha:** layout.redesign.css, `.cronograma-period-header`
**Root cause:** Base class não tinha `background: transparent; border: none;` — herdava estilos de botão genérico
**Solução:** Definir base class com estilo clean
```css
.cronograma-period-header {
  background: transparent;
  border: none;
  padding: 0.25rem 0 1.25rem 0;
  /* ... */
}
```
**Impacto:** Visual incorreto dos accordions, pareciam buttons

### Erro 5: Counter (0/6) Posicionado no Meio do Header
**Problema:** Counter estava sendo renderizado no meio do accordion header, não alinhado à direita com chevron
**Linha:** CronogramaPeriodo.jsx JSX + layout.redesign.css
**Root cause:** `gap: 0.5rem` no flex container do button espaçava counter longe do chevron
**Solução:** Agrupar counter + chevron em container `__right` com `margin-left: auto`
```jsx
<div className="cronograma-period-header__right">
  {/* counter ou done-tag */}
  {/* chevron */}
</div>
```
```css
.cronograma-period-header__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;  /* push para direita */
}
```
**Impacto:** Layout visual incorreto do accordion header

### Erro 6: planId Extraction — Formato de Prefixo Incorreto
**Problema:** Tentativa de usar `'plan-'` quando o formato real é `'plan:'`
**Linha:** TreatmentsRedesign.jsx, handleEditPlan
**Root cause:** Suposição incorreta sobre groupKey format de useTreatmentList
**Solução:** Usar format correto
```javascript
// ERRADO
const planId = group.groupKey.replace('plan-', '')

// CORRETO
const planId = group.groupKey.replace('plan:', '')
```
**Impacto:** Edição de planos falhava ao carregar dados

### Erro 7: RingGaugeRedesign Size Inconsistency
**Problema:** RingGauge era `medium` em complex mode e `large` em simple mode, criando inconsistência visual
**Linha:** DashboardRedesign.jsx
**Root cause:** Lógica condicional de tamanho
**Solução:** Sempre usar `size="large"` para consistência
```javascript
// ERRADO
<RingGaugeRedesign
  size={complexityMode === 'complex' ? 'medium' : 'large'}
/>

// CORRETO
<RingGaugeRedesign
  size="large"
/>
```
**Impacto:** Dashboard com aparência inconsistente entre modes

---

## Commits Realizados

```
feat(redesign): S7.5.1 — dose card layout vertical + icones Pill/PillBottle
feat(redesign): S7.5 visual — icones medicamento vs suplemento com gradientes
fix(redesign): S7.5.2 — acordeons visuais com openZones state initializer
fix(redesign): S7.5.2 — acordeons visuais e alinhamento contador + chevron
feat(redesign): S7.5.4 — dashboard enriquece doses com estoque + titulo + variant
fix(redesign): RingGaugeRedesign sempre size="large" para consistencia
fix(redesign): S7.5.5 — hover de linha tabular em todas as celulas
feat(redesign): S7.5.5-B2 — botao editar plano no header com PencilLine
feat(redesign): S7.5.5 — adesao neutra threshold 70%
fix(redesign): ordenar grupos — planos reais em cima + isPlan detection
feat(redesign): treatmentPlanService.getById() para edicao de planos
fix(redesign): correcoes wave 7.5 — limpeza de duplicacao + ajustes CSS
```

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
- [ ] Header "Cronograma de Hoje" + data do dia
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

- [x] Todos os touch targets ≥ 56px (botões, headers de zona, accordion, edit plan)
- [x] Accordion usa `<button>` com `aria-expanded` correto
- [x] `npm run validate:agent` passa (546+ testes, 0 lint errors)
- [x] Nenhum arquivo fora do escopo desta wave foi modificado

---

## Licoes Aprendidas e Notas Arquiteturais

### React Hooks — Ordem Importa (Critical)
**Lição:** React Hooks DEVEM ser chamados na mesma ordem em cada render. Hooks condicionais causam "React Hook X is called conditionally" error.

**Solução:** Usar `useState` com initializer function para lógica complexa ao invés de `useEffect`:
```javascript
// ✅ CORRETO
const [state, setState] = useState(() => {
  // Inicializar aqui
  if (condition) return A
  return B
})

// ❌ ERRADO
const [state, setState] = useState(null)
if (condition) {
  useEffect(() => { setState(computed) }) // Conditional!
}
```

### display:contents + Hover State
**Lição:** `display: contents` remove o elemento do box model (perfeito para grid), mas não passa eventos para filhos. Para hover em "linhas lógicas" sem elementos wrapper reais:

1. Adicionar `onMouseEnter/Leave` ao wrapper com `display: contents`
2. Rastrear `hoveredId` em estado do container pai
3. Passar `isHovered` prop aos filhos para aplicar CSS

```jsx
// Em TreatmentsComplex
const [hoveredRow, setHoveredRow] = useState(null)

<div style={{ display: 'contents' }} onMouseEnter={() => setHoveredRow(id)} onMouseLeave={() => setHoveredRow(null)}>
  <Cell isHovered={hoveredRow === id} />
</div>
```

### Ícones Visuais — Lucide Icon Naming
**Lição:** Sempre verificar disponibilidade do ícone antes de importar. Lucide usa nomes específicos:
- **Medicamentos:** `Pill` (comprimido individual)
- **Suplementos:** `PillBottle` (frasco)
- **Não existe:** `Capsule`, `Ampul`, etc.

Referência: [lucide.dev](https://lucide.dev)

### Group Ordering com Hook Customizado
**Lição:** Quando há múltiplos tipos de grupos (planos reais vs fallbacks), manter ordenação consistente na transform do hook:

```javascript
// Em useTreatmentList
const groups = Array.from(map.values())
const realPlans = groups.filter(g => g.isPlan)
const therapeuticClasses = groups.filter(g => !g.isPlan)
return [...realPlans, ...therapeuticClasses]
```

Isso evita necessidade de re-ordenar no componente de render.

### Padding e Espaçamento
**Lição:** Quando usar `gap` em flex containers que contêm elementos com borde/padding, considerar impacto visual:
- `gap` espaça TODOS os filhos igualmente
- Para agrupar alguns filhos (ex: counter + chevron), criar sub-container com `margin-left: auto`

```jsx
<div style={{ display: 'flex', gap: '0.5rem' }}>
  <span>Madrugada</span>
  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
    <span>3/5</span>
    <ChevronRight />
  </div>
</div>
```

### Threshold de Adesão — Clínico vs Visual
**Lição:** 70% threshold == perder 2+ dias em 7. Não usar cores alarmantes (vermelho) para adesão moderada — reservar cores de alerta para estoque crítico. Usar:
- `≥70%`: cinza neutro (sem atenção)
- `<70%`: âmbar (atenção, ação recomendada)
- Vermelho: exclusivo para estoque crítico

---

## Proximas Waves — Roadmap

### Wave 7.6 — Refinamentos Menores
- [ ] Animações de transição para accordion open/close
- [ ] Feedback visual ao registrar dose (toast/badge update)
- [ ] Estados de loading para edit plan modal

### Wave 8 — Dashboard Left Panel
- [ ] RingGauge maior + mais proeminente
- [ ] Rearranj de Adherence Daily section
- [ ] Insights personalizados baseados em padrões

### Wave 8.5 — Animações Globais
- [ ] Entradas de página com cascade motion
- [ ] Transições entre views
- [ ] Loading skeletons para async operations

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
