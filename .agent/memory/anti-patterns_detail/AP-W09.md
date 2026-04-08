# AP-W09 — Refactor Dashboard.jsx handlers when a new component has incompatible interface

**Category:** Ui
**Status:** active
**Related Rule:** R-098
**Applies To:** all

## Problem

High risk of breaking SmartAlerts, LogForm integrations in 932-line file

## Prevention

Create thin adapter functions (D-01 pattern); never refactor existing handlers for new components
