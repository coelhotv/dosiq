---
version: alpha
name: dosiq-design-system
description: The official design system for Dosiq — a high-end Brazilian health PWA and mobile ecosystem. Adopts a Therapeutic Sanctuary approach with active negative space, tonal surface stacking, and zero cognitive friction for elderly patients and clinical caregivers.

colors:
  primary: "#006a5e"
  primary-container: "#008577"
  primary-fixed: "#90f4e3"
  primary-fixed-dim: "#73d8c7"
  on-primary: "#ffffff"
  on-primary-fixed-variant: "#005047"
  secondary: "#005db6"
  secondary-container: "#63a1ff"
  secondary-fixed: "#d6e3ff"
  on-secondary-fixed: "#001b3d"
  tertiary: "#7b5700"
  tertiary-container: "#9b6e00"
  tertiary-fixed: "#ffdea8"
  on-tertiary-fixed: "#271900"
  surface: "#f8fafb"
  surface-dim: "#d8dadb"
  surface-bright: "#f8fafb"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f2f4f5"
  surface-container: "#eceeef"
  surface-container-high: "#e6e8e9"
  surface-container-highest: "#e1e3e4"
  on-surface: "#191c1d"
  on-surface-variant: "#3e4946"
  outline: "#6d7a76"
  outline-variant: "#bdc9c5"
  outline-ghost: "rgba(25, 28, 29, 0.15)"
  success: "#22c55e"
  warning: "#f59e0b"
  warning-dark: "#904d00"
  warning-soft: "#fdecd2"
  error: "#ba1a1a"
  error-container: "#ffdad6"
  brand-forest: "#004d45"
  brand-mint: "#f0fdfb"
  delayed-bg: "#fff8f0"
  delayed-border: "#ffeb3b"

typography:
  display-lg:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
  display-md:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: 44px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.02em
  headline-md:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.35
  title-lg:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
  title-md:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
  body-lg:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
  label-md:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
  brand-wordmark:
    fontFamily: "Comfortaa, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.0

rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  full: 9999px

spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  10: 40px
  12: 48px
  16: 64px

components:
  button-primary-gradient:
    backgroundColor: "{colors.primary}"
    gradient: "linear-gradient(135deg, {colors.primary}, {colors.primary-container})"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.xl}"
    minHeight: 64px
    padding: 0px 32px
    shadow: "0 8px 24px rgba(0, 106, 94, 0.2)"
  card-sanctuary:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.2xl}"
    padding: 24px
    shadow: "0 24px 24px rgba(25, 28, 29, 0.04)"
  card-priority-dose:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.2xl}"
    padding: 24px
    shadow: "0 16px 48px rgba(25, 28, 29, 0.08)"
  stock-pill:
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  ring-gauge-adherence:
    strokeWidth: 12px
    trackColor: "{colors.secondary}"
    progressColor: "{colors.primary-fixed}"
    typography: "{typography.headline-md}"
---

# Design System: Editorial Clinical Sanctuary

This design system serves as the foundational framework for **Dosiq**, a high-end Brazilian health PWA and mobile ecosystem (React 19 + Vite Web & React Native Expo Mobile). Moving away from the sterile, rigid layouts of traditional medical software, this system adopts a **"Therapeutic Sanctuary"** approach—blending editorial sophistication with extreme legibility, calm dignity, and zero cognitive friction. It is specifically engineered to feel like a premium health journal: breathable, layered, and intuitively accessible across generations, especially an aging demographic.

> **Canonical Sources:** `apps/mobile/src/shared/styles/tokens.ts`, `apps/web/src/shared/styles/tokens/sanctuary.css`, `themes/dark.css`, and `dosiq-logo-verde.svg`.

---

### 0. Two Design Languages, One System

The product addresses two core personas with fundamentally different cognitive intents. The design system unifies both under the same tonal token architecture:

1. **Dona Maria — "Card Deck" (Simplicity & Peace of Mind)**
   - **Mindset:** Tactile, patient-centric, low cognitive burden, like a curated Pinterest board.
   - **Pattern:** Self-contained units of action: one medicine, one decision, one tap.
   - **Interaction:** Strict vertical scrolling; avoids horizontal scanning/swiping.
   - **Communication:** Translates clinical data into human reassurance before display (*"Tratamento em dia"* instead of *"93% de adesão"*).
   - **Targeting:** Oversized touch targets (56px–64px) for motor precision and tremors.

