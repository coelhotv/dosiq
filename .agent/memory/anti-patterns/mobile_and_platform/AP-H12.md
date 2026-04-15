---
id: AP-H12
title: Use url.searchParams getter as a mutable accessor in Hermes/RN
summary: url.searchParams cria um HermesURLSearchParams desvinculado a cada acesso. Mutações (.set/.append/.delete) são descartadas; URL chega ao PostgREST sem params → PGRST125.
applies_to:
  - apps/mobile/polyfills.js
tags:
  - mobile
  - expo
  - hermes
  - polyfill
  - supabase
  - postgrest
trigger_count: 1
last_triggered: 2026-04-13
expiry_date: 2027-04-13
status: active
related_rule: R-165
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-H12: url.searchParams como accessor mutável no Hermes/RN

## Problema

O getter `URL.prototype.searchParams` no Hermes (e na nossa versão patchada) cria um **novo** objecto `URLSearchParams` a cada acesso, inicializado com o search string corrente, mas sem qualquer ligação de volta ao URL. Mutações sobre esse objecto são descartadas quando o objecto sai de scope.

## Causa Raiz

O `@supabase/postgrest-js` usa `url.searchParams.set(...)` e `url.searchParams.append(...)` extensivamente para construir todos os query params:

```ts
// PostgrestTransformBuilder.ts linha 58
this.url.searchParams.set('select', cleanedColumns)

// PostgrestFilterBuilder.ts linha 115
this.url.searchParams.append(column, `eq.${value}`)
```

Com o getter a criar um objecto desvinculado, **todas as mutações são descartadas**. A URL final tem zero query params e chega ao PostgREST como `GET /rest/v1/protocols` — sem `select=`, sem filtros, sem `order=`.

PostgREST responde com PGRST125 "Invalid path specified in request URL".

## Impacto

- Erro visível na tela e no log: `PGRST125 Invalid path specified in request URL`
- Todos os métodos de query do Supabase JS quebrados no Hermes: `.select()`, `.eq()`, `.order()`, `.in()`, etc.
- Difícil de diagnosticar sem debug logging (o URL parece correcto nos logs de init)

## Prevenção

**LiveURLSearchParams com `_sync()`** — implementar um `URLSearchParams` que sincroniza mutações de volta ao `url.href` após cada `set/append/delete`:

```js
LiveURLSearchParams.prototype._sync = function () {
  // reconstruir url.href com os novos pares
  var newSearch = buildSearch(this._pairs)
  var split = splitHref(this._url.href)
  this._url.href = split.base + newSearch + split.hash
}

// Override do getter em URL.prototype
Object.defineProperty(URL.prototype, 'searchParams', {
  get: function () { return new LiveURLSearchParams(this) },
  configurable: true,
})
```

Cada acesso a `url.searchParams` cria um novo `LiveURLSearchParams` inicializado com o search corrente do `href`. Cada mutação chama `_sync()` que actualiza `url.href` directamente (o setter de `href` funciona no Hermes).

**Chave:** usar `splitHref(href)` para isolar `base + search + hash` directamente do `href` string, sem depender de getters como `url.search` ou `url.pathname` que podem estar ou não patchados.

## Ficheiros Afectados

- `apps/mobile/polyfills.js` — IIFE `patchLiveURLSearchParams()` (adicionada após `patchURLSearchParams`)

## Commits

- Diagnóstico: `1605c31` (logs granulares por query)
- Fix: `6c959fc` (LiveURLSearchParams implementado)
