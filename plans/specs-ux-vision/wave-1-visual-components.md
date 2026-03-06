# Specs Atomicas — Onda 1: Componentes Visuais

**Master doc:** [`plans/EXEC_SPEC_UX_EVOLUTION.md`](../EXEC_SPEC_UX_EVOLUTION.md)
**Visao base:** [`plans/UX_VISION_EXPERIENCIA_PACIENTE.md`](../UX_VISION_EXPERIENCIA_PACIENTE.md) v0.5
**Data:** 04/03/2026

---

## Convencao de cada spec

Cada spec atomica segue este formato:

```
### W{onda}-{numero}: {Titulo}

**Objetivo:** O que o componente faz em 1 frase.
**Arquivo:** Caminho canonico do arquivo.
**Substitui/Evolui:** Qual componente atual (se aplicavel).

**Props:**
| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|

**State interno:**
- `stateName` (tipo) — descricao

**Data flow:**
- De onde vem os dados (context, props, service)
- O que o componente transforma/calcula

**Renderizacao:**
- Wireframe ASCII se relevante
- Descricao do que cada parte renderiza
- Estados: loading, empty, error, normal

**Animacoes (Framer Motion):**
- Quais animacoes e com quais parametros

**CSS:**
- Tokens do design system a usar
- Classes especificas

**Testes esperados:**
- Lista de describe/it blocks

**Criterios de aceite:**
- [ ] Checklist para o agente validar
```

---

## W1-01: Ring Gauge de Health Score

**Objetivo:** Substituir o `HealthScoreCard` retangular por um ring gauge circular animado com score, streak e sparkline inline.

**Arquivo:** `src/features/dashboard/components/RingGauge.jsx`
**CSS:** `src/features/dashboard/components/RingGauge.css`
**Substitui:** `HealthScoreCard.jsx` (97 linhas) — nao deletar, apenas parar de usar no Dashboard.

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `score` | `number` | Sim | 0-100, porcentagem de adesao |
| `streak` | `number` | Sim | Dias consecutivos |
| `trend` | `'up'\|'down'\|'neutral'` | Nao | Direcao da tendencia |
| `trendPercentage` | `number` | Nao | Variacao percentual |
| `size` | `'compact'\|'medium'\|'large'` | Nao | Default: `'medium'`. Compact = 1 linha (complex mode), large = hero (simple mode) |
| `onClick` | `Function` | Nao | Click handler (abre HealthScoreDetails) |
| `sparklineData` | `Array<{date, adherence}>` | Nao | 7 pontos para sparkline inline (so no size medium) |
| `className` | `string` | Nao | CSS override |

**State interno:**
- Nenhum (componente puro, dados vem de props)

**Data flow:**
- Props vem do `Dashboard.jsx` que ja calcula score, streak e trend via `useDashboard()` + `useAdherenceTrend()`
- `sparklineData` vem de `adherenceService.getDailyAdherence(7)`

**Renderizacao por size:**

```
SIZE: large (simple mode — <=3 meds)
+------------------------------+
| +---------------------------+|
| |     +-----+               ||
| |   +/ 85  \+  Muito Bom!  ||  <- mensagem de incentivo
| |   +\ %   /+  fire 12 dias ||     baseada no score
| |     +-----+               ||
| |  ---=====------           ||  <- sparkline 7d
| +---------------------------+|

SIZE: medium (moderate mode — 4-6 meds)
+------------------------------+
|  +---+ 85%  fire 12d         |  <- ring + score + streak em 1 linha
|  +---+ ---=====---           |  <- sparkline compact
+------------------------------+

SIZE: compact (complex mode — 7+ meds)
+------------------------------+
| Andre         +---+ 85% f.12|  <- tudo inline, maximo compacto
|               +---+         |
+------------------------------+
```

**Calculo da cor do ring:**

```javascript
function getRingColor(score) {
  if (score < 50) return 'var(--color-error)'      // vermelho
  if (score < 70) return 'var(--color-warning)'     // amarelo
  if (score < 85) return 'var(--color-success)'     // verde
  return 'var(--color-info)'                         // azul
}
```

**Mensagens de incentivo (size large):**

```javascript
function getMotivationMessage(score) {
  if (score === 100) return 'Perfeito!'
  if (score >= 85) return 'Muito Bom!'
  if (score >= 70) return 'Bom trabalho!'
  if (score >= 50) return 'Continue assim!'
  return 'Vamos melhorar!'
}
```

