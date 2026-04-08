# AP-W17 — Componente com estado interno inicializado de uma prop (`complexityMode`) não reinicializa quando a prop muda

**Category:** Ui
**Status:** active
**Related Rule:** R-109
**Applies To:** all

## Problem

Defaults de expansão de seções ficam presos no valor do primeiro render; UX inconsistente ao mudar complexidade

## Prevention

Usar `key={controllingProp}` no componente para forçar remount completo quando o prop que define os defaults muda
