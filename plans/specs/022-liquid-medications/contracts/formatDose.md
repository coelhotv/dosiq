# Contract: `formatDose(value, unit)` (helper core)

**Arquivo**: `packages/core/src/utils/doseUnit.js` (extensão — **não** arquivo novo) · **Status**: aditivo (não-breaking)

## Assinatura
```javascript
formatDose(value: number|null|undefined, unit: 'ml'|'gotas'|'UI'|string): string
```

## Comportamento
| Input | Output |
|-------|--------|
| `(15, 'gotas')` | `"15 gotas"` |
| `(1, 'gotas')` | `"1 gota"` (singular) |
| `(2.5, 'ml')` | `"2,5 ml"` (vírgula decimal) |
| `(100, 'UI')` | `"100 UI"` |
| `(null, *)` / `(undefined, *)` | `""` |
| `(x, outro)` | `"{x} {unit}"` (fallback) |

## Regras
- Reusa `formatNumberPtBR` (vírgula decimal + milhares corretos) — **não** `.replace('.',',')` ingênuo.
- `gotas` faz singular/plural inline (`pluralizeDoseUnit` devolve "unidade(s)", não serve).
- Definição vive **só no core**; `apps/web/src/schemas/*` faz `export *` ⇒ callers não tocam (AP-199).

## Consumidores
`api/notify.js`, `server/bot/callbacks/doseActions.js`, UI de timeline/banner.
