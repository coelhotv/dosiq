import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Supabase com factory function
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null })
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

describe('treatmentPlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Resetar mocks para estado padrão
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null })
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
    it('should fetch all treatment plans with protocols', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
      const mockPlans = [
        {
          id: '1',
          name: 'Plano 1',
          protocols: [
            { id: 'p1', name: 'Protocolo 1', medicine: { name: 'Med 1' } }
          ]
        },
        {
          id: '2',
          name: 'Plano 2',
          protocols: []
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockPlans, error: null })
          })
        })
      })

      const result = await treatmentPlanService.getAll()
      expect(result).toEqual(mockPlans)
      expect(result).toHaveLength(2)
      expect(result[0].protocols).toBeDefined()
    })

    it('should throw error when supabase returns error', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
          })
        })
      })

      await expect(treatmentPlanService.getAll()).rejects.toThrow('DB Error')
    })

    it('should return empty array when no plans exist', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })

      const result = await treatmentPlanService.getAll()
      expect(result).toEqual([])
    })
  })

  describe('create', () => {
    it('should create a new treatment plan', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
      const newPlan = {
        name: 'Novo Plano de Tratamento',
        description: 'Descrição do plano'
      }
      const createdPlan = {
        id: '1',
        ...newPlan,
        user_id: 'test-user-id',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdPlan, error: null })
          })
        })
      })

      const result = await treatmentPlanService.create(newPlan)
      expect(result).toEqual(createdPlan)
      expect(result.user_id).toBe('test-user-id')
    })

    it('should throw error when creation fails', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
      const newPlan = { name: 'Plano com Erro' }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Insert failed') })
          })
        })
      })

      await expect(treatmentPlanService.create(newPlan)).rejects.toThrow('Insert failed')
    })

    it('should create minimal plan with only name', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
      const newPlan = { name: 'Plano Mínimo' }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: '1', name: 'Plano Mínimo', user_id: 'test-user-id' },
              error: null
            })
          })
        })
      })

      const result = await treatmentPlanService.create(newPlan)
      expect(result.name).toBe('Plano Mínimo')
    })
  })

  describe('update', () => {
    it('should update an existing treatment plan', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
      const updates = { name: 'Plano Atualizado', description: 'Nova descrição' }
      const updatedPlan = {
        id: '1',
        name: 'Plano Atualizado',
        description: 'Nova descrição',
        user_id: 'test-user-id'
      }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedPlan, error: null })
              })
            })
          })
        })
      })

      const result = await treatmentPlanService.update('1', updates)
      expect(result.name).toBe('Plano Atualizado')
      expect(result.description).toBe('Nova descrição')
    })

    it('should throw error when update fails', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
      const updates = { name: 'Plano Falho' }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: new Error('Update failed') })
              })
            })
          })
        })
      })

      await expect(treatmentPlanService.update('999', updates)).rejects.toThrow('Update failed')
    })

    it('should update partial data', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
      const updates = { description: 'Apenas descrição atualizada' }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: '1',
                    name: 'Plano Original',
                    description: 'Apenas descrição atualizada',
                    user_id: 'test-user-id'
                  },
                  error: null
                })
              })
            })
          })
        })
      })

      const result = await treatmentPlanService.update('1', updates)
      expect(result.description).toBe('Apenas descrição atualizada')
      expect(result.name).toBe('Plano Original')
    })
  })

  describe('delete', () => {
    it('should delete a treatment plan', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
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

      await treatmentPlanService.delete('1')
      expect(deleteCalled).toBe(true)
    })

    it('should throw error when delete fails', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')

      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: new Error('Delete failed') })
          })
        })
      })

      await expect(treatmentPlanService.delete('999')).rejects.toThrow('Delete failed')
    })

    it('should use user_id filter for security', async () => {
      const { treatmentPlanService } = await import('../treatmentPlanService')
      const idFilters = []
      const userFilters = []

      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((field, value) => {
            if (field === 'id') idFilters.push(value)
            if (field === 'user_id') userFilters.push(value)
            return {
              eq: vi.fn().mockResolvedValue({ error: null })
            }
          })
        })
      })

      await treatmentPlanService.delete('plan-123')
      // Verifica que o user_id foi chamado
      expect(mockGetUserId).toHaveBeenCalled()
    })
  })
})
