# Page Strategy: [Page Name]

> **How to use this template:**
> Create one of these per page/feature. This document scopes the PRODUCT_STRATEGY to a specific page and guides all implementation decisions. Reference your PRODUCT_STRATEGY.md throughout.
>
> **Copy this template and customize:**
> Rename to `PAGE_STRATEGY_[page-name].md` (e.g., `PAGE_STRATEGY_home.md`, `PAGE_STRATEGY_pricing.md`)

---

## Page Metadata

- **Page name/URL:** `[e.g., /products or Product Listing]`
- **User journey step:** `[e.g., Discovery, Consideration, Purchase decision, Onboarding]`
- **Primary user:** `[e.g., Product manager, Developer, Marketer]`
- **Primary goal:** `[What should the user do? "Sign up for trial", "View documentation", "Compare plans"]`

---

## Visual Thesis

**How does this specific page express the product's visual strategy?**

Reference your PRODUCT_STRATEGY.md visual thesis, then adapt it for this page's context.

**Format:** One sentence describing the mood/purpose of this page.

**Examples:**
- Product Strategy: "Clarity through restraint"
  - Home page thesis: "Clarity at first glance—announce, don't explain"
  - Pricing page thesis: "Clarity through comparison—side-by-side, no confusion"
  - Docs page thesis: "Clarity through structure—scannable, findable, organized"

- Product Strategy: "Unexpected moments of joy within purposeful space"
  - Hero page thesis: "Announce with delight—a memorable moment"
  - Product demo page thesis: "Explain through play—interactive, engaging, confident"

**Your thesis for this page:**
```
[One sentence connecting this page to your product strategy]
```

---

## Content Plan (Scoped to This Page)

What content goes where, and what does each section accomplish?

**Hero Section**
- **What's the promise/headline?** `[The main thing the user needs to know first]`
- **What's the visual?** `[Image, video, or interactive element]`
- **Where's the primary CTA?** `[Button text and action]`
- **Does it work without the image?** `[If yes, image is too weak. Redesign.]`

*Reference PRODUCT_STRATEGY.md content plan template for standard approach.*

**Support Section** (if needed)
- **What does it prove?** `[One benefit, feature, or proof point—not multiple]`
- **How does it show it?** `[Screenshot, feature highlight, metric, customer quote]`
- **What's the call to action?** `[Secondary CTA or no action]`

**Detail Section** (if needed)
- **What's the deeper narrative?** `[Use case? Workflow? Customer story? Atmosphere?]`
- **Is it essential, or nice-to-have?** `[If nice-to-have, consider removing it]`
- **How long should it take to scan?** `[Target: 15–30 seconds]`

**Final CTA Section**
- **What action closes this page?** `[e.g., "Start free trial", "Contact sales", "View all features"]`
- **How prominent should it be?** `[Primary (bold, large) or secondary (subtle)]`
- **What happens after the user clicks?** `[Where do they go? What's the next step?]`

---

## Visual Hierarchy & Layout

How is this page structured? What's most important?

**Section Weight** (lightest to heaviest):
```
[ ] Hero — establishes promise
[ ] Support — proves one idea
[ ] Detail — deepens story (if needed)
[ ] CTA — converts
```

**Spacing Strategy:**
- Related elements: tight spacing (8–16px per ui-design-brain)
- Unrelated sections: generous spacing (32–64px per ui-design-brain)
- Mobile: preserve vertical rhythm, reduce horizontal padding

**Imagery Anchors:**
- How many images on this page? `[Aim for 1–3 maximum]`
- Where's the dominant visual anchor? `[Hero, or elsewhere?]`
- Do all images serve narrative purpose, or are any decorative? `[Remove decorative ones]`

**Typography Hierarchy:**
- Largest text: `[Hero headline size from PRODUCT_STRATEGY]`
- Supporting text: `[Subheading size]`
- Body text: `[Paragraph size]`
- Smallest text: `[Captions, labels]`
- *Validate: Can I scan just the headlines and understand the page?*

---

## Interaction Moments

Which 2–3 motions from PRODUCT_STRATEGY apply to this page?

**Reference your motion language** from PRODUCT_STRATEGY.md:

**Entrance Motion:**
- What reveals as the page loads? `[Hero section? All at once? Staggered?]`
- Which archetype? `[Scale + fade? Slide? Fade only?]`
- Duration & easing: `[From PRODUCT_STRATEGY]`

**Scroll Motion** (if applicable):
- Is there a scroll-linked effect? `[Parallax? Sticky element? Depth shift?]`
- What's moving? `[Hero image? Background? Section position?]`
- Effect: `[From PRODUCT_STRATEGY scroll archetype]`

**Interaction Motion** (hover, click, state change):
- Buttons: `[Scale + color shift from PRODUCT_STRATEGY]`
- Links: `[Underline grow? Color shift?]`
- Cards: `[Hover lift? Shadow? None?]`

**Loading/State Feedback:**
- What loads on this page? `[Images? Forms? API data?]`
- Loading state: `[Skeleton screen or spinner?]`
- Error state: `[How do we communicate failure?]`
- Success state: `[Toast? Highlight? Redirect?]`

**Constraint:** Never invent motions outside your product motion language. Every animation should come from PRODUCT_STRATEGY.

---

## Content Specifics

Exact copy, imagery, and data for this page.

**Headlines:**
```
Hero headline: [copy]
Subheading: [copy]
Section 2 title: [copy]
Section 3 title: [copy]
CTA button: [verb + object, e.g., "Start free trial"]
```

