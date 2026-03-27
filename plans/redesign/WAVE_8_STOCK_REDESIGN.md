# Wave 8 — Estoque Redesign: Santuário Terapêutico

**Status:** ⏳ PENDENTE IMPLEMENTAÇÃO
**Data de criação da spec:** 2026-03-26
**Dependências:** W0 ✅ W1 ✅ W2 ✅ W3 ✅ W4 ✅ W5 ✅ W6 ✅ W6.5 ✅ W7 ✅ W7.5 ✅ (todos mergeados em main)
**Branch:** `feature/redesign/wave-8-stock`
**Risco:** MÉDIO — envolve criação de hook compartilhado (`useStockData`) que será usado tanto por `Stock.jsx` quanto por `StockRedesign.jsx`; qualquer regressão no hook afeta a view original.

---

## Por que esta wave existe

`Stock.jsx` atual usa o design neon/glass (rosa `#ec4899`, bordas 1px, sombras multicamada). A pergunta central do Estoque é **"Preciso comprar algo?"** — e a view atual não a responde com clareza: o status de urgência está enterrado em classes CSS, os dias restantes são exibidos inline sem hierarquia, e a área de histórico é densa demais para o scan rápido de Dona Maria.

O redesign entrega:
- **Banner de alerta crítico** com CTA direto no topo (visível nos primeiros 3 segundos)
- **Cards por medicamento** com status (URGENTE/ATENÇÃO/SEGURO) como elemento dominante
- **Dias restantes como número editorial** — Public Sans 700, visível a distância
- **Barras de progresso Living Fill** — animação GPU, cor semântica por urgência
- **Duas densidades**: Simple (Dona Maria — lista clara) e Complex (Carlos — grid 3-col com detalhes de uso)

---

## O que esta wave FAZ

- Cria `src/features/stock/hooks/useStockData.js` — extrai lógica de dados de `Stock.jsx`
- Cria `src/features/stock/components/redesign/StockCardRedesign.jsx` + CSS
- Cria `src/features/stock/components/redesign/CriticalAlertBanner.jsx`
- Cria `src/features/stock/components/redesign/EntradaHistorico.jsx`
- Cria `src/views/redesign/StockRedesign.jsx` + CSS
- Atualiza `src/views/Stock.jsx` para usar `useStockData` (refactor interno, sem mudança visual)
- Atualiza `src/App.jsx`: adiciona lazy import + branching `isRedesignEnabled` no `case 'stock'`

## O que esta wave NÃO FAZ

- ❌ NÃO toca no visual de `Stock.jsx` (apenas extração de lógica para hook compartilhado)
- ❌ NÃO modifica `StockCard.jsx` original em `src/features/stock/components/StockCard.jsx`
- ❌ NÃO modifica `StockForm.jsx`, `StockIndicator.jsx`, `CostChart.jsx`, `PrescriptionTimeline.jsx`
- ❌ NÃO altera services (`stockService`, `medicineService`, `protocolService`)
- ❌ NÃO altera schemas Zod
- ❌ NÃO cria `CostChart` ou `PrescriptionTimeline` redesenhados (são W9+)
- ❌ NÃO implementa "Relatórios" e "Farmácias" — botões placeholder (`onClick` com `console.log`)

---

## Personas & Modos de Complexidade

A view de Estoque bifurca seu layout baseado em `useComplexityMode().mode`:

| Modo | Trigger | Layout Desktop | Card | Informação |
|------|---------|---------------|------|------------|
| `simple` | Dona Maria | **2 colunas** (desktop) / **1 coluna** (mobile) | Compacto | Nome + `StockPill` + barra + dias + CTA apenas para urgente/atencao + "última compra: DD/MM · R$ X,XX" |
| `complex` | Carlos | **Grid responsivo** (`grid-2` → `grid-3` por contagem) | Completo | + linha de uso + `EntradaHistorico` com custo |

**`isComplex = mode !== 'simple'`** — o modo `moderate` foi eliminado. Carlos sempre recebe grid responsivo; o número de colunas se ajusta automaticamente pelo CSS.

**Mobile é sempre 1 coluna** independente do modo.

### Simple (Dona Maria — modo simples, desktop 2-col)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Controle de Estoque                                                │
│  Prioridade de Reabastecimento                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Crítico (1)                                                        │
│  ┌──────────────────────────────────┐ ┌───────────────────────────┐ │
│  │ Losartana 50mg  [📅✕ 3 dias]    │ │ Atorvastatina 20mg        │ │
│  │ ████░░░░░░░░░░░░  10%            │ │ [📅↺ 11 dias]             │ │
│  │ 3 / 30 DIAS                      │ │ ██████░░░░░  37%          │ │
│  │ última compra: 13/03 · R$ 18,90  │ │ 11 / 30 DIAS              │ │
│  │ [ Comprar Agora                ] │ │ última compra: 05/03      │ │
│  └──────────────────────────────────┘ │ [ Comprar em Breve      ] │ │
│                                       └───────────────────────────┘ │
│  Estoque OK (1)                                                     │
│  ┌──────────────────────────────────┐                               │
│  │ Vitamina D 7000UI [📅✓ 22 dias] │                               │
│  │ ████████████░░░░  73%            │                               │
│  │ 22 / 30 DIAS                     │                               │
│  │ última compra: 01/03 · R$ 42,00  │                               │
│  └──────────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘

Notas Dona Maria:
• Seções por urgência (Crítico / Atenção / OK) — 2 colunas no desktop
• StockPill (ícone + dias) no header do card — sem badge separado
• "última compra: DD/MM · R$ X,XX" como subtexto por card
• CTA visível APENAS para urgente e atencao; cards seguro/alto sem botão
• "atencao" CTA: "Comprar em Breve" (não "Reabastecer")
• Sem seção de histórico separada — info relevante está per-card
• Sem "bar-pct %" — barra fala por si só
```

### Complex (Carlos — 4+ meds, desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│  Estoque de Medicamentos      [Relatórios]  [Farmácias]         │
├─────────────────────────────────────────────────────────────────┤
│  ⚠ 3 itens precisam de reposição imediata  [Comprar Tudo Agora] │
│                                                                 │
│  Inventário Ativo (8)                      ⇅ Dias Restantes     │
├─────────────────────┬─────────────────────┬─────────────────────┤
│ ┌─ URGENTE ────────┐│┌─ ATENÇÃO ─────────┐│┌─ SEGURO ──────────┐│
│ │Atorvastatina 20mg│││Losartana 50mg     │││Metformina 850mg   ││
│ │      2           │││      5            │││      24           ││
│ │     DIAS         │││     DIAS          │││     DIAS          ││
│ │1 dose/dia · Noite│││2 doses · 12/12h   │││1 dose/dia · Manhã ││
│ │1 de 30 comprim.  │││8 de 60 comprim.   │││24 de 30 comprim.  ││
│ │█░░░░░░░░░░░  6%  │││████░░░░░  15%     │││████████████  80%  ││
│ │[Comprar Agora]   │││[Reabastecer]      │││[Agendar Compra]   ││
│ └──────────────────┘│└───────────────────┘│└───────────────────┘│
│                     │                     │                     │
│ ┌─ URGENTE ────────┐│┌─ ATENÇÃO ─────────┐│┌─ ALTO ────────────┐│
│ │Ômega 3 Cáps.     │││Levotiroxina 50mcg │││Vitamina D 7000UI  ││
│ │      1           │││      6            │││      30+          ││
│ │     CÁP          │││     DIAS          │││     DIAS          ││
│ │2 doses/dia       │││1 dose/dia · Jejum │││Uso S.O.S          ││
│ │2 de 60 cápsulas  │││6 de 30 comprim.   │││15 de 15ml         ││
│ │█░░░░░░░░░░░  3%  │││██████████░░  30%  │││███████████████100%││
│ │[Comprar Agora]   │││[Reabastecer]      │││[Agendar Compra]   ││
│ └──────────────────┘│└───────────────────┘│└───────────────────┘│
├─────────────────────┴─────────────────────┴─────────────────────┤
│  HISTÓRICO DE ENTRADAS                             Ver Tudo     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Decisões Arquiteturais

### 1. Por que extrair `useStockData.js`

`Stock.jsx` tem ~120 linhas de lógica de dados (fetch, cálculo de `dailyIntake`, `daysRemaining`, `isLow`, categorização). Copiar essa lógica para `StockRedesign.jsx` violaria o princípio central do rollout gradual: **lógica de domínio permanece compartilhada**.

Solução: extrair toda a lógica para `src/features/stock/hooks/useStockData.js`. Tanto `Stock.jsx` quanto `StockRedesign.jsx` importam o hook. O hook retorna os dados processados; as views apenas renderizam.

### 2. Conflito de nome: `StockCard.jsx` já existe

> ⚠️ **CRÍTICO** — `src/features/stock/components/StockCard.jsx` JÁ EXISTE com design neon/glass.
> O novo componente redesenhado DEVE ser nomeado `StockCardRedesign.jsx` e ficar em
> `src/features/stock/components/redesign/StockCardRedesign.jsx`.
> Nunca criar arquivo com nome `StockCard.jsx` neste diretório.

### 3. Thresholds de status (4 tiers)

O `Stock.jsx` atual usa `daysRemaining < 4` para `isLow`. O redesign adota 4 tiers alinhados com o sistema de tokens:

| Status | Condição | CSS var principal | CSS var bg |
|--------|---------|-------------------|-----------|
| `urgente` | `total === 0` OU `days ≤ 7` | `--color-error` | `--color-error-bg` |
| `atencao` | `days ≤ 14` | `--color-warning` | `--color-warning-bg` |
| `seguro` | `days ≤ 29` | `--color-primary` | `--color-primary-bg` |
| `alto` | `days ≥ 30` OU `Infinity` | `--color-secondary` | `--color-secondary-bg` |

```javascript
// Função pura — colocar no topo de useStockData.js
export function getStockStatus(totalQuantity, daysRemaining) {
  if (totalQuantity === 0) return 'urgente'
  if (!isFinite(daysRemaining) || daysRemaining >= 30) return 'alto'
  if (daysRemaining <= 7)  return 'urgente'
  if (daysRemaining <= 14) return 'atencao'
  return 'seguro'
}
```

### 4. Progress bar: `scaleX` (GPU), NÃO `width`

> ⚠️ **REGRA DE PERFORMANCE** — A barra de progresso usa `livingFill.bar` de `motionConstants.js`
> que anima `scaleX: 0 → 1` com `transformOrigin: left`. Isso é GPU-composited.
> **NUNCA animar `width` diretamente** — viola a regra de performance de motion da W5.

O percentual da barra é baseado em dias: `Math.min(100, (daysRemaining / 30) * 100)`.
Para `Infinity` / `alto`: 100%. Para `urgente` com `total === 0`: 0%.

O wrapper da barra precisa de `overflow: hidden` e o `motion.div` interno recebe o `scaleX`.

### 5. Anti-pattern `StockPill.jsx`: não replicar

`StockPill.jsx` (já existente em `src/features/protocols/components/redesign/`) usa **cores hexadecimais hardcoded** (`#ef4444`, `#f59e0b`). Isso é AP-024.

