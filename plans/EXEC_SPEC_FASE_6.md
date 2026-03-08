# Spec de Execucao — Fase 6: Inteligencia & Insights (SSOT)

**Versao:** 2.0 (Consolidada)
**Data:** 08/03/2026
**Status:** SINGLE SOURCE OF TRUTH para agentes autonomos
**Baseline:** v3.2.0 (Fase 5 completa) → v3.3.0
**Escopo:** 39 SP | 8 features | 5 sprints sequenciais com paralelizacao parcial
**Referências:** `PHASE_6_SPEC.md` (overview), `ROADMAP_v4.md` (timeline), `UX_VISION_EXPERIENCIA_PACIENTE.md` (contexto UX)

---

## 1. Contexto

A Fase 6 transforma dados ja acumulados no app (doses, estoque, protocolos) em predicoes acionaveis. Todo o processamento e client-side, sem chamadas extras ao Supabase, sem dependencias npm novas. O objetivo e tornar o app indispensavel ao mostrar ao paciente informacoes que ele nao teria sozinho.

---

## 2. Regras Criticas para Fase 6 (suplementar a skill `deliver-sprint`)

**Antes de começar, agente DEVE invocar:**
```
/deliver-sprint plans/EXEC_SPEC_FASE_6.md
```

Isso executará as 7 fases automaticamente. Este documento complementa com **gaps específicos de Fase 6**:

**Regras críticas adicionais:**
- **Zero Supabase novo:** Services são puras (recebem dados, retornam resultado)
- **Zero npm novo:** Apenas lógica: média, tendência, arredondamento
- **Feature Flag obrigatória:** `if (!hasEnoughData) return null` em cada insight
- **localStorage apenas para state:** Dismissals, preferências. NUNCA dados médicos
- **Pattern A-C (Padrões):** Ver seção 3.5 — reutilizar em todos os sprints

---

## 3. Grafo de Dependências (Feature → Feature)

```
Sprint 6.1 ┐
  I01 (Refill) ──→ INT-02 (Bot alerts) ← Sprint 6.3
  I04 (Risk) ──→ INT-01 (PDF) ← Sprint 6.3
              └→ insightService (PROTOCOL_RISK alerts)

Sprint 6.2
  I05 (Real Costs) — INDEPENDENTE (evolui F5.10)

Sprint 6.3
  INT-01, INT-02 — dependem de I01 + I04

Sprint 6.4
  I03 (Reminder Optimizer) — INDEPENDENTE

Sprint 6.5
  I02 (Heatmap), EV-07 (Timeline) — INDEPENDENTES

PARALELIZACAO SEGURA: 6.1 | 6.2 | 6.4 | 6.5 podem rodar em paralelo
                      ├─→ 6.3 (depende de 6.1)
Ordem sugerida: 1 → 2,4,5 paralelo → 3
```

---

## 3.5. Padrões Reutilizáveis (para agentes não repetirem)

### Pattern A: Integração Service → Component
```javascript
// 1. Service retorna resultado puro
export function calculateXYZ(params) {
  return { resultado }
}

// 2. Hook chamador recupera dados + chama service
const { data: medicines } = useCachedQuery('medicines', ...)
const { data: logs } = useCachedQuery('logs', ...)
const prediction = useMemo(
  () => calculateXYZ({ medicines, logs }),
  [medicines, logs]
)

// 3. Componente renderiza resultado
return prediction ? <Result data={prediction} /> : <EmptyState />
```

### Pattern B: Feature Flag (dados suficientes)
```javascript
// Sempre verificar minimo de dados ANTES de calcular/renderizar
const hasEnoughData = logs.length >= 14  // ou 21, ou outro threshold
const insight = hasEnoughData ? calculateInsight(...) : null

return insight ? <InsightUI data={insight} /> : null
```

### Pattern C: localStorage para Persistencia
```javascript
// APENAS para estado do usuario (dismissals, preferencias)
// NUNCA para dados medicos sensíveis
const KEY = 'optimizer_dismissed_${protocolId}'
const isSuggestionDismissed = () => {
  const stored = localStorage.getItem(KEY)
  if (!stored) return false
  const { timestamp, permanent } = JSON.parse(stored)
  return permanent || (Date.now() - timestamp < 30*24*60*60*1000)
}
```

---

## 3. Principio Arquitetural Central

```
SUPABASE --[fetch na mount]--> useCachedQuery --[cache SWR]--> Service Puro --[retorno]--> Component
                                                                    ^
                                                                    |
                                                            DADOS JA EM MEMORIA
                                                            ZERO NETWORK CALLS
```

**Fluxo obrigatorio:**
1. Componente/hook recupera dados via `useCachedQuery` (ex: medicines, logs, protocols)
2. Service PURO recebe dados como parametros, calcula, retorna resultado
3. Componente renderiza resultado ou null (se dados insuficientes)
4. Service NUNCA importa Supabase client, NUNCA faz fetch

---

## 3.1. Como Usar a Skill `deliver-sprint` com Este Doc

**A skill `deliver-sprint` executa 7 fases automaticamente:**
1. Setup & Exploration (agente lê spec, explora codebase)
2. Implementation (agente escreve código: Schemas → Services → Components → Views → Tests → Styles)
3. Validation Local (agente roda `npm run validate:agent`)
4. Git & Docs (agente atualiza .memory/)
5. Push & Code Review (agente cria PR, aguarda Gemini)
6. Merge & Cleanup (agente faz merge)
7. Final Documentation (agente atualiza spec + journal)

**Este EXEC_SPEC é COMPLEMENTAR à skill. Agente DEVE:**
1. Invocar `/deliver-sprint plans/EXEC_SPEC_FASE_6.md` (começa Phase 1 automaticamente)
2. Usar seções deste doc para **decisões de design/dependências específicas de Fase 6**
3. Usar `CLAUDE.md` + `.memory/` para **padrões gerais do projeto**
4. Usar skill `deliver-sprint` para **workflow de 7 fases**

**Não duplicar info: skill cobre fases genéricas, EXEC_SPEC cobre specificidades de Fase 6.**

---

## 4. Checklist Pre-Codigo (Phase 1 da skill deliver-sprint)

**Skill `deliver-sprint` ja cobre setup — este doc complementa com verificacoes de Fase 6:**

