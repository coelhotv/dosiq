// polyfills.js — deve ser importado ANTES de qualquer outro módulo

// SharedArrayBuffer não existe em Hermes/JSC no ambiente React Native
global.SharedArrayBuffer = global.SharedArrayBuffer || global.ArrayBuffer


// URL patch para Hermes RN/Expo Go: new URL() existe mas getters como
// .protocol, .hostname, etc. lançam "not implemented" (Hermes parcial).
// Supabase usa esses getters E setters (Realtime faz url.protocol = 'wss:').
// Estratégia: patch cirúrgico nos getters/setters em falta usando href.
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

  // Parser mínimo baseado em href (href funciona no Hermes)
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
      protocol,
      hostname,
      port,
      pathname: m[4] || '/',
      search: m[5] || '',
      hash: m[6] || '',
      origin: `${protocol}//${hostname}${port ? ':' + port : ''}`,
    }
  }

  function define(prop, getter, setter) {
    if (!needsPatch(prop)) return
    const descriptor = { get: getter, configurable: true }
    if (setter) descriptor.set = setter
    Object.defineProperty(proto, prop, descriptor)
  }

  // protocol — getter + setter (Realtime faz url.protocol = 'wss:')
  define(
    'protocol',
    function () { return parseHref(this.href).protocol },
    function (val) {
      const p = String(val).endsWith(':') ? String(val) : String(val) + ':'
      this.href = this.href.replace(/^[a-z][a-z0-9+\-.]*:/i, p)
    }
  )

  // hostname — getter + setter
  define(
    'hostname',
    function () { return parseHref(this.href).hostname },
    function (val) {
      const { protocol, port, pathname, search, hash } = parseHref(this.href)
      this.href = `${protocol}//${val}${port ? ':' + port : ''}${pathname}${search}${hash}`
    }
  )

  // port — getter + setter
  define(
    'port',
    function () { return parseHref(this.href).port },
    function (val) {
      const { protocol, hostname, pathname, search, hash } = parseHref(this.href)
      const portStr = val ? `:${val}` : ''
      this.href = `${protocol}//${hostname}${portStr}${pathname}${search}${hash}`
    }
  )

  // host — getter + setter
  define(
    'host',
    function () {
      const { hostname, port } = parseHref(this.href)
      return port ? `${hostname}:${port}` : hostname
    },
    function (val) {
      const { protocol, pathname, search, hash } = parseHref(this.href)
      this.href = `${protocol}//${val}${pathname}${search}${hash}`
    }
  )

  // pathname — getter + setter
  define(
    'pathname',
    function () { return parseHref(this.href).pathname },
    function (val) {
      const { protocol, hostname, port, search, hash } = parseHref(this.href)
      const host = port ? `${hostname}:${port}` : hostname
      this.href = `${protocol}//${host}${val}${search}${hash}`
    }
  )

  // search — getter + setter
  define(
    'search',
    function () { return parseHref(this.href).search },
    function (val) {
      const { protocol, hostname, port, pathname, hash } = parseHref(this.href)
      const host = port ? `${hostname}:${port}` : hostname
      const q = val && !val.startsWith('?') ? '?' + val : val
      this.href = `${protocol}//${host}${pathname}${q}${hash}`
    }
  )

  // hash — getter + setter
  define(
    'hash',
    function () { return parseHref(this.href).hash },
    function (val) {
      const { protocol, hostname, port, pathname, search } = parseHref(this.href)
      const host = port ? `${hostname}:${port}` : hostname
      const h = val && !val.startsWith('#') ? '#' + val : val
      this.href = `${protocol}//${host}${pathname}${search}${h}`
    }
  )

  // origin, username, password — só getter (read-only por spec)
  define('origin',   function () { return parseHref(this.href).origin })
  define('username', function () { return '' })
  define('password', function () { return '' })

  // searchParams — getter NÃO aplicado aqui; patchSearchParamsViaToString abaixo assume controlo
})()

