/**
 * Limite de gerações por usuário (spec 097 PO-SEC-6). Em memória, por instância da função: com
 * Fluid Compute a instância é reaproveitada, então segura rajadas do mesmo usuário; não é um limite
 * global entre instâncias (declarado — o custo de um PDF é ~200 ms com o Chromium quente).
 */
export interface RateLimiter {
  /** `true` se a chamada cabe na janela (e a registra). */
  take(key: string): boolean
}

export function createRateLimiter({ max, windowMs, now = () => Date.now() }: { max: number; windowMs: number; now?: () => number }): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    take(key) {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs)
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
