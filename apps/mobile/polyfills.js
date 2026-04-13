// polyfills.js — deve ser importado ANTES de qualquer outro módulo

// SharedArrayBuffer não existe em Hermes/JSC no ambiente React Native
global.SharedArrayBuffer = global.SharedArrayBuffer || global.ArrayBuffer

// URL patch para Hermes RN/Expo Go: new URL() existe mas getters como
// .protocol, .hostname, etc. lançam "not implemented" (Hermes parcial).
// Supabase usa esses getters na inicialização do cliente.
// Estratégia: NÃO substituir URL inteira (react-native-url-polyfill quebra),
// apenas preencher os getters em falta usando href (que funciona).
;(function patchHermesURL() {
  if (typeof URL === 'undefined') return

  const proto = URL.prototype

  function needsPatch(prop) {
    try {
      // eslint-disable-next-line no-new
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

  function defineGetter(prop, fn) {
    if (needsPatch(prop)) {
      Object.defineProperty(proto, prop, { get: fn, configurable: true })
    }
  }

  defineGetter('protocol', function () { return parseHref(this.href).protocol })
  defineGetter('hostname', function () { return parseHref(this.href).hostname })
  defineGetter('port',     function () { return parseHref(this.href).port })
  defineGetter('host', function () {
    const { hostname, port } = parseHref(this.href)
    return port ? `${hostname}:${port}` : hostname
  })
  defineGetter('pathname',  function () { return parseHref(this.href).pathname })
  defineGetter('search',    function () { return parseHref(this.href).search })
  defineGetter('hash',      function () { return parseHref(this.href).hash })
  defineGetter('origin',    function () { return parseHref(this.href).origin })
  defineGetter('username',  function () { return '' })
  defineGetter('password',  function () { return '' })
  defineGetter('searchParams', function () {
    const qs = parseHref(this.href).search.slice(1)
    if (typeof URLSearchParams !== 'undefined') return new URLSearchParams(qs)
    // Fallback mínimo se URLSearchParams também não existir
    const map = new Map()
    qs.split('&').forEach(pair => {
      const idx = pair.indexOf('=')
      if (idx < 0) return
      map.set(decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1)))
    })
    return { get: k => map.get(k) ?? null, has: k => map.has(k) }
  })
})()
