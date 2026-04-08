# AP-P19 — Reuse monthly totals in each daily PDF row or mix pill-quantity math into a table labeled as daily dose adherence

**Category:** Performance
**Status:** active
**Related Rule:** R-147
**Applies To:** all

## Problem

Daily rows show inflated totals like `360/360` or mismatch the clinical meaning of `Tomadas` vs `Esperadas`, confusing patients and clinicians

## Prevention

For the PDF daily table, compare expected vs completed dose events for that specific day only, excluding future slots; if quantity-based adherence is needed, expose it in a separate metric with explicit labeling
