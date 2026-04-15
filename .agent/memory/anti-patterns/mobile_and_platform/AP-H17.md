---
id: AP-H17
title: Attempt to use whatwg-url-without-unicode directly on Hermes (WebIDL crash)
summary: whatwg-url-without-unicode uses Symbol.for('[webidl2js] constructor registry') which is never initialized on Hermes. Crash: 'Cannot read property get of undefined' at URL.js line 54 (globalObject[ctorRegistry]['URL']). The custom polyfill in polyfills.js is the only working solution. Spike branch: spike/whatwg-url-polyfill.
applies_to:
  - apps/mobile/polyfills.js
tags:
  - mobile
  - hermes
  - polyfill
  - url
  - webidl
trigger_count: 1
last_triggered: 2026-04-14
expiry_date: 2027-04-14
status: active
related_rule: R-168
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-H17: whatwg-url-without-unicode crashes on Hermes (WebIDL ctorRegistry)

**Descoberto em:** 2026-04-14 (Spike session — Architecture Review)
**Tempo perdido:** ~30 min (spike rápido com hipótese clara)
**Severidade:** BLOQUEANTE — crash total ao arranque

---

## O Problema

Hipótese: o crash de `react-native-url-polyfill` (AP-H08) era do wrapper (`NativeModules.BlobModule`), não da lib subjacente. Se importássemos `whatwg-url-without-unicode` directamente, deveria funcionar.

**Resultado:** FAIL. A lib também crasha, mas por razão diferente.

## Causa Raiz

```javascript
// whatwg-url-without-unicode/lib/utils.js
const ctorRegistrySymbol = Symbol.for("[webidl2js]  constructor registry");

// whatwg-url-without-unicode/lib/URL.js (linha 50-54)
if (globalObject[ctorRegistry] === undefined) {
  // NÃO inicializa — assume que .install() foi chamado
}
const ctor = globalObject[ctorRegistry]["URL"];
//           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ undefined → crash
```

O Hermes não inicializa o `Symbol.for("[webidl2js] constructor registry")` no `globalThis`.
Em Node.js/browsers, a lib init configura isso. No Hermes, não existe.

## Dois crashes distintos, mesmo sintoma

| Lib | Crash message | Causa real |
|-----|--------------|-----------|
| `react-native-url-polyfill` | `Cannot read property 'get' of undefined` | `NativeModules.BlobModule` é `undefined` |
| `whatwg-url-without-unicode` | `Cannot read property 'get' of undefined` | `globalThis[ctorRegistry]` é `undefined` |

## Lição

Não basta remover o wrapper — a lib subjacente também assume um environment que o Hermes não fornece. O polyfill custom (Estratégia A) é a **única abordagem funcional**.

## Evidência

- Branch: `spike/whatwg-url-polyfill` (preservado no GitHub)
- Commit: `aa4a517`
- Documentação: `ARCHITECTURE_REVIEW_H5.md` Seção 11