2. **Carlos — "Control Panel" (Analytical Clarity)**
   - **Mindset:** Caregiver, multi-treatment manager, medical vigilance, like a clinical dashboard.
   - **Pattern:** Dense, tabular, and scannable. Comparison across multiple protocols at a glance.
   - **Interaction:** Multi-column layout on desktop, structured data cells, numeric metrics, and compact pills.
   - **Communication:** Precise adherence percentages, stock day counts, and timeline intervals.

**How Components Bridge Both:**
- Universal data contracts (props) share identical status logic.
- Visual presentation forks via layout modes (`simple` vs `complex` / `card` vs `table row`).
- Critical alerts (`PriorityDoseCard`, low stock < 20%) remain universal—urgency does not change between personas.

---

### 1. Creative North Star: The Therapeutic Sanctuary

The "Therapeutic Sanctuary" rejects the chaotic density, clinical dread, and visual noise of standard healthcare software. It prioritizes **Active Negative Space** and **Physical Information Layering**.

* **Intentional Asymmetry:** Anchor primary headline elements to the left and allow generous white space to "breathe" on the right. This naturally creates an effortless scanning path for elderly eyes.
* **Tonal Architecture instead of Lines:** Borders produce visual clutter and cognitive strain. Structural divisions are achieved exclusively through background tone shifts.
* **Signature Soul:** Soft emerald-to-teal gradients, diffused ambient shadows, and selective glassmorphism transition the product feel from cold "software" to a caring, supportive "service".

---

### 2. Colors: Tonal Architecture & Brand Harmony

#### 2.1 Logo Chromatic DNA
The UI color tokens are rooted directly in Dosiq's official vector logo (`apps/web/public/dosiq-logo-verde.svg`):
* **Background Mint Canvas:** `{colors.brand-mint}` (`#F0FDFB`) / `{colors.surface}` (`#F8FAFB`).
* **Base Anchor (Deep Forest):** `#2D4F2A` in logo gradient ➔ mapped to `{colors.brand-forest}` (`#004D45` wordmark) and `{colors.on-primary-fixed-variant}` (`#005047`).
* **Vitality Core (Living Green):** `#22C55E` in logo body ➔ mapped to `{colors.success}` (`#22C55E`) and `primary.500` (`#14B8A6`).
* **Clinical Mint Highlight:** `#66E6D3` in logo tip ➔ mapped to `{colors.primary-fixed}` (`#90F4E3`).

#### 2.2 Primary Palette — Verde Saúde (Primary) & Azul Clínico (Secondary)
| Token | Hex | Role & Usage |
| :--- | :--- | :--- |
| `primary` | `#006a5e` | Primary brand CTA, active nav items, ring progress base, gradient start (WCAG AAA compliant) |
| `primary-container` | `#008577` | Gradient end for primary actions (135° linear angle) |
| `primary-fixed` | `#90f4e3` | Ring gauge progress fill, active pill highlight, taken dose indicator |
| `primary-fixed-dim` | `#73d8c7` | Secondary progress stroke and subtle active indicators |
| `on-primary` | `#ffffff` | Text and icons over primary color surfaces |
| `on-primary-fixed-variant` | `#005047` | Deep contrast text over light primary/mint surfaces |
| `secondary` | `#005db6` | "Azul Clínico" — Supporting actions, secondary gauges, clinical verification |
| `secondary-container` | `#63a1ff` | Interactive secondary badges and focused pill states |
| `secondary-fixed` | `#d6e3ff` | Circular background for leading list icons and medication badges |
| `on-secondary-fixed` | `#001b3d` | High-contrast label color over secondary-fixed badges |
| `tertiary` | `#7b5700` | Warm Amber — Clinical warnings, pending reviews |
| `tertiary-container` | `#9b6e00` | Accent badges for supplements and non-blocking advice |
| `tertiary-fixed` | `#ffdea8` | Soft sunshine highlight, "Novo" tags, supplement cards (`#fef3c7`) |

#### 2.3 Surface Hierarchy (Material 3 Tonal Stacking)
*The "No-Line" Rule:* Prohibit 1px solid borders for sectioning content. Define card and section boundaries through tonal background contrast:
* **Level 0 (App Canvas Base):** `surface` (`#f8fafb` / `neutral.50`)
* **Level 1 (Subtle Sections / Groupings):** `surface_container_low` (`#f2f4f5` / `neutral.100`)
* **Level 2 (Active Interactive Cards):** `surface_container_lowest` (`#ffffff` / `bg.card`)
* **Level 3 (Elevated / Nested Containers):** `surface_container_high` (`#e6e8e9` / `neutral.200`)
* **Level 4 (Highest Controls):** `surface_container_highest` (`#e1e3e4`)

