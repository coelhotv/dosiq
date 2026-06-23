import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Base mock controlável (offline ⇒ []). O service consome `createAnvisaDatabase` de
 * @dosiq/core; mockamos o núcleo para `load()` determinístico (sem fetch/JSON).
 * Fetch/cache/offline reais cobertos no teste do core (anvisaDatabase.test.js).
 */
let mockData = []

vi.mock('@dosiq/core', async (importActual) => {
  const actual = await importActual()
  return {
    ...actual,
    createAnvisaDatabase: () => ({ load: () => Promise.resolve(mockData) }),
  }
})

import {
  searchLaboratories,
  getLaboratoryByName,
  getAllLaboratories,
} from '@/features/medications/services/laboratoryDatabaseService'

const DATABASE = [
  { laboratory: 'EMS' },
  { laboratory: 'LEGRAND PHARMA' },
  { laboratory: 'PFIZER BRASIL' },
  { laboratory: 'BIONOVIS' },
  { laboratory: 'MERCK SHARP & DOHME' },
]

describe('laboratoryDatabaseService', () => {
  beforeEach(() => {
    mockData = DATABASE
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
      expect(results.some((r) => r.laboratory.toUpperCase().includes('PHARMA'))).toBe(true)
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
      const results = await searchLaboratories('bra', 1)
      expect(results.length).toBeLessThanOrEqual(1)
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

  describe('degradação graciosa (offline sem cache)', () => {
    it('load vazio ⇒ searchLaboratories retorna [] sem lançar', async () => {
      mockData = []
      await expect(searchLaboratories('ems')).resolves.toEqual([])
    })

    it('load vazio ⇒ getAllLaboratories retorna [] sem lançar', async () => {
      mockData = []
      await expect(getAllLaboratories()).resolves.toEqual([])
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
      expect(results.length).toBe(DATABASE.length)
    })

    it('retorna laboratórios com campo laboratory', async () => {
      const results = await getAllLaboratories()
      expect(results[0]).toHaveProperty('laboratory')
    })
  })
})
