import { describe, it, expect, afterEach, vi } from 'vitest'
import { calculateDailyIntake } from '../adherenceLogic'
import type { AdherenceProtocol } from '../adherenceLogic'
import { stockDoseMetrics } from '../stock'

/**
 * 064 / PO-1b — consumo e métricas de dose respeitam a VIGÊNCIA do tratamento.
 *
 * Todo caso de exclusão tem PAR de não-omissão (armadilha 4 do playbook): 64 dos 74
 * protocolos vigentes em prod NÃO têm `end_date` (contagem de 2026-08-21) e precisam
 * continuar valendo exatamente o mesmo número (AP-289/AP-290).
 *
 * Datas de fixture são literais locais (AP-280/AP-270) — nunca derivadas de `toISOString()`.
 */

const ASOF = '2026-08-21'

const proto = (over: Partial<AdherenceProtocol> = {}): AdherenceProtocol => ({
  medicine_id: 'med-1',
  start_date: '2026-01-01',
  end_date: null,
  active: true,
  frequency: 'diário',
  dosage_per_intake: 1,
  time_schedule: ['08:00'],
  ...over,
})

const encerrado = proto({ id: 'p-encerrado', end_date: '2026-07-31' })
const inativo = proto({ id: 'p-inativo', active: false })
const vigenteComFim = proto({ id: 'p-vigente-fim', end_date: '2026-12-31' })
const vigenteSemFim = proto({ id: 'p-vigente-sem-fim', end_date: null })

describe('calculateDailyIntake — vigência (064)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('4 protocolos do mesmo medicamento: só os 2 VIGENTES somam', () => {
    const protocols = [encerrado, inativo, vigenteComFim, vigenteSemFim]
    expect(calculateDailyIntake('med-1', protocols, null, ASOF)).toBe(2)
  })

  it('par de não-omissão: só protocolos vigentes ⇒ valor inalterado', () => {
    const protocols = [vigenteComFim, vigenteSemFim]
    expect(calculateDailyIntake('med-1', protocols, null, ASOF)).toBe(2)
  })

  it('end_date que vence HOJE ainda conta (fronteira inclusiva — AP-240)', () => {
    const venceHoje = proto({ end_date: ASOF })
    expect(calculateDailyIntake('med-1', [venceHoje], null, ASOF)).toBe(1)
  })

  it('protocolo encerrado sozinho ⇒ consumo zero (era o número inflado)', () => {
    expect(calculateDailyIntake('med-1', [encerrado], null, ASOF)).toBe(0)
  })

  it('asOf é opcional: os chamadores existentes herdam "hoje" sem mudar assinatura', () => {
    const vigenteHoje = proto({ start_date: '2020-01-01', end_date: null })
    expect(calculateDailyIntake('med-1', [vigenteHoje], null)).toBe(1)
  })

  it('asOf no PASSADO conta o protocolo que estava vigente naquela data (R-299)', () => {
    expect(calculateDailyIntake('med-1', [encerrado], null, '2026-07-15')).toBe(1)
  })
})

describe('stockDoseMetrics — vigência (064)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('com o ENCERRADO em primeiro no array, `rep` sai da lista JÁ FILTRADA', () => {
    // O encerrado tem dose 4 (tamanho de tomada diferente): se `rep` viesse da lista
    // não filtrada, doseSize = 4 ⇒ dosesRemaining = 5 em vez de 20 (analysis F-4).
    const protocols = [proto({ end_date: '2026-07-31', dosage_per_intake: 4 }), vigenteSemFim]
    const metrics = stockDoseMetrics(20, protocols, null, ASOF)

    expect(metrics.dosesRemaining).toBe(20)
    expect(metrics.dosesPorDia).toBe(1)
    expect(metrics.runwayDias).toBe(20)
  })

  it('todos os protocolos encerrados ⇒ métricas zeradas', () => {
    const metrics = stockDoseMetrics(20, [encerrado, inativo], null, ASOF)
    expect(metrics).toEqual({ dosesRemaining: 0, runwayDias: 0, dosesPorDia: 0, isDaily: true })
  })

  it('par de não-omissão: protocolo vigente com saldo baixo mantém runway/urgência idênticos', () => {
    const soVigentes = [vigenteSemFim]
    const comEncerrado = [encerrado, ...soVigentes]

    const esperado = stockDoseMetrics(3, soVigentes, null, ASOF)
    expect(esperado).toMatchObject({ dosesRemaining: 3, runwayDias: 3, dosesPorDia: 1, isDaily: true })
    // A presença do encerrado não pode mudar nada do que o usuário vê.
    expect(stockDoseMetrics(3, comEncerrado, null, ASOF)).toEqual(esperado)
  })

  it('isDaily deriva da lista filtrada: semanal encerrado não torna o item "não diário"', () => {
    const semanalEncerrado = proto({ frequency: 'semanal', end_date: '2026-07-31' })
    const metrics = stockDoseMetrics(10, [semanalEncerrado, vigenteSemFim], null, ASOF)
    expect(metrics.isDaily).toBe(true)
  })
})
