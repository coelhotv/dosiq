# Design System: Clinical adhesion booster

This design system serves as the foundational framework for a high-end Brazilian health PWA. Moving away from the sterile, rigid layouts of traditional medical software, this system adopts a "Therapeutic Sanctuary" approach—blending editorial sophistication with extreme legibility. It is designed to feel like a high-end health journal: breathable, layered, and intuitively accessible for an aging demographic.

> Last updated: 2026-03-26

---

### 0. Two Design Languages, One System

The product serves two personas with fundamentally different intents. The design system must support both without compromise.

**Dona Maria — "Card Deck"**
Her interface is tactile and browsable, like a curated Pinterest board. Each card is a self-contained unit of action: one medicine, one decision, one tap. The layout prioritizes vertical scrolling and avoids horizontal comparison. Data is translated into language before it reaches her ("Tratamento em dia", not "93%"). The CTA is always the dominant visual element.

**Carlos — "Control Panel"**
His interface is analytical and scannable, like a clinical dashboard. Data is dense but organized: tabular rows enable him to compare adherence across 6 protocols at a glance. Labels stay numeric and precise. The layout rewards horizontal scanning. Cards appear only when grouping adds meaning (protocol plan as unit).

**How components bridge both:**
- A component starts as a universal building block (e.g., `StockPill`, `ProtocolRow`).
- When the rendering context diverges significantly, the component accepts a `variant` or `isComplex` prop to fork its presentation.
- The data contract (props) remains identical — only the visual expression changes.
- When the fork grows too large (50%+ of code diverges), split into two named components rather than one overloaded one.

---

### 1. Creative North Star: The Therapeutic Sanctuary
The "Therapeutic Sanctuary" rejects the chaotic density of typical healthcare apps. It prioritizes **Active Negative Space** and **Information Layering**. Instead of forcing all data onto one plane, we treat the UI as a physical stack of premium materials.

*   **Intentional Asymmetry:** Break the 12-column grid by pushing key headline elements to the left and allowing white space to "breathe" on the right. This creates a natural scanning path for seniors.
*   **Signature Soul:** We use soft gradients and glassmorphism to transition between states, moving the experience from "software" to "service."

---

### 2. Colors: Tonal Architecture

Our palette balances the "Verde Saúde" (Trust) and "Azul Clínico" (Seriousness) through Material 3 logic, ensuring high contrast for accessibility.

