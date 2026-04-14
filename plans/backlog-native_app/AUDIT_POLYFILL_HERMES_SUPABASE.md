# Auditoria: Polyfills Hermes × Supabase JS v2 — Sessão H5.2 (2026-04-13/14)

> **Status:** 🟡 Polyfills + refresh + timezone resolvidos — fix totalTaken (`1430d46`), a aguardar resultado de teste  
> **Branch:** `feature/hybrid-h5/today-dose`  
> **Último commit:** `1430d46` (totalTaken = logs.length — conta tomadas, não comprimidos)  
> **Próximo agente:** leia este documento inteiro antes de tocar em `polyfills.js`

---

## 1. Contexto Geral

### Stack mobile

| Camada | Versão |
|--------|--------|
| Expo Go | SDK 53 |
| React Native | ~0.79.x (bundled com SDK 53) |
| Hermes JS Engine | activado (default no Expo SDK 53) |
| `@supabase/supabase-js` | `^2.49.4` |
| `@supabase/postgrest-js` | (transitiva via supabase-js, ~1.17.x) |
| Plataforma de teste | iOS Simulator (macOS) |

### Problema raiz

O Hermes implementa `URL` e `URLSearchParams` **de forma parcial e inconsistente**. Algumas APIs existem no objecto mas lançam `"not implemented"` em uso real. Isso quebra o `@supabase/postgrest-js` que depende intensamente de `url.searchParams` para construir todas as queries REST.

---

## 2. Linha do Tempo dos Erros

### 2.1 Erro 1: `URLSearchParams.set is not implemented` (RESOLVIDO ✅)

**Quando apareceu:** Primeira execução do app após implementar `TodayScreen` + `dashboardService.js`

**Mensagem na tela:** `URLSearchParams.set is not implemented`

**Log relevante:**
```
ERROR  URLSearchParams.set is not implemented
```

**Causa raiz:** Hermes tem `global.URLSearchParams` mas as funções de mutação (`.set`, `.append`, `.delete`) existem no protótipo mas lançam `"not implemented"` quando chamadas em contexto real pelo Supabase.

**Fix tentado v1 (falhou):** `patchURLSearchParams()` com detection probe:
```js
function isNotImplemented() {
  try {
    new URLSearchParams().set('_test', '_val')
    return false  // ← Hermes NÃO lança aqui. Probe retorna false. Patch não é aplicado.
  } catch (e) {
    return e.message.includes('not implemented')
  }
}
if (isNotImplemented()) global.URLSearchParams = HermesURLSearchParams
```
O probe sintético passa porque o Hermes **não lança** em chamadas directas sobre um objecto criado manualmente — só lança quando chamado internamente pelo engine a partir de contexto Supabase/fetch.

**Fix v2 (funcionou ✅):** Substituição incondicional:
```js
global.URLSearchParams = HermesURLSearchParams  // sem if, sem probe
```
Confirmado pelo log: `[polyfill] URLSearchParams substituído — set: function`

---

### 2.2 Erro 2: PGRST125 `Invalid path specified in request URL` (🟡 EM PROGRESSO — Estratégia A v2 a aguardar teste)

**Quando apareceu:** Imediatamente após resolver o Erro 1

**Mensagem na tela:** `Invalid path specified in request URL`

**Log relevante (após fix v1 do LiveURLSearchParams, commit `6c959fc`):**
```
LOG  [live-sp] sync href: https://kwqjtdsqkkbebfiaxubb.supabase.co/rest/v1/protocols/?select=id%2Cname%2C...
LOG  [live-sp] sync href: https://kwqjtdsqkkbebfiaxubb.supabase.co/rest/v1/protocols/?user_id=eq.b0c9746c-...
LOG  [live-sp] sync href: https://kwqjtdsqkkbebfiaxubb.supabase.co/rest/v1/protocols/?active=eq.true
LOG  [live-sp] sync href: https://kwqjtdsqkkbebfiaxubb.supabase.co/rest/v1/protocols/?order=name.asc
ERROR  [useTodayData] getActiveProtocols ERRO: {"code":"PGRST125","details":null,"hint":null,"message":"Invalid path specified in request URL"}
```

