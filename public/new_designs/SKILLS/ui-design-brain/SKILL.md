---
name: ui-design-brain
description: >
  Use this skill for ANY UI or frontend task — building components, pages,
  dashboards, forms, navigation, data tables, modals, or full layouts in
  React, Vue, HTML/CSS, or any framework. Trigger even for single requests
  like "make a button" or "add a sidebar". Goes beyond component stacking:
  produces interfaces with visual personality, motion, and real usability
  grounded in 60+ design-system patterns. Works solo or pairs seamlessly with
  frontend-skill for deeper visual strategy alignment. Always read this skill
  before writing a single line of UI code.
---

# UI Design Brain

This skill turns code agents into interface designers. Its job is not to
help you pick a component — it's to make you ask the right questions before
touching the keyboard, so every generated interface feels intentional,
alive, and worth using.

**Before writing any UI code**, complete Steps 1–3 below. Then write code.
For the full 60+ component reference, consult **[references/INDEX.md](references/INDEX.md)** to find the right category file — load only what you need.

---

## Can This Work Alone?

**Yes — but with trade-offs.**

### Using ui-design-brain Solo ✅

**Works great for:**
- Quick internal tools, CRUD dashboards, admin interfaces
- Projects where utility matters more than visual narrative
- When you need a solid component system fast
- Small teams that don't have design bandwidth

**What you get:**
- Solid foundation (preset, spacing grid, typography, motion)
- Comprehensive component system with all states
- Professional, intentional-looking UI
- Anti-patterns that prevent common mistakes

**What you lose:**
- **Strategic direction** — each page is built independently, no overarching visual thesis
- **Narrative coherence** — no guarantee pages feel like they belong to the same product
- **Consistency** — developers may make different color/motion choices without upstream constraints
- **Premium feel** — output is competent but generic (lacks "marvelous" quality)

**Trade-off:** Functional UI, faster delivery, less intentionality.

---

### Using ui-design-brain + frontend-skill Together 🚀 *(Recommended)*

**Why it's better:**
- frontend-skill defines what the product should *feel* like
- ui-design-brain implements that vision systematically
- Every component decision is informed by product strategy
- Developers understand the intent, not just the system
- ROI: 3x faster page implementation, zero preset paralysis, coherent output

**How to integrate (see [DESIGN_SYSTEM_BRIDGE.md](references/DESIGN_SYSTEM_BRIDGE.md) below):**
1. frontend-skill defines `PRODUCT_STRATEGY.md` (visual thesis, motion language, imagery rules)
2. ui-design-brain reads that to lock down preset, color palette, motion timings
3. frontend-skill defines `PAGE_STRATEGY.md` per page (visual thesis, content plan, moments)
4. ui-design-brain uses that strategy to narrow component choices and fill states
5. Both skills' validation checks pass before shipping

**Trade-off:** Setup is longer; payoff is enormous for any product with multiple pages.

---

## The Core Obligation

Generic UIs fail not because the components are wrong, but because nobody
asked *what this interface is for, who uses it, and how it should feel*.

Every UI you generate must pass this bar:

> "Does this feel like it was designed for this specific product,
>  or does it look like the default output of a code assistant?"

If it looks like the latter, start over.

---

## Step 1 — Read the Context Before Anything Else

Before choosing any component, answer these four questions from the user's
request, codebase, or surrounding code:

1. **Who uses this?** (developer tool, consumer app, internal admin, marketing site)
2. **What's the dominant emotion?** (trust, delight, efficiency, calm, urgency)
3. **What's already in the codebase?** (match the existing system — don't introduce a style island)
4. **What's the one thing the user must do on this screen?** (make that effortless above all else)

**If available**, also read:
- **PRODUCT_STRATEGY.md** — defines visual thesis, motion language, imagery rules, color system (created by frontend-skill)
- **PAGE_STRATEGY.md** — defines this specific page's visual thesis, content plan, and interaction moments (created by frontend-skill)

These files pre-answer many Step 1 questions and should override your assumptions.

If the context is ambiguous and no strategy files exist, default to: **calm efficiency** — clean, spacious,
fast to read, zero decorative noise.

