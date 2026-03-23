# Product Strategy

> **How to use this template:**
> Replace each section below with your product's actual values. This document becomes the source of truth for visual and narrative decisions across all pages. Share it with your team before any design or code work begins.
>
> **See also:** [DESIGN_SYSTEM_BRIDGE.md](../references/DESIGN_SYSTEM_BRIDGE.md) for context on how this feeds into implementation.

---

## Visual Thesis

**One sentence** describing the mood, material, and energy of your product. This should feel true, ambitious but believable, and guide every visual decision.

**Examples:**
- SaaS (Calm Efficiency): "Clarity through restraint. Trust earned through straightforward design and zero fluff."
- Marketplace (Bold Delight): "Unexpected moments of joy within a confident, purposeful space."
- Developer Tool (Technical Mastery): "Dense, powerful, and built for people who know what they need."
- E-commerce (Premium Aspiration): "Luxury accessible—beautiful imagery with quiet, confident typography."

**Your thesis:**
```
[Replace this with a single sentence that captures your product's visual identity]
```

---

## Content Plan Template

This is the **structure every page should follow**. Not every page needs all four sections, but these are your available building blocks.

| Section | Purpose | What Goes Here | Example |
|---------|---------|---|---|
| **Hero** | Announce | Product name, promise, visual anchor, primary CTA | "Meet Clarity — the dashboard that stops data overload" + screenshot |
| **Support** | Prove | One concrete feature, proof point, or benefit | "See metrics that matter in one glance" + feature highlight |
| **Detail** | Deepen | Atmosphere, workflow, use case, or customer story | How a team uses the product; workflow animation |
| **Final CTA** | Convert | Action (start trial, contact sales, visit docs) | "Start free. No credit card." |

**Your template:**
```
- **Hero:** [What goes here in every page/section?]
- **Support:** [One concrete feature, proof, or benefit—keep to one idea]
- **Detail:** [Deeper narrative: workflow, use case, customer proof, or emotional hook]
- **Final CTA:** [Action: Start free? Contact us? Visit docs?]
```

---

## Motion Language

Define **3–4 motion archetypes** that you'll use consistently across the product. Give them memorable names and specific rules so every animation feels intentional, not random.

**Entrance Moments** — How content reveals itself
- Example: "Scale + fade-in: starts at 0.95 scale, 0 opacity → full scale, full opacity over 200ms ease-out"
- Your entrance: `[describe timing, easing, transform]`

**Scroll-Linked Effects** — How the page responds to user scroll
- Example: "Hero parallax: background image translates -5% to -10% as user scrolls down"
- Your scroll effect: `[describe parallax, sticky elements, depth effects]`

**Hover & Interaction** — Micro-moments that confirm affordance
- Example: "Interactive scale: all buttons and links scale 1.02x + color shift on hover, 100ms ease-out"
- Your hover: `[describe scale, color, duration, easing]`

**State Feedback** — Loading, success, error states
- Example: "Loading shimmer: sweeping left-to-right over 1.5s infinite, subtle gray pulse at 60% opacity"
- Your feedback: `[describe loading, success, error animations]`

**Performance Notes:**
- All animations GPU-composited (use `transform` + `opacity`, never layout properties)
- Fast and restrained (100–400ms max for most interactions)
- Smooth on mobile (test on real devices, not just dev tools)
- Respect `prefers-reduced-motion` (provide static alternatives)

---

## Color System

Your palette. Lock this down early—it cascades into every component, page, and state.

**Primary Colors:**
- **Accent:** `#[YOUR HEX]` — The one strong action color. Every button, primary CTA, highlight.
  - *Example: #2563eb (blue)*
- **Background:** `#[YOUR HEX]` — Page background, surfaces at rest.
  - *Example: #f9fafb (off-white)*
- **Surface:** `#[YOUR HEX]` — Cards, modals, inputs, lifted elements.
  - *Example: #ffffff (white)*
- **Text/Primary:** `#[YOUR HEX]` — Headline text, primary content.
  - *Example: #111827 (near-black)*
