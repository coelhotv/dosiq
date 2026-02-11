import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist functions to be used inside vi.mock
const mocks = vi.hoisted(() => {
  const eq = vi.fn()
  const single = vi.fn()
  const order = vi.fn()
  const select = vi.fn()
  const insert = vi.fn()
  const update = vi.fn()
  const del = vi.fn() // delete

  return {
    eq, single, order, select, insert, update, del,
    from: vi.fn()
  }
})

// Mock do módulo
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from
  },
  getUserId: vi.fn().mockResolvedValue('test-user-id')
}))

import { medicineService } from './api'

describe('medicineService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Configurar o encadeamento padrão
    // from() -> { select, insert, update, delete }
    mocks.from.mockReturnValue({
      select: mocks.select,
      insert: mocks.insert,
      update: mocks.update,
      delete: mocks.del,
    })

    // select() -> { eq }
    mocks.select.mockReturnValue({ eq: mocks.eq, single: mocks.single })
    
    // insert() -> { select }
    mocks.insert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mocks.single }) })
    
    // update() -> { eq }
    mocks.update.mockReturnValue({ eq: mocks.eq })
    
    // delete() -> { eq }
    mocks.del.mockReturnValue({ eq: mocks.eq })
    
    // eq() -> { eq, order, single, delete }
    mocks.eq.mockReturnValue({ 
      eq: mocks.eq, 
      order: mocks.order, 
      single: mocks.single, 
      delete: mocks.del 
    })

    // Default returns
    mocks.order.mockResolvedValue({ data: [], error: null })
  })

  describe('getAll', () => {
    it('should fetch all medicines and calculate average price', async () => {
      const mockData = [
        { 
          id: 1, 
          name: 'Dipirona', 
          stock: [
            { quantity: 10, unit_price: 5.0 }, // Total: 50
            { quantity: 5, unit_price: 10.0 }  // Total: 50
          ] 
        }
      ]
      
      // Setup mock return
      mocks.order.mockResolvedValue({ data: mockData, error: null })
      
      const result = await medicineService.getAll()
      
      expect(mocks.from).toHaveBeenCalledWith('medicines')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Dipirona')
      
      // Cálculo do preço médio: (50 + 50) / (10 + 5) = 100 / 15 = 6.666...
      expect(result[0].avg_price).toBeCloseTo(6.67, 2)
    })

    it('should handle errors from supabase', async () => {
      mocks.order.mockResolvedValue({ data: null, error: { message: 'Network error' } })
      
      await expect(medicineService.getAll()).rejects.toThrow('Network error')
    })
  })

  describe('create', () => {
    it('should create a medicine', async () => {
      const newMedicine = {
        name: 'Paracetamol',
        dosage_per_pill: 500,
        dosage_unit: 'mg'
      }
      const createdMedicine = { id: 1, ...newMedicine }
      
      // Mock chain for create: insert -> select -> single
      // Note: In beforeEach we setup insert -> select -> single
      // We just need to ensure the final single() returns what we want
      mocks.single.mockResolvedValue({ data: createdMedicine, error: null })
            
      const result = await medicineService.create(newMedicine)
      
      expect(mocks.from).toHaveBeenCalledWith('medicines')
      expect(mocks.insert).toHaveBeenCalledWith([{
        ...newMedicine,
        user_id: 'test-user-id',
        active_ingredient: null,
        laboratory: null,
        type: 'medicamento'
      }])
      expect(result).toEqual(createdMedicine)
    })
  })
})