**Arquivos que SEMPRE existem (ler antes de cada sprint):**
- ✅ `src/utils/dateUtils.js` — `parseLocalDate()`, `formatLocalDate()`, `daysDifference()`
- ✅ `src/utils/adherenceLogic.js` — `calculateDailyIntake()` (referencia para I01 + I04)
- ✅ `src/shared/hooks/useCachedQuery.js` — Assinatura: `(key, fetcher) → { data, loading, error }`
- ✅ `src/features/dashboard/services/insightService.js` — Como gerar alerts

**Verificacoes por sprint (Phase 1 da skill — Explore Codebase):**

### Sprint 6.1 (I01 + I04)
- [ ] Arquivo `src/utils/adherenceLogic.js` existe e exporta `calculateDailyIntake()`?
- [ ] Qual é a assinatura exata? Params e return type?
- [ ] `src/shared/hooks/useCachedQuery.js` — qual é o seu retorno? `{ data, loading, error }`?

### Sprint 6.2 (I05)
- [ ] Arquivo `src/features/stock/services/costAnalysisService.js` já existe (F5.10)?
- [ ] Qual é a função atual? Qual precisa ser adicionada?
- [ ] CostChart.jsx já existe? Em qual caminho?

### Sprint 6.3 (INT-01 + INT-02)
- [ ] Qual é o arquivo/funcao que gera PDF? (buscar com `grep -r "jsPDF\|jspdf"`)
- [ ] `server/bot/tasks.js` — qual é a funcao de alerta de estoque?
- [ ] Pattern de mensagem atual no bot?

### Sprint 6.4 (I03)
- [ ] localStorage é usado em outros serviços do projeto? Qual padrão?
- [ ] Dashboard.jsx — onde renderizar ReminderSuggestion? Modal? Toast? Inline?

### Sprint 6.5 (I02 + EV-07)
- [ ] PrescriptionTimeline.jsx já existe? (buscar com `find src -name "*PrescriptionTimeline*"`)
- [ ] Tab "Perfil > Minha Saude" já existe? Qual é o caminho do arquivo?

---

## 5. Sequencialidade & Paralelizacao (Essencial para agentes)

**ORDEM OBRIGATÓRIA (dependências):**

```
┌─ Sprint 6.1: I01 + I04 (10 SP) ────────────────────────┐
│ Refill Prediction Service (I01)     → usado por INT-02 │
│ Protocol Risk Service (I04)         → usado por INT-01 │
│ Integracao leve UI (StockBars badge, Accordion badge) │
└────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────┐
    │ Sprints 6.2, 6.4, 6.5 = PARALELIZÁVEIS           │
    │ (nenhuma dependência entre elas)                  │
    │                                                    │
    │  6.2: I05 Cost Analysis (5 SP) — Evolui F5.10    │
    │  6.4: I03 Reminder Optimizer (8 SP) — UI toast   │
    │  6.5: I02 Heatmap + EV-07 Timeline (11 SP)       │
    └────────────────────────────────────────────────────┘
         ↓ (após 6.1 + qualquer um de 6.2/4/5)
┌─ Sprint 6.3: INT-01 + INT-02 (5 SP) ──────────────────┐
│ INT-01: Risk Score no PDF (precisa I04 de 6.1)       │
│ INT-02: Refill Alerts no Bot (precisa I01 de 6.1)    │
└────────────────────────────────────────────────────────┘

TIMELINE COM PARALELIZACAO:
- Sprint 6.1: 3-4 horas (1 agente, services claros)
- Sprints 6.2+4+5 em paralelo: 3-4 horas cada (3 agentes idealmente)
- Sprint 6.3: 2-3 horas (após 6.1 pronto, pode fazer paralelo com tail de 6.2/4/5)
- **Total: ~1 semana útil (4h + 4h paralelo + 2h integração)**
```

---

## 5. Sprint 6.1 — Previsao de Reposicao + Score de Risco (10 SP)

### I01: refillPredictionService.js (5 SP)

| Campo | Valor |
|-------|-------|
| **Criar** | `src/features/stock/services/refillPredictionService.js` |
| **Testar** | `src/features/stock/services/__tests__/refillPredictionService.test.js` |
| **Dependencias** | Nenhuma nova. Usa dados de medicines, stocks, protocols, logs |

**Implementacao:**

```javascript
// src/features/stock/services/refillPredictionService.js

import { parseLocalDate, formatLocalDate, daysDifference } from '@utils/dateUtils'
import { calculateDailyIntake } from '@utils/adherenceLogic'

/**
 * Calcula previsao de reposicao baseada em consumo REAL (logs de doses).
 * Fallback para consumo teorico se dados insuficientes (<14 dias).
 *
 * @param {Object} params
 * @param {string} params.medicineId - ID do medicamento
 * @param {number} params.currentStock - Quantidade atual em estoque
 * @param {Array} params.logs - Logs de doses dos ultimos 30 dias para este med
 * @param {Array} params.protocols - Protocolos ativos deste medicamento
 * @returns {{
 *   daysRemaining: number,
 *   predictedStockoutDate: string|null,  // YYYY-MM-DD
 *   dailyConsumption: number,
 *   isRealData: boolean,  // true=consumo real, false=teorico
 *   confidence: 'high'|'medium'|'low'
 * }}
 */
export function predictRefill({ medicineId, currentStock, logs, protocols }) {
  // 1. Calcular consumo real (ultimos 30 dias)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentLogs = logs.filter(log =>
    log.medicine_id === medicineId &&
    new Date(log.taken_at) >= thirtyDaysAgo
  )

  const daysWithData = getDaysWithData(recentLogs)

  let dailyConsumption
  let isRealData
  let confidence

  if (daysWithData >= 14) {
    // Consumo real: total de comprimidos consumidos / dias com dados
    const totalConsumed = recentLogs.reduce((sum, log) => sum + log.quantity_taken, 0)
    dailyConsumption = totalConsumed / daysWithData
    isRealData = true
    confidence = daysWithData >= 21 ? 'high' : 'medium'
  } else {
    // Fallback: consumo teorico baseado no protocolo
    dailyConsumption = calculateDailyIntake(medicineId, protocols)
    isRealData = false
    confidence = 'low'
  }

  // 2. Calcular dias restantes
  const daysRemaining = dailyConsumption > 0
    ? Math.floor(currentStock / dailyConsumption)
    : Infinity

  // 3. Calcular data prevista de stockout
  let predictedStockoutDate = null
  if (daysRemaining !== Infinity && daysRemaining >= 0) {
    const stockoutDate = new Date()
    stockoutDate.setDate(stockoutDate.getDate() + daysRemaining)
    predictedStockoutDate = formatLocalDate(stockoutDate)
  }

  return {
    daysRemaining,
    predictedStockoutDate,
    dailyConsumption: Math.round(dailyConsumption * 100) / 100,
    isRealData,
    confidence,
  }
}

/**
 * Calcula previsao para TODOS os medicamentos com estoque.
 * @param {Object} params
 * @param {Array} params.medicines - Todos os medicamentos
 * @param {Array} params.stocks - Todos os registros de estoque
 * @param {Array} params.logs - Todos os logs de doses (30 dias)
 * @param {Array} params.protocols - Todos os protocolos ativos
 * @returns {Array<{medicineId, name, ...prediction}>}
 */
export function predictAllRefills({ medicines, stocks, logs, protocols }) {
  return medicines
    .map(med => {
      const medStocks = stocks.filter(s => s.medicine_id === med.id)
      const currentStock = medStocks.reduce((sum, s) => sum + s.quantity, 0)
      if (currentStock === 0) return null

      const prediction = predictRefill({
        medicineId: med.id,
        currentStock,
        logs,
        protocols: protocols.filter(p => p.medicine_id === med.id),
      })

      return {
        medicineId: med.id,
        name: med.name,
        currentStock,
        ...prediction,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.daysRemaining - b.daysRemaining) // Mais urgente primeiro
}

/**
 * Conta dias unicos com pelo menos 1 log.
 */
function getDaysWithData(logs) {
  const uniqueDays = new Set(
    logs.map(log => formatLocalDate(new Date(log.taken_at)))
  )
  return uniqueDays.size
}
```