---

## Step 2 — Choose a Visual Personality

**If PRODUCT_STRATEGY.md exists, the preset is already chosen. Skip to Step 3.**

**If starting fresh,** copy [assets/FOUNDATION.template.config.js](assets/FOUNDATION.template.config.js) to your project as `tailwind.config.js` and fill in values from your PRODUCT_STRATEGY.md (or from the preset below).

Pick the preset that matches the context. This choice cascades into
typography, spacing, color, and motion decisions.

### Preset A · Modern SaaS *(default)*
- Neutral palette (off-white bg, near-black text), one strong accent
- 8px spacing grid, generous breathing room
- Subtle shadows or borders — never both on the same element
- Motion: gentle, 150–250ms ease-out

### Preset B · Apple-level Minimal
- Near-monochrome warm grays, almost no color
- Large type scale with tight letter-spacing on display text
- Abundant white space — micro-interactions as the only ornamentation
- Motion: precise, 200ms cubic-bezier(.25,.1,.25,1)

### Preset C · Dense Enterprise
- Information-dense with well-defined visual regions
- Compact 4/8/12/16/24px spacing scale
- Strong dividers, zero decorative elements
- Motion: minimal — only loading states and state feedback

### Preset D · Creative / Expressive
- Bold visual personality: asymmetric layouts, dramatic scale contrast
- Editorial typography (expressive display + quiet body font)
- One vivid accent that would survive on a poster
- Motion: choreographed, intentional, 200–400ms

### Preset E · Data Dashboard
- Optimized for scanning, not reading
- Consistent vertical alignment across all rows
- Clear metric hierarchy: KPI → trend → detail
- Motion: only for live-update indicators

---

## Step 3 — The "Life" System

This is the section most agents skip. It's why UIs feel dead.

**Life = the sum of micro-decisions that signal craft.**

Apply all of the following before calling the UI done.

### 3.1 — Typography as Hierarchy, Not Just Text

```css
/* Every project needs a deliberate type scale — not Tailwind defaults */
--font-display: 'Instrument Serif', Georgia, serif;    /* Headlines, heroes */
--font-body:    'Geist', 'Inter', system-ui, sans-serif; /* All UI text */
--font-mono:    'Geist Mono', 'Fira Code', monospace;  /* Code, IDs, data */

/* Scale: use no more than 5 sizes in one view */
--text-xs:   11px / 1.4;   /* Labels, badges, captions */
--text-sm:   13px / 1.5;   /* Secondary UI, meta */
--text-base: 15px / 1.6;   /* Body, descriptions */
--text-lg:   18px / 1.4;   /* Subheadings */
--text-xl:   24px / 1.2;   /* Section titles */
--text-2xl:  32px / 1.1;   /* Page titles */
--text-hero: clamp(40px, 6vw, 72px) / 1.05; /* Hero only */
```

Rules:
- Headings and body must have strong **weight contrast** (900 vs 400 — not 600 vs 400)
- Never use placeholder text as a label
- Truncate long strings with `line-clamp`, never let them break layout
- Use monospace for all IDs, timestamps, numbers, amounts, and code — always

### 3.2 — Color with Intent

```css
/* Minimum palette every project needs — use CSS variables, never hardcode */
--color-bg:        #f9fafb;   /* Page background */
--color-surface:   #ffffff;   /* Cards, modals, inputs */
--color-border:    #e5e7eb;   /* Dividers, input rings */
--color-text:      #111827;   /* Primary text */
--color-muted:     #6b7280;   /* Secondary text, placeholders */
--color-accent:    #2563eb;   /* One strong action color */
--color-accent-fg: #ffffff;   /* Text on accent backgrounds */

/* Semantic — never invent ad-hoc reds and greens per component */
--color-success:   #16a34a;
--color-warning:   #d97706;
--color-error:     #dc2626;
--color-info:      #0284c7;
```

Rules:
- Maximum 2 accent colors per screen (primary + one semantic)
- Never use `#000000` or `#ffffff` — use near-black and near-white
- Dark mode: don't invert colors. Redesign. Dark bg is `#0f1117`, not `#1a1a1a`
- Status badges: use muted tones (`amber-100` text `amber-700`), not bright saturated fills

