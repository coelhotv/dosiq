---
id: AP-H08
title: react-native-url-polyfill incompatível com Hermes/Expo Go SDK 53
summary: Todas as versões (v2, v3) causam 'Cannot read property get of undefined' no Hermes. Usar patch inline em polyfills.js em vez de qualquer pacote externo.
applies_to:
  - mobile
  - expo
  - hermes
  - react-native
tags:
  - mobile
  - expo
  - hermes
  - url
  - polyfill
trigger_count: 1
last_triggered: 2026-04-12
expiry_date: 2027-04-12
status: active
related_rule: R-162
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-H08: react-native-url-polyfill incompatível com Hermes/Expo Go SDK 53

**Descoberto em:** 2026-04-12 (Wave H4 — Mobile Scaffold)
**Tempo perdido:** ~1.5h de debugging com múltiplas hipóteses erradas
**Severidade:** CRÍTICO — crash total ao arranque, app não inicia

---

## O Problema

`react-native-url-polyfill` (todas as versões testadas: v2.0.0, v3.0.0) causa crash imediato
no Hermes/Expo Go SDK 53 com o erro:

```
TypeError: Cannot read property 'get' of undefined
  at Object.get [as url] (NativeModules.js)
  at ...
```

O pacote tenta substituir a implementação global de `URL`, mas o seu código interno usa
`NativeModules.RNCNetInfo` ou similar que não existe no Expo Go sem o módulo nativo correspondente.

### Versões testadas (todas falham)
- `react-native-url-polyfill@2.0.0` — crash
- `react-native-url-polyfill@3.0.0` — mesmo crash
- Importação em `index.js` — crash
- Importação em `polyfills.js` — crash
- Qualquer combinação de configuração — crash

---

## Por que o Hermes precisa de patch?

O Hermes (engine JS do React Native) tem implementação parcial de `URL`:
- `new URL('https://example.com')` — funciona ✅
- `new URL('...').href` — funciona ✅
- `new URL('...').protocol` — lança `"not implemented"` ❌
- `new URL('...').hostname` — lança `"not implemented"` ❌
- `new URL('...').port` — lança `"not implemented"` ❌
- `new URL('...').pathname` — lança `"not implemented"` ❌
- `url.protocol = 'wss:'` — lança `"Cannot assign to property which has only a getter"` ❌

O Supabase usa estes getters e setters em múltiplos lugares:
- `SupabaseClient` — lê `url.protocol` para verificar HTTPS
- `RealtimeClient` — faz `url.protocol = url.protocol.replace('https', 'wss')` ← setter obrigatório

---

## A Solução Correcta

**Patch cirúrgico inline** em `polyfills.js` — preenche apenas os getters/setters em falta,
sem substituir a implementação global de `URL`:

```js
;(function patchHermesURL() {
  if (typeof URL === 'undefined') return
  const proto = URL.prototype

  function needsPatch(prop) {
    try {
      new URL('https://example.com')[prop]
      return false
    } catch (e) {
      return typeof e.message === 'string' && e.message.includes('not implemented')
    }
  }

  function parseHref(href) {
    const m = href.match(
      /^([a-z][a-z0-9+\-.]*:)\/\/([^/:?#@]*)(?::(\d+))?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i
    )
    if (!m) {
      return { protocol: '', hostname: '', port: '', pathname: '/', search: '', hash: '', origin: 'null' }
    }
    const protocol = (m[1] || '').toLowerCase()
    const hostname = m[2] || ''
    const port = m[3] || ''
    return {
      protocol, hostname, port,
      pathname: m[4] || '/',
      search: m[5] || '',
      hash: m[6] || '',
      origin: `${protocol}//${hostname}${port ? ':' + port : ''}`,
    }
  }

  function define(prop, getter, setter) {
    if (!needsPatch(prop)) return  // não substituir se já funciona!
    const descriptor = { get: getter, configurable: true }
    if (setter) descriptor.set = setter
    Object.defineProperty(proto, prop, descriptor)
  }

  // CRÍTICO: protocol precisa de setter (Supabase Realtime faz url.protocol = 'wss:')
  define('protocol',
    function () { return parseHref(this.href).protocol },
    function (val) {
      const p = String(val).endsWith(':') ? String(val) : String(val) + ':'
      this.href = this.href.replace(/^[a-z][a-z0-9+\-.]*:/i, p)
    }
  )
  // hostname, port, host, pathname, search, hash com getters + setters
  // origin, username, password só getter (read-only por spec)
  // ...
})()
```

### Princípios-chave do patch:
1. **`needsPatch()`** — verifica se o getter já funciona antes de substituir
2. **`parseHref()`** — extrai partes da URL a partir de `href` (que funciona no Hermes)
3. **Setters obrigatórios** para `protocol`, `hostname`, `port`, `host`, `pathname`, `search`, `hash`
4. **Não substituir a classe** — apenas adicionar ao `prototype` o que falta

---

## Jornada de Debugging (cronologia)

1. **Erro inicial:** `URL.protocol is not implemented` em Supabase
2. **Tentativa 1:** instalar `react-native-url-polyfill@2` → novo erro: `Cannot read property 'get' of undefined`
3. **Tentativa 2:** tentar v3.0.0 → mesmo crash
4. **Hipótese errada:** pensámos que era o `expo-dev-client` a causar o crash
5. **Remoção do expo-dev-client** → erro diferente mas ainda crash
6. **Descoberta:** o crash `get of undefined` é diferente do erro de URL — são dois bugs separados
7. **Fix expo-dev-client:** remover do package.json (AP-H09 separado)
8. **Voltou ao erro URL** → confirmar que react-native-url-polyfill é o responsável
9. **Teste de isolamento:** app sem Supabase → funciona; com Supabase mas sem polyfill → erro URL
10. **Solução:** patch inline cirúrgico → app funciona ✅

---

## Checklist de Prevenção

- [ ] NUNCA instalar `react-native-url-polyfill` em projectos Expo Go SDK 53+
- [ ] Copiar o patch de `polyfills.js` para qualquer novo projecto React Native com Supabase
- [ ] O patch DEVE incluir setters (não só getters) para `protocol`, `hostname`, etc.
- [ ] Importar `./polyfills` COMO PRIMEIRO IMPORT em `index.js`

---

## Ficheiros Relevantes

- `apps/mobile/polyfills.js` — implementação completa do patch
- `apps/mobile/index.js` — importa polyfills primeiro
- `apps/mobile/package.json` — NÃO tem react-native-url-polyfill

**Regra relacionada:** R-162
