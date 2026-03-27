# Wave 7 — Treatments Redesign

**Status:** ⏳ PENDENTE EXECUÇÃO
**Data:** 2026-03-25
**Branch:** `feature/redesign/wave-7-treatments-redesign`
**Dependências:** W0–W6 + W6.5 ✅ completas
**Estimativa:** 7 sprints sequenciais (S7.1–S7.7)
**Risco:** MÉDIO — nova view, novos componentes, lógica de titulação existente reutilizada. Sem migrations de banco.
**Projeto:** [REDESIGN UX DO PACIENTE](MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md)

---

## Norte criativo desta wave

Wave 7 transforma a view de tratamentos de uma lista técnica de protocolos em uma **narrativa terapêutica personalizada**. Para **Dona Maria** (1–3 medicamentos, modo `simple`), o objetivo é clareza total: uma lista plana com o próximo horário de dose em destaque, estoque visível e um botão que leva direto ao cadastro quando algo novo precisa ser adicionado. Para **Carlos** (7+ medicamentos, modo `complex`), o objetivo é densidade *útil*: os protocolos agrupados por plano terapêutico (ex: "Cardiomiopatia — Quarteto Fantástico"), com status de titulação ativo, notas clínicas inline e indicador de adesão dos últimos 7 dias por protocolo.

Ambas as personas compartilham os mesmos dados brutos. Apenas a apresentação muda, controlada por `useComplexityMode()`.

---

## O que esta wave NÃO faz

- ❌ NÃO modifica `src/views/Protocols.jsx` — intocado
- ❌ NÃO modifica nenhum service existente (`protocolService`, `stockService`, `adherenceService`, `titrationService`, `treatmentPlanService`)
- ❌ NÃO modifica nenhum hook existente (`useDashboard`, `useDoseZones`, `useComplexityMode`)
- ❌ NÃO modifica nenhum schema Zod
- ❌ NÃO cria migrations de banco
- ❌ NÃO cria CRUD de planos de tratamento (cor/emoji já existem no banco, CRUD é Wave 8+)
- ❌ NÃO modifica `TreatmentWizard.jsx` — reusado como está

---

## Infraestrutura disponível (não recriar)

### Services a usar diretamente

| Service | Import | Uso nesta wave |
|---|---|---|
| `treatmentPlanService` | `@protocols/services/treatmentPlanService` | `getAll()` → planos com protocolos nested |
| `protocolService` | `@shared/services` | `getActive()` → protocolos com medicine + treatment_plan |
| `stockService` | `@shared/services` | `getStockSummary(medicineId)` → `{total_quantity}` |
| `adherenceService` | `@services/api/adherenceService` | `calculateAllProtocolsAdherence('7d')` → `Array<{protocolId, score}>` |
| `titrationService` | `@protocols/services/titrationService` | `getTitrationSummary(protocol)`, `isTitrationActive(protocol)`, `formatDose()`, `formatDaysRemaining()` |
| `refillPredictionService` | `@stock/services/refillPredictionService` | `predictRefill({medicineId, currentStock, logs, protocols})` → `{daysRemaining}` |

### Hooks a usar

| Hook | Import | Uso |
|---|---|---|
| `useComplexityMode()` | `@shared/hooks/useComplexityMode` | `{ isComplex }` para bifurcação de UI |
| `useMotion()` | `@shared/hooks/useMotion` | `cascade.container`, `cascade.item` para animações |
| `useDashboard()` | `@dashboard/hooks/useDashboardContext.jsx` | `{ logs, protocols, medicines, refresh }` — dados já carregados |

### Componentes a reusar

- `TreatmentWizard` (`@protocols/components/TreatmentWizard`) — aceita `preselectedMedicine` prop e `treatmentPlanId` prop
- `MedicineAutocomplete` (`@medications/components/MedicineAutocomplete`) — busca inline na base ANVISA
- `ViewSkeleton` — fallback obrigatório do Suspense

---

## Modelo de Dados — Shapes corretos

### `TreatmentItem`

Produzido por `useTreatmentList`. Representa um único protocolo com todos os dados necessários para renderização.

```js
/**
 * @typedef {Object} TreatmentItem
 * @property {string}   id                  — protocol UUID
 * @property {string}   medicineId          — medicine UUID
 * @property {string}   medicineName        — nome do medicamento
 * @property {string}   medicineType        — 'medicamento' | 'suplemento'
 * @property {string}   dosageLabel         — ex: "1 cp (50mg)" via titrationService.formatDose()
 * @property {string}   frequency           — valor raw do banco
 * @property {string}   frequencyLabel      — label PT-BR (de FREQUENCY_LABELS)
 * @property {string[]} timeSchedule        — array HH:MM
 * @property {string|null} nextDoseTime     — HH:MM da próxima dose não-registrada (ou null se todas tomadas)
 * @property {boolean}  isRegisteredToday   — true se todas as doses do dia registradas
 * @property {'critical'|'low'|'normal'|'high'} stockStatus
 * @property {number}   daysRemaining       — dias de estoque (Infinity = sem consumo/ilimitado)
 * @property {number}   adherenceScore7d    — 0–100, score dos últimos 7 dias (de calculateAllProtocolsAdherence)
 * @property {boolean}  hasTitration        — true se isTitrationActive(protocol)
 * @property {Object|null} titrationSummary — retorno de getTitrationSummary(protocol) ou null
 * @property {string|null} notes            — protocol.notes (campo livre)
 * @property {string|null} treatmentPlanId  — UUID do plano ou null
 * @property {string|null} treatmentPlanName
 * @property {string}   treatmentPlanEmoji  — default '💊'
 * @property {string}   treatmentPlanColor  — hex, default '#6366f1'
 * @property {string|null} therapeuticClass — medicine.therapeutic_class (fallback de agrupamento)
 * @property {string}   groupKey            — 'plan:{id}' | 'class:{slug}' | 'avulsos'
 * @property {string}   groupLabel          — nome humano do grupo
 * @property {boolean}  active              — protocol.active
 * @property {string|null} endDate          — YYYY-MM-DD ou null
 * @property {'ativo'|'pausado'|'finalizado'} tabStatus — derivado (ver lógica abaixo)
 */
```