> ⚠️ Em W8, TODO uso de cor deve ser via CSS variables (`var(--color-error)`, `var(--color-warning)`).
> Não copie o padrão de `StockPill.jsx`.

---

## Data Shapes

### Input do `useStockData.js` (nenhum — hook busca seus próprios dados)

### Output do `useStockData.js`

```javascript
{
  // Itens processados com status calculado
  items: StockItem[],          // todos os medicamentos

  // Sub-listas por urgência (para render por seção em Simple mode)
  criticalItems: StockItem[],  // status === 'urgente'
  warningItems: StockItem[],   // status === 'atencao'
  okItems: StockItem[],        // status === 'seguro'
  highItems: StockItem[],      // status === 'alto'

  // Estado
  isLoading: boolean,
  error: string | null,
  reload: () => void,          // força re-fetch

  // Para o modal de compra
  medicines: Medicine[],       // lista completa (necessária para StockForm)
}

// StockItem shape:
{
  medicine: {
    id: string,
    name: string,
    dosage_per_pill: number,
    dosage_unit: string,        // 'mg', 'mcg', 'ml', etc.
    medicine_type: string,      // 'comprimido', 'capsula', etc.
  },
  entries: StockEntry[],        // entradas brutas do stockService
  totalQuantity: number,        // soma das entries
  dailyIntake: number,          // comprimidos/dia (0 se sem protocolo ativo)
  daysRemaining: number,        // Infinity se dailyIntake === 0
  stockStatus: 'urgente' | 'atencao' | 'seguro' | 'alto',
  hasActiveProtocol: boolean,
  // Protocolo primário (para linha de uso no complex mode)
  primaryProtocol: {
    name: string,
    time_schedule: string[],    // ['08:00', '20:00']
    dosage_per_intake: number,
  } | null,
  // Percentual para a barra (0-100)
  barPercentage: number,
  // Última compra (entry mais recente com quantity > 0)
  // Ponto de referência para busca de reposição: "está mais caro ou mais barato?"
  lastPurchase: {
    date: string,               // 'YYYY-MM-DD'
    unitPrice: number | null,   // null se não registrado
    quantity: number,           // quantidade comprada no lote
  } | null,
}
```

---

## Manifesto de Arquivos

| Arquivo | Operação | Sprint |
|---------|---------|--------|
| `src/features/stock/hooks/useStockData.js` | CRIAR | 8.1 |
| `src/views/Stock.jsx` | MODIFICAR (usar hook) | 8.1 |
| `src/features/stock/components/redesign/StockCardRedesign.jsx` | CRIAR | 8.2 |
| `src/features/stock/components/redesign/StockCardRedesign.css` | CRIAR | 8.2 |
| `src/features/stock/components/redesign/CriticalAlertBanner.jsx` | CRIAR | 8.3 |
| `src/features/stock/components/redesign/EntradaHistorico.jsx` | CRIAR | 8.4 |
| `src/views/redesign/StockRedesign.jsx` | CRIAR | 8.5 |
| `src/views/redesign/StockRedesign.css` | CRIAR | 8.5 |
| `src/App.jsx` | MODIFICAR (lazy import + branching) | 8.6 |

### Arquivos NUNCA tocar nesta wave

```
src/features/stock/components/StockCard.jsx       ← design original, intocado
src/features/stock/components/StockForm.jsx        ← reutilizado via Modal
src/features/stock/components/StockIndicator.jsx   ← não usado no redesign
src/features/stock/components/CostChart.jsx        ← W9+
src/features/stock/components/PrescriptionTimeline.jsx ← W9+
src/features/stock/services/                        ← lógica intocada
src/services/api/                                   ← lógica intocada
src/schemas/                                        ← intocados
```

---

## Sprint 8.1 — useStockData Hook

**Arquivo:** `src/features/stock/hooks/useStockData.js`

### Objetivo

Extrair a lógica de `loadData` + `useMemo` de `Stock.jsx` (linhas 30–228) para um hook reutilizável. `Stock.jsx` é atualizado para usar o hook. Nenhuma mudança visual em `Stock.jsx`.

### Implementação completa

