/**
 * Limite de gerações por usuário (spec 097 PO-SEC-6). Em memória, por instância da função: com
 * Fluid Compute a instância é reaproveitada, então segura rajadas do mesmo usuário; não é um limite
 * global entre instâncias (declarado — o custo de um PDF é ~200 ms com o Chromium quente).
 */
export interface RateLimiter {
  /** `true` se a chamada cabe na janela (e a registra). */
  take(key: string): boolean
  /** Chaves guardadas (observabilidade e teste). */
  size(): number
}

export function createRateLimiter({ max, windowMs, now = () => Date.now() }: { max: number; windowMs: number; now?: () => number }): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    size: () => hits.size,
    take(key) {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs)
      // Varredura barata: chave sem hit na janela some, para o Map não crescer com a instância (RC6 #857).
      if (hits.size > 1000) for (const [k, v] of hits) if (!v.some((at) => t - at < windowMs)) hits.delete(k)
      if (recent.length >= max) {
        hits.set(key, recent)
        return false
      }
      recent.push(t)
      hits.set(key, recent)
      return true
    },
  }
}
