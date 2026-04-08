# AP-LOG-001 — Unfiltered `console.log()` statements in production UI code

**Category:** Logging
**Status:** active
**Related Rule:** R-145
**Applies To:** all

## Problem

50+ debug logs on Dashboard load polluteDevTools, confuse users, create noise that hides real errors. Makes troubleshooting harder (signal-to-noise ratio 1:50). Logs like "Processando 7 registros" add zero value

## Prevention

Always use `debugLog()` helper that checks `process.env.NODE_ENV === 'development'`. Remove logs that are "obvious" (e.g., "rendering component"). Keep only logs that help diagnose real issues. Log should provide actionable info
