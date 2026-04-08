# AP-W04 — Import context (`useDashboardContext`, `DashboardProvider`) in a Wave 1 component

**Category:** Ui
**Status:** active
**Related Rule:** R-095
**Applies To:** all

## Problem

Violates Wave 1 purity guardrail; couples component to context, breaking reuse

## Prevention

Wave 1 = props only. Context integration belongs in Onda 2 (parent passes data as props)
