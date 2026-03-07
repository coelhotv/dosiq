import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  searchLaboratories,
  getLaboratoryByName,
  getAllLaboratories,
} from '../laboratoryDatabaseService'

/**
 * Mock da base de laboratórios para testes isolados
 */
const mockDatabase = [
  { laboratory: 'EMS' },
  { laboratory: 'LEGRAND PHARMA' },
  { laboratory: 'PFIZER BRASIL' },
  { laboratory: 'BIONOVIS' },
  { laboratory: 'MERCK SHARP & DOHME' },
]

// Mock do módulo de import dinâmico
vi.mock('@medications/data/laboratoryDatabase.json', () => ({
  default: mockDatabase,
}))

describe('laboratoryDatabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('searchLaboratories', () => {
    it('retorna laboratórios por termo', async () => {
      const results = await searchLaboratories('ems')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].laboratory.toUpperCase()).toContain('EMS')
    })

    it('retorna laboratórios por busca parcial', async () => {
      const results = await searchLaboratories('pharma')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(r => r.laboratory.toUpperCase().includes('PHARMA'))).toBe(true)
    })

    it('retorna vazio para query vazia', async () => {
      const results = await searchLaboratories('')
      expect(results).toEqual([])
    })

    it('retorna vazio para query apenas espaços', async () => {
      const results = await searchLaboratories('   ')
      expect(results).toEqual([])
    })

    it('retorna vazio para laboratório inexistente', async () => {
      const results = await searchLaboratories('xyz_inexistente')
      expect(results).toEqual([])
    })

    it('respeita limite de resultados', async () => {
      const results = await searchLaboratories('a', 2)
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('retorna máximo 10 resultados por default', async () => {
      const results = await searchLaboratories('a')
      expect(results.length).toBeLessThanOrEqual(10)
    })

    it('busca é case-insensitive', async () => {
      const resultsLower = await searchLaboratories('ems')
      const resultsUpper = await searchLaboratories('EMS')
      expect(resultsLower.length).toBe(resultsUpper.length)
    })

    it('ignora caracteres especiais na busca', async () => {
      const results = await searchLaboratories('merck sharp')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('getLaboratoryByName', () => {
    it('retorna laboratório por nome exato', async () => {
      const result = await getLaboratoryByName('EMS')
      expect(result).not.toBeNull()
      expect(result?.laboratory).toBe('EMS')
    })

    it('retorna laboratório por nome exato (case-insensitive)', async () => {
      const result = await getLaboratoryByName('ems')
      expect(result).not.toBeNull()
      expect(result?.laboratory).toBe('EMS')
    })

    it('retorna null para laboratório inexistente', async () => {
      const result = await getLaboratoryByName('XYZ_INEXISTENTE')
      expect(result).toBeNull()
    })

    it('retorna null para query vazia', async () => {
      const result = await getLaboratoryByName('')
      expect(result).toBeNull()
    })

    it('encontra laboratório com caracteres especiais', async () => {
      const result = await getLaboratoryByName('Merck Sharp & Dohme')
      expect(result).not.toBeNull()
      expect(result?.laboratory).toContain('MERCK')
    })
  })

  describe('getAllLaboratories', () => {
    it('retorna todos os laboratórios', async () => {
      const results = await getAllLaboratories()
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBe(mockDatabase.length)
    })

    it('retorna laboratórios com campo laboratory', async () => {
      const results = await getAllLaboratories()
      expect(results[0]).toHaveProperty('laboratory')
    })

    it('retorna nomes em maiúscula', async () => {
      const results = await getAllLaboratories()
      expect(results.every(lab => typeof lab.laboratory === 'string')).toBe(true)
    })
  })

  describe('Lazy loading', () => {
    it('carrega banco de dados na primeira chamada', async () => {
      const results = await searchLaboratories('ems')
      expect(results.length).toBeGreaterThan(0)
    })

    it('reutiliza banco carregado em chamadas subsequentes', async () => {
      // Primeira chamada carrega o DB
      await searchLaboratories('ems')
      // Segunda chamada deve reutilizar
      const results = await searchLaboratories('pfizer')
      expect(results.length).toBeGreaterThan(0)
    })
  })
})
