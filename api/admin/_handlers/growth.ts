// api/admin/_handlers/growth.ts
// Handler admin do painel de crescimento e wedge (spec 115).
//
// Vive como RESOURCE do router `api/admin.ts` — sem função serverless nova (R-090) — e herda dele a
// auth de admin (fail-closed, ADR-091). Só leitura: uma chamada à RPC `get_admin_growth_analytics`
// (SECURITY DEFINER, EXECUTE só para service_role — ADR-119), que consolida tudo no banco.
//
// 🔴 INV-2 / SC-004: a RPC não lê `medicines.name`. Mesmo assim o payload passa por `stripForbidden`
//    antes de sair: chave `name` ou `push_token` em qualquer nível é removida (defesa em profundidade
//    — uma RPC alterada no futuro não vaza nome comercial nem token).
// 🔴 RC-SEC S-4/S-5: `Cache-Control: no-store`; erro da RPC ⇒ 500 genérico, log só com code/message.

/** Uuid canônico (qualquer versão). A env é config, mas entra no SQL — valida antes. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500
const FORBIDDEN_KEYS = new Set(['name', 'push_token'])
const GENERIC_ERROR = 'Falha ao carregar analytics'

/**
 * Lê `GROWTH_EXCLUDED_USER_IDS` (uuids separados por vírgula). Ausente/vazia ⇒ []. Inválido é
 * descartado com log (só a contagem — o valor pode ser lixo arbitrário). Dedupe e minúsculas.
 */
export function parseExcludedUserIds(raw: string | undefined): string[] {
  if (!raw) return []
  const ids: string[] = []
  let invalid = 0
  for (const piece of raw.split(',')) {
    const id = piece.trim().toLowerCase()
    if (id === '') continue
    if (!UUID_RE.test(id)) {
      invalid += 1
      continue
    }
    if (!ids.includes(id)) ids.push(id)
  }
  if (invalid > 0) console.warn(`[Admin API] growth: ${invalid} id(s) inválido(s) em GROWTH_EXCLUDED_USER_IDS descartado(s)`)
  return ids
}

/** Inteiro da query limitado a [min, max]; ausente ou não numérico ⇒ fallback. */
function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

/** Remove, em qualquer profundidade, as chaves que nunca podem sair do servidor. */
function stripForbidden(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripForbidden)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value)) {
      if (!FORBIDDEN_KEYS.has(key)) out[key] = stripForbidden(inner)
    }
    return out
  }
  return value
}

/** GET /api/admin?resource=growth[&limit=&offset=] */
export async function handleGetGrowthAnalytics(req, res, supabase) {
  res.setHeader('Cache-Control', 'no-store')
  const params = {
    p_limit: clampInt(req.query?.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    p_offset: clampInt(req.query?.offset, 0, 0, Number.MAX_SAFE_INTEGER),
    p_excluded_user_ids: parseExcludedUserIds(process.env.GROWTH_EXCLUDED_USER_IDS),
  }
  try {
    const { data, error } = await supabase.rpc('get_admin_growth_analytics', params)
    if (error) {
      console.error('[Admin API] growth RPC error:', error.code, error.message)
      return res.status(500).json({ error: GENERIC_ERROR })
    }
    return res.status(200).json(stripForbidden(data ?? {}))
  } catch (err: any) {
    console.error('[Admin API] growth unexpected error:', err?.message)
    return res.status(500).json({ error: GENERIC_ERROR })
  }
}
