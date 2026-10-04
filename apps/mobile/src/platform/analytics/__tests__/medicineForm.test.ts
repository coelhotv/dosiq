// medicineForm.test.ts — 092 FR-001 / PO-1: forma do medicamento lida no momento do evento.
// Enum de referência = CHECK `medicines_presentation_check` lido no banco em 2026-10-04 (R-295).

const mockIn = jest.fn()
const mockSelect = jest.fn((..._a: unknown[]) => ({ in: (...a: unknown[]) => mockIn(...a) }))
const mockFrom = jest.fn((..._a: unknown[]) => ({ select: (...a: unknown[]) => mockSelect(...a) }))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}))

import { getMedicinePresentations } from '../medicineForm'

const DB_CHECK = ['comprimido', 'capsula', 'liquido', 'injetavel', 'pomada', 'spray', 'outro']

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('getMedicinePresentations', () => {
  it('uma query in() com ids distintos e não-nulos; devolve id → forma', async () => {
    mockIn.mockResolvedValue({ data: [{ id: 'm1', presentation: 'injetavel' }, { id: 'm2', presentation: 'comprimido' }], error: null })

    const out = await getMedicinePresentations(['m1', null, 'm2', 'm1', undefined])

    expect(mockFrom).toHaveBeenCalledWith('medicines')
    expect(mockSelect).toHaveBeenCalledWith('id, presentation')
    expect(mockIn).toHaveBeenCalledWith('id', ['m1', 'm2'])
    expect(out).toEqual({ m1: 'injetavel', m2: 'comprimido' })
  })

  it('lista vazia ou só nulos → {} sem query', async () => {
    expect(await getMedicinePresentations([])).toEqual({})
    expect(await getMedicinePresentations([null, undefined])).toEqual({})
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('erro do PostgREST → {} (INV-3: chave omitida, nunca default)', async () => {
    mockIn.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getMedicinePresentations(['m1'])).toEqual({})
  })

  it('exceção (rede) → {} sem propagar (CON-021)', async () => {
    mockIn.mockRejectedValue(new Error('Network request failed'))
    await expect(getMedicinePresentations(['m1'])).resolves.toEqual({})
  })

  it('forma nula ou fora do enum do banco → omitida, nunca `outro`', async () => {
    mockIn.mockResolvedValue({ data: [{ id: 'm1', presentation: null }, { id: 'm2', presentation: 'Injetável' }, { id: 'm3', presentation: 'spray' }], error: null })
    expect(await getMedicinePresentations(['m1', 'm2', 'm3'])).toEqual({ m3: 'spray' })
  })

  it.each(DB_CHECK)('aceita %s (valor do CHECK)', async (p) => {
    mockIn.mockResolvedValue({ data: [{ id: 'm1', presentation: p }], error: null })
    expect(await getMedicinePresentations(['m1'])).toEqual({ m1: p })
  })
})
