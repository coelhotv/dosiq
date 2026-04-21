# Product Strategy — Dosiq (Consolidated)

> Source of truth for all visual, narrative, and motion decisions. This document consolidates the best of both strategy proposals, creating a single, actionable blueprint.
> Read this before designing or coding any screen. Reference it when validating pages.
> Last updated: 2026-03-26

---

## Visual Thesis

**"A Brazilian therapeutic sanctuary: calm, editorial, and legible. A layered, breathable space where sensitive clinical data is presented with soft contrast, clear hierarchy, and enough human warmth to reduce anxiety without appearing childish. It earns trust through extreme legibility and zero cognitive noise."**

The product must feel like a premium health journal, not a medical software tool. Every screen should communicate calm, competence, and care. If a screen looks busy, reduce it. If it looks generic, anchor it to the Verde Saúde identity.

---

## Personas & Complexity Tiers

Two distinct user journeys share one design language:

| Persona | Profile | Complexity | Priority UX Goal |
|---------|---------|------------|-----------------|
| **Dona Maria** | Elderly, 1–3 medications, low tech literacy | **Simple** | Legibility, 1-tap actions, no overwhelm |
| **Carlos** | Complex conditions, multiple protocols, health-literate | **Complex** | Data density, protocol grouping, analytics |

**Design rule:** Simple view is the default. Complex features must not increase cognitive load for simple users. The system must gracefully guide users from the Simple to the Complex view based on their evolving needs.

---

## Dichotomous Design Philosophy

> This is the most important design decision in the product. Read it before touching any screen.

The two personas don't just have different needs — they have fundamentally different **mental models** for the app. The UI must reflect this at every level: layout, information density, component shape, and copy tone.

### The Two Design Languages

| Dimension | Dona Maria — "Card Deck" | Carlos — "Control Panel" |
|-----------|--------------------------|--------------------------|
| **Mental model** | "What do I do right now?" | "How is my treatment performing?" |
| **Primary job** | Act | Monitor |
| **Layout metaphor** | Pinterest deck — tactile, browsable cards | Dashboard panel — tabular, scannable, comparable |
| **Desktop layout** | 2-column card grid, cards anchored top (`align-items: start`) | Multi-column table grid, rows aligned horizontally |
| **Mobile layout** | Full-width stacked cards | Same cards, but with denser info per card |
| **Data philosophy** | **Prioritized hierarchy** — right data, high contrast | **Density** — all data, equal weight, comparable |
| **Adherence display** | Human label: "Tratamento em dia", "Algumas doses perdidas" | Numeric bar: 93% + 7-day fill bar |
| **Stock display** | Calendar icon + days (semantic: is this urgent?) | Same pill, same icon — universal pattern |
| **CTA prominence** | Maximum — "TOMAR AGORA" fills card width, 64px tall | Present but secondary — inline, contextual |
| **Empty states** | Encouraging, action-oriented | Informational, data-forward |

### The Key Distinction: Prioritized vs Dense

A common mistake is to define Simple mode as "less data." That is wrong. Dona Maria doesn't want fewer data points — she wants **the right data, with the right hierarchy**. The scheduled time shown at 32px is not less data than a 12px percentage; it is the same data, re-prioritized. The label "Tratamento em dia" carries more decision-support than "93%" for a non-technical user.

Carlos doesn't want more data either — he wants **density and comparability**. He needs to scan across 6 protocols and spot which one is underperforming. Tabular layout serves him because it aligns the same data type vertically, enabling comparison.

**Rule: never reduce Dona Maria's data. Reprioritize it. Never overwhelm Carlos with decoration. Give him structure.**

### Per-Screen Application

| Screen | Dona Maria | Carlos |
|--------|------------|--------|
| **Dashboard (Hoje)** | PriorityDoseCard prominent, large CTA, cronograma as schedule reference | PriorityDoseCard + ring gauge + full cronograma with period accordion |
| **Tratamentos** | 2-col card grid on desktop, each card: name+badge / intake / schedule+label | Tabular grid: name\|schedule\|adherence bar\|stock pill per row |
| **Estoque** | (future) Card per medicine, large stock indicator, single reorder CTA | (future) Table view, all medicines, sortable columns |

### Validation Questions (per screen, per decision)