**SVG do ring gauge:**

```jsx
// Tecnica: SVG circle com stroke-dasharray
const circumference = 2 * Math.PI * radius
const offset = circumference - (score / 100) * circumference

<svg viewBox="0 0 120 120">
  {/* Background ring */}
  <circle cx="60" cy="60" r={radius}
    stroke="var(--color-border)"
    strokeWidth="8" fill="none" />
  {/* Progress ring */}
  <motion.circle cx="60" cy="60" r={radius}
    stroke={getRingColor(score)}
    strokeWidth="8" fill="none"
    strokeDasharray={circumference}
    strokeDashoffset={offset}
    strokeLinecap="round"
    transform="rotate(-90 60 60)"
    initial={{ strokeDashoffset: circumference }}
    animate={{ strokeDashoffset: offset }}
    transition={{ type: "spring", stiffness: 60, damping: 15 }} />
  {/* Center text */}
  <text x="60" y="55" textAnchor="middle"
    className="ring-gauge__score">{score}</text>
  <text x="60" y="70" textAnchor="middle"
    className="ring-gauge__label">%</text>
</svg>
```

**Animacoes (Framer Motion):**
- Ring progress: `type: "spring", stiffness: 60, damping: 15` (on mount + score change)
- Score number: `AnimatePresence` com slide-up quando valor muda
- Streak badge: `scale: [0, 1.15, 1]` com `delay: 0.3` (after ring)

**CSS (usar tokens existentes):**

```css
.ring-gauge { /* container */ }
.ring-gauge--large { padding: var(--space-6); }
.ring-gauge--medium { padding: var(--space-3); display: flex; align-items: center; gap: var(--space-3); }
.ring-gauge--compact { padding: var(--space-2); display: flex; align-items: center; }
.ring-gauge__score { font-size: var(--font-size-2xl); font-weight: 900; fill: var(--text-primary); }
.ring-gauge__label { font-size: var(--font-size-xs); fill: var(--text-secondary); }
.ring-gauge__motivation { font-size: var(--font-size-sm); color: var(--text-secondary); }
.ring-gauge__streak { display: flex; align-items: center; gap: var(--space-1); }
```

**Acessibilidade:**
- `role="img"` no SVG
- `aria-label="Adesao: {score}%. Streak: {streak} dias"`
- `tabindex="0"` se onClick (clickable)
- Respeitar `prefers-reduced-motion` (skip spring, instant render)

**Testes esperados:** `src/features/dashboard/components/__tests__/RingGauge.test.jsx`

```
describe('RingGauge')
  it('renderiza score e streak corretamente')
  it('calcula cor do ring por faixa de score')
  it('mostra mensagem de incentivo no size large')
  it('renderiza sparkline inline no size medium')
  it('omite sparkline no size compact')
  it('chama onClick ao clicar')
  it('tem aria-label descritivo')
  it('aplica classe de size correta')
  it('anima ring com spring transition')
```

**Criterios de aceite:**
- [ ] Renderiza corretamente nos 3 sizes (large, medium, compact)
- [ ] Cor do ring muda por faixa de score (vermelho/amarelo/verde/azul)
- [ ] Animacao spring no mount e ao mudar score
- [ ] Score label com AnimatePresence (flip number)
- [ ] Sparkline inline renderiza no size medium
- [ ] Acessibilidade: aria-label, role="img", keyboard nav
- [ ] Respeita prefers-reduced-motion
- [ ] CSS usa tokens do design system (--color-*, --space-*, --font-size-*)
- [ ] Sem dependencia de contexto (dados via props)
- [ ] Testes passam

---

## W1-02: Barras de Estoque com Projecao

**Objetivo:** Widget grafico de barras horizontais que mostra estoque de cada medicamento com projecao de consumo e cores de criticidade.

**Arquivo:** `src/features/dashboard/components/StockBars.jsx`
**CSS:** `src/features/dashboard/components/StockBars.css`
**Substitui:** Nada (novo componente). Complementa `StockAlertsWidget.jsx`.

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `items` | `Array<StockBarItem>` | Sim | Lista de medicamentos com dados de estoque |
| `maxItems` | `number` | Nao | Default: `Infinity`. Limita quantidade exibida (para complex mode) |
| `showOnlyCritical` | `boolean` | Nao | Default: `false`. Filtra so CRITICAL+LOW |
| `onItemClick` | `Function(medicineId)` | Nao | Click handler -> navega para Estoque |
| `className` | `string` | Nao | CSS override |