### `TreatmentGroup`

Usado no modo `complex` para agrupar `TreatmentItem[]`.

```js
/**
 * @typedef {Object} TreatmentGroup
 * @property {string}          groupKey    — 'plan:{id}' | 'class:{slug}' | 'avulsos'
 * @property {string}          groupLabel  — nome visível (ex: "Cardiomiopatia — Quarteto Fantástico")
 * @property {string}          groupEmoji  — emoji do plano (ou '💊' para classes)
 * @property {string}          groupColor  — hex (do plan.color ou '#6366f1' padrão)
 * @property {TreatmentItem[]} items       — protocolos deste grupo
 * @property {boolean}         hasAlert    — true se qualquer item tem stockStatus 'critical'|'low'
 */
```

### Lógica de agrupamento

```js
// Prioridade de grupo: plano terapêutico > classe terapêutica > avulsos
function resolveGroup(protocol) {
  if (protocol.treatment_plan) {
    return {
      groupKey: `plan:${protocol.treatment_plan.id}`,
      groupLabel: protocol.treatment_plan.name,
      groupEmoji: protocol.treatment_plan.emoji || '💊',
      groupColor: protocol.treatment_plan.color || '#6366f1',
    }
  }
  if (protocol.medicine?.therapeutic_class) {
    const slug = protocol.medicine.therapeutic_class.toLowerCase().replace(/\s+/g, '-')
    return {
      groupKey: `class:${slug}`,
      groupLabel: protocol.medicine.therapeutic_class,
      groupEmoji: '💊',
      groupColor: '#6366f1',
    }
  }
  return {
    groupKey: 'avulsos',
    groupLabel: 'Medicamentos Avulsos',
    groupEmoji: '💊',
    groupColor: '#94a3b8',
  }
}
```

### Lógica de tabStatus

```js
// IMPORTANTE: usar parseLocalDate de @utils/dateUtils, NUNCA new Date('YYYY-MM-DD')
import { formatLocalDate, parseLocalDate } from '@utils/dateUtils'

function resolveTabStatus(protocol) {
  const today = formatLocalDate(new Date())
  const endDate = protocol.end_date
  if (endDate && endDate < today) return 'finalizado'
  if (protocol.active === false)  return 'pausado'
  return 'ativo'
}
```

### Frequências (mapeamento PT-BR)

```js
const FREQUENCY_LABELS = {
  diario:             'Diário',
  diário:             'Diário',          // DB salva com acento
  dias_alternados:    'Dias alternados',
  semanal:            'Semanal',
  personalizado:      'Personalizado',
  quando_necessario:  'Quando necessário',
  'quando_necessário': 'Quando necessário',
}
```

### Níveis de estoque (já definidos em CLAUDE.md — NÃO criar novos tokens)

| Status | Condição (daysRemaining) | Cor |
|---|---|---|
| `critical` | < 7 | `#ef4444` |
| `low` | < 14 | `#f59e0b` |
| `normal` | < 30 | `#22c55e` |
| `high` | ≥ 30 ou Infinity | `#3b82f6` |

---

## Layout alvo

### Mobile (<1024px) — Modo Simples (Dona Maria)

```
┌────────────────────────────────────────┐
│  Meus Tratamentos                      │
│  [🔍 Buscar na base ANVISA...]         │
│  [Ativos] [Pausados] [Finalizados]     │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ Losartana  50mg                  │  │
│  │ Diário · 08:00 · 20:00           │  │
│  │ Próxima: 20:00   ██████░░ 86%    │  │
│  │                  [22 dias ●]     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Atorvastatina  20mg              │  │
│  │ Diário · 22:00                   │  │
│  │ ✅ Todas as doses de hoje        │  │
│  │                  [45 dias ●]     │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Mobile (<1024px) — Modo Complexo (Carlos)

```
┌────────────────────────────────────────┐
│  Meus Tratamentos   5 protocolos       │
│  [🔍 Buscar na base ANVISA...]         │
│  [Ativos] [Pausados] [Finalizados]     │
├────────────────────────────────────────┤
│  💙 CARDIOMIOPATIA — QUARTETO ....  ▼  │
│  ┌──────────────────────────────────┐  │
│  │ Metoprolol     25mg              │  │
│  │ Diário · 08:00 · 20:00           │  │
│  │ ⚠ Titulação: Etapa 2/4           │  │
│  │ ██████░░ 75%  [⚠ 8 dias]         │  │
│  ├──────────────────────────────────┤  │
│  │ Dapagliflozina  10mg             │  │
│  │ Diário · 08:00                   │  │
│  │ ██████████ 100%  [30 dias ●]     │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  💊 ANTILIPÊMICOS                   ▼  │
│  ┌──────────────────────────────────┐  │
│  │ Atorvastatina  20mg              │  │
│  │ Diário · 22:00                   │  │
│  │ ██████████ 93%  [45 dias ●]      │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Desktop (≥1024px) — Modo Complexo

```
┌──────────────────────────────────────────────────────────────────┐
│  Meus Tratamentos                          5 protocolos ativos   │
│  [🔍 Buscar na base ANVISA...]  [Ativos] [Pausados] [Finalizados]│
├──────────────┬────────────┬─────────┬──────────────┬─────────────┤
│  Medicamento │  Posologia │  Freq.  │  Adesão 7d   │  Estoque    │
├──────────────┴────────────┴─────────┴──────────────┴─────────────┤
│  💙 CARDIOMIOPATIA — QUARTETO FANTÁSTICO                         │
├──────────────┬────────────┬─────────┬───────────────┬────────────┤
│  Metoprolol  │  1cp 25mg  │  1×/dia │  ██████░  75% │  ⚠ 8 dias  │
│  ⚠ Titulação: Etapa 2/4 · próxima etapa em 6 dias                │
├──────────────┼────────────┼─────────┼───────────────┼────────────┤
│  Dapagliflo. │  1cp 10mg  │  1×/dia │  ██████████   │ ● 30 dias  │
├──────────────┴────────────┴─────────┴───────────────┴────────────┤
│  💊 ANTILIPÊMICOS                                                │
├──────────────┬────────────┬─────────┬───────────────┬────────────┤
│  Atorvastati.│  1cp 20mg  │  1×/dia │  █████████░   │ ● 45 dias  │
└──────────────┴────────────┴─────────┴───────────────┴────────────┘
```

