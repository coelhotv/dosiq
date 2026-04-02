# Wave 6 — Dashboard Redesign

**Status:** ✅ COMPLETA (Entregue 2026-03-25)
**Dependências:** W0-W5 ✅ completas
**Branch:** `feature/redesign/wave-6-dashboard-redesign` — MERGED em PR #425 (2026-03-25)
**Estimativa:** 6 sprints sequenciais ✅ (S6.1-S6.6 concluídos em single delivery)
**Risco:** ALTO — Dashboard é o coração da app. Compartilha lógica com Dashboard.jsx original. ✅ **MITIGADO**

### ⚠️ Débito Técnico — Corrigido em W6.5

**Problema identificado (2026-03-25):** `DashboardRedesign.jsx` foi entregue sem o layout desktop 2 colunas (critério da master spec §1873). O botão "TOMAR" em `CronogramaPeriodo.jsx` foi entregue com `minHeight: 36px` (critério exigia ≥56px).
**Correção:** `plans/redesign/WAVE_6_5_DASHBOARD_DESKTOP_FIXES.md` — branch `fix/redesign/wave-6-desktop-layout`.

---

### 📦 Entrega Completa

**Sprints 6.1-6.6 — Dashboard Redesign (Single Delivery)** ✅

**Componentes Novos:**
- `src/features/dashboard/components/RingGaugeRedesign.jsx` (104 linhas) — SVG ring gauge com Framer Motion, 3 tamanhos responsivos
- `src/features/dashboard/components/PriorityDoseCard.jsx` (110 linhas) — Gradient card para doses urgentes com callback handlers
- `src/features/dashboard/components/CronogramaPeriodo.jsx` (126 linhas) — Cronograma por período (Manhã/Tarde/Noite) com dose status
- `src/features/dashboard/components/StockAlertInline.jsx` (104 linhas) — Alert banner com progress bar dinâmico

**View & Integração:**
- `src/views/redesign/DashboardRedesign.jsx` (244 linhas) — View completa composing todos 4 componentes + modal para registro
- `src/App.jsx` — Feature flag branching (isRedesignEnabled) + lazy loading com Suspense + ViewSkeleton fallback

**Qualidade & Conformance:**
- Zod validation em todos os schemas
- R-010 hook ordering conformance (States → Memos → Effects → Handlers)
- Magic number extraction (PROGRESS_BAR_MAX_DAYS = 30)
- Framer Motion animations com prefers-reduced-motion support
- Sanctuary Therapeutic color scheme integration
- 0 lint errors, 546 tests passing
- AI review cycle: 2 Medium fixes aplicadas (suggestion blocks implemented)

**Impacto:**
- Dashboard original (Dashboard.jsx) completamente preservado — ZERO breaking changes
- DashboardRedesign separado em lazy chunk (5.11 kB gzip)
- Feature flag permite A/B testing e rollout gradual
- UI/UX completamente refatorada, dados compartilhados 100%

---

## 🚩 ESTRATÉGIA DE ROLLOUT

- `Dashboard.jsx` **NÃO é modificado** em nenhuma circunstância
- Novos componentes de apoio: `src/features/dashboard/components/` com sufixo `Redesign`
- `DashboardRedesign.jsx` é criado em `src/views/redesign/`
- `App.jsx` é atualizado **por último** (Sprint 6.6) após o arquivo `DashboardRedesign.jsx` existir
- `DashboardRedesign` DEVE ser lazy-loaded (separar do bundle principal)
- O hook `useDashboard()` e todos os services são **completamente compartilhados** (NÃO duplicar)

> ⚠️ **ORDEM CRÍTICA DE EXECUÇÃO:** Os sprints 6.1-6.5 criam todos os arquivos. Apenas o Sprint 6.6 modifica App.jsx. Esta ordem é obrigatória — Vite falha no build se `lazy(() => import('./views/redesign/DashboardRedesign'))` aponta para um arquivo inexistente.

---

## 🧠 CONTEXTO OBRIGATÓRIO — Leia antes de codificar

### Dados do Dashboard (hook compartilhado)

```jsx
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'

const {
  stats,          // { adherenceScore: number, streak: number, totalDoses: number, completedDoses: number }
  protocols,      // Array de protocolos ativos
  logs,           // Array de logs do dia
  stockSummary,   // { items: Array<{medicineName, daysRemaining, stockStatus}>, criticalCount: number }
  dailyAdherence, // Array de { date, adherence } (7 dias)
  refresh,        // () => void — força refresh dos dados
  isDoseInToleranceWindow, // (protocolId, scheduledTime) => boolean
  isLoading,      // boolean
} = useDashboard()
```

### Zonas de Dose

```jsx
import { useDoseZones } from '@dashboard/hooks/useDoseZones'

const { zones, totals } = useDoseZones()
// zones: { late: DoseItem[], now: DoseItem[], upcoming: DoseItem[], later: DoseItem[], done: DoseItem[] }
// totals: { total: number, completed: number, remaining: number }

// DoseItem shape:
// { protocolId, medicineId, medicineName, scheduledTime, dosagePerIntake,
//   treatmentPlanId, treatmentPlanName, planBadge, isRegistered, registeredAt }
```

