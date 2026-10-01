// siteEventProps — props de analytics do local de aplicação (spec 071 PR3, TRACKING_PLAN §5.4).

import { describe, it, expect, afterEach } from '@jest/globals'
import {
  buildSiteEventProps,
  buildBulkSiteCounts,
  buildEditChangeKind,
  EMPTY_SITE_META,
} from '../siteEventProps'

describe('buildSiteEventProps', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('dose não injetável → nenhuma chave (ausente ≠ vazia)', () => {
    expect(buildSiteEventProps({ injectable: false, site: 'coxa_e', meta: { opened: true, auto: false, input: 'map' } })).toEqual({})
  })

  it('injetável sem local e bloco nunca aberto', () => {
    expect(buildSiteEventProps({ injectable: true, site: null })).toEqual({
      site_set: false,
      site_panel_opened: false,
      site_panel_auto: false,
    })
  })

  it('local escolhido pelo mapa leva site_input, nunca o valor', () => {
    const props = buildSiteEventProps({ injectable: true, site: 'gluteo_e', meta: { opened: true, auto: false, input: 'map' } })
    expect(props).toEqual({ site_set: true, site_panel_opened: true, site_panel_auto: false, site_input: 'map' })
    expect(JSON.stringify(props)).not.toContain('gluteo')
  })

  it('local herdado sem escolha nesta sessão não tem site_input', () => {
    expect(buildSiteEventProps({ injectable: true, site: 'braco_d', meta: { opened: true, auto: true, input: null } })).not.toHaveProperty('site_input')
  })

  it('meio registrado mas local limpo depois → sem site_input', () => {
    expect(buildSiteEventProps({ injectable: true, site: null, meta: { opened: true, auto: false, input: 'list' } })).not.toHaveProperty('site_input')
  })

  it('meta null cai no vazio', () => {
    expect(buildSiteEventProps({ injectable: true, site: null, meta: null }).site_panel_opened).toBe(false)
  })

  it('edição: added / changed / removed / sem mudança', () => {
    const base = { injectable: true, meta: EMPTY_SITE_META }
    expect(buildSiteEventProps({ ...base, site: 'coxa_e', previousSite: null }).site_change).toBe('added')
    expect(buildSiteEventProps({ ...base, site: 'coxa_d', previousSite: 'coxa_e' }).site_change).toBe('changed')
    expect(buildSiteEventProps({ ...base, site: null, previousSite: 'coxa_e' }).site_change).toBe('removed')
    expect(buildSiteEventProps({ ...base, site: 'coxa_e', previousSite: 'coxa_e' })).not.toHaveProperty('site_change')
    expect(buildSiteEventProps({ ...base, site: 'coxa_e' })).not.toHaveProperty('site_change')
  })
})

describe('buildBulkSiteCounts', () => {
  it('lote sem injetável → {}', () => {
    expect(buildBulkSiteCounts([{}, null, undefined])).toEqual({})
  })

  it('conta injetáveis e os com local', () => {
    expect(
      buildBulkSiteCounts([
        { site_set: true },
        { site_set: false },
        {},
      ])
    ).toEqual({ injectable_count: 2, site_set_count: 1 })
  })
})

describe('buildEditChangeKind', () => {
  const prev = { taken_at: '2026-09-30T22:35:00.000Z', quantity_taken: 10, injection_site: 'abdomen_e' }

  it('nada mudou → lista vazia (mesmo instante em formato diferente)', () => {
    expect(buildEditChangeKind(prev, { ...prev, taken_at: '2026-09-30T19:35:00-03:00' })).toEqual([])
  })

  it('hora, quantidade e local', () => {
    expect(
      buildEditChangeKind(prev, { taken_at: '2026-09-30T23:00:00.000Z', quantity_taken: 12, injection_site: null })
    ).toEqual(['time', 'quantity', 'site'])
  })

  it('quantidade ausente dos dois lados não conta como mudança', () => {
    expect(buildEditChangeKind({ taken_at: null }, { taken_at: null })).toEqual([])
  })
})