---

### 2.3 Erro 3: `Maximum call stack size exceeded` (RESOLVIDO ✅ — commit `3e46e41`)

**Quando apareceu:** Imediatamente ao testar a Estratégia A (`3fd9af6`)

**Mensagem:** `[runtime not ready]: RangeError: Maximum call stack size exceeded (native stack depth)`

**Log do Expo:**
```
LOG  [polyfill] URL: Estratégia A — toString()+_searchPairs (bypass href/search setters)
LOG  [polyfill] URLSearchParams nativo: function function
LOG  [polyfill] URLSearchParams substituído — set: function
LOG  [supabase-init] URL: https://kwqjtdsqkkbebfiaxubb.supabase.co
LOG  [supabase-init] URLSearchParams.set type: function
ERROR  [runtime not ready]: RangeError: Maximum call stack size exceeded (native stack depth), js engine: hermes
```

**Stack trace revelou:** A recursão começa em `URL` (linha 53151, `SupabaseClient`), alternando infinitamente entre `anonymous` e `get` — ambos no mesmo bundle comprimido.

**Causa raiz confirmada:** No Hermes, o getter nativo de `href` chama `toString()` internamente (comportamento WHATWG: `href` = "serialize URL" = `toString()`). A implementação da Estratégia A fazia:

```js
URL.prototype.toString = function () {
  // ...
  var href = this.href    // ← this.href chama toString() nativo do Hermes
                          //   que agora é o NOSSO override → loop infinito
}
```

Fluxo da recursão:
```
SupabaseClient: new URL('https://...supabase.co')
  → toString() nosso
    → this.href
      → Hermes getter href = chama toString() (que agora é o nosso override)
        → this.href
          → Hermes getter href = chama toString()
            → ... (stack overflow)
```

**Fix (commit `3e46e41`):** Capturar o `toString` nativo **antes** de o substituir e usá-lo exclusivamente para obter o href base:

```js
;(function patchSearchParamsViaToString() {
  if (typeof URL === 'undefined') return

  // CRÍTICO: capturar antes de substituir — evita recursão infinita
  var _nativeToString = URL.prototype.toString

  URL.prototype.toString = function () {
    var href = _nativeToString.call(this)   // ← nativo, não passa pelo nosso override
    if (!this._searchPairs || !this._searchPairs.length) return href
    // ... constrói query string a partir de _searchPairs
  }
})()
```

**Lição aprendida (AP-H13 — a registar no DEVFLOW):**
> Ao substituir `URL.prototype.toString`, NUNCA ler `this.href` dentro do override. No Hermes, `href` getter chama `toString()` internamente. Sempre capturar o `toString` nativo **antes** de o substituir.

---

### 2.4 Erro 4: PGRST125 persiste após Estratégia A — trailing slash no path (🟡 A AGUARDAR TESTE — commit `22cfbae`)

**Quando apareceu:** Após corrigir o stack overflow (`3e46e41`), ao testar Estratégia A

**O que funcionou ✅:** Acumulação de 4 pares em `_searchPairs`:
```
LOG  [sp] set select = id,name,... → 1 pairs total
LOG  [sp] append user_id = eq.... → 2 pairs total
LOG  [sp] append active = eq.true → 3 pairs total
LOG  [sp] set order = name.asc → 4 pairs total
LOG  [sp-tostring] toString: https://...supabase.co/rest/v1/protocols/?select=...
```

**O que ainda falhou:** URL gerada tem `/protocols/` (com barra final) em vez de `/protocols`.

**Causa raiz:** O Hermes normaliza `new URL('https://host/path')` adicionando `/` no fim do path component → `https://host/path/`. O PostgREST rejeita `/protocols/?select=...` com PGRST125 — só aceita `/protocols?select=...`.

**Fix (commit `22cfbae`):** No `toString()` override, remover barra final do `base` antes de acrescentar `?` se não for a raiz do host:
```js
if (base.charAt(base.length - 1) === '/') {
  var afterProto = base.indexOf('//') + 2
  var firstPathSlash = base.indexOf('/', afterProto)
  if (firstPathSlash >= 0 && firstPathSlash < base.length - 1) {
    base = base.slice(0, -1)   // /protocols/ → /protocols
  }
}
```