#### 2.4 Text & Outlines
* **Never pure black:** Avoid `#000000` for body copy.
* `on-surface`: `#191c1d` (Mobile: `#1a1c1e` / `neutral.800`) — Primary high-contrast text.
* `on-surface-variant`: `#3e4946` (Mobile: `#44474e` / `neutral.600`) — Secondary instructions and sublabels.
* `outline`: `#6d7a76` (Mobile: `#8e9199` / `neutral.400`) — Muted captions and disabled states.
* `outline-variant`: `#bdc9c5` (Mobile: `#e1e3e8` / `neutral.200`) — Dividers when strictly required.
* `outline-ghost`: `rgba(25, 28, 29, 0.15)` — Soft protective border for high-glare outdoor accessibility.

#### 2.5 Semantic Status & Dual-Contrast Rules
* **Success:** `{colors.success}` (`#22c55e`). Background: `#ecfdf5`. Doses confirmed, adherence on track.
* **Warning (Dual-Contrast):**
  * Light Backgrounds: `{colors.warning-dark}` (`#904d00` — 6.25:1 WCAG contrast over white).
  * Dark / Live Activity Backgrounds: `{colors.warning}` (`#F59E0B` — 9.82:1 WCAG contrast over black).
  * Warning Soft Background: `{colors.warning-soft}` (`#fdecd2` / `#fffbeb`).
* **Error:** `{colors.error}` (`#ba1a1a`). Background: `{colors.error-container}` (`#ffdad6` / `#fee2e2`). Missed doses, severe stock depletion (<20%).
* **Info / Biomarkers:** `{colors.secondary}` (`#005db6`). Background: `#e3f0fb` / `#eff6ff`.
* **Delayed Dose State:** Background `{colors.delayed-bg}` (`#FFF8F0`) with accent border `{colors.delayed-border}` (`#ffeb3b`).

#### 2.6 Dark Mode Tonal Overrides
* `bg-primary` (Surface): `#191c1d`
* `bg-secondary` / `bg-card`: `#202425`
* `bg-tertiary`: `#2a2e2f`
* `text-primary`: `#e0e3e3` (soft off-white)
* `text-secondary`: `#bfc8c9`
* `text-link` / `accent`: `#90f4e3`
* `border-default`: `#3f484a`

---

### 3. Typography: The Editorial Voice

Three harmonious font families form the typographic system:
1. **Branding & Wordmark:** `Comfortaa-Bold` (curved, welcoming, human touch).
2. **Display & Headlines:** `Public Sans` (authoritative, clean, editorial weight).
3. **Body, Titles, Labels & Controls:** `Lexend` (hyper-legible, expanded apertures, scientifically validated for reading comprehension and senior eye fatigue).

#### Critical Accessibility Rule
* **No Font Weight Below 400:** Thin fonts (100–300) are explicitly prohibited in UI. They disappear under natural sunlight and cause eye strain for senior patients.
* Line width is capped at `65ch` for readability across large screens.

#### Typographic Scale
* `display-lg`: `3.5rem` (56px), Weight 700, Tight line-height (1.1).
* `display-md`: `2.75rem` (44px), Weight 700 — Patient milestones and hero greetings.
* `headline-lg`: `2.0rem` (32px), Weight 700.
* `headline-md`: `1.75rem` (28px), Weight 600/700 — Dashboard metrics and card headers.
* `headline-sm`: `1.5rem` (24px), Weight 600.
* `title-lg`: `1.125rem` (18px), Weight 600 — Primary medication names.
* `title-md`: `1.0rem` (16px), Weight 500 — Dosages and instructions.
* `body-lg`: `1.0rem` (16px), Weight 400, Line-height 1.5.
* `body-md`: `0.875rem` (14px), Weight 400 — Supporting medical notes.
* `label-lg`: `0.875rem` (14px), Weight 500 — Touch buttons and tabs.
* `label-md`: `0.75rem` (12px), Weight 500 — Status chips and timestamps.

---

### 4. Elevation & Depth: Tonal Layering

