import { describe, it, expect } from 'vitest'
import { medicineSchema } from '../medicineSchema.js'
import {
  validateMedicineCreate,
  validateProtocolCreate,
  validateStockCreate,
  validateLogCreate,
  mapMedicineErrorsToForm,
  getMedicineErrorMessage,
  validateEntity,
} from '../index'

describe('Schemas de Validação Zod', () => {
  describe('Medicine Schema', () => {
    it('deve validar medicamento válido', () => {
      const medicine = {
        name: 'Paracetamol',
        dosage_per_pill: 500,
        dosage_unit: 'mg',
      }
      const result = validateMedicineCreate(medicine)
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Paracetamol')
    })

    it('deve rejeitar nome muito curto', () => {
      const medicine = {
        name: 'A',
        dosage_per_pill: 500,
        dosage_unit: 'mg',
      }
      const result = validateMedicineCreate(medicine)
      expect(result.success).toBe(false)
      expect(result.errors[0].field).toBe('name')
      expect(result.errors[0].message).toContain('pelo menos 2 caracteres')
    })

    it('deve rejeitar dosagem negativa', () => {
      const medicine = {
        name: 'Paracetamol',
        dosage_per_pill: -10,
        dosage_unit: 'mg',
      }
      const result = validateMedicineCreate(medicine)
      expect(result.success).toBe(false)
      expect(result.errors[0].field).toBe('dosage_per_pill')
    })

    it('deve rejeitar unidade inválida', () => {
      const medicine = {
        name: 'Paracetamol',
        dosage_per_pill: 500,
        dosage_unit: 'tablets',
      }
      const result = validateMedicineCreate(medicine)
      expect(result.success).toBe(false)
      expect(result.errors[0].field).toBe('dosage_unit')
    })

    it('deve aplicar valor padrão para tipo', () => {
      const medicine = {
        name: 'Paracetamol',
        dosage_per_pill: 500,
        dosage_unit: 'mg',
      }
      const result = validateMedicineCreate(medicine)
      expect(result.success).toBe(true)
      expect(result.data.type).toBe('medicamento')
    })

    it('deve mapear erros para formato de formulário', () => {
      const errors = [
        { path: ['name'], message: 'Nome muito curto' },
        { path: ['dosage_per_pill'], message: 'Dosagem inválida' },
      ]
      const formErrors = mapMedicineErrorsToForm(errors)
      expect(formErrors.name).toBe('Nome muito curto')
      expect(formErrors.dosage_per_pill).toBe('Dosagem inválida')
    })

    it('deve retornar mensagem de erro formatada', () => {
      const errors = [{ message: 'Erro único' }]
      const message = getMedicineErrorMessage(errors)
      expect(message).toBe('Erro único')

      const multipleErrors = [{ message: 'Erro 1' }, { message: 'Erro 2' }]
      const multiMessage = getMedicineErrorMessage(multipleErrors)
      expect(multiMessage).toContain('2 erros')
    })
  })

  describe('Stock Schema', () => {
    it('deve validar estoque válido', () => {
      const stock = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 30,
        purchase_date: '2024-01-15',
      }
      const result = validateStockCreate(stock)
      expect(result.success).toBe(true)
    })

    it('deve rejeitar UUID inválido', () => {
      const stock = {
        medicine_id: 'invalid-id',
        quantity: 30,
        purchase_date: '2024-01-15',
      }
      const result = validateStockCreate(stock)
      expect(result.success).toBe(false)
      expect(result.errors[0].field).toBe('medicine_id')
      expect(result.errors[0].message).toContain('UUID')
    })

    it('deve rejeitar quantidade negativa', () => {
      const stock = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: -5,
        purchase_date: '2024-01-15',
      }
      const result = validateStockCreate(stock)
      expect(result.success).toBe(false)
      expect(result.errors[0].field).toBe('quantity')
    })

    it('deve rejeitar data de compra no futuro', () => {
      const stock = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 30,
        purchase_date: '2030-01-15',
      }
      const result = validateStockCreate(stock)
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('futuro')
    })

    it('deve rejeitar data de validade anterior à compra', () => {
      const stock = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 30,
        purchase_date: '2024-01-15',
        expiration_date: '2023-12-01',
      }
      const result = validateStockCreate(stock)
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('posterior')
    })

    it('deve aceitar data de validade ausente', () => {
      const stock = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 30,
        purchase_date: '2024-01-15',
      }
      const result = validateStockCreate(stock)
      expect(result.success).toBe(true)
    })
  })

  describe('Log Schema', () => {
    it('deve validar log válido', () => {
      const log = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity_taken: 1,
        taken_at: '2024-01-15T10:00:00Z',
      }
      const result = validateLogCreate(log)
      expect(result.success).toBe(true)
    })

    it('deve rejeitar data no futuro', () => {
      const log = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity_taken: 1,
        taken_at: '2030-01-15T10:00:00Z',
      }
      const result = validateLogCreate(log)
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('futuro')
    })

    it('deve rejeitar quantidade muito alta', () => {
      // Cap revisado 100→1000 (022 Fase B): 150 agora é válido (gotas); rejeita só >1000.
      const log = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity_taken: 1500,
        taken_at: '2024-01-15T10:00:00Z',
      }
      const result = validateLogCreate(log)
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('1000')
    })

    it('deve aceitar dose líquida em gotas acima do antigo cap-100', () => {
      const log = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity_taken: 150,
        taken_at: '2024-01-15T10:00:00Z',
      }
      expect(validateLogCreate(log).success).toBe(true)
    })
  })

  describe('Protocol Schema', () => {
    it('deve validar protocolo válido', () => {
      const protocol = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Protocolo Teste',
        frequency: 'diário',
        time_schedule: ['08:00', '20:00'],
        dosage_per_intake: 1,
        start_date: '2024-01-15',
      }
      const result = validateProtocolCreate(protocol)
      expect(result.success).toBe(true)
    })

    it('deve rejeitar horário em formato inválido', () => {
      const protocol = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Protocolo Teste',
        frequency: 'diário',
        time_schedule: ['8:00 AM'], // formato inválido
        dosage_per_intake: 1,
        start_date: '2024-01-15',
      }
      const result = validateProtocolCreate(protocol)
      expect(result.success).toBe(false)
      expect(result.errors[0].field).toContain('time_schedule')
    })

    it('deve rejeitar schedule vazio', () => {
      const protocol = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Protocolo Teste',
        frequency: 'diário',
        time_schedule: [],
        dosage_per_intake: 1,
        start_date: '2024-01-15',
      }
      const result = validateProtocolCreate(protocol)
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('pelo menos um horário')
    })

    describe('Validação end_date >= start_date', () => {
      const baseProtocol = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Protocolo Teste',
        frequency: 'diário',
        time_schedule: ['08:00'],
        dosage_per_intake: 1,
        start_date: '2024-01-15',
      }

      it('deve aceitar end_date igual a start_date', () => {
        const result = validateProtocolCreate({ ...baseProtocol, end_date: '2024-01-15' })
        expect(result.success).toBe(true)
      })

      it('deve aceitar end_date maior que start_date', () => {
        const result = validateProtocolCreate({ ...baseProtocol, end_date: '2024-02-15' })
        expect(result.success).toBe(true)
      })

      it('deve rejeitar end_date menor que start_date', () => {
        const result = validateProtocolCreate({ ...baseProtocol, end_date: '2024-01-01' })
        expect(result.success).toBe(false)
        expect(result.errors.some((e) => e.field === 'end_date')).toBe(true)
        expect(result.errors.some((e) => e.message.includes('maior ou igual'))).toBe(true)
      })

      it('deve aceitar end_date ausente (protocolo sem data de término)', () => {
        const result = validateProtocolCreate({ ...baseProtocol })
        expect(result.success).toBe(true)
      })
    })

    it('deve validar titulação corretamente', () => {
      const protocol = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Protocolo com Titulação',
        frequency: 'diário',
        time_schedule: ['08:00'],
        dosage_per_intake: 1,
        titration_status: 'titulando',
        titration_schedule: [
          { dosage: 25, duration_days: 7 },
          { dosage: 50, duration_days: 7 },
        ],
        current_stage_index: 0,
        stage_started_at: '2024-01-15T00:00:00Z',
        start_date: '2024-01-15',
      }
      const result = validateProtocolCreate(protocol)
      expect(result.success).toBe(true)
    })
  })

  describe('Validation Helper', () => {
    it('deve validar entidade genérica', () => {
      const data = { name: 'Teste', dosage_per_pill: 100, dosage_unit: 'mg' }
      const result = validateEntity('medicine', data, 'create')
      expect(result.success).toBe(true)
    })

    it('deve retornar erro para tipo inválido', () => {
      const result = validateEntity('invalid', {}, 'create')
      expect(result.success).toBe(false)
      expect(result.error.message).toContain('desconhecido')
    })

    it('deve retornar erro para operação inválida', () => {
      const result = validateEntity('medicine', {}, 'invalid_op')
      expect(result.success).toBe(false)
      expect(result.error.message).toContain('não suportada')
    })
  })

  describe('Líquidos (022 Fase B)', () => {
    it('medicamento mg/ml SEM units_per_ml → aceita (densidade é do tratamento — 022 Fase C)', () => {
      const r = validateMedicineCreate({ name: 'Dipirona Gotas', dosage_unit: 'mg/ml' })
      expect(r.success).toBe(true)
    })
    it('medicamento mg/ml COM units_per_ml → aceita (densidade opcional)', () => {
      const r = validateMedicineCreate({ name: 'Dipirona Gotas', dosage_unit: 'mg/ml', units_per_ml: 20 })
      expect(r.success).toBe(true)
    })
    it('sólido mg sem units_per_ml → aceita (não exige densidade)', () => {
      const r = validateMedicineCreate({ name: 'Paracetamol', dosage_unit: 'mg', dosage_per_pill: 500 })
      expect(r.success).toBe(true)
    })
    it('protocolo líquido (_medicineIsLiquid) sem intake_unit → rejeita', () => {
      const r = validateProtocolCreate({
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Xarope',
        frequency: 'diário',
        time_schedule: ['08:00'],
        dosage_per_intake: 2.5,
        start_date: '2026-01-01',
        _medicineIsLiquid: true,
      })
      expect(r.success).toBe(false)
      expect(r.errors.some((e) => e.field === 'intake_unit')).toBe(true)
    })
    it('protocolo líquido COM intake_unit gotas + dose decimal → aceita', () => {
      const r = validateProtocolCreate({
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Xarope',
        frequency: 'diário',
        time_schedule: ['08:00'],
        dosage_per_intake: 2.5,
        start_date: '2026-01-01',
        _medicineIsLiquid: true,
        intake_unit: 'gotas',
      })
      expect(r.success).toBe(true)
    })
  })
})