- **Text/Muted:** `#[YOUR HEX]` — Secondary text, labels, placeholders, disabled states.
  - *Example: #6b7280 (gray)*
- **Border:** `#[YOUR HEX]` — Dividers, input borders, subtle structure.
  - *Example: #e5e7eb (light gray)*

**Semantic Colors** (status and feedback):
- **Success:** `#[YOUR HEX]` — Confirmations, positive state.
  - *Example: #16a34a (green)*
- **Warning:** `#[YOUR HEX]` — Caution, attention needed.
  - *Example: #d97706 (amber)*
- **Error:** `#[YOUR HEX]` — Destructive actions, validation failures.
  - *Example: #dc2626 (red)*
- **Info:** `#[YOUR HEX]` — Informational messages, help text.
  - *Example: #0284c7 (light blue)*

**Constraint:** Never use more than 2 accent colors on one screen (primary + one semantic max).

---

## Typography System

Define your type stack. This is how you create visual hierarchy and personality.

**Display Font** (Headlines, heroes, display text)
- Font name: `[e.g., Instrument Serif, Playfair Display, Clash Grotesk]`
- Usage: H1 headlines, section titles, hero taglines
- Weight preferences: `[e.g., 700 for boldness, 600 for balance]`
- *Why this font:* `[e.g., "Serif conveys trustworthiness and editorial credibility"]`

**Body Font** (UI text, descriptions, labels)
- Font name: `[e.g., Inter, Geist, SF Pro Display]`
- Usage: UI text, body copy, descriptions, all regular prose
- Weight contrast: Display 900 vs Body 400 (strong contrast, not subtle)
- *Why this font:* `[e.g., "Clean, neutral, optimized for screen reading"]`

**Monospace Font** (Code, IDs, data, timestamps)
- Font name: `[e.g., Geist Mono, JetBrains Mono, Fira Code]`
- Usage: Code blocks, API keys, timestamps, transaction IDs, numbers
- *Why this font:* `[e.g., "Distinct from body, signals data/technical content"]`

**Type Scale** (Sizes and line-heights)
```
Display (hero):    clamp(40px, 6vw, 72px) / 1.05
Heading 1:         32px / 1.1
Heading 2:         24px / 1.2
Heading 3:         18px / 1.4
Body (default):    15px / 1.6
Small:             13px / 1.5
Tiny (captions):   11px / 1.4
```

**Constraint:** No more than 2 typefaces without clear reason.

---

## Imagery Charter

Rules for how photography, illustration, and visual elements appear in your product.

**Style & Tone:**
- Real photography or illustration? AI-generated? 3D renders? `[Choose: "In-situ photography", "Lifestyle shots", "Product screenshots", "Custom illustration", "3D renders"]`
- Overall tone: `[e.g., "Bright and optimistic", "Moody and sophisticated", "Documentary/authentic", "Minimal and technical"]`
- Subjects: `[e.g., "Real people using the product", "Landscapes", "Product detail shots"]`

**Aspect Ratios & Sizing:**
- Hero images: `16:9` (or `21:9` for ultra-wide)
- Section cards: `4:3` or `3:2`
- Thumbnails: `1:1` or `16:9`
- Full-bleed: Edge-to-edge, no gutters

**Text Overlay Rules:**
- Always use a dark text area (scrim, solid background, or image-selected calm area)
- Minimum contrast: WCAG AA (4.5:1 for text, 3:1 for UI elements)
- Text should never fight the image for attention
- If the image is busy, darken it or use a solid scrim behind text

**Sourcing & Licensing:**
- Primary source: `[e.g., "Unsplash", "Custom photography", "Figma illustrations", "Midjourney for hero concepts"]`
- License: `[ensure rights to use commercially]`
- Naming convention: `[e.g., "hero-product-home.jpg", "section-features-1.png"]`

**Performance:**
- Optimize to WebP with JPEG fallback
- Hero images: target <100KB
- Secondary images: target <50KB
- Use `srcset` for responsive delivery
- Lazy-load below-the-fold content

---

