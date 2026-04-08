# AP-P16 — Template UTC hardcoded em queries Supabase: `` `${date}T00:00:00.000Z` ``

**Category:** Performance
**Status:** active
**Related Rule:** R-131
**Applies To:** all

## Problem

Ignora fuso horário local. Em GMT-3 (Brasil), `2026-03-01T00:00:00.000Z` = 21:00 do dia anterior local. Logs do dia 01 às 22:00 BRT ficam de fora

## Prevention

Sempre usar `parseLocalDate(dateStr).toISOString()` para converter data local → UTC corretamente