**Tipo StockBarItem:**

```javascript
{
  medicineId: string,
  name: string,               // nome do medicamento (truncar em 12 chars)
  currentStock: number,        // comprimidos em estoque
  dailyConsumption: number,    // comprimidos/dia (calculado de protocolos ativos)
  daysRemaining: number,       // currentStock / dailyConsumption
  level: 'critical'|'low'|'normal'|'high'  // usar STOCK_LEVELS do codebase
}
```

**State interno:**
- Nenhum (componente puro)

**Data flow:**
- Props preparados pelo Dashboard a partir de `stockSummary` (ja disponivel no `useDashboard()`)
- `dailyConsumption` calculado a partir dos protocolos ativos + dosage_per_intake + frequency

**Renderizacao:**

```
+----------------------------+
| ESTOQUE RAPIDO             |
|                            |
| Losart. ====----  4d  Y   |  <- barra com 2 tons
| Metfor. ======== 30d  G   |    escuro = % usado (stock/30d)
| Omepra. --------  0d  R   |    pulse em barras vermelhas
| Vit. D  ========= 90d B   |
|                            |
+----------------------------+
```

**Calculo da barra:**

```javascript
// Normalizar em 30 dias (30d = 100% da barra)
const MAX_DAYS = 30
const percent = Math.min((daysRemaining / MAX_DAYS) * 100, 100)
const barColor = getStockColor(level) // usa cores existentes do design system
```

**Cores (do codebase existente):**

```javascript
const STOCK_COLORS = {
  critical: 'var(--color-error)',     // #ef4444 — <7 dias
  low: 'var(--color-warning)',        // #f59e0b — <14 dias
  normal: 'var(--color-success)',     // #22c55e — <30 dias
  high: 'var(--color-info)',          // #3b82f6 — >=30 dias
}
```

**Animacoes (Framer Motion):**
- Barras: stagger entrance `staggerChildren: 0.05`
- Cada barra: `initial={{ width: 0 }}` -> `animate={{ width: percent + '%' }}`
- Pulse em barras critical: CSS `@keyframes pulse { 50% { opacity: 0.7 } }` 2s infinite
- Entrada do container: `initial={{ opacity: 0, y: 10 }}` -> `animate={{ opacity: 1, y: 0 }}`

**CSS:**

```css
.stock-bars { padding: var(--space-3); }
.stock-bars__item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; cursor: pointer; }
.stock-bars__name { flex: 0 0 70px; font-size: var(--font-size-xs); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stock-bars__track { flex: 1; height: 8px; background: var(--color-border); border-radius: var(--radius-full); overflow: hidden; }
.stock-bars__fill { height: 100%; border-radius: var(--radius-full); transition: width var(--transition-slow); }
.stock-bars__fill--critical { animation: pulse 2s infinite; }
.stock-bars__days { flex: 0 0 35px; font-size: var(--font-size-xs); color: var(--text-secondary); text-align: right; font-variant-numeric: tabular-nums; }
.stock-bars__indicator { flex: 0 0 20px; font-size: var(--font-size-sm); text-align: center; }
```

**Testes esperados:** `src/features/dashboard/components/__tests__/StockBars.test.jsx`

```
describe('StockBars')
  it('renderiza barras para todos os items')
  it('aplica cor correta por nivel de estoque')
  it('calcula largura da barra normalizada em 30d')
  it('trunca nomes longos com ellipsis')
  it('filtra so criticos quando showOnlyCritical=true')
  it('limita quantidade com maxItems')
  it('chama onItemClick com medicineId ao clicar')
  it('mostra pulse em barras critical')
  it('mostra estado vazio quando items=[]')
  it('mostra "90d" cap para estoque muito alto')
```

**Criterios de aceite:**
- [ ] Renderiza barras horizontais com cor por nivel (critical/low/normal/high)
- [ ] Normalizacao em 30 dias (30d = barra cheia)
- [ ] Nomes truncados com ellipsis
- [ ] Pulse animation em barras critical
- [ ] Stagger entrance (Framer Motion)
- [ ] `showOnlyCritical` e `maxItems` funcionam
- [ ] Click navega (chama onItemClick)
- [ ] Empty state quando nao ha dados
- [ ] CSS usa tokens do design system
- [ ] Testes passam

---

## W1-03: Sparkline Interativa (evolucao)

**Objetivo:** Evoluir a SparklineAdesao existente (417 linhas) para suportar tooltip on tap com dados do dia e variantes de tamanho.