**Cenarios de teste:**

```javascript
describe('refillPredictionService', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  describe('predictRefill', () => {
    it('calcula previsao com consumo real (>=14 dias de dados)', () => {
      // 30 logs em 15 dias, quantity_taken=1 cada, currentStock=30
      // dailyConsumption = 30/15 = 2, daysRemaining = 30/2 = 15
      // isRealData=true, confidence='medium' (15 dias)
    })

    it('usa consumo teorico quando dados insuficientes (<14 dias)', () => {
      // 5 logs em 5 dias, protocolo diario 2x/dia
      // dailyConsumption = 2 (teorico), isRealData=false, confidence='low'
    })

    it('retorna confidence high com >=21 dias', () => {
      // 42 logs em 21 dias
      // confidence='high'
    })

    it('retorna Infinity quando dailyConsumption e 0', () => {
      // Med sem protocolo, sem logs
      // daysRemaining = Infinity, predictedStockoutDate = null
    })

    it('calcula data de stockout corretamente', () => {
      // currentStock=10, dailyConsumption=2
      // daysRemaining=5, predictedStockoutDate = hoje + 5 dias
    })

    it('lida com estoque zero', () => {
      // currentStock=0
      // daysRemaining=0
    })
  })

  describe('predictAllRefills', () => {
    it('ordena por daysRemaining ASC (mais urgente primeiro)', () => {})
    it('exclui medicamentos com estoque zero', () => {})
    it('retorna array vazio quando nao ha estoque', () => {})
  })
})
```

### I04: protocolRiskService.js (5 SP)

| Campo | Valor |
|-------|-------|
| **Criar** | `src/features/adherence/services/protocolRiskService.js` |
| **Testar** | `src/features/adherence/services/__tests__/protocolRiskService.test.js` |
| **Dependencias** | Nenhuma nova. Usa dados de logs e protocols |

**Implementacao:**

```javascript
// src/features/adherence/services/protocolRiskService.js

import { parseLocalDate, formatLocalDate } from '@utils/dateUtils'

/**
 * Niveis de risco para protocolos.
 */
export const RISK_LEVELS = {
  STABLE: 'stable',
  ATTENTION: 'attention',
  CRITICAL: 'critical',
}

export const RISK_COLORS = {
  stable: 'var(--color-success)',     // #22c55e
  attention: 'var(--color-warning)',   // #f59e0b
  critical: 'var(--color-error)',      // #ef4444
}

export const RISK_LABELS = {
  stable: 'Estavel',
  attention: 'Atencao',
  critical: 'Critico',
}

/**
 * Calcula score de risco para um protocolo.
 *
 * @param {Object} params
 * @param {string} params.protocolId
 * @param {Array} params.logs - TODOS os logs do usuario (sera filtrado internamente)
 * @param {Object} params.protocol - Protocolo com time_schedule, frequency, dosage_per_intake
 * @returns {{
 *   protocolId: string,
 *   adherence14d: number,    // 0-100
 *   trend7d: number,         // delta percentual (-100 a +100)
 *   riskLevel: 'stable'|'attention'|'critical',
 *   riskColor: string,
 *   riskLabel: string,
 *   hasEnoughData: boolean
 * }}
 */
export function calculateProtocolRisk({ protocolId, logs, protocol }) {
  const now = new Date()
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(now.getDate() - 14)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 7)

  // Filtrar logs deste protocolo
  const protocolLogs = logs.filter(log =>
    log.protocol_id === protocolId ||
    log.medicine_id === protocol.medicine_id
  )

  // Adesao ultimos 14 dias
  const logs14d = protocolLogs.filter(log => new Date(log.taken_at) >= fourteenDaysAgo)
  const expected14d = calculateExpectedDosesForProtocol(protocol, 14)
  const adherence14d = expected14d > 0
    ? Math.min(100, Math.round((logs14d.length / expected14d) * 100))
    : 100

  // Adesao ultimos 7 dias vs 7 dias anteriores (trend)
  const logs7d = protocolLogs.filter(log => new Date(log.taken_at) >= sevenDaysAgo)
  const logsPrev7d = protocolLogs.filter(log => {
    const logDate = new Date(log.taken_at)
    return logDate >= fourteenDaysAgo && logDate < sevenDaysAgo
  })
  const expected7d = calculateExpectedDosesForProtocol(protocol, 7)
  const adherence7d = expected7d > 0 ? (logs7d.length / expected7d) * 100 : 100
  const adherencePrev7d = expected7d > 0 ? (logsPrev7d.length / expected7d) * 100 : 100
  const trend7d = Math.round(adherence7d - adherencePrev7d)

  // Verificar dados suficientes
  const hasEnoughData = expected14d >= 4 // Pelo menos ~2 doses/semana

  // Classificar risco
  let riskLevel
  if (!hasEnoughData) {
    riskLevel = RISK_LEVELS.STABLE // Nao penalizar sem dados
  } else if (adherence14d < 50 || trend7d < -15) {
    riskLevel = RISK_LEVELS.CRITICAL
  } else if (adherence14d < 80 || (trend7d >= -15 && trend7d < -5)) {
    riskLevel = RISK_LEVELS.ATTENTION
  } else {
    riskLevel = RISK_LEVELS.STABLE
  }

  return {
    protocolId,
    adherence14d,
    trend7d,
    riskLevel,
    riskColor: RISK_COLORS[riskLevel],
    riskLabel: RISK_LABELS[riskLevel],
    hasEnoughData,
  }
}

/**
 * Calcula risco para TODOS os protocolos ativos.
 */
export function calculateAllProtocolRisks({ protocols, logs }) {
  return protocols
    .filter(p => p.active)
    .map(protocol => calculateProtocolRisk({
      protocolId: protocol.id,
      logs,
      protocol,
    }))
}

/**
 * Calcula doses esperadas para um protocolo em N dias.
 * Referencia: adherenceLogic.js getDailyDoseRate
 */
function calculateExpectedDosesForProtocol(protocol, days) {
  const timesPerDay = protocol.time_schedule?.length || 1
  let dosesPerDay

  switch (protocol.frequency) {
    case 'diario':
      dosesPerDay = timesPerDay
      break
    case 'dias_alternados':
      dosesPerDay = timesPerDay / 2
      break
    case 'semanal':
      dosesPerDay = timesPerDay / 7
      break
    case 'quando_necessario':
    case 'personalizado':
      dosesPerDay = 0
      break
    default:
      dosesPerDay = timesPerDay
  }

  return Math.round(dosesPerDay * days)
}
```