---

## Sprint S7.1 — Hook `useTreatmentList`

**Arquivo a criar:** `src/features/protocols/hooks/useTreatmentList.js`

### Responsabilidade

Buscar e agregar todos os dados necessários para renderizar a view de tratamentos:
- Todos os protocolos do usuário (ativos + pausados + finalizados)
- Dados de estoque por medicamento
- Score de adesão 7d por protocolo
- Sumário de titulação por protocolo (onde aplicável)
- Dados estruturados em `TreatmentItem[]` e `TreatmentGroup[]`

### Estratégia de fetching

Este hook faz **4 queries em paralelo** via `Promise.all`. Não usar `useDashboard()` para os protocolos porque `protocolService.getActive()` filtra por `active=true` — aqui precisamos de TODOS os protocolos.

```js
// src/features/protocols/hooks/useTreatmentList.js
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, getUserId } from '@shared/utils/supabase'
import { adherenceService } from '@services/api/adherenceService'
import { stockService } from '@shared/services'
import { predictRefill } from '@stock/services/refillPredictionService'
import { getTitrationSummary, isTitrationActive, formatDose } from '@protocols/services/titrationService'
import { formatLocalDate, parseLocalDate } from '@utils/dateUtils'

const FREQUENCY_LABELS = {
  diario: 'Diário', diário: 'Diário',
  dias_alternados: 'Dias alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessario: 'Quando necessário',
  'quando_necessário': 'Quando necessário',
}

const STOCK_STATUS_COLORS = {
  critical: '#ef4444', low: '#f59e0b', normal: '#22c55e', high: '#3b82f6'
}

function getStockStatus(daysRemaining) {
  if (!isFinite(daysRemaining)) return 'high'
  if (daysRemaining < 7)  return 'critical'
  if (daysRemaining < 14) return 'low'
  if (daysRemaining < 30) return 'normal'
  return 'high'
}

function resolveTabStatus(protocol) {
  const today = formatLocalDate(new Date())
  if (protocol.end_date && protocol.end_date < today) return 'finalizado'
  if (protocol.active === false) return 'pausado'
  return 'ativo'
}

function resolveGroup(protocol) {
  if (protocol.treatment_plan) {
    return {
      groupKey: `plan:${protocol.treatment_plan.id}`,
      groupLabel: protocol.treatment_plan.name,
      groupEmoji: protocol.treatment_plan.emoji || '💊',
      groupColor: protocol.treatment_plan.color || '#6366f1',
    }
  }
  if (protocol.medicine?.therapeutic_class) {
    const slug = protocol.medicine.therapeutic_class.toLowerCase().replace(/\s+/g, '-')
    return {
      groupKey: `class:${slug}`,
      groupLabel: protocol.medicine.therapeutic_class,
      groupEmoji: '💊',
      groupColor: '#6366f1',
    }
  }
  return {
    groupKey: 'avulsos',
    groupLabel: 'Medicamentos Avulsos',
    groupEmoji: '💊',
    groupColor: '#94a3b8',
  }
}

export function useTreatmentList() {
  // 1. States
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  // 2. Fetch
  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = await getUserId()

      // Query 1: Todos os protocolos (ativos + pausados + finalizados)
      const { data: protocols, error: pErr } = await supabase
        .from('protocols')
        .select('*, medicine:medicines(*), treatment_plan:treatment_plans(id, name, emoji, color)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (pErr) throw pErr

      // Query 2: Adesão 7d por protocolo
      // calculateAllProtocolsAdherence retorna Array<{protocolId, name, score}>
      const adherenceList = await adherenceService.calculateAllProtocolsAdherence('7d', userId)
      const adherenceMap = Object.fromEntries(
        (adherenceList || []).map(a => [a.protocolId, a.score ?? 0])
      )

      // Query 3: Estoque por medicine_id único
      const uniqueMedicineIds = [...new Set(protocols.map(p => p.medicine_id))]
      const stockSummaries = await Promise.all(
        uniqueMedicineIds.map(id => stockService.getStockSummary(id))
      )
      const stockMap = Object.fromEntries(
        stockSummaries.map(s => [s.medicine_id, s.total_quantity || 0])
      )

      // Montar TreatmentItem[]
      const today = formatLocalDate(new Date())
      const allItems = protocols.map(p => {
        const groupInfo   = resolveGroup(p)
        const tabStatus   = resolveTabStatus(p)
        const totalStock  = stockMap[p.medicine_id] ?? 0
        const titSummary  = getTitrationSummary(p)
        const hasTitration = isTitrationActive(p)

        // Calcular daysRemaining via predictRefill (sem logs neste hook — usa cálculo teórico)
        const { daysRemaining } = predictRefill({
          medicineId: p.medicine_id,
          currentStock: totalStock,
          logs: [],           // zero logs = fallback para consumo teórico (confidence: low)
          protocols: [p],
        })

        const dosageLabel = formatDose(
          p.dosage_per_intake,
          p.medicine?.dosage_unit || 'mg',
          p.medicine?.dosage_per_pill
        )

        // Próxima dose não-registrada (simplificado — comparar timeSchedule com hora atual)
        const now = new Date()
        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        const times = Array.isArray(p.time_schedule) ? p.time_schedule : []
        const nextDoseTime = times.find(t => t > currentHHMM) || null

        return {
          id: p.id,
          medicineId: p.medicine_id,
          medicineName: p.medicine?.name || p.name,
          medicineType: p.medicine?.type || 'medicamento',
          dosageLabel,
          frequency: p.frequency,
          frequencyLabel: FREQUENCY_LABELS[p.frequency] || p.frequency,
          timeSchedule: times,
          nextDoseTime,
          isRegisteredToday: false,    // placeholder — Wave 8 integrará com logs do dia
          stockStatus: getStockStatus(daysRemaining),
          daysRemaining,
          adherenceScore7d: adherenceMap[p.id] ?? 0,
          hasTitration,
          titrationSummary: titSummary,
          notes: p.notes || null,
          treatmentPlanId: p.treatment_plan?.id || null,
          treatmentPlanName: p.treatment_plan?.name || null,
          treatmentPlanEmoji: p.treatment_plan?.emoji || '💊',
          treatmentPlanColor: p.treatment_plan?.color || '#6366f1',
          therapeuticClass: p.medicine?.therapeutic_class || null,
          ...groupInfo,
          active: p.active,
          endDate: p.end_date || null,
          tabStatus,
        }
      })

      setItems(allItems)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // 3. Effects
  useEffect(() => { fetchAll() }, [fetchAll])

  // 4. Derived
  const activeItems    = useMemo(() => items.filter(i => i.tabStatus === 'ativo'),      [items])
  const pausedItems    = useMemo(() => items.filter(i => i.tabStatus === 'pausado'),    [items])
  const finishedItems  = useMemo(() => items.filter(i => i.tabStatus === 'finalizado'), [items])

  // Grupos para modo complexo (apenas itens ativos)
  const groups = useMemo(() => {
    const map = new Map()
    for (const item of activeItems) {
      if (!map.has(item.groupKey)) {
        map.set(item.groupKey, {
          groupKey: item.groupKey,
          groupLabel: item.groupLabel,
          groupEmoji: item.groupEmoji,
          groupColor: item.groupColor,
          items: [],
          hasAlert: false,
        })
      }
      const g = map.get(item.groupKey)
      g.items.push(item)
      if (item.stockStatus === 'critical' || item.stockStatus === 'low') g.hasAlert = true
    }
    return Array.from(map.values())
  }, [activeItems])

  return {
    items, activeItems, pausedItems, finishedItems,
    groups,
    loading, error,
    refetch: fetchAll,
  }
}
```