### Padrão de registro de dose

O DashboardRedesign usa o MESMO padrão de Modal + LogForm do Dashboard.jsx original:

```jsx
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'

const [isModalOpen, setIsModalOpen] = useState(false)
const [prefillData, setPrefillData] = useState(null)

const handleRegisterDose = (dose) => {
  setPrefillData({
    protocol_id: dose.protocolId,
    medicine_id: dose.medicineId,
    medicine_name: dose.medicineName,
    scheduled_time: dose.scheduledTime,
    dosage_per_intake: dose.dosagePerIntake,
  })
  setIsModalOpen(true)
}
```

### Agrupamento por Período (CronogramaPeriodo)

```
Manhã:  scheduledTime < "12:00"
Tarde:  scheduledTime >= "12:00" e < "18:00"
Noite:  scheduledTime >= "18:00"
```

Fonte: **todas** as doses do `zones` (late + now + upcoming + later + done), agrupadas por horário.

### Arquivos que NÃO devem ser modificados

- `src/views/Dashboard.jsx`
- `src/features/dashboard/components/RingGauge.jsx`
- `src/features/dashboard/components/DoseZoneList.jsx`
- `src/features/dashboard/components/StockBars.jsx`
- `src/features/dashboard/components/SmartAlerts.jsx`
- Qualquer hook, service ou schema existente

---

## Sprint 6.1 — RingGaugeRedesign

**Skill:** `/deliver-sprint`

### Arquivo a criar
- `src/features/dashboard/components/RingGaugeRedesign.jsx` (NOVO)

**NÃO criar CSS separado** — usar tokens CSS existentes.

### Interface (compatível com RingGauge original — NÃO mudar assinatura)

```jsx
// Props
RingGaugeRedesign({
  score = 0,       // 0–100, porcentagem de adesão
  streak = 0,      // Dias consecutivos
  size = 'medium', // 'compact' | 'medium' | 'large'
  onClick,         // Function (opcional)
  className = '',  // string (opcional)
})
// Nota: sparklineData omitido neste redesign (sem sparkline interna)
```

### Visual (Sanctuary Therapeutic)

| Propriedade | Antes (RingGauge) | Depois (RingGaugeRedesign) |
|-------------|------------------|--------------------------|
| Track color | Dinâmico (error/warning/success/info) | Sempre `--color-secondary` (#005db6) opacity 0.2 |
| Progress color | Dinâmico | Sempre `--color-primary-fixed` (#90f4e3) |
| Stroke width | 4 | 12 (large/medium), 8 (compact) |
| Texto central | Score + emoji de motivação | Score% + label "ADESÃO" |
| Streak | Emoji (🔥⚡🏆) | "🔥 N dias" como texto abaixo |

### Implementação completa

```jsx
import { motion } from 'framer-motion'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const SIZE_MAP = {
  large:   { svgSize: 120, strokeWidth: 12, fontSize: '1.75rem', labelSize: '0.625rem' },
  medium:  { svgSize: 96,  strokeWidth: 10, fontSize: '1.25rem', labelSize: '0.6rem'   },
  compact: { svgSize: 56,  strokeWidth: 8,  fontSize: '0.875rem', labelSize: '0.5rem'  },
}

export default function RingGaugeRedesign({
  score = 0,
  streak = 0,
  size = 'medium',
  onClick,
  className = '',
}) {
  const { svgSize, strokeWidth, fontSize, labelSize } = SIZE_MAP[size] || SIZE_MAP.medium
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE
  const isClickable = Boolean(onClick)

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      className={`ring-gauge-redesign ring-gauge-redesign--${size}${className ? ` ${className}` : ''}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      aria-label={`Adesão diária: ${score}%. Streak: ${streak} dias`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: isClickable ? 'pointer' : 'default',
      }}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 120 120"
        role="img"
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        {/* Track */}
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke="var(--color-secondary, #005db6)"
          strokeWidth={strokeWidth}
          opacity="0.2"
        />
        {/* Progress */}
        <motion.circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke="var(--color-primary-fixed, #90f4e3)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={prefersReducedMotion
            ? { duration: 0 }
            : { duration: 1, delay: 0.5, ease: [0.4, 0, 0.2, 1] }
          }
          style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
        />
        {/* Percentagem */}
        <text
          x="60" y="56"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-on-surface, #191c1d)"
          fontFamily="var(--font-display, 'Public Sans', sans-serif)"
          fontWeight="700"
          fontSize={fontSize}
        >
          {score}%
        </text>
        {/* Label */}
        <text
          x="60" y="72"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-outline, #6d7a76)"
          fontFamily="var(--font-body, 'Lexend', sans-serif)"
          fontWeight="500"
          fontSize={labelSize}
        >
          ADESÃO
        </text>
      </svg>

      {/* Streak */}
      {streak > 0 && (
        <div
          aria-label={`Streak: ${streak} dias consecutivos`}
          style={{
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-label-md, 0.75rem)',
            fontWeight: 'var(--font-weight-medium, 500)',
            color: 'var(--color-tertiary, #7b5700)',
          }}
        >
          🔥 {streak} dias
        </div>
      )}
    </div>
  )
}
```

### Critério de conclusão Sprint 6.1
- [ ] `src/features/dashboard/components/RingGaugeRedesign.jsx` criado
- [ ] Track: `--color-secondary` opacity 0.2 (azul fixo)
- [ ] Progress: `--color-primary-fixed` (#90f4e3, verde-água fixo)
- [ ] Texto central: Score% + label "ADESÃO" via SVG `<text>`
- [ ] Streak exibido abaixo quando `streak > 0`
- [ ] `aria-label` com score e streak
- [ ] `role="button"` + `tabIndex={0}` + `onKeyDown` quando `onClick` presente
- [ ] `motion` importado de `'framer-motion'` (NÃO `'motion/react'`)
- [ ] Sem CSS file separado
- [ ] `RingGauge.jsx` NÃO foi modificado

---

## Sprint 6.2 — PriorityDoseCard

**Skill:** `/deliver-sprint`

### Arquivo a criar
- `src/features/dashboard/components/PriorityDoseCard.jsx` (NOVO)

### Visual

Card gradient azul para destaque de dose urgente:

```
╭──────────────────────────────────────╮
│  ● PRIORIDADE MÁXIMA          08:00  │
│  Em 15 minutos                       │
│                                      │
│  • Losartana 50mg · 1 comprimido     │
│  • Omeprazol 20mg · 1 comprimido     │
│                                      │
│  ╭──────────────────────────────╮    │
│  │       Confirmar Agora        │    │
│  ╰──────────────────────────────╯    │
╰──────────────────────────────────────╯
```

### Implementação

```jsx
import { Clock } from 'lucide-react'