**Cenarios de teste:**

```javascript
describe('protocolRiskService', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  describe('calculateProtocolRisk', () => {
    it('classifica como STABLE com adesao >=80% e trend >= -5%', () => {
      // 13/14 doses tomadas, trend estavel
    })

    it('classifica como ATTENTION com adesao 50-79%', () => {
      // 9/14 doses tomadas
    })

    it('classifica como CRITICAL com adesao <50%', () => {
      // 5/14 doses tomadas
    })

    it('classifica como CRITICAL com trend < -15%', () => {
      // Semana atual muito pior que anterior
    })

    it('retorna STABLE quando dados insuficientes', () => {
      // Protocolo com quando_necessario ou poucos dias
    })

    it('calcula trend corretamente', () => {
      // 7d: 100%, prev7d: 80% → trend = +20
    })

    it('cap adherence at 100%', () => {
      // Mais logs que esperado (doses extras)
    })
  })

  describe('calculateAllProtocolRisks', () => {
    it('filtra protocolos inativos', () => {})
    it('retorna array vazio sem protocolos', () => {})
  })
})
```

### Integracao na UI — Sprint 6.1

Apos services prontos, integrar minimamente:

1. **StockBars** — Adicionar `predictedDays` do refillPredictionService ao tooltip
2. **TreatmentAccordion** — Adicionar badge de risco (dot colorido) ao lado do nome do protocolo

Estas integracoes sao leves (2-3 linhas cada) e servem para validar os services visualmente.

### Quality Gate Sprint 6.1

- [ ] `refillPredictionService.js` criado com testes >= 90% cobertura
- [ ] `protocolRiskService.js` criado com testes >= 90% cobertura
- [ ] Ambos services sao funcoes puras (sem import de supabase)
- [ ] Zero chamadas ao Supabase (verificar grep)
- [ ] `npm run validate:agent` passa
- [ ] Badge de risco visivel no TreatmentAccordion
- [ ] Previsao de reposicao visivel no StockBars tooltip
- [ ] Branch: `feature/fase-6/sprint-1-prediction-risk`
- [ ] Commit: `feat(adherence): add refill prediction and protocol risk services`

---

## 6. Sprint 6.2 — Analise de Custo Avancada (5 SP)

### I05: Evolucao do costAnalysisService.js

| Campo | Valor |
|-------|-------|
| **Modificar** | `src/features/stock/services/costAnalysisService.js` (criado na Fase 5) |
| **Testar** | `src/features/stock/services/__tests__/costAnalysisService.test.js` (estender) |

**O que adicionar ao service existente:**

```javascript
/**
 * Calcula custo usando consumo REAL (evolucao do calculo teorico da Fase 5).
 *
 * @param {Object} params
 * @param {Array} params.medicines - Medicamentos com stock[] embeddado
 * @param {Array} params.protocols - Protocolos ativos
 * @param {Array} params.logs - Logs de doses (30 dias)
 * @returns {{ items, totalMonthly, projection3m, projection6m, isRealData }}
 */
export function calculateRealCosts({ medicines, protocols, logs }) {
  const items = medicines
    .filter(med => protocols.some(p => p.medicine_id === med.id && p.active))
    .map(med => {
      const medLogs = logs.filter(l => l.medicine_id === med.id)
      const avgUnitPrice = calculateAvgUnitPrice(med.stock || [])

      // Consumo real vs teorico
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const recentLogs = medLogs.filter(l => new Date(l.taken_at) >= thirtyDaysAgo)
      const daysWithData = new Set(
        recentLogs.map(l => new Date(l.taken_at).toISOString().slice(0, 10))
      ).size

      let dailyConsumption
      let isRealData

      if (daysWithData >= 14) {
        const totalConsumed = recentLogs.reduce((sum, l) => sum + l.quantity_taken, 0)
        dailyConsumption = totalConsumed / daysWithData
        isRealData = true
      } else {
        dailyConsumption = calculateDailyIntake(med.id, protocols)
        isRealData = false
      }

      const monthlyCost = dailyConsumption * avgUnitPrice * 30

      return {
        medicineId: med.id,
        name: med.name,
        dailyConsumption: Math.round(dailyConsumption * 100) / 100,
        avgUnitPrice,
        monthlyCost: Math.round(monthlyCost * 100) / 100,
        hasPriceData: avgUnitPrice > 0,
        isRealData,
      }
    })
    .filter(item => item.monthlyCost > 0 || !item.hasPriceData)
    .sort((a, b) => b.monthlyCost - a.monthlyCost)

  const totalMonthly = items.reduce((sum, item) => sum + item.monthlyCost, 0)

  return {
    items,
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    projection3m: Math.round(totalMonthly * 3 * 100) / 100,
    projection6m: Math.round(totalMonthly * 6 * 100) / 100,
    isRealData: items.some(i => i.isRealData),
  }
}
```

