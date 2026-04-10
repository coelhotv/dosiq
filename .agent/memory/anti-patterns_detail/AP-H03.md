# AP-H03 — Estado isDoseModalOpen fora do DashboardProvider sem lazy load

**Category:** History
**Status:** active
**Related Rule:** R-095
**Applies To:** all

## Problem



## Prevention




**O que é:** Colocar o componente `GlobalDoseModal` fora da árvore do `DashboardProvider` porque o estado de controle (`isDoseModalOpen`) vive fora do provider.

**Problema:** `GlobalDoseModal` usa `useDashboard()` internamente; renderizá-lo fora do provider causa crash com "must be used within DashboardProvider".

**Correção:** Estado de controle fica em `AppInner` (fora do provider); componente `GlobalDoseModal` é lazy-loaded e renderizado DENTRO da árvore do `DashboardProvider`. O lazy import resolve o problema sem mover o estado.

*Last updated: 2026-03-28*