### 3.3 — Motion as Communication

Motion is not decoration. Every animation must carry meaning.

```css
/* Define once, reuse everywhere */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);      /* Standard movement */
--ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);  /* Elastic / bounce */
--ease-out:     cubic-bezier(0, 0, 0.2, 1);         /* Elements entering */
--ease-in:      cubic-bezier(0.4, 0, 1, 1);         /* Elements exiting */

--duration-fast:   100ms; /* Hover color changes */
--duration-base:   200ms; /* Most state transitions */
--duration-slow:   350ms; /* Modals, drawers, page transitions */
```

**Motion checklist — every interactive element must have these:**

| Element | Required animation |
|---------|--------------------|
| Button | `hover:scale-[1.02]` + color shift + `active:scale-[0.98]` press feel |
| Clickable card | `hover:shadow-lg hover:-translate-y-0.5 transition-all` |
| Input | `focus:ring-2 focus:ring-accent/30 focus:border-accent` |
| Link | Underline grows from left on hover (scaleX transform) |
| Toggle | Thumb slides with spring ease; background color fades |
| Modal | Enters from `translateY(8px) opacity(0)` — rests at full |
| Drawer | Slides in from edge; backdrop fades in separately |
| Toast | Slides in from corner; nudges stack gently |
| Skeleton | Shimmer sweep animation — never static gray |
| Dropdown | `scale(0.97) opacity(0)` origin at trigger → full size |

Never animate layout properties (`width`, `height`, `top`, `left`).
Always use `transform` and `opacity` — GPU-composited, no layout thrash.

**Motion performance on device:**
- Test on real mobile devices (not just DevTools), especially mid-range Android
- Ensure smooth 60fps on common devices; acceptable to drop to 30fps on older hardware
- Use `will-change: transform` sparingly (only on actively animating elements)
- Batch animations where possible to avoid cumulative jank

### 3.4 — Spacing as Composition

Spacing is the clearest signal of craft. Uniform spacing = amateur output.

```
4px   — between icon and label, badge internal padding
8px   — tight group spacing, compact UI density
16px  — standard gap between related items
24px  — gap between sections within a component
32px  — gap between major page sections
48px  — hero internal padding, section top margin
64px  — full section separation on desktop
```

Rules:
- Related elements: tight spacing (8–16px)
- Unrelated elements: generous spacing (32–64px)
- Variation in spacing IS the visual hierarchy — don't equalize it
- Mobile: reduce horizontal padding, preserve vertical rhythm

### 3.5 — Every UI State is a Design Opportunity

Empty, loading, and error states are not afterthoughts. Ship them.

**Empty state anatomy:**
```
[Icon or subtle illustration — 48px, --color-muted]
[Headline — positive framing: "No projects yet"]
[Body — one sentence: "Create your first project to get started"]
[Primary CTA — verb-first: "Create project"]
```

**Loading state rules:**
- Skeleton screens, not spinners, for predictable layouts
- Delay skeleton by 300ms (avoid flash on fast responses)
- Skeleton shapes must match the exact content shape

**Error state rules:**
- Inline: below the field, red border + message, icon
- Toast errors: always include retry or undo action
- Page errors: full centered layout with a clear recovery path

---

## Accessibility (Every Step)

Accessibility is not a feature — it's a requirement. Build it in from the start.

### Color & Contrast
- **Text contrast:** All text must pass WCAG AA (4.5:1 minimum for normal text, 3:1 for large text)
- **Component contrast:** UI elements (buttons, inputs, icons) must have 3:1 contrast
- **Avoid color-only signals:** Don't use red/green alone to convey status. Add icons, text, or patterns.
- **Test:** Use a contrast checker (WebAIM, Stark) before shipping

### Keyboard Navigation
- **All interactive elements must be reachable via Tab**
- **Focus order must match visual order**
- **Focus outline must be visible** (minimum 2px, visible on all backgrounds)
- **Don't remove focus outlines** — customize them to match your design if needed