// Estratégia A — patchSearchParamsViaToString
//
// DIAGNÓSTICO P1 confirmou: url.href setter e url.search setter são no-ops silenciosos no Hermes.
// LiveURLSearchParams (tentativa anterior) falhava porque _sync() escrevia url.href = newHref
// e o Hermes ignorava silenciosamente → cada novo acesso ao getter recomeçava com _pairs vazio.
//
// Solução: guardar os params directamente na instância URL como url._searchPairs (array JS puro).
// Sobreescrever URL.prototype.toString() para construir a query string a partir de _searchPairs.
// O postgrest-js lê a URL via url.toString() (PostgrestBuilder.ts:122) — único ponto de leitura.
// Nenhum setter de href/search é chamado. Os pares acumulam-se na instância e persistem.
;(function patchSearchParamsViaToString() {
  if (typeof URL === 'undefined') return

  // CRÍTICO: capturar toString nativo ANTES de o substituir.
  // No Hermes, o getter href chama toString() internamente (spec WHATWG: href = serialize URL).
  // Se não capturarmos, toString() → this.href → Hermes invoca toString() → loop infinito (stack overflow).
  var _nativeToString = URL.prototype.toString

  // toString() sobreescrito: constrói URL com _searchPairs se existirem
  // Usa _nativeToString para obter href base (evita recursão via href getter nativo)
  URL.prototype.toString = function () {
    var href = _nativeToString.call(this)   // href nativo, sem passar por este override
    
    // R-118: Bypass para URLs do Metro/DevServer
    if (href.indexOf('192.168.') >= 0 || href.indexOf('localhost') >= 0 || href.indexOf('127.0.0.1') >= 0 || href.indexOf(':8081') >= 0) {
      return href
    }

    var q = href.indexOf('?')
    var h = href.indexOf('#')
    var base = q >= 0 ? href.slice(0, q) : (h >= 0 ? href.slice(0, h) : href)
    var search = q >= 0 ? (h >= 0 ? href.slice(q, h) : href.slice(q)) : ''
    var hash = h >= 0 ? href.slice(h) : ''

    // R-168: Hermes normaliza URLs adicionando '/' no fim do path (ex: /protocols → /protocols/).
    // PostgREST rejeita /protocols/?select=... ou /rpc/func/ com PGRST125.
    // Remover barra final do Path se existir (e não for raiz do host).
    if (base.charAt(base.length - 1) === '/') {
      var afterProto = base.indexOf('//') + 2
      var firstPathSlash = base.indexOf('/', afterProto)
      if (firstPathSlash >= 0 && firstPathSlash < base.length - 1) {
        base = base.slice(0, -1)
      }
    }

    // Se temos pares acumulados, reconstruímos o search a partir de _searchPairs
    if (this._searchPairs && this._searchPairs.length) {
      var pairs = this._searchPairs
      var qs = ''
      for (var i = 0; i < pairs.length; i++) {
        if (i) qs += '&'
        qs += encodeURIComponent(pairs[i][0]) + '=' + encodeURIComponent(pairs[i][1])
      }
      search = '?' + qs
    }

    var result = base + search + hash
    if (__DEV__) {
      // Logar URLs do Supabase para debug de PGRST125
      if (result.indexOf('supabase.co') >= 0) {
        console.info('[sp-tostring] result:', result)
      }
    }
    return result
  }

  // DirectSearchParams — muta url._searchPairs directamente, sem tocar em href
  function DirectSearchParams(urlObj) {
    this._url = urlObj
    if (!urlObj._searchPairs) urlObj._searchPairs = []
    // NÃO inicializar de href — postgrest-js começa com URL limpa e adiciona params sequencialmente
  }

  DirectSearchParams.prototype.set = function (name, value) {
    var k = String(name), v = String(value), found = false, result = []
    var pairs = this._url._searchPairs
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === k) { if (!found) { result.push([k, v]); found = true } }
      else { result.push(pairs[i]) }
    }
    if (!found) result.push([k, v])
    this._url._searchPairs = result
    if (__DEV__) console.info('[sp] set', k, '=', v, '→', result.length, 'pairs total')
  }

  DirectSearchParams.prototype.append = function (name, value) {
    var k = String(name), v = String(value)
    this._url._searchPairs.push([k, v])
    if (__DEV__) console.info('[sp] append', k, '=', v, '→', this._url._searchPairs.length, 'pairs total')
  }

  DirectSearchParams.prototype.delete = function (name) {
    var k = String(name), result = []
    var pairs = this._url._searchPairs
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0] !== k) result.push(pairs[i])
    }
    this._url._searchPairs = result
  }

  DirectSearchParams.prototype.get = function (name) {
    var k = String(name), pairs = this._url._searchPairs
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === k) return pairs[i][1]
    }
    return null
  }

  DirectSearchParams.prototype.getAll = function (name) {
    var k = String(name), out = [], pairs = this._url._searchPairs
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === k) out.push(pairs[i][1])
    }
    return out
  }

  DirectSearchParams.prototype.has = function (name) {
    var k = String(name), pairs = this._url._searchPairs
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === k) return true
    }
    return false
  }

  DirectSearchParams.prototype.toString = function () {
    var out = [], pairs = this._url._searchPairs
    for (var i = 0; i < pairs.length; i++) {
      out.push(encodeURIComponent(pairs[i][0]) + '=' + encodeURIComponent(pairs[i][1]))
    }
    return out.join('&')
  }

  DirectSearchParams.prototype.forEach = function (cb) {
    var pairs = this._url._searchPairs
    for (var i = 0; i < pairs.length; i++) {
      cb(pairs[i][1], pairs[i][0], this)
    }
  }

  // Getter searchParams: inicializa _searchPairs na instância e devolve DirectSearchParams
  Object.defineProperty(URL.prototype, 'searchParams', {
    get: function () {
      if (!this._searchPairs) this._searchPairs = []
      return new DirectSearchParams(this)
    },
    configurable: true,
    enumerable: false,
  })

  if (__DEV__) console.info('[polyfill] URL: Estratégia A — toString()+_searchPairs (bypass href/search setters)')
})()

