# AP-W13 — Leave dead code (old states, memos, handlers) after replacing a JSX section

**Category:** Ui
**Status:** active
**Related Rule:** R-105
**Applies To:** all

## Problem

CI lint failure; confuses future agents about what is active

## Prevention

Run `grep -n "NomeVarAntiga"` post-replacement; `npm run lint` before commit