**Lição aprendida (AP-H14 — a registar no DEVFLOW):**
> Hermes normaliza URLs adicionando `/` ao final do path em `new URL('https://host/table')`. PostgREST rejeita paths com trailing slash. Ao construir URLs para PostgREST no Hermes, sempre remover barra final antes de acrescentar query params.

---

## 3. Diagnóstico Profundo do PGRST125

### 3.1 O que o PGRST125 significa

PostgREST retorna PGRST125 quando a URL recebida não é reconhecida como um path válido na API REST. Isso pode acontecer por:
- URL sem query params (ex: `GET /rest/v1/protocols` sem `?select=...`)
- Path malformado (ex: barra dupla, path incorreto)
- Query param com formato inválido

### 3.2 O que os logs revelam

Os logs do `_sync()` mostram que **cada chamada `searchParams.set/append` sobrescreve os params anteriores**:

```
sync href: ...protocols/?select=id%2C...           ← só select
sync href: ...protocols/?user_id=eq.b0c9746c...    ← só user_id, select PERDIDO
sync href: ...protocols/?active=eq.true            ← só active, tudo antes PERDIDO
sync href: ...protocols/?order=name.asc            ← só order, tudo perdido
```

Isso confirma o **problema central**: o `LiveURLSearchParams` está a ser recriado a cada chamada `url.searchParams.xxx(...)` — cada novo acesso ao getter cria uma nova instância vazia (inicializada com o `href` corrente, que após cada `_sync` apenas tem o **último** param adicionado, não todos).

### 3.3 Por que o `_sync()` apaga os params anteriores

O fluxo real do `postgrest-js` é assim:

```js
// PostgrestTransformBuilder.ts linha 58 — select
this.url.searchParams.set('select', 'id,name,...')
//   ↑ cria LiveURLSearchParams(this.url)  ← _pairs = [] (href sem params)
//   ↑ .set('select', ...)                 ← _pairs = [['select', 'id,name,...']]
//   ↑ ._sync()                            ← url.href = base + '?select=id%2Cname...'

// PostgrestFilterBuilder.ts linha 115 — user_id
this.url.searchParams.append('user_id', 'eq.b0c9746c...')
//   ↑ cria LiveURLSearchParams(this.url)  ← _pairs = [['select','id,name,...']] (lerdo href corrente)
//   ... MAS o href setter (this._url.href = newHref) é IGNORADO pelo Hermes
//   Resultado: href permanece com apenas '?select=...'
//   ↑ NO PRÓXIMO ACESSO: href ainda tem só select → _pairs inicia só com select
//   ↑ .append() adiciona user_id → _pairs = [['select','...'], ['user_id','...']]
//   ↑ ._sync() → tenta escrever url.href, mas Hermes ignora o setter
```

**Hipótese A (mais provável):** O setter `url.href = newHref` é **silenciosamente ignorado** pelo Hermes quando chamado de dentro de um IIFE depois de URL ter sido patchada. O Hermes provavelmente protege o setter interno de `href` de substituição via `Object.defineProperty` aplicado externamente.

**Hipótese B:** O `patchHermesURL()` define setters para `protocol`, `hostname`, `pathname`, `search`, etc. a partir do `href`. Quando `_sync()` faz `this._url.href = newHref`, a implementação interna do Hermes pode re-parsear o href e substituir o objecto URL internamente — mas de forma que a referência `this._url` no próximo getter não reflicta a mutação (objecto re-criado internamente).

**Hipótese C:** `this._url.href = newHref` funciona correctamente, mas `splitHref` no próximo `_sync` não está a ler o href actualizado — lê do objecto URL interno que o Hermes mantém de forma lazy.

### 3.4 A evidência definitiva

Os logs mostram claramente:
- `sync href: ...?select=...` — primeiro sync OK
- `sync href: ...?user_id=...` — segundo sync **não inclui `select`**