/**
 * PriorityDoseCard — Destaque visual para doses urgentes (late + now).
 *
 * @param {Array} doses — DoseItem[] (late + now não registradas)
 * @param {Function} onRegister — onRegister(dose) — para dose única
 * @param {Function} onRegisterAll — onRegisterAll(doses) — para múltiplas
 */
export default function PriorityDoseCard({ doses = [], onRegister, onRegisterAll }) {
  if (!doses || doses.length === 0) return null

  const nextTime = doses[0]?.scheduledTime || ''
  const now = new Date()
  const [hour, minute] = nextTime.split(':').map(Number)
  const scheduled = new Date()
  scheduled.setHours(hour, minute, 0, 0)
  const diffMin = Math.round((scheduled - now) / 60000)

  const timeLabel = diffMin <= 0
    ? 'Agora'
    : diffMin < 60
      ? `Em ${diffMin} minuto${diffMin !== 1 ? 's' : ''}`
      : `Às ${nextTime}`

  const handleCTA = () => {
    if (doses.length === 1) {
      onRegister?.(doses[0])
    } else {
      onRegisterAll?.(doses)
    }
  }

  return (
    <div
      role="region"
      aria-label="Dose prioritária"
      style={{
        background: 'linear-gradient(135deg, var(--color-secondary, #005db6), var(--color-secondary-container, #63a1ff))',
        borderRadius: 'var(--radius-card, 2rem)',
        padding: '1.5rem',
        color: '#ffffff',
        boxShadow: '0 8px 32px rgba(0, 93, 182, 0.25)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 'var(--radius-full, 9999px)',
          padding: '0.25rem 0.75rem',
          fontSize: 'var(--text-label-sm, 0.625rem)',
          fontWeight: 'var(--font-weight-bold, 700)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          ● Prioridade Máxima
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          fontSize: 'var(--text-title-lg, 1.125rem)',
          fontWeight: 'var(--font-weight-bold, 700)',
          fontFamily: 'var(--font-display, Public Sans, sans-serif)',
        }}>
          <Clock size={16} aria-hidden="true" />
          {nextTime}
        </span>
      </div>

      {/* Tempo relativo */}
      <p style={{
        margin: '0 0 1rem',
        fontSize: 'var(--text-body-lg, 1rem)',
        opacity: 0.85,
        fontFamily: 'var(--font-body, Lexend, sans-serif)',
      }}>
        {timeLabel}
      </p>

      {/* Lista de medicamentos */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {doses.map((dose) => (
          <li
            key={`${dose.protocolId}-${dose.scheduledTime}`}
            style={{ fontSize: 'var(--text-body-lg, 1rem)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0 }} aria-hidden="true" />
            <strong>{dose.medicineName}</strong>
            &nbsp;·&nbsp;{dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleCTA}
        aria-label={`Confirmar ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}
        style={{
          width: '100%',
          padding: '1rem',
          minHeight: '56px',
          background: 'rgba(255,255,255,0.95)',
          color: 'var(--color-secondary, #005db6)',
          border: 'none',
          borderRadius: 'var(--radius-button, 1.25rem)',
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-title-lg, 1.125rem)',
          fontWeight: 'var(--font-weight-bold, 700)',
          cursor: 'pointer',
          transition: 'all 200ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Confirmar Agora
      </button>
    </div>
  )
}
```

### Critério de conclusão Sprint 6.2
- [ ] `src/features/dashboard/components/PriorityDoseCard.jsx` criado
- [ ] Background: gradient `--color-secondary` → `--color-secondary-container`
- [ ] Badge "Prioridade Máxima" bg rgba branco/20
- [ ] Horário + tempo relativo ("Em X minutos" / "Agora")
- [ ] Lista de medicamentos com bullets circulares
- [ ] CTA "Confirmar Agora" — bg white, text secondary, `minHeight: 56px`
- [ ] Oculto quando `doses.length === 0`
- [ ] Ícone `Clock` importado de `'lucide-react'`

---

## Sprint 6.3 — CronogramaPeriodo

**Skill:** `/deliver-sprint`

### Arquivo a criar
- `src/features/dashboard/components/CronogramaPeriodo.jsx` (NOVO)

### Ícones a usar

```jsx
// Usar apenas Sun e Moon (confirmados em W1 icon mapping)
import { Sun, Moon, CheckCircle2, Circle } from 'lucide-react'

const PERIODS = [
  { id: 'morning',   label: 'Manhã',  Icon: Sun,  timeRange: [0,  12] },
  { id: 'afternoon', label: 'Tarde',  Icon: Sun,  timeRange: [12, 18] },
  { id: 'night',     label: 'Noite',  Icon: Moon, timeRange: [18, 24] },
]
```

### Implementação

```jsx
import { Sun, Moon, CheckCircle2, Circle } from 'lucide-react'

const PERIODS = [
  { id: 'morning',   label: 'Manhã',  Icon: Sun,  timeRange: [0,  12] },
  { id: 'afternoon', label: 'Tarde',  Icon: Sun,  timeRange: [12, 18] },
  { id: 'night',     label: 'Noite',  Icon: Moon, timeRange: [18, 24] },
]

function getHour(scheduledTime) {
  return parseInt(scheduledTime.split(':')[0], 10)
}

function CronogramaDoseItem({ dose, onRegister }) {
  const done = dose.isRegistered

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-lg, 1rem)',
        background: done ? 'transparent' : 'var(--color-surface-container-lowest, #ffffff)',
        boxShadow: done ? 'none' : 'var(--shadow-editorial, 0 4px 24px -4px rgba(25, 28, 29, 0.04))',
        opacity: done ? 0.55 : 1,
        transition: 'all 200ms ease-out',
      }}
    >
      {done
        ? <CheckCircle2 size={20} color="var(--color-primary, #006a5e)" aria-hidden="true" />
        : <Circle size={20} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
      }

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          fontSize: 'var(--text-body-lg, 1rem)',
          color: 'var(--color-on-surface, #191c1d)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {dose.medicineName}
        </div>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-md, 0.75rem)',
          color: 'var(--color-on-surface-variant, #3e4946)',
        }}>
          {dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''} · {dose.scheduledTime}
        </div>
      </div>

      {!done && (
        <button
          onClick={() => onRegister?.(dose)}
          aria-label={`Registrar dose de ${dose.medicineName}`}
          style={{
            padding: '0.5rem 0.875rem',
            minHeight: '36px',
            background: 'var(--color-primary, #006a5e)',
            color: 'var(--color-on-primary, #ffffff)',
            border: 'none',
            borderRadius: 'var(--radius-full, 9999px)',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-label-md, 0.75rem)',
            fontWeight: 'var(--font-weight-bold, 700)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 150ms ease-out',
          }}
        >
          TOMAR
        </button>
      )}
    </div>
  )
}

/**
 * CronogramaPeriodo — Cronograma de doses agrupado por Manhã/Tarde/Noite.
 *
 * @param {Array} allDoses — Todas as doses do dia (flat: late+now+upcoming+later+done)
 * @param {Function} onRegister — callback: onRegister(dose)
 */
export default function CronogramaPeriodo({ allDoses = [], onRegister }) {
  const grouped = PERIODS.map(({ id, label, Icon, timeRange }) => {
    const [start, end] = timeRange
    const doses = allDoses
      .filter((d) => {
        const h = getHour(d.scheduledTime)
        return h >= start && h < end
      })
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    return { id, label, Icon, doses }
  }).filter(({ doses }) => doses.length > 0)

  if (grouped.length === 0) return null

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      aria-label="Cronograma de doses de hoje"
    >
      {grouped.map(({ id, label, Icon, doses }) => (
        <section key={id} aria-label={`${label}: ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}>
          {/* Header do período */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.75rem', paddingLeft: '0.25rem',
          }}>
            <Icon size={16} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
            <h3 style={{
              margin: 0,
              fontFamily: 'var(--font-body, Lexend, sans-serif)',
              fontSize: 'var(--text-label-md, 0.75rem)',
              fontWeight: 'var(--font-weight-bold, 700)',
              color: 'var(--color-outline, #6d7a76)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {label}
            </h3>
            <span style={{
              marginLeft: 'auto',
              fontSize: 'var(--text-label-sm, 0.625rem)',
              color: 'var(--color-outline, #6d7a76)',
            }}>
              {doses.filter(d => d.isRegistered).length}/{doses.length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {doses.map((dose) => (
              <CronogramaDoseItem
                key={`${dose.protocolId}-${dose.scheduledTime}`}
                dose={dose}
                onRegister={onRegister}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

### Critério de conclusão Sprint 6.3
- [ ] `src/features/dashboard/components/CronogramaPeriodo.jsx` criado
- [ ] Ícones `Sun`, `Moon`, `CheckCircle2`, `Circle` importados de `'lucide-react'`
- [ ] Doses agrupadas por período (Manhã < 12h / Tarde 12-18h / Noite ≥ 18h)
- [ ] Períodos sem doses ocultados
- [ ] Header do período: ícone + label uppercase + contador X/Y doses
- [ ] Dose registrada: opacity 55%, CheckCircle2 verde, sem botão TOMAR
- [ ] Dose pendente: bg white, shadow, botão "TOMAR" primário verde
- [ ] `aria-label` nas seções
- [ ] Botão "TOMAR" tem `minHeight: 36px`

---

## Sprint 6.4 — StockAlertInline

**Skill:** `/deliver-sprint`

### Arquivo a criar
- `src/features/dashboard/components/StockAlertInline.jsx` (NOVO)

### Visual

Banner compacto de alerta de estoque no dashboard:

```
┌─ ⚠ ────────────────────────────────────┐
│  Estoque Crítico · Metformina          │
│  3 dias restantes                      │
│  ████░░░░░░ 10%                        │
│                     [Ver Estoque →]    │
└────────────────────────────────────────┘
```

### Implementação

```jsx
import { AlertTriangle } from 'lucide-react'

/**
 * StockAlertInline — Banner de alerta de estoque para o Dashboard redesenhado.
 *
 * @param {Array} criticalItems — items com stockStatus === 'critical' ou 'low'
 *   Shape: { medicineName: string, daysRemaining: number, stockStatus: 'critical'|'low' }
 * @param {Function} onNavigateToStock — Callback para navegar para Estoque
 */
export default function StockAlertInline({ criticalItems = [], onNavigateToStock }) {
  if (!criticalItems || criticalItems.length === 0) return null

  const sorted = [...criticalItems].sort((a, b) => a.daysRemaining - b.daysRemaining)
  const mostCritical = sorted[0]
  const isCritical = mostCritical.stockStatus === 'critical'

  const accentColor = isCritical
    ? 'var(--color-error, #ba1a1a)'
    : 'var(--color-tertiary, #7b5700)'

  const progressPct = Math.max(0, Math.min((mostCritical.daysRemaining / 30) * 100, 100))

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 'var(--radius-lg, 1rem)',
        padding: '1rem 1.25rem',
        background: isCritical
          ? 'color-mix(in srgb, var(--color-error, #ba1a1a) 8%, transparent)'
          : 'color-mix(in srgb, var(--color-tertiary-fixed, #ffdea8) 40%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertTriangle size={16} color={accentColor} aria-hidden="true" />
        <span style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          fontSize: 'var(--text-body-lg, 1rem)',
          color: accentColor,
        }}>
          {isCritical ? 'Estoque Crítico' : 'Estoque Baixo'}
          {criticalItems.length > 1
            ? ` · ${criticalItems.length} itens`
            : ` · ${mostCritical.medicineName}`
          }
        </span>
      </div>

      {/* Barra de progresso */}
      <div>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-md, 0.75rem)',
          color: 'var(--color-on-surface-variant, #3e4946)',
          marginBottom: '0.375rem',
        }}>
          {mostCritical.daysRemaining} dia{mostCritical.daysRemaining !== 1 ? 's' : ''} restante{mostCritical.daysRemaining !== 1 ? 's' : ''}
        </div>
        <div
          role="progressbar"
          aria-valuenow={mostCritical.daysRemaining}
          aria-valuemin={0}
          aria-valuemax={30}
          aria-label={`${mostCritical.medicineName}: ${mostCritical.daysRemaining} dias restantes`}
          style={{
            height: '8px',
            borderRadius: 'var(--radius-full, 9999px)',
            background: 'var(--color-surface-container-highest, #e1e3e4)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            borderRadius: 'var(--radius-full, 9999px)',
            background: accentColor,
            transition: 'width 1s ease-out',
          }} />
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => onNavigateToStock?.()}
        aria-label="Ir para controle de estoque"
        style={{
          alignSelf: 'flex-end',
          padding: '0.375rem 0.875rem',
          minHeight: '36px',
          background: 'transparent',
          color: accentColor,
          border: `1.5px solid ${accentColor}`,
          borderRadius: 'var(--radius-full, 9999px)',
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-md, 0.75rem)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 150ms ease-out',
        }}
      >
        Ver Estoque →
      </button>
    </div>
  )
}
```

### Critério de conclusão Sprint 6.4
- [ ] `src/features/dashboard/components/StockAlertInline.jsx` criado
- [ ] Oculto quando `criticalItems.length === 0`
- [ ] `border-left: 4px` colorido por severity (error/tertiary)
- [ ] Progresso calculado com máximo de 30 dias
- [ ] `role="progressbar"` com aria attributes corretos
- [ ] Ícone `AlertTriangle` de `'lucide-react'`
- [ ] CTA "Ver Estoque →" chama `onNavigateToStock`
- [ ] Ordena por `daysRemaining` (mais crítico primeiro)
- [ ] `color-mix()` para background tonal (sem rgba hardcoded)

---

## Sprint 6.5 — DashboardRedesign (View Principal)

**Skill:** `/deliver-sprint`

**Dependência:** Sprints 6.1-6.4 DEVEM estar completos (todos os componentes devem existir).

### Arquivo a criar
- `src/views/redesign/DashboardRedesign.jsx` (NOVO)
- Criar o diretório `src/views/redesign/` se não existir

**NÃO criar CSS separado** — usar classes de `layout.redesign.css` e tokens inline.

### Implementação

```jsx
import { useState, useEffect, useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useDoseZones } from '@dashboard/hooks/useDoseZones'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { getCurrentUser } from '@shared/utils/supabase'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import Loading from '@shared/components/ui/Loading'
import RingGaugeRedesign from '@dashboard/components/RingGaugeRedesign'
import PriorityDoseCard from '@dashboard/components/PriorityDoseCard'
import CronogramaPeriodo from '@dashboard/components/CronogramaPeriodo'
import StockAlertInline from '@dashboard/components/StockAlertInline'

/**
 * DashboardRedesign — View principal do Santuário Terapêutico.
 *
 * Compartilha TODA a lógica de dados com Dashboard.jsx.
 * Diferença: apenas a camada de apresentação.
 *
 * @param {Function} onNavigate — Callback de navegação (view, params?) => void
 */
export default function DashboardRedesign({ onNavigate }) {
  // ── Dados compartilhados (NÃO duplicar) ──
  const { stats, stockSummary, refresh, isLoading: contextLoading } = useDashboard()
  const { zones, totals } = useDoseZones()
  const { mode: complexityMode } = useComplexityMode()

  // ── Estado local ──
  const [userName, setUserName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [prefillData, setPrefillData] = useState(null)

  // ── Carregar nome do usuário ──
  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (user?.user_metadata?.full_name) {
          setUserName(user.user_metadata.full_name.split(' ')[0])
        } else if (user?.email) {
          setUserName(user.email.split('@')[0])
        }
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  // ── Computadas ──
  const allDoses = useMemo(() => [
    ...(zones.late    || []),
    ...(zones.now     || []),
    ...(zones.upcoming || []),
    ...(zones.later   || []),
    ...(zones.done    || []),
  ], [zones])

  const urgentDoses = useMemo(() => [
    ...(zones.late || []).filter(d => !d.isRegistered),
    ...(zones.now  || []).filter(d => !d.isRegistered),
  ], [zones])

  const criticalStockItems = useMemo(() => {
    if (!stockSummary?.items) return []
    return stockSummary.items.filter(
      (item) => item.stockStatus === 'critical' || item.stockStatus === 'low'
    )
  }, [stockSummary])

  // ── Handlers ──
  const handleRegisterDose = (dose) => {
    setPrefillData({
      protocol_id: dose.protocolId,
      medicine_id: dose.medicineId,
      medicine_name: dose.medicineName,
      scheduled_time: dose.scheduledTime,
      dosage_per_intake: dose.dosagePerIntake,
    })
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setPrefillData(null)
  }

  const handleLogSuccess = () => {
    setIsModalOpen(false)
    setPrefillData(null)
    refresh()
  }

  // ── Loading state ──
  if (isLoading || contextLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Loading text="Carregando..." />
      </div>
    )
  }

  const adherenceScore = stats?.adherenceScore ?? 0
  const streak = stats?.streak ?? 0
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div
      className="page-container"
      style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}
      aria-label="Dashboard — Meus Remédios"
    >
      {/* ─── 1. Header + Ring de Adesão ─── */}
      <header
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '1rem', marginBottom: '1.5rem', textAlign: 'center',
        }}
      >
        <RingGaugeRedesign
          score={adherenceScore}
          streak={streak}
          size={complexityMode === 'complex' ? 'medium' : 'large'}
        />

        <div>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-display, Public Sans, sans-serif)',
            fontSize: 'var(--text-headline-md, 1.75rem)',
            fontWeight: '700',
            color: 'var(--color-on-surface, #191c1d)',
            lineHeight: 1.2,
          }}>
            {userName ? `Olá, ${userName} 👋` : 'Olá! 👋'}
          </h1>

          <p style={{
            margin: '0.25rem 0 0',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-body-lg, 1rem)',
            color: 'var(--color-on-surface-variant, #3e4946)',
          }}>
            {today}
          </p>

          {totals.remaining > 0 && (
            <p style={{
              margin: '0.25rem 0 0',
              fontFamily: 'var(--font-body, Lexend, sans-serif)',
              fontSize: 'var(--text-body-lg, 1rem)',
              color: 'var(--color-outline, #6d7a76)',
            }}>
              {totals.remaining} dose{totals.remaining !== 1 ? 's' : ''} restante{totals.remaining !== 1 ? 's' : ''} hoje
            </p>
          )}

          {totals.remaining === 0 && totals.total > 0 && (
            <p style={{
              margin: '0.25rem 0 0',
              color: 'var(--color-primary, #006a5e)',
              fontWeight: '600',
              fontSize: 'var(--text-body-lg, 1rem)',
            }}>
              ✅ Todas as doses registradas!
            </p>
          )}
        </div>
      </header>

      {/* ─── 2. Alerta de Estoque Crítico ─── */}
      {criticalStockItems.length > 0 && (
        <section style={{ marginBottom: '1.25rem' }} aria-label="Alertas de estoque">
          <StockAlertInline
            criticalItems={criticalStockItems}
            onNavigateToStock={() => onNavigate?.('stock')}
          />
        </section>
      )}

      {/* ─── 3. Dose Prioritária ─── */}
      {urgentDoses.length > 0 && (
        <section style={{ marginBottom: '1.25rem' }} aria-label="Dose prioritária">
          <PriorityDoseCard
            doses={urgentDoses.slice(0, 3)}
            onRegister={handleRegisterDose}
            onRegisterAll={(doses) => handleRegisterDose(doses[0])}
          />
        </section>
      )}

      {/* ─── 4. Cronograma do Dia ─── */}
      {allDoses.length > 0 && (
        <section aria-label="Cronograma de hoje">
          <h2 style={{
            margin: '0 0 1rem',
            fontFamily: 'var(--font-display, Public Sans, sans-serif)',
            fontSize: 'var(--text-title-lg, 1.125rem)',
            fontWeight: '600',
            color: 'var(--color-on-surface, #191c1d)',
          }}>
            Cronograma de Hoje
          </h2>
          <CronogramaPeriodo allDoses={allDoses} onRegister={handleRegisterDose} />
        </section>
      )}

      {/* ─── 5. Empty state ─── */}
      {allDoses.length === 0 && !contextLoading && (
        <div
          style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-outline, #6d7a76)' }}
          role="status"
        >
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💊</p>
          <p style={{ fontFamily: 'var(--font-body, Lexend, sans-serif)', fontSize: 'var(--text-body-lg, 1rem)' }}>
            Nenhuma dose agendada para hoje.
          </p>
          <button
            onClick={() => onNavigate?.('medicines')}
            style={{
              marginTop: '1rem', padding: '0.75rem 1.5rem', minHeight: '48px',
              background: 'var(--gradient-primary, linear-gradient(135deg, #006a5e, #008577))',
              color: '#ffffff', border: 'none',
              borderRadius: 'var(--radius-button, 1.25rem)',
              fontFamily: 'var(--font-body, Lexend, sans-serif)',
              fontWeight: '600', cursor: 'pointer',
            }}
          >
            Adicionar Medicamento
          </button>
        </div>
      )}

      {/* ─── Modal de Registro de Dose ─── */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose} title="Registrar Dose">
        <LogForm
          prefillData={prefillData}
          onSuccess={handleLogSuccess}
          onCancel={handleModalClose}
        />
      </Modal>
    </div>
  )
}
```

### Critério de conclusão Sprint 6.5
- [ ] `src/views/redesign/` diretório criado
- [ ] `src/views/redesign/DashboardRedesign.jsx` criado
- [ ] Importa hooks compartilhados: `useDashboard`, `useDoseZones`, `useComplexityMode`
- [ ] Importa componentes redesign: `RingGaugeRedesign`, `PriorityDoseCard`, `CronogramaPeriodo`, `StockAlertInline`
- [ ] Importa componentes compartilhados: `Modal`, `LogForm`, `Loading`
- [ ] Modal + LogForm com padrão idêntico ao Dashboard.jsx original
- [ ] Ring no topo + saudação personalizada
- [ ] StockAlertInline aparece apenas quando `criticalStockItems.length > 0`
- [ ] PriorityDoseCard aparece apenas quando `urgentDoses.length > 0`
- [ ] CronogramaPeriodo com todas as doses
- [ ] Empty state com CTA para medicines
- [ ] `Dashboard.jsx` NÃO foi modificado: `git diff src/views/Dashboard.jsx` deve ser vazio

---

## Sprint 6.6 — App.jsx: Branching do Dashboard

**Skill:** `/deliver-sprint`

**Dependência OBRIGATÓRIA:** Sprint 6.5 DEVE estar completo (`src/views/redesign/DashboardRedesign.jsx` DEVE existir antes de executar este sprint).

> ⚠️ **RAZÃO DA ORDEM:** Vite valida paths de `lazy(() => import(...))` durante o build. Se `DashboardRedesign.jsx` não existir, o build falha com "Could not resolve module". Por isso, o App.jsx só é atualizado DEPOIS da view existir.

### Arquivo a modificar
- `src/App.jsx`

### Mudanças em App.jsx

**1. Verificar se o arquivo existe antes de modificar:**
```bash
ls src/views/redesign/DashboardRedesign.jsx
# Deve retornar o arquivo. Se não existir, PARAR e executar Sprint 6.5 primeiro.
```

**2. Adicionar lazy import (após os outros lazy imports no topo):**
```jsx
const DashboardRedesign = lazy(() => import('./views/redesign/DashboardRedesign'))
```

**3. Modificar o case 'dashboard' no switch de `renderCurrentView()`:**

Localizar:
```jsx
case 'dashboard':
default:
  return (
    <Dashboard
      onNavigate={(view, params) => {
        if (view === 'stock' && params?.medicineId) {
          setInitialStockParams({ medicineId: params.medicineId })
        } else if (view === 'protocols' && params?.medicineId) {
          setInitialProtocolParams({ medicineId: params.medicineId })
        }
        setCurrentView(view)
      }}
    />
  )
```

Substituir por:
```jsx
case 'dashboard':
default: {
  const dashboardNavigate = (view, params) => {
    if (view === 'stock' && params?.medicineId) {
      setInitialStockParams({ medicineId: params.medicineId })
    } else if (view === 'protocols' && params?.medicineId) {
      setInitialProtocolParams({ medicineId: params.medicineId })
    }
    setCurrentView(view)
  }
  return isRedesignEnabled ? (
    <Suspense fallback={<ViewSkeleton />}>
      <DashboardRedesign onNavigate={dashboardNavigate} />
    </Suspense>
  ) : (
    <Dashboard onNavigate={dashboardNavigate} />
  )
}
```

### Critério de conclusão Sprint 6.6
- [ ] `src/views/redesign/DashboardRedesign.jsx` JÁ EXISTE (pré-requisito verificado)
- [ ] `DashboardRedesign` importado com `lazy()` em App.jsx
- [ ] Case `'dashboard'` seleciona view via `isRedesignEnabled`
- [ ] `DashboardRedesign` e `Dashboard` recebem o MESMO `onNavigate`
- [ ] Usuários SEM flag: `Dashboard.jsx` original continua funcionando identicamente
- [ ] `npm run build` sem erros (valida que o lazy import resolve corretamente)
- [ ] `npm run validate:agent` passa

---

## Checklist Final Wave 6

### Verificações de arquivo

```bash
# Devem existir:
ls src/views/redesign/DashboardRedesign.jsx
ls src/features/dashboard/components/RingGaugeRedesign.jsx
ls src/features/dashboard/components/PriorityDoseCard.jsx
ls src/features/dashboard/components/CronogramaPeriodo.jsx
ls src/features/dashboard/components/StockAlertInline.jsx

# NÃO devem ter sido modificados:
git diff src/views/Dashboard.jsx
git diff src/features/dashboard/components/RingGauge.jsx
git diff src/features/dashboard/components/DoseZoneList.jsx
git diff src/features/dashboard/components/StockBars.jsx
```

### Smoke test com flag OFF
- [ ] Dashboard.jsx original carrega sem erros
- [ ] Visual idêntico ao estado anterior a esta wave
- [ ] Registro de dose funciona (modal abre e fecha)
- [ ] Navegação para outros views funciona

### Smoke test com flag ON (`?redesign=1`)
- [ ] DashboardRedesign carrega sem erros JS no console
- [ ] Ring gauge com cores sanctuary (azul track, verde-água progress)
- [ ] Saudação com nome do usuário + data localizada
- [ ] PriorityDoseCard visível (se há doses urgentes)
- [ ] CronogramaPeriodo com doses agrupadas por Manhã/Tarde/Noite
- [ ] Botão "TOMAR" abre modal de registro de dose
- [ ] Registro bem-sucedido: modal fecha + dados são atualizados
- [ ] StockAlertInline visível (se há itens críticos/baixos)
- [ ] Botão "Ver Estoque →" navega para view de stock
- [ ] Empty state quando sem doses agendadas

### Testes e qualidade
- [ ] `npm run validate:agent` passa (≥539 testes, 0 erros lint)
- [ ] `npm run build` sem erros
- [ ] `DashboardRedesign` bundled em chunk separado (lazy-loaded)
- [ ] PR criado aguardando review Gemini Code Assist

---

## Referências

- `plans/redesign/MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md` — seção 11 (Wave 6)
- `src/views/Dashboard.jsx` — lógica de referência (modal, dados, navigation)
- `src/features/dashboard/hooks/useDoseZones.js` — estrutura de zones
- `src/features/dashboard/hooks/useDashboardContext.jsx` — dados compartilhados
- `src/shared/styles/layout.redesign.css` — classes `.page-container`, `.grid-dashboard`
- `src/shared/styles/tokens.redesign.css` — CSS custom properties
