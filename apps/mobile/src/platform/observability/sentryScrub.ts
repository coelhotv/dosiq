// sentryScrub.ts — limpeza do relatório do Sentry antes de sair do aparelho (spec 096, PO-SEC-4).
//
// Política v0.4 §6: a partir da 0.34 o relatório NÃO inclui o conteúdo das consultas ao banco, as
// mensagens internas do app, o e-mail nem o IP. Os breadcrumbs padrão do SDK levam `console` (que
// pode citar remédio) e URL+query de rede (filtros PostgREST com ids e nomes) — por isso a limpeza é
// por ALLOWLIST: de cada estrutura sai só o que o diagnóstico precisa (rota, método, status, stack,
// tags de bundle, user.id). `user.id` fica: é o pseudônimo que liga o crash ao rollback de OTA
// (051-A/FR-011). Funções puras: testáveis sem o SDK.

const REDACTED = '[redigido]'

const EMAIL_RE = /[^\s@"'<>(),;]+@[^\s@"'<>(),;]+\.[^\s@"'<>(),;]+/g
// Valor citado em mensagem de erro (ex.: Zod `name: "Losartana"`) — é dado digitado, não diagnóstico.
const QUOTED_RE = /"[^"\n]{1,200}"/g
// URL com query: mantém o caminho, corta a partir do `?`/`#`.
const URL_QUERY_RE = /(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g
// Query solta (`?select=...`) e filtros PostgREST (`col=eq.valor`, `in.(...)`, `ilike.%x%`).
const BARE_QUERY_RE = /\?[A-Za-z_][\w.]*=[^\s"']*/g
const POSTGREST_FILTER_RE =
  /\b[\w.]+=(?:not\.)?(?:eq|neq|gt|gte|lt|lte|like|ilike|in|is|cs|cd|ov|fts|plfts|phfts|wfts)\.(?:\([^)]*\)|[^\s&,;"']*)/gi

const HTTP_CATEGORIES = new Set(['fetch', 'xhr', 'http'])

export function stripQuery(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

export function redactText<T>(text: T): T {
  if (typeof text !== 'string') return text
  return text
    .replace(URL_QUERY_RE, '$1')
    .replace(BARE_QUERY_RE, REDACTED)
    .replace(POSTGREST_FILTER_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED)
    .replace(QUOTED_RE, `"${REDACTED}"`) as T
}

type Crumb = { type?: string; category?: string; message?: string; data?: Record<string, unknown>; [k: string]: unknown }

export function scrubBreadcrumb<B extends Crumb>(crumb: B): B | null {
  if (!crumb) return null
  if (crumb.category === 'console') return null

  const out: Crumb = { ...crumb }
  if (out.message !== undefined) out.message = redactText(out.message)

  if (crumb.type === 'http' || HTTP_CATEGORIES.has(String(crumb.category))) {
    const d = crumb.data ?? {}
    out.data = { url: stripQuery(d.url), method: d.method, status_code: d.status_code }
    Object.keys(out.data).forEach((k) => out.data![k] === undefined && delete out.data![k])
  } else if (crumb.category === 'navigation') {
    const d = crumb.data ?? {}
    out.data = { from: stripQuery(d.from), to: stripQuery(d.to) }
    Object.keys(out.data).forEach((k) => out.data![k] === undefined && delete out.data![k])
  } else {
    delete out.data
  }
  return out as B
}

type ScrubbableEvent = {
  message?: unknown
  logentry?: { message?: unknown; params?: unknown }
  exception?: { values?: Array<{ value?: unknown; [k: string]: unknown }> }
  request?: { url?: unknown; method?: unknown; [k: string]: unknown }
  extra?: unknown
  user?: { id?: unknown; [k: string]: unknown }
  breadcrumbs?: Crumb[]
  [k: string]: unknown
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  if (!event) return event
  const out: ScrubbableEvent = { ...event }

  if (out.message !== undefined) out.message = redactText(out.message)
  if (out.logentry) out.logentry = { message: redactText(out.logentry.message) }

  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => ({ ...v, value: redactText(v.value) })),
    }
  }

  if (out.request) {
    const req: Record<string, unknown> = { url: stripQuery(out.request.url), method: out.request.method }
    Object.keys(req).forEach((k) => req[k] === undefined && delete req[k])
    out.request = req
  }

  delete out.extra

  // Só o pseudônimo; `ip_address: null` impede o servidor de inferir o IP da conexão.
  const id = out.user?.id
  out.user = id ? { id, ip_address: null } : { ip_address: null }

  if (Array.isArray(out.breadcrumbs)) {
    out.breadcrumbs = out.breadcrumbs.map((b) => scrubBreadcrumb(b)).filter(Boolean) as Crumb[]
  }

  return out as E
}
