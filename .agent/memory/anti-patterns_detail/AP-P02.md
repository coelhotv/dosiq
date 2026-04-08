# AP-P02 — Synchronous import of component >200 lines in mobile-critical view

**Category:** Performance
**Status:** active
**Related Rule:** R-116
**Applies To:** all

## Problem

Safari blocks Main Thread 200-400ms for parse/compile before first render (e.g., `SparklineAdesao` 518 ln)

## Prevention

Use `React.lazy()` + `<Suspense fallback>` for components >200 lines in view-level JSX