Isso só é possível se, quando o segundo `new LiveURLSearchParams(urlObj)` é criado, o `urlObj.href` ainda tem **apenas** o estado inicial (sem o `select` adicionado pelo primeiro sync). Portanto: **`this._url.href = newHref` não persiste no Hermes**.

---

## 4. Abordagem Implementada (e por que falhou)

### 4.1 LiveURLSearchParams com `_sync(url.href)`

**Ficheiro:** `apps/mobile/polyfills.js`, IIFE `patchLiveURLSearchParams()` (linhas ~142–272)

**Ideia:** Em vez de deixar o `url` interno do Hermes gerir os params, manter os pares em `_pairs` e escrever `url.href` a cada mutação. No próximo acesso ao getter, inicializar `_pairs` a partir do `url.href` corrente → os params ficam "guardados" no href.

**Por que falhou:** O setter de `href` no objecto URL do Hermes não persiste quando chamado externamente via `urlObj.href = newHref`. Isso é visível nos logs: cada novo `LiveURLSearchParams` começa vazio (ou com o valor original do href), não com o href actualizado pelo sync anterior.

---

## 5. Estratégias Não Tentadas (para o próximo agente)

### Estratégia A — Interceptar `toString()` no objecto URL (MAIS PROMISSORA)

O `postgrest-js` lê a URL final via `url.toString()` (linha 122 de `PostgrestBuilder.ts`):

```ts
let res = _fetch(this.url.toString(), {...})
```

**Ideia:** Em vez de tentar escrever `url.href`, sobreescrever `url.toString()` directamente no objecto para retornar a URL com todos os params acumulados.

Cada `url` criado pelo postgrest-js começa como `new URL('...')`. Podemos interceptar na criação e adicionar um estado interno `_searchPairs` ao objecto:

```js
// Monkey-patch URL constructor para injectar _searchPairs
const OriginalURL = global.URL
global.URL = function HermesURL(url, base) {
  const obj = new OriginalURL(url, base)
  obj._searchPairs = []  // estado interno de params
  
  // Sobreescrever toString() para incluir _searchPairs
  obj.toString = function() {
    var pairs = this._searchPairs
    if (!pairs || !pairs.length) return this.href
    var qs = pairs.map(function(p) {
      return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1])
    }).join('&')
    var split = splitHref(this.href)
    return split.base + '?' + qs + split.hash
  }
  
  return obj
}
// Copiar statics
global.URL.createObjectURL = OriginalURL.createObjectURL
global.URL.revokeObjectURL = OriginalURL.revokeObjectURL
```

E o `searchParams` getter retorna um objecto que muta `_searchPairs` directamente (sem tentar escrever `href`):

```js
Object.defineProperty(URL.prototype, 'searchParams', {
  get: function() {
    return new LiveURLSearchParams(this)  // usa this._searchPairs
  }
})

// LiveURLSearchParams muta this._url._searchPairs (não href)
LiveURLSearchParams.prototype.set = function(name, value) {
  // actualiza this._url._searchPairs
  // NÃO chama _sync — não escreve href
}
```

**Vantagem:** Não depende do setter `href` funcionar. A URL correcta é construída apenas no `toString()` que o `fetch` chama — único ponto de leitura.

**Risco:** Substituir o constructor `URL` pode ser problemático se existirem outras partes do Supabase ou RN que fazem `instanceof URL`. Testar.

---

### Estratégia B — Substituir `fetch` para interceptar o URL antes do pedido

O `postgrest-js` chama `fetch(this.url.toString(), ...)`. Podemos envolver o `fetch` global para reconstruir a URL a partir dos params acumulados noutro lado:

```js
const origFetch = global.fetch
global.fetch = function(url, options) {
  // Se url tem um _searchPairs (injectado pela nossa estratégia A), usar toString() nosso
  // Caso contrário, passar directamente
  return origFetch(url, options)
}
```

Isto é mais frágil que a Estratégia A e mais difícil de debugar.

---

### Estratégia C — Usar `@supabase/postgrest-js` transpilado sem URL