*   **The "No-Line" Rule:** Explicitly prohibit the use of 1px solid borders to section content. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section sitting on a `surface` background creates a clear but soft structural divide.
*   **Surface Hierarchy & Nesting:** Use surface tiers to imply importance.
    *   **Level 0 (Base):** `surface` (#f8fafb)
    *   **Level 1 (Subtle Sections):** `surface_container_low` (#f2f4f5)
    *   **Level 2 (Active Cards):** `surface_container_lowest` (#ffffff) – This provides the highest contrast for interactive content.
*   **The Glass & Gradient Rule:** Floating elements (like navigation bars or emergency FABs) must use **Glassmorphism**. Apply `surface` with 80% opacity and a `backdrop-blur(12px)`. 
*   **Signature Texture:** Primary actions should use a subtle linear gradient from `primary` (#006a5e) to `primary_container` (#008577) at a 135-degree angle. This adds "visual weight" and a premium tactile feel.

---

### 3. Typography: The Editorial Voice

We pair **Public Sans** (for authoritative headlines) with **Lexend** (for hyper-legibility in body text). Lexend was designed specifically to reduce cognitive noise, making it perfect for elderly users.

*   **Display & Headlines:** Use `display-md` (Public Sans) for patient names or health milestones. The bold, editorial weight creates a sense of "Clinical Authority."
*   **Body & Titles:** Use `title-lg` (Lexend) for medication names and `body-lg` for instructions. 
*   **Accessibility Note:** Never use a weight below 400. For elderly users, the "visual thinness" of fonts can lead to eye strain. Ensure `title-lg` is used for primary reading paths to maintain high visibility.

---

### 4. Elevation & Depth: Tonal Layering

Traditional shadows are too "digital." We aim for "Ambient Light."

*   **The Layering Principle:** Depth is achieved by stacking. Place a `surface_container_lowest` card on a `surface_container_low` section. The change in hex code defines the edge, not a line.
*   **Ambient Shadows:** For "Floating" 1-tap actions, use a shadow with a 24px blur and 4% opacity, using the `on_surface` color as the shadow tint. This mimics natural light.
*   **The Ghost Border:** If a visual separator is required for accessibility (e.g., in high-glare environments), use a "Ghost Border": the `outline_variant` token at 15% opacity.

---

### 5. Components: Tactile Health Tools

#### 1-Tap Buttons
*   **Primary Action:** Height of 64px (Spacing `12`). Large, rounded corners (`md` or `xl`). Use the `primary` to `primary_container` gradient.
*   **Accessibility:** All interactive targets must be at least 56px high to accommodate tremors or reduced motor precision.

#### High-Contrast Cards
*   **Style:** No borders. Background: `surface_container_lowest`. Shadow: Ambient (4%).
*   **Separation:** Instead of dividers, use Spacing `4` (1.4rem) between content blocks to create "Visual Silos."

#### RingGauges (Adhesion)
*   **Visual:** A thick 12pt stroke. Use `secondary` (#005db6) for the track and `primary_fixed` (#90f4e3) for the progress.
*   **Center Content:** Use `headline-md` (Public Sans) for the percentage, ensuring the most important health metric is the focal point.

#### Progress Bars (Stock/Refill)
*   **Visual:** 8px height, fully rounded (`full`).
*   **Logic:** When stock is low (<20%), transition the bar color from `secondary` to `error` (#ba1a1a) to trigger immediate psychological priority without needing a text warning.

#### Lists
*   **Forbid Dividers:** Use `surface_container_low` for even rows and `surface` for odd rows, or simply use Spacing `3` (1rem) between items. Leading elements (icons) should be encased in a `secondary_fixed` (#d6e3ff) circle for high visibility.

---

### 5a. Component Adaptation by Persona

Every component that appears in both modes must have an explicit definition for each. This table is the contract.

#### ProtocolRow / Treatment Item

| Layer | Dona Maria (Simple) | Carlos (Complex) |
|-------|---------------------|-----------------|
| **Layout** | Card — flex-column, full width on mobile; 2-col CSS grid on desktop | Tabular — CSS grid row: name \| schedule \| adherence \| stock |
| **Name + concentration** | Name (20px mobile, 16px desktop) + pill badge side-by-side | Name (16px) + pill badge side-by-side |
| **Intake quantity** | Plain text below name: "1 comprimido" | Plain text below name: "1 comprimido" |
| **Schedule** | Left side of bottom row | Dedicated column |
| **Adherence** | `AdherenceLabel`: human-language tag ("Tratamento em dia") | `AdherenceBar7d`: numeric bar + % |
| **Stock** | `StockPill` — top-right of card (immediate visibility) | `StockPill` — dedicated column |
| **Interaction** | Tap card → edit or expand (titration/notes) | Tap name cell → edit; row hover highlights all cells |

#### Adherence Display

| Mode | Component | Why |
|------|-----------|-----|
| **Simple** | `AdherenceLabel` — colored tag with text | Dona Maria needs a verdict, not a metric. "Algumas doses perdidas" drives action; "93%" does not. |
| **Complex** | `AdherenceBar7d` — fill bar + % | Carlos needs precision and comparability across protocols. The bar enables visual scanning. |

**Thresholds (shared):**
- >90% → good (green) — "Tratamento em dia"
- 70–90% → neutral (gray) — "Algumas doses perdidas"
- 50–70% → warning (amber) — "Tratamento em risco"
- <50% → critical (red) — "Muitas doses perdidas"
- 0% → no history — render nothing

#### StockPill (universal — same for both modes)

Semantic calendar icons replace decorative colored dots. The icon communicates temporal urgency without color alone:

| Status | Days | Icon | Color |
|--------|------|------|-------|
| high | 30+ | `CalendarArrowUp` | Blue |
| normal | 14–29 | `CalendarCheck2` | Green |
| low | 7–13 | `CalendarSync` | Amber |
| critical | <7 | `CalendarX2` | Red |

#### PriorityDoseCard (universal — same for both modes)

The priority card is the primary CTA surface for the `Hoje` dashboard. It is intentionally identical for both personas — urgency is universal. Displays up to 3 medicines by name; overflow shown as "+ N medicamentos". The "Confirmar Agora" button always registers **all** doses in the time window, not just the visible ones.

#### Layout Grids

| Context | Dona Maria | Carlos |
|---------|------------|--------|
| Treatments — mobile | Single column cards | Single column cards (denser) |
| Treatments — desktop | `grid-template-columns: 1fr 1fr`, `align-items: start` | Multi-col table grid (name / schedule / adherence / stock) |
| Dashboard — desktop | 1fr + 2fr asymmetric split | 1fr + 2fr asymmetric split (shared) |

---

### 6. Do’s and Don'ts

*   **DO:** Use `tertiary_fixed` (#ffdea8) for highlights or "New" notifications—it provides a warm, sun-like contrast to the clinical greens and blues.
*   **DO:** Prioritize vertical scrolling. Elderly users find horizontal swiping (carousels) physically and cognitively difficult.
*   **DON'T:** Use pure black (#000000) for text. Use `on_surface` (#191c1d) to maintain a soft, high-end editorial feel.
*   **DON'T:** Use "Small" or "XS" roundedness. Stick to `md` (0.75rem) or `lg` (1rem) to keep the interface feeling "soft" and approachable (Acolhedor).
*   **DON'T:** Place icons without labels. At this age demographic, icons can be ambiguous; always pair them with `label-md` or `title-sm` text.