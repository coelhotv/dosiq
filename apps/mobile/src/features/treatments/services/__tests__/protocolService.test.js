import { protocolService } from '../protocolService'
import { supabase } from '../../../../platform/supabase/nativeSupabaseClient'

// Mock supabase mobile client com cadeia fluente completa para protocolos.
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => {
  // getAll/getActive: from→select→eq[user_id]→order  OR  from→select→eq→eq→lte→or→order
  const orderMock = jest.fn()
  const orMock = jest.fn(() => ({ order: orderMock }))
  const lteMock = jest.fn(() => ({ or: orMock }))
  const eqActive2Mock = jest.fn(() => ({ lte: lteMock }))
  // getById/getByMedicineId: from→select→eq→eq→single  OR  →eq→eq (no single)
  const singleGetByIdMock = jest.fn()
  const eqGetByIdInnerMock = jest.fn(() => ({ single: singleGetByIdMock }))
  const eqByMedInnerMock = jest.fn()
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

  // select() retorna objeto com várias entradas possíveis dependendo da operação.
  const selectMock = jest.fn(() => {
    // Primeira eq decide o caminho:
    return {
      eq: jest.fn((field) => {
        if (field === 'user_id') {
          // getAll: termina em .order
          // getActive: continua com .eq('active').lte().or().order
          return {
            order: orderMock,
            eq: eqActive2Mock,
          }
        }
        if (field === 'id') {
          // getById: id→user_id→single
          return { eq: eqGetByIdInnerMock }
        }
        if (field === 'medicine_id') {
          // getByMedicineId: medicine_id→user_id
          return { eq: eqByMedInnerMock }
        }
        return {}
      }),
    }
  })

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
      __mocks: {
        orderMock,
        orMock,
        lteMock,
        singleGetByIdMock,
        eqGetByIdInnerMock,
        eqByMedInnerMock,
        singleCreateMock,
        insertMock,
        singleUpdateMock,
        updateMock,
        deleteMock,
        eqDelete2Mock,
        fromMock,
      },
    },
  }
})

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const MED_ID = '660e8400-e29b-41d4-a716-446655440111'

const VALID_PROTOCOL = {
  medicine_id: MED_ID,
  name: 'SeloZok manhã/noite',
  frequency: 'diário',
  time_schedule: ['08:00', '20:00'],
  dosage_per_intake: 2,
  start_date: '2026-05-16',
}

