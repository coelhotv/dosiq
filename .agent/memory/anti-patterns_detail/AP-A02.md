# AP-A02 — Count logs (`.length`) instead of summing `quantity_taken` for adherence

**Category:** Adherence
**Status:** active
**Related Rule:** R-112
**Applies To:** all

## Problem

Patient taking 2 pills/dose with 1 log per day = 50% adherence calculated, 100% actual. Adherence underestimated.

## Prevention

Use `.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0) / expected * 100`
