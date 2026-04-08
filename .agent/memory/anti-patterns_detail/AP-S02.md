# AP-S02 — Use `.optional()` for fields that can be `null`

**Category:** Schema
**Status:** active
**Related Rule:** R-085
**Applies To:** all

## Problem

Zod rejects `null` from APIs/databases, 400 error

## Prevention

Use `.nullable().optional()` for fields that can receive `null`