```javascript
/**
 * useStockData — Hook de dados para a view de Estoque
 * Compartilhado por Stock.jsx (legado) e StockRedesign.jsx (redesign).
 * Fonte: extração de Stock.jsx linhas 30-228.
 *
 * @returns {Object} Dados processados de estoque + estado + handlers
 */
import { useState, useEffect, useMemo } from 'react'
import { medicineService, stockService, protocolService } from '@shared/services'

// ─── Status helpers ──────────────────────────────────────────────────────────

/**
 * Calcula o status de urgência do estoque de um medicamento.
 * Exportado para uso em testes unitários.
 */
export function getStockStatus(totalQuantity, daysRemaining) {
  if (totalQuantity === 0) return 'urgente'
  if (!isFinite(daysRemaining) || daysRemaining >= 30) return 'alto'
  if (daysRemaining <= 7)  return 'urgente'
  if (daysRemaining <= 14) return 'atencao'
  return 'seguro'
}

/**
 * Calcula o percentual para a barra de progresso (0–100).
 * Baseado em dias: 30 dias = 100%, 0 dias = 0%.
 */
export function getBarPercentage(totalQuantity, daysRemaining) {
  if (totalQuantity === 0) return 0
  if (!isFinite(daysRemaining) || daysRemaining >= 30) return 100
  return Math.round((daysRemaining / 30) * 100)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useStockData() {
  // 1. States
  const [medicines, setMedicines] = useState([])
  const [protocols, setProtocols] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // 2. Memos
  const items = useMemo(() => {
    if (medicines.length === 0) return []

    const activeMedicineIds = new Set(protocols.map((p) => p.medicine_id))

    // Mapa: medicineId → protocolo primário (primeiro ativo)
    const primaryProtocolMap = {}
    protocols
      .filter((p) => p.active !== false)
      .forEach((p) => {
        if (!primaryProtocolMap[p.medicine_id]) {
          primaryProtocolMap[p.medicine_id] = {
            name: p.name,
            time_schedule: p.time_schedule || [],
            dosage_per_intake: p.dosage_per_intake || 0,
          }
        }
      })

    // Calcular consumo diário por medicamento
    const dailyIntakeMap = {}
    protocols
      .filter((p) => p.active !== false)
      .forEach((p) => {
        const daily = (p.dosage_per_intake || 0) * (p.time_schedule?.length || 0)
        dailyIntakeMap[p.medicine_id] = (dailyIntakeMap[p.medicine_id] || 0) + daily
      })

    return medicines.map((medicine) => {
      const stock = stockMap[medicine.id] || {
        entries: [],
        total: 0,
      }
      const dailyIntake = dailyIntakeMap[medicine.id] || 0
      const daysRemaining = dailyIntake > 0 ? stock.total / dailyIntake : Infinity
      const stockStatus = getStockStatus(stock.total, daysRemaining)
      const barPercentage = getBarPercentage(stock.total, daysRemaining)

      // Última compra: entry mais recente com quantity > 0, ordenada por purchase_date
      const purchaseEntries = (stock.entries || [])
        .filter((e) => e.quantity > 0)
        .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
      const latestEntry = purchaseEntries[0] || null
      const lastPurchase = latestEntry
        ? {
            date: latestEntry.purchase_date,
            unitPrice: latestEntry.unit_price ?? null,
            quantity: latestEntry.quantity,
          }
        : null

      return {
        medicine: {
          id: medicine.id,
          name: medicine.name,
          dosage_per_pill: medicine.dosage_per_pill,
          dosage_unit: medicine.dosage_unit || 'mg',
          medicine_type: medicine.medicine_type || 'comprimido',
        },
        entries: stock.entries,
        totalQuantity: stock.total,
        dailyIntake,
        daysRemaining,
        stockStatus,
        hasActiveProtocol: activeMedicineIds.has(medicine.id),
        primaryProtocol: primaryProtocolMap[medicine.id] || null,
        barPercentage,
        lastPurchase,
      }
    })
  }, [medicines, protocols, stockMap])

  // Sub-listas por urgência — ordenadas por criticidade (menor dias primeiro)
  const criticalItems = useMemo(
    () => items.filter((i) => i.stockStatus === 'urgente').sort((a, b) => a.daysRemaining - b.daysRemaining),
    [items]
  )
  const warningItems = useMemo(
    () => items.filter((i) => i.stockStatus === 'atencao').sort((a, b) => a.daysRemaining - b.daysRemaining),
    [items]
  )
  const okItems = useMemo(
    () => items.filter((i) => i.stockStatus === 'seguro').sort((a, b) => a.daysRemaining - b.daysRemaining),
    [items]
  )
  const highItems = useMemo(
    () => items.filter((i) => i.stockStatus === 'alto'),
    [items]
  )

  // 3. Effects
  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [medicinesData, protocolsData] = await Promise.all([
        medicineService.getAll(),
        protocolService.getActive(),
      ])

      setMedicines(medicinesData)
      setProtocols(protocolsData)

      // Fetch estoque em paralelo para todos os medicamentos
      const stockResults = await Promise.all(
        medicinesData.map(async (medicine) => {
          const entries = await stockService.getByMedicine(medicine.id)
          const total = entries.reduce((sum, e) => sum + e.quantity, 0)
          return { medicineId: medicine.id, entries, total }
        })
      )

      const map = {}
      stockResults.forEach(({ medicineId, entries, total }) => {
        map[medicineId] = { entries, total }
      })
      setStockMap(map)
    } catch (err) {
      setError('Erro ao carregar estoque: ' + err.message)
      console.error('[useStockData] Erro:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return {
    items,
    criticalItems,
    warningItems,
    okItems,
    highItems,
    medicines,
    isLoading,
    error,
    reload: loadData,
  }
}
```

### Atualização de `Stock.jsx`

Substituir os estados + useMemo de dados + `loadData` + `useEffect` pelo hook.
O JSX e os handlers de UI (`handleAddStock`, `handleSaveStock`, `showSuccess`) permanecem inalterados.

```javascript
// ANTES (Stock.jsx — remover estas linhas):
const [medicines, setMedicines] = useState([])
const [protocols, setProtocols] = useState([])
const [stockData, setStockData] = useState({})
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState(null)
const costData = useMemo(...) // manter — não está no hook
const prescriptionTimelineData = useMemo(...) // manter
const loadData = async () => { ... } // remover
useEffect(() => { loadData() }, []) // remover
const medicinesWithStock = medicines.map(...) // remover
const outOfStockMedicines = ... // remover
const lowStockMedicines = ... // remover
const okStockMedicMedicines = ... // remover

// DEPOIS (Stock.jsx — adicionar no topo):
import { useStockData } from '@stock/hooks/useStockData'
// ...
const {
  medicines,
  items: medicinesWithStock,     // mapeamento: items do hook → nome antigo usado no JSX
  criticalItems: outOfStockMedicines,
  warningItems: lowStockMedicines,
  okItems: okStockMedicines,
  isLoading,
  error,
  reload: loadData,
} = useStockData()
```

> ⚠️ **Atenção:** `costData` e `prescriptionTimelineData` em `Stock.jsx` dependem de `medicines` e `protocols`. Após a extração, `protocols` não é mais estado local — verificar se `costData` e `prescriptionTimelineData` ainda funcionam. Se necessário, expor `protocols` do hook ou recomputar localmente.
> **Solução segura:** adicionar `protocols` ao output do hook.

### Critério de conclusão do Sprint 8.1

- [ ] `useStockData.js` criado com as funções `getStockStatus` e `getBarPercentage` exportadas
- [ ] `Stock.jsx` usa o hook sem mudança visual — smoke test com flag desligado
- [ ] `npm run validate:agent` passa sem erros

---

## Sprint 8.2 — StockCardRedesign

**Arquivos:**
- `src/features/stock/components/redesign/StockCardRedesign.jsx`
- `src/features/stock/components/redesign/StockCardRedesign.css`

### Props

```javascript
StockCardRedesign({
  item,          // StockItem (shape definida em useStockData)
  isComplex,     // boolean — modo complexo: exibe linha de uso e info de lote
  onAddStock,    // () => void — abre StockForm para este medicamento
  index,         // number — índice para stagger de animação cascade
})
```

### JSX completo

