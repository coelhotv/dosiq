# Product Strategy — Meus Remédios

> Source of truth for all visual, narrative, and motion decisions.
> Read this before designing or coding any screen. Reference it when validating pages.
> Last updated: 2026-03-23

---

## Visual Thesis

**"A therapeutic sanctuary — editorial warmth and clinical precision in a breathable, layered space that earns trust through extreme legibility and zero cognitive noise."**

The product must feel like a premium health journal, not a medical software tool. Every screen should communicate calm, competence, and care. If a screen looks busy, reduce it. If it looks generic, anchor it to the Verde Saúde identity.

---

## Personas & Complexity Tiers

Two distinct user journeys share one design language:

| Persona | Profile | Complexity | Priority UX Goal |
|---------|---------|------------|-----------------|
| **Dona Maria** | Elderly, 1–3 medications, low tech literacy | **Simple** | Legibility, 1-tap actions, no overwhelm |
| **Carlos** | Complex conditions, multiple protocols, health-literate | **Complex** | Data density, protocol grouping, analytics |

**Design rule:** Simple view is the default. Complex features must not increase cognitive load for simple users — gate them behind protocol/titration flows.

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
- Logo mark: Blue pill box + white heartbeat graph — paired with "Meus Remédios" wordmark in Public Sans.

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

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Greeting | Warm, personal | "Olá, Dona Maria 👋" |
| Adherence success | Positive reinforcement | "Você está indo bem — 85% essa semana" |
| Critical alert | Urgent but calm | "Reposição Crítica: Metformina termina em 3 dias" |
| Empty state | Encouraging | "Nenhum medicamento registrado ainda. Comece aqui." |
| Action buttons | Direct imperative | "Registrar Dose", "Comprar Agora", "Ver Histórico" |

### Forbidden

- ❌ Marketing-speak: "Solução inovadora", "Plataforma de última geração"
- ❌ Medical jargon without explanation (unless in complex persona context)
- ❌ Passive voice in CTAs: "Dose pode ser registrada" → use "Registrar Dose"
- ❌ Pure `#000000` text (visual design convention, apply to copy contrast too)
- ❌ Filler words in empty states: "Não há dados disponíveis neste momento" → "Nenhum dado ainda"

### Preferred Terminology

| Use | Not |
|-----|-----|
| Tratamento / Protocolo | Scheme, Regimen |
| Comprimidos | Unidades (for tablet medication) |
| Estoque | Inventário |
| Adesão | Compliance |
| Hoje | Dashboard (in nav label) |
| Registrar Dose | Marcar como tomado |

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

---

## Sign-Off

**Strategy defined by:** Claude (frontend-skill analysis) + Design system (DESIGN-SYSTEM.md) + Prototype analysis
**Date:** 2026-03-23
**Locked until:** End of Fase 6 (Portabilidade, Performance e Monetização)

**Next steps:**
1. Reference this document in every `PAGE_STRATEGY.md` created per screen
2. Validate existing screens (Dashboard, Treatments, Stock) against the litmus checks above
3. Pass this to ui-design-brain when building new components — use as preset foundation
4. Update when Fase 6 ships dark mode support