**Integracao na UI:**
- Atualizar CostChart para mostrar badge "Baseado no consumo real" ou "Estimativa" conforme `isRealData`
- Adicionar projecao 6 meses alem de 3

### Quality Gate Sprint 6.2

- [ ] `calculateRealCosts` implementado e testado
- [ ] CostChart atualizado com indicador real/estimativa
- [ ] Testes >= 90% cobertura
- [ ] Branch: `feature/fase-6/sprint-2-cost-enhanced`

---

## 7. Sprint 6.3 — Integracoes Cross-Cutting (5 SP)

### INT-01: Risk Score no PDF Reports (2 SP)

| Campo | Valor |
|-------|-------|
| **Modificar** | Arquivo de geracao PDF (buscar com `grep -r "jspdf\|jsPDF" src/`) |
| **Dependencias** | I04 (protocolRiskService) |

**O que fazer:**
1. Localizar o componente/service de geracao PDF
2. Adicionar secao "Risco por Protocolo" ao relatorio
3. Tabela com colunas: Protocolo | Adesao 14d | Tendencia | Classificacao
4. Usar cores no PDF: vermelho para critico, amarelo para atencao, verde para estavel
5. So incluir se `hasEnoughData === true`

**Padrao de integracao:**
```javascript
import { calculateAllProtocolRisks, RISK_LABELS } from '@adherence/services/protocolRiskService'

// No gerador PDF, apos calcular dados:
const risks = calculateAllProtocolRisks({ protocols, logs })
const risksWithData = risks.filter(r => r.hasEnoughData)

if (risksWithData.length > 0) {
  // Adicionar tabela ao PDF
  doc.text('Risco por Protocolo', x, y)
  risksWithData.forEach(risk => {
    // protocolo.name | risk.adherence14d% | trend7d% | risk.riskLabel
  })
}
```

### INT-02: Refill Prediction nos Alertas Bot (3 SP)

| Campo | Valor |
|-------|-------|
| **Modificar** | `server/bot/tasks.js` |
| **Dependencias** | I01 (refillPredictionService) |

**O que fazer:**
1. Localizar funcao de alerta de estoque no `tasks.js` (buscar `formatStockAlertMessage` ou `formatProactiveStockMessage`)
2. Substituir logica simples `quantity / daily_intake` pela previsao do refillPredictionService
3. Incluir data prevista de stockout na mensagem
4. Manter fallback para calculo teorico

**ATENCAO:** O bot roda server-side. O refillPredictionService e client-side. Duas opcoes:
- **Opcao A (recomendada):** Duplicar a logica de calculo de consumo real no bot (mesmo algoritmo, dados do Supabase direto). O service client-side e o bot compartilham a LOGICA, nao o codigo.
- **Opcao B:** Extrair funcao pura para `server/bot/utils/refillCalculation.js` que o service client-side tambem usa. Mas cuidado com path aliases que nao existem no server/.

**Mensagem atualizada:**
```javascript
// Antes:
// "Estoque baixo: Losartana (4 dias restantes)"

// Depois:
// "Estoque baixo: Losartana (4 dias restantes, previsao de esgotamento: 12/03)"
// Ou se dados reais disponiveis:
// "Baseado no seu consumo real, Losartana acaba em ~4 dias (12/03)"
```

### Quality Gate Sprint 6.3

- [ ] Secao "Risco por Protocolo" no PDF com cores
- [ ] Alertas do bot com data de stockout prevista
- [ ] Zero regressao nos testes do bot existentes
- [ ] `npm run validate:agent` passa
- [ ] Branch: `feature/fase-6/sprint-3-integrations`

---

## 8. Sprint 6.4 — Otimizador de Horario (8 SP)

### I03: reminderOptimizerService.js

| Campo | Valor |
|-------|-------|
| **Criar** | `src/features/protocols/services/reminderOptimizerService.js` |
| **Criar** | `src/features/protocols/components/ReminderSuggestion.jsx` |
| **Testar** | `src/features/protocols/services/__tests__/reminderOptimizerService.test.js` |

**Implementacao do service:**