describe('protocolService (mobile)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })
  })

  describe('getAll', () => {
    it('retorna lista de protocolos do usuário', async () => {
      const fixtures = [{ id: 'p1', name: 'SeloZok' }]
      supabase.__mocks.orderMock.mockResolvedValue({ data: fixtures, error: null })

      const result = await protocolService.getAll()
      expect(supabase.from).toHaveBeenCalledWith('protocols')
      expect(result).toEqual(fixtures)
    })

    it('retorna [] quando data é null', async () => {
      supabase.__mocks.orderMock.mockResolvedValue({ data: null, error: null })
      expect(await protocolService.getAll()).toEqual([])
    })

    it('lança erro quando supabase falha', async () => {
      supabase.__mocks.orderMock.mockResolvedValue({
        data: null,
        error: new Error('db down'),
      })
      await expect(protocolService.getAll()).rejects.toThrow('db down')
    })

    it('lança erro quando sessão expirou', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      await expect(protocolService.getAll()).rejects.toThrow(/Sessão expirada/)
    })
  })

  describe('getActive', () => {
    it('retorna protocolos ativos filtrados por data', async () => {
      const fixtures = [{ id: 'p1', active: true }]
      supabase.__mocks.orderMock.mockResolvedValue({ data: fixtures, error: null })

      const result = await protocolService.getActive('2026-05-16')
      expect(result).toEqual(fixtures)
      expect(supabase.__mocks.lteMock).toHaveBeenCalledWith('start_date', '2026-05-16')
      expect(supabase.__mocks.orMock).toHaveBeenCalledWith(
        'end_date.is.null,end_date.gte.2026-05-16'
      )
    })

    it('retorna [] quando data nulo', async () => {
      supabase.__mocks.orderMock.mockResolvedValue({ data: null, error: null })
      expect(await protocolService.getActive('2026-05-16')).toEqual([])
    })
  })

  describe('getById', () => {
    it('retorna protocolo por id', async () => {
      const fixture = { id: 'p1', name: 'SeloZok' }
      supabase.__mocks.singleGetByIdMock.mockResolvedValue({ data: fixture, error: null })

      const result = await protocolService.getById('p1')
      expect(result).toEqual(fixture)
    })

    it('lança erro quando supabase falha', async () => {
      supabase.__mocks.singleGetByIdMock.mockResolvedValue({
        data: null,
        error: new Error('not found'),
      })
      await expect(protocolService.getById('p1')).rejects.toThrow('not found')
    })
  })

  describe('create', () => {
    it('cria protocolo válido com user_id injetado', async () => {
      const fixture = { id: 'p2', ...VALID_PROTOCOL }
      supabase.__mocks.singleCreateMock.mockResolvedValue({ data: fixture, error: null })

      const result = await protocolService.create(VALID_PROTOCOL)
      expect(result).toEqual(fixture)
      const payload = supabase.__mocks.insertMock.mock.calls[0][0][0]
      expect(payload.user_id).toBe(USER_ID)
      expect(payload.name).toBe('SeloZok manhã/noite')
      expect(payload.titration_schedule).toEqual([])
      expect(payload.current_stage_index).toBe(0)
      expect(payload.stage_started_at).toBeNull()
    })

    it('lança erro de validação para payload inválido', async () => {
      await expect(protocolService.create({ name: '' })).rejects.toThrow(/Erro de validação/)
    })

    it('lança erro quando supabase falha', async () => {
      supabase.__mocks.singleCreateMock.mockResolvedValue({
        data: null,
        error: new Error('fk violation'),
      })
      await expect(protocolService.create(VALID_PROTOCOL)).rejects.toThrow('fk violation')
    })
  })

  describe('update', () => {
    it('atualiza protocolo existente', async () => {
      const fixture = { id: 'p1', name: 'SeloZok renomeado' }
      supabase.__mocks.singleUpdateMock.mockResolvedValue({ data: fixture, error: null })

      const result = await protocolService.update('p1', { name: 'SeloZok renomeado' })
      expect(result).toEqual(fixture)
      expect(supabase.__mocks.updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'SeloZok renomeado' })
      )
    })

    it('lança erro de validação para update inválido', async () => {
      await expect(
        protocolService.update('p1', { dosage_per_intake: -10 })
      ).rejects.toThrow(/Erro de validação/)
    })
  })

  describe('delete', () => {
    it('deleta protocolo sem erro', async () => {
      supabase.__mocks.eqDelete2Mock.mockResolvedValue({ error: null })
      await expect(protocolService.delete('p1')).resolves.toBeUndefined()
      expect(supabase.__mocks.deleteMock).toHaveBeenCalled()
    })

    it('lança erro quando supabase falha', async () => {
      supabase.__mocks.eqDelete2Mock.mockResolvedValue({ error: new Error('not allowed') })
      await expect(protocolService.delete('p1')).rejects.toThrow('not allowed')
    })
  })

  describe('getByMedicineId', () => {
    it('retorna protocolos do medicamento', async () => {
      const fixtures = [{ id: 'p1' }, { id: 'p2' }]
      supabase.__mocks.eqByMedInnerMock.mockResolvedValue({ data: fixtures, error: null })
      const result = await protocolService.getByMedicineId(MED_ID)
      expect(result).toEqual(fixtures)
    })

    it('retorna [] quando data nulo', async () => {
      supabase.__mocks.eqByMedInnerMock.mockResolvedValue({ data: null, error: null })
      expect(await protocolService.getByMedicineId(MED_ID)).toEqual([])
    })
  })
})
