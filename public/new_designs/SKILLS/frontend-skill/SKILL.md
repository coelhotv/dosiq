---
name: frontend-skill
description: Use when the task asks for a visually strong landing page, website, app, prototype, demo, or game UI. This skill enforces restrained composition, image-led hierarchy, cohesive content structure, and tasteful motion while avoiding generic cards, weak branding, and UI clutter. Works solo or pairs seamlessly with ui-design-brain for deeper implementation consistency.
---

# Frontend skill

Use this skill when the quality of the work depends on art direction, hierarchy, restraint, imagery, and motion rather than component count.

Goal: ship interfaces that feel deliberate, premium, and current. Default toward award-level composition: one big idea, strong imagery, sparse copy, rigorous spacing, and a small number of memorable motions.

---

## Can This Work Alone?

**Yes — but with trade-offs.**

### Using frontend-skill Solo ✅

**Works great for:**
- Defining product visual strategy before any code is written
- Designing in Figma first, then handing off to developers
- Creating a design validation checklist
- Design teams that don't code

**What you get:**
- Clear visual thesis, narrative structure, imagery rules, motion language
- Design strategy document that prevents divergence
- Validation (litmus checks) to catch weak designs before dev

**What you lose:**
- **Implementation guidance** — developers must invent their own component system
- **Speed** — handoff gap between design and code (30–40% rework risk)
- **Consistency** — no constraint on component choices per page; developers make ad-hoc decisions
- **One team understanding the strategy** — risk of "beautiful design that's hard to code"

**Trade-off:** Premium design strategy, slower/inconsistent implementation.

---

### Using frontend-skill + ui-design-brain Together 🚀 *(Recommended)*

**Why it's better:**
- frontend-skill defines what the product should feel like
- ui-design-brain translates that into a reusable component system
- Every page is faster because decisions cascade from strategy
- Developers understand the intent, not just the pixels
- ROI: 3x faster implementation, 90% fewer choice decisions, consistent output

**How to integrate (see [DESIGN_SYSTEM_BRIDGE.md](references/DESIGN_SYSTEM_BRIDGE.md) below):**
1. Run frontend-skill to create `PRODUCT_STRATEGY.md`
2. Pass that to ui-design-brain to lock down its preset, colors, motion
3. Run frontend-skill per-page to create `PAGE_STRATEGY.md`
4. Run ui-design-brain with that strategy as input
5. Validate with both skills' litmus checks

**Trade-off:** Setup is longer; payoff is enormous for multi-page products.

---

---

## Part A: Product Strategy (Once Per Product)

**Goal:** Define the visual, narrative, and motion language that governs all pages.

### Working Model

Before building any page, establish three foundational things:

- **visual thesis:** one sentence describing mood, material, and energy
- **content plan template:** hero, support, detail, final CTA (how each repeats across pages)
- **interaction thesis:** 2–3 motion archetypes (entrance, scroll-linked, hover/reveal) that feel consistent across the product

Each page inherits this strategy.

### Beautiful Defaults (Product Level)

- Start with composition, not components.
- Prefer a full-bleed hero or full-canvas visual anchor.
- Make the brand or product name the loudest text.
- Keep copy short enough to scan in seconds.
- Use whitespace, alignment, scale, cropping, and contrast before adding chrome.
- Limit the system: two typefaces max, one accent color by default.
- Default to cardless layouts. Use sections, columns, dividers, lists, and media blocks instead.
- Treat the first viewport as a poster, not a document.

### Accessibility (Product Level)

- **Color contrast:** All text must pass WCAG AA (4.5:1 minimum). Text over images must maintain legible contrast even with lighter imagery.
- **Keyboard navigation:** Every interactive element must be reachable and operable via keyboard.
- **Motion respect:** Provide a `prefers-reduced-motion` alternative. Never auto-play videos or animations that distract.
- **Image alt text:** All imagery must have descriptive alt text (not "image", not "photo").
- **Semantic HTML:** Use proper heading hierarchy, landmarks, and ARIA labels where needed.

