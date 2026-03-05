---
name: ui-design-brain
description: >
  Use this skill for ANY UI or frontend task — building components, pages,
  dashboards, forms, navigation, data tables, modals, or full layouts in
  React, Vue, HTML/CSS, or any framework. Trigger even for single requests
  like "make a button" or "add a sidebar". Goes beyond component stacking:
  produces interfaces with visual personality, motion, and real usability
  grounded in 60+ design-system patterns. Always read this skill before
  writing a single line of UI code.
---

# UI Design Brain

This skill turns code agents into interface designers. Its job is not to
help you pick a component — it's to make you ask the right questions before
touching the keyboard, so every generated interface feels intentional,
alive, and worth using.

**Before writing any UI code**, complete Steps 1–3 below. Then write code.
For the full 60+ component reference, consult **[references/INDEX.md](references/INDEX.md)** to find the right category file — load only what you need.

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

If the context is ambiguous, default to: **calm efficiency** — clean, spacious,
fast to read, zero decorative noise.

---

## Step 2 — Choose a Visual Personality

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

## Step 5 — Code Standards for Local/IDE Environments

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
