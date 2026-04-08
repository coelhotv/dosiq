# AP-P12 — Mesma query Supabase chamada N vezes em sub-funções paralelas

**Category:** Performance
**Status:** active
**Related Rule:** R-125
**Applies To:** all

## Problem

`getAdherenceSummary` chamava 3 sub-funções que cada uma buscava `protocols` independentemente = 3 queries idênticas em `Promise.allSettled`

## Prevention

Buscar dados compartilhados UMA VEZ na função orquestradora e passar como parâmetro para as sub-funções