```javascript
// src/features/protocols/services/reminderOptimizerService.js

import { parseLocalDate } from '@utils/dateUtils'

/**
 * Analisa delta entre horario programado e horario real de tomada.
 * Se o paciente consistentemente toma em horario diferente, sugere ajuste.
 *
 * @param {Object} params
 * @param {Object} params.protocol - Protocolo com time_schedule
 * @param {Array} params.logs - Logs de dose para este protocolo
 * @returns {{
 *   shouldSuggest: boolean,
 *   currentTime: string,       // HH:MM programado
 *   suggestedTime: string,     // HH:MM sugerido
 *   avgDeltaMinutes: number,   // Delta medio em minutos
 *   sampleCount: number,       // Quantas amostras usadas
 *   direction: 'later'|'earlier'
 * } | null}
 */
export function analyzeReminderTiming({ protocol, logs }) {
  if (!protocol.time_schedule || protocol.time_schedule.length === 0) return null
  if (protocol.frequency === 'quando_necessario') return null

  const suggestions = []

  for (const scheduledTime of protocol.time_schedule) {
    const [scheduledH, scheduledM] = scheduledTime.split(':').map(Number)
    const scheduledMinutes = scheduledH * 60 + scheduledM

    // Filtrar logs relevantes para este horario (dentro de 4h window)
    const relevantLogs = logs.filter(log => {
      if (log.protocol_id !== protocol.id && log.medicine_id !== protocol.medicine_id) return false
      const logDate = new Date(log.taken_at)
      const logMinutes = logDate.getHours() * 60 + logDate.getMinutes()
      const delta = Math.abs(logMinutes - scheduledMinutes)
      return delta < 240 // Dentro de 4h do horario programado
    })

    if (relevantLogs.length < 10) continue // Amostras insuficientes

    // Calcular delta medio
    const deltas = relevantLogs.map(log => {
      const logDate = new Date(log.taken_at)
      const logMinutes = logDate.getHours() * 60 + logDate.getMinutes()
      return logMinutes - scheduledMinutes
    })

    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length

    // Sugerir apenas se |avgDelta| > 30 minutos
    if (Math.abs(avgDelta) <= 30) continue

    // Arredondar para 15 minutos
    const suggestedMinutes = scheduledMinutes + Math.round(avgDelta / 15) * 15
    const suggestedH = Math.floor(suggestedMinutes / 60) % 24
    const suggestedM = suggestedMinutes % 60
    const suggestedTime = `${String(suggestedH).padStart(2, '0')}:${String(suggestedM).padStart(2, '0')}`

    suggestions.push({
      shouldSuggest: true,
      currentTime: scheduledTime,
      suggestedTime,
      avgDeltaMinutes: Math.round(avgDelta),
      sampleCount: relevantLogs.length,
      direction: avgDelta > 0 ? 'later' : 'earlier',
    })
  }

  return suggestions.length > 0 ? suggestions[0] : null // Uma sugestao por vez
}

/**
 * Verifica se a sugestao ja foi dispensada pelo usuario.
 * @param {string} protocolId
 * @returns {boolean}
 */
export function isSuggestionDismissed(protocolId) {
  if (typeof window === 'undefined') return true // Server-side
  const key = `optimizer_dismissed_${protocolId}`
  const dismissed = localStorage.getItem(key)
  if (!dismissed) return false

  const { timestamp, permanent } = JSON.parse(dismissed)
  if (permanent) return true

  // Dispensado por 30 dias
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  return Date.now() - timestamp < thirtyDaysMs
}

/**
 * Registra dispensa da sugestao.
 * @param {string} protocolId
 * @param {boolean} permanent - Se true, nunca mais sugerir
 */
export function dismissSuggestion(protocolId, permanent = false) {
  if (typeof window === 'undefined') return
  const key = `optimizer_dismissed_${protocolId}`
  localStorage.setItem(key, JSON.stringify({
    timestamp: Date.now(),
    permanent,
  }))
}
```

**Componente de sugestao:**

```javascript
// src/features/protocols/components/ReminderSuggestion.jsx

import { dismissSuggestion } from '@protocols/services/reminderOptimizerService'

/**
 * Notificacao in-app nao-intrusiva para sugestao de ajuste de horario.
 *
 * Props:
 * - suggestion: { currentTime, suggestedTime, avgDeltaMinutes, sampleCount }
 * - protocolId: string
 * - protocolName: string
 * - onAccept: (newTime: string) => void  // Chama protocolService.update()
 * - onDismiss: () => void
 */
export default function ReminderSuggestion({
  suggestion,
  protocolId,
  protocolName,
  onAccept,
  onDismiss,
}) {
  const handleAccept = () => {
    onAccept(suggestion.suggestedTime)
    dismissSuggestion(protocolId, false)
  }

  const handleKeep = () => {
    dismissSuggestion(protocolId, false) // 30 dias
    onDismiss()
  }

  const handleNeverAsk = () => {
    dismissSuggestion(protocolId, true) // Permanente
    onDismiss()
  }

  return (
    <div className="reminder-suggestion" role="alert">
      <p>
        Voce costuma tomar <strong>{protocolName}</strong> por volta das{' '}
        <strong>{suggestion.suggestedTime}</strong>. Quer ajustar o lembrete
        de {suggestion.currentTime} para {suggestion.suggestedTime}?
      </p>
      <div className="suggestion-actions">
        <button onClick={handleAccept}>Ajustar</button>
        <button onClick={handleKeep}>Manter</button>
        <button onClick={handleNeverAsk} className="text-muted">
          Nao perguntar mais
        </button>
      </div>
    </div>
  )
}
```

**Integracao:** Renderizar `ReminderSuggestion` no Dashboard, abaixo do RingGauge, max 1 sugestao por vez. Verificar `isSuggestionDismissed()` antes de mostrar.

**Testes:** Service puro + localStorage mock (padrao do analyticsService.test.js).

### Quality Gate Sprint 6.4

- [ ] Service analisa deltas e sugere horario
- [ ] Componente exibe sugestao com 3 acoes (ajustar/manter/nunca)
- [ ] localStorage persiste dispensa (30d ou permanente)
- [ ] Max 1 sugestao por vez no Dashboard
- [ ] Testes >= 90% cobertura
- [ ] Branch: `feature/fase-6/sprint-4-reminder-optimizer`

---

## 9. Sprint 6.5 — Heatmap + Timeline (11 SP)

### I02: AdherenceHeatmap.jsx (8 SP)

| Campo | Valor |
|-------|-------|
| **Criar** | `src/features/adherence/services/adherencePatternService.js` |
| **Criar** | `src/features/adherence/components/AdherenceHeatmap.jsx` |
| **Testar** | `src/features/adherence/services/__tests__/adherencePatternService.test.js` |

**Service de padroes:**

```javascript
// src/features/adherence/services/adherencePatternService.js

/**
 * Analisa padroes de adesao por dia da semana e periodo do dia.
 *
 * @param {Object} params
 * @param {Array} params.logs - Logs de doses (minimo 21 dias)
 * @param {Array} params.protocols - Protocolos ativos
 * @returns {{
 *   grid: Array<Array<{adherence: number, taken: number, expected: number}>>,
 *   worstCell: { dayIndex: number, periodIndex: number, adherence: number },
 *   narrative: string,
 *   hasEnoughData: boolean
 * }}
 */
export function analyzeAdherencePatterns({ logs, protocols }) {
  // Grid 7 dias x 4 periodos
  // Dias: 0=Domingo, 1=Segunda, ..., 6=Sabado
  // Periodos: 0=Madrugada(0-6h), 1=Manha(6-12h), 2=Tarde(12-18h), 3=Noite(18-24h)

  const DAY_NAMES = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']
  const PERIOD_NAMES = ['Madrugada', 'Manha', 'Tarde', 'Noite']

  // Inicializar grid 7x4
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 4 }, () => ({ taken: 0, expected: 0, adherence: 0 }))
  )

  // Contar doses esperadas por celula (baseado em time_schedule dos protocolos)
  // ... calcular expected por dia-da-semana e periodo

  // Contar doses tomadas por celula (baseado em taken_at dos logs)
  logs.forEach(log => {
    const logDate = new Date(log.taken_at)
    const dayIndex = logDate.getDay() // 0-6
    const hour = logDate.getHours()
    const periodIndex = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3
    grid[dayIndex][periodIndex].taken++
  })

  // Calcular adesao por celula
  // ... adherence = expected > 0 ? min(100, taken/expected * 100) : null

  // Encontrar pior celula (minimo 3 amostras esperadas)
  // ... worstCell = celula com menor adherence onde expected >= 3

  // Gerar narrativa
  // "Seu pior horario e {DAY_NAMES[worstCell.dayIndex]} a {PERIOD_NAMES[worstCell.periodIndex]}"

  return { grid, worstCell, narrative, hasEnoughData }
}
```

