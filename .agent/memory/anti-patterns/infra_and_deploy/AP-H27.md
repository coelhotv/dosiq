---
id: AP-H27
title: Import relativo cross-boundary quebra após git mv em monorepo
status: active
layer: warm
trigger_count: 1
last_triggered: 2026-04-19
tags:
  - monorepo
  - git-mv
  - tests
  - import
  - migration
---

# AP-H27 — Import Relativo Cross-Boundary Quebra Após git mv

## Symptom
`Failed to resolve import "../../../../server/services/protocolCache.js"` — teste falha ao resolver caminho para diretório fora do workspace movido.

## Context
Sprint 7.3 — `src/` movida para `apps/web/src/`. Teste em `src/services/api/__tests__/proactiveStockAlerts.test.js` importava `../../../../server/` que resolvia corretamente da raiz (4 níveis = root). Após o move para `apps/web/src/services/api/__tests__/`, 4 níveis sobem apenas até `apps/web/` — `server/` não está lá.

## Fix
Contar novamente os níveis após o move:
- Antes: `src/services/api/__tests__/` → 4 níveis acima = root → `server/`
- Depois: `apps/web/src/services/api/__tests__/` → 6 níveis acima = root → `server/`
- Corrigir: `../../../../server/` → `../../../../../../server/`

## Prevention
Antes de qualquer `git mv` que mude profundidade de diretório, grepar todos os testes por imports relativos que cruzam boundaries de workspace (`../../..server/`, `../../..api/`, etc.). Ajustar o número de `../` após o move.

```bash
grep -r "\.\.\/\.\.\/.*server\/" apps/web/src --include="*.test.js" -l
grep -r "\.\.\/\.\.\/.*api\/" apps/web/src --include="*.test.js" -l
```