Shadows mimic natural room light ("Ambient Light") rather than harsh synthetic drops.

* **Ambient Shadow Hierarchy:**
  * `shadow-xs`: `0 1px 4px rgba(25, 28, 29, 0.04)` (elevation 1) — Compact chips.
  * `shadow-sm` (`editorial`): `0 4px 24px -4px rgba(25, 28, 29, 0.04)` (elevation 2) — Cards resting on canvas.
  * `shadow-md` (`ambient`): `0 24px 24px rgba(25, 28, 29, 0.04)` (elevation 4) — Active cards.
  * `shadow-lg` (`floating`): `0 16px 48px rgba(25, 28, 29, 0.12)` (elevation 8) — Drawers, action sheets.
  * `shadow-primary`: `0 8px 24px rgba(0, 106, 94, 0.2)` — Glow for primary CTA buttons.
* **Glassmorphism:** Strictly reserved for floating bars, bottom navigation, and top headers. Background: `rgba(248, 250, 251, 0.8)` with `backdrop-filter: blur(12px)`.

---

### 5. Components: Tactile Health Tools

#### 5.1 1-Tap Action Buttons
* **Height:** Minimum 56px, standard **64px** (`{spacing.12}`).
* **Visual:** Smooth gradient from `{colors.primary}` (`#006a5e`) to `{colors.primary-container}` (`#008577`) at 135°.
* **Radius:** `{rounded.xl}` (20px) or `{rounded.full}` (pill shape).
* **Feedback:** Scale transform `0.98` on tap with `shadow-primary`.

#### 5.2 PriorityDoseCard (Universal Anchor)
* The primary focal point of the `Hoje` dashboard. Urgency is universal across all personas.
* Background: `{colors.surface-container-lowest}` (`#ffffff`) on `{colors.surface}` (`#f8fafb`).
* Header highlights the next scheduled window (*"Dose das 08:00"*).
* Shows up to 3 medications by commercial name and dosage; overflow rendered as *"+ N medicamentos"*.
* Dominant full-width 1-tap button: **"Confirmar Agora"** registers all doses in the active time window simultaneously.

#### 5.3 Semantic StockPill
Avoids color-alone communication by pairing calendar iconography with temporal urgency:
* **High (30+ days remaining):** Icon `CalendarArrowUp`, Color `{colors.secondary}` (`#005db6`).
* **Normal (14–29 days):** Icon `CalendarCheck2`, Color `{colors.success}` (`#22c55e`).
* **Low (7–13 days):** Icon `CalendarSync`, Color `{colors.warning-dark}` / `{colors.warning}`.
* **Critical (<7 days):** Icon `CalendarX2`, Color `{colors.error}` (`#ba1a1a`).
* **Refill Progress Bar:** 8px height, `{rounded.full}`. When stock falls below 20%, the fill dynamically turns to `{colors.error}` (`#ba1a1a`).

#### 5.4 RingGauges (Adherence & Biomarkers)
* **Stroke:** Thick `12pt` / `12px` rounded stroke.
* **Colors:** Track: `{colors.secondary}` (`#005db6`) or `{colors.surface-container-high}`. Progress: `{colors.primary-fixed}` (`#90f4e3`) or `{colors.primary}` (`#006a5e`).
* **Center Metric:** `headline-md` (Public Sans Bold) showing the clean summary.

#### 5.5 Adherence Labels vs. Analytics
* **Simple Mode (Dona Maria):** `AdherenceLabel` with human reassurance:
  * `> 90%` ➔ Green tag: *"Tratamento em dia"*
  * `70–90%` ➔ Neutral gray tag: *"Algumas doses perdidas"*
  * `50–70%` ➔ Amber tag: *"Tratamento em risco"*
  * `< 50%` ➔ Red tag: *"Muitas doses perdidas"*
* **Complex Mode (Carlos):** `AdherenceBar7d` showing a 7-day mini sparkline + exact percentage.

---

### 5a. Component Adaptation by Persona

Every component that appears in both modes must have an explicit definition for each. This table is the contract.

#### ProtocolRow / Treatment Item

