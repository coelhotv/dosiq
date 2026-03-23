# SKILLS User Guide: frontend-skill + ui-design-brain

> **TL;DR:** Pick a path below. Use templates from `assets/` folders. Reference the bridge document when integrating.

---

## 🎯 Quick Decision (30 Seconds)

**What are you building?**

| What | Use | Time | Output Quality |
|------|-----|------|-----------------|
| **Quick internal dashboard, admin tool, CRUD interface** | [Path A: ui-design-brain solo](#path-a-solo-ui-design-brain) | 🟢 Fast | Professional |
| **Landing page, multi-page SaaS, app, customer-facing site** | [Path C: Both together](#path-c-recommended-both-together) | 🟡 Moderate | **Marvelous** ✨ |
| **Design document first, dev second** | [Path B: frontend-skill solo](#path-b-solo-frontend-skill) | 🟡 Moderate | Beautiful |

---

## Path A: Solo ui-design-brain
### *For utility-first projects (dashboards, admin tools, internal apps)*

**When to use:**
- Building an internal tool, admin dashboard, or CRUD interface
- Visual strategy doesn't matter much—efficiency wins
- You need a solid component system fast
- Single developer or small team with limited design bandwidth
- No customer-facing narrative (no hero sections, storytelling)

**What you get:**
✅ Professional, clean interfaces
✅ Consistent component system
✅ Reusable spacing grid and typography
✅ All states designed (empty, loading, error)
✅ Mobile-responsive by default

**What you lose:**
❌ No strategic direction (each page is independent)
❌ Generic feel (no intentionality, no narrative)
❌ Risk of visual inconsistency across pages
❌ More developer decisions per page (color? motion timing? spacing?)

**Quick start (1 hour):**
```
1. Copy ui-design-brain/assets/FOUNDATION.template.config.js to your project
   ↓ Rename to tailwind.config.js
   ↓ Pick a preset (Preset A–E in SKILL.md Step 2)
   ↓ Fill in your colors, fonts, spacing
   ↓ Commit to version control

2. Open ui-design-brain SKILL.md
   ↓ Follow Steps 1–6
   ↓ Build components using the "Life System" (Step 3)
   ↓ Use component decision trees (Step 4)
   ↓ Code with standards (Step 6)

3. Ship
   ↓ All values locked in config—consistency guaranteed
```

**Best for:**
- Internal tools with 1–3 pages
- Dashboards and admin interfaces
- Utility-first products (GitHub clone, analytics dashboard, CRM)
- Rapid prototyping when speed > beauty

**ROI:**
- Time: ~20 hours for a 5-page site
- Quality: Solid, professional (not marvelous)
- Consistency: Good (enforced by config)
- Rework: ~10% (minor refinements)

---

## Path B: Solo frontend-skill
### *For design-first workflows (Figma → design doc → handoff)*

**When to use:**
- You're designing in Figma first, implementing later
- You need a beautiful design document/strategy before code
- Design team is separate from dev team
- You want to validate the visual strategy before engineering effort
- Design-heavy project (landing page, marketing site, brand experience)

**What you get:**
✅ Clear visual strategy document
✅ Design validation (litmus checks)
✅ Narrative structure (hero/support/detail/CTA)
✅ Motion language documented
✅ Imagery and copy guidelines
✅ Accessibility checklist

**What you lose:**
❌ No implementation guidance (developers must invent components)
❌ Handoff gap (design → dev, high divergence risk)
❌ Slower implementation (30–40% rework when code doesn't match design)
❌ No component system provided

**Quick start (2 hours):**
```
1. Copy frontend-skill/assets/PRODUCT_STRATEGY.template.md
   ↓ Customize for your product (visual thesis, colors, motion, typography)
   ↓ Save as PRODUCT_STRATEGY.md
   ↓ Share with team

2. Copy frontend-skill/assets/PAGE_STRATEGY.template.md (per page)
   ↓ Customize for each page (home, pricing, docs, etc.)
   ↓ Save as PAGE_STRATEGY_[page-name].md
   ↓ Run validation checklist

3. Create design in Figma
   ↓ Reference PRODUCT_STRATEGY.md (colors, typography, motion language)
   ↓ Hand off PRODUCT_STRATEGY.md + PAGE_STRATEGY.md + Figma link to dev team
   ↓ Hope they read the docs 🤞

4. Dev team implements
   ↓ (Or, ask them to use ui-design-brain for better consistency)
```

**Best for:**
- Design-first teams (Figma-native workflow)
- Landing pages and marketing sites
- Brand-driven projects requiring visual strategy
- Design validation before engineering investment
- Stakeholder alignment (get approval on strategy early)

**ROI:**
- Design time: ~2–3 hours (strategy + validation)
- Implementation time: ~50 hours for 5-page site (no system; ad-hoc decisions)
- Quality: Beautiful design doc, generic code
- Consistency: Low (depends on dev team discipline)
- Rework: ~30–40% (design ≠ implementation)

---

## Path C: Recommended — Both Together
### *For real products shipping to users (landing pages, SaaS, apps, multi-page sites)*

**When to use:**
- Building a customer-facing product
- Multiple pages or sections (you need consistency)
- Team includes designer + developers
- You want interfaces that feel intentional, premium, marvelous
- ROI matters (you want to avoid rework)

**What you get:**
✅ Clear product strategy guiding all decisions
✅ Fast, consistent implementation (3x faster per page)
✅ Every page expresses the same visual thesis
✅ Zero preset/color/motion decision paralysis
✅ High-quality output (intentional, premium, marvelous)
✅ Easy team alignment (shared strategy document)
✅ Minimal rework (strategy validates before code)

**What you lose:**
❌ Longer initial setup (Phase 1–2: 4 hours upfront)
❌ More documentation to maintain
❌ Team discipline (must respect constraints)

**The workflow (5-page site = ~15 hours total):**

```
Phase 1: Product Strategy (frontend-skill, 1–2 hours)
  └─ Copy PRODUCT_STRATEGY.template.md
     ↓ Fill in visual thesis, motion language, colors, typography
     ↓ Commit to repo
     ↓ Get product + design + engineering buy-in

Phase 2: Foundation Setup (ui-design-brain, 1–2 hours)
  └─ Copy ui-design-brain/assets/FOUNDATION.template.config.js
     ↓ Fill in values from PRODUCT_STRATEGY.md
     ↓ Lock down tailwind.config.js (no overrides ever)
     ↓ Test colors, spacing, motion on real device

Phase 3: Page Strategy (frontend-skill, 15 min per page)
  └─ Copy PAGE_STRATEGY.template.md (per page)
     ↓ Customize for this page (visual thesis, content plan, moments)
     ↓ Run validation checklist
     ↓ Commit to repo

Phase 4: Page Implementation (ui-design-brain, 1.5 hours per page)
  └─ Read PAGE_STRATEGY.md
     ↓ Follow Steps 1–6
     ↓ All decisions cascade from strategy (no surprises)
     ↓ Implement with locked-down values
     ↓ Code with standards (no CSS variable overrides)

Phase 5: Validation (both skills, 15 min per page)
  └─ Run frontend-skill litmus checks
     ↓ Run ui-design-brain validation checklist
     ↓ Both must pass
     ↓ Ship

TOTAL: 4 hours setup + 1.75 hours per page × 5 pages = ~13.75 hours
(Compare to solo ui-design-brain: ~20 hours for generic output)
```

**Best for:**
- Real products shipping to users
- Multi-page sites (landing page + features + docs + pricing)
- SaaS, marketplaces, apps, consumer products
- Teams that want consistency without decision fatigue
- Projects where visual intentionality matters

**ROI:**
- Setup: 4 hours (one-time cost, reused across all pages)
- Per-page time: 1.75 hours (vs. 4 hours solo)
- Total 5-page site: ~14 hours (vs. ~50 hours solo ui-design-brain + rework)
- **Savings: 36 hours per project**
- Quality: Marvelous (intentional, premium, coherent)
- Consistency: Excellent (enforced by strategy)
- Rework: ~5% (minor tweaks only)

---

## 📊 Use Case Matrix

```
                          | Path A: Solo ui-design  | Path B: Solo frontend  | Path C: Both
                          | Brain                   | Skill                  | Together
─────────────────────────────────────────────────────────────────────────────────────────
Internal Dashboard        | ✅ Perfect              | ❌ Overkill            | 🟡 Optional
Admin Tool / CRUD         | ✅ Perfect              | ❌ Overkill            | 🟡 Optional
Landing Page              | 🟡 Adequate            | ✅ Good                | ✅ Perfect
Pricing Page              | 🟡 Adequate            | ✅ Good                | ✅ Perfect
Multi-page SaaS           | ❌ Generic             | 🟡 Design-only         | ✅ Perfect
App (with UI States)      | ✅ Good                | ❌ Overkill            | ✅ Perfect
Marketing Site            | 🟡 Adequate            | ✅ Good                | ✅ Perfect
Brand Overhaul            | ❌ No strategy         | ✅ Good                | ✅ Perfect
Rapid Prototype           | ✅ Fast                | ❌ Too slow            | 🟡 Balanced
Design-First Workflow     | ❌ No system           | ✅ Perfect             | 🟡 Overkill
Dev-First Workflow        | ✅ Perfect             | ❌ No code             | ✅ Perfect
Startup (Speed Matters)   | ✅ Fast ship           | 🟡 Moderate            | ✅ Balanced
Enterprise (Quality Matters)| 🟡 Adequate          | 🟡 Adequate            | ✅ Perfect

Legend: ✅ Perfect (best choice)  |  🟡 Okay (acceptable)  |  ❌ Not ideal
```

---

## 🚀 Step-by-Step Walkthroughs

### Walkthrough A: Building a Dashboard (Solo ui-design-brain)

**Scenario:** Internal analytics dashboard. No customers. Speed matters.

```
1. Copy FOUNDATION.template.config.js to your project root as tailwind.config.js

2. Read ui-design-brain SKILL.md Step 2 (Visual Personalities)
   Pick Preset E (Data Dashboard) — optimized for scanning, not reading

3. Fill in FOUNDATION.template.config.js:
   - Colors: Your brand accent + semantic (success, error, warning)
   - Typography: Clean, readable (body 15px + bold headings)
   - Spacing: Compact 4/8/12/16/24px scale
   - Motion: Minimal (only loading states)
   - Commit

4. Open SKILL.md Step 3 (Life System)
   Apply typography scale, color palette, spacing, states

5. Build pages using Step 4 (Component Decision Trees)
   - Data table? Use references/components-data.md
   - Forms? Use references/components-inputs.md
   - Feedback? Use references/components-feedback.md

6. Code with standards (Step 6)
   - TypeScript interfaces for props
   - All states: hover, focus, disabled, loading, error
   - Test on mobile (375px min)

7. Done. Consistent, professional dashboard.
   Time: ~20 hours for 5 pages
   Quality: Professional
   Risk: None (single source of truth)
```

---

### Walkthrough B: Building a Landing Page (Solo frontend-skill)

**Scenario:** New product launch. Design-heavy. Design team works in Figma. Dev team separate.

```
1. Copy PRODUCT_STRATEGY.template.md to your project as PRODUCT_STRATEGY.md

2. Fill it in:
   - Visual Thesis: "Calm, clear, confident—trust through simplicity"
   - Motion Language: Scale + fade entrance, parallax scroll, subtle hover
   - Colors: One accent (#2563eb), warm grays, off-white background
   - Typography: Serif for headlines, sans-serif for body
   - Imagery: Real product screenshots, light and airy

3. Share PRODUCT_STRATEGY.md with team
   Get buy-in from product + design + engineering

4. Create PAGE_STRATEGY.md (one per page):
   - Home page: Announce the product, show use case, CTA
   - Pricing page: Compare plans side-by-side, clear CTAs
   - Docs: Organized, scannable, searchable

5. Validate each PAGE_STRATEGY against litmus checks
   Check: Brand clear? One visual anchor? Scannable?

6. Design in Figma (reference PRODUCT_STRATEGY colors + motion)

7. Hand off:
   - PRODUCT_STRATEGY.md
   - PAGE_STRATEGY_[page].md files
   - Figma link
   - To dev team

8. Dev team implements (ideally using ui-design-brain for consistency)

Time: ~3 hours design strategy + validation
Quality: Beautiful design document
Risk: Hope dev team reads the docs and doesn't diverge
```

---

### Walkthrough C: Building a Multi-Page SaaS (Both Together) ⭐

**Scenario:** Customer-facing SaaS product. Multiple pages. Quality + speed matter.

```
PHASE 1: PRODUCT STRATEGY (1–2 hours)
──────────────────────────────────────
1. Copy PRODUCT_STRATEGY.template.md as PRODUCT_STRATEGY.md

2. Fill it in with your product vision:
   - Visual Thesis: "Calm efficiency—trust through clarity"
   - Motion Language:
     * Entrance: Scale (1.02x) + fade, 200ms ease-out
     * Scroll: Parallax on hero (5–10% translate)
     * Hover: Color shift + scale, 100ms
   - Colors:
     * Accent: #2563eb (blue)
     * Bg: #f9fafb (off-white)
     * Text: #111827 (near-black)
     * Muted: #6b7280 (gray)
   - Typography:
     * Display: Geist Sans (bold, confident)
     * Body: Inter (readable, clean)
     * Mono: Geist Mono (data, IDs)
   - Imagery: Product screenshots + customer stories
   - Accessibility: WCAG AA contrast, keyboard nav
   - Dark Mode: Yes, redesign with #0f1117 bg

3. Run through the validation section (all checks pass)

4. Get sign-off: Product, Design, Engineering

5. Commit PRODUCT_STRATEGY.md to version control


PHASE 2: FOUNDATION SETUP (1–2 hours)
──────────────────────────────────────
1. Copy ui-design-brain/assets/FOUNDATION.template.config.js
   Rename to tailwind.config.js

2. Fill in every [PLACEHOLDER] from PRODUCT_STRATEGY.md:
   - fontFamily.display: 'Geist'
   - fontSize: Your type scale
   - colors: All values from PRODUCT_STRATEGY
   - animation: Your motion language (entrance, scroll, hover)
   - transitionDuration: fast (100ms), base (200ms), slow (350ms)
   - transitionTimingFunction: Your easing values

3. Test on real device:
   - Colors: Check contrast on OLED screen
   - Motion: Test on real mobile (not just DevTools)
   - Spacing: Validate mobile at 375px width

4. Commit tailwind.config.js
   This is now locked. No per-page overrides ever.


PHASE 3–5: BUILD PAGES (Per page, ~1.75 hours each)
─────────────────────────────────────────────────────
For each page (Home, Pricing, Docs, etc.):

1. STRATEGY (15 min):
   Copy PAGE_STRATEGY.template.md
   Customize for this specific page
   Example (Home page):
   - Visual Thesis: "Announce with clarity—promise first, proof second"
   - Content: Hero + Feature highlight + Testimonial + CTA
   - Motions: Entrance, parallax hero, hover on CTA
   - Validate: All checklists pass

2. IMPLEMENTATION (1.5 hours):
   Open ui-design-brain SKILL.md
   - Step 1: Context already defined (read PAGE_STRATEGY.md)
   - Step 2: Skip (preset locked in tailwind.config.js)
   - Step 3: Apply "Life System" (all values from config)
   - Step 4: Use component decision trees
     * Hero: Image + headline + description + CTA
     * Feature section: Icon + headline + description
     * Testimonial: Avatar + quote + name/title
     * CTA: Button + supporting text
   - Step 5: Validate (both skills' checklists)
     * frontend-skill: Brand clear? One anchor? Scannable?
     * ui-design-brain: States designed? Keyboard nav? Mobile?
   - Step 6: Code

3. VALIDATION (15 min):
   frontend-skill litmus checks:
   - [ ] Brand unmistakable in first viewport?
   - [ ] One strong visual anchor?
   - [ ] Scannable by headlines?
   - [ ] Each section one job?

   ui-design-brain validation:
   - [ ] All motions from product language?
   - [ ] Using product color system?
   - [ ] All states designed?
   - [ ] Mobile tested at 375px?
   - [ ] Keyboard nav works?

   Both pass → Merge


REPEAT FOR EACH PAGE
────────────────────
Home: 1.75 hours
Pricing: 1.75 hours
Features: 1.75 hours
Docs: 1.75 hours
Integrations: 1.75 hours

TOTAL: 4 hours setup + 8.75 hours pages = 12.75 hours ✅


RESULT
──────
✅ Every page feels intentional
✅ Consistent visual language across all pages
✅ Developer made zero color/motion/spacing decisions
✅ All pages have all states designed
✅ Mobile works everywhere
✅ Accessible (WCAG AA)
✅ Ship with confidence
```

---

## ❓ FAQ

**Q: Can I switch paths mid-project?**
A: Yes. If you start with Path A (solo ui-design-brain) and want to add strategy:
1. Extract your current colors/motion into PRODUCT_STRATEGY.md
2. Run frontend-skill Part B on new pages
3. Over time, consistency will improve

**Q: What if my team disagrees on the visual thesis?**
A: Make it a product decision, not a design decision. Get buy-in from:
- Product lead (user needs, brand promise)
- Design lead (visual direction, aesthetic)
- Engineering lead (feasibility, performance)

If still disagreed, pick the thesis that best serves your users.

**Q: Can I use both skills but skip the bridge?**
A: Technically yes, but you'll have duplicated work and inconsistency. The bridge prevents this. Just read it once (10 min).

**Q: I have an existing project. Can I retrofit these skills?**
A: Yes.
1. Extract your current colors/motion/typography into PRODUCT_STRATEGY.md
2. Create tailwind.config.js from your existing styles
3. Reference this on all new pages
4. Gradually refactor old pages to match

**Q: Do I have to use BOTH templates or can I use one?**
A: PRODUCT_STRATEGY is the source of truth. PAGE_STRATEGY is optional but highly recommended (catches divergence early).

**Q: What if I'm a solo developer?**
A: Path A (solo ui-design-brain) is fastest. Path C is still worth it if you have >3 pages (strategy prevents rework).

**Q: Can I modify the templates?**
A: Yes. They're starting points, not gospel. Customize sections that don't apply to you. Keep the validation checklists.

**Q: What if the preset (Preset A–E) doesn't match my vibe?**
A: Use the closest one as a baseline, then override in FOUNDATION.template.config.js. Document why you changed it.

**Q: Should I version control PRODUCT_STRATEGY.md and PAGE_STRATEGY.md?**
A: Yes. They're part of your design system. Update them when strategy changes.

**Q: What if I need to change the visual thesis mid-project?**
A: Update PRODUCT_STRATEGY.md, regenerate tailwind.config.js, validate all existing pages. This is rework, but less than having no strategy.

---

## 🗂️ Where to Find What

```
/SKILLS/
├── USER_GUIDE.md .......................... You are here
├── frontend-skill/
│   ├── SKILL.md .......................... Part A (Product Strategy) + Part B (Page Strategy)
│   ├── assets/
│   │   ├── PRODUCT_STRATEGY.template.md .. Copy → customize → PRODUCT_STRATEGY.md
│   │   └── PAGE_STRATEGY.template.md .... Copy → customize → PAGE_STRATEGY_[name].md
│   └── references/
│       └── DESIGN_SYSTEM_BRIDGE.md ...... Integration guide (read this to understand workflow)
│
└── ui-design-brain/
    ├── SKILL.md .......................... Steps 1–6, with accessibility & dark mode
    ├── assets/
    │   ├── FOUNDATION.template.config.js  Copy → customize → tailwind.config.js
    │   ├── PRODUCT_STRATEGY.template.md . Reference
    │   └── PAGE_STRATEGY.template.md .... Reference
    └── references/
        ├── DESIGN_SYSTEM_BRIDGE.md ...... Integration guide
        ├── INDEX.md ....................... Component index
        └── components-*.md ............... Component patterns
```

**Quick Links:**
- **Decision help?** → Read "Quick Decision" above
- **How to integrate?** → Read frontend-skill/references/DESIGN_SYSTEM_BRIDGE.md
- **Building dashboard?** → Path A walkthrough
- **Building landing page?** → Path B walkthrough
- **Building SaaS/app?** → Path C walkthrough
- **Need templates?** → Check `assets/` folders
- **Need components?** → ui-design-brain/references/INDEX.md

---

## ✨ Quick Cheat Sheet

### Path A: Solo ui-design-brain
```
1. Copy assets/FOUNDATION.template.config.js → tailwind.config.js
2. Fill in values + pick preset
3. Open SKILL.md → Follow Steps 1–6
4. Build components using "Life System"
5. Ship
```

### Path B: Solo frontend-skill
```
1. Copy assets/PRODUCT_STRATEGY.template.md → PRODUCT_STRATEGY.md
2. Fill in strategy (visual thesis, colors, motion, imagery)
3. Copy assets/PAGE_STRATEGY.template.md (per page)
4. Design in Figma
5. Hand off to dev team
```

### Path C: Both Together (Recommended)
```
Phase 1: Copy PRODUCT_STRATEGY.template.md → customize → commit
Phase 2: Copy FOUNDATION.template.config.js → fill from strategy → lock
Phase 3: Copy PAGE_STRATEGY.template.md (per page) → customize → validate
Phase 4: Run ui-design-brain Steps 1–6 with PAGE_STRATEGY as input
Phase 5: Validate with both skills' checklists → ship
```

---

## 🎓 Learning Path

**First time using these skills?**

1. **Read this guide** (you're doing it) — 15 min
2. **Read DESIGN_SYSTEM_BRIDGE.md** — 10 min (understand workflow)
3. **Pick a path** (A, B, or C) — 1 min
4. **Copy relevant template** (from assets/) — 1 min
5. **Customize template** — 1–2 hours (depends on path)
6. **Follow your skill's SKILL.md** — 2–20 hours (depends on path)
7. **Done** ✅

**Total time to first marvelous interface: 3–24 hours** (depending on path)

---

## 📞 Support

**Questions?**
- **"How do I use [skill]?"** → Read the SKILL.md file
- **"How do I integrate both?"** → Read DESIGN_SYSTEM_BRIDGE.md
- **"What template do I need?"** → Check assets/ folders
- **"What components exist?"** → ui-design-brain/references/INDEX.md
- **"Which path for my project?"** → Use the matrix above

**Issues?**
- Templates missing a section? → Customize them
- Preset doesn't match vibe? → Override in config
- Team disagreement? → Get consensus on PRODUCT_STRATEGY
- Existing project? → Retrofit strategy retroactively

---

## 🚀 Ready?

**Choose your path above and get started.** The templates are waiting. ✨