**Arquivo:** `src/features/dashboard/components/SparklineAdesao.jsx` (EDITAR, nao criar novo)
**Substitui:** Evolucao do componente existente.

**Mudancas em relacao ao componente atual:**

| O que | Antes | Depois |
|-------|-------|--------|
| Tooltip | Nao tem | On tap: data + % + taken/expected |
| Tamanho inline | Nao tem | Novo size `'inline'` para uso dentro do RingGauge |
| Variante 30d | Nao tem | Novo size `'expanded'` para Minha Saude (30 pontos) |
| Click no ponto | Abre DailyDoseModal (ja existe) | Mantem + mostra tooltip antes |

**Props adicionais (novas):**

| Prop | Tipo | Descricao |
|------|------|-----------|
| `size` | `'inline'\|'small'\|'medium'\|'large'\|'expanded'` | Adicionar 'inline' e 'expanded' |

**Tooltip format:**

```
+-----------------+
| 24/02           |
| 85% . 3/4 doses |
+-----------------+
```

**Implementacao do tooltip:**
- State: `const [activePoint, setActivePoint] = useState(null)`
- On tap no ponto: `setActivePoint(index)` -> mostra tooltip
- Tap fora: `setActivePoint(null)`
- Tooltip posicionado acima do ponto (clamped nos limites do SVG)

**Size 'inline' (dentro do RingGauge medium):**
- Sem eixo X, sem labels, sem dots interativos
- Apenas a linha com gradient fill
- Altura fixa: 20px
- Sem tooltip

**Criterios de aceite:**
- [ ] Tooltip renderiza com data + % + doses ao tap num ponto
- [ ] Size 'inline' renderiza minimalista (sem labels, sem dots)
- [ ] Size 'expanded' suporta 30 pontos de dados
- [ ] Funcionalidade existente (click->DailyDoseModal) preservada
- [ ] Acessibilidade existente preservada
- [ ] Testes existentes continuam passando + novos testes para tooltip

---

## W1-04: Micro-animacoes de Dose

**Objetivo:** Adicionar feedback visual ao registrar doses: check animado, counter flip, streak badge pulse.

**Arquivo:** `src/shared/components/log/SwipeRegisterItem.jsx` (EDITAR)
**CSS:** `src/shared/components/log/SwipeRegisterItem.css` (EDITAR)
**Deps:** Nenhuma nova.

**Animacoes a adicionar:**

| Momento | Animacao | Tecnica |
|---------|----------|---------|
| Swipe confirmado | Check mark bounce | Framer Motion `scale: [0, 1.3, 1]` duration 0.4s |
| Counter atualiza | Number flip up | Framer Motion `AnimatePresence` mode="wait" + `y: [20, 0]` + `opacity: [0, 1]` |
| 100% do dia | Confetti | Ja existe (`ConfettiAnimation`) — manter |
| Milestone (7d, 14d, 30d) | Badge scale pulse | `scale: [1, 1.15, 1]` repeat 3x |

**O que NAO mudar:**
- Logica de swipe (useMotionValue, drag constraints) — intacta
- PulseEffect apos sucesso — intacta
- Props existentes — intactas

**Implementacao check bounce:**

```jsx
// Adicionar dentro do bloco de sucesso existente
{isSuccess && (
  <motion.div
    className="swipe-item__check"
    initial={{ scale: 0 }}
    animate={{ scale: [0, 1.3, 1] }}
    transition={{ duration: 0.4, ease: "easeOut" }}
  >
    check
  </motion.div>
)}
```

**Criterios de aceite:**
- [ ] Check bounce renderiza ao confirmar swipe
- [ ] Animacao respeita prefers-reduced-motion
- [ ] Nenhuma prop existente quebrada
- [ ] Testes existentes passam
- [ ] Logica de swipe inalterada

---

## W1-05: Custo Mini-Chart

**Objetivo:** Barras horizontais mostrando distribuicao de custo mensal por medicamento.

**Arquivo:** `src/features/stock/components/CostChart.jsx`
**CSS:** `src/features/stock/components/CostChart.css`
**Substitui:** Nada (novo componente, usado na tab Estoque).

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `items` | `Array<{name, monthlyCost}>` | Sim | Custo mensal por med |
| `totalMonthly` | `number` | Sim | Total mensal (soma) |
| `projection3m` | `number` | Nao | Projecao 3 meses |
| `onExpand` | `Function` | Nao | Expandir para detalhes |

