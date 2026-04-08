# AP-P18 — Hardcode PDF header/card geometry and render long labels with fixed single-line `text()` calls

**Category:** Performance
**Status:** active
**Related Rule:** R-146
**Applies To:** all

## Problem

Title/patient overlap, clipped headers, and layout churn every time content length changes

## Prevention

Centralize layout constants and use `splitTextToSize()` or explicit width limits for any header/title/patient block
