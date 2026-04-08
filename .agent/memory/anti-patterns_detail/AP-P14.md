# AP-P14 — `supabase.auth.getUser()` chamado em cada `getUserId()` sem cache

**Category:** Performance
**Status:** active
**Related Rule:** R-128
**Applies To:** all

## Problem

13 HTTP roundtrips no primeiro load do Dashboard (~8s em 4G). Cada service que chama `getUserId()` dispara um roundtrip independente

## Prevention

Cache em memória + promise coalescence no módulo. Invalidar em `onAuthStateChange` (SIGNED_IN/SIGNED_OUT)