```jsx
/**
 * StockCardRedesign — Card de medicamento para o redesign do Estoque.
 * Dois modos: simples (Dona Maria) e complexo (Carlos).
 *
 * Simple: nome + StockPill + barra + dias + "última compra" + CTA (urgente/atencao apenas)
 * Complex: idem + linha de uso (dose/dia · Período) + bar-pct + EntradaHistorico integrado
 *
 * Reutiliza StockPill (W7.6) para consistência visual — sem sistema de badge próprio.
 */
import { motion } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import StockPill from '@protocols/components/redesign/StockPill'
import { parseLocalDate } from '@utils/dateUtils'
import './StockCardRedesign.css'

// Texto do CTA por status
// Simple: CTA visível apenas para urgente e atencao; seguro/alto não têm botão
// Complex: CTA visível para todos os status
const CTA_LABELS = {
  urgente: 'Comprar Agora',
  atencao: 'Comprar em Breve',
  seguro:  'Agendar Compra',
  alto:    'Agendar Compra',
}

/**
 * Formata "última compra: DD/MM · R$ X,XX" para o subtexto do card (modo simple).
 * Sem unit_price: "última compra: DD/MM".
 */
function formatLastPurchase(lastPurchase) {
  if (!lastPurchase) return null
  const date = parseLocalDate(lastPurchase.date).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit',
  })
  if (lastPurchase.unitPrice != null) {
    const price = lastPurchase.unitPrice.toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
    })
    return `última compra: ${date} · ${price}`
  }
  return `última compra: ${date}`
}

/**
 * Formata a linha de uso: "1 dose/dia · Manhã" ou "2 doses/dia · 08:00 / 20:00"
 */
function formatUsageLine(primaryProtocol) {
  if (!primaryProtocol) return null
  const { time_schedule, dosage_per_intake } = primaryProtocol
  const times = time_schedule || []
  const count = times.length
  const doses = `${count} dose${count !== 1 ? 's' : ''}/dia`
  const schedule = times.length > 0 ? ` · ${times.join(' / ')}` : ''
  return `${doses}${schedule}`
}

/**
 * Formata "N dias" ou "30+ dias" ou "S.O.S" (sem protocolo ativo)
 */
function formatDays(daysRemaining, hasActiveProtocol) {
  if (!hasActiveProtocol) return { number: '—', label: 'S.O.S' }
  if (!isFinite(daysRemaining) || daysRemaining >= 30) return { number: '30+', label: 'DIAS' }
  const days = Math.floor(daysRemaining)
  return { number: String(days), label: days === 1 ? 'DIA' : 'DIAS' }
}

export default function StockCardRedesign({ item, isComplex, onAddStock, index = 0 }) {
  const motionConfig = useMotion()
  const { medicine, totalQuantity, stockStatus, barPercentage, primaryProtocol, hasActiveProtocol, lastPurchase } = item
  const { number: daysNumber, label: daysLabel } = formatDays(item.daysRemaining, hasActiveProtocol)
  const usageLine = isComplex ? formatUsageLine(primaryProtocol) : null
  const ctaLabel = CTA_LABELS[stockStatus] || 'Comprar Agora'
  const showCta = isComplex || stockStatus === 'urgente' || stockStatus === 'atencao'
  const lastPurchaseText = formatLastPurchase(lastPurchase)

  return (
    <motion.div
      className={`stock-card-r stock-card-r--${stockStatus}`}
      variants={motionConfig.cascade.item}
      {...motionConfig.tactile}
      role="article"
      aria-label={`${medicine.name} — ${daysNumber} ${daysLabel}`}
    >
      {/* ── Medicine name + StockPill (substitui badge row) ── */}
      <div className="stock-card-r__name-row">
        <div className="stock-card-r__medicine">
          <h3 className="stock-card-r__name">{medicine.name}</h3>
          {medicine.dosage_per_pill && (
            <span className="stock-card-r__dosage">
              {medicine.dosage_per_pill}{medicine.dosage_unit}
            </span>
          )}
        </div>
        {/* StockPill reutilizado de W7.6 — consistência total com TreatmentsRedesign */}
        <StockPill status={stockStatus} daysRemaining={Math.floor(item.daysRemaining)} />
      </div>

      {/* ── Complex only: linha de uso ── */}
      {isComplex && usageLine && (
        <p className="stock-card-r__usage">{usageLine}</p>
      )}

      {/* ── Quantidade total (complex only — Dona Maria não precisa) ── */}
      {isComplex && (
        <p className="stock-card-r__quantity">
          {totalQuantity} {medicine.medicine_type === 'liquido' ? 'ml' : medicine.medicine_type === 'capsula' ? 'cáps.' : 'comprimidos'}
        </p>
      )}

      {/* ── Dias restantes — número editorial (headline-md Public Sans 700) ── */}
      <div className="stock-card-r__days" aria-label={`${daysNumber} ${daysLabel}`}>
        <span className="stock-card-r__days-number">{daysNumber}</span>
        <span className="stock-card-r__days-label">{daysLabel}</span>
      </div>

      {/* ── Progress bar (Living Fill — GPU scaleX) ── */}
      <div className="stock-card-r__bar-track" aria-hidden="true">
        <motion.div
          className={`stock-card-r__bar-fill stock-card-r__bar-fill--${stockStatus}`}
          style={{ width: `${barPercentage}%`, ...motionConfig.fill.style }}
          initial={motionConfig.fill.initial}
          animate={motionConfig.fill.animate}
          transition={{
            ...motionConfig.fill.transition,
            delay: 0.5 + index * 0.05,
          }}
        />
      </div>
      {/* bar-pct: apenas no modo complex (Carlos quer precisão; Dona Maria não precisa) */}
      {isComplex && (
        <span className="stock-card-r__bar-pct" aria-hidden="true">{barPercentage}%</span>
      )}

      {/* ── Última compra — subtexto de referência de preço ── */}
      {lastPurchaseText && (
        <p className="stock-card-r__last-purchase">{lastPurchaseText}</p>
      )}

      {/* ── CTA button — simple: apenas urgente/atencao; complex: todos ── */}
      {showCta && (
        <button
          className={`stock-card-r__cta stock-card-r__cta--${stockStatus}`}
          onClick={(e) => { e.stopPropagation(); onAddStock?.() }}
          aria-label={`${ctaLabel} ${medicine.name}`}
        >
          <ShoppingCart size={16} aria-hidden="true" />
          {ctaLabel}
        </button>
      )}
    </motion.div>
  )
}
```

### CSS completo (`StockCardRedesign.css`)

```css
/* ============================================
   StockCardRedesign — Card de estoque
   REGRA CARDINAL: Zero hex codes. Apenas var(--color-*).
   ============================================ */

.stock-card-r {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-2xl);        /* 2rem */
  padding: 1.5rem;
  box-shadow: var(--shadow-ambient);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  overflow: hidden;
  /* Border-left semântico por status — substituído via modifier */
  border-left: 4px solid transparent;
  transition: box-shadow 200ms ease-out;
}

/* Modificadores de status — border-left colorido */
.stock-card-r--urgente { border-left-color: var(--color-error); }
.stock-card-r--atencao { border-left-color: var(--color-warning); }
.stock-card-r--seguro  { border-left-color: var(--color-primary); }
.stock-card-r--alto    { border-left-color: var(--color-secondary); }

/* ── Name row (nome + StockPill) ── */
/* Badge system removido — StockPill de W7.6 é reutilizado diretamente */
.stock-card-r__name-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

/* ── Dias restantes — número editorial ── */
.stock-card-r__days {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1;
}

.stock-card-r__days-number {
  font-family: var(--font-display);    /* Public Sans */
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-on-surface);
  line-height: 1;
}

.stock-card-r--urgente .stock-card-r__days-number { color: var(--color-error); }
.stock-card-r--atencao .stock-card-r__days-number { color: var(--color-warning); }

.stock-card-r__days-label {
  font-family: var(--font-body);
  font-size: 0.625rem;
  font-weight: var(--font-weight-medium);
  color: var(--color-outline);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── Medicine name ── */
.stock-card-r__name {
  font-family: var(--font-body);
  font-size: var(--text-title-lg);     /* Lexend 600 1.125rem */
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  margin: 0;
  line-height: 1.3;
}

.stock-card-r__dosage {
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-outline);
  display: block;
  margin-top: 0.125rem;
}

/* ── Usage line (complex mode only) ── */
.stock-card-r__usage {
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  color: var(--color-on-surface-variant);
  margin: 0;
}

/* ── Quantity ── */
.stock-card-r__quantity {
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  margin: 0;
}

/* ── Progress bar ── */
.stock-card-r__bar-track {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-container-high);
  overflow: hidden;
}

.stock-card-r__bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transform-origin: left;
  /* width setado inline via prop style */
}

.stock-card-r__bar-fill--urgente { background: var(--color-error); }
.stock-card-r__bar-fill--atencao { background: var(--color-warning); }
.stock-card-r__bar-fill--seguro  { background: var(--color-primary); }
.stock-card-r__bar-fill--alto    { background: var(--color-secondary); }

.stock-card-r__bar-pct {
  font-family: var(--font-body);
  font-size: var(--text-label-sm);
  color: var(--color-outline);
  text-align: right;
  display: block;
  margin-top: -0.25rem;
}

/* ── Última compra — subtexto de referência de preço ── */
.stock-card-r__last-purchase {
  font-family: var(--font-body);
  font-size: var(--text-label-sm);
  color: var(--color-outline);
  margin: 0;
}

/* ── CTA button ── */
.stock-card-r__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.875rem 1rem;
  min-height: 56px;                    /* touch target mínimo */
  border: none;
  border-radius: var(--radius-xl);
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: opacity 150ms ease-out;
  margin-top: auto;                    /* empurra para base do card */
}

.stock-card-r__cta:active { opacity: 0.85; }

/* CTA cores por status */
.stock-card-r__cta--urgente {
  background: linear-gradient(135deg, var(--color-error), #d32f2f);
  color: #ffffff;
  box-shadow: var(--shadow-error);
}

.stock-card-r__cta--atencao {
  background: var(--color-surface-container);
  color: var(--color-on-surface);
  border: 1.5px solid var(--color-outline-variant);
}

.stock-card-r__cta--seguro,
.stock-card-r__cta--alto {
  background: transparent;
  color: var(--color-primary);
  border: 1.5px solid var(--color-primary);
}
```

### Critério de conclusão do Sprint 8.2

- [ ] Componente renderiza corretamente para todos os 4 status (urgente/atencao/seguro/alto)
- [ ] `StockPill` de W7.6 importado e renderizado no `name-row` — sem badge CSS próprio
- [ ] Simple mode: sem linha de uso, sem quantidade, sem bar-pct%; CTA oculto para seguro/alto
- [ ] Simple mode: "Comprar em Breve" para atencao (não "Reabastecer")
- [ ] Complex mode: exibe usageLine, quantidade e bar-pct%
- [ ] "última compra: DD/MM · R$ X,XX" visível em ambos os modos (quando disponível)
- [ ] Progress bar anima com `scaleX` (verificar DevTools: transform, não width)
- [ ] Zero hardcoded hex no CSS
- [ ] `@supports` fallback presente para `color-mix()` se necessário
- [ ] CTA tem `min-height: 56px`