## Copy Tone & Voice

How your product speaks. Keep it consistent.

**Voice Characteristics:**
- `[e.g., "Direct and confident", "Warm and human", "Technical but accessible"]`
- Formality level: `[Formal / Balanced / Casual]`
- Perspective: `[We/Us vs. You]`

**Product Language Examples:**
```
Instead of:                     Use:
-----------------------------------
"Innovative solution"           "[Actual benefit]"
"Cutting-edge technology"       "[What it does]"
"Synergize workflows"           "[Specific action]"
"Next-generation platform"      "[Concrete value]"
```

**Forbidden Words/Phrases:**
- ❌ `[Jargon that doesn't fit your voice]`
- ❌ `[Corporate clichés to avoid]`
- ❌ `[Overused marketing language]`

**Preferred Abbreviations/Terminology:**
- Use "X" not "Y" — `[e.g., "dashboard" not "control panel"]`
- Use "metrics" not "KPIs" — `[adjust for your domain]`
- Use "workflow" not "process" — `[or whatever fits]`

**Headline Examples** (to set tone):
```
✅ Good headline (direct, benefit-driven):
"See all your data in one place"

❌ Weak headline (vague, marketing-speak):
"Innovative data visualization platform"
```

---

## Accessibility Baseline

These are non-negotiable. Build them in from the start.

**Color & Contrast:**
- [ ] All body text: WCAG AA (4.5:1 minimum)
- [ ] All UI elements: WCAG AA (3:1 minimum)
- [ ] Never rely on color alone (use patterns, icons, text)
- [ ] Test with contrast checker before shipping

**Keyboard Navigation:**
- [ ] All interactive elements reachable via Tab
- [ ] Focus order matches visual order
- [ ] Focus outline visible on all backgrounds (minimum 2px)

**Motion:**
- [ ] Respect `prefers-reduced-motion` preference
- [ ] Provide static alternative for animated content
- [ ] No content flashes more than 3x per second

**Images & Media:**
- [ ] Every image has descriptive alt text (not "image" or "photo")
- [ ] Videos have captions
- [ ] Decorative images use `alt=""` or are background images

**Semantic HTML:**
- [ ] Proper heading hierarchy (`<h1>` → `<h2>` → `<h3>`)
- [ ] Form labels always visible (not just placeholder)
- [ ] Use semantic tags: `<nav>`, `<main>`, `<article>`, `<button>` (not `<div>` with click handlers)

---

## Dark Mode (If Supported)

Don't invert colors—redesign.

**Color Adjustments:**
- Background: `#0f1117` (not pure black)
- Surface: `#161b22`
- Text: `#c9d1d9`
- Muted: `#8b949e`
- Borders: `#30363d`

**Accent Color in Dark Mode:**
- Test: Does your accent color work on dark backgrounds?
- May need to shift hue or increase lightness slightly
- Document any changes: `[e.g., "accent becomes #3b82f6 (lighter blue)"]`

**Imagery in Dark Mode:**
- [ ] Test all hero images on dark background
- [ ] May need darker overlays for contrast
- [ ] Consider variant crops for light vs. dark

**Implementation:**
- [ ] Use CSS variables with light/dark variants
- [ ] Default to system preference (`prefers-color-scheme`)
- [ ] Allow manual toggle if desired
- [ ] Test on actual OLED screens (not gray-tinted light backgrounds)

---

## Sign-Off

**Who approved this strategy?**
- Product: `[Name/Date]`
- Design: `[Name/Date]`
- Engineering: `[Name/Date]`

**Locked until:** `[Date]` (when to revisit/refresh this strategy)

**Next steps:**
1. Share with the team
2. Create `tailwind.config.js` from this (ui-design-brain Phase 2)
3. Reference this in every `PAGE_STRATEGY.md` (frontend-skill Part B)
4. Validate all pages against this strategy before shipping

---

**Questions?** Reference [DESIGN_SYSTEM_BRIDGE.md](../references/DESIGN_SYSTEM_BRIDGE.md) for full workflow and integration guidance.