> **Nota sobre `isRegisteredToday`:** Nesta wave, este campo é sempre `false` (placeholder). Para integrar com os logs do dia, Wave 8+ pode enriquecer o hook usando `useDashboard().logs` após garantir que `DashboardProvider` engloba a view redesenhada. Não bloqueia a entrega desta wave.

> **Nota sobre `predictRefill` sem logs:** Passar `logs: []` significa que `predictRefill` vai usar consumo teórico baseado nos protocolos (confidence: 'low'). É aceitável para esta wave. Para alta fidelidade, Wave 8+ pode passar os logs reais do `useDashboard()`.

---

## Sprint S7.2 — Sub-componentes compartilhados

Todos os arquivos abaixo ficam em `src/features/protocols/components/redesign/`.

### S7.2.1 — `AdherenceBar7d.jsx`

```jsx
// src/features/protocols/components/redesign/AdherenceBar7d.jsx
export default function AdherenceBar7d({ score }) {
  const pct = Math.round(Math.max(0, Math.min(100, score ?? 0)))
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="adherence-bar7d" title={`Adesão 7d: ${pct}%`}>
      <div className="adherence-bar7d__track">
        <div className="adherence-bar7d__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="adherence-bar7d__label" style={{ color }}>{pct}%</span>
    </div>
  )
}
```

CSS (adicionar em `src/shared/styles/layout.redesign.css` no Sprint S7.7):
```css
.adherence-bar7d { display: flex; align-items: center; gap: 0.5rem; }
.adherence-bar7d__track { flex: 1; height: 6px; border-radius: 3px; background: var(--color-outline-variant, #cac4d0); overflow: hidden; }
.adherence-bar7d__fill  { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.adherence-bar7d__label { font-size: 0.75rem; font-weight: 600; min-width: 2.5rem; text-align: right; }
```

### S7.2.2 — `StockPill.jsx`

```jsx
// src/features/protocols/components/redesign/StockPill.jsx
const STATUS_CONFIG = {
  critical: { color: '#ef4444', bg: '#fef2f2', dot: '🔴', label: 'Crítico' },
  low:      { color: '#f59e0b', bg: '#fffbeb', dot: '🟡', label: 'Baixo'   },
  normal:   { color: '#22c55e', bg: '#f0fdf4', dot: '🟢', label: 'OK'      },
  high:     { color: '#3b82f6', bg: '#eff6ff', dot: '🔵', label: 'OK'      },
}

export default function StockPill({ status, daysRemaining }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.normal
  const label = isFinite(daysRemaining) ? `${daysRemaining} dias` : '∞'
  return (
    <span
      className="stock-pill"
      style={{ color: cfg.color, background: cfg.bg }}
      title={`Estoque: ${label}`}
    >
      {cfg.dot} {label}
    </span>
  )
}
```

CSS:
```css
.stock-pill { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
```

### S7.2.3 — `TitrationBadge.jsx`

Exibido apenas quando `hasTitration === true`. Usa dados de `titrationSummary`.

```jsx
// src/features/protocols/components/redesign/TitrationBadge.jsx
import { formatDaysRemaining } from '@protocols/services/titrationService'

export default function TitrationBadge({ summary }) {
  if (!summary) return null
  const { currentStep, totalSteps, daysUntilNext, progressPercent } = summary
  return (
    <div className="titration-badge">
      <span className="titration-badge__icon">⚠</span>
      <span className="titration-badge__text">
        Titulação: Etapa {currentStep}/{totalSteps}
      </span>
      {daysUntilNext > 0 && (
        <span className="titration-badge__sub">
          · próxima em {formatDaysRemaining(daysUntilNext)}
        </span>
      )}
      {progressPercent > 0 && (
        <div className="titration-badge__progress">
          <div style={{ width: `${progressPercent}%` }} />
        </div>
      )}
    </div>
  )
}
```

CSS:
```css
.titration-badge { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: #fefce8; border: 1px solid #fde047; border-radius: var(--radius-sm, 6px); font-size: 0.75rem; }
.titration-badge__icon  { color: #ca8a04; }
.titration-badge__text  { font-weight: 600; color: #854d0e; }
.titration-badge__sub   { color: #78716c; }
.titration-badge__progress { flex: 0 0 100%; height: 4px; border-radius: 2px; background: #fde047; overflow: hidden; margin-top: 2px; }
.titration-badge__progress div { height: 100%; background: #ca8a04; border-radius: 2px; }
```

