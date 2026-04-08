# AP-W16 — `bail: 1` em vitest.critical.config.js mascara múltiplas falhas timezone no mesmo arquivo

**Category:** Ui
**Status:** active
**Related Rule:** R-106
**Applies To:** all

## Problem

CI reporta apenas o PRIMEIRO teste que falha; outros testes timezone-dependentes no mesmo arquivo ficam ocultos, gerando múltiplos ciclos de fix

## Prevention

Rodar `test:critical` sem bail localmente (ou temporariamente) para revelar TODAS as falhas no arquivo antes de commitar
