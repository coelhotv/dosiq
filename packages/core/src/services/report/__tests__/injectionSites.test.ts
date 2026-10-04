// §3.8 Locais de aplicação — agregador pela própria linha (spec 097 Slice C — PO-9, PO-10; D-C1).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildInjectionSites } from '../reportSections/injectionSites'
import type { ReportMedicineLogRow } from '../reportTypes'
import { fixture, med } from './reportFixture'

const log = (over: Partial<ReportMedicineLogRow> & { id: string; taken_at: string }): ReportMedicineLogRow => ({
  protocol_id: 'p_moun',
  medicine_id: 'm_moun',
  injection_site: null,
  ...over,
})

describe('buildInjectionSites', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('sem log com local → sem cartão (seção ausente)', () => {
    const logs = [log({ id: 'o', medicine_id: 'm_met', protocol_id: 'p_met', taken_at: '2026-09-25T08:00:00-03:00' })]
    expect(buildInjectionSites(fixture({ medicineLogs: logs }))).toEqual([])
  })

  it('conta pela linha: protocolo NULL e tratamento arquivado contam; sem local só no total; fora da janela fora', () => {
    const medicines = [...fixture().medicines, med({ id: 'm_lan', name: 'Lantus', presentation: 'injetavel', archived_at: '2026-09-28T10:00:00-03:00' })]
    const medicineLogs = [
      log({ id: '1', taken_at: '2026-09-24T09:00:00-03:00', injection_site: 'abdomen_e' }),
      log({ id: '2', taken_at: '2026-09-25T09:00:00-03:00', injection_site: 'abdomen_e', protocol_id: null }),
      log({ id: '3', taken_at: '2026-09-26T09:00:00-03:00', injection_site: 'coxa_d' }),
      log({ id: '4', taken_at: '2026-09-27T09:00:00-03:00' }),
      log({ id: '5', taken_at: '2026-09-23T09:00:00-03:00', injection_site: 'braco_e' }),
      // 23h30 do dia 30 em -03 ainda é dia 30 (dentro)
      log({ id: '6', taken_at: '2026-09-30T23:30:00-03:00', injection_site: 'gluteo_d' }),
      log({ id: 'l1', medicine_id: 'm_lan', protocol_id: 'p_arch', taken_at: '2026-09-25T22:00:00-03:00', injection_site: 'braco_d' }),
    ]
    const cards = buildInjectionSites(fixture({ medicines, medicineLogs }))
    expect(cards.map((c) => c.medicineId)).toEqual(['m_lan', 'm_moun'])
    expect(cards[1].name).toMatch(/^Mounjaro · /)
    const moun = cards[1]
    expect(moun).toMatchObject({ total: 5, withSite: 4 })
    // ordem canônica dos locais, não por contagem (sem ranking)
    expect(moun.counts).toEqual([
      { site: 'abdomen_e', label: 'Abdômen (esquerdo)', count: 2 },
      { site: 'coxa_d', label: 'Coxa (direita)', count: 1 },
      { site: 'gluteo_d', label: 'Glúteo (direito)', count: 1 },
    ])
    expect(cards[0]).toMatchObject({ total: 1, withSite: 1 })
  })

  it('0 com local → sem cartão (D-C3, smoke C: cartão em branco não diz nada)', () => {
    const logs = [
      log({ id: '1', taken_at: '2026-09-24T09:00:00-03:00' }),
      log({ id: '2', taken_at: '2026-09-25T09:00:00-03:00' }),
    ]
    expect(buildInjectionSites(fixture({ medicineLogs: logs }))).toEqual([])
  })

  it('dois cadastros com o mesmo nome se distinguem pela concentração', () => {
    const medicines = [
      med({ id: 'oz1', name: 'Ozempic', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 1.34 }),
      med({ id: 'oz2', name: 'Ozempic', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 2.68 }),
    ]
    const logs = [
      log({ id: '1', medicine_id: 'oz1', taken_at: '2026-09-24T09:00:00-03:00', injection_site: 'braco_e' }),
      log({ id: '2', medicine_id: 'oz2', taken_at: '2026-09-25T09:00:00-03:00', injection_site: 'coxa_d' }),
    ]
    const names = buildInjectionSites(fixture({ medicines, medicineLogs: logs })).map((c) => c.name)
    expect(new Set(names).size).toBe(2)
    expect(names.every((n) => n.startsWith('Ozempic · '))).toBe(true)
  })

  it('local fora da lista conta no total e não no mapa (sem local da lista, sem cartão); não-injetável com local entra', () => {
    const logs = [
      log({ id: '1', taken_at: '2026-09-24T09:00:00-03:00', injection_site: 'orelha' }),
      log({ id: '2', medicine_id: 'm_met', protocol_id: 'p_met', taken_at: '2026-09-24T09:00:00-03:00', injection_site: 'braco_e' }),
    ]
    const cards = buildInjectionSites(fixture({ medicineLogs: logs }))
    expect(cards.find((c) => c.medicineId === 'm_moun')).toBeUndefined()
    expect(cards.find((c) => c.medicineId === 'm_met')).toMatchObject({ total: 1, withSite: 1 })
  })
})
