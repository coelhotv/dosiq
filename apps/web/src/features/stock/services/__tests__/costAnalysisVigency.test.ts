import { describe, it, expect, afterEach, vi } from 'vitest'
import { calculateMonthlyCosts } from '@/features/stock/services/costAnalysisService'

/**
 * 064 / PO-4 (parte B) — o caminho de CUSTO enxerga a vigência.
 *
 * O PR 1 fez o `ProtocolSchema` parar de estripar `start_date`/`end_date` (sem isso a
 * correção nasceria inerte aqui — `safeParse` remove campo desconhecido em silêncio,
 * classe AP-214/AP-333). Este teste fecha a parte B: com o filtro do PR 2, o tratamento
 * encerrado deixa de somar custo.
 *
 * Par de não-omissão obrigatório: o medicamento com protocolo vigente mantém o custo
 * valor a valor (AP-289/AP-290).
 */

const medicines = [
  { id: 'med-1', name: 'Losartana', stock: [{ quantity: 30, unit_price: 1.0 }] },
  { id: 'med-2', name: 'Metformina', stock: [{ quantity: 60, unit_price: 0.5 }] },
]

const vigente = {
  medicine_id: 'med-2',
  active: true,
  dosage_per_intake: 1,
  time_schedule: ['08:00'],
  frequency: 'diário',
  start_date: '2026-01-01',
  end_date: null,
}

const encerrado = {
  medicine_id: 'med-1',
  active: true,
  dosage_per_intake: 1,
  time_schedule: ['08:00', '20:00'],
  frequency: 'diário',
  start_date: '2026-01-01',
  end_date: '2026-07-31',
}

describe('calculateMonthlyCosts — vigência (064/PO-4 parte B)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('tratamento ENCERRADO não entra no custo mensal', () => {
    const { items } = calculateMonthlyCosts(medicines, [encerrado, vigente])
    expect(items.find((i) => i.medicineId === 'med-1')).toBeUndefined()
  })

  it('par de não-omissão: o vigente mantém o custo valor a valor', () => {
    const comEncerrado = calculateMonthlyCosts(medicines, [encerrado, vigente])
    const soVigente = calculateMonthlyCosts(medicines, [vigente])

    const alvo = comEncerrado.items.find((i) => i.medicineId === 'med-2')
    const referencia = soVigente.items.find((i) => i.medicineId === 'med-2')

    expect(alvo).toEqual(referencia)
    expect(comEncerrado.totalMonthly).toBe(soVigente.totalMonthly)
  })
})
