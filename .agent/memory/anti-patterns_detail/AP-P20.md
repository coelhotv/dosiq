# AP-P20 — Show `"Paciente"` even when the user email already provides a safe local-part fallback

**Category:** Performance
**Status:** active
**Related Rule:** R-148
**Applies To:** all

## Problem

The consultation PDF loses clinical usefulness and makes it harder to distinguish which patient was exported

## Prevention

Derive the display label from the email handle, then fall back to `"Paciente"` only if no handle exists