**Renderizacao:**

```
+----------------------------+
| $ CUSTO MENSAL    R$187    |
|                            |
| Losart.  ========   R$45  |
| Metfor.  ======     R$32  |
| Omepra.  ========   R$48  |
| Vit. D   ====       R$22  |
| Outros   ======     R$40  |
|                            |
| Projecao 3m:       R$561  |
| [Ver analise completa ->]  |
+----------------------------+
```

**Calculo custo mensal:**

```javascript
// unit_price x dosage_per_intake x doses_per_day x 30
const monthlyCost = unitPrice * dosagePerIntake * dosesPerDay * 30
```

**Estado vazio:** Se nenhum medicamento tem `unit_price` preenchido:
```
"Adicione precos no estoque para ver custos"
[Ir para Estoque ->]
```

**Criterios de aceite:**
- [ ] Barras horizontais proporcionais ao custo
- [ ] Total e projecao exibidos
- [ ] Formatacao BRL (R$XX,XX) com Intl.NumberFormat
- [ ] Empty state quando sem precos
- [ ] Stagger entrance animation
- [ ] Testes passam

---

## W1-06: Pulse em Itens Criticos

**Objetivo:** Adicionar pulse CSS sutil em elementos com status critico.

**Arquivo:** `src/shared/styles/animations.css` (novo arquivo de animacoes globais)
**Substitui:** Nada (nova utility CSS).

**Implementacao:**

```css
@keyframes pulse-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.pulse-critical {
  animation: pulse-critical 2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .pulse-critical { animation: none; }
}
```

**Onde aplicar (pelos componentes das ondas 1-3):**
- `StockBars` em barras com level 'critical'
- `SmartAlerts` em alertas severity 'critical'
- `PrescriptionTimeline` em prescricoes vencidas

**Criterios de aceite:**
- [ ] Animacao sutil (opacity, nao scale)
- [ ] Respeita prefers-reduced-motion
- [ ] Reutilizavel via classe CSS
- [ ] Nao interfere com outras animacoes

---

## W1-07: Prescricoes Timeline Visual

**Objetivo:** Barra horizontal representando vigencia de prescricao (inicio->hoje->fim).

**Arquivo:** `src/features/stock/components/PrescriptionTimeline.jsx`
**CSS:** `src/features/stock/components/PrescriptionTimeline.css`
**Dependencia:** Feature F5.9 (Prescricoes) precisa existir primeiro. Se nao existir, esta task fica bloqueada.

**Status:** BLOQUEADA (depende de F5.9)

---

## W1-08: Calendario Heat Map (evolucao)

**Objetivo:** Evoluir o Calendar existente para mostrar cores de adesao por dia (heat map).

**Arquivo:** `src/shared/components/ui/Calendar.jsx` (EDITAR)
**Substitui:** Evolucao do componente existente.

**Mudancas:**

| O que | Antes | Depois |
|-------|-------|--------|
| Cor dos dias | Cinza/azul uniforme | Cores por adesao (verde/amarelo/vermelho) |
| `markedDates` | `{date: boolean}` | `{date: {adherence: number, taken: number, expected: number}}` |

**Nova prop:**

| Prop | Tipo | Descricao |
|------|------|-----------|
| `adherenceData` | `Object<string, {adherence, taken, expected}>` | Dados de adesao por dia (YYYY-MM-DD -> dados) |

**Cores:**

```javascript
function getDayColor(data) {
  if (!data) return 'transparent'           // sem dados / futuro
  if (data.expected === 0) return 'transparent'  // sem doses esperadas
  if (data.adherence === 100) return 'var(--color-success)'  // verde
  if (data.adherence > 0) return 'var(--color-warning)'      // amarelo
  return 'var(--color-error)'                                 // vermelho
}
```

**Criterios de aceite:**
- [ ] Dias com 100% adesao = verde
- [ ] Dias com adesao parcial = amarelo
- [ ] Dias com 0% = vermelho
- [ ] Dias sem doses esperadas ou futuros = neutro
- [ ] Click no dia mantem funcionalidade existente
- [ ] Prop `markedDates` continua funcionando (backward compatible)
- [ ] Nova prop `adherenceData` sobrescreve cores quando presente
- [ ] Testes existentes passam + novos testes para heat map

---

*Ultima atualizacao: 04/03/2026*
*Proximas specs: Wave 2 (hooks e logica) — arquivo separado*
