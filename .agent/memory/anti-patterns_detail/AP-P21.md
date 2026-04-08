# AP-P21 — Using `takenAnytime` as the numerator for clinical adherence summaries

**Category:** Performance
**Status:** active
**Related Rule:** R-026
**Applies To:** all

## Problem

A protocol with multiple time slots per day counts the same day several times, inflating `taken/expected` (e.g., `360/360` or `466/466` from a real 30d period)

## Prevention

Use the actual dose-count metric (`taken`) for consultation/PDF summaries; reserve `takenAnytime` for auxiliary heuristics only