### S7.2.4 — `ProtocolRow.jsx`

Card reutilizável para ambos os modos. No modo `complex`, recebe `showGroup={false}` pois o header do grupo já é exibido pelo pai.

**Props:**
- `item: TreatmentItem` — dados completos
- `isComplex: boolean` — habilita titulação + notas expandíveis
- `expanded: boolean` — estado de expansão (controlado pelo pai)
- `onToggleExpand: () => void`

**Comportamento collapsed:**
- Linha 1: `medicineName` + `dosageLabel`
- Linha 2: `frequencyLabel` · horários (`timeSchedule.join(' / ')`)
- Linha 3: `AdherenceBar7d` (score 7d) + `StockPill` (status + dias)
- Chevron no canto direito se `isComplex && (hasTitration || notes)`

**Comportamento expanded (AnimatePresence, apenas modo complex):**
- `TitrationBadge` (se `hasTitration`)
- Parágrafo de notas clínicas (se `notes !== null`)
- Texto da nota em `font-size: 0.8125rem`, cor `--color-on-surface-variant`

**Mínimo de touch target:** `min-height: 3.5rem` (56px) para a área clicável principal.

```jsx
// src/features/protocols/components/redesign/ProtocolRow.jsx
import { AnimatePresence } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'
import AdherenceBar7d from './AdherenceBar7d'
import StockPill from './StockPill'
import TitrationBadge from './TitrationBadge'

export default function ProtocolRow({ item, isComplex, expanded, onToggleExpand }) {
  const { cascade } = useMotion()
  const canExpand = isComplex && (item.hasTitration || item.notes)

  return (
    <div className="protocol-row">
      <button
        className="protocol-row__main"
        onClick={canExpand ? onToggleExpand : undefined}
        aria-expanded={canExpand ? expanded : undefined}
        style={{ minHeight: '3.5rem' }}
      >
        <div className="protocol-row__header">
          <span className="protocol-row__name">{item.medicineName}</span>
          <span className="protocol-row__dosage">{item.dosageLabel}</span>
        </div>
        <div className="protocol-row__schedule">
          {item.frequencyLabel}
          {item.timeSchedule.length > 0 && ` · ${item.timeSchedule.join(' / ')}`}
        </div>
        <div className="protocol-row__metrics">
          <AdherenceBar7d score={item.adherenceScore7d} />
          <StockPill status={item.stockStatus} daysRemaining={item.daysRemaining} />
        </div>
        {canExpand && (
          <span className="protocol-row__chevron" aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && canExpand && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="protocol-row__details"
          >
            {item.hasTitration && <TitrationBadge summary={item.titrationSummary} />}
            {item.notes && (
              <p className="protocol-row__notes">{item.notes}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

> **Nota de import:** `motion` deve ser importado de `framer-motion` diretamente em `ProtocolRow.jsx`. `useMotion()` é importado de `@shared/hooks/useMotion` para animações de lista no pai.

### S7.2.5 — `TreatmentPlanHeader.jsx`

Header colorido de grupo (apenas modo `complex`).

```jsx
// src/features/protocols/components/redesign/TreatmentPlanHeader.jsx
export default function TreatmentPlanHeader({ group, isCollapsed, onToggle }) {
  return (
    <button className="plan-header" onClick={onToggle} style={{ '--plan-color': group.groupColor }}>
      <span className="plan-header__dot" style={{ background: group.groupColor }} />
      <span className="plan-header__emoji">{group.groupEmoji}</span>
      <span className="plan-header__label">{group.groupLabel}</span>
      <span className="plan-header__count">{group.items.length}×</span>
      {group.hasAlert && <span className="plan-header__alert">⚠</span>}
      <span className="plan-header__chevron">{isCollapsed ? '▼' : '▲'}</span>
    </button>
  )
}
```

---

## Sprint S7.3 — Modo Simples: `TreatmentsSimple.jsx`

**Arquivo a criar:** `src/views/redesign/TreatmentsSimple.jsx`

**Persona:** Dona Maria. Lista plana sem agrupamento visual de grupos. Foco no próximo horário e no estoque.

**Recebe props:** `{ items, onOpenWizard }` — já filtrados pelo tab ativo no pai.

```jsx
// src/views/redesign/TreatmentsSimple.jsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'
import ProtocolRow from '@protocols/components/redesign/ProtocolRow'