| Layer | Dona Maria (Simple) | Carlos (Complex) |
| :--- | :--- | :--- |
| **Layout** | Card — flex-column, full width on mobile; 2-col CSS grid on desktop | Tabular — CSS grid row: name \| schedule \| adherence \| stock |
| **Name + concentration** | Name (20px mobile, 16px desktop) + pill badge side-by-side | Name (16px) + pill badge side-by-side |
| **Intake quantity** | Plain text below name: "1 comprimido" | Plain text below name: "1 comprimido" |
| **Schedule** | Left side of bottom row | Dedicated column |
| **Adherence** | `AdherenceLabel`: human-language tag ("Tratamento em dia") | `AdherenceBar7d`: numeric bar + % |
| **Stock** | `StockPill` — top-right of card (immediate visibility) | `StockPill` — dedicated column |
| **Interaction** | Tap card → edit or expand (titration/notes) | Tap name cell → edit; row hover highlights all cells |

#### Adherence Display

| Mode | Component | Why |
| :--- | :--- | :--- |
| **Simple** | `AdherenceLabel` — colored tag with text | Dona Maria needs a verdict, not a metric. "Algumas doses perdidas" drives action; "93%" does not. |
| **Complex** | `AdherenceBar7d` — fill bar + % | Carlos needs precision and comparability across protocols. The bar enables visual scanning. |

---

### 6. Do’s and Don'ts

* **DO:** Use `{colors.tertiary-fixed}` (`#ffdea8`) for warm, sun-like highlights and supplement distinction.
* **DO:** Prioritize vertical scrolling over horizontal tabs or carousels.
* **DO:** Ensure every icon is paired with a clear, readable text label (`{typography.title-md}` or `{typography.label-md}`).
* **DO:** Maintain minimum 56px touch targets for all interactive elements.
* **DON'T:** Use pure black (`#000000`) for text. Use `{colors.on-surface}` (`#191c1d`).
* **DON'T:** Use 1px borders to separate list items or cards. Use alternating surface tones (`{colors.surface}` and `{colors.surface-container-low}`).
* **DON'T:** Use font weights below 400 anywhere in the interface.
* **DON'T:** Rely solely on color to convey medical urgency; always pair with icons, labels, or micro-copy.

---

### 7. Layout Principles & Spacing

#### Spacing Scale
- **Base Unit:** 4px grid.
- **Tokens:** `{spacing.1}` (4px) · `{spacing.2}` (8px) · `{spacing.3}` (12px) · `{spacing.4}` (16px) · `{spacing.5}` (20px) · `{spacing.6}` (24px) · `{spacing.8}` (32px) · `{spacing.12}` (48px) · `{spacing.16}` (64px).
- **Internal Card Padding:** Standard 24px (`{spacing.6}`) on mobile, 32px (`{spacing.8}`) on desktop.
- **Gap between cards:** 16px to 24px.

---

### 8. Responsive Behavior & Collapsing Strategy

#### Breakpoints Matrix

| Name | Screen Width | Layout & Hierarchy Behavior |
| :--- | :--- | :--- |
| **Mobile** | `< 768px` | Strict single-column stack. Bottom navigation bar (glass). Touch targets enforce 56px–64px. Headlines scale to `headline-md`. Cards occupy 100% width. |
| **Tablet** | `768px – 1023px` | 2-column treatment cards. Sidebar navigation replaces bottom bar. Compact timeline with side-by-side vitals. |
| **Desktop** | `1024px – 1439px` | Asymmetric split layout: `1fr` vitals sidebar (~360px) + `2fr` dose timeline (~720px). Full desktop header. |
| **Wide** | `≥ 1440px` | Centered max-width container (`1280px`). Generous margins (`{spacing.16}`) without full-bleed edge stretching. |

#### Touch Targets
- Interactive targets must hit ≥ 56px height on mobile (standard 64px for primary dose buttons).
- Form inputs must maintain ≥ 48px height.

---

### 9. Iteration & Agent Guide

When prompting or coding with AI agents (Claude, Gemini, Antigravity, Stitch):
1. **Focus on ONE component or view at a time.**
2. **Reference semantic tokens directly:** Use `{colors.primary}`, `{typography.body-lg}`, `{rounded.xl}`.
3. **Validate Linting:** Run `npx @google/design.md lint DESIGN.md` to ensure structural adherence to the Stitch spec.
4. **Scarcity of Primary Gradient:** Never place more than one filled gradient CTA (`{components.button-primary-gradient}`) in a single viewport. Supporting actions must be outline or tonal surfaces.
5. **A11y Non-Negotiable:** Check that text contrast over light backgrounds meets WCAG AAA (>7:1) and that no font weight drops below 400.