### Motion & Vestibular
- **Respect `prefers-reduced-motion`:** Provide a no-motion variant for animations
- **Test:** Set your OS to reduce motion; verify your UI still works
- **Avoid flashing:** No content should flash more than 3 times per second

### Screen Readers
- **Use semantic HTML** (`<button>`, `<nav>`, `<main>`, headings)
- **Label all inputs:** `<label for="input-id">Label</label>` — never rely on placeholder
- **Provide alt text for images:** Describe what the user needs to know, not "image" or "photo"
- **Use ARIA sparingly:** Only for dynamic content (modals, dropdowns, live regions)

---

## Dark Mode (If Supported)

If your product ships dark mode, design it properly — don't just invert colors.

### Color Redesign
- **Background:** Use `#0f1117` or similar, not pure black (`#000000`)
- **Surface:** Use `#161b22` or similar for cards/modals
- **Text:** Use near-white (`#c9d1d9`) for primary, `#8b949e` for secondary
- **Borders:** Use `#30363d` for dividers
- **Accent:** Test your accent color on dark bg; may need to shift hue or lightness

### Image & Photography
- **Images in light mode:** may need darker overlays in dark mode to maintain text contrast
- **Test:** Use both modes in parallel; don't ship dark mode as an afterthought
- **Provide toggle:** Allow users to switch, but default to system preference (`prefers-color-scheme`)

### Implementation
- Use CSS variables: `--color-bg-dark`, `--color-text-dark`, etc.
- Use `@media (prefers-color-scheme: dark)` or theme switching logic
- Test on actual dark OLED screens (not just gray-tinted light backgrounds)

---

## Step 4 — Component Decision Trees

Use these before opening the component files.

**Which overlay?**
```
Brief, focused, < 3 fields, reversible?     → Modal
Secondary detail, user stays in context?    → Drawer (right side)
Complex flow, multi-step, or destructive?   → New page
Supplementary info on hover?                → Tooltip / Popover
```

**Which input control?**
```
Binary, takes effect immediately?           → Toggle
Binary, requires a Save action?             → Checkbox
One of 3–5 fixed options, short labels?     → Radio or Segmented control
One of 5+ options, possibly searchable?     → Select or Combobox
Short text, one line?                       → Text input
Long text, multi-line?                      → Textarea
Numeric value within a defined range?       → Slider + visible number input
```

**Which feedback?**
```
Brief confirmation, auto-dismisses?         → Toast (4–6s)
Persistent status requiring action?         → Alert (inline or banner)
Progress on a blocking operation?           → Modal + progress bar
Progress on a background task?              → Progress bar in header/sidebar
```

**Which navigation pattern?**
```
Top-level pages, always visible?            → Header nav
Nested hierarchy, frequent deep jumping?    → Sidebar with tree view
Sequential, linear multi-step flow?         → Stepper
Parallel content at same hierarchy level?   → Tabs (2–7 max)
Long single-page with anchor sections?      → Sticky TOC / anchor nav
```

Full component specs → **[references/INDEX.md](references/INDEX.md)**

---

## Step 5 — Validation Against Product Strategy *(Optional but Recommended)*

**If PAGE_STRATEGY.md exists, validate against it before shipping.**

- [ ] **Visual thesis match:** Does this page express the strategy defined in PAGE_STRATEGY.md?
- [ ] **Motion alignment:** Do all animations come from the product motion language? No ad-hoc additions?
- [ ] **Color consistency:** Are you using the product color system, or inventing new colors?
- [ ] **Typography hierarchy:** Does spacing and sizing follow the product scale?
- [ ] **Component choices:** Did you consult the strategy before picking overlay type, input control, or navigation pattern?
- [ ] **Litmus checks from frontend-skill:** Run the product-level checks (brand clear? one visual anchor? scannable?)

**If you answer "no" to any:** revisit Step 1 and re-read the strategy. Your implementation may have drifted.

---

## Step 6 — Code Standards for Local/IDE Environments

