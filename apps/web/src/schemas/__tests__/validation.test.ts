import { describe, it, expect } from 'vitest'
import {
  validateMedicineCreate,
  validateProtocolCreate,
  validateStockCreate,
  validateLogCreate,
  mapMedicineErrorsToForm,
  getMedicineErrorMessage,
  validateEntity,
} from '@/schemas/index'

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
      // Cap revisado 100→1000 (022 Fase B): rejeita só >1000.
      const log = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity_taken: 1500,
        taken_at: '2024-01-15T10:00:00Z',
      }
      const result = validateLogCreate(log)
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('1000')
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

    // 029 F6: `deve validar titulação corretamente` foi REMOVIDO. Ele validava os 4 campos N1
    // no schema do tratamento; as colunas foram dropadas e os campos saíram do Zod. Mantê-lo
    // seria pior que inútil: `safeParse` descarta chave desconhecida em silêncio, então ele
    // continuaria VERDE validando um objeto do qual a titulação inteira foi jogada fora —
    // exatamente o tipo de teste que dá confiança sem cobrir nada (AP-214).
    // A validação da escada N2 vive nos schemas de `titrations`/`titration_steps`.
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
})