Verificar se existe um modo de configurar o cliente Supabase/PostgREST para construir as queries como strings em vez de objectos `URL`. O `PostgrestClient` aceita um `url: string` e internamente faz `new URL(...)`. Poderia ser possível substituir a implementação de `PostgrestClient` pelo source JS puro sem usar `URL.searchParams`.

---

### Estratégia D — Downgrade do supabase-js para versão anterior ao uso de `url.searchParams`

Verificar nos changelogs do `@supabase/postgrest-js` quando foi introduzido o uso de `url.searchParams` em vez de string concatenation. Se existir uma versão que usa `url.search = '?' + qs`, essa versão funcionaria com o polyfill de `url.search` setter que já temos.

---

### Estratégia E — Usar `node-fetch` ou `cross-fetch` compatível com Hermes

Instalar `cross-fetch` ou outro polyfill de `fetch` que use `URL` de forma mais standard, e verificar se a cadeia de chamadas bypassa os problemas do `URL` interno do Hermes.

---

### Estratégia F — Testar se `url.search = '?select=...'` setter funciona

O `patchHermesURL()` define um setter para `url.search`. Se esse setter funciona (escreve para `href` via `this.href = ...`), podemos verificar se `url.search` é o mecanismo que realmente persiste.

Teste a adicionar nos logs:
```js
var testUrl = new URL('https://example.com/test')
testUrl.search = '?foo=bar'
console.log('[debug] url.search setter result:', testUrl.href)
// Se imprime 'https://example.com/test?foo=bar' → setter funciona
// Se imprime 'https://example.com/test' → setter é ignorado também
```

Isso responde à dúvida fundamental: **o setter de `href` é o problema, ou é o setter de `search`?**

---

## 6. Arquitectura do `postgrest-js` — Mapa Completo de Uso de URL

Para o próximo agente não precisar de re-investigar:

### Como a URL é criada

```ts
// SupabaseClient.ts linha 174
this.rest = new PostgrestClient(new URL('rest/v1', baseUrl).href, {...})

// PostgrestClient.ts linha 95
from(relation) {
  const url = new URL(`${this.url}/${relation}`)
  // → cria new URL('https://xxx.supabase.co/rest/v1/protocols')
}
```

### Como os params são adicionados (em ordem de execução para `.select().eq().eq().order()`)

```ts
// 1. PostgrestTransformBuilder.ts linha 58 — .select(columns)
this.url.searchParams.set('select', cleanedColumns)

// 2. PostgrestFilterBuilder.ts linha 115 — .eq(col, val)
this.url.searchParams.append(column, `eq.${value}`)
// Para .eq('user_id', userId):   append('user_id', 'eq.b0c9746c...')
// Para .eq('active', true):      append('active', 'eq.true')

// 3. PostgrestTransformBuilder.ts linha 130 — .order(col)
this.url.searchParams.set(`order`, `${column}.asc`)

// URL final esperada:
// https://xxx.supabase.co/rest/v1/protocols
//   ?select=id%2Cname%2Cmedicine_id%2Cfrequency%2Ctime_schedule%2Cdosage_per_intake%2Ctitration_status
//   &user_id=eq.b0c9746c-c4d9-4954-a198-59856009be26
//   &active=eq.true
//   &order=name.asc
```

### Como a URL é lida para o fetch

```ts
// PostgrestBuilder.ts linha 122
let res = _fetch(this.url.toString(), {...})
```

**Ponto crítico:** `url.toString()` é o **único** lugar onde a URL é lida para o pedido HTTP. Se conseguirmos sobreescrever `toString()` por instância (não por protótipo), temos controlo total.

---

## 7. Estado Actual do `polyfills.js` (após commit `3e46e41`)

### Ordem das IIFEs (deve ser mantida)