**Litmus check:** If someone disables images and reduces motion, is the page still understandable and usable?

---

## Part B: Page/Feature Strategy (Per Page)

**Goal:** Apply the product strategy to a specific page, defining its composition, content, and interaction moments.

### Working Model

Before building this page, write three things (scoped to this page):

- **visual thesis:** how this page expresses the product strategy (e.g., if product is "calm efficiency", is this page "efficiency at first glance" or "efficiency with storytelling"?)
- **content plan:** which sections go where, and what job each does (hero? support? detail? CTA?)
- **interaction moments:** which 2–3 motions from the product motion language apply here?

Each section gets one job, one dominant visual idea, and one primary takeaway or action.

---

## Landing Pages

Default sequence:

1. Hero: brand or product, promise, CTA, and one dominant visual
2. Support: one concrete feature, offer, or proof point
3. Detail: atmosphere, workflow, product depth, or story
4. Final CTA: convert, start, visit, or contact

Hero rules:

- One composition only.
- Full-bleed image or dominant visual plane.
- Canonical full-bleed rule: on branded landing pages, the hero itself must run edge-to-edge with no inherited page gutters, framed container, or shared max-width; constrain only the inner text/action column.
- Brand first, headline second, body third, CTA fourth.
- No hero cards, stat strips, logo clouds, pill soup, or floating dashboards by default.
- Keep headlines to roughly 2-3 lines on desktop and readable in one glance on mobile.
- Keep the text column narrow and anchored to a calm area of the image.
- All text over imagery must maintain strong contrast and clear tap targets.

If the first viewport still works after removing the image, the image is too weak. If the brand disappears after hiding the nav, the hierarchy is too weak.

Viewport budget:

- If the first screen includes a sticky/fixed header, that header counts against the hero. The combined header + hero content must fit within the initial viewport at common desktop and mobile sizes.
- When using `100vh`/`100svh` heroes, subtract persistent UI chrome (`calc(100svh - header-height)`) or overlay the header instead of stacking it in normal flow.

## Apps

Default to Linear-style restraint:

- calm surface hierarchy
- strong typography and spacing
- few colors
- dense but readable information
- minimal chrome
- cards only when the card is the interaction

For app UI, organize around:

- primary workspace
- navigation
- secondary context or inspector
- one clear accent for action or state

Avoid:

- dashboard-card mosaics
- thick borders on every region
- decorative gradients behind routine product UI
- multiple competing accent colors
- ornamental icons that do not improve scanning

If a panel can become plain layout without losing meaning, remove the card treatment.

## Imagery

Imagery must do narrative work.

- Use at least one strong, real-looking image for brands, venues, editorial pages, and lifestyle products.
- Prefer in-situ photography over abstract gradients or fake 3D objects.
- Choose or crop images with a stable tonal area for text.
- Do not use images with embedded signage, logos, or typographic clutter fighting the UI.
- Do not generate images with built-in UI frames, splits, cards, or panels.
- If multiple moments are needed, use multiple images, not one collage.

The first viewport needs a real visual anchor. Decorative texture is not enough.

## Copy

- Write in product language, not design commentary.
- Let the headline carry the meaning.
- Supporting copy should usually be one short sentence.
- Cut repetition between sections.
- Do not include prompt language or design commentary into the UI (e.g., no "As an AI, I think...")
- Give every section one responsibility: explain, prove, deepen, or convert.

If deleting 30 percent of the copy improves the page, keep deleting.

## Utility Copy For Product UI

When the work is a dashboard, app surface, admin tool, or operational workspace, default to utility copy over marketing copy.

- Prioritize orientation, status, and action over promise, mood, or brand voice.
- Start with the working surface itself: KPIs, charts, filters, tables, status, or task context. Do not introduce a hero section unless the user explicitly asks for one.
- Section headings should say what the area is or what the user can do there.
- Good: "Selected KPIs", "Plan status", "Search metrics", "Top segments", "Last sync".
- Avoid aspirational hero lines, metaphors, campaign-style language, and executive-summary banners on product surfaces unless specifically requested.
- Supporting text should explain scope, behavior, freshness, or decision value in one sentence.
- If a sentence could appear in a homepage hero or ad, rewrite it until it sounds like product UI.
- If a section does not help someone operate, monitor, or decide, remove it.
- Litmus check: if an operator scans only headings, labels, and numbers, can they understand the page immediately?