Before shipping any component change, answer:
1. In Simple mode: is the primary action reachable within 2 taps?
2. In Simple mode: does every data point shown drive a decision or action?
3. In Complex mode: can the user compare across rows/protocols without scrolling horizontally?
4. In Complex mode: does adding a new data point create a new column, not a new card?
5. Does the same component work for both — or does it need a deliberate split?

---

## Progressive Disclosure & The User Journey

The transition from a simple treatment plan to a complex one is a critical moment in the user experience. The UI must not abruptly change; it must guide the user, teaching them about new capabilities as they become relevant. This is the principle of Progressive Disclosure.

### Triggers for Increased Complexity

The UI should remain in "Simple Mode" by default. It transitions to "Complex Mode" or introduces new elements based on specific, non-ambiguous triggers. These include, but are not limited to:
- A user adds more than 3 active medications.
- A user's treatment includes at least one medication with a titration schedule (varying doses over time).
- A user manually enables an "advanced" or "detailed" view in the application settings.
- A user adds a medication that requires frequent monitoring (e.g., blood glucose).

### The Escalation Path: Guiding, Not Overwhelming

When a trigger is met, the UI follows a clear path to introduce complexity.

| Path Level | State | UI Pattern | Example Scenario |
| :--- | :--- | :--- | :--- |
| **Level 1** | **Default Simple** | The clean, "Dona Maria" interface. Minimal data, large touch targets, single-action focus. | A user is managing 1-2 medications with fixed daily doses. |
| **Level 2** | **Introductory** | When a complexity trigger is met, the app introduces **one** new UI element at a time using a dismissible tooltip, a spotlight overlay, or a simple, one-time modal. The copy must be encouraging and explain the benefit. | User adds a medication with a titration schedule. The next time they visit the "Tratamentos" screen, a tooltip points to the new titration chart: *"Novo! Adicionamos um gráfico para ajudar você a acompanhar suas doses variáveis."* |
| **Level 3** | **Opt-In Complex** | After introduction, the new element remains. The user is now implicitly in "Complex Mode" for that screen. The system may offer a way to hide the element again via a "Ver menos detalhes" (See less detail) toggle. | The titration chart is now a permanent part of the user's "Tratamentos" screen. Other complex elements may appear as more triggers are met. |

This gradual escalation ensures that users like Dona Maria are not overwhelmed. They only see new complexity when their own actions require it, and they are taught what it means in context.

---

## Content Plan Template

This structure governs every page in the product. Each section has exactly one job.

| Section | Job | What Goes Here |
|---------|-----|---------------|
| **Hero / Header** | Orient | "Olá, [Nome]" + today's adherence snapshot or page title |
| **Primary Action Zone** | Act | The one thing users must do now (take dose, check stock, add med) |
| **Status / Progress** | Prove | Ring gauge, stock bar, protocol list — current health state |
| **Detail / Context** | Deepen | Historical trend, titration schedule, health tip, last purchase |
| **CTA / Alert** | Convert or Warn | Critical stock alert, buy button, confirm dose |

**Per-page application:**

- **Dashboard (Hoje):** Hero = greeting + ring gauge. Primary = medication list (take/confirm). Detail = stock alerts.
- **Tratamentos:** Hero = protocol title + tabs (Ativos/Pausados/Finalizados). Primary = active protocols. Detail = titration timeline.
- **Estoque:** Hero = critical alert banner (when applicable). Primary = current stock list with color bars. Detail = purchase history.
- **Perfil / Settings:** No hero. Flat utility layout, no visual drama.

---

## Motion Language

All motion serves UX, not decoration. Three archetypes — ship all three per page.

### 1. Entrance — "Cascade Reveal"
Content enters on mount with staggered fade + translate:
```
initial:  { opacity: 0, y: 10 }
animate:  { opacity: 1, y: 0 }
transition: { duration: 0.3, ease: "easeOut" }
stagger:  0.1s delay per list item (index × 0.1)
```
Apply to: medication list items, protocol cards, stock rows, stat widgets.

### 2. Progress — "Living Fill"
Animated width/stroke-dashoffset transitions on all progress indicators:
```
Ring gauge progress:    strokeDashoffset 0 → calculated, 1000ms, 0.5s delay
Stock progress bars:    width 0% → calculated%, 1000ms, ease-out
Adherence ring fill:    primary_fixed color, GPU-composited via stroke animation
```
Apply to: RingGauge SVG, stock level bars, protocol adherence indicators.