**Componente heatmap:**
- Grid 7x4 com cores por intensidade (opacidade sobre cor primaria)
- 100% = opacidade 1.0 (verde), 50% = opacidade 0.5, 0% = opacidade 0.1 (vermelho)
- Tooltip ao tocar celula: "Terca Tarde: 60% (3/5 doses)"
- Narrativa abaixo do grid
- Mobile: se tela < 380px, mostrar como lista (dia + barras de periodo)

**Localizacao:** Tab Perfil > Minha Saude, abaixo do calendario

### EV-07: PrescriptionTimeline (3 SP)

| Campo | Valor |
|-------|-------|
| **Verificar** | `src/features/stock/components/PrescriptionTimeline.jsx` ou `src/shared/components/ui/PrescriptionTimeline.jsx` |
| **Acao** | Se existe: evoluir. Se nao existe: criar. |

**Verificar primeiro:** O componente pode ja existir parcialmente (criado na Onda 1 da UX Evolution). Buscar:
```bash
find src -name "*PrescriptionTimeline*" -o -name "*prescriptionTimeline*"
grep -r "PrescriptionTimeline" src/
```

**Se precisa criar/evoluir:**

```javascript
// src/shared/components/ui/PrescriptionTimeline.jsx

import { parseLocalDate, daysDifference } from '@utils/dateUtils'

/**
 * Timeline visual de prescricao (barra horizontal start_date → end_date).
 *
 * Props:
 * - protocols: Array<{ id, name, start_date, end_date, medicine: { name } }>
 * - onProtocolClick: (protocolId) => void
 */
export default function PrescriptionTimeline({ protocols, onProtocolClick }) {
  const today = new Date()

  const items = protocols.map(protocol => {
    const startDate = parseLocalDate(protocol.start_date)
    const endDate = protocol.end_date ? parseLocalDate(protocol.end_date) : null
    const isContinuous = !endDate

    let status, daysRemaining
    if (isContinuous) {
      status = 'vigente'
      daysRemaining = null
    } else {
      daysRemaining = daysDifference(today, endDate)
      if (daysRemaining < 0) status = 'vencida'
      else if (daysRemaining <= 30) status = 'vencendo'
      else status = 'vigente'
    }

    // Calcular progresso visual (0-100%)
    let progress = 100
    if (!isContinuous) {
      const totalDays = daysDifference(startDate, endDate)
      const elapsedDays = daysDifference(startDate, today)
      progress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 100
    }

    return { ...protocol, startDate, endDate, isContinuous, status, daysRemaining, progress }
  })

  // Renderizar barras horizontais
  // Cor por status: vigente=verde, vencendo=amarelo, vencida=vermelho
  // Marcador "hoje" na posicao progress%
  // Label: "continuo" ou "Xd restantes" ou "Vencida ha Xd"
}
```

**Localizacao:** Tab Estoque, secao "Prescricoes" acima das barras de estoque.
**Interacao:** Tap navega para protocolo via `setCurrentView('treatment')`.

### Quality Gate Sprint 6.5

- [ ] AdherenceHeatmap renderiza grid 7x4 com cores
- [ ] Narrativa automatica do pior horario
- [ ] Heatmap so aparece com >= 21 dias de dados
- [ ] PrescriptionTimeline mostra barras com status colorido
- [ ] Timeline com marcador "hoje" e labels de tempo restante
- [ ] Mobile responsivo (grid → lista em < 380px)
- [ ] Testes >= 90% para services
- [ ] Branch: `feature/fase-6/sprint-5-heatmap-timeline`

---

## 9.5. Wireframes & Especificações Visuais por Feature

### I02 — AdherenceHeatmap
**Localizacao:** Tab Perfil > Minha Saúde, abaixo do calendário
**Layout padrão (tela >= 380px):**
```
┌────────────────────────────┐
│ PADRÕES DE ADESÃO          │
├────────────────────────────┤
│ Dia    │ Madrugada│Manha │Tarde│Noite │
│────────┼───────┼──────┼──────┼──────│
│Domingo │  🟢  │ 🟡  │ 🔴  │ 🟢  │
│Segunda │  🟢  │ 🟢  │ 🟢  │ 🟡  │
│...     │  ... │ ... │ ... │ ... │
└────────────────────────────┘
💡 Seu pior horário é Quarta Tarde
```
**Layout mobile (tela < 380px):**
```
Cards empilhados — cada dia como card separado
Dia │ [Madrugada] [Manha] [Tarde] [Noite]
```
**Cores:**
- 🟢 100% = cor primária, opacity 1.0
- 🟡 50% = cor primária, opacity 0.5
- 🔴 0% = cor primária, opacity 0.1
**Interacao:** Tap em celula → tooltip "Quarta Tarde: 60% (3/5 doses)"
**Acessibilidade:** `aria-label="Heatmap de adesão. Quarta Tarde: 60%"`

### I03 — ReminderSuggestion
**Localizacao:** Dashboard, abaixo do RingGauge (max 1 sugestão por vez)
**Renderização:** Toast/Alert colorido com 3 botões
```
┌────────────────────────────────┐
│ 💡 Sugestão de Horário         │
├────────────────────────────────┤
│ Você costuma tomar Losartana   │
│ por volta das 08:45.            │
│ Quer ajustar o lembrete         │
│ de 08:00 para 08:45?            │
│                                 │
│ [Ajustar] [Manter] [Nunca]      │
└────────────────────────────────┘
```
**Comportamento:**
- Exibir max 1 sugestão por dia
- Reaparecer a cada 30 dias se "Manter" foi clicado
- Se "Nunca" → nunca mais exibir para este protocolo
**Acessibilidade:** `role="alert"` + `aria-live="polite"`

