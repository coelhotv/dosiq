# AP-B04 — Barrel exports (`index.js`) que re-exportam todos os services incluindo os de features lazy

**Category:** Build
**Status:** active
**Related Rule:** R-117
**Applies To:** all

## Problem

`@shared/services/index.js` exporta `stockService`, `adherenceService`, etc. Qualquer `import { x } from '@shared/services'` puxa TODA a árvore de dependências para o main bundle, quebrando code-splitting.

## Prevention

Importar services diretamente do arquivo fonte (`from '@stock/services/stockService'`) em vez de barrel exports. Ou dividir barrel em sub-barrels por feature.
