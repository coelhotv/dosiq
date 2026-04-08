# AP-A03 — Filter logs with `medicine_id` in addition to `protocol_id`

**Category:** Adherence
**Status:** active
**Related Rule:** \
**Applies To:** all

## Problem

When 2+ protocols exist for same medicine, logs bleed between them. Protocol A's adherence = Protocol A's logs + Protocol B's logs.

## Prevention

Use ONLY `log.protocol_id === protocolId`, remove any `\
