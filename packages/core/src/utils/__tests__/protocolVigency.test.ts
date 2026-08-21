import { describe, it, expect, afterEach, vi } from 'vitest'
import { isProtocolVigentOn } from '../adherenceLogic'
import type { AdherenceProtocol } from '../adherenceLogic'

/**
 * 064 / PO-1 — predicado canônico de vigência (`isProtocolVigentOn`).
 *
 * Todo caso de exclusão tem PAR de não-omissão: 64 dos 74 protocolos vigentes em prod
 * NÃO têm `end_date` (contagem de 2026-08-21), então um predicado que os exclua trocaria
 * "um número errado" por "sumiu o alerta de todo mundo" (AP-289/AP-290).
 *
 * Datas de fixture são SEMPRE literais locais (AP-280/AP-270) — nunca derivadas de
 * `toISOString()`, que devolve o dia anterior em GMT-3.
 */

const ASOF = '2026-08-21'

const base = (over: Partial<AdherenceProtocol> = {}): AdherenceProtocol => ({
  medicine_id: 'med-1',
  start_date: '2026-01-01',
  end_date: null,
  active: true,
  ...over,
})

describe('isProtocolVigentOn', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('protocolo null não é vigente (não estoura)', () => {
    expect(isProtocolVigentOn(null, ASOF)).toBe(false)
  })

  it('protocolo undefined não é vigente (não estoura)', () => {
    expect(isProtocolVigentOn(undefined, ASOF)).toBe(false)
  })

  it('active ausente/NULL é VIGENTE — a coluna é nullable, `p.active` puro omitiria', () => {
    const semActive = { medicine_id: 'med-1', start_date: '2026-01-01' } as AdherenceProtocol
    expect(isProtocolVigentOn(semActive, ASOF)).toBe(true)
    expect(isProtocolVigentOn(base({ active: undefined }), ASOF)).toBe(true)
  })

  it('active false não é vigente (inclui o caso pausado, que grava active=false)', () => {
    expect(isProtocolVigentOn(base({ active: false }), ASOF)).toBe(false)
  })

  it('end_date NULL é VIGENTE — é o caso MAJORITÁRIO e não pode mudar de valor', () => {
    expect(isProtocolVigentOn(base({ end_date: null }), ASOF)).toBe(true)
    expect(isProtocolVigentOn(base({ end_date: undefined }), ASOF)).toBe(true)
  })

  it('end_date futura é vigente', () => {
    expect(isProtocolVigentOn(base({ end_date: '2026-12-31' }), ASOF)).toBe(true)
  })

  it('end_date === asOf é VIGENTE (fronteira INCLUSIVA — AP-240)', () => {
    expect(isProtocolVigentOn(base({ end_date: ASOF }), ASOF)).toBe(true)
  })

  it('end_date = asOf - 1 dia não é vigente', () => {
    expect(isProtocolVigentOn(base({ end_date: '2026-08-20' }), ASOF)).toBe(false)
  })

  it('end_date bem no passado não é vigente (caso de ouro do SC-002)', () => {
    expect(isProtocolVigentOn(base({ end_date: '2026-07-31' }), ASOF)).toBe(false)
  })

  it('end_date malformada é tratada como ausente (vigente), sem estourar', () => {
    expect(() => isProtocolVigentOn(base({ end_date: 'não-é-data' }), ASOF)).not.toThrow()
    expect(isProtocolVigentOn(base({ end_date: 'não-é-data' }), ASOF)).toBe(true)
    expect(isProtocolVigentOn(base({ end_date: '' }), ASOF)).toBe(true)
  })

  it('start_date no futuro não é vigente', () => {
    expect(isProtocolVigentOn(base({ start_date: '2026-09-01' }), ASOF)).toBe(false)
  })

  it('start_date === asOf é vigente (fronteira inclusiva)', () => {
    expect(isProtocolVigentOn(base({ start_date: ASOF }), ASOF)).toBe(true)
  })

  it('NÃO casa frequência: protocolo semanal é vigente em qualquer dia da vigência', () => {
    // A cadência é aplicada por `frequencyDailyFactor` em calculateDailyIntake.
    // Se o predicado também a casasse, o semanal contribuiria 0 em 6 dias de 7.
    const semanal = base({ frequency: 'semanal', weekdays: ['segunda'] })
    // 2026-08-21 é uma sexta-feira — dia em que o protocolo semanal NÃO tem dose.
    expect(isProtocolVigentOn(semanal, ASOF)).toBe(true)
  })
})
