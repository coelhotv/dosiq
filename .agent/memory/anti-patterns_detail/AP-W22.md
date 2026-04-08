# AP-W22 — Responsive Layout Using Inline Styles Instead of CSS Classes

**Category:** Ui
**Status:** active
**Related Rule:** None
**Applies To:** all

## Problem



## Prevention




**Anti-Pattern:** Managing responsive behavior (mobile flex column, desktop grid) with inline styles scattered across React component.

**Why it fails:**
- Inline styles are fragile and hard to audit
- Maintenance burden: changing layout requires code review
- Inconsistency: easy to accidentally use different breakpoints
- Performance: inline style objects recreated on every render

**Corrected in Wave 6.5:** Gemini Code Assist suggestion (declined in Wave 6.5 scope, but validated as best practice). All responsive layout moved to `.grid-dashboard` and `.cronograma-doses` CSS classes with media queries:
```css
.grid-dashboard {
  display: flex;
  flex-direction: column;
  /* mobile default */
}

@media (min-width: 1024px) {
  .grid-dashboard {
    display: grid;
    grid-template-columns: 1fr 2fr;  /* desktop: left narrow, right wide */
  }
}
```

**Prevention:**
- Use CSS classes for all responsive behavior, not inline styles
- Define breakpoints once in design tokens, reuse everywhere
- Review code: if you see `style={{}}` in render with conditionals, extract to CSS

---
