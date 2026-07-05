import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { emergencyCardService } from '@/features/emergency/services/emergencyCardService'

// Mock Supabase at module level (R-071)
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
  },
  getUserId: vi.fn().mockResolvedValue('test-user-id'),
}))

// Mock validateEmergencyCard
vi.mock('@schemas/emergencyCardSchema', () => ({
  validateEmergencyCard: vi.fn((data) => {
    // Simulate basic validation
    if (!data.emergency_contacts || data.emergency_contacts.length === 0) {
      return {
        success: false,
        errors: [{ field: 'emergency_contacts', message: 'Adicione pelo menos um contato' }],
      }
    }
    if (!data.blood_type) {
      return {
        success: false,
        errors: [{ field: 'blood_type', message: 'Tipo sanguíneo é obrigatório' }],
      }
    }
    return { success: true, data }
  }),
}))

describe('emergencyCardService', () => {
  const validCardData = {
    emergency_contacts: [
      {
        name: 'Maria Silva',
        phone: '(11) 99999-8888',
        relationship: 'Esposa',
      },
    ],
    allergies: ['Penicilina'],
    blood_type: 'A+',
    notes: 'Paciente com hipertensão',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockSelect.mockReturnValue({
      eq: mockEq,
    })
    mockEq.mockReturnValue({
      single: mockSingle,
    })
    mockUpsert.mockResolvedValue({ error: null })
    mockSingle.mockResolvedValue({ data: null, error: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('save', () => {
    it('should return validation errors when data is invalid', async () => {
      const invalidData = {
        emergency_contacts: [],
        blood_type: 'A+',
      }

      const result = await emergencyCardService.save(invalidData)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should save valid data successfully', async () => {
      const result = await emergencyCardService.save(validCardData)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.emergency_contacts).toHaveLength(1)
      expect(result.data.blood_type).toBe('A+')
    })

    it('should add last_updated timestamp to saved data', async () => {
      const result = await emergencyCardService.save(validCardData)

      expect(result.success).toBe(true)
      expect(result.data.last_updated).toBeDefined()
    })

    it('should call Supabase upsert with correct data', async () => {
      await emergencyCardService.save(validCardData)

      expect(mockUpsert).toHaveBeenCalled()
      const upsertCall = mockUpsert.mock.calls[0][0]
      expect(upsertCall.user_id).toBe('test-user-id')
      expect(upsertCall.emergency_card).toBeDefined()
    })

    it('should return warning when Supabase save fails', async () => {
      mockUpsert.mockResolvedValueOnce({
        error: { message: 'Database error', code: 'DB_ERROR' },
      })

      const result = await emergencyCardService.save(validCardData)

      expect(result.success).toBe(true)
      expect(result.warning).toBeDefined()
      expect(result.warning).toContain('localmente')
    })

    it('should return warning when column does not exist', async () => {
      mockUpsert.mockResolvedValueOnce({
        error: { message: 'column emergency_card does not exist', code: 'PGRST204' },
      })

      const result = await emergencyCardService.save(validCardData)

      expect(result.success).toBe(true)
      expect(result.warning).toBeDefined()
    })
  })

  describe('load', () => {
    it('should return null when no data exists', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      const result = await emergencyCardService.load()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('should load data from Supabase when localStorage is empty', async () => {
      const supabaseData = {
        emergency_card: {
          emergency_contacts: validCardData.emergency_contacts,
          allergies: validCardData.allergies,
          blood_type: validCardData.blood_type,
          notes: validCardData.notes,
          last_updated: '2026-02-25T00:00:00.000Z',
        },
      }

      mockSingle.mockResolvedValueOnce({ data: supabaseData, error: null })

      const result = await emergencyCardService.load()

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.source).toBe('supabase')
      expect(result.data.blood_type).toBe('A+')
    })

    it('should handle Supabase errors gracefully', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Connection error', code: 'CONN_ERROR' },
      })

      const result = await emergencyCardService.load()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('should call Supabase with correct query', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      await emergencyCardService.load()

      expect(mockSelect).toHaveBeenCalledWith('emergency_card')
      expect(mockEq).toHaveBeenCalledWith('user_id', 'test-user-id')
    })
  })

  describe('getOfflineCard', () => {
    it('should return null in test environment (localStorage disabled)', () => {
      const result = emergencyCardService.getOfflineCard()

      // In test environment, localStorage is disabled (R-076)
      expect(result).toBeNull()
    })

    it('should be synchronous', () => {
      // This test verifies the function is not async
      const result = emergencyCardService.getOfflineCard()
      expect(result).not.toBeInstanceOf(Promise)
    })
  })

  describe('clearLocalCache', () => {
    it('should not throw in test environment', () => {
      expect(() => emergencyCardService.clearLocalCache()).not.toThrow()
    })
  })

  describe('offline-first strategy', () => {
    it('should prioritize localStorage over Supabase', async () => {
      // In test environment, localStorage returns null
      // So it should fall back to Supabase
      const supabaseData = {
        emergency_card: {
          emergency_contacts: validCardData.emergency_contacts,
          allergies: [],
          blood_type: 'O+',
          notes: null,
          last_updated: '2026-02-25T00:00:00.000Z',
        },
      }

      mockSingle.mockResolvedValueOnce({ data: supabaseData, error: null })

      const result = await emergencyCardService.load()

      // Since localStorage is disabled in tests, it falls back to Supabase
      expect(result.source).toBe('supabase')
    })
  })

  describe('write-through strategy', () => {
    it('should attempt to save to Supabase after local save', async () => {
      await emergencyCardService.save(validCardData)

      expect(mockUpsert).toHaveBeenCalled()
    })

    it('should not fail when Supabase is unavailable', async () => {
      mockUpsert.mockRejectedValueOnce(new Error('Network error'))

      const result = await emergencyCardService.save(validCardData)

      // Should still succeed (saved locally)
      expect(result.success).toBe(true)
      expect(result.warning).toBeDefined()
    })
  })

  describe('data mapping', () => {
    it('should map data correctly for Supabase', async () => {
      await emergencyCardService.save(validCardData)

      const upsertCall = mockUpsert.mock.calls[0][0]
      const emergencyCard = upsertCall.emergency_card

      expect(emergencyCard.emergency_contacts).toEqual(validCardData.emergency_contacts)
      expect(emergencyCard.allergies).toEqual(validCardData.allergies)
      expect(emergencyCard.blood_type).toBe(validCardData.blood_type)
      expect(emergencyCard.notes).toBe(validCardData.notes)
    })

    it('should handle null notes in data mapping', async () => {
      const dataWithNullNotes = {
        ...validCardData,
        notes: null,
      }

      await emergencyCardService.save(dataWithNullNotes)

      const upsertCall = mockUpsert.mock.calls[0][0]
      expect(upsertCall.emergency_card.notes).toBeNull()
    })

    it('should map Supabase data correctly on load', async () => {
      const supabaseData = {
        emergency_card: {
          emergency_contacts: [
            { name: 'Test Contact', phone: '(11) 99999-9999', relationship: 'Friend' },
          ],
          allergies: ['Aspirin'],
          blood_type: 'B-',
          notes: 'Test notes',
          last_updated: '2026-02-25T00:00:00.000Z',
        },
      }

      mockSingle.mockResolvedValueOnce({ data: supabaseData, error: null })

      const result = await emergencyCardService.load()

      expect(result.data.emergency_contacts).toHaveLength(1)
      expect(result.data.allergies).toEqual(['Aspirin'])
      expect(result.data.blood_type).toBe('B-')
      expect(result.data.notes).toBe('Test notes')
    })

    it('should handle missing fields in Supabase data', async () => {
      const supabaseData = {
        emergency_card: {
          // Missing some fields
          blood_type: 'O+',
        },
      }

      mockSingle.mockResolvedValueOnce({ data: supabaseData, error: null })

      const result = await emergencyCardService.load()

      expect(result.data.emergency_contacts).toEqual([])
      expect(result.data.allergies).toEqual([])
      expect(result.data.blood_type).toBe('O+')
      expect(result.data.notes).toBeNull()
    })
  })
})
