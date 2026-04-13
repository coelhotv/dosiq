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

  // searchParams — getter (URLSearchParams é separado, geralmente funciona)
  define('searchParams', function () {
    const qs = parseHref(this.href).search.slice(1)
    if (typeof URLSearchParams !== 'undefined') return new URLSearchParams(qs)
    const map = new Map()
    qs.split('&').forEach(pair => {
      const idx = pair.indexOf('=')
      if (idx < 0) return
      map.set(decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1)))
    })
    return { get: k => map.get(k) ?? null, has: k => map.has(k) }
  })
})()
