---
id: AP-D01
title: Count DISTINCT protocols when you need to count doses (`COUNT(DISTINCT protocol_id)` instead of `SUM(jsonb_array_length(time_schedule))`)
summary: Protocol A with ["08:00", "20:00"] = 2 doses expected. `COUNT(DISTINCT)` returns 1 (protocol), not 2
applies_to:
  - all
tags:
  - datetime
  - design
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-121
layer: warm
bootstrap_default: False
pack: schema-data
---

# AP-D01 — Count DISTINCT protocols when you need to count doses (`COUNT(DISTINCT protocol_id)` instead of `SUM(jsonb_array_length(time_schedule))`)

**Category:** Design
**Status:** active
**Related Rule:** R-121
**Applies To:** all

## Problem

Protocol A with ["08:00", "20:00"] = 2 doses expected. `COUNT(DISTINCT)` returns 1 (protocol), not 2 (doses). Adherence: 12 logs / 10 protocols = 120% instead of 12/12 = 100%

## Prevention

Use `jsonb_array_length(time_schedule)` to count actual dose slots per protocol; `SUM()` not `COUNT()` in aggregation


**Problem:** Designers and developers default to 1px borders to separate UI elements. This violates the project's product design strategy which explicitly forbids hard lines in favor of tonal/background separation.

**Impact:**
- Visual clutter and noise
- Harder to scan information
- Contradicts established design system
- Requires rework to match product vision

**Real case (Wave 7 Desktop Tabular Layout — 2026-03-25):**
```css
/* ❌ WRONG — 1px borders (product design violation) */
.protocol-row__cell {
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}

/* ✅ CORRECT — Tonal row alternation */
.protocol-row__cell {
  background-color: var(--surface);
}
.protocol-row--even .protocol-row__cell {
  background-color: var(--surface-container-low);
}
/* No borders, visual separation via background color */
```

**Product design rule:** Never use 1px borders. Use:
- **Tonal separation** (different background colors) for row alternation
- **Whitespace** for card separation
- **Shadows** for elevation (sparingly)
- **Color overlays** for interactive states

**Prevention:**
- Before adding ANY border, ask: "Can I achieve this with background color instead?"
- Reference the product design strategy in `@plans/redesign/references/PRODUCT_STRATEGY_CONSOLIDATED.md`
- Check existing redesign components for tonal patterns

**Related:** Product design system (Redesign Wave 6.5+)

---
