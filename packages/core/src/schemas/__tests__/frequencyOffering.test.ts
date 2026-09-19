/**
 * 085 Slice A — separação entre vocabulário ACEITO e lista OFERECIDA.
 *
 * O que estes testes fixam é a assimetria que o RC3/F-1 encontrou: `FREQUENCIES` era ao mesmo
 * tempo a base do `z.enum` (o que o banco aceita) e a lista que a UI renderizava (o que se
 * oferece). Tirar `personalizado` de uma coisa só quebrava a outra.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  FREQUENCIES,
  SELECTABLE_FREQUENCIES,
  DEPRECATED_FREQUENCIES,
  FREQUENCY_LABELS,
  frequencyRequiresWeekdays,
  frequencyOptionsFor,
  protocolCreateSchema,
} from '../protocolSchema'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const baseProtocol = {
  medicine_id: '8d2a01f0-445e-4e35-98e6-aaac4fd3c7d3',
  name: 'Etna',
  time_schedule: ['07:00'],
  dosage_per_intake: 1,
  start_date: '2026-05-28',
  active: true,
}

describe('SELECTABLE_FREQUENCIES (FR-001a)', () => {
  it('é subconjunto próprio de FREQUENCIES', () => {
    expect(SELECTABLE_FREQUENCIES.length).toBeGreaterThan(0)
    expect(SELECTABLE_FREQUENCIES.length).toBeLessThan(FREQUENCIES.length)
    for (const f of SELECTABLE_FREQUENCIES) expect(FREQUENCIES).toContain(f)
  })

  it('não oferece nenhuma frequência depreciada', () => {
    for (const d of DEPRECATED_FREQUENCIES) expect(SELECTABLE_FREQUENCIES).not.toContain(d)
    expect(SELECTABLE_FREQUENCIES).not.toContain('personalizado')
  })

  it('mantém `personalizado` no vocabulário aceito (FR-003/FR-004)', () => {
    // O valor continua no CHECK do banco e no z.enum: cliente publicado que ainda o escreva
    // não pode receber 23514, e protocolo legado precisa continuar validando.
    expect(FREQUENCIES).toContain('personalizado')
    const legado = protocolCreateSchema.safeParse({
      ...baseProtocol,
      frequency: 'personalizado',
      weekdays: ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'],
    })
    expect(legado.success).toBe(true)
  })
})

describe('frequencyOptionsFor (FR-004)', () => {
  it('oferece só as selecionáveis quando a frequência atual não é depreciada', () => {
    expect(frequencyOptionsFor('diário')).toEqual([...SELECTABLE_FREQUENCIES])
    expect(frequencyOptionsFor('')).toEqual([...SELECTABLE_FREQUENCIES])
    expect(frequencyOptionsFor(null)).toEqual([...SELECTABLE_FREQUENCIES])
    expect(frequencyOptionsFor(undefined)).toEqual([...SELECTABLE_FREQUENCIES])
  })

  it('inclui a frequência ATUAL quando ela já não é oferecida (legado)', () => {
    const opts = frequencyOptionsFor('personalizado')
    expect(opts).toContain('personalizado')
    expect(opts).toHaveLength(SELECTABLE_FREQUENCIES.length + 1)
    // e cada opção tem rótulo — select sem label é a mesma mentira em outra forma
    const labels: Record<string, string> = FREQUENCY_LABELS
    for (const f of opts) expect(labels[f]).toBeTruthy()
  })

  it('não duplica a frequência atual', () => {
    const opts = frequencyOptionsFor('semanal')
    expect(opts.filter((f) => f === 'semanal')).toHaveLength(1)
  })
})

describe('frequencyRequiresWeekdays (FR-001c)', () => {
  it('exige dias para `semanal` e para o legado `personalizado`', () => {
    expect(frequencyRequiresWeekdays('semanal')).toBe(true)
    expect(frequencyRequiresWeekdays('personalizado')).toBe(true)
  })

  it('não exige dias para as demais frequências do enum', () => {
    expect(frequencyRequiresWeekdays('diário')).toBe(false)
    expect(frequencyRequiresWeekdays('dias_alternados')).toBe(false)
    expect(frequencyRequiresWeekdays('quando_necessário')).toBe(false)
  })

  it('degenera para false sem lançar: null, undefined, string vazia e valor fora do enum', () => {
    // '' é o estado real do select da web ("Selecione a frequência"); nunca exigir dias de
    // um valor que o predicado não conhece.
    expect(frequencyRequiresWeekdays(null)).toBe(false)
    expect(frequencyRequiresWeekdays(undefined)).toBe(false)
    expect(frequencyRequiresWeekdays('')).toBe(false)
    expect(frequencyRequiresWeekdays('intervalo_dias')).toBe(false)
  })
})

describe('refine do protocolCreateSchema usa o mesmo predicado', () => {
  it('rejeita `semanal` sem weekdays', () => {
    const r = protocolCreateSchema.safeParse({ ...baseProtocol, frequency: 'semanal', weekdays: [] })
    expect(r.success).toBe(false)
  })

  it('rejeita o legado `personalizado` sem weekdays', () => {
    const r = protocolCreateSchema.safeParse({ ...baseProtocol, frequency: 'personalizado', weekdays: [] })
    expect(r.success).toBe(false)
  })

  it('aceita `diário` sem weekdays', () => {
    const r = protocolCreateSchema.safeParse({ ...baseProtocol, frequency: 'diário', weekdays: [] })
    expect(r.success).toBe(true)
  })
})
