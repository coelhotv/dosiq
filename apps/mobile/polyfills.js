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

// URLSearchParams patch para Hermes — .set/.append/.delete lançam "not implemented"
// Supabase usa URLSearchParams.set() para construir query strings internas
;(function patchURLSearchParams() {
  if (typeof URLSearchParams === 'undefined') return

  function isNotImplemented(methodName) {
    try {
      const p = new URLSearchParams()
      p[methodName]('_test', '_val')
      return false
    } catch (e) {
      return typeof e.message === 'string' && e.message.includes('not implemented')
    }
  }

  // Se .set funciona, os outros métodos também funcionam — nada a fazer
  if (!isNotImplemented('set')) return

  // Substituir URLSearchParams por implementação pura que funciona no Hermes
  // A classe nativa existe mas os métodos de mutação não estão implementados.
  class WorkingURLSearchParams {
    constructor(init) {
      this._map = []
      if (!init) return
      if (typeof init === 'string') {
        const qs = init.startsWith('?') ? init.slice(1) : init
        qs.split('&').forEach(pair => {
          if (!pair) return
          const idx = pair.indexOf('=')
          if (idx < 0) {
            this._map.push([decodeURIComponent(pair), ''])
          } else {
            this._map.push([
              decodeURIComponent(pair.slice(0, idx)),
              decodeURIComponent(pair.slice(idx + 1)),
            ])
          }
        })
      } else if (Array.isArray(init)) {
        init.forEach(([k, v]) => this._map.push([String(k), String(v)]))
      } else if (typeof init === 'object') {
        Object.entries(init).forEach(([k, v]) => this._map.push([String(k), String(v)]))
      }
    }

    append(name, value) { this._map.push([String(name), String(value)]) }

    set(name, value) {
      const k = String(name)
      const v = String(value)
      const idx = this._map.findIndex(([key]) => key === k)
      if (idx >= 0) {
        this._map[idx] = [k, v]
        this._map = this._map.filter(([key], i) => key !== k || i === idx)
      } else {
        this._map.push([k, v])
      }
    }

    get(name) {
      const entry = this._map.find(([k]) => k === String(name))
      return entry ? entry[1] : null
    }

    getAll(name) {
      return this._map.filter(([k]) => k === String(name)).map(([, v]) => v)
    }

    has(name) { return this._map.some(([k]) => k === String(name)) }

    delete(name) { this._map = this._map.filter(([k]) => k !== String(name)) }

    toString() {
      return this._map
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    }

    forEach(cb) { this._map.forEach(([k, v]) => cb(v, k, this)) }

    keys() { return this._map.map(([k]) => k)[Symbol.iterator]() }
    values() { return this._map.map(([, v]) => v)[Symbol.iterator]() }
    entries() { return this._map[Symbol.iterator]() }
    [Symbol.iterator]() { return this.entries() }
  }

  global.URLSearchParams = WorkingURLSearchParams
})()
