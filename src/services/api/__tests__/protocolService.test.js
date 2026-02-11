import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Supabase com factory function
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      })
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      })
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
    })
  })
}

const mockGetUserId = vi.fn().mockResolvedValue('test-user-id')

vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabase,
  getUserId: mockGetUserId
}))

describe('protocolService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Resetar mocks para estado padrão
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      })
    })
  })

  describe('getAll', () => {
    it('should fetch all protocols with medicine info', async () => {
      const { protocolService } = await import('../protocolService')
      const mockProtocols = [
        { id: '1', name: 'Protocolo 1', medicine: { name: 'Med 1' } },
        { id: '2', name: 'Protocolo 2', medicine: { name: 'Med 2' } }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockProtocols, error: null })
          })
        })
      })

      const result = await protocolService.getAll()
      expect(result).toEqual(mockProtocols)
      expect(mockSupabase.from).toHaveBeenCalledWith('protocols')
    })

    it('should throw error when supabase returns error', async () => {
      const { protocolService } = await import('../protocolService')

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
          })
        })
      })

      await expect(protocolService.getAll()).rejects.toThrow('DB Error')
    })
  })

  describe('getActive', () => {
    it('should fetch only active protocols', async () => {
      const { protocolService } = await import('../protocolService')
      const mockProtocols = [
        { id: '1', name: 'Protocolo Ativo', active: true, medicine: { name: 'Med 1' } }
      ]

      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockProtocols, error: null })
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEq
          })
        })
      })

      const result = await protocolService.getActive()
      expect(result).toEqual(mockProtocols)
    })
  })

  describe('getById', () => {
    it('should fetch a single protocol by ID', async () => {
      const { protocolService } = await import('../protocolService')
      const mockProtocol = { id: '1', name: 'Protocolo 1', medicine: { name: 'Med 1' } }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProtocol, error: null })
            })
          })
        })
      })

      const result = await protocolService.getById('1')
      expect(result).toEqual(mockProtocol)
    })

    it('should throw error when protocol not found', async () => {
      const { protocolService } = await import('../protocolService')

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
            })
          })
        })
      })

      await expect(protocolService.getById('999')).rejects.toThrow('Not found')
    })
  })

  describe('create', () => {
    it('should create a new protocol with valid data', async () => {
      const { protocolService } = await import('../protocolService')
      const newProtocol = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Novo Protocolo',
        frequency: 'diário',
        time_schedule: ['08:00', '20:00'],
        dosage_per_intake: 1
      }
      const createdProtocol = { id: '1', ...newProtocol, user_id: 'test-user-id' }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdProtocol, error: null })
          })
        })
      })

      const result = await protocolService.create(newProtocol)
      expect(result).toEqual(createdProtocol)
    })

    it('should throw validation error with invalid data', async () => {
      const { protocolService } = await import('../protocolService')
      const invalidProtocol = {
        name: 'A', // Nome muito curto
        frequency: 'diário',
        time_schedule: ['08:00'],
        dosage_per_intake: 0 // Dosagem inválida
      }

      await expect(protocolService.create(invalidProtocol)).rejects.toThrow()
    })

    it('should handle titration schedule correctly', async () => {
      const { protocolService } = await import('../protocolService')
      const protocolWithTitration = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Protocolo com Titulação',
        frequency: 'diário',
        time_schedule: ['08:00'],
        dosage_per_intake: 1,
        titration_schedule: [
          { dosage: 1, duration_days: 7, description: 'Etapa 1' },
          { dosage: 2, duration_days: 7, description: 'Etapa 2' }
        ],
        current_stage_index: 0,
        titration_status: 'titulando'
      }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: '1', ...protocolWithTitration }, error: null })
          })
        })
      })

      const result = await protocolService.create(protocolWithTitration)
      expect(result.titration_schedule).toHaveLength(2)
    })
  })

  describe('update', () => {
    it('should update an existing protocol', async () => {
      const { protocolService } = await import('../protocolService')
      const updates = { name: 'Protocolo Atualizado' }
      const updatedProtocol = { id: '1', name: 'Protocolo Atualizado', user_id: 'test-user-id' }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedProtocol, error: null })
              })
            })
          })
        })
      })

      const result = await protocolService.update('1', updates)
      expect(result.name).toBe('Protocolo Atualizado')
    })

    it('should throw validation error with invalid updates', async () => {
      const { protocolService } = await import('../protocolService')
      const invalidUpdates = { name: 'A' } // Nome muito curto

      await expect(protocolService.update('1', invalidUpdates)).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('should delete a protocol', async () => {
      const { protocolService } = await import('../protocolService')
      let deleteCalled = false

      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              deleteCalled = true
              return { error: null }
            })
          })
        })
      })

      await protocolService.delete('1')
      expect(deleteCalled).toBe(true)
    })

    it('should throw error when delete fails', async () => {
      const { protocolService } = await import('../protocolService')

      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: new Error('Delete failed') })
          })
        })
      })

      await expect(protocolService.delete('1')).rejects.toThrow('Delete failed')
    })
  })

  describe('getByMedicineId', () => {
    it('should fetch protocols by medicine ID', async () => {
      const { protocolService } = await import('../protocolService')
      const mockProtocols = [
        { id: '1', medicine_id: 'med-1', name: 'Protocolo 1' }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockProtocols, error: null })
          })
        })
      })

      const result = await protocolService.getByMedicineId('med-1')
      expect(result).toEqual(mockProtocols)
    })
  })

  describe('advanceTitrationStage', () => {
    it('should advance to next titration stage', async () => {
      const { protocolService } = await import('../protocolService')
      const mockProtocol = {
        id: '1',
        titration_schedule: [
          { dosage: 1, duration_days: 7, description: 'Etapa 1' },
          { dosage: 2, duration_days: 7, description: 'Etapa 2' }
        ],
        current_stage_index: 0,
        stage_started_at: '2024-01-01T00:00:00Z'
      }

      // Mock para getById
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProtocol, error: null })
            })
          })
        })
      })

      // Mock para update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ...mockProtocol, current_stage_index: 1, titration_status: 'titulando' },
                  error: null
                })
              })
            })
          })
        })
      })

      const result = await protocolService.advanceTitrationStage('1')
      expect(result.current_stage_index).toBe(1)
    })

    it('should mark as completed when reaching final stage', async () => {
      const { protocolService } = await import('../protocolService')
      const mockProtocol = {
        id: '1',
        titration_schedule: [
          { dosage: 1, duration_days: 7, description: 'Etapa 1' }
        ],
        current_stage_index: 0,
        stage_started_at: '2024-01-01T00:00:00Z'
      }

      // Mock para getById
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProtocol, error: null })
            })
          })
        })
      })

      // Mock para update (alvo atingido)
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ...mockProtocol, titration_status: 'alvo_atingido' },
                  error: null
                })
              })
            })
          })
        })
      })

      const result = await protocolService.advanceTitrationStage('1')
      expect(result.titration_status).toBe('alvo_atingido')
    })

    it('should throw error when protocol has no titration schedule', async () => {
      const { protocolService } = await import('../protocolService')
      const mockProtocol = {
        id: '1',
        titration_schedule: [],
        current_stage_index: 0
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProtocol, error: null })
            })
          })
        })
      })

      await expect(protocolService.advanceTitrationStage('1')).rejects.toThrow('Este protocolo não possui regime de titulação')
    })
  })
})
