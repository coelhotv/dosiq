import { describe, expect, it } from 'vitest'
import {
  appStoreUrl,
  playStoreUrl,
  baixarUrl,
  STORE_POINTS,
  type StorePoint,
} from '../storeLinks'

describe('storeLinks', () => {
  const points: StorePoint[] = ['atf', 'header', 'sticky', 'section', 'final', 'qr']

  it('declara todos os 6 pontos de atribuição', () => {
    expect(STORE_POINTS).toEqual(points)
  })

  it.each(points)('gera link correto da App Store para o ponto %s', (point) => {
    const url = appStoreUrl(point)
    expect(url).toBe(
      `https://apps.apple.com/br/app/id6762740948?pt=128807500&ct=landing_home_${point}&mt=8`,
    )
    expect(url).not.toContain('utm_source=')
    expect(url).not.toContain('Landing_home')
  })

  it.each(points)('gera link correto do Google Play para o ponto %s', (point) => {
    const url = playStoreUrl(point)
    expect(url).toBe(
      `https://play.google.com/store/apps/details?id=com.coelhotv.dosiq&referrer=utm_source%3Dlanding_home%26utm_campaign%3D${point}`,
    )
    // Não pode ter utm_source solto fora do referrer=
    expect(url).not.toMatch(/[?&]utm_source=/)
  })

  it.each(points)('gera link correto da rota /baixar para o ponto %s', (point) => {
    const url = baixarUrl(point)
    expect(url).toBe(`/baixar?ct=${point}`)
  })

  it('garante paridade entre storeLinks.ts e apps/web/public/baixar.html', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const htmlPath = path.resolve(__dirname, '../../../../public/baixar.html')
    const html = fs.readFileSync(htmlPath, 'utf8')

    // Confirma whitelist de pontos
    for (const point of points) {
      expect(html).toContain(`'${point}'`)
    }

    // Confirma templates das URLs das lojas
    expect(html).toContain('https://apps.apple.com/br/app/id6762740948?pt=128807500&ct=landing_home_')
    expect(html).toContain('&mt=8')
    expect(html).toContain('https://play.google.com/store/apps/details?id=com.coelhotv.dosiq&referrer=utm_source%3Dlanding_home%26utm_campaign%3D')
  })
})
