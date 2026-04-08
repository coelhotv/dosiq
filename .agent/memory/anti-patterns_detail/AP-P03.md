# AP-P03 — O(n) synchronous computation in useMemo with n>100

**Category:** Performance
**Status:** active
**Related Rule:** R-117
**Applies To:** all

## Problem

`analyzeAdherencePatterns` + Zod validation on 500 objects in useMemo = Main Thread freeze, UI unresponsive 200-400ms

## Prevention

Wrap in `startTransition(() => { setState(heavyComputation()) })` to allow React to pause between frames