```
1. patchHermesURL()              — Linhas 10–140
   - Patcha URL.prototype: protocol, hostname, port, host, pathname, search, hash, origin, username, password
   - NÃO patcha searchParams (propositadamente — patchSearchParamsViaToString assume controlo)
   - Usa needsPatch() para aplicar só se necessário (detecção funciona para getters)

2. patchSearchParamsViaToString() — Linhas 152–260  ← ESTRATÉGIA A (activa)
   - Captura _nativeToString = URL.prototype.toString ANTES de substituir (evita recursão)
   - Define URL.prototype.toString para construir URL a partir de url._searchPairs
   - Define URL.prototype.searchParams com getter que retorna DirectSearchParams(this)
   - DirectSearchParams muta url._searchPairs directamente (sem tocar em href)
   - NUNCA chama this.href dentro do override (causaria stack overflow no Hermes)

3. patchURLSearchParams()        — Linhas 262–371
   - Substitui global.URLSearchParams incondicionalmente por HermesURLSearchParams ES5 puro
   - FUNCIONA ✅ — para uso standalone (new URLSearchParams('foo=bar'))
   - NÃO relacionado com url.searchParams do postgrest-js (esse é tratado na IIFE 2)
```

### Logs esperados se a Estratégia A funcionar

```
LOG  [polyfill] URL: Estratégia A — toString()+_searchPairs (bypass href/search setters)
LOG  [polyfill] URLSearchParams nativo: function function
LOG  [polyfill] URLSearchParams substituído — set: function
LOG  [supabase-init] URL: https://kwqjtdsqkkbebfiaxubb.supabase.co
LOG  [supabase-init] URLSearchParams.set type: function
LOG  [sp] set select = id,name,... → 1 pairs total
LOG  [sp] append user_id = eq.b0c9746c... → 2 pairs total
LOG  [sp] append active = eq.true → 3 pairs total
LOG  [sp] set order = name.asc → 4 pairs total
LOG  [sp-tostring] toString: https://...supabase.co/rest/v1/protocols?select=...&user_id=...&active=...&order=...
```

**Sinal crítico de sucesso:** 4 pares acumulados (não apenas 1 por acesso) + `[sp-tostring]` mostrando URL completa com todos os params.

---

## 8. Hipótese de Trabalho — RESOLVIDA ✅

**Hipótese A confirmada (Passo 1, commit `2f12a27`, 2026-04-14):**

```
[diag-href] before: https://example.com/path/
[diag-href] after:  https://example.com/path/   ← INALTERADO — setter href ignorado
[diag-search] after search setter: https://example.com/path/  ← INALTERADO — setter search também ignorado
```

Ambos `url.href = x` e `url.search = x` são **no-ops silenciosos** no Hermes (Expo Go SDK 53, iOS Simulator).

**Acção tomada:** Implementar Estratégia A (commit `3fd9af6`) — ver Secção 5 para detalhes.

---

## 9. Ficheiros Chave

| Ficheiro | Relevância |
|----------|------------|
| `apps/mobile/polyfills.js` | O problema central — todas as IIFEs de patch |
| `apps/mobile/index.js` | Deve importar `./polyfills` ANTES de qualquer outro módulo (AP-H08) |
| `apps/mobile/src/platform/supabase/nativeSupabaseClient.js` | Cria o cliente Supabase; tem logs `[supabase-init]` |
| `apps/mobile/src/features/dashboard/services/dashboardService.js` | Primeira query a falhar (`getActiveProtocols`) |
| `apps/mobile/src/features/dashboard/hooks/useTodayData.js` | Hook que chama o service; tem logs granulares por query |
| `node_modules/@supabase/postgrest-js/src/PostgrestFilterBuilder.ts` | Usa `url.searchParams.append` para todos os filtros |
| `node_modules/@supabase/postgrest-js/src/PostgrestTransformBuilder.ts` | Usa `url.searchParams.set` para select e order |
| `node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts` linha 122 | `fetch(this.url.toString(), ...)` — único ponto de leitura da URL |

---

## 10. Memória DEVFLOW Relevante

| ID | Tipo | Descrição |
|----|------|-----------|
| AP-H11 | Anti-pattern | Detection probe para Hermes URLSearchParams — falha silenciosamente |
| AP-H12 | Anti-pattern | `url.searchParams` como accessor mutável — objectos desvinculados |
| R-165 | Regra | Substituição incondicional + LiveURLSearchParams (padrão a seguir) |
| AP-H08 | Anti-pattern | Não importar polyfills primeiro em index.js |
| R-162 | Regra | polyfills.js deve ser o primeiro import em index.js |

