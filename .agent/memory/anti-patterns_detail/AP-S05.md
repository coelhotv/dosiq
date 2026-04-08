# AP-S05 — Use Express-style `res.json()` in Vercel serverless

**Category:** Schema
**Status:** active
**Related Rule:** R-086
**Applies To:** all

## Problem

Response may not be sent correctly

## Prevention

Use `res.status(code).json(body)` for Vercel compatibility
