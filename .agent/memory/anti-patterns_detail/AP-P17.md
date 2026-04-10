# AP-P17 — `select('coluna_inexistente')` em query Supabase

**Category:** Performance
**Status:** active
**Related Rule:** R-089
**Applies To:** all

## Problem

HTTP 400 Bad Request silencioso. UI mostra "Erro ao carregar dados" sem mensagem clara. Ex: `status` em `medicine_logs` não existe

## Prevention

Manter JSDoc sincronizado com schema. Verificar colunas em `docs/architecture/DATABASE.md` antes de adicionar ao select