### 3. Page Transition — "Soft Handoff"
AnimatePresence mode="wait" on all view switches:
```
enter:  { opacity: 0, y: 10 } → { opacity: 1, y: 0 }, 300ms
exit:   { opacity: 1 } → { opacity: 0 }, 150ms
```
Apply to: every view swap in the nav system.

### 4. Interaction Feedback — "Tactile Press"
All buttons and tappable cards:
```
hover:  scale(1.02), 200ms ease-out
active: scale(0.98), 100ms ease-out
```
Apply to: primary buttons, medication list items, stock cards.

### Performance Rules
- GPU-only: use `transform` + `opacity` exclusively. Never animate `width`, `height`, or `margin` directly — use `scaleX` or clip-path instead.
- Max duration 400ms for interactions, 1000ms for data fills.
- All Framer Motion variants must include `prefers-reduced-motion` fallback (use `useReducedMotion()` hook).
- Test on real mobile devices — 60fps is non-negotiable.

---

## Color System

Material 3–inspired tonal architecture. The "No-Line" rule applies everywhere: **never use 1px borders to separate content** — use background color tier shifts instead.

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#006a5e` | Primary CTAs, active nav, ring track fill, gradient start |
| `primary-container` | `#008577` | Gradient end for primary actions (135° linear) |
| `primary-fixed` | `#90f4e3` | Ring gauge progress stroke, highlight badges, "taken" indicator |
| `secondary` | `#005db6` | Supporting actions, ring track background, secondary progress |
| `secondary-fixed` | `#d6e3ff` | Icon container backgrounds, list leading circles |
| `tertiary` | `#ffdea8` | Warm highlights, "Novo" badges, positive status |
| `error` | `#ba1a1a` | Critical alerts, low-stock bars (<20%), emergency CTAs |

### Surface Hierarchy (Depth via Tones, Not Shadows)

| Level | Token | Hex | Usage |
|-------|-------|-----|-------|
| 0 — Base | `surface` | `#f8fafb` | Page background |
| 1 — Sections | `surface-container-low` | `#f2f4f5` | Section backgrounds, alternate rows |
| 2 — Cards | `surface-container-lowest` | `#ffffff` | Interactive cards, active content, highest contrast |

### Text & Borders

| Token | Value | Usage |
|-------|-------|-------|
| `on-surface` | `#191c1d` | All body text (never pure `#000000`) |
| `outline-variant` | `rgba(25,28,29,0.15)` | Ghost borders (accessibility only, not default) |
| Muted text | `#191c1d` at 40% opacity | Secondary labels, timestamps, disabled states |

### Glassmorphism (Floating Elements)

Navigation bars, FABs, and overlays:
```css
background: rgba(248, 250, 251, 0.80); /* surface at 80% */
backdrop-filter: blur(12px);
```

### Gradient Signature

All primary action buttons and key CTAs:
```css
background: linear-gradient(135deg, #006a5e, #008577);
box-shadow: 0 8px 24px rgba(0, 106, 94, 0.20);
```

### Constraint

Max 2 accent colors per screen (primary + one semantic). Never use `#000000` for text. Never use border-color alone to separate content.

---

## Typography System

### Fonts

| Role | Font | Why |
|------|------|-----|
| **Display / Headlines** | **Public Sans** | Bold, authoritative, editorial weight — "Clinical Authority" |
| **Body / UI Text** | **Lexend** | Designed to reduce cognitive noise; proven readability for elderly users |

No monospace font in the app interface. Timestamps and data use Lexend at regular weight.

### Weight Rule

**Never below weight 400.** Thin fonts cause eye strain for elderly users. Use these weights only:
- 400 — Body, secondary text, descriptions
- 500 — UI labels, section headers
- 600 — Medication names, primary reading paths
- 700 — Headlines, display text, ring center percentage

### Type Scale

```
display-md:   Public Sans 700,  clamp(2rem, 4vw, 3rem)    — Patient name, major milestones
headline-md:  Public Sans 700,  1.75rem / 1.1              — Ring gauge center %, modal titles
title-lg:     Lexend     600,   1.125rem / 1.4             — Medication names, protocol titles
title-sm:     Lexend     600,   0.875rem / 1.4             — Section headers, tab labels
body-lg:      Lexend     400,   1rem / 1.6                 — Instructions, body copy
label-md:     Lexend     600,   0.75rem / 1.5              — Icon labels, status badges
label-sm:     Lexend     500,   0.625rem / 1.4             — Nav labels, mini timestamps
```

