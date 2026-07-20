import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  resolveInstanceMedicine,
  resolveInstanceMedicineId,
  buildMedicineIndex,
} from '../instanceMedicine'

// Cenário canônico da spec 052: a escada trocou o medicamento do tratamento.
// A instância de junho congelou MOUNJARO_25; o protocolo HOJE aponta para MOUNJARO_15.
const MOUNJARO_25 = { id: 'med-25', name: 'Mounjaro 2,5 mg', dosage_unit: 'mg' }
const MOUNJARO_15 = { id: 'med-15', name: 'Mounjaro 15 mg', dosage_unit: 'mg' }

const protocolHoje = { medicine_id: MOUNJARO_15.id, medicine: MOUNJARO_15 }
const instanciaDeJunho = { medicine_id: MOUNJARO_25.id }

describe('resolveInstanceMedicineId', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('lê o congelado da ocorrência', () => {
    expect(resolveInstanceMedicineId(instanciaDeJunho)).toBe(MOUNJARO_25.id)
  })

  it('NÃO cai no protocolo (o gate PO-3 tornou o NULL irrepresentável no banco)', () => {
    // `null` aqui = a coluna não veio no select. Cair no protocolo devolveria MOUNJARO_15 e
    // reintroduziria o bug em silêncio; devolver null expõe o select incompleto.
    expect(resolveInstanceMedicineId({ medicine_id: null })).toBeNull()
  })

  it('degenerados: instância nula/vazia', () => {
    expect(resolveInstanceMedicineId(null)).toBeNull()
    expect(resolveInstanceMedicineId(undefined)).toBeNull()
    expect(resolveInstanceMedicineId({})).toBeNull()
  })
})

describe('buildMedicineIndex', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('indexa os medicamentos embutidos nos protocolos já carregados', () => {
    const index = buildMedicineIndex([protocolHoje, { medicine_id: MOUNJARO_25.id, medicine: MOUNJARO_25 }])
    expect(index.get(MOUNJARO_25.id)).toEqual(MOUNJARO_25)
    expect(index.get(MOUNJARO_15.id)).toEqual(MOUNJARO_15)
  })

  it('ignora protocolo sem embed e entrada não-array (degenerado)', () => {
    expect(buildMedicineIndex([{ medicine_id: 'x' }, null, undefined]).size).toBe(0)
    expect(buildMedicineIndex(null).size).toBe(0)
    expect(buildMedicineIndex(undefined).size).toBe(0)
  })

  it('usa medicine_id do protocolo quando o embed não traz id', () => {
    const index = buildMedicineIndex([{ medicine_id: 'med-sem-id', medicine: { name: 'Sem id' } }])
    expect(index.get('med-sem-id')).toEqual({ name: 'Sem id' })
  })
})

describe('resolveInstanceMedicine', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('usa o embed direto da instância quando presente (readers de SQL)', () => {
    const res = resolveInstanceMedicine(
      { medicine_id: MOUNJARO_25.id, medicine: MOUNJARO_25 },
      { protocol: protocolHoje }
    )
    expect(res).toEqual({ medicineId: MOUNJARO_25.id, medicine: MOUNJARO_25, source: 'instance' })
  })

  it('resolve o congelado pelo índice, NÃO pelo medicamento atual do protocolo', () => {
    const index = buildMedicineIndex([protocolHoje, { medicine_id: MOUNJARO_25.id, medicine: MOUNJARO_25 }])
    const res = resolveInstanceMedicine(instanciaDeJunho, { protocol: protocolHoje, medicinesById: index })
    expect(res.medicineId).toBe(MOUNJARO_25.id)
    expect(res.medicine).toEqual(MOUNJARO_25)
    expect(res.source).toBe('index')
  })

  it('NUNCA devolve o medicamento do protocolo quando a identidade divergiu (o bug da spec)', () => {
    // Sem índice: o congelado é conhecido, mas o registro não está em mãos. Devolver
    // MOUNJARO_15 aqui reescreveria o passado — é preferível não ter o nome.
    const res = resolveInstanceMedicine(instanciaDeJunho, { protocol: protocolHoje })
    expect(res.medicineId).toBe(MOUNJARO_25.id)
    expect(res.medicine).toBeNull()
    expect(res.source).toBe('none')
  })

  it('usa o protocolo quando a identidade COINCIDE (caminho comum, sem titulação)', () => {
    const res = resolveInstanceMedicine({ medicine_id: MOUNJARO_15.id }, { protocol: protocolHoje })
    expect(res).toEqual({ medicineId: MOUNJARO_15.id, medicine: MOUNJARO_15, source: 'protocol' })
  })

  it('instância sem a coluna no select NÃO herda a identidade do protocolo', () => {
    const res = resolveInstanceMedicine({ medicine_id: null }, { protocol: protocolHoje })
    expect(res).toEqual({ medicineId: null, medicine: null, source: 'none' })
  })

  it('degenerados: instância nula, sem opções, protocolo nulo', () => {
    expect(resolveInstanceMedicine(null)).toEqual({ medicineId: null, medicine: null, source: 'none' })
    expect(resolveInstanceMedicine(undefined, { protocol: null, medicinesById: null })).toEqual({
      medicineId: null,
      medicine: null,
      source: 'none',
    })
    expect(resolveInstanceMedicine({ medicine_id: 'sem-registro' }, {})).toEqual({
      medicineId: 'sem-registro',
      medicine: null,
      source: 'none',
    })
  })
})
