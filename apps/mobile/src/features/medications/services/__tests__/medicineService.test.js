import { medicineService } from '../medicineService'
import { supabase } from '../../../../platform/supabase/nativeSupabaseClient'

// Mock supabase mobile client
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => {
  // getAll: from→select→eq→order
  const orderMock = jest.fn()
  const eqGetAllMock = jest.fn(() => ({ order: orderMock }))
  // getById: from→select→eq→eq→single
  const singleGetByIdMock = jest.fn()
  const eqGetById2Mock = jest.fn(() => ({ single: singleGetByIdMock }))
  // create: from→insert→select→single
  const singleCreateMock = jest.fn()
  const selectCreateMock = jest.fn(() => ({ single: singleCreateMock }))
  const insertMock = jest.fn(() => ({ select: selectCreateMock }))
  // update: from→update→eq→eq→select→single
  const singleUpdateMock = jest.fn()
  const selectUpdateMock = jest.fn(() => ({ single: singleUpdateMock }))
  const eqUpdate2Mock = jest.fn(() => ({ select: selectUpdateMock }))
  // delete: from→delete→eq→eq
  const eqDelete2Mock = jest.fn()

  const selectMock = jest.fn(() => ({
    eq: jest.fn((field) => {
      if (field === 'user_id') return { order: orderMock }
      // id then user_id chain
      return { eq: eqGetById2Mock, order: orderMock, single: singleGetByIdMock }
    }),
  }))

  const updateMock = jest.fn(() => ({
    eq: jest.fn(() => ({ eq: eqUpdate2Mock })),
  }))
  const deleteMock = jest.fn(() => ({
    eq: jest.fn(() => ({ eq: eqDelete2Mock })),
  }))

  const fromMock = jest.fn(() => ({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
  }))

  return {
    supabase: {
      auth: { getUser: jest.fn() },
      from: fromMock,
      // Expose inner mocks for test assertions
      __mocks: {
        orderMock,
        singleGetByIdMock,
        singleCreateMock,
        singleUpdateMock,
        eqDelete2Mock,
        insertMock,
        updateMock,
        deleteMock,
        fromMock,
      },
    },
  }
})

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const VALID_MEDICINE = {
  name: 'Paracetamol',
  dosage_per_pill: 500,
  dosage_unit: 'mg',
  type: 'medicamento',
}

describe('medicineService (mobile)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })
  })

  describe('getAll', () => {
    it('retorna lista de medicamentos do usuário', async () => {
      const fixtures = [{ id: 'm1', name: 'Paracetamol' }]
      supabase.__mocks.orderMock.mockResolvedValue({ data: fixtures, error: null })

      const result = await medicineService.getAll()

      expect(supabase.from).toHaveBeenCalledWith('medicines')
      expect(result).toEqual(fixtures)
    })

    it('retorna [] quando data é null', async () => {
      supabase.__mocks.orderMock.mockResolvedValue({ data: null, error: null })
      const result = await medicineService.getAll()
      expect(result).toEqual([])
    })

    it('lança erro quando supabase falha', async () => {
      supabase.__mocks.orderMock.mockResolvedValue({
        data: null,
        error: new Error('db down'),
      })
      await expect(medicineService.getAll()).rejects.toThrow('db down')
    })

    it('lança erro quando sessão expirou', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      await expect(medicineService.getAll()).rejects.toThrow(/Sessão expirada/)
    })
  })

  describe('getById', () => {
    it('retorna o medicamento por id', async () => {
      const fixture = { id: 'm1', name: 'Paracetamol' }
      supabase.__mocks.singleGetByIdMock.mockResolvedValue({ data: fixture, error: null })

      const result = await medicineService.getById('m1')
      expect(result).toEqual(fixture)
    })

    it('lança erro quando supabase falha', async () => {
      supabase.__mocks.singleGetByIdMock.mockResolvedValue({
        data: null,
        error: new Error('not found'),
      })
      await expect(medicineService.getById('m1')).rejects.toThrow('not found')
    })
  })

  describe('create', () => {
    it('cria medicamento válido com user_id injetado', async () => {
      const fixture = { id: 'm2', ...VALID_MEDICINE }
      supabase.__mocks.singleCreateMock.mockResolvedValue({ data: fixture, error: null })

      const result = await medicineService.create(VALID_MEDICINE)
      expect(result).toEqual(fixture)
      const insertedPayload = supabase.__mocks.insertMock.mock.calls[0][0][0]
      expect(insertedPayload.user_id).toBe(USER_ID)
      expect(insertedPayload.name).toBe('Paracetamol')
    })

    it('lança erro de validação para payload inválido', async () => {
      await expect(medicineService.create({ name: '' })).rejects.toThrow(/Erro de validação/)
    })
  })

  describe('update', () => {
    it('atualiza medicamento existente', async () => {
      const fixture = { id: 'm1', name: 'Dipirona' }
      supabase.__mocks.singleUpdateMock.mockResolvedValue({ data: fixture, error: null })

      const result = await medicineService.update('m1', { name: 'Dipirona' })
      expect(result).toEqual(fixture)
      expect(supabase.__mocks.updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dipirona' })
      )
    })

    it('lança erro de validação para update inválido', async () => {
      await expect(medicineService.update('m1', { dosage_per_pill: -10 })).rejects.toThrow(
        /Erro de validação/
      )
    })
  })

  describe('delete', () => {
    it('deleta medicamento sem erro', async () => {
      supabase.__mocks.eqDelete2Mock.mockResolvedValue({ error: null })
      await expect(medicineService.delete('m1')).resolves.toBeUndefined()
      expect(supabase.__mocks.deleteMock).toHaveBeenCalled()
    })

    it('lança erro quando supabase falha', async () => {
      supabase.__mocks.eqDelete2Mock.mockResolvedValue({ error: new Error('fk violation') })
      await expect(medicineService.delete('m1')).rejects.toThrow('fk violation')
    })
  })
})