---

## 11. Próximos Passos (por prioridade)

### Passo 1 — Confirmar hipótese com teste diagnóstico (5 min)

Adicionar ao início de `polyfills.js` (antes de qualquer IIFE):
```js
var _hrefTest = new URL('https://example.com/path')
console.log('[debug] href setter test — before:', _hrefTest.href)
_hrefTest.href = 'https://changed.com/newpath'
console.log('[debug] href setter test — after:', _hrefTest.href)
// "after" == "changed.com" → setter funciona (bug noutro lado)
// "after" == "example.com" → setter ignorado → confirma hipótese
```

### Passo 2a — Se setter href é ignorado: implementar Estratégia A

Substituir `patchLiveURLSearchParams()` por uma abordagem que:
1. Intercepta a criação de URLs pelo postgrest-js (não é trivial)
2. **OU** sobreescreve `toString()` no protótipo para ler um `_searchPairs` acumulado na instância
3. O getter `searchParams` muta `url._searchPairs` directamente (bypass total do href)

```js
;(function patchSearchParamsViaToString() {
  if (typeof URL === 'undefined') return

  // toString() usa _searchPairs se existir, senão usa href normal
  var origToString = URL.prototype.toString
  URL.prototype.toString = function() {
    if (this._searchPairs && this._searchPairs.length) {
      var qs = this._searchPairs.map(function(p) {
        return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1])
      }).join('&')
      var href = origToString ? origToString.call(this) : this.href
      var q = href.indexOf('?')
      var base = q >= 0 ? href.slice(0, q) : href
      return base + '?' + qs
    }
    return origToString ? origToString.call(this) : this.href
  }

  // searchParams getter: retorna objecto que muta url._searchPairs
  Object.defineProperty(URL.prototype, 'searchParams', {
    get: function() {
      if (!this._searchPairs) this._searchPairs = []
      return new DirectSearchParams(this)
    },
    configurable: true,
  })

  function DirectSearchParams(urlObj) {
    this._url = urlObj
    // NÃO copiar de href — usar _searchPairs existente
    // (a primeira vez é [] vazio, correctamente)
  }

  DirectSearchParams.prototype.set = function(name, value) {
    var k = String(name), v = String(value), found = false, result = []
    var pairs = this._url._searchPairs
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === k) { if (!found) { result.push([k, v]); found = true } }
      else { result.push(pairs[i]) }
    }
    if (!found) result.push([k, v])
    this._url._searchPairs = result
    console.log('[sp] set', k, '→', this._url._searchPairs.length, 'pairs')
  }

  DirectSearchParams.prototype.append = function(name, value) {
    if (!this._url._searchPairs) this._url._searchPairs = []
    this._url._searchPairs.push([String(name), String(value)])
    console.log('[sp] append', String(name), '→', this._url._searchPairs.length, 'pairs')
  }

  // get, getAll, has, delete, toString, forEach idênticos ao LiveURLSearchParams
  // MAS sem _sync() — as mutações vão directamente para url._searchPairs

  console.log('[polyfill] URL: toString() + _searchPairs (bypass href setter)')
})()
```

**Porquê funciona:** `fetch(url.toString(), ...)` chama o nosso `toString()` sobreescrito, que lê `url._searchPairs` — um array JS puro que persiste na instância.

**Nota crítica:** `url._searchPairs` deve ser inicializado como `[]` na primeira vez que o getter é acedido, não a partir do `href` corrente. Isto porque o postgrest-js começa com uma URL limpa e vai adicionando params sequencialmente — não há params pré-existentes para preservar.

### Passo 2b — Se setter href funciona: investigar alternativa

Se o teste diagnóstico do Passo 1 mostrar que `href` setter funciona, o bug está no `splitHref()` ou na forma como `parsePairs` lê o href após o sync. Adicionar mais logs para comparar `urlObj.href` antes e depois de `_sync()`.