// URLSearchParams patch para Hermes — substituição incondicional + debug logs
// O detection probe anterior falhou: Hermes não lança em teste sintético mas
// lança em uso real pelo Supabase. Solução: substituir sempre por implementação
// pura ES5 (sem class, sem Symbol.iterator — máxima compatibilidade Hermes).
;(function patchURLSearchParams() {
  if (__DEV__) console.info('[polyfill] URLSearchParams nativo:', typeof URLSearchParams,
    typeof URLSearchParams !== 'undefined' ? typeof URLSearchParams.prototype.set : 'N/A')

  function HermesURLSearchParams(init) {
    this._pairs = []
    if (!init) return
    if (typeof init === 'string') {
      var qs = init.charAt(0) === '?' ? init.slice(1) : init
      var parts = qs.split('&')
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i]
        if (!part) continue
        var eq = part.indexOf('=')
        if (eq < 0) {
          this._pairs.push([decodeURIComponent(part), ''])
        } else {
          this._pairs.push([
            decodeURIComponent(part.slice(0, eq)),
            decodeURIComponent(part.slice(eq + 1)),
          ])
        }
      }
    } else if (Array.isArray(init)) {
      for (var j = 0; j < init.length; j++) {
        this._pairs.push([String(init[j][0]), String(init[j][1])])
      }
    } else if (init && typeof init === 'object') {
      var keys = Object.keys(init)
      for (var k = 0; k < keys.length; k++) {
        this._pairs.push([String(keys[k]), String(init[keys[k]])])
      }
    }
  }

  HermesURLSearchParams.prototype.append = function (name, value) {
    this._pairs.push([String(name), String(value)])
  }

  HermesURLSearchParams.prototype.set = function (name, value) {
    var k = String(name)
    var v = String(value)
    var found = false
    var result = []
    for (var i = 0; i < this._pairs.length; i++) {
      if (this._pairs[i][0] === k) {
        if (!found) { result.push([k, v]); found = true }
      } else {
        result.push(this._pairs[i])
      }
    }
    if (!found) result.push([k, v])
    this._pairs = result
  }

  HermesURLSearchParams.prototype.get = function (name) {
    var k = String(name)
    for (var i = 0; i < this._pairs.length; i++) {
      if (this._pairs[i][0] === k) return this._pairs[i][1]
    }
    return null
  }

  HermesURLSearchParams.prototype.getAll = function (name) {
    var k = String(name)
    var out = []
    for (var i = 0; i < this._pairs.length; i++) {
      if (this._pairs[i][0] === k) out.push(this._pairs[i][1])
    }
    return out
  }

  HermesURLSearchParams.prototype.has = function (name) {
    var k = String(name)
    for (var i = 0; i < this._pairs.length; i++) {
      if (this._pairs[i][0] === k) return true
    }
    return false
  }

  HermesURLSearchParams.prototype.delete = function (name) {
    var k = String(name)
    var result = []
    for (var i = 0; i < this._pairs.length; i++) {
      if (this._pairs[i][0] !== k) result.push(this._pairs[i])
    }
    this._pairs = result
  }

  HermesURLSearchParams.prototype.toString = function () {
    var out = []
    for (var i = 0; i < this._pairs.length; i++) {
      out.push(encodeURIComponent(this._pairs[i][0]) + '=' + encodeURIComponent(this._pairs[i][1]))
    }
    return out.join('&')
  }

  HermesURLSearchParams.prototype.forEach = function (cb) {
    for (var i = 0; i < this._pairs.length; i++) {
      cb(this._pairs[i][1], this._pairs[i][0], this)
    }
  }

  global.URLSearchParams = HermesURLSearchParams
  if (__DEV__) console.info('[polyfill] URLSearchParams substituído — set:', typeof HermesURLSearchParams.prototype.set)
})()