### Line Width

Max 65–70 characters per line for reading comfort. Use `max-w-prose` or equivalent.

---

## Spacing & Layout

### Spacing Scale (rem)

| Scale | Value | Primary Use |
|-------|-------|-------------|
| 1 | 0.25rem | Tight inline spacing |
| 2 | 0.5rem | Icon-to-label gap |
| 3 | 1rem | Between list items (no dividers) |
| 4 | 1.4rem | **Visual Silo** — between content blocks |
| 6 | 1.5rem | Card inner padding (compact) |
| 8 | 2rem | Standard card padding |
| 12 | 3rem | Section spacing, hero bottom padding |

### Grid

- Mobile: Single column, `p-4` page padding
- Desktop: 3-column (`grid-cols-3 gap-6`) for dashboards; 2-column for stock/treatments
- Max-width container: `max-w-7xl mx-auto px-8`
- **Intentional asymmetry:** Push key headlines left. Allow white space to breathe on the right. This creates the natural left-to-right scanning path optimized for seniors.

### Border Radius Rules

Never use `sm` or `xs`. Minimum radius = `md` (0.75rem).

| Use | Radius |
|-----|--------|
| Buttons | `xl` (1.25rem) or `full` |
| Large cards / sanctuary containers | `2rem` (32px) |
| Standard cards | `lg` (1rem) |
| Progress bars, badges | `full` |
| Icon containers | `full` |

---

## Component Specifications

### Component Evolution: Simple to Complex

Components must be designed to adapt to the user's complexity level. They should not be static. This evolution is key to the Progressive Disclosure strategy.

- **List Items:**
    - **Simple:** A simple row with medication name, dosage, and a "take" button. Large, clear, and focused.
    - **Complex:** The same row can expand to include adherence trend micro-charts, stock status, or the name of the protocol it belongs to. This additional data is only shown when a complexity trigger is met.

- **Dashboard (`Hoje` screen):**
    - **Simple:** A single, large `RingGauge` for overall daily adherence.
    - **Complex:** The single ring may be replaced by multiple smaller rings, one for each protocol, allowing the "Carlos" persona to track adherence across different treatments simultaneously.

- **Cards (`Sanctuary Style`):**
    - **Simple:** Cards are used sparingly, perhaps only for critical alerts.
    - **Complex:** Cards become the primary container for grouping complex data, such as a "Protocol Card" that contains multiple medications, charts, and notes related to a single treatment plan.

This adaptability ensures that the UI density and functionality scale with the user's needs, not before.

### RingGauge (Adherence Visualization)

```
Stroke width:   12pt (thick ring, legible at small sizes)
Track color:    secondary (#005db6)
Progress color: primary-fixed (#90f4e3)
Center content: percentage in headline-md (Public Sans 700)
Label:          "adesão" or protocol name in label-md
Animation:      stroke-dashoffset, 1000ms, 0.5s delay
```

### 1-Tap Action Button

```
Height:         64px minimum
Padding:        32px horizontal
Background:     primary → primary-container gradient at 135°
Shadow:         0 8px 24px rgba(0,106,94,0.2)
Border-radius:  xl (1.25rem) or full
Font:           Lexend 700 1.125rem
Hover:          scale(1.02) + shadow intensify
Active:         scale(0.98)
All targets ≥ 56px tall (motor accessibility)
```

### Cards (Sanctuary Style)

```
Background:     surface-container-lowest (#ffffff)
Shadow:         0 24px 24px rgba(25,28,29,0.04) — ambient only
Border:         none (no 1px borders — ever)
Border-radius:  2rem (32px) for primary cards
Padding:        p-8 (2rem)
Transition:     all 300ms ease-out
```

### Stock Progress Bar

```
Height:         8px, border-radius: full
Normal:         secondary (#005db6)
Low (<20%):     error (#ba1a1a) — psychological urgency trigger
Animation:      width 0 → %, 1000ms ease-out, 0.5s delay
```

### Lists (No Dividers)

```
Row spacing:    Spacing 3 (1rem) between items
Row alternation: surface-container-low (even) / surface (odd)
Leading icon:   secondary-fixed (#d6e3ff) circle container, full radius
Icon + label:   Always paired (never icon alone)
```

### Glassmorphic Navigation