// 012 Fase A (ADR-059): shelf_life_days — failure modes (R-270: ''→null, nunca 0)
describe('medicineSchema shelf_life_days', () => {
  const base = { name: 'Insulina NPH', dosage_unit: 'ui/ml', units_per_ml: 100, presentation: 'injetavel' }

  it('aceita inteiro positivo (28)', () => {
    const r = medicineSchema.safeParse({ ...base, shelf_life_days: 28 })
    expect(r.success).toBe(true)
    expect(r.data.shelf_life_days).toBe(28)
  })

  it("campo limpo ('') vira null — não 0 (R-270)", () => {
    const r = medicineSchema.safeParse({ ...base, shelf_life_days: '' })
    expect(r.success).toBe(true)
    expect(r.data.shelf_life_days).toBe(null)
  })

  it('ausente/null aceito (eixo inativo)', () => {
    expect(medicineSchema.safeParse(base).success).toBe(true)
    expect(medicineSchema.safeParse({ ...base, shelf_life_days: null }).success).toBe(true)
  })

  it('rejeita 0, negativo e decimal (CHECK > 0 espelhado — R-082)', () => {
    expect(medicineSchema.safeParse({ ...base, shelf_life_days: 0 }).success).toBe(false)
    expect(medicineSchema.safeParse({ ...base, shelf_life_days: -3 }).success).toBe(false)
    expect(medicineSchema.safeParse({ ...base, shelf_life_days: 28.5 }).success).toBe(false)
  })

  it('coerção de string numérica do form ("28" → 28)', () => {
    const r = medicineSchema.safeParse({ ...base, shelf_life_days: '28' })
    expect(r.success).toBe(true)
    expect(r.data.shelf_life_days).toBe(28)
  })
})