```
Framework:    React (default) — Vue, Svelte, or HTML if specified
Styling:      Tailwind CSS with tailwind.config.js — arbitrary values allowed
Icons:        lucide-react (preferred) — never emoji as icons, never SVG literals
Animation:    Framer Motion or CSS transitions — define in tailwind.config.js
Fonts:        Google Fonts or local — always declare fallback stack
Types:        TypeScript interfaces for all component props
State:        useState / useReducer for UI — no global store in isolated components
```

**Every component must have typed props:**
```tsx
interface CardProps {
  title: string;
  description?: string;
  status?: 'active' | 'pending' | 'archived';
  onClick?: () => void;
  className?: string;
}
```

**Every interactive element must have all states:**
hover · focus-visible · active · disabled · loading · error

**Every layout must handle:**
empty · overflow (long text, many items) · mobile (375px min) · loading

---

## Anti-Patterns — Hard Stops

| Anti-pattern | Fix |
|-------------|-----|
| Equal-weight buttons everywhere | One primary per section; hierarchy is mandatory |
| Rainbow status badges | 3–4 muted semantic colors only — never bright fills |
| Spinner for predictable layouts | Skeleton screen matching content shape |
| Placeholder text as label | Visible label always — placeholder for format hint only |
| Modal inside modal | Drawer or new page for complex flows |
| Disabled button with no explanation | Tooltip or inline hint explaining what's needed |
| Hamburger on desktop | Visible navigation when horizontal space allows |
| Auto-advancing carousel | Manual navigation — users control pace |
| All cards equal scale and weight | Feature card or varied weight signals hierarchy |
| "Submit" / "Click here" labels | Verb + object: "Save changes", "Go to dashboard" |
| Body text below 13px | Body minimum 14px — prefer 15–16px |
| Inline hardcoded color values | CSS variables always — enables theming |
| No empty / error / loading states | Every path through the UI must be designed |

---

## Design System Bridge: ui-design-brain ↔️ frontend-skill

**⚠️ This skill works alone, but is 10x more powerful paired with [frontend-skill](../frontend-skill/SKILL.md).**

### When Used Alone

- You get a solid component system and spacing grid
- But output may feel generic or lack narrative direction
- Use this for quick internal tools where beauty is secondary
- Expect developers to make independent choices per page

### Workflow (Recommended for Real Products)

1. **Define product strategy** (frontend-skill) → save `PRODUCT_STRATEGY.md`
2. **Set up foundation** (ui-design-brain Step 2) → read `PRODUCT_STRATEGY.md` to lock down preset, colors, motion
3. **Define page strategy** (frontend-skill) → save `PAGE_STRATEGY.md`
4. **Implement page** (ui-design-brain Steps 3–4) → use `PAGE_STRATEGY.md` to guide component choices
5. **Validate** (ui-design-brain Step 5 + frontend-skill litmus checks) → both must pass

This workflow:
- **Reduces decision paralysis** (preset is chosen upstream, not debated per-page)
- **Ensures consistency** (every page inherits product visual thesis)
- **Speeds implementation** (constraints cascade down; fewer options = faster choices)
- **Improves output quality** (components serve a larger narrative, not isolated tasks)

See [DESIGN_SYSTEM_BRIDGE.md](references/DESIGN_SYSTEM_BRIDGE.md) for full integration details.

### If Using ui-design-brain Alone

- Copy [assets/FOUNDATION.template.config.js](assets/FOUNDATION.template.config.js) → fill in your preset values → commit to version control
- Use this as your single source of truth (no per-page overrides)
- Expect 40–60% of developer time spent on per-page decisions without upstream strategy
- Risk: each page looks like it came from a different product

### Template Files Available

- **[FOUNDATION.template.config.js](assets/FOUNDATION.template.config.js)** — Create once (locked-down tailwind config with all design tokens)
- **[PRODUCT_STRATEGY.template.md](assets/PRODUCT_STRATEGY.template.md)** — Reference when reading PRODUCT_STRATEGY from frontend-skill
- **[PAGE_STRATEGY.template.md](assets/PAGE_STRATEGY.template.md)** — Reference when reading PAGE_STRATEGY from frontend-skill