### EV-07 — PrescriptionTimeline
**Localizacao:** Tab Estoque, secao "Prescrições" (acima StockBars)
**Renderização:**
```
┌────────────────────────────────┐
│ PRESCRIÇÕES                    │
├────────────────────────────────┤
│ Losart. ████████░░░ 22d  🟡   │
│         start   hoje    fim     │
│         ↑            ↑          │
│                                 │
│ Metfor. ──── contínuo ────── │
│                                 │
│ Omepra. ██████████ 12d    🟢   │
└────────────────────────────────┘
```
**Cores por status:**
- Verde: >30d restantes
- Amarelo: 7-30d restantes
- Vermelho: vencida (end_date < hoje)
**Labels:**
- "Xd restantes" se finita
- "contínuo" se end_date = null
- "Vencida há Xd" se passada
**Interacao:** Tap → navega para protocolo via `setCurrentView('protocols')`
**Acessibilidade:** `aria-label="Prescrição de Losartana. 22 dias restantes"`

---

## 9.6. Requisitos de Acessibilidade (WCAG 2.1 AA)

Aplicável a TODOS os componentes visuais (I02, I03, EV-07):

- [ ] `aria-label` descritivo em SVGs, grids, timelines
- [ ] Contraste >=4.5:1 em texto sobre cores
- [ ] `role="alert"` em notificações (ReminderSuggestion)
- [ ] Navegacao por teclado: Tab → Focus visível
- [ ] Screen reader: nomes e valores comunicados
- [ ] Mobile touch targets >= 44x44px

**Teste:** `npm run test:a11y` (se existir) ou verificar manualmente com Lighthouse

---

## 9.7. Considerações de Performance

| Componente | Cenário Crítico | Solução |
|------------|-----------------|---------|
| refillPredictionService | 100+ medicamentos | Filtro eficiente de logs, usar Set para dias únicos |
| protocolRiskService | 1000+ logs | Filtro por range de datas (14d), não carregar tudo |
| AdherenceHeatmap | Render com 100k logs | `useMemo` nas computações, não recalcular na cada render |
| PrescriptionTimeline | 20+ protocolos | Sort uma vez, renderizar lista flat (não arvore) |

**Alvo Geral:**
- Dashboard render: <50ms
- Service calc: <100ms
- Component mount: <500ms
- Lighthouse Performance: >=90 (verificar em cada sprint)

---

## 9.8. Rollout Plan (Fase 6)

**Usuarios afetados:** Todos (features visuais, sem breaking changes)

**Estrategia:**
1. Deploy para produção com feature (sem feature flag)
2. Insights aparecem naturalmente quando dados forem suficientes (>= 14d)
3. Usuarios sem 14d de dados: nada muda (UI adaptativa, `if (!hasEnoughData) return null`)
4. Usuarios com 14d+: novos insights aparecem ao atualizar

**Monitoramento:**
- Após 1 semana: % de usuários com insights visíveis (analytics)
- Após 2 semanas: feedback em issue de sugestões/problemas
- Se regressão de performance: desabilitar insights com feature flag `ENABLE_PHASE_6_INSIGHTS`

---

## 10. Fechamento da Fase 6

Apos todos os 5 sprints concluidos:

1. **Atualizar ROADMAP_v4.md** — marcar Fase 6 como completa
2. **Atualizar CLAUDE.md** — versao para v3.3.0
3. **Atualizar package.json** — version "3.3.0"
4. **Registrar em `.memory/journal/`** — entrada de fechamento
5. **Registrar em `.memory/rules.md`** — novas regras descobertas (proximo R-110+)
6. **Tag git** — `v3.3.0`
7. **Iniciar verificacao Meta Business** — prerequisito Fase 7

---

## 11. Mapa de Arquivos Completo

### Novos (Fase 6)
```
src/features/stock/services/refillPredictionService.js                 (I01)
src/features/stock/services/__tests__/refillPredictionService.test.js  (I01)
src/features/adherence/services/protocolRiskService.js                 (I04)
src/features/adherence/services/__tests__/protocolRiskService.test.js  (I04)
src/features/adherence/services/adherencePatternService.js             (I02)
src/features/adherence/services/__tests__/adherencePatternService.test.js (I02)
src/features/adherence/components/AdherenceHeatmap.jsx                 (I02)
src/features/protocols/services/reminderOptimizerService.js            (I03)
src/features/protocols/services/__tests__/reminderOptimizerService.test.js (I03)
src/features/protocols/components/ReminderSuggestion.jsx               (I03)
```

### Modificados (Fase 6)
```
src/features/stock/services/costAnalysisService.js       (I05 — adicionar calculateRealCosts)
src/features/stock/components/CostChart.jsx              (I05 — badge real/estimativa)
src/features/stock/components/StockBars.jsx              (I01 — tooltip com previsao)
src/features/dashboard/components/Dashboard.jsx          (I03 — ReminderSuggestion)
src/features/protocols/components/TreatmentAccordion.jsx (I04 — badge de risco)
src/features/dashboard/services/insightService.js        (I04 — novo tipo PROTOCOL_RISK)
server/bot/tasks.js                                      (INT-02 — previsao nos alertas)
[PDF generator file]                                     (INT-01 — secao risco)
src/shared/components/ui/PrescriptionTimeline.jsx        (EV-07 — criar ou evoluir)
src/views/Stock.jsx                                      (EV-07 — integrar timeline)
```

### Verificar antes (podem ja existir)
```
src/shared/components/ui/PrescriptionTimeline.jsx        (pode existir da Onda 1)
src/features/stock/components/PrescriptionTimeline.jsx   (localizacao alternativa)
```

---

## 12. Processo Git por Sprint

Cada sprint segue o mesmo fluxo:

```
1. git checkout main && git pull
2. git checkout -b feature/fase-6/sprint-N-[nome]
3. Implementar services (funcoes puras primeiro)
4. Escrever testes (>=90% cobertura)
5. Implementar componentes
6. Integrar na UI existente
7. npm run validate:agent
8. git add -A
9. git commit -m "feat(scope): description (#ID)"
10. git push origin feature/fase-6/sprint-N-[nome]
11. Criar PR no GitHub
12. Aguardar Gemini Code Assist review
13. Ajustar conforme review
14. /gemini review (se necessario)
15. NUNCA mergear o proprio PR — aguardar merge externo
```

---

*Documento criado 06/03/2026.*
