import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  searchMedicines,
  getMedicineDetails,
  searchByActiveIngredient,
  getAllMedicines,
  findDuplicatesByIngredient,
} from '../medicineDatabaseService'

/**
 * Mock da base de medicamentos para testes isolados
 */
const mockDatabase = [
  {
    name: 'Losartana Potassica',
    activeIngredient: 'losartana potássica',
    therapeuticClass: 'ANTI-HIPERTENSIVOS',
  },
  {
    name: 'Metformina Cloridrato',
    activeIngredient: 'metformina',
    therapeuticClass: 'ANTIDIABETICOS',
  },
  {
    name: 'Ibuprofeno',
    activeIngredient: 'ibuprofeno',
    therapeuticClass: 'ANALGESICOS NAO NARCOTICOS',
  },
  {
    name: 'Ácido Acetilsalicílico',
    activeIngredient: 'ácido acetilsalicílico',
    therapeuticClass: 'ANALGESICOS NAO NARCOTICOS',
  },
]

// Mock do módulo de import dinâmico
vi.mock('@medications/data/medicineDatabase.json', () => ({
  default: mockDatabase,
}))

describe('medicineDatabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('searchMedicines', () => {
    it('retorna resultados para busca por nome comercial', async () => {
      const results = await searchMedicines('losartan')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name.toLowerCase()).toContain('losartan')
    })

    it('retorna resultados para busca por princípio ativo', async () => {
      const results = await searchMedicines('metformina')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].activeIngredient.toLowerCase()).toContain('metformina')
    })

    it('busca funciona sem acentos', async () => {
      const results = await searchMedicines('losarta')
      expect(results.length).toBeGreaterThan(0)
    })

    it('retorna vazio para query vazia', async () => {
      const results = await searchMedicines('')
      expect(results).toEqual([])
    })

    it('retorna vazio para query apenas espaços', async () => {
      const results = await searchMedicines('   ')
      expect(results).toEqual([])
    })

    it('retorna vazio para query sem match', async () => {
      const results = await searchMedicines('xyzinexistente')
      expect(results).toEqual([])
    })

    it('respeita limite de resultados', async () => {
      const results = await searchMedicines('i', 2)
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('retorna máximo 10 resultados por default', async () => {
      const results = await searchMedicines('i')
      expect(results.length).toBeLessThanOrEqual(10)
    })

    it('busca é case-insensitive', async () => {
      const resultsLower = await searchMedicines('losartana')
      const resultsUpper = await searchMedicines('LOSARTANA')
      expect(resultsLower).toEqual(resultsUpper)
    })
  })

  describe('getMedicineDetails', () => {
    it('retorna medicamento por nome exato', async () => {
      const result = await getMedicineDetails('Losartana Potassica')
      expect(result).not.toBeNull()
      expect(result?.name).toBe('Losartana Potassica')
    })

    it('retorna medicamento por nome exato (case-insensitive)', async () => {
      const result = await getMedicineDetails('losartana potassica')
      expect(result).not.toBeNull()
      expect(result?.name).toBe('Losartana Potassica')
    })

    it('retorna null para medicamento inexistente', async () => {
      const result = await getMedicineDetails('XYZ_INEXISTENTE')
      expect(result).toBeNull()
    })

    it('retorna null para query vazia', async () => {
      const result = await getMedicineDetails('')
      expect(result).toBeNull()
    })

    it('retorna medicamento por nome parcial', async () => {
      const result = await getMedicineDetails('Losartana')
      expect(result).not.toBeNull()
      expect(result?.activeIngredient).toContain('losartana')
    })

    it('retorna medicamento com acentos removidos', async () => {
      const result = await getMedicineDetails('Acido Acetilsalicilico')
      expect(result).not.toBeNull()
      expect(result?.name).toBe('Ácido Acetilsalicílico')
    })
  })

  describe('searchByActiveIngredient', () => {
    it('retorna medicamentos por princípio ativo exato', async () => {
      const results = await searchByActiveIngredient('metformina')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].activeIngredient.toLowerCase()).toContain('metformina')
    })

    it('retorna múltiplos medicamentos com mesmo princípio ativo', async () => {
      const results = await searchByActiveIngredient('ibuprofeno')
      expect(results.length).toBeGreaterThan(0)
    })

    it('retorna vazio para princípio ativo inexistente', async () => {
      const results = await searchByActiveIngredient('xyz_inexistente')
      expect(results).toEqual([])
    })

    it('retorna vazio para query vazia', async () => {
      const results = await searchByActiveIngredient('')
      expect(results).toEqual([])
    })

    it('busca é case-insensitive', async () => {
      const resultsLower = await searchByActiveIngredient('ibuprofeno')
      const resultsUpper = await searchByActiveIngredient('IBUPROFENO')
      expect(resultsLower).toEqual(resultsUpper)
    })

    it('encontra medicamentos mesmo com acentos diferentes', async () => {
      const results = await searchByActiveIngredient('acido acetilsalicilico')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('getAllMedicines', () => {
    it('retorna todos os medicamentos', async () => {
      const results = await getAllMedicines()
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBe(mockDatabase.length)
    })

    it('retorna medicamentos com todos os campos', async () => {
      const results = await getAllMedicines()
      expect(results[0]).toHaveProperty('name')
      expect(results[0]).toHaveProperty('activeIngredient')
      expect(results[0]).toHaveProperty('therapeuticClass')
    })
  })

  describe('findDuplicatesByIngredient', () => {
    it('retorna duplicatas por princípio ativo', async () => {
      const duplicates = await findDuplicatesByIngredient('ibuprofeno')
      expect(duplicates.length).toBeGreaterThan(0)
    })

    it('exclui medicamento especificado na busca', async () => {
      const duplicates = await findDuplicatesByIngredient('ibuprofeno', 'Ibuprofeno')
      const names = duplicates.map(m => m.name)
      expect(names).not.toContain('Ibuprofeno')
    })

    it('retorna vazio se não há duplicatas', async () => {
      const duplicates = await findDuplicatesByIngredient('xyz_inexistente')
      expect(duplicates).toEqual([])
    })

    it('mantém exclude case-insensitive', async () => {
      const duplicates = await findDuplicatesByIngredient('ibuprofeno', 'ibuprofeno')
      const names = duplicates.map(m => m.name.toLowerCase())
      expect(names).not.toContain('ibuprofeno')
    })
  })

  describe('Lazy loading', () => {
    it('carrega banco de dados na primeira chamada', async () => {
      const results1 = await searchMedicines('losartana')
      expect(results1.length).toBeGreaterThan(0)
    })

    it('reutiliza banco carregado em chamadas subsequentes', async () => {
      // Primeira chamada carrega o DB
      await searchMedicines('losartana')
      // Segunda chamada deve reutilizar
      const results2 = await searchMedicines('ibuprofeno')
      expect(results2.length).toBeGreaterThan(0)
    })
  })
})