### Passo 3 — Testar se PGRST106 vs PGRST125

PostgREST tem dois códigos distintos:
- `PGRST106`: schema não encontrado
- `PGRST125`: path inválido — geralmente URL malformada ou sem parâmetros obrigatórios

O nosso erro é PGRST125, consistente com URL sem `select=` (PostgREST pode exigir `select` explícito em algumas configurações).

---

## 12. Informação Adicional — Schema da Tabela `protocols`

Confirmado via `docs/architecture/DATABASE.md`:

```
protocols:
  id               uuid (PK)
  medicine_id      uuid (FK)
  treatment_plan_id uuid (FK)
  name             text NOT NULL
  frequency        text  ← CHECK: 'diário','dias_alternados','semanal','personalizado','quando_necessário'
  time_schedule    jsonb (array de strings "HH:MM")
  dosage_per_intake numeric
  active           boolean DEFAULT true
  user_id          uuid FK NOT NULL
  titration_status text DEFAULT 'estável'
  ...
```

A query do `dashboardService.getActiveProtocols()` usa colunas **válidas**:
```js
.select('id, name, medicine_id, frequency, time_schedule, dosage_per_intake, titration_status')
.eq('user_id', userId)
.eq('active', true)
.order('name')
```

Portanto o PGRST125 **não é** causado por nome de coluna inválido — é causado pela URL malformada (sem params).

---

## 13. Commits Relevantes

| Hash | Descrição | Resultado |
|------|-----------|-----------|
| `1605c31` | Logs granulares em useTodayData + supabase-init | ✅ confirmou PGRST125 |
| `6c959fc` | LiveURLSearchParams v1 — _sync via url.href | ❌ falhou — href setter ignorado |
| `079776f` | Gemini fixes: stale closure + parseFloat vírgula | ✅ aplicado |
| `3c98a9d` | Gemini fixes: totalTaken quantity + pct >= 100 | ✅ aplicado |
| `387e65f` | Auditoria + memória DEVFLOW AP-H11/H12/R-165 | ✅ documentação |
| `2f12a27` | **P1 DIAGNÓSTICO**: logs setter href e search | ✅ confirmou: ambos os setters ignorados |
| `3fd9af6` | **Estratégia A**: toString()+_searchPairs | ❌ falhou — stack overflow (href→toString recursão) |
| `3e46e41` | fix stack overflow: capturar _nativeToString antes | ❌ falhou — PGRST125 persiste, trailing slash |
| `22cfbae` | **fix trailing slash**: remover '/' final do base | ✅ PGRST125 resolvido — queries OK |
| `7caa082` | **fix loop**: useRef para snapshot, deps=[] no useCallback | ✅ loop infinito resolvido |
| `aa68528` | fix errado: taken_at sem Z (violava padrão UTC do projecto) | ❌ revertido em 3bdc982 |
| `3bdc982` | **fix correcto**: boundaries UTC via parseLocalDate em getTodayLogs | 🟡 aguardar resultado de teste |

**Branch:** `feature/hybrid-h5/today-dose`

---

## 14. Resumo Executivo para o Próximo Agente

1. **O que funciona:** Autenticação Supabase, `getUser()`, polyfill de `URLSearchParams` standalone, todos os polyfills de `URL.prototype.getter` (protocol, hostname, etc.)

2. **O que não funciona:** `url.searchParams.set/append` do postgrest-js não consegue acumular params na URL — cada nova chamada ao getter recomeça com estado vazio porque `url.href = newValue` é silenciosamente ignorado pelo Hermes

3. **Próxima abordagem recomendada:** Estratégia A — sobreescrever `url.toString()` para construir a URL final a partir de `url._searchPairs` (array JS puro na instância) em vez de tentar persistir via `url.href`

4. **Antes de implementar:** Validar hipótese com o teste diagnóstico do Passo 1 (2 linhas de log)

5. **Não modificar:** `patchHermesURL()` (IIFE 1) — funciona correctamente para todos os getters/setters excepto searchParams. `patchURLSearchParams()` (IIFE 3) — funciona para uso standalone de URLSearchParams.