---

## Sprint 8.3 — CriticalAlertBanner

**Arquivo:** `src/features/stock/components/redesign/CriticalAlertBanner.jsx`

Renderizado apenas quando `criticalItems.length > 0`. Nenhum CSS separado — styles inline via vars.

```jsx
/**
 * CriticalAlertBanner — Banner de alerta crítico de estoque.
 * Renderizado apenas quando há medicamentos com status 'urgente'.
 */
import { motion } from 'framer-motion'
import { AlertTriangle, ShoppingCart } from 'lucide-react'

export default function CriticalAlertBanner({ criticalCount, onBuyAll }) {
  if (criticalCount === 0) return null

  const message = criticalCount === 1
    ? '1 medicamento precisa de reposição imediata'
    : `${criticalCount} medicamentos precisam de reposição imediata`

  return (
    <motion.div
      className="critical-alert-banner"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      role="alert"
      aria-live="polite"
    >
      <div className="critical-alert-banner__content">
        <AlertTriangle
          size={20}
          className="critical-alert-banner__icon"
          aria-hidden="true"
        />
        <div>
          <p className="critical-alert-banner__title">Reposição Crítica</p>
          <p className="critical-alert-banner__message">{message}</p>
        </div>
      </div>
      <button
        className="critical-alert-banner__cta"
        onClick={onBuyAll}
        aria-label="Abrir formulário para registrar compra"
      >
        <ShoppingCart size={16} aria-hidden="true" />
        Comprar Tudo Agora
      </button>
    </motion.div>
  )
}
```

### CSS (no `StockRedesign.css`)

```css
/* CriticalAlertBanner */
.critical-alert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-error);
  background: var(--color-error-bg);
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.critical-alert-banner__content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.critical-alert-banner__icon {
  color: var(--color-error);
  flex-shrink: 0;
}

.critical-alert-banner__title {
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-error);
  margin: 0 0 0.125rem;
}

.critical-alert-banner__message {
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  margin: 0;
}

.critical-alert-banner__cta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  min-height: 44px;
  border: none;
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, var(--color-error), #d32f2f);
  color: #ffffff;
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  box-shadow: var(--shadow-error);
  white-space: nowrap;
}
```

### Critério de conclusão do Sprint 8.3

- [ ] Não renderiza quando `criticalCount === 0`
- [ ] Texto singular/plural correto
- [ ] Animação de entrada do topo (y: -8 → 0)
- [ ] CTA dispara `onBuyAll`
- [ ] `role="alert"` + `aria-live="polite"` presentes

---

## Sprint 8.4 — EntradaHistorico

**Arquivo:** `src/features/stock/components/redesign/EntradaHistorico.jsx`

Recebe todas as entries de todos os medicamentos, mostra as 3 mais recentes com "Ver Tudo".

```jsx
/**
 * EntradaHistorico — Histórico compacto de entradas de estoque.
 * Mostra as N mais recentes (default: 3). "Ver Tudo" expande ou navega.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { parseLocalDate } from '@utils/dateUtils'

// Prefixos de ajustes automáticos do sistema (mesma lógica de StockCard.jsx original)
const SYSTEM_PREFIXES = ['Dose excluída', 'Ajuste de dose']

function classifyEntry(entry) {
  if (SYSTEM_PREFIXES.some((p) => entry.notes?.startsWith(p))) return 'system'
  if (entry.quantity > 0) return 'purchase'
  return 'adjustment'
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatQuantity(entry) {
  const sign = entry.quantity >= 0 ? '+' : ''
  return `${sign}${entry.quantity} un.`
}

/**
 * Formata o custo do lote: "R$ X,XX" ou null se não registrado.
 * Exibido para ambas as personas — é o ponto de referência para reposição.
 */
function formatCost(entry) {
  if (entry.unit_price == null) return null
  return entry.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function EntradaHistorico({ entries = [], medicineName, maxVisible = 3 }) {
  const motionConfig = useMotion()
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0) return null

  // Ordenar por data mais recente primeiro
  const sorted = [...entries].sort(
    (a, b) => new Date(b.purchase_date) - new Date(a.purchase_date)
  )
  const visible = expanded ? sorted : sorted.slice(0, maxVisible)
  const hasMore = sorted.length > maxVisible

  return (
    <div className="entrada-historico">
      <motion.ul
        className="entrada-historico__list"
        variants={motionConfig.cascade.container}
        initial="hidden"
        animate="visible"
      >
        {visible.map((entry) => {
          const type = classifyEntry(entry)
          const Icon = type === 'purchase' ? ShoppingCart : Pencil

          return (
            <motion.li
              key={entry.id}
              className="entrada-historico__item"
              variants={motionConfig.cascade.item}
            >
              <div className="entrada-historico__icon-wrap">
                <Icon size={14} aria-hidden="true" />
              </div>
              <div className="entrada-historico__info">
                <span className="entrada-historico__desc">
                  {type === 'purchase' ? 'Compra Realizada' : entry.notes || 'Ajuste Manual'}
                </span>
                {medicineName && (
                  <span className="entrada-historico__medicine">{medicineName}</span>
                )}
              </div>
              <span className={`entrada-historico__qty entrada-historico__qty--${entry.quantity >= 0 ? 'positive' : 'negative'}`}>
                {formatQuantity(entry)}
              </span>
              <div className="entrada-historico__meta">
                <span className="entrada-historico__date">{formatDate(entry.purchase_date)}</span>
                {/* Custo do lote — referência de preço para reposição (ambas as personas) */}
                {formatCost(entry) && (
                  <span className="entrada-historico__cost">{formatCost(entry)}</span>
                )}
              </div>
            </motion.li>
          )
        })}
      </motion.ul>

      {hasMore && (
        <button
          className="entrada-historico__toggle"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <><ChevronUp size={14} aria-hidden="true" /> Ver menos</>
          ) : (
            <><ChevronDown size={14} aria-hidden="true" /> Ver tudo ({sorted.length})</>
          )}
        </button>
      )}
    </div>
  )
}
```

### CSS (em `StockRedesign.css`)

```css
.entrada-historico__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.entrada-historico__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.entrada-historico__icon-wrap {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-secondary);
}

.entrada-historico__info {
  flex: 1;
  min-width: 0;
}

.entrada-historico__desc {
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  color: var(--color-on-surface);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entrada-historico__medicine {
  font-size: var(--text-label-sm);
  color: var(--color-outline);
  display: block;
}

.entrada-historico__qty {
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.entrada-historico__qty--positive { color: var(--color-primary); }
.entrada-historico__qty--negative { color: var(--color-error); }

.entrada-historico__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
  white-space: nowrap;
}

.entrada-historico__date {
  font-size: var(--text-label-sm);
  color: var(--color-outline);
}

/* Custo do lote — referência de preço para reposição */
.entrada-historico__cost {
  font-size: var(--text-label-sm);
  color: var(--color-on-surface-variant);
  font-weight: var(--font-weight-medium);
}

.entrada-historico__toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: var(--color-primary);
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  padding: 0.5rem 0;
  margin-top: 0.25rem;
}
```

### Critério de conclusão do Sprint 8.4

- [ ] Mostra 3 entradas por padrão, expande ao clicar "Ver tudo"
- [ ] Ícone ShoppingCart para compras, Pencil para ajustes
- [ ] Quantidade positiva em verde (`--color-primary`), negativa em erro (`--color-error`)
- [ ] Data via `parseLocalDate()` (nunca `new Date(str)` diretamente — AP-005)
- [ ] Cascade Reveal nos itens

---

## Sprint 8.5 — StockRedesign View (Orquestrador)

**Arquivos:**
- `src/views/redesign/StockRedesign.jsx`
- `src/views/redesign/StockRedesign.css`

### Props (idênticas a `Stock.jsx`)

```javascript
StockRedesign({ initialParams, onClearParams })
```

### Lógica de persona

```javascript
const { mode } = useComplexityMode()
// moderate removido: isComplex = qualquer coisa que não seja 'simple'
const isComplex = mode !== 'simple'
// Sem gridClass condicional: simple usa CSS grid (2-col desktop via CSS)
// Complex: grid responsivo (grid-2 → grid-3) controlado por contagem de itens via CSS
```

### Flat list de entradas para o histórico

