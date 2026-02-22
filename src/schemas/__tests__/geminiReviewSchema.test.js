import { describe, it, expect } from 'vitest'
import {
  geminiReviewSchema,
  geminiReviewCreateSchema,
  geminiReviewUpdateSchema,
  geminiReviewStatusUpdateSchema,
  geminiReviewFiltersSchema,
  validateGeminiReview,
  validateGeminiReviewCreate,
  validateGeminiReviewUpdate,
  validateGeminiReviewStatusUpdate,
  validateGeminiReviewFilters,
  getStatusLabel,
  getPriorityLabel,
  getCategoryLabel,
  isFinalStatus,
  REVIEW_STATUSES,
  REVIEW_PRIORITIES,
  REVIEW_CATEGORIES,
} from '../geminiReviewSchema'

describe('Gemini Review Schema', () => {
  // ============================================================================
  // TESTES DE CONSTANTES
  // ============================================================================

  describe('Constantes', () => {
    it('deve ter status definidos corretamente', () => {
      expect(REVIEW_STATUSES).toEqual(['pending', 'in_progress', 'fixed', 'discarded'])
    })

    it('deve ter prioridades definidas corretamente', () => {
      expect(REVIEW_PRIORITIES).toEqual(['critical', 'high', 'medium', 'low'])
    })

    it('deve ter categorias definidas corretamente', () => {
      expect(REVIEW_CATEGORIES).toEqual(['style', 'bug', 'security', 'performance', 'maintainability'])
    })
  })

  // ============================================================================
  // TESTES DE SCHEMA BASE
  // ============================================================================

  describe('Schema Base', () => {
    const validReview = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      pr_number: 42,
      commit_sha: 'abc123def456',
      file_path: 'src/services/api/medicineService.js',
      line_start: 10,
      line_end: 20,
      issue_hash: 'd41d8cd98f00b204e9800998ecf8427e',
      status: 'pending',
      priority: 'high',
      category: 'bug',
      title: 'Função não tratada',
      description: 'A função não tem tratamento de erro',
      suggestion: 'Adicionar try/catch',
    }

    it('deve validar review válida', () => {
      const result = geminiReviewSchema.safeParse(validReview)
      expect(result.success).toBe(true)
    })

    it('deve rejeitar pr_number negativo', () => {
      const invalid = { ...validReview, pr_number: -1 }
      const result = geminiReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('deve rejeitar pr_number zero', () => {
      const invalid = { ...validReview, pr_number: 0 }
      const result = geminiReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('deve rejeitar commit_sha vazio', () => {
      const invalid = { ...validReview, commit_sha: '' }
      const result = geminiReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('deve rejeitar file_path vazio', () => {
      const invalid = { ...validReview, file_path: '' }
      const result = geminiReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('deve rejeitar issue_hash vazio', () => {
      const invalid = { ...validReview, issue_hash: '' }
      const result = geminiReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('deve rejeitar status inválido', () => {
      const invalid = { ...validReview, status: 'invalid_status' }
      const result = geminiReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('deve rejeitar prioridade inválida', () => {
      const invalid = { ...validReview, priority: 'ultra_high' }
      const result = geminiReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('deve rejeitar categoria inválida', () => {
      const invalid = { ...validReview, category: 'typo' }
      const result = geminiReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('deve aceitar campos opcionais como null', () => {
      const reviewWithNulls = {
        ...validReview,
        line_start: null,
        line_end: null,
        priority: null,
        category: null,
        title: null,
        description: null,
        suggestion: null,
      }
      const result = geminiReviewSchema.safeParse(reviewWithNulls)
      expect(result.success).toBe(true)
    })

    it('deve aplicar status padrão "pending"', () => {
      const withoutStatus = { ...validReview }
      delete withoutStatus.status
      const result = geminiReviewSchema.safeParse(withoutStatus)
      expect(result.success).toBe(true)
      expect(result.data.status).toBe('pending')
    })
  })

  // ============================================================================
  // TESTES DE SCHEMA DE CRIAÇÃO
  // ============================================================================

  describe('Schema de Criação', () => {
    const validCreateData = {
      pr_number: 42,
      commit_sha: 'abc123def456',
      file_path: 'src/services/api/medicineService.js',
      issue_hash: 'd41d8cd98f00b204e9800998ecf8427e',
      status: 'pending',
      priority: 'high',
      category: 'bug',
      title: 'Função não tratada',
      description: 'A função não tem tratamento de erro',
      suggestion: 'Adicionar try/catch',
    }

    it('deve validar dados de criação válidos', () => {
      const result = geminiReviewCreateSchema.safeParse(validCreateData)
      expect(result.success).toBe(true)
    })

    it('deve rejeitar campos gerenciados pelo banco', () => {
      const withManagedFields = {
        ...validCreateData,
        id: '550e8400-e29b-41d4-a716-446655440000',
        created_at: '2026-02-22T00:00:00Z',
        updated_at: '2026-02-22T00:00:00Z',
      }
      const result = geminiReviewCreateSchema.safeParse(withManagedFields)
      // O omit remove esses campos, então a validação deve passar ignorando-os
      expect(result.success).toBe(true)
      expect(result.data.id).toBeUndefined()
    })
  })

  // ============================================================================
  // TESTES DE SCHEMA DE ATUALIZAÇÃO
  // ============================================================================

  describe('Schema de Atualização', () => {
    it('deve aceitar dados parciais para atualização', () => {
      const partialUpdate = {
        status: 'in_progress',
      }
      const result = geminiReviewUpdateSchema.safeParse(partialUpdate)
      expect(result.success).toBe(true)
    })

    it('deve aceitar apenas prioridade na atualização', () => {
      const partialUpdate = {
        priority: 'critical',
      }
      const result = geminiReviewUpdateSchema.safeParse(partialUpdate)
      expect(result.success).toBe(true)
    })

    it('deve aceitar atualização vazia (para casos de patch)', () => {
      const result = geminiReviewUpdateSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  // ============================================================================
  // TESTES DE SCHEMA DE ATUALIZAÇÃO DE STATUS
  // ============================================================================

  describe('Schema de Atualização de Status', () => {
    it('deve validar atualização de status válida', () => {
      const statusUpdate = {
        status: 'fixed',
        resolved_by: '550e8400-e29b-41d4-a716-446655440000',
        resolved_at: '2026-02-22T10:00:00Z',
      }
      const result = geminiReviewStatusUpdateSchema.safeParse(statusUpdate)
      expect(result.success).toBe(true)
    })

    it('deve validar apenas status (sem resolved_by)', () => {
      const statusUpdate = {
        status: 'in_progress',
      }
      const result = geminiReviewStatusUpdateSchema.safeParse(statusUpdate)
      expect(result.success).toBe(true)
    })

    it('deve rejeitar status inválido', () => {
      const invalidStatus = {
        status: 'rejected',
      }
      const result = geminiReviewStatusUpdateSchema.safeParse(invalidStatus)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================================
  // TESTES DE SCHEMA DE FILTROS
  // ============================================================================

  describe('Schema de Filtros', () => {
    it('deve validar filtros vazios', () => {
      const result = geminiReviewFiltersSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('deve validar filtro por pr_number', () => {
      const filters = { pr_number: 42 }
      const result = geminiReviewFiltersSchema.safeParse(filters)
      expect(result.success).toBe(true)
    })

    it('deve validar filtro por status', () => {
      const filters = { status: 'pending' }
      const result = geminiReviewFiltersSchema.safeParse(filters)
      expect(result.success).toBe(true)
    })

    it('deve validar filtro por categoria', () => {
      const filters = { category: 'security' }
      const result = geminiReviewFiltersSchema.safeParse(filters)
      expect(result.success).toBe(true)
    })

    it('deve validar filtro por prioridade', () => {
      const filters = { priority: 'critical' }
      const result = geminiReviewFiltersSchema.safeParse(filters)
      expect(result.success).toBe(true)
    })

    it('deve validar múltiplos filtros', () => {
      const filters = {
        pr_number: 42,
        status: 'pending',
        category: 'bug',
      }
      const result = geminiReviewFiltersSchema.safeParse(filters)
      expect(result.success).toBe(true)
    })

    it('deve rejeitar pr_number negativo', () => {
      const filters = { pr_number: -1 }
      const result = geminiReviewFiltersSchema.safeParse(filters)
      expect(result.success).toBe(false)
    })

    it('deve rejeitar status inválido em filtros', () => {
      const filters = { status: 'invalid' }
      const result = geminiReviewFiltersSchema.safeParse(filters)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================================
  // TESTES DE FUNÇÕES DE VALIDAÇÃO
  // ============================================================================

  describe('Funções de Validação', () => {
    const validReview = {
      pr_number: 42,
      commit_sha: 'abc123def456',
      file_path: 'src/services/api/medicineService.js',
      issue_hash: 'd41d8cd98f00b204e9800998ecf8427e',
      status: 'pending',
    }

    describe('validateGeminiReview', () => {
      it('deve retornar sucesso para review válida', () => {
        const result = validateGeminiReview(validReview)
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.errors).toBeNull()
      })

      it('deve retornar erro para review inválida', () => {
        const invalidReview = { ...validReview, pr_number: -1 }
        const result = validateGeminiReview(invalidReview)
        expect(result.success).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors.length).toBeGreaterThan(0)
      })

      it('deve incluir field nos erros', () => {
        const invalidReview = { ...validReview, pr_number: -1 }
        const result = validateGeminiReview(invalidReview)
        expect(result.errors[0].field).toBe('pr_number')
      })
    })

    describe('validateGeminiReviewCreate', () => {
      it('deve retornar sucesso para dados de criação válidos', () => {
        const result = validateGeminiReviewCreate(validReview)
        expect(result.success).toBe(true)
      })

      it('deve retornar erro para dados inválidos', () => {
        const invalid = { ...validReview, file_path: '' }
        const result = validateGeminiReviewCreate(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe('validateGeminiReviewUpdate', () => {
      it('deve retornar sucesso para atualização parcial', () => {
        const result = validateGeminiReviewUpdate({ status: 'fixed' })
        expect(result.success).toBe(true)
      })
    })

    describe('validateGeminiReviewStatusUpdate', () => {
      it('deve retornar sucesso para atualização de status', () => {
        const result = validateGeminiReviewStatusUpdate({ status: 'fixed' })
        expect(result.success).toBe(true)
      })

      it('deve retornar erro para status inválido', () => {
        const result = validateGeminiReviewStatusUpdate({ status: 'invalid' })
        expect(result.success).toBe(false)
      })
    })

    describe('validateGeminiReviewFilters', () => {
      it('deve retornar sucesso para filtros válidos', () => {
        const result = validateGeminiReviewFilters({ pr_number: 42 })
        expect(result.success).toBe(true)
      })

      it('deve retornar sucesso para filtros vazios', () => {
        const result = validateGeminiReviewFilters({})
        expect(result.success).toBe(true)
      })
    })
  })

  // ============================================================================
  // TESTES DE HELPERS
  // ============================================================================

  describe('Helpers', () => {
    describe('getStatusLabel', () => {
      it('deve retornar label em português para status válido', () => {
        expect(getStatusLabel('pending')).toBe('Pendente')
        expect(getStatusLabel('in_progress')).toBe('Em Progresso')
        expect(getStatusLabel('fixed')).toBe('Corrigido')
        expect(getStatusLabel('discarded')).toBe('Descartado')
      })

      it('deve retornar o próprio status se não encontrar label', () => {
        expect(getStatusLabel('unknown')).toBe('unknown')
      })
    })

    describe('getPriorityLabel', () => {
      it('deve retornar label em português para prioridade válida', () => {
        expect(getPriorityLabel('critical')).toBe('Crítica')
        expect(getPriorityLabel('high')).toBe('Alta')
        expect(getPriorityLabel('medium')).toBe('Média')
        expect(getPriorityLabel('low')).toBe('Baixa')
      })

      it('deve retornar a própria prioridade se não encontrar label', () => {
        expect(getPriorityLabel('unknown')).toBe('unknown')
      })
    })

    describe('getCategoryLabel', () => {
      it('deve retornar label em português para categoria válida', () => {
        expect(getCategoryLabel('style')).toBe('Estilo')
        expect(getCategoryLabel('bug')).toBe('Bug')
        expect(getCategoryLabel('security')).toBe('Segurança')
        expect(getCategoryLabel('performance')).toBe('Performance')
        expect(getCategoryLabel('maintainability')).toBe('Manutenibilidade')
      })

      it('deve retornar a própria categoria se não encontrar label', () => {
        expect(getCategoryLabel('unknown')).toBe('unknown')
      })
    })

    describe('isFinalStatus', () => {
      it('deve retornar true para status final "fixed"', () => {
        expect(isFinalStatus('fixed')).toBe(true)
      })

      it('deve retornar true para status final "discarded"', () => {
        expect(isFinalStatus('discarded')).toBe(true)
      })

      it('deve retornar false para status não final "pending"', () => {
        expect(isFinalStatus('pending')).toBe(false)
      })

      it('deve retornar false para status não final "in_progress"', () => {
        expect(isFinalStatus('in_progress')).toBe(false)
      })
    })
  })
})