**Body Copy:**
```
Hero description: [one sentence max, scannable]
Support section: [one sentence max]
Detail section: [2–3 sentences max]
CTA supporting text: [optional, very brief]
```

**Imagery:**
```
Hero image: [filename, dimensions, alt text]
Support visual: [type, dimensions, alt text]
Detail visual: [type, dimensions, alt text]
Decorative elements: [if any—consider removing]
```

**Forms/Inputs** (if applicable):
```
Fields: [Name, Email, Message, etc.]
Validation rules: [Required? Format constraints?]
Success state: [What happens after submit?]
Error state: [How do we show validation failures?]
```

---

## Mobile Behavior

How does this page respond to small screens?

**Viewport Budget:**
- Hero height on mobile (375px width): `[target: full screen - header]`
- Section spacing: `[maintain vertical rhythm, reduce horizontal padding]`
- Images: responsive delivery via srcset, lazy-load below-fold

**Touch Targets:**
- All interactive elements ≥ 44px × 44px
- No hover-dependent content (redundant with click)
- Form inputs: large enough for thumbs

**Reflow:**
- Multi-column sections: stack to single column at <768px
- Type sizes: scale down proportionally (use `clamp()`)
- Spacing: maintain hierarchy but more compact

**Images on Mobile:**
- Aspect ratios: crop differently for vertical screens
- Alternative crops or different image entirely?
- Loading: lazy-load sections below fold

---

## Accessibility Checklist

Does this page meet WCAG AA standards?

**Color & Contrast:**
- [ ] All text: 4.5:1 minimum (WCAG AA)
- [ ] UI elements: 3:1 minimum
- [ ] Test with contrast checker
- [ ] Never color-only (always pair with icon/text/pattern)

**Keyboard Navigation:**
- [ ] All interactive elements reachable via Tab
- [ ] Focus order matches visual order (left-to-right, top-to-bottom)
- [ ] Focus outline visible (minimum 2px, not removed)

**Images & Text:**
- [ ] Every image has descriptive alt text
- [ ] Headings use proper hierarchy (`<h1>`, `<h2>`, not skipped)
- [ ] Links have clear labels (not "click here")
- [ ] Form labels always visible (paired with inputs)

**Motion:**
- [ ] `prefers-reduced-motion` respected (static alternative provided)
- [ ] No auto-playing videos or animations
- [ ] No content flashes more than 3x per second

**Semantic HTML:**
- [ ] Proper landmark elements (`<nav>`, `<main>`, `<article>`)
- [ ] Form inputs with `<label>` tags
- [ ] Lists use `<ul>` or `<ol>`
- [ ] Buttons are `<button>`, not `<div onclick>`

---

## Validation Checklist

Before sending to implementation, verify:

**Visual Strategy:**
- [ ] **Brand clear?** Is the product name/logo unmistakable in first viewport?
- [ ] **One visual anchor?** Is there one dominant image/element?
- [ ] **Scannable?** Can I read just the headers and understand the page?
- [ ] **Each section one job?** Does each section have a single purpose (announce, prove, deepen, convert)?

**Content:**
- [ ] **No filler?** Can I delete 20% and improve the page? (If yes, delete it)
- [ ] **Copy tone consistent?** Does it match PRODUCT_STRATEGY voice?
- [ ] **Imagery intentional?** Does every image serve narrative purpose?
- [ ] **CTAs clear?** Are they verb + object? (e.g., "Start free trial", not "Submit")

**Design:**
- [ ] **Premium feel?** Would it still look good without decorative shadows?
- [ ] **Motion meaningful?** Does every animation improve hierarchy or atmosphere?
- [ ] **Responsive?** Works at 375px, 768px, 1440px+?
- [ ] **Accessible?** All litmus checks passed?

**Ready for Implementation:**
- [ ] PAGE_STRATEGY complete and reviewed
- [ ] All validation checks passed
- [ ] Team agrees on visual direction
- [ ] Imagery sourced and ready
- [ ] Copy approved

---

## Implementation Notes

Pass this section to the developer running ui-design-brain.

**Key Constraints:**
```
✅ Use PRODUCT_STRATEGY color system — no new colors
✅ Use PRODUCT_STRATEGY motion language — no ad-hoc animations
✅ Use PRODUCT_STRATEGY typography scale — no custom sizes
✅ Build all UI states: empty, loading, error, success
❌ Don't override tailwind.config.js values
❌ Don't invent components — use references/INDEX.md
❌ Don't skip accessibility (keyboard nav, contrast, alt text)
```

**Deliverables Expected:**
- [ ] Component list from ui-design-brain Step 4
- [ ] All UI states designed
- [ ] Mobile layout tested at 375px
- [ ] Accessibility validated
- [ ] Performance: images optimized, animations GPU-composited

**Review Gate:**
- This page passes both frontend-skill + ui-design-brain validation checklists before shipping

---

## Sign-Off

- **Designer:** `[Name/Date]` — Visual thesis and content approved
- **Product:** `[Name/Date]` — User goal and content strategy approved
- **Developer:** `[Name/Date]` — Implementation feasible and constraints understood

---

**Questions?** Reference:
- [PRODUCT_STRATEGY.md](../PRODUCT_STRATEGY.md) — for product-level rules
- [DESIGN_SYSTEM_BRIDGE.md](../references/DESIGN_SYSTEM_BRIDGE.md) — for workflow context