```javascript
// Agregar todas as entries de todos os medicamentos para o histórico global
const allEntries = useMemo(() =>
  items.flatMap((item) => item.entries),
  [items]
)
```

### JSX completo

```jsx
/**
 * StockRedesign — View de Estoque redesenhada (Santuário Terapêutico).
 * Orquestra layout, personas (simple/complex) e modal de compra.
 *
 * NÃO duplica lógica de dados — usa useStockData() compartilhado.
 * NÃO modifica Stock.jsx original.
 */
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { useStockData } from '@stock/hooks/useStockData'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import Loading from '@shared/components/ui/Loading'
import EmptyState from '@shared/components/ui/EmptyState'
import Modal from '@shared/components/ui/Modal'
import StockForm from '@stock/components/StockForm'
import StockCardRedesign from '@stock/components/redesign/StockCardRedesign'
import CriticalAlertBanner from '@stock/components/redesign/CriticalAlertBanner'
import EntradaHistorico from '@stock/components/redesign/EntradaHistorico'
import { stockService } from '@shared/services'
import './StockRedesign.css'

export default function StockRedesign({ initialParams, onClearParams }) {
  // ── Dados (hook compartilhado) ──
  const {
    items,
    criticalItems,
    warningItems,
    okItems,
    highItems,
    medicines,
    isLoading,
    error,
    reload,
  } = useStockData()

  // ── Complexidade / Persona ──
  const { mode } = useComplexityMode()
  const isComplex = mode !== 'simple'  // moderate eliminado

  // ── Estado local (UI) ──
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMedicineId, setSelectedMedicineId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  // ── Motion ──
  const motionConfig = useMotion()

  // ── Entries agregadas para histórico ──
  const allEntries = useMemo(() => items.flatMap((i) => i.entries), [items])

  // ── Todos os itens ordenados por urgência (para Complex grid) ──
  const sortedAllItems = useMemo(
    () => [...criticalItems, ...warningItems, ...okItems, ...highItems],
    [criticalItems, warningItems, okItems, highItems]
  )

  // ── Handlers ──
  const handleOpenModal = (medicineId = null) => {
    if (medicines.length === 0) return
    setSelectedMedicineId(typeof medicineId === 'string' ? medicineId : null)
    setIsModalOpen(true)
  }

  const handleSaveStock = async (stockData) => {
    try {
      await stockService.add(stockData)
      setIsModalOpen(false)
      setSelectedMedicineId(null)
      if (onClearParams) onClearParams()
      setSuccessMessage('Estoque adicionado!')
      setTimeout(() => setSuccessMessage(''), 3000)
      reload()
    } catch (err) {
      throw new Error(err?.message || 'Erro ao adicionar estoque')
    }
  }

  // ── initialParams: abrir modal pré-selecionado (deep link) ──
  // Mesmo comportamento de Stock.jsx
  useMemo(() => {
    if (initialParams?.medicineId && medicines.length > 0) {
      setSelectedMedicineId(initialParams.medicineId)
      setIsModalOpen(true)
    }
  }, [initialParams, medicines.length])

  // ── Loading / Error ──
  if (isLoading) {
    return (
      <div className="page-container">
        <Loading text="Carregando estoque..." />
      </div>
    )
  }

  if (medicines.length === 0) {
    return (
      <div className="page-container">
        <EmptyState
          illustration="stock"
          title="Nenhum medicamento cadastrado"
          description="Cadastre seus medicamentos para começar a controlar seu estoque"
          ctaLabel="Cadastrar Medicamento"
          onCtaClick={() => handleOpenModal()}
        />
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="page-container stock-redesign" data-complexity={mode}>

      {/* ── Page Header ── */}
      <header className="stock-redesign__header">
        <div>
          <h1 className="stock-redesign__title">Controle de Estoque</h1>
          <p className="stock-redesign__subtitle">Prioridade de Reabastecimento</p>
        </div>
        {/* Desktop: botão no header; Mobile: FAB fixo abaixo */}
        <button
          className="stock-redesign__add-btn stock-redesign__add-btn--desktop"
          onClick={() => handleOpenModal()}
          aria-label="Adicionar estoque"
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar Estoque
        </button>
      </header>

      {/* ── Feedback ── */}
      {successMessage && (
        <div className="stock-redesign__success" role="status">{successMessage}</div>
      )}
      {error && (
        <div className="stock-redesign__error" role="alert">{error}</div>
      )}

      {/* ── Banner de alerta crítico ── */}
      <CriticalAlertBanner
        criticalCount={criticalItems.length}
        onBuyAll={() => handleOpenModal()}
      />

      {/* ── Seção principal ── */}
      {isComplex ? (
        // Complex: grid único ordenado por urgência; CSS decide 2-col vs 3-col por contagem
        <>
          <div className="stock-redesign__section-header">
            <h2 className="stock-redesign__section-title">
              Inventário Ativo ({items.length})
            </h2>
          </div>
          <motion.div
            className="stock-redesign__grid stock-redesign__grid--complex"
            variants={motionConfig.cascade.container}
            initial="hidden"
            animate="visible"
          >
            {sortedAllItems.map((item, index) => (
              <StockCardRedesign
                key={item.medicine.id}
                item={item}
                isComplex={true}
                onAddStock={() => handleOpenModal(item.medicine.id)}
                index={index}
              />
            ))}
          </motion.div>
        </>
      ) : (
        // Simple: seções por urgência (Dona Maria)
        <motion.div
          className="stock-redesign__sections"
          variants={motionConfig.cascade.container}
          initial="hidden"
          animate="visible"
        >
          {criticalItems.length > 0 && (
            <motion.section variants={motionConfig.cascade.item} className="stock-redesign__section">
              <h2 className="stock-redesign__section-label stock-redesign__section-label--urgente">
                Crítico ({criticalItems.length})
              </h2>
              {criticalItems.map((item, index) => (
                <StockCardRedesign
                  key={item.medicine.id}
                  item={item}
                  isComplex={false}
                  onAddStock={() => handleOpenModal(item.medicine.id)}
                  index={index}
                />
              ))}
            </motion.section>
          )}

          {warningItems.length > 0 && (
            <motion.section variants={motionConfig.cascade.item} className="stock-redesign__section">
              <h2 className="stock-redesign__section-label stock-redesign__section-label--atencao">
                Atenção ({warningItems.length})
              </h2>
              {warningItems.map((item, index) => (
                <StockCardRedesign
                  key={item.medicine.id}
                  item={item}
                  isComplex={false}
                  onAddStock={() => handleOpenModal(item.medicine.id)}
                  index={index}
                />
              ))}
            </motion.section>
          )}

          {(okItems.length > 0 || highItems.length > 0) && (
            <motion.section variants={motionConfig.cascade.item} className="stock-redesign__section">
              <h2 className="stock-redesign__section-label stock-redesign__section-label--seguro">
                Estoque OK ({okItems.length + highItems.length})
              </h2>
              {[...okItems, ...highItems].map((item, index) => (
                <StockCardRedesign
                  key={item.medicine.id}
                  item={item}
                  isComplex={false}
                  onAddStock={() => handleOpenModal(item.medicine.id)}
                  index={index}
                />
              ))}
            </motion.section>
          )}
        </motion.div>
      )}

      {/* ── Histórico de Entradas (complex only) ── */}
      {/* Simple: informação de última compra + custo já está per-card em StockCardRedesign */}
      {/* Complex: Carlos precisa do histórico completo para auditoria e comparação */}
      {isComplex && allEntries.length > 0 && (
        <section className="stock-redesign__history-section">
          <h2 className="stock-redesign__section-title">Histórico de Entradas</h2>
          <EntradaHistorico entries={allEntries} maxVisible={3} />
        </section>
      )}

      {/* ── FAB mobile ── */}
      <button
        className="stock-redesign__fab"
        onClick={() => handleOpenModal()}
        aria-label="Adicionar estoque"
      >
        <Plus size={20} aria-hidden="true" />
      </button>

      {/* ── Modal de compra (reutiliza StockForm original) ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedMedicineId(null)
          if (onClearParams) onClearParams()
        }}
      >
        <StockForm
          medicines={medicines}
          initialValues={
            selectedMedicineId
              ? { medicine_id: selectedMedicineId }
              : initialParams
                ? { medicine_id: initialParams.medicineId }
                : null
          }
          onSave={handleSaveStock}
          onCancel={() => {
            setIsModalOpen(false)
            setSelectedMedicineId(null)
            if (onClearParams) onClearParams()
          }}
        />
      </Modal>
    </div>
  )
}
```

### CSS (`StockRedesign.css`)