export default function TreatmentsSimple({ items }) {
  const { cascade } = useMotion()
  const [expanded, setExpanded] = useState(null)

  if (items.length === 0) {
    return (
      <div className="treatments-simple__empty">
        <p>Nenhum tratamento ativo no momento.</p>
      </div>
    )
  }

  return (
    <motion.ul
      className="treatments-simple__list"
      variants={cascade.container}
      initial="hidden"
      animate="visible"
    >
      {items.map(item => (
        <motion.li key={item.id} variants={cascade.item}>
          <ProtocolRow
            item={item}
            isComplex={false}
            expanded={expanded === item.id}
            onToggleExpand={() => setExpanded(prev => prev === item.id ? null : item.id)}
          />
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

CSS class `.treatments-simple__list`: `list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem;`

---

## Sprint S7.4 — Modo Complexo: `TreatmentsComplex.jsx`

**Arquivo a criar:** `src/views/redesign/TreatmentsComplex.jsx`

**Persona:** Carlos. Grupos colapsáveis por plano/classe, com header colorido e protocolo rows expandíveis.

**Recebe props:** `{ groups, pausedItems, finishedItems, activeTab }` — onde `groups` é o array de `TreatmentGroup[]` para a tab ativa.

```jsx
// src/views/redesign/TreatmentsComplex.jsx
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'
import TreatmentPlanHeader from '@protocols/components/redesign/TreatmentPlanHeader'
import ProtocolRow from '@protocols/components/redesign/ProtocolRow'

export default function TreatmentsComplex({ groups, flatItems }) {
  const { cascade } = useMotion()
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [expandedRow, setExpandedRow] = useState(null)

  const toggleGroup = (key) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  if (groups.length === 0) {
    return (
      <div className="treatments-complex__empty">
        <p>Nenhum tratamento nesta categoria.</p>
      </div>
    )
  }

  return (
    <motion.div
      className="treatments-complex"
      variants={cascade.container}
      initial="hidden"
      animate="visible"
    >
      {groups.map(group => {
        const isCollapsed = collapsedGroups.has(group.groupKey)
        return (
          <motion.section key={group.groupKey} variants={cascade.item} className="treatments-complex__group">
            <TreatmentPlanHeader
              group={group}
              isCollapsed={isCollapsed}
              onToggle={() => toggleGroup(group.groupKey)}
            />
            {!isCollapsed && (
              <div className="treatments-complex__rows">
                {group.items.map(item => (
                  <ProtocolRow
                    key={item.id}
                    item={item}
                    isComplex={true}
                    expanded={expandedRow === item.id}
                    onToggleExpand={() => setExpandedRow(prev => prev === item.id ? null : item.id)}
                  />
                ))}
              </div>
            )}
          </motion.section>
        )
      })}
    </motion.div>
  )
}
```

### Desktop layout (≥1024px) — apenas no modo complexo

Dentro de `TreatmentsComplex`, quando a viewport é desktop, adicionar classe `.treatments-complex--desktop` via CSS. O layout desktop usa:

```css
@media (min-width: 1024px) {
  .treatments-complex--desktop .treatments-complex__rows {
    display: table;
    width: 100%;
    border-collapse: collapse;
  }
  /* ProtocolRow em modo tabular: nome | posologia | frequência | adesão | estoque */
}
```

> **Nota de implementação:** Para o layout tabular desktop, o `ProtocolRow` deve detectar a prop `tableLayout={true}` (passada pelo pai quando `isDesktop`) e renderizar células `<td>` em vez de `<div>` livres. O CSS garante alinhamento colunar. Esta adaptação é um refinamento — o layout de cards verticais é aceitável como entrega inicial, com o tabular como aprimoramento dentro do mesmo sprint.

---

## Sprint S7.5 — Tabs + ANVISA Search

### S7.5.1 — `TreatmentTabBar.jsx`

**Arquivo a criar:** `src/features/protocols/components/redesign/TreatmentTabBar.jsx`

```jsx
// src/features/protocols/components/redesign/TreatmentTabBar.jsx
const TABS = [
  { key: 'ativos',      label: 'Ativos'      },
  { key: 'pausados',    label: 'Pausados'    },
  { key: 'finalizados', label: 'Finalizados' },
]

export default function TreatmentTabBar({ activeTab, counts, onChange }) {
  return (
    <div className="treatment-tab-bar" role="tablist">
      {TABS.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          className={`treatment-tab-bar__tab${activeTab === tab.key ? ' treatment-tab-bar__tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
          style={{ minHeight: '2.5rem' }}
        >
          {tab.label}
          {counts[tab.key] > 0 && (
            <span className="treatment-tab-bar__count">{counts[tab.key]}</span>
          )}
        </button>
      ))}
    </div>
  )
}
```

CSS:
```css
.treatment-tab-bar { display: flex; gap: 0.25rem; padding: 0.25rem; background: var(--color-surface-container, #ece6f0); border-radius: var(--radius-lg, 12px); }
.treatment-tab-bar__tab { flex: 1; padding: 0.375rem 0.75rem; border-radius: var(--radius-md, 8px); border: none; background: transparent; color: var(--color-on-surface-variant, #49454f); font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: background 0.15s, color 0.15s; display: flex; align-items: center; justify-content: center; gap: 0.375rem; }
.treatment-tab-bar__tab--active { background: var(--color-surface, #fff); color: var(--color-primary, #006a5e); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.treatment-tab-bar__count { display: inline-flex; align-items: center; justify-content: center; min-width: 1.25rem; height: 1.25rem; padding: 0 0.3rem; background: var(--color-secondary-container, #cce8e0); color: var(--color-on-secondary-container, #00201c); border-radius: 9999px; font-size: 0.6875rem; font-weight: 700; }
```

### S7.5.2 — `AnvisaSearchBar.jsx`

**Arquivo a criar:** `src/features/protocols/components/redesign/AnvisaSearchBar.jsx`

Reutiliza `MedicineAutocomplete` (que já busca na base ANVISA) com lógica de routing no `onSelect`.

**Props recebidas do pai:**
- `existingProtocols: TreatmentItem[]` — para checar se o medicamento já tem protocolo
- `onNavigateToProtocol: (item: TreatmentItem) => void` — navegar para editar protocolo existente
- `onOpenWizard: (medicine: object) => void` — abrir TreatmentWizard com preselectedMedicine

```jsx
// src/features/protocols/components/redesign/AnvisaSearchBar.jsx
import MedicineAutocomplete from '@medications/components/MedicineAutocomplete'

export default function AnvisaSearchBar({ existingProtocols, onNavigateToProtocol, onOpenWizard }) {
  const [query, setQuery] = useState('')

  function handleSelect(anvisaMedicine) {
    // anvisaMedicine: { name, activeIngredient, therapeuticClass, ... } (ANVISA DB shape)
    // Verificar se já existe protocolo para este medicamento (match por nome, case-insensitive)
    const match = existingProtocols.find(
      item => item.medicineName.toLowerCase() === anvisaMedicine.name.toLowerCase()
    )
    if (match) {
      // Protocolo existente → navegar para edição
      onNavigateToProtocol(match)
    } else {
      // Sem protocolo → abrir TreatmentWizard com medicamento pré-selecionado
      onOpenWizard({
        name: anvisaMedicine.name,
        active_ingredient: anvisaMedicine.activeIngredient || null,
        therapeutic_class: anvisaMedicine.therapeuticClass || null,
        // dosage_per_pill não está disponível na ANVISA DB — usuário preenche no wizard
      })
    }
    setQuery('')
  }

  return (
    <div className="anvisa-search-bar">
      <MedicineAutocomplete
        value={query}
        onChange={setQuery}
        onSelect={handleSelect}
        placeholder="Buscar na base ANVISA..."
      />
    </div>
  )
}
```

CSS:
```css
.anvisa-search-bar { position: relative; }
.anvisa-search-bar input { width: 100%; padding: 0.625rem 1rem; border-radius: var(--radius-xl, 20px); border: 1.5px solid var(--color-outline-variant, #cac4d0); background: var(--color-surface-container-low, #f7f2fa); font-size: 0.9375rem; }
```

---

## Sprint S7.6 — Orquestração: `TreatmentsRedesign.jsx`

**Arquivo a criar:** `src/views/redesign/TreatmentsRedesign.jsx`

Esta view orquestra tudo: carrega dados via `useTreatmentList`, gerencia tab ativa, controla modal do wizard, bifurca entre `TreatmentsSimple` e `TreatmentsComplex`.

```jsx
// src/views/redesign/TreatmentsRedesign.jsx
import { useState, lazy, Suspense } from 'react'
import { useComplexityMode } from '@shared/hooks/useComplexityMode'
import { useTreatmentList } from '@protocols/hooks/useTreatmentList'
import TreatmentTabBar from '@protocols/components/redesign/TreatmentTabBar'
import AnvisaSearchBar from '@protocols/components/redesign/AnvisaSearchBar'
import TreatmentsSimple from './TreatmentsSimple'
import TreatmentsComplex from './TreatmentsComplex'
import ViewSkeleton from '@shared/components/ui/ViewSkeleton'
import TreatmentWizard from '@protocols/components/TreatmentWizard'
import './TreatmentsRedesign.css'

export default function TreatmentsRedesign({ onNavigateToProtocol }) {
  // 1. States
  const [activeTab, setActiveTab]         = useState('ativos')
  const [wizardOpen, setWizardOpen]       = useState(false)
  const [wizardMedicine, setWizardMedicine] = useState(null)

  // 2. Data + context
  const { isComplex } = useComplexityMode()
  const { activeItems, pausedItems, finishedItems, groups, loading, error, refetch } =
    useTreatmentList()

  // 3. Memos — item list por tab
  const tabItems = {
    ativos:      activeItems,
    pausados:    pausedItems,
    finalizados: finishedItems,
  }
  const currentItems = tabItems[activeTab] || []

  // 4. Handlers
  function handleOpenWizard(medicine) {
    setWizardMedicine(medicine)
    setWizardOpen(true)
  }

  function handleWizardComplete() {
    setWizardOpen(false)
    setWizardMedicine(null)
    refetch()
  }

  if (loading) return <ViewSkeleton />
  if (error)   return <div className="treatments-redesign__error">Erro ao carregar tratamentos: {error}</div>

  return (
    <div className="treatments-redesign" data-redesign="true">
      {/* Header */}
      <header className="treatments-redesign__header">
        <h1 className="treatments-redesign__title">Meus Tratamentos</h1>
        <span className="treatments-redesign__count">
          {activeItems.length} protocolo{activeItems.length !== 1 ? 's' : ''} ativo{activeItems.length !== 1 ? 's' : ''}
        </span>
      </header>

      {/* ANVISA Search */}
      <AnvisaSearchBar
        existingProtocols={activeItems}
        onNavigateToProtocol={onNavigateToProtocol}
        onOpenWizard={handleOpenWizard}
      />

      {/* Tab Bar */}
      <TreatmentTabBar
        activeTab={activeTab}
        counts={{ ativos: activeItems.length, pausados: pausedItems.length, finalizados: finishedItems.length }}
        onChange={setActiveTab}
      />

      {/* Content — bifurca por persona */}
      {isComplex ? (
        <TreatmentsComplex
          groups={activeTab === 'ativos' ? groups : []}
          flatItems={currentItems}
        />
      ) : (
        <TreatmentsSimple items={currentItems} />
      )}

      {/* TreatmentWizard modal */}
      {wizardOpen && (
        <div className="treatments-redesign__modal-overlay">
          <div className="treatments-redesign__modal">
            <TreatmentWizard
              preselectedMedicine={wizardMedicine}
              onComplete={handleWizardComplete}
              onCancel={() => { setWizardOpen(false); setWizardMedicine(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

> **Nota:** `onNavigateToProtocol` é passado pelo `App.jsx` como handler que chama `setCurrentView('protocols')` + eventualmente passa o protocolId para a view original abrir em modo edição. Implementar o handler no App.jsx conforme Sprint S7.6.2 abaixo.

### S7.6.2 — Wiring em `App.jsx`

**Arquivo a modificar:** `src/App.jsx`

Seguir exatamente o padrão usado para `DashboardRedesign`:

1. Adicionar lazy import:
```js
const TreatmentsRedesign = lazy(() => import('./views/redesign/TreatmentsRedesign'))
```

2. Na seção de renderização de views, onde é renderizado `Protocols` (view `'protocols'`), adicionar renderização condicional:
```jsx
{currentView === 'protocols' && (
  <Suspense fallback={<ViewSkeleton />}>
    {useRedesignFlag
      ? <TreatmentsRedesign onNavigateToProtocol={(item) => {
          // Navegar para a view de protocolos original com o protocolo selecionado
          setCurrentView('protocols')
          // Se a view original aceitar um selectedProtocolId prop, passar item.id aqui
        }} />
      : <Protocols {...protocolsProps} />
    }
  </Suspense>
)}
```

> Verificar como `useRedesignFlag` / `?redesign=1` é detectado no App.jsx atual e seguir o mesmo padrão. Não criar nova forma de ler o feature flag.

---

## Sprint S7.7 — CSS + Motion Language

**Arquivo a modificar:** `src/shared/styles/layout.redesign.css`

Adicionar ao final do arquivo (não antes dos blocos @media existentes):

```css
/* ============================================================
   Wave 7 — Treatments Redesign
   ============================================================ */

/* Container principal */
.treatments-redesign {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Header */
.treatments-redesign__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.treatments-redesign__title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-on-surface, #1c1b1f);
  margin: 0;
}

.treatments-redesign__count {
  font-size: 0.875rem;
  color: var(--color-on-surface-variant, #49454f);
}

/* ProtocolRow */
.protocol-row {
  background: var(--color-surface, #fff);
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.protocol-row__main {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.875rem 1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.protocol-row__header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.protocol-row__name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-on-surface, #1c1b1f);
}

.protocol-row__dosage {
  font-size: 0.8125rem;
  color: var(--color-on-surface-variant, #49454f);
}

.protocol-row__schedule {
  font-size: 0.8125rem;
  color: var(--color-on-surface-variant, #49454f);
}

.protocol-row__metrics {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.protocol-row__chevron {
  align-self: flex-end;
  font-size: 0.625rem;
  color: var(--color-on-surface-variant, #49454f);
}

.protocol-row__details {
  padding: 0 1rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: hidden;
}

.protocol-row__notes {
  font-size: 0.8125rem;
  color: var(--color-on-surface-variant, #49454f);
  line-height: 1.5;
  margin: 0;
  padding: 0.375rem 0.5rem;
  border-left: 2px solid var(--color-outline-variant, #cac4d0);
}

/* TreatmentPlanHeader */
.plan-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-container-low, #f7f2fa);
  border: none;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  text-align: left;
}

.plan-header__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.plan-header__emoji { font-size: 1rem; }

.plan-header__label {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-on-surface, #1c1b1f);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.plan-header__count {
  font-size: 0.75rem;
  color: var(--color-on-surface-variant, #49454f);
}

.plan-header__alert { color: #f59e0b; font-size: 0.875rem; }
.plan-header__chevron { font-size: 0.625rem; color: var(--color-on-surface-variant, #49454f); }

/* Group section */
.treatments-complex__group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.treatments-complex__rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 0.5rem;
}

/* Modal overlay (wizard) */
.treatments-redesign__modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.treatments-redesign__modal {
  width: 100%;
  max-width: 480px;
  max-height: 90dvh;
  overflow-y: auto;
  background: var(--color-surface, #fff);
  border-radius: var(--radius-xl, 20px) var(--radius-xl, 20px) 0 0;
  padding: 1.5rem 1rem;
}

/* Desktop */
@media (min-width: 1024px) {
  .treatments-redesign {
    padding: 1.5rem 2rem;
  }

  .treatments-redesign__modal-overlay {
    align-items: center;
  }

  .treatments-redesign__modal {
    border-radius: var(--radius-xl, 20px);
    max-height: 85dvh;
  }

  /* Layout tabular do modo complexo no desktop */
  .treatments-complex--desktop .treatments-complex__rows {
    padding-left: 0;
  }

  .treatments-complex--desktop .protocol-row {
    border-radius: 0;
    box-shadow: none;
    border-bottom: 1px solid var(--color-outline-variant, #cac4d0);
  }

  .treatments-complex--desktop .protocol-row__main {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }

  .treatments-complex--desktop .protocol-row__header {
    flex: 2;
    flex-direction: column;
    gap: 0.125rem;
  }

  .treatments-complex--desktop .protocol-row__schedule {
    flex: 1.5;
  }

  .treatments-complex--desktop .protocol-row__metrics {
    flex: 3;
    flex-wrap: nowrap;
  }
}

/* Empty states */
.treatments-simple__empty,
.treatments-complex__empty,
.treatments-redesign__error {
  padding: 2rem;
  text-align: center;
  color: var(--color-on-surface-variant, #49454f);
  font-size: 0.9375rem;
}
```

---

## Critérios de conclusão — Wave 7

### Funcionalidade
- [ ] `useTreatmentList` busca protocolos (todos: ativos + pausados + finalizados) via Supabase direto
- [ ] Agrupamento correto: plano terapêutico → `therapeutic_class` → "Avulsos" (sem keyword map)
- [ ] `tabStatus` derivado corretamente: `end_date < today` → finalizado; `active=false` → pausado; resto → ativo
- [ ] Tabs Ativos/Pausados/Finalizados funcionais com contadores
- [ ] `AdherenceBar7d` exibe score dos últimos 7 dias (via `calculateAllProtocolsAdherence('7d')`)
- [ ] `StockPill` exibe status correto (critical/low/normal/high) com dias restantes
- [ ] `TitrationBadge` aparece apenas quando `isTitrationActive(protocol) === true`
- [ ] Linhas expandíveis (modo complex) revelam titulação e notas clínicas
- [ ] Busca ANVISA: resultados inline; click → protocolo existente abre edição; sem protocolo → `TreatmentWizard` com `preselectedMedicine`
- [ ] `TreatmentWizard` renderizado em modal overlay, não em nova view
- [ ] Modo simples: lista plana sem headers de grupo
- [ ] Modo complexo: grupos com headers colapsáveis
- [ ] Desktop (≥1024px): layout mais denso com linhas horizontais
- [ ] Protocolos finalizados (tab): read-only, sem ações de tomada de dose

### Qualidade
- [ ] `parseLocalDate()` usado para comparar `end_date` — NUNCA `new Date('YYYY-MM-DD')`
- [ ] `TreatmentsRedesign` lazy-loaded com `React.lazy()` + `Suspense` + `ViewSkeleton`
- [ ] Touch targets ≥ 56px para todas as áreas clicáveis (`min-height: 3.5rem`)
- [ ] Animações usam `useMotion().cascade` — `prefers-reduced-motion` já tratado pelo hook
- [ ] Sem keyword map de categorias clínicas no código — agrupamento via dados reais
- [ ] `npm run validate:agent` passa sem erros
- [ ] View original `Protocols.jsx` intocada — feature flag separa as versões

### Não-regressão
- [ ] View original `?redesign=0` ainda funciona corretamente
- [ ] Nenhum service existente foi modificado
- [ ] Dashboard não foi afetado

---

## Dívida técnica conhecida (Wave 8+)

| Item | Motivo do adiamento |
|---|---|
| `isRegisteredToday` sempre `false` | Integrar com `useDashboard().logs` requer garantir que `DashboardProvider` engloba TreatmentsRedesign — verificar escopo do Provider |
| `predictRefill` com `logs: []` | Para alta confiança, passar logs reais do DashboardProvider |
| CRUD de cor/emoji de planos terapêuticos | Campos existem no DB, mas sem UI de edição — Wave 8+ |
| Busca ANVISA: match por nome pode falhar com variações | Melhorar para match por `medicine_id` quando possível |
| Layout tabular desktop com `<table>` semântico | Implementado como flexbox para simplificar — Wave 8 pode migrar para table com `<thead>` |
