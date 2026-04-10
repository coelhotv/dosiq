# Wave 15 — Smart Insights Integration (Exec Spec)

**Versão:** 1.0
**Data:** 2026-04-03
**Status:** ⏳ PENDENTE
**Dependências:** W0-W14.5 COMPLETAS ✅
**Princípio:** Zero new Supabase calls. Computação pura sobre cache SWR existente.
**Branch pattern:** `feature/wave-15/smart-insights`

> **Motivação:** O redesign Santuário (W0-W14.5) migrou 100% do visual mas abandonou toda a inteligência analítica entregue nas Fases 5-6 do Roadmap v4. O Dashboard legacy consome SmartAlerts, InsightCard, ReminderSuggestion, CostChart e PrescriptionTimeline — o redesign não consome nenhum deles. Esta wave fecha essa lacuna e torna o redesign estritamente superior ao legacy.

---

## Índice

1. [Inventário de Gaps](#1-inventário-de-gaps)
2. [Modelo Visual: Smart Card Pattern](#2-modelo-visual-smart-card-pattern)
3. [Sprint 15.1 — SmartAlertsRedesign](#sprint-151--smartalertsredesign)
4. [Sprint 15.2 — InsightCardRedesign](#sprint-152--insightcardredesign)
5. [Sprint 15.3 — ReminderSuggestionRedesign](#sprint-153--remindersuggestionredesign)
6. [Sprint 15.4 — ProtocolRiskBadge](#sprint-154--protocolriskbadge)
7. [Sprint 15.5 — CostSummaryRedesign](#sprint-155--costsummaryredesign)
8. [Sprint 15.6 — PrescriptionTimelineRedesign](#sprint-156--prescriptiontimelineredesign)
9. [Sprint 15.7 — Refill Prediction Enrichment](#sprint-157--refill-prediction-enrichment)
10. [Sprint 15.8 — DashboardRedesign Integration](#sprint-158--dashboardredesign-integration)
11. [Sprint 15.9 — StockRedesign Integration](#sprint-159--stockredesign-integration)
12. [Sprint 15.10 — TreatmentsRedesign Integration](#sprint-1510--treatmentsredesign-integration)
13. [Ordem de Execução](#ordem-de-execução)
14. [Critério de Conclusão](#critério-de-conclusão)

---

## 1. Inventário de Gaps

| Feature | Service (não modificar) | Componente Legacy | Redesign Status |
|---------|------------------------|-------------------|-----------------|
| Smart Alerts (stock/dose/prescription) | `insightService` + inline `Dashboard.jsx` | `SmartAlerts.jsx` → `AlertList` | **AUSENTE** do `DashboardRedesign` |
| InsightCard (rotating contextual) | `insightService.getNextInsight()` | `InsightCard.jsx` | **AUSENTE** |
| Reminder Optimizer | `reminderOptimizerService.analyzeReminderTiming()` | `ReminderSuggestion.jsx` | **AUSENTE** |
| Protocol Risk Score | `protocolRiskService.calculateProtocolRisk()` | Nenhum componente visual | **AUSENTE** |
| Cost Analysis | `costAnalysisService.calculateMonthlyCosts()` | `CostChart.jsx` | **AUSENTE** do `StockRedesign` |
| Prescription Timeline (EV-07) | Inline em `Stock.jsx` | `PrescriptionTimeline.jsx` | **AUSENTE** do `StockRedesign` |
| Refill Prediction | `refillPredictionService.predictRefill()` | Consumido por `StockPill` | **PARCIAL** (só `daysRemaining`) |
| Adherence Heatmap | `analyzeAdherencePatterns()` | `AdherenceHeatmap.jsx` | ✅ OK (em `HealthHistoryRedesign`) |

---

## 2. Modelo Visual: Smart Card Pattern

Todas as interações inteligentes reutilizam o modelo visual do `PriorityDoseCard.jsx` (W6) como template.

### Anatomia do Smart Card

```
┌─ Card Container ──────────────────────────────────┐
│                                                    │
│  ┌─ Badge ─┐                         ┌─ Icon ─┐   │
│  │ LABEL   │                         │  24px  │   │
│  └─────────┘                         └────────┘   │
│                                                    │
│  Headline (title-lg, Lexend 600)                   │
│  Descrição (body-lg, Lexend 400)                   │
│                                                    │
│  ┌─ Conteúdo Contextual ──────────────────────┐   │
│  │  (barra de progresso, lista, métrica, etc.) │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ╭──────────────╮  ╭────────────────╮              │
│  │ CTA Primário  │  │   Dispensar    │              │
│  ╰──────────────╯  ╰────────────────╯              │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Variantes Semânticas

```css
/* Variante: risk (estoque zerado, dose crítica, prescrição vencida) */
.smart-card--risk {
  background: color-mix(in srgb, var(--color-error) 8%, transparent);
  border-left: 4px solid var(--color-error);
  border-radius: var(--radius-lg);
}

/* Variante: warning (estoque baixo, dose atrasada, prescrição vencendo) */
.smart-card--warning {
  background: color-mix(in srgb, var(--color-tertiary-fixed) 40%, transparent);
  border-left: 4px solid var(--color-tertiary);
  border-radius: var(--radius-lg);
}

/* Variante: suggestion (reminder optimizer) */
.smart-card--suggestion {
  background: var(--gradient-primary);
  border-radius: var(--radius-card);
  color: #ffffff;
  box-shadow: var(--gradient-primary-shadow);
}

/* Variante: insight (insight rotativo, dica do dia) */
.smart-card--insight {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-ambient);
}

/* Variante: cost (análise de custo) */
.smart-card--cost {
  background: color-mix(in srgb, var(--color-tertiary-fixed) 30%, transparent);
  border-radius: var(--radius-card);
}
```

### Tokens CSS usados (todos já existem em `tokens.redesign.css`)

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-error` | `#ba1a1a` | Alertas críticos |
| `--color-error-container` | `#ffdad6` | Background crítico tonal |
| `--color-tertiary` | `#7b5700` | Border warning |
| `--color-tertiary-fixed` | `#ffdea8` | Background warning tonal |
| `--color-secondary` | `#005db6` | Texto/border info |
| `--color-secondary-fixed` | `#d6e3ff` | Background info tonal |
| `--gradient-primary` | `linear-gradient(135deg, #006a5e, #008577)` | Cards de sugestão |
| `--shadow-ambient` | `0 24px 24px rgba(25,28,29,0.04)` | Cards insight |
| `--radius-lg` | `1rem` | Alertas |
| `--radius-card` | `2rem` | Cards premium |

---

## Sprint 15.1 — SmartAlertsRedesign

### Objetivo
Criar componente de alertas inteligentes para o Dashboard redesenhado, replicando a lógica do `Dashboard.jsx` legacy com visual Santuário.

### Arquivo a criar
`src/features/dashboard/components/SmartAlertsRedesign.jsx` + `SmartAlertsRedesign.css`

### Interface (Props)

```jsx
/**
 * SmartAlertsRedesign — Alertas inteligentes com visual Sanctuary.
 *
 * @param {Array} alerts — Lista de alertas normalizados
 *   Shape: { id, severity, title, message, actions?, protocol_id? }
 *   severity: 'critical' | 'warning' | 'info'
 * @param {Function} onAction — (alert, action) => void
 * @param {boolean} isComplex — true = Carlos (mais alertas), false = Dona Maria (max 2)
 * @param {Function} onSnooze — (alertId) => void — silenciar alerta por 24h
 */
export default function SmartAlertsRedesign({ alerts, onAction, isComplex, onSnooze })
```

### Lógica de renderização

```
SE alerts.length === 0 → return null

Ordenar: critical primeiro, depois warning, depois info.

Max visíveis:
  isComplex === true → 5 alertas
  isComplex === false → 2 alertas (só critical + warning, sem info)

SE alerts.length > maxVisible → mostrar link "Ver todos ({total})" que expande.
```

### Markup (por alerta)

```jsx
<div
  className={`smart-alert smart-alert--${severity}`}
  role={severity === 'critical' ? 'alert' : 'status'}
  aria-live={severity === 'critical' ? 'assertive' : 'polite'}
>
  <div className="smart-alert__header">
    <Icon size={16} aria-hidden="true" />  {/* AlertTriangle | AlertCircle | Info */}
    <span className="smart-alert__title">{title}</span>
    {onSnooze && (
      <button
        className="smart-alert__snooze"
        onClick={() => onSnooze(id)}
        aria-label="Silenciar alerta"
      >
        <X size={14} />
      </button>
    )}
  </div>
  <p className="smart-alert__message">{message}</p>
  {actions?.length > 0 && (
    <div className="smart-alert__actions">
      {actions.map(action => (
        <button
          key={action.label}
          className={`smart-alert__action smart-alert__action--${action.type}`}
          onClick={() => onAction(alert, action)}
        >
          {action.label} →
        </button>
      ))}
    </div>
  )}
</div>
```

### CSS

```css
.smart-alerts-redesign {
  display: flex;
  flex-direction: column;
  gap: 0.75rem; /* Spacing 3 */
}

.smart-alert {
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg, 1rem);
  /* Sem borda 1px — só border-left accent */
}

.smart-alert--critical {
  background: color-mix(in srgb, var(--color-error, #ba1a1a) 8%, transparent);
  border-left: 4px solid var(--color-error, #ba1a1a);
}

.smart-alert--warning {
  background: color-mix(in srgb, var(--color-tertiary-fixed, #ffdea8) 40%, transparent);
  border-left: 4px solid var(--color-tertiary, #7b5700);
}

.smart-alert--info {
  background: color-mix(in srgb, var(--color-secondary-fixed, #d6e3ff) 20%, transparent);
  border-left: 4px solid var(--color-secondary, #005db6);
}

.smart-alert__header {
  display: flex;
  align-items: center;
  gap: 0.5rem; /* Spacing 2 */
}

.smart-alert__title {
  font-family: var(--font-body, Lexend, sans-serif);
  font-weight: var(--font-weight-semibold, 600);
  font-size: var(--text-body-lg, 1rem);
  flex: 1;
}

.smart-alert__message {
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-label-md, 0.75rem);
  color: var(--color-on-surface-variant, #3e4946);
  margin: 0.375rem 0 0 0;
  /* Padding-left para alinhar com o título (após o ícone) */
  padding-left: calc(16px + 0.5rem); /* icon size + gap */
}

.smart-alert__snooze {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: var(--color-outline, #6d7a76);
  border-radius: var(--radius-full, 9999px);
  min-height: 2.5rem;
  min-width: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.smart-alert__actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  padding-left: calc(16px + 0.5rem);
}

.smart-alert__action {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body, Lexend, sans-serif);
  font-weight: var(--font-weight-semibold, 600);
  font-size: var(--text-label-md, 0.75rem);
  padding: 0.375rem 0;
  min-height: 2.75rem; /* >= 44px tap area */
}

.smart-alert__action--primary {
  color: var(--color-primary, #006a5e);
}

.smart-alert__action--secondary {
  color: var(--color-outline, #6d7a76);
}
```

### Motion

- Container `.smart-alerts-redesign`: Cascade Reveal (stagger 0.1s por alerta).
- Reutilizar `useMotion()` hook + `motionConstants.cascadeReveal`.
- `prefers-reduced-motion`: sem stagger, opacidade imediata.

### Ícones Lucide

| Severity | Ícone | Import |
|----------|-------|--------|
| critical | `AlertTriangle` | `import { AlertTriangle } from 'lucide-react'` |
| warning | `AlertCircle` | `import { AlertCircle } from 'lucide-react'` |
| info | `Info` | `import { Info } from 'lucide-react'` |

### Critério de conclusão 15.1

- [ ] Componente renderiza alertas com 3 variantes visuais (critical/warning/info)
- [ ] Persona: Simple max 2, Complex max 5
- [ ] "Ver todos" expand link quando > maxVisible
- [ ] CTA inline funcional (onAction callback)
- [ ] Snooze button funcional (onSnooze callback)
- [ ] Cascade Reveal animation com prefers-reduced-motion
- [ ] Touch targets ≥ 44px nos botões de ação
- [ ] Zero bordas 1px — apenas border-left 4px accent
- [ ] `aria-live` e `role` corretos por severidade

---

## Sprint 15.2 — InsightCardRedesign

### Objetivo
Criar card de insight rotativo para o Dashboard, consumindo `insightService.getNextInsight()`.

### Arquivo a criar
`src/features/dashboard/components/InsightCardRedesign.jsx` + `InsightCardRedesign.css`

### Interface (Props)

```jsx
/**
 * InsightCardRedesign — Card de insight contextual rotativo.
 *
 * @param {Object} insight — Insight do insightService
 *   Shape: { id, type, icon, title, message, priority, action? }
 * @param {Function} onAction — (insight) => void — ação do insight (ex: navegar)
 * @param {Function} onDismiss — (insightId) => void
 */
export default function InsightCardRedesign({ insight, onAction, onDismiss })
```

### Markup

```jsx
<div className="insight-card-redesign" role="complementary" aria-label="Dica do dia">
  <div className="insight-card-redesign__header">
    <span className="insight-card-redesign__badge">
      {getBadgeLabel(insight.type)}
    </span>
    <Icon size={20} aria-hidden="true" />
  </div>

  <p className="insight-card-redesign__title">{insight.title}</p>
  <p className="insight-card-redesign__message">{insight.message}</p>

  {insight.action && (
    <button
      className="insight-card-redesign__cta"
      onClick={() => onAction(insight)}
    >
      {insight.action.label} →
    </button>
  )}
</div>
```

### Mapeamento de ícones por tipo

| INSIGHT_TYPE | Badge Label | Ícone Lucide |
|-------------|-------------|--------------|
| `ADHERENCE_POSITIVE` | "Parabéns!" | `TrendingUp` |
| `ADHERENCE_MOTIVATIONAL` | "Motivação" | `Target` |
| `STREAK_CELEBRATION` | "Sequência!" | `Award` |
| `STOCK_WARNING` | "Atenção" | `Package` |
| `PROTOCOL_REMINDER` | "Lembrete" | `Clock` |
| `MISSED_DOSE_ALERT` | "Dose Perdida" | `AlertCircle` |
| `IMPROVEMENT_OPPORTUNITY` | "Dica" | `Lightbulb` |

### CSS

```css
.insight-card-redesign {
  background: var(--color-surface-container-lowest, #ffffff);
  border-radius: var(--radius-card, 2rem);
  padding: 1.5rem;
  box-shadow: var(--shadow-ambient, 0 24px 24px rgba(25,28,29,0.04));
}

.insight-card-redesign__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.insight-card-redesign__badge {
  background: color-mix(in srgb, var(--color-primary-fixed, #90f4e3) 30%, transparent);
  color: var(--color-primary, #006a5e);
  border-radius: var(--radius-full, 9999px);
  padding: 0.25rem 0.75rem;
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-label-sm, 0.625rem);
  font-weight: var(--font-weight-bold, 700);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.insight-card-redesign__title {
  font-family: var(--font-body, Lexend, sans-serif);
  font-weight: var(--font-weight-semibold, 600);
  font-size: var(--text-title-lg, 1.125rem);
  color: var(--color-on-surface, #191c1d);
  margin: 0 0 0.25rem;
}

.insight-card-redesign__message {
  font-family: var(--font-body, Lexend, sans-serif);
  font-weight: 400;
  font-size: var(--text-body-lg, 1rem);
  color: var(--color-on-surface-variant, #3e4946);
  margin: 0;
  line-height: 1.6;
}

.insight-card-redesign__cta {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body, Lexend, sans-serif);
  font-weight: var(--font-weight-semibold, 600);
  font-size: var(--text-label-md, 0.75rem);
  color: var(--color-primary, #006a5e);
  padding: 0.5rem 0;
  margin-top: 0.75rem;
  min-height: 2.75rem;
}
```

### Persona

- **Simple:** Apenas insights de prioridade `critical` ou `high`. Tom encorajador.
- **Complex:** Todos os insights incluindo `IMPROVEMENT_OPPORTUNITY`. Tom analítico.

### Critério de conclusão 15.2

- [ ] Renderiza insight com badge, título, mensagem e CTA opcional
- [ ] Ícone correto por `INSIGHT_TYPE`
- [ ] Persona filter aplicado (Simple: critical+high only)
- [ ] Fade-in suave na entrada
- [ ] `role="complementary"` + `aria-label`
- [ ] Sem bordas 1px — shadow ambient

---

## Sprint 15.3 — ReminderSuggestionRedesign

### Objetivo
Redesenhar o `ReminderSuggestion.jsx` com visual Smart Card (variante `suggestion` — gradient verde primário).

### Arquivo a criar
`src/features/protocols/components/ReminderSuggestionRedesign.jsx` + `ReminderSuggestionRedesign.css`

### Interface (Props)

```jsx
/**
 * ReminderSuggestionRedesign — Sugestão de ajuste de horário com visual Smart Card.
 *
 * MESMA interface que ReminderSuggestion.jsx original:
 * @param {Object} suggestion — { currentTime, suggestedTime, avgDeltaMinutes, sampleCount, direction }
 * @param {string} protocolId
 * @param {string} protocolName
 * @param {Function} onAccept — (newTime: string) => void
 * @param {Function} onDismiss — () => void
 */
export default function ReminderSuggestionRedesign({
  suggestion, protocolId, protocolName, onAccept, onDismiss
})
```

### Markup

```jsx
<div className="reminder-suggestion-redesign" role="alert">
  {/* Badge */}
  <span className="reminder-suggestion-redesign__badge">
    <BellRing size={14} aria-hidden="true" />
    Sugestão Inteligente
  </span>

  {/* Conteúdo */}
  <p className="reminder-suggestion-redesign__text">
    Você costuma tomar <strong>{protocolName}</strong> por volta das{' '}
    <strong>{suggestion.suggestedTime}</strong>.
  </p>
  <p className="reminder-suggestion-redesign__subtext">
    Ajustar o lembrete de {suggestion.currentTime} para {suggestion.suggestedTime}?
  </p>
  <p className="reminder-suggestion-redesign__sample">
    Baseado em {suggestion.sampleCount} doses registradas
  </p>

  {/* CTAs */}
  <div className="reminder-suggestion-redesign__actions">
    <button
      className="reminder-suggestion-redesign__btn reminder-suggestion-redesign__btn--accept"
      onClick={() => onAccept(suggestion.suggestedTime)}
    >
      Ajustar Horário
    </button>
    <button
      className="reminder-suggestion-redesign__btn reminder-suggestion-redesign__btn--keep"
      onClick={() => { dismissSuggestion(protocolId, false); onDismiss(); }}
    >
      Manter Atual
    </button>
  </div>
  <button
    className="reminder-suggestion-redesign__never"
    onClick={() => { dismissSuggestion(protocolId, true); onDismiss(); }}
  >
    Não perguntar mais
  </button>
</div>
```

### CSS

```css
.reminder-suggestion-redesign {
  background: var(--gradient-primary, linear-gradient(135deg, #006a5e, #008577));
  border-radius: var(--radius-card, 2rem);
  padding: 1.5rem;
  color: #ffffff;
  box-shadow: var(--gradient-primary-shadow, 0 8px 24px rgba(0, 106, 94, 0.20));
}

.reminder-suggestion-redesign__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-full, 9999px);
  padding: 0.25rem 0.75rem;
  font-size: var(--text-label-sm, 0.625rem);
  font-weight: var(--font-weight-bold, 700);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}

.reminder-suggestion-redesign__text {
  font-family: var(--font-body, Lexend, sans-serif);
  font-weight: var(--font-weight-semibold, 600);
  font-size: var(--text-title-lg, 1.125rem);
  margin: 0 0 0.25rem;
  line-height: 1.4;
}

.reminder-suggestion-redesign__subtext {
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-body-lg, 1rem);
  margin: 0;
  opacity: 0.9;
}

.reminder-suggestion-redesign__sample {
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-label-md, 0.75rem);
  margin: 0.5rem 0 0;
  opacity: 0.7;
}

.reminder-suggestion-redesign__actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.reminder-suggestion-redesign__btn {
  border: none;
  cursor: pointer;
  font-family: var(--font-body, Lexend, sans-serif);
  font-weight: var(--font-weight-bold, 700);
  font-size: var(--text-body-lg, 1rem);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-button, 1.25rem);
  min-height: 3.5rem; /* 56px touch target */
}

.reminder-suggestion-redesign__btn--accept {
  background: #ffffff;
  color: var(--color-primary, #006a5e);
}

.reminder-suggestion-redesign__btn--keep {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.reminder-suggestion-redesign__never {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-label-md, 0.75rem);
  color: rgba(255, 255, 255, 0.6);
  padding: 0.5rem 0;
  margin-top: 0.5rem;
  text-decoration: underline;
  min-height: 2.75rem;
}
```

### Imports do service (reutilizar)

```jsx
import { dismissSuggestion } from '@features/protocols/services/reminderOptimizerService'
import { BellRing } from 'lucide-react'
```

### Critério de conclusão 15.3

- [ ] Visual gradient verde (Smart Card `suggestion` variant)
- [ ] "Ajustar Horário" → `onAccept(suggestedTime)`
- [ ] "Manter Atual" → `dismissSuggestion(protocolId, false)` + `onDismiss()`
- [ ] "Não perguntar mais" → `dismissSuggestion(protocolId, true)` + `onDismiss()`
- [ ] Touch targets ≥ 56px nos CTAs
- [ ] `role="alert"` no container
- [ ] Props idênticas ao `ReminderSuggestion.jsx` original

---

## Sprint 15.4 — ProtocolRiskBadge

### Objetivo
Criar badge visual que surfacea o `protocolRiskService` nos cards de tratamento.

### Arquivo a criar
`src/features/adherence/components/ProtocolRiskBadge.jsx` + `ProtocolRiskBadge.css`

### Interface (Props)

```jsx
/**
 * ProtocolRiskBadge — Badge de risco por protocolo.
 *
 * @param {Object} risk — Saída de calculateProtocolRisk()
 *   Shape: { adherence14d, trend7d, riskLevel, riskColor, riskLabel, hasEnoughData }
 * @param {boolean} isComplex — true = Carlos (% + trend), false = Dona Maria (só label)
 */
export default function ProtocolRiskBadge({ risk, isComplex })
```

### Lógica

```
SE !risk || !risk.hasEnoughData → return null (princípio de dados suficientes)

Dona Maria (isComplex === false):
  SE riskLevel === 'stable' → return null (não mostrar badge quando tudo OK)
  Renderizar badge colorida com riskLabel apenas

Carlos (isComplex === true):
  SEMPRE renderizar (inclusive stable)
  Badge com riskLabel + adherence14d% + trend arrow
```

### Markup

```jsx
// Simple mode (Dona Maria)
<span
  className={`risk-badge risk-badge--${riskLevel}`}
  title={`Adesão 14 dias: ${adherence14d}%`}
>
  {riskLabel}
</span>

// Complex mode (Carlos)
<span className={`risk-badge risk-badge--${riskLevel} risk-badge--complex`}>
  {riskLabel}
  <span className="risk-badge__detail">
    {Math.round(adherence14d)}%
    <span className="risk-badge__trend" aria-label={trendLabel}>
      {trend7d > 2 ? '↑' : trend7d < -2 ? '↓' : '→'}
    </span>
  </span>
</span>
```

### CSS

```css
.risk-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: var(--text-label-sm, 0.625rem);
  font-weight: var(--font-weight-semibold, 600);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full, 9999px);
  white-space: nowrap;
}

.risk-badge--stable {
  background: color-mix(in srgb, #22c55e 15%, transparent);
  color: #15803d;
}

.risk-badge--attention {
  background: color-mix(in srgb, #f59e0b 15%, transparent);
  color: #92400e;
}

.risk-badge--critical {
  background: color-mix(in srgb, var(--color-error, #ba1a1a) 15%, transparent);
  color: var(--color-error, #ba1a1a);
}

.risk-badge__detail {
  font-weight: var(--font-weight-bold, 700);
}

.risk-badge__trend {
  font-size: 0.75rem;
}
```

### Integração no TreatmentsRedesign

O badge será integrado no Sprint 15.10 — o componente é criado isolado aqui.

**Posição:**
- Card mode (mobile/simple): na linha de badges, ao lado do `StockPill`
- Tabular mode (desktop/complex): coluna dedicada "Risco"

### Critério de conclusão 15.4

- [ ] Guard: `hasEnoughData === false` → return null
- [ ] Simple: badge só se `riskLevel !== 'stable'` — label colorida
- [ ] Complex: badge sempre visível com `adherence14d%` + trend arrow
- [ ] 3 variantes visuais (stable/attention/critical)
- [ ] `title` tooltip com detalhe numérico
- [ ] CSS sem bordas 1px

---

## Sprint 15.5 — CostSummaryRedesign

### Objetivo
Redesenhar a análise de custo mensal (legacy `CostChart.jsx`) para o visual Santuário.

### Arquivo a criar
`src/features/stock/components/CostSummaryRedesign.jsx` + `CostSummaryRedesign.css`

### ⚠️ Fonte de dados obrigatória — Nova arquitetura de estoque

O cálculo de custo **deve** usar a nova arquitetura de estoque definida em
`plans/archive_old/stock_refactor/exec_spec_stock_refactor.md` (§14.2 e §9.1).

**Regra fechada de fonte de dados (não negociável):**

1. Se houver registros em `purchases` para o medicamento → usar **somente `purchases`**
2. Se não houver `purchases` → fallback em `stock.original_quantity` (transição legacy)
3. **Nunca misturar** `purchases` e fallback legacy no mesmo medicamento

**O que isso significa para o componente:**
- `costData` é fornecido pelo `costAnalysisService.calculateMonthlyCosts()` **já atualizado** para
  ler de `purchases` (não de `stock.quantity` remanescente)
- Preço médio = `SUM(quantity_bought * unit_price) / SUM(quantity_bought)` sobre `purchases`
- Compras com `unit_price = 0` entram como grátis (não quebram o cálculo)
- O componente em si não acessa `stock` diretamente — recebe `costData` já calculado

**Dependência de sprint:** O `costAnalysisService` e o `purchaseService` devem estar refatorados
(stock refactor PR#443) antes de implementar este componente. Se o refactor ainda não foi mergeado,
usar o serviço legado temporariamente com comentário `// TODO: migrar para purchaseService após PR#443`.

### Interface (Props)

```jsx
/**
 * CostSummaryRedesign — Análise de custo mensal com barras proporcionais.
 *
 * @param {Object} costData — Saída de costAnalysisService.calculateMonthlyCosts()
 *   Shape: { items: [{ medicineName, monthlyCost, dailyCost, avgUnitPrice }], totalMonthly }
 *   Fonte: purchases (nova arquitetura) com fallback em stock.original_quantity (legacy)
 * @param {boolean} isComplex — true = lista completa, false = top 3
 */
export default function CostSummaryRedesign({ costData, isComplex })
```

### Lógica

```
SE !costData || costData.items.length === 0 →
  Renderizar empty state: "Adicione dados de compra para ver a análise de custo."

itemsToShow:
  isComplex === true → costData.items (todos)
  isComplex === false → costData.items.slice(0, 3) (top 3 mais caros)

maxCost = Math.max(...items.map(i => i.monthlyCost)) — para barra proporcional
```

### Ícone

Usar `Receipt` do Lucide (não emoji, não `DollarSign`):
```jsx
import { Receipt } from 'lucide-react'
```
> **Regra geral:** preferir sempre ícones Lucide ao invés de emojis no redesign.

### Markup

```jsx
<section className="cost-summary-redesign" aria-label="Análise de custo mensal">
  <div className="cost-summary-redesign__header">
    <Receipt size={20} aria-hidden="true" />
    <h3 className="cost-summary-redesign__title">Custo Mensal</h3>
  </div>

  <p className="cost-summary-redesign__total">
    R$ {costData.totalMonthly.toFixed(2)}<span>/mês</span>
  </p>

  <div className="cost-summary-redesign__list">
    {itemsToShow.map(item => (
      <div key={item.medicineName} className="cost-summary-redesign__item">
        <div className="cost-summary-redesign__item-header">
          <span className="cost-summary-redesign__item-name">{item.medicineName}</span>
          <span className="cost-summary-redesign__item-cost">R$ {item.monthlyCost.toFixed(2)}</span>
        </div>
        <div className="cost-summary-redesign__bar-track">
          <div
            className="cost-summary-redesign__bar-fill"
            style={{ width: `${(item.monthlyCost / maxCost) * 100}%` }}
            role="presentation"
          />
        </div>
      </div>
    ))}
  </div>

  {!isComplex && costData.items.length > 3 && (
    <p className="cost-summary-redesign__more">
      + {costData.items.length - 3} medicamentos
    </p>
  )}
</section>
```

### CSS (resumo)

- Container: `surface-container-lowest`, `radius-card`, `padding: 2rem`, `shadow-ambient`
- Total: `headline-md` (Public Sans 700), `color-on-surface`
- `/mês`: `label-md`, `color-outline`
- Bar track: `8px`, `surface-container-low`, `radius-full`
- Bar fill: `8px`, `primary`, `radius-full`; item mais caro: `tertiary`
- Animation: Living Fill (width 0 → %, 1000ms ease-out, 0.5s delay)
- Living Fill deve respeitar `prefers-reduced-motion`

### Critério de conclusão 15.5

- [ ] Renderiza total mensal + breakdown por medicamento
- [ ] Barras proporcionais com Living Fill animation
- [ ] Persona: Simple top 3, Complex todos
- [ ] Empty state quando sem dados de compra
- [ ] `section` + `aria-label`
- [ ] Sem bordas 1px — separation by spacing
- [ ] Ícone `Receipt` (Lucide), não emoji nem `DollarSign`
- [ ] Fonte de dados: `costAnalysisService` lendo de `purchases` (nova arquitetura stock refactor)

---

## Sprint 15.6 — PrescriptionTimelineRedesign

### Objetivo
Redesenhar a timeline de prescrições (EV-07) com visual Santuário.

### Arquivo a criar
`src/features/stock/components/PrescriptionTimelineRedesign.jsx` + `PrescriptionTimelineRedesign.css`

### Interface (Props)

```jsx
/**
 * PrescriptionTimelineRedesign — Barras de vigência de prescrições.
 *
 * @param {Array} prescriptions — Lista de protocolos com start/end date
 *   Shape: [{ id, name, medicineName, startDate, endDate, status, isContinuous }]
 *   status: 'ativa' | 'vencendo' | 'vencida' | 'finalizada'
 *   isContinuous: boolean — true quando endDate é null (uso contínuo, sem data final)
 * @param {boolean} isComplex — false = lista empilhada, true = eixo temporal compartilhado
 */
export default function PrescriptionTimelineRedesign({ prescriptions, isComplex })
```

### ⚠️ Filtro obrigatório — Prescrições de uso contínuo

Prescrições **sem data final (`endDate === null`)** representam tratamentos de uso contínuo
(ex: Metformina para diabetes tipo 2 tomada indefinidamente). Essas **não devem aparecer** no widget,
pois não há vigência temporal a exibir e geram barra sem sentido semântico.

**Filtro obrigatório antes de qualquer renderização:**

```js
const timedPrescriptions = prescriptions.filter(p => p.endDate != null && !p.isContinuous)

SE timedPrescriptions.length === 0 → return null
```

### Lógica

```
Aplicar sobre timedPrescriptions (já filtrado — sem uso contínuo):

Para cada prescrição:
  totalDays = diff(endDate, startDate)
  elapsedDays = diff(today, startDate)
  progressPct = clamp(elapsedDays / totalDays * 100, 0, 100)

  barColor:
    status === 'ativa' → var(--color-primary)
    status === 'vencendo' → var(--color-tertiary)
    status === 'vencida' → var(--color-error)
    status === 'finalizada' → var(--color-outline)
```

### Markup (modo Simple)

```jsx
<section className="prescription-timeline-redesign" aria-label="Vigência de prescrições">
  <h3>Prescrições</h3>
  {prescriptions.map(p => (
    <div key={p.id} className="prescription-timeline-redesign__item">
      <div className="prescription-timeline-redesign__label">
        <span className="prescription-timeline-redesign__name">{p.medicineName}</span>
        <span className="prescription-timeline-redesign__dates">
          {formatDate(p.startDate)} — {formatDate(p.endDate)}
        </span>
      </div>
      <div className="prescription-timeline-redesign__bar-track">
        <div
          className={`prescription-timeline-redesign__bar-fill prescription-timeline-redesign__bar-fill--${p.status}`}
          style={{ width: `${progressPct}%` }}
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${p.medicineName}: ${Math.round(progressPct)}% da vigência`}
        />
        {/* Marcador "Hoje" */}
        <div
          className="prescription-timeline-redesign__today-marker"
          style={{ left: `${progressPct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  ))}
</section>
```

### CSS (resumo)

- Bar track: `8px`, `surface-container-low`, `radius-full`
- Bar fill ativa: `var(--color-primary)`, Living Fill animation
- Bar fill vencendo: `var(--color-tertiary)`
- Bar fill vencida: `var(--color-error)`
- Today marker: `2px` vertical line, `primary-fixed`, dashed
- Label: `title-sm` (Lexend 600) + `label-md` (dates)
- Gap entre items: `1rem` (Spacing 3)

### Critério de conclusão 15.6

- [ ] Barra por prescrição com cor semântica (ativa/vencendo/vencida)
- [ ] Marcador "Hoje" na posição correta
- [ ] Living Fill animation (prefers-reduced-motion respeitado)
- [ ] `role="progressbar"` + aria-values
- [ ] Sem bordas 1px
- [ ] **Prescrições de uso contínuo (`endDate === null` ou `isContinuous === true`) são filtradas e não renderizadas**
- [ ] `return null` quando todas as prescrições forem de uso contínuo (lista vazia após filtro)

---

## Sprint 15.7 — Refill Prediction Enrichment

### Objetivo
Enriquecer componentes existentes (`StockCardRedesign`, `StockAlertInline`) com dados de `refillPredictionService`.

### Arquivos a MODIFICAR (NÃO criar novos)

1. **`src/features/stock/components/redesign/StockCardRedesign.jsx`** — adicionar prop `prediction`
2. **`src/features/dashboard/components/StockAlertInline.jsx`** — usar `predictedStockoutDate` quando disponível

### Enriquecimentos no StockCardRedesign

Atualmente exibe `daysRemaining` do `stockSummary`. Adicionar:

```jsx
// Nova prop opcional
// prediction: { daysRemaining, predictedStockoutDate, dailyConsumption, isRealData, confidence }

{prediction?.predictedStockoutDate && (
  <div className="stock-card__prediction">
    <span className="stock-card__prediction-date">
      Previsão: acaba em ~{formatDate(prediction.predictedStockoutDate)}
    </span>
    <span className={`stock-card__prediction-confidence stock-card__prediction-confidence--${prediction.confidence}`}>
      {prediction.confidence === 'high' ? (
        <><ShieldCheck size={12} /> Alta</>
      ) : prediction.confidence === 'medium' ? (
        <><ShieldAlert size={12} /> Média</>
      ) : null}
    </span>
  </div>
)}
```

**Guard:** Se `prediction.isRealData === false && prediction.confidence === 'low'` → não mostrar enriquecimento. Manter comportamento atual.

### ⚠️ Restrições de layout — não regredir o card atual

Ao adicionar o enriquecimento de previsão, **preservar obrigatoriamente** os elementos visuais já existentes no `StockCardRedesign`:

#### 1. Pill de dosagem

O card atual exibe um **pill com a concentração do medicamento** (ex: "40mg", "1200mg") ao lado do nome, como visto no screenshot de referência (`screenshots/stock-card-complex-redesign.png`). Esse pill **não deve ser removido** pela adição da prop `prediction`.

Verificar que o JSX ainda inclui:
```jsx
<span className="stock-card__dosage-pill">{medicine.dosage_per_pill}{medicine.dosage_unit}</span>
```

#### 2. Badge de dias — não quebrar em duas linhas no desktop

O badge "30+ DIAS" (ou "X DIAS") exibido no canto direito do card atualmente quebra em duas linhas no desktop enquanto fica correto no mobile. **Corrigir junto com este sprint.**

Causa provável: `white-space` não definido no elemento `.stock-card__days-badge` ou largura insuficiente no layout de grid do desktop.

Correção obrigatória no CSS:
```css
.stock-card__days-badge {
  white-space: nowrap;   /* impede quebra de linha */
  flex-shrink: 0;        /* não comprime em flex containers */
  min-width: max-content;
}
```

Verificar que no layout desktop (grid ou flex) a coluna/célula do badge tenha largura suficiente ou `width: auto` para acomodar o texto sem quebra.

### Enriquecimentos no StockAlertInline

Quando `prediction?.predictedStockoutDate` está disponível:
- Substituir "X dias restantes" por "Acaba em ~DD/MM" (mais preciso e acionável)
- Manter fallback para `daysRemaining` quando prediction indisponível

### Critério de conclusão 15.7

- [ ] `StockCardRedesign` mostra data prevista de esgotamento quando prediction de alta/média confiança
- [ ] `StockAlertInline` usa predictedStockoutDate quando disponível
- [ ] Guard: low confidence → fallback para comportamento atual
- [ ] Ícone de confiança (ShieldCheck/ShieldAlert) no StockCard
- [ ] Props backwards-compatible (prediction é opcional)
- [ ] **Pill de dosagem (concentração) preservado** — não removido pela adição da prop `prediction`
- [ ] **Badge de dias não quebra em duas linhas no desktop** — `white-space: nowrap` + `flex-shrink: 0` no `.stock-card__days-badge`

---

## Sprint 15.8 — DashboardRedesign Integration

### Objetivo
Orquestrar a integração dos componentes W15.1-W15.3 no `DashboardRedesign.jsx`.

### Arquivo a MODIFICAR
`src/views/redesign/DashboardRedesign.jsx`

### Novos imports

```jsx
import SmartAlertsRedesign from '@dashboard/components/SmartAlertsRedesign'
import InsightCardRedesign from '@dashboard/components/InsightCardRedesign'
import ReminderSuggestionRedesign from '@features/protocols/components/ReminderSuggestionRedesign'
import {
  analyzeReminderTiming,
  isSuggestionDismissed,
} from '@features/protocols/services/reminderOptimizerService'
import { insightService } from '@dashboard/services/insightService'
import {
  PRESCRIPTION_STATUS,
  getExpiringPrescriptions,
} from '@features/prescriptions/services/prescriptionService'
```

### Novos estados

```jsx
const [reminderSuggestion, setReminderSuggestion] = useState(null)
const [suggestionProtocolId, setSuggestionProtocolId] = useState(null)
const [suggestionProtocolName, setSuggestionProtocolName] = useState('')
const [snoozedAlerts, setSnoozedAlerts] = useState({})
```

### Novos useMemo (RESPEITAR ordem: States → Memos → Effects → Handlers)

```jsx
// ── smartAlerts: Replicar lógica do Dashboard.jsx legacy ──
const smartAlerts = useMemo(() => {
  const alerts = []
  const now = new Date()
  const nowTimestamp = now.getTime()

  // 1. Stock alerts (do stockSummary existente)
  stockSummary?.items?.forEach(item => {
    if (item.isZero || item.isLow) {
      const severity = item.isZero ? 'critical' : 'warning'
      alerts.push({
        id: `stock-${item.medicineId}`,
        severity,
        title: item.isZero ? 'Estoque Zerado' : 'Estoque Baixo',
        message: item.isZero
          ? `O estoque de ${item.medicineName} acabou.`
          : `${item.medicineName} acaba em ${item.daysRemaining} dias.`,
        actions: [{ label: 'Ver Estoque', type: 'primary' }],
      })
    }
  })

  // 2. Dose atrasada (das zones)
  const lateDoses = zones.late?.filter(d => !d.isRegistered) || []
  lateDoses.forEach(dose => {
    const [h, m] = (dose.scheduledTime || '').split(':').map(Number)
    const scheduled = new Date()
    scheduled.setHours(h, m, 0, 0)
    const delay = Math.round((now - scheduled) / 60000)
    if (delay > 30) {
      alerts.push({
        id: `delay-${dose.protocolId}-${dose.scheduledTime}`,
        severity: delay > 240 ? 'critical' : 'warning',
        title: delay > 240 ? 'Atraso Crítico' : 'Dose Atrasada',
        message: `${dose.medicineName} era às ${dose.scheduledTime} (${Math.floor(delay / 60)}h atrás)`,
        actions: [{ label: 'Tomar Agora', type: 'primary' }],
        protocol_id: dose.protocolId,
      })
    }
  })

  // 3. Prescrições vencendo (dos protocols)
  // ... (replicar lógica expiringPrescriptions do legacy Dashboard)

  // Filtrar snoozed
  return alerts
    .filter(a => {
      const snoozed = snoozedAlerts[a.id]
      if (!snoozed) return true
      return snoozed.expiresAt <= nowTimestamp
    })
    .sort((a, b) => (a.severity === 'critical' ? -1 : 1))
}, [stockSummary, zones, protocols, logs, snoozedAlerts])

// ── reminderSuggestion: Otimizador de horários ──
const computedReminder = useMemo(() => {
  if (!protocols?.length || !logs?.length) return null
  for (const protocol of protocols) {
    if (!protocol.active || !protocol.time_schedule?.length) continue
    if (isSuggestionDismissed(protocol.id)) continue
    const suggestion = analyzeReminderTiming({ protocol, logs })
    if (suggestion?.shouldSuggest) {
      return { suggestion, protocolId: protocol.id, protocolName: protocol.medicine?.name || protocol.name }
    }
  }
  return null
}, [protocols, logs])

// ── insight: Card rotativo ──
const currentInsight = useMemo(() => {
  return insightService.getNextInsight?.({
    adherenceScore: stats?.score,
    streak: stats?.currentStreak,
    stockSummary,
    protocols,
  }) || null
}, [stats, stockSummary, protocols])
```

### Novos efeitos

```jsx
useEffect(() => {
  if (computedReminder) {
    setReminderSuggestion(computedReminder.suggestion)
    setSuggestionProtocolId(computedReminder.protocolId)
    setSuggestionProtocolName(computedReminder.protocolName)
  } else {
    setReminderSuggestion(null)
    setSuggestionProtocolId(null)
    setSuggestionProtocolName('')
  }
}, [computedReminder])
```

### Novos handlers

```jsx
const handleAlertAction = useCallback((alert, action) => {
  if (action.label === 'Ver Estoque') onNavigate?.('stock')
  if (action.label === 'Tomar Agora' && alert.protocol_id) {
    // Registrar dose do protocolo
    const dose = urgentDoses.find(d => d.protocolId === alert.protocol_id)
    if (dose) handleRegisterDoseQuick(dose.medicineId, dose.protocolId, dose.dosagePerIntake)
  }
}, [onNavigate, urgentDoses, handleRegisterDoseQuick])

const handleSnoozeAlert = useCallback((alertId) => {
  setSnoozedAlerts(prev => ({
    ...prev,
    [alertId]: { expiresAt: Date.now() + 24 * 60 * 60 * 1000 }
  }))
}, [])

const handleReminderAccept = useCallback(async (newTime) => {
  // Replicar handleReminderSuggestionAccept do Dashboard.jsx legacy
  const protocol = protocols.find(p => p.id === suggestionProtocolId)
  if (!protocol?.time_schedule) return
  const newTimeSchedule = protocol.time_schedule.map(time =>
    time === reminderSuggestion.currentTime ? newTime : time
  )
  const { cachedProtocolService } = await import('@shared/services')
  await cachedProtocolService.update(suggestionProtocolId, { time_schedule: newTimeSchedule })
  setReminderSuggestion(null)
  refresh()
}, [protocols, suggestionProtocolId, reminderSuggestion, refresh])
```

### Layout JSX atualizado

```jsx
return (
  <div className="page-container" ...>
    {/* Stock Alert Complex Mode Top — EXISTENTE */}
    {complexityMode === 'complex' && criticalStockItems.length > 0 && (
      <StockAlertInline ... />
    )}

    <div className="grid-dashboard">
      {/* ═══ LEFT COLUMN ═══ */}
      <div ...>
        {/* Greeting + Ring — EXISTENTE */}
        ...

        {/* Priority Dose Card — EXISTENTE */}
        {urgentDoses.length > 0 && <PriorityDoseCard ... />}

        {/* 🆕 Insight Card (abaixo do priority card) */}
        {currentInsight && (
          <InsightCardRedesign
            insight={currentInsight}
            onAction={(insight) => { /* navegar para view relevante */ }}
          />
        )}
      </div>

      {/* ═══ RIGHT COLUMN ═══ */}
      <div ...>
        {/* 🆕 Smart Alerts (topo da coluna direita) */}
        {smartAlerts.length > 0 && (
          <SmartAlertsRedesign
            alerts={smartAlerts}
            onAction={handleAlertAction}
            isComplex={complexityMode !== 'simple'}
            onSnooze={handleSnoozeAlert}
          />
        )}

        {/* 🆕 Reminder Suggestion */}
        {reminderSuggestion && (
          <ReminderSuggestionRedesign
            suggestion={reminderSuggestion}
            protocolId={suggestionProtocolId}
            protocolName={suggestionProtocolName}
            onAccept={handleReminderAccept}
            onDismiss={() => setReminderSuggestion(null)}
          />
        )}

        {/* Cronograma — EXISTENTE */}
        {scheduleAllDoses.length > 0 && <CronogramaPeriodo ... />}

        {/* Stock Alert Simple Mode — EXISTENTE */}
        {complexityMode !== 'complex' && criticalStockItems.length > 0 && (
          <StockAlertInline ... />
        )}
      </div>
    </div>
  </div>
)
```

### Critério de conclusão 15.8

- [ ] `SmartAlertsRedesign` renderiza alertas de estoque + dose atrasada + prescrição vencendo
- [ ] `InsightCardRedesign` exibe insight rotativo do `insightService`
- [ ] `ReminderSuggestionRedesign` exibe sugestão com CTAs funcionais (aceitar/manter/nunca)
- [ ] Alert snooze funcional (24h)
- [ ] Layout desktop: Smart Alerts no topo da coluna direita
- [ ] Layout mobile: Smart Alerts abaixo do PriorityDoseCard
- [ ] Persona filter aplicado em todos os componentes
- [ ] Hook order respeitado: States → Memos → Effects → Handlers (R-010)
- [ ] `npm run validate:agent` passa

---

## Sprint 15.9 — StockRedesign Integration

### Objetivo
Adicionar `CostSummaryRedesign` e `PrescriptionTimelineRedesign` ao `StockRedesign.jsx`.

### Arquivo a MODIFICAR
`src/views/redesign/StockRedesign.jsx`

### Novos imports

```jsx
import CostSummaryRedesign from '@stock/components/CostSummaryRedesign'
import PrescriptionTimelineRedesign from '@stock/components/PrescriptionTimelineRedesign'
import { calculateMonthlyCosts } from '@stock/services/costAnalysisService'
```

### Novos useMemo

```jsx
// Custo mensal
const costData = useMemo(() => {
  if (!medicines?.length || !protocols?.length) return null
  // Enriquecer medicines com stock/purchases para price data
  const medicinesWithStock = medicines.map(med => ({
    ...med,
    stock: items?.filter(s => s.medicine_id === med.id) || [],
    purchases: purchases?.filter(p => p.medicine_id === med.id) || [],
  }))
  return calculateMonthlyCosts(medicinesWithStock, protocols)
}, [medicines, protocols, items, purchases])

// Dados de prescrição para timeline
const prescriptionTimelineData = useMemo(() => {
  if (!protocols?.length) return []
  return protocols
    .filter(p => p.start_date) // Só protocolos com data de início
    .map(p => ({
      id: p.id,
      name: p.name,
      medicineName: p.medicine?.name || 'Medicamento',
      startDate: p.start_date,
      endDate: p.end_date || null,
      status: deriveStatus(p), // ativa/vencendo/vencida/finalizada
    }))
}, [protocols])
```

### Layout JSX (adicionar abaixo do grid de stock cards)

```jsx
{/* 🆕 Análise de Custo Mensal */}
{costData && costData.items.length > 0 && (
  <CostSummaryRedesign
    costData={costData}
    isComplex={isComplex}
  />
)}

{/* 🆕 Timeline de Prescrições */}
{prescriptionTimelineData.length > 0 && (
  <PrescriptionTimelineRedesign
    prescriptions={prescriptionTimelineData}
    isComplex={isComplex}
  />
)}
```

### Critério de conclusão 15.9

- [ ] `CostSummaryRedesign` renderiza no `StockRedesign` com dados reais
- [ ] `PrescriptionTimelineRedesign` renderiza barras de vigência
- [ ] Persona filter aplicado (Simple top 3, Complex all)
- [ ] Layout desktop: cost + timeline na coluna direita
- [ ] Layout mobile: stack abaixo dos cards de estoque
- [ ] `npm run validate:agent` passa

---

## Sprint 15.10 — TreatmentsRedesign Integration

### Objetivo
Integrar `ProtocolRiskBadge` nos cards/rows de tratamento em `TreatmentsRedesign.jsx`.

### Arquivo a MODIFICAR
`src/views/redesign/TreatmentsRedesign.jsx`

### Novos imports

```jsx
import ProtocolRiskBadge from '@adherence/components/ProtocolRiskBadge'
import { calculateProtocolRisk } from '@adherence/services/protocolRiskService'
```

### Novo useMemo

```jsx
// Risk scores por protocolo
const riskByProtocol = useMemo(() => {
  if (!protocols?.length || !logs?.length) return new Map()
  const map = new Map()
  protocols.forEach(protocol => {
    if (!protocol.active) return
    const risk = calculateProtocolRisk({
      protocolId: protocol.id,
      logs,
      protocol,
    })
    if (risk) map.set(protocol.id, risk)
  })
  return map
}, [protocols, logs])
```

### Integração no JSX

Dentro de cada protocol row/card, ao lado do `StockPill` e `AdherenceBar7d`/`AdherenceLabel`:

```jsx
{/* Após StockPill, antes do final do row */}
<ProtocolRiskBadge
  risk={riskByProtocol.get(protocol.id)}
  isComplex={isComplex}
/>
```

### Critério de conclusão 15.10

- [ ] `ProtocolRiskBadge` aparece em cada protocol row/card ativo
- [ ] Simple: badge só se `riskLevel !== 'stable'`
- [ ] Complex: badge sempre visível com % + trend
- [ ] Layout tabular desktop: coluna "Risco" entre Adesão e Estoque
- [ ] Protocolos inativos/finalizados: sem badge (guard `protocol.active`)
- [ ] `npm run validate:agent` passa

---

## Ordem de Execução

```
Sprint 15.1 (SmartAlertsRedesign)     ─┐
Sprint 15.2 (InsightCardRedesign)      │── Paralelos (componentes isolados)
Sprint 15.3 (ReminderSuggestionRedesign)│
Sprint 15.4 (ProtocolRiskBadge)        │
Sprint 15.5 (CostSummaryRedesign)      │
Sprint 15.6 (PrescriptionTimelineRedesign)│
Sprint 15.7 (Refill Prediction)        ─┘
        ↓
Sprint 15.8 (Dashboard Integration)    ─── Depende de 15.1 + 15.2 + 15.3
        ↓
Sprint 15.9 (Stock Integration)        ─── Depende de 15.5 + 15.6 + 15.7
        ↓
Sprint 15.10 (Treatments Integration)  ─── Depende de 15.4
```

**Recomendação:** Executar 15.1-15.7 em qualquer ordem (são componentes isolados). Depois 15.8-15.10 sequencialmente (integração em views).

---

## Critério de Conclusão (Wave 15 Completa)

- [ ] `SmartAlertsRedesign` renderiza alertas de estoque, dose atrasada e prescrição no Dashboard redesenhado
- [ ] `InsightCardRedesign` exibe insight rotativo do `insightService` com visual Smart Card
- [ ] `ReminderSuggestionRedesign` exibe sugestão de ajuste de horário com 3 CTAs funcionais
- [ ] `ProtocolRiskBadge` exibe risk score nos cards de tratamento (com threshold de dados)
- [ ] `CostSummaryRedesign` exibe análise de custo mensal no Estoque redesenhado
- [ ] `PrescriptionTimelineRedesign` exibe timeline de vigência de prescrições no Estoque
- [ ] Refill prediction enriquece `StockCardRedesign` com data de esgotamento prevista
- [ ] Todos os componentes respeitam Progressive Disclosure (Simple vs Complex persona)
- [ ] Zero new Supabase calls — tudo computado client-side sobre cache existente
- [ ] Touch targets ≥ 56px em todos os CTAs
- [ ] Cascade Reveal + Living Fill aplicados onde relevante
- [ ] `prefers-reduced-motion` respeitado em todas as animações
- [ ] CSS sem bordas 1px — apenas tonal surfaces + border-left accent
- [ ] Todos os ícones Lucide acompanhados de label ou `aria-hidden="true"`
- [ ] Hook order respeitado: States → Memos → Effects → Handlers (R-010)
- [ ] `npm run validate:agent` passa com 0 erros
- [ ] O redesign é agora **estritamente superior** ao legacy em features + visual

---

## Referências

| Documento | Caminho |
|-----------|---------|
| Product Strategy | `plans/backlog-redesign/PRODUCT_STRATEGY_CONSOLIDATED.md` |
| Design System | `plans/backlog-redesign/DESIGN-SYSTEM.md` |
| Master Spec | `plans/backlog-redesign/MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md` |
| Roadmap v4 | `plans/backlog-roadmap_v4/ROADMAP_v4.md` |
| Phase 6 Spec | `plans/EXEC_SPEC_FASE_6.md` |
| Mobile Performance | `docs/standards/MOBILE_PERFORMANCE.md` |
| Memory Rules | `.memory/rules.md` |
| Memory Anti-patterns | `.memory/anti-patterns.md` |

---

*Documento criado em 2026-04-03. Wave 15 — Smart Insights Integration.*
