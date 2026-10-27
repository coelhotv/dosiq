import { describe, it, expect } from 'vitest'
import rawConfig from '../../vercel.json'

/**
 * Com `cleanUrls: true` (spec 110), a Vercel redireciona (308) destinos `/api/<função>.ts?query` e
 * a rota responde 404 em produção — derrubou admin, web push e /api/ops em 2026-10-24. Destino de
 * rewrite para função aponta SEM extensão.
 */

const vercelConfig = rawConfig as { cleanUrls?: boolean; rewrites: { source: string; destination: string }[] }

describe('vercel.json rewrites de /api', () => {
  it('nenhum destino de /api carrega extensão de arquivo quando cleanUrls está ligado', () => {
    if (!vercelConfig.cleanUrls) return
    const withExtension = vercelConfig.rewrites
      .filter(r => r.destination.startsWith('/api/'))
      .filter(r => /\.(ts|js)(\?|$)/.test(r.destination))
      .map(r => r.destination)
    expect(withExtension).toEqual([])
  })
})