```
Mobile:  Fixed bottom bar, 4 icons + labels
Desktop: Fixed left sidebar
Style:   bg-surface/80 backdrop-blur-[12px]
Active:  text-primary scale-110
Inactive: text-on-surface/40
Icons:   Always paired with label-md text
```

---

## Imagery Charter

### Style & Tone

This is a **product UI, not a marketing site.** Imagery is UI, not decoration.

- No full-bleed photography in app surfaces. Use illustration-style icons and SVG visuals.
- App surfaces use color blocks, progress visualizations, and tonal cards — not photographs.
- Landing page (if applicable): warm, documentary-style photography of real people managing health. Never stock images with forced smiles or sterile hospital environments.
- Logo mark: Blue pill box + white heartbeat graph — paired with "Dosiq" wordmark in Public Sans.

### Icon System

From the Iconografia guide (mandatory reference):

| Category | Icons | Style |
|----------|-------|-------|
| Navigation | Hoje, Tratamentos, Estoque, Saúde, Perfil | Outlined stroke, consistent weight |
| Status | Concluído (green), Pendente (amber), Estoque Baixo (red) | Color-coded + label always |
| Actions | Adicionar, Registrar, Comprar, Compartilhar | Outlined, 24px base size |
| Med types | Cápsula, Injeção, Tópico, Líquido, Comprimido | Outlined, category-grouped |

**Icon rules:**
- Always pair icon + `label-md` text. No icon-only affordances.
- Size: 24px base, 20px in dense lists, 28px in primary nav.
- Color: Inherit from context (active = primary, inactive = on-surface/40, alert = error).

---

## Copy Tone & Voice

### Voice Characteristics

- **Warm and direct.** Like a knowledgeable friend, not a clinical software message.
- **Brazilian Portuguese throughout UI.** No English in user-facing text.
- **Formality:** Balanced. Use "você" implicitly. Address by first name in greetings.
- **Brevity:** Every label, alert, and button must work in one scan. No long explanations in UI.

### Product Language Examples

### Tone by Context

| Context | Tone | Example |
| :--- | :--- | :--- |
| Greeting | Warm, personal | "Olá, Dona Maria 👋" |
| Adherence success | Positive reinforcement | "Você está indo bem — 85% essa semana" |
| Critical alert | Urgent but calm | "Reposição Crítica: Metformina termina em 3 dias" |
| Empty state | Encouraging | "Nenhum medicamento registrado ainda. Comece aqui." |
| Action buttons | Direct imperative | "Registrar Dose", "Comprar Agora", "Ver Histórico" |

| Instead of | Use this |
| :--- | :--- |
| "Otimização terapêutica" | "Seu tratamento em dia" |
| "Solução inovadora de adesão" | "Registre suas doses sem esquecer" |
| "Gestão farmacológica avançada" | "Controle seus medicamentos" |
| "Experiência premium de saúde" | "Mais clareza para cuidar da sua saúde" |


### Forbidden Words/Phrases
- ❌ “disruptivo”, “revolucionário”, “next-gen”, “plataforma”
- ❌ Jargão técnico sem ganho cognitivo para o usuário
- ❌ Humor, ironia ou exagero em alertas clínicos
- ❌ Passive voice in CTAs: "Dose pode ser registrada" → use "Registrar Dose"
- ❌ Filler words in empty states: "Não há dados disponíveis neste momento" → "Nenhum dado ainda"

---

## Do's and Don'ts

**Do**
- ✅ Use verde como fio condutor de confiança e ação.
- ✅ Tratar métricas de adesão e estoque como sinais de cuidado, não gamificação vazia.
- ✅ Manter muito espaço em branco e alinhamento firme.
- ✅ Escrever como produto de uso diário, não como campanha publicitária.
- ✅ Separar prioridades por tom de superfície antes de adicionar bordas.

**Don't**
- ❌ Não transformar a interface em grade genérica de cards SaaS.
- ❌ Não usar bordas de 1px como estrutura dominante.
- ❌ Não saturar a tela com azul, vermelho e amarelo simultaneamente.
- ❌ Não esconder significado crítico só em ícones.
- ❌ Não usar dashboards chamativos em áreas que deveriam transmitir serenidade.

---

## Litmus Checks

- A prioridade da tela está visível nos primeiros 3 segundos?
- O CTA principal é inequívoco?
- O layout continua claro sem sombras decorativas?
- A mesma tela funciona para alguém cansado, ansioso ou com leitura mais lenta?
- O produto parece cuidado de saúde confiável, e não software administrativo?
- A versão complexa continua serena mesmo com mais informação?
- A versão simples evita parecer simplória ou infantilizada?