## Motion

Use motion to create presence and hierarchy, not noise.

Ship at least 2-3 intentional motions for visually led work:

- one entrance sequence in the hero
- one scroll-linked, sticky, or depth effect
- one hover, reveal, or layout transition that sharpens affordance

Prefer Framer Motion when available for:

- section reveals
- shared layout transitions
- scroll-linked opacity, translate, or scale shifts
- sticky storytelling
- carousels that advance narrative, not just fill space
- menus, drawers, and modal presence effects

Motion rules:

- noticeable in a quick recording
- smooth on mobile (test on real devices, not just dev tools)
- fast and restrained
- consistent across the page
- removed if ornamental only

## Responsive Imagery Strategy

Images are the hero of image-led design. They must perform on all devices.

**Image sourcing:**
- Use real photography or high-quality illustrations, not stock templates or AI-generated UI mockups
- Crop or source images with a stable tonal area for text overlay (never full-bleed busy patterns)
- Choose aspect ratios that work across desktop (16:9 or wider) and mobile (4:3 or taller)

**Responsive behavior:**
- Use `srcset` and `sizes` for responsive delivery (different crops/resolutions per breakpoint)
- Implement lazy loading with `loading="lazy"` on below-the-fold images
- Provide `alt` text that describes the narrative role, not just "image" or "product photo"
- On mobile, crop to show the most important area; don't shrink the whole image

**Performance:**
- Optimize formats: WebP with JPEG fallback, never PNGs larger than 500KB
- Target image payload under 100KB per image on hero (lazy-loaded secondaries under 50KB)
- Use `will-change: transform` sparingly on parallax/scroll-linked images to maintain 60fps

## Dark Mode (If Used)

If your product supports dark mode, don't invert colors — redesign.

- **Imagery:** Choose images that work in both light and dark contexts, or provide variant crops
- **Text contrast:** Ensure text readable on dark backgrounds (light text should be near-white, not `#ffffff`)
- **Accent color:** Verify accent color is visible and appealing on dark background (may shift hue slightly)
- **Motion:** Same motion language applies; no need to change timing or easing

Test both modes in parallel. Don't ship dark mode as an afterthought.

## Hard Rules

- No cards by default.
- No hero cards by default.
- No boxed or center-column hero when the brief calls for full bleed.
- No more than one dominant idea per section.
- No section should need many tiny UI devices to explain itself.
- No headline should overpower the brand on branded pages.
- No filler copy.
- No split-screen hero unless text sits on a calm, unified side.
- No more than two typefaces without a clear reason.
- No more than one accent color unless the product already has a strong system.

## Reject These Failures

- Generic SaaS card grid as the first impression
- Beautiful image with weak brand presence
- Strong headline with no clear action
- Busy imagery behind text
- Sections that repeat the same mood statement
- Carousel with no narrative purpose
- App UI made of stacked cards instead of layout

## Litmus Checks

- Is the brand or product unmistakable in the first screen?
- Is there one strong visual anchor?
- Can the page be understood by scanning headlines only?
- Does each section have one job?
- Are cards actually necessary?
- Does motion improve hierarchy or atmosphere?
- Would the design still feel premium if all decorative shadows were removed?
- Is all text accessible (WCAG AA contrast minimum)?
- Does the page work with images disabled? With motion disabled?

---

## Templates & Integration

### Template: PRODUCT_STRATEGY.md

**Copy [assets/PRODUCT_STRATEGY.template.md](assets/PRODUCT_STRATEGY.template.md) to your project root, rename to `PRODUCT_STRATEGY.md`, and fill in your values.**

This file becomes the source of truth for visual and narrative decisions. Use it as a reference document, not a one-time exercise.

**Quick version:**