```css
/* ============================================
   StockRedesign — View de Estoque
   Importa: CriticalAlertBanner, EntradaHistorico
   ============================================ */

/* Header da view */
.stock-redesign__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.stock-redesign__title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
  line-height: 1.2;
}

.stock-redesign__subtitle {
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  color: var(--color-outline);
  margin: 0.25rem 0 0;
}

/* Botão "+ Adicionar" no header — visível só em desktop */
.stock-redesign__add-btn--desktop {
  display: none;  /* oculto em mobile — usa FAB */
}

@media (min-width: 768px) {
  .stock-redesign__add-btn--desktop {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    min-height: 44px;
    border: none;
    border-radius: var(--radius-xl);
    background: var(--gradient-primary);
    color: #ffffff;
    font-family: var(--font-body);
    font-size: var(--text-label-md);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    box-shadow: var(--shadow-primary);
    white-space: nowrap;
  }
}

/* Feedback banners */
.stock-redesign__success {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: var(--text-body-lg);
  margin-bottom: 1rem;
}

.stock-redesign__error {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: var(--color-error-bg);
  color: var(--color-error);
  font-size: var(--text-body-lg);
  margin-bottom: 1rem;
}

/* Section header (complex mode) */
.stock-redesign__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stock-redesign__section-title {
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

/* Sections (simple mode) — 1 coluna mobile, 2 colunas desktop */
/* Consistente com TreatmentsSimple W7.6 (align-items: start = Pinterest effect) */
.stock-redesign__sections {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stock-redesign__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 1024px) {
  .stock-redesign__sections {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;        /* Pinterest effect — cards sem altura forçada */
    gap: 2rem;
  }
}

.stock-redesign__section-label {
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 0.25rem;
}

.stock-redesign__section-label--urgente { color: var(--color-error); }
.stock-redesign__section-label--atencao { color: var(--color-warning); }
.stock-redesign__section-label--seguro  { color: var(--color-primary); }

/* Grid (complex mode) — responsivo por contagem, sem moderate */
.stock-redesign__grid {
  margin-bottom: 2rem;
}

/* Carlos: grid sempre responsivo — CSS decide colunas sem prop mode */
@media (min-width: 768px) {
  .stock-redesign__grid--complex {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    align-items: start;
    gap: 1rem;
  }
}

@media (min-width: 1280px) {
  .stock-redesign__grid--complex {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Histórico section */
.stock-redesign__history-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-surface-container-high);
}

/* FAB mobile — fixo acima da BottomNav */
.stock-redesign__fab {
  position: fixed;
  bottom: calc(80px + 1rem);   /* 80px = altura da BottomNavRedesign */
  right: 1.25rem;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--gradient-primary);
  color: #ffffff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-floating);
  z-index: 100;
}

/* Desktop: FAB oculto (botão no header) */
@media (min-width: 768px) {
  .stock-redesign__fab {
    display: none;
  }
}
```

### Critério de conclusão do Sprint 8.5

- [ ] `isComplex = mode !== 'simple'` — sem referência a `moderate`
- [ ] Simple mode: seções CRÍTICO / ATENÇÃO / OK separadas por label colorido; 2 colunas no desktop
- [ ] Simple mode: sem `EntradaHistorico` global (história por card via `lastPurchase`)
- [ ] Complex mode: grid responsivo único (`grid-2` tablet, `grid-3` desktop) via CSS puro
- [ ] Complex mode: `EntradaHistorico` com coluna de custo visível
- [ ] FAB visível em mobile, oculto em desktop
- [ ] "Adicionar Estoque" no header visível só em desktop
- [ ] Modal de compra reutiliza `StockForm` original sem modificação
- [ ] `initialParams.medicineId` abre modal pré-selecionado (deep link funcional)
- [ ] Estado vazio quando `medicines.length === 0`

---

## Sprint 8.6 — App.jsx Wiring

**Arquivo:** `src/App.jsx`

### Mudança exata

```javascript
// 1. Adicionar import lazy (junto com DashboardRedesign e TreatmentsRedesign)
const StockRedesign = lazy(() => import('./views/redesign/StockRedesign'))

// 2. Substituir case 'stock': (linha ~148)
case 'stock':
  return isRedesignEnabled ? (
    <Suspense fallback={<ViewSkeleton />}>
      <StockRedesign
        initialParams={initialStockParams}
        onClearParams={() => setInitialStockParams(null)}
      />
    </Suspense>
  ) : (
    <Suspense fallback={<ViewSkeleton />}>
      <Stock
        initialParams={initialStockParams}
        onClearParams={() => setInitialStockParams(null)}
      />
    </Suspense>
  )
```

### Verificação do chunk Vite

Verificar `vite.config.js`: o chunk `feature-stock` deve cobrir `src/views/redesign/StockRedesign`. Procurar a configuração de `manualChunks` e confirmar se o match de `redesign/Stock` está incluído ou se precisa ser adicionado.

```bash
grep -A 5 "feature-stock" vite.config.js
```

Se necessário, ajustar o matcher para incluir `StockRedesign`:
```javascript
// No manualChunks — garantir que StockRedesign entra no chunk correto
'feature-stock': (id) => id.includes('/features/stock/') || id.includes('StockRedesign'),
```

### Smoke test checklist

**Com flag DESLIGADO (`?redesign=0`):**
- [ ] `case 'stock'` → `Stock.jsx` original renderiza sem mudança visual
- [ ] Funcionalidades existentes (add stock, modal, histórico) intactas
- [ ] Nenhum erro de console

**Com flag LIGADO (`?redesign=1`):**
- [ ] `case 'stock'` → `StockRedesign` renderiza
- [ ] `ViewSkeleton` aparece brevemente durante carregamento do chunk
- [ ] Simple mode: seções separadas por urgência, 2 colunas no desktop; sem histórico global
- [ ] Complex mode: grid responsivo (2-col tablet, 3-col desktop); EntradaHistorico visível
- [ ] `CriticalAlertBanner` aparece apenas quando há itens urgentes
- [ ] Progress bars animam com `scaleX` (verificar via DevTools)
- [ ] FAB visível em mobile, oculto em desktop
- [ ] Modal de compra abre e salva corretamente
- [ ] Após salvar: `reload()` atualiza os cards
- [ ] Deep link `initialParams.medicineId` abre modal pré-selecionado

**Smoke visual cross-breakpoint:**
- [ ] 375px (iPhone SE): FAB posicionado acima da BottomNav
- [ ] 768px (tablet): grid-2 em moderate, header button visível
- [ ] 1280px (desktop): grid-3 em complex, sidebar não sobrepõe conteúdo

### Critério de conclusão do Sprint 8.6

- [ ] `StockRedesign` lazy import adicionado em `App.jsx`
- [ ] Branching `isRedesignEnabled` correto em `case 'stock'`
- [ ] `npm run validate:agent` passa sem erros
- [ ] Build sem warnings de chunk size excessivo
- [ ] Todos os smoke tests acima verificados manualmente

---

## Anti-Patterns Específicos desta Wave

### AP-W8-01: Criar `StockCard.jsx` em vez de `StockCardRedesign.jsx`

> **O que é:** nomear o novo componente `StockCard.jsx`, colidindo com o arquivo existente em `src/features/stock/components/StockCard.jsx`.
>
> **Por que importa aqui:** `Stock.jsx` original importa `StockCard` do mesmo diretório. Se o agente criar um arquivo de mesmo nome na pasta raiz ou substituir o existente, `Stock.jsx` quebrará silenciosamente — ou pior, renderizará o card redesenhado no design legado.
>
> **Como evitar:** Verificar SEMPRE antes de criar qualquer arquivo:
> ```bash
> find src -name "StockCard*" -type f
> ```
> O novo arquivo DEVE ser `StockCardRedesign.jsx` em `src/features/stock/components/redesign/`.

### AP-W8-02: Duplicar `loadData` em `StockRedesign.jsx`

> **O que é:** copiar as ~80 linhas de fetch de `Stock.jsx` para dentro de `StockRedesign.jsx` em vez de usar `useStockData`.
>
> **Por que importa aqui:** Qualquer correção futura no cálculo de `daysRemaining` ou nos thresholds precisaria ser feita em dois lugares. Isso já causou bugs em waves anteriores com lógica de protocolos.
>
> **Como evitar:** `StockRedesign.jsx` NUNCA chama `medicineService`, `stockService` ou `protocolService` diretamente. Todo acesso a dados passa por `useStockData()`.

### AP-W8-03: Animar `width` na progress bar em vez de `scaleX`