---

## Accessibility Baseline

Non-negotiable. Ship these from day one.

### Color & Contrast

- [x] `on-surface` (#191c1d) on `surface` (#f8fafb) = WCAG AAA compliant
- [x] Primary (#006a5e) on white = passes WCAG AA
- [x] Error (#ba1a1a) on white = passes WCAG AA
- [ ] Test all text-over-gradient combinations (primary buttons: white text on gradient)
- [ ] Never use color as the only indicator (stock bars: color + text label required)

### Touch & Motor

- [x] All interactive targets ≥ 56px tall (tremor accommodation)
- [x] Primary buttons 64px height
- [x] Minimum 8px gap between adjacent touch targets
- [ ] Test on real devices with large text system setting enabled

### Keyboard Navigation

- [ ] All interactive elements reachable via Tab
- [ ] Focus ring: 2px solid primary (#006a5e), visible on all backgrounds
- [ ] Modal/drawer: trap focus within open state, release on close

### Motion

- [ ] All Framer Motion animations check `useReducedMotion()` — static fallback provided
- [ ] No content flashes >3x per second
- [ ] Progress bar animations are cosmetic — data is visible without animation

### Icons & Images

- [x] Every icon paired with text label (mandatory per design system)
- [ ] All decorative icons use `aria-hidden="true"`
- [ ] App icon SVG has accessible title

### Semantic HTML

- [ ] `<main>`, `<nav>`, `<section>` used correctly
- [ ] Heading hierarchy: `<h1>` per page → `<h2>` sections → `<h3>` subsections
- [ ] Buttons are `<button>`, not `<div onClick>`
- [ ] Form inputs have visible `<label>` (not placeholder only)

---

## Dark Mode

Currently **not supported** (Phase 6 roadmap). When implemented:

- Do not invert colors — redesign per surface tier.
- Dark surface baseline: `#0f1117` (not pure black).
- Primary (#006a5e) may need lightness shift to pass AA on dark background — test before shipping.
- Glassmorphism effect: invert to `rgba(15,17,23,0.80)` backdrop.

---

## Implementation Checklist

Before coding any screen, validate against this strategy:

**Visual:**
- [ ] Does the first viewport communicate Verde Saúde identity within 3 seconds?
- [ ] Is there exactly one dominant visual anchor per section?
- [ ] Are there any 1px borders that should be tonal shifts instead?
- [ ] Are cards actually necessary, or can layout + spacing suffice?
- [ ] Are all border-radii ≥ 0.75rem?

**Motion:**
- [ ] Does the page use Cascade Reveal for list items?
- [ ] Does the page use Living Fill for progress indicators?
- [ ] Does the page use Soft Handoff for view transitions?
- [ ] Is `useReducedMotion()` respected?

**Copy:**
- [ ] Are all user-facing strings in Brazilian Portuguese?
- [ ] Do all CTAs use direct imperative form?
- [ ] Are empty states encouraging and action-oriented?

**Accessibility:**
- [ ] Are all interactive targets ≥ 56px?
- [ ] Are all icons paired with text labels?
- [ ] Does the page pass WCAG AA color contrast?
- [ ] Is the heading hierarchy logical?

**Performance:**
- [ ] Is this view lazy-loaded with React.lazy + Suspense + ViewSkeleton?
- [ ] Are all animations GPU-composited (transform + opacity only)?

---

## Related Files

| File | Purpose |
|------|---------|
| `new_designs/DESIGN-SYSTEM.md` | Full component specs and design philosophy |
| `new_designs/REFERENCE.md` | Product features and stack overview |
| `new_designs/iconografia_meus_remedios.png` | Complete icon system (mandatory reference) |
| `new_designs/design-system.png` | Visual color/type/component reference |
| `new_designs/meus-remédios---simple-treatments/` | React prototype — Dona Maria persona |
| `new_designs/meus-remédios---complex-treatments/` | React prototype — Carlos persona |
| `src/shared/styles/` | Production CSS tokens |
| `docs/standards/MOBILE_PERFORMANCE.md` | Lazy loading and performance standards |
| `.memory/rules.md` | Project-level positive patterns |
| `.memory/anti-patterns.md` | Known pitfalls to avoid |