```markdown
# Product Strategy

## Visual Thesis
[One sentence: mood, material, energy]

## Content Plan Template
- **Hero:** [What goes here in every page?]
- **Support:** [One feature, proof point, or offer]
- **Detail:** [Atmosphere, workflow, or depth]
- **Final CTA:** [Convert, start, visit, contact]

## Motion Language
- **Entrance:** [Describe 1-2 motions used in hero]
- **Scroll-linked:** [Describe parallax/sticky/depth effect]
- **Hover/reveal:** [Describe interaction feedback]

## Imagery Charter
- **Style:** [Real photography / illustration style / aesthetic]
- **Aspect ratios:** [Hero 16:9, sections 4:3, etc.]
- **Overlay rule:** [How text sits on images]
- **Tone:** [Bright / moody / documentary / etc.]

## Copy Tone
- **Voice:** [Product language examples]
- **Forbidden:** [Words/phrases to avoid]
- **Abbreviations:** [How to shorten long terms]

## Color System
- **Accent:** [#XXXXXX — the one strong action color]
- **Primary text:** [#XXXXXX]
- **Secondary text:** [#XXXXXX]
- **Background:** [#XXXXXX]

## Typography
- **Display font:** [Name, usage]
- **Body font:** [Name, usage]
- **Max linewidth:** [Characters per line]
```

### Template: PAGE_STRATEGY.md

**Copy [assets/PAGE_STRATEGY.template.md](assets/PAGE_STRATEGY.template.md) per page, rename to `PAGE_STRATEGY_[page-name].md`, and fill in your values.**

This guides the page-specific implementation without reinventing product strategy.

**Quick version:**

```markdown
# Page Strategy: [Page Name]

## Visual Thesis
[How does this page express the product strategy?]

## Content Plan
- **Hero:** [Title, image, CTA]
- **Section 2:** [What does it prove?]
- **Section 3:** [What atmosphere or detail?]
- **Final CTA:** [Action]

## Interaction Moments
[Which 2-3 motions from PRODUCT_STRATEGY apply here?]

## Validation
- [ ] Is brand clear in first viewport?
- [ ] Is there one visual anchor?
- [ ] Can I scan headers and understand the page?
- [ ] Does each section have one job?
- [ ] Do all motions come from product motion language?
- [ ] Is text accessible over imagery (WCAG AA)?
```

---

## Design System Bridge: frontend-skill ↔️ ui-design-brain

**⚠️ This skill works alone, but is 10x more powerful paired with [ui-design-brain](../ui-design-brain/SKILL.md).**

### Workflow (Recommended)

1. **Define product strategy** (frontend-skill) → save `PRODUCT_STRATEGY.md`
2. **Set up foundation** (ui-design-brain) → pass `PRODUCT_STRATEGY.md` to lock down preset, colors, motion
3. **Define page strategy** (frontend-skill) → save `PAGE_STRATEGY.md`
4. **Implement page** (ui-design-brain) → use `PAGE_STRATEGY.md` to guide component choices
5. **Validate** (both skills) → run litmus checks from both

See [DESIGN_SYSTEM_BRIDGE.md](references/DESIGN_SYSTEM_BRIDGE.md) for full integration details.

### If Using frontend-skill Alone

- Copy [assets/PRODUCT_STRATEGY.template.md](assets/PRODUCT_STRATEGY.template.md) → fill in values → share with team
- Copy [assets/PAGE_STRATEGY.template.md](assets/PAGE_STRATEGY.template.md) per page → guide each page's composition
- Deliver `PRODUCT_STRATEGY.md` to the development team
- Explicitly ask them to read it before choosing components
- Expect 30–40% rework if implementation diverges from strategy
- Consider handing off to a team that uses ui-design-brain for consistency

### Template Files Available

- **[PRODUCT_STRATEGY.template.md](assets/PRODUCT_STRATEGY.template.md)** — Create once per product (1–2 hours)
- **[PAGE_STRATEGY.template.md](assets/PAGE_STRATEGY.template.md)** — Create per page (15–30 min per page)