> **O que é:** usar `animate={{ width: '75%' }}` na barra de progresso em vez de `scaleX`.
>
> **Por que importa aqui:** Animar `width` força layout recalculation no browser (não é GPU-composited). Em mobile com muitos cards, isso causa jank visível. A regra de motion da W5 é explícita: **transform + opacity APENAS**.
>
> **Como evitar:** Usar `livingFill.bar` do `useMotion()` — ele anima `scaleX: 0 → 1` com `transformOrigin: left`. O `width` percentual é definido estaticamente no `style` do elemento, não animado. Ver implementação em Sprint 8.2.

### AP-W8-04: Hardcodar cores hex no CSS de `StockCardRedesign` (AP-024 recorrente)

> **O que é:** escrever `.stock-card-r--urgente { color: #ba1a1a }` em vez de `var(--color-error)`.
>
> **Por que importa aqui:** `StockPill.jsx` (reutilizado em W8) tem cores hex hardcoded — isso é dívida técnica conhecida (AP-024), mas está contida no componente existente e não se propaga para o CSS novo. O novo CSS de `StockCardRedesign` deve ser 100% via CSS vars.
>
> **Nota sobre StockPill:** ao reutilizar `StockPill` em vez de criar badge próprio (decisão W8), a dívida de hex hardcoded está isolada em um único arquivo existente. Não copiar esse padrão em nenhum CSS novo desta wave.
>
> **Como evitar:** Antes de escrever qualquer cor no CSS novo, consultar `tokens.redesign.css`. Toda cor tem seu `--color-*` correspondente.

### AP-W8-05: Esquecer `@supports` para `color-mix()` (AP-W06)

> **O que é:** usar `color-mix(in srgb, var(--color-error) 15%, transparent)` sem fallback.
>
> **Por que importa aqui:** Safari < 16.2 não suporta `color-mix()`. Os badges de status e o banner de alerta usam fundos semi-transparentes — sem fallback, eles ficam sem cor em ~15% dos dispositivos iOS.
>
> **Como evitar:** Sempre que usar `color-mix()`, adicionar bloco `@supports not (background: color-mix(...))` com fallback `rgba()` hardcoded (única exceção onde hex/rgba é aceitável: dentro de `@supports not`).

### AP-W8-06: Modificar `Stock.jsx` além da extração do hook

> **O que é:** aproveitar o Sprint 8.1 para "melhorar" o visual de `Stock.jsx`, refatorar handlers ou alterar JSX além do necessário.
>
> **Por que importa aqui:** `Stock.jsx` é a view ativa para usuários sem o flag de redesign. Qualquer mudança visual — mesmo "pequena" — quebra o contrato de rollout gradual e pode afetar usuários em produção.
>
> **Como evitar:** Sprint 8.1 tem escopo cirúrgico: apenas substituir estados/effects de dados pelo hook. O JSX de `Stock.jsx` não é tocado. Se o hook introduzir diferença semântica nos dados (ex: novo campo `stockStatus`), garantir que `Stock.jsx` ainda funciona sem usar esse campo.

### AP-W8-07: Usar `useMemo` para handler de side-effect (`initialParams`)

> **O que é:** usar `useMemo` para executar `setSelectedMedicineId` e `setIsModalOpen` em resposta a `initialParams` — como mostrado no esboço acima para `StockRedesign.jsx`.
>
> **Por que importa aqui:** `useMemo` é para computação pura, não side-effects. Usar `useMemo` para chamar `setState` viola as regras de hooks do React e pode ser executado múltiplas vezes em React StrictMode.
>
> **Como evitar:** Usar `useEffect` para reagir a mudanças em `initialParams`:
> ```javascript
> useEffect(() => {
>   if (initialParams?.medicineId && medicines.length > 0) {
>     setSelectedMedicineId(initialParams.medicineId)
>     setIsModalOpen(true)
>   }
> }, [initialParams, medicines.length])
> ```
> ⚠️ **Corrigir este bug no JSX do Sprint 8.5 antes de commitar.**

### AP-W8-08: Não verificar o chunk Vite para `StockRedesign`

> **O que é:** adicionar `StockRedesign.jsx` em `src/views/redesign/` sem verificar se o `manualChunks` do Vite inclui esse path no chunk `feature-stock`.
>
> **Por que importa aqui:** Se `StockRedesign` cair no bundle principal, a M2 (89% de redução de bundle) é parcialmente revertida. O chunk `feature-stock` foi criado exatamente para isso.
>
> **Como evitar:** Após criar o arquivo, rodar `npm run build` e verificar o output de chunks. `StockRedesign` deve aparecer no chunk `feature-stock`, não em `index`.

---

## Critérios de Conclusão da Wave 8

### Funcionalidade

- [ ] `useStockData.js` criado com `getStockStatus`, `getBarPercentage` e `lastPurchase` exportados/testáveis
- [ ] `Stock.jsx` usa o hook — visual idêntico ao original (smoke test com flag off)
- [ ] `StockCardRedesign.jsx` renderiza todos os 4 status sem erros; reutiliza `StockPill`
- [ ] `CriticalAlertBanner` aparece/desaparece corretamente
- [ ] `EntradaHistorico` exibe custo do lote + expande/colapsa com "Ver tudo"
- [ ] `StockRedesign.jsx` orquestra corretamente simple vs complex (sem moderate)

### Design

- [ ] Simple mode: seções CRÍTICO / ATENÇÃO / OK; **2 colunas desktop** (Pinterest deck)
- [ ] Simple mode: sem badge próprio — `StockPill` W7.6 reutilizado; sem bar-pct%; sem seção histórico
- [ ] Simple mode: CTA visível apenas em urgente/atencao; "Comprar em Breve" para atencao
- [ ] Simple mode: "última compra: DD/MM · R$ X,XX" como subtexto per-card
- [ ] Complex mode: grid responsivo (2-col tablet → 3-col desktop) via CSS puro
- [ ] Complex mode: `EntradaHistorico` com custo do lote por entrada
- [ ] Dias restantes em Public Sans 700, destaque visual claro
- [ ] Progress bars animam com `scaleX` (não `width`)
- [ ] Border-left 4px semântico nos cards
- [ ] FAB em mobile acima da BottomNav; botão de header em desktop

### Qualidade Técnica

- [ ] Zero hex hardcoded no CSS (exceto dentro de `@supports not`)
- [ ] `@supports` fallback em todos os usos de `color-mix()`
- [ ] `parseLocalDate()` usado em todas as datas (não `new Date(str)`)
- [ ] Hook order respeitado em todos os componentes: States → Memos → Effects → Handlers
- [ ] `npm run validate:agent` passa sem erros
- [ ] Build sem chunk excessivo (StockRedesign no chunk `feature-stock`)
- [ ] Smoke test completo com flag on e flag off

### Rollout

- [ ] `Stock.jsx` original visual intacto (flag off)
- [ ] `StockRedesign.jsx` renderiza com flag on
- [ ] Deep link `initialParams.medicineId` funcional no redesign
- [ ] PR criado na branch `feature/redesign/wave-8-stock`
- [ ] Aguardar review Gemini antes de merge (nunca auto-merge — AP-020)

---

## Referências

| Arquivo | Propósito |
|---------|-----------|
| `plans/redesign/EXEC_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md` (seção 13) | Spec master da W8 |
| `plans/redesign/EXEC_SPEC_GRADUAL_ROLLOUT.md` | Estratégia de rollout + regras de flag |
| `plans/redesign/references/simple-estoque-mobile.png` | Mock mobile (Simple mode) |
| `plans/redesign/references/complex-estoque-desktop.png` | Mock desktop (Complex mode) |
| `plans/redesign/references/PRODUCT_STRATEGY_CONSOLIDATED.md` | Personas, tokens, motion |
| `plans/redesign/references/DESIGN-SYSTEM.md` | Componentes e filosofia visual |
| `src/features/stock/hooks/useStockData.js` | Hook de dados (a criar nesta wave) |
| `src/views/Stock.jsx` | View original (não modificar visualmente) |
| `src/views/redesign/DashboardRedesign.jsx` | Referência de padrão de view redesenhada |
| `src/views/redesign/TreatmentsRedesign.jsx` | Referência de orquestração com persona |
| `src/shared/hooks/useMotion.js` | Hook de animação (cascade, fill, tactile) |
| `src/shared/utils/motionConstants.js` | Constantes de animação exportadas |
| `src/shared/styles/tokens.redesign.css` | Tokens CSS disponíveis |
| `src/shared/styles/layout.redesign.css` | Classes grid-2, grid-3, page-container |
| `.memory/anti-patterns.md` | Anti-patterns do projeto (ler antes de codar) |
| `.memory/rules.md` | Regras positivas do projeto (ler antes de codar) |
