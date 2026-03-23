# Design System Bridge: frontend-skill ↔️ ui-design-brain

These two skills are designed to work independently OR together for maximum impact.

- **frontend-skill** = "What should this feel like, and why?"
- **ui-design-brain** = "How do we make it feel that way, systematically?"

When paired, they create a workflow that prevents divergence, speeds implementation, and ensures every page feels intentional.

---

## Quick Decision: Which Path?

### Path A: Quick Internal Tool (Solo ui-design-brain)
**When to use:** Admin dashboard, internal CRUD, utility-first project
**Output quality:** Professional and functional
**Risk:** Generic feel, page-to-page inconsistency

### Path B: Real Product (frontend-skill + ui-design-brain) 🚀
**When to use:** Customer-facing landing page, multi-page SaaS, app with multiple sections
**Output quality:** Marvelous — intentional, coherent, premium
**ROI:** 3x faster implementation, 90% fewer rework cycles

---

## The Full Workflow (Path B)

### Phase 1: Product Strategy (Once Per Product)
**Skill:** frontend-skill Part A
**Deliverable:** `PRODUCT_STRATEGY.md`
**Time:** 1–2 hours

Define: visual thesis, content plan template, motion language, color system, typography, imagery charter.

### Phase 2: Foundation Setup
**Skill:** ui-design-brain Step 2 + Step 3
**Deliverable:** `tailwind.config.js` with locked colors, typography, motion
**Time:** 1–2 hours

Read `PRODUCT_STRATEGY.md` → map to preset → lock down "Life System" values.

### Phase 3: Page Strategy (Per Page)
**Skill:** frontend-skill Part B
**Deliverable:** `PAGE_STRATEGY.md`
**Time:** 15–30 min per page

Define: visual thesis for this page, content plan, interaction moments.

### Phase 4: Page Implementation
**Skill:** ui-design-brain Steps 1–6
**Deliverable:** Coded page
**Time:** 1–2 hours

Read `PAGE_STRATEGY.md` → implement with strategy as guardrails → all decisions cascade from upstream.

### Phase 5: Validation (Both Skills)

**frontend-skill litmus checks:**
- Is brand unmistakable in first screen?
- Is there one visual anchor?
- Can page be understood by scanning headlines?
- Does each section have one job?
- Is text accessible (WCAG AA)?

**ui-design-brain validation:**
- Does page express the visual thesis?
- All animations from product motion language?
- Using product color system?
- Following product typography scale?
- All states designed? Keyboard nav? Mobile?

---

## ROI: Why This Matters

### Without Integration (Solo ui-design-brain)
- Preset decision per project: 30 min
- Color/motion decisions per page: ~15 min each × 5 pages = 75+ min
- Rework due to inconsistency: 30% of build time
- **Total for 5-page site: ~50 hours**

### With Integration (Both Skills)
- Product strategy once: 2 hours
- Foundation setup: 2 hours
- Page strategy per page: 20 min × 5 pages = 100 min
- Implementation: 1.5 hours × 5 pages = 7.5 hours
- Rework due to divergence: ~5%
- **Total for 5-page site: ~15 hours** ✅

**Savings: 35 hours per project.**

---

## Common Questions

**Can I use frontend-skill without ui-design-brain?**
Yes. You get a beautiful design document, but implementation is slower and riskier.

**Can I use ui-design-brain without frontend-skill?**
Yes. You get solid components, but output may feel generic or lack narrative coherence.

**What if I'm mid-project?**
Extract your current colors/motion into `PRODUCT_STRATEGY.md` retroactively, then guide new work with it.

**What if the team disagrees on visual thesis?**
Make it a product decision, not a design decision. Get buy-in from product + design + lead dev.

---

## Templates

### PRODUCT_STRATEGY.md Template
```markdown
# Product Strategy

## Visual Thesis
[One sentence: mood, material, energy]

## Content Plan Template
- **Hero:** [What goes in every page?]
- **Support:** [One feature, proof, or offer]
- **Detail:** [Atmosphere, workflow, or story]
- **Final CTA:** [Action]

## Motion Language
- **Entrance:** [description + timing]
- **Scroll-linked:** [description + effect]
- **Hover:** [description + effect]

## Color System
- **Accent:** #XXXXXX
- **Background:** #XXXXXX
- **Text:** #XXXXXX
- **Muted:** #XXXXXX

## Typography
- **Display:** [Font name]
- **Body:** [Font name]
- **Mono:** [Font name]

## Imagery Charter
- **Style:** [real photography / illustration / 3D]
- **Aspect ratios:** [hero 16:9, sections 4:3, etc.]
- **Tone:** [bright / moody / documentary]
```

### PAGE_STRATEGY.md Template
```markdown
# Page Strategy: [Page Name]

## Visual Thesis
[How does this express the product strategy?]

## Content Plan
- **Hero:** [title, image, CTA]
- **Support:** [what does it prove?]
- **Detail:** [atmosphere or workflow]
- **Final CTA:** [action]

## Interaction Moments
[Which 2–3 motions from PRODUCT_STRATEGY apply here?]

## Validation
- [ ] Brand unmistakable in first viewport?
- [ ] One visual anchor?
- [ ] Scannable by headlines?
- [ ] Each section one job?
- [ ] All motions from product language?
```

---

## Final Word

These skills are designed for intentionality. Whether you use them solo or together, the goal is the same: **interfaces that feel designed for their specific product, not like default output.**

If you're shipping something users care about, use both. The setup time pays off immediately.
