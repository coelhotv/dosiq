import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  validateEmergencyCard,
  validateEmergencyContact,
  validateEmergencyCardCreate,
  validateEmergencyCardUpdate,
  BLOOD_TYPES,
  BLOOD_TYPE_LABELS,
  emergencyContactSchema,
  emergencyCardSchema,
} from '../emergencyCardSchema'

describe('emergencyCardSchema', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('BLOOD_TYPES constant', () => {
    it('should contain all valid blood types', () => {
      expect(BLOOD_TYPES).toContain('A+')
      expect(BLOOD_TYPES).toContain('A-')
      expect(BLOOD_TYPES).toContain('B+')
      expect(BLOOD_TYPES).toContain('B-')
      expect(BLOOD_TYPES).toContain('AB+')
      expect(BLOOD_TYPES).toContain('AB-')
      expect(BLOOD_TYPES).toContain('O+')
      expect(BLOOD_TYPES).toContain('O-')
      expect(BLOOD_TYPES).toContain('desconhecido')
    })

    it('should have 9 blood types', () => {
      expect(BLOOD_TYPES).toHaveLength(9)
    })
  })

  describe('BLOOD_TYPE_LABELS constant', () => {
    it('should have labels for all blood types', () => {
      BLOOD_TYPES.forEach((type) => {
        expect(BLOOD_TYPE_LABELS[type]).toBeDefined()
      })
    })

    it('should label desconhecido as Desconhecido', () => {
      expect(BLOOD_TYPE_LABELS.desconhecido).toBe('Desconhecido')
    })
  })

  describe('validateEmergencyContact', () => {
    it('should pass validation with valid contact data', () => {
      const validContact = {
        name: 'Maria Silva',
        phone: '(11) 99999-8888',
        relationship: 'Esposa',
      }

      const result = validateEmergencyContact(validContact)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(validContact)
    })

    it('should pass validation with phone in format +55 XX XXXXX-XXXX', () => {
      const validContact = {
        name: 'João Santos',
        phone: '+55 11 99999-8888',
        relationship: 'Irmão',
      }

      const result = validateEmergencyContact(validContact)

      expect(result.success).toBe(true)
    })

    it('should pass validation with phone in format XX XXXXX-XXXX', () => {
      const validContact = {
        name: 'Ana Costa',
        phone: '11 99999-8888',
        relationship: 'Mãe',
      }

      const result = validateEmergencyContact(validContact)

      expect(result.success).toBe(true)
    })

    it('should pass validation with landline phone format', () => {
      const validContact = {
        name: 'Pedro Lima',
        phone: '(11) 3333-4444',
        relationship: 'Pai',
      }

      const result = validateEmergencyContact(validContact)

      expect(result.success).toBe(true)
    })

    it('should reject invalid phone number format', () => {
      const invalidContact = {
        name: 'Carlos',
        phone: '123',
        relationship: 'Amigo',
      }

      const result = validateEmergencyContact(invalidContact)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.some((e) => e.field === 'phone')).toBe(true)
    })

    it('should reject name shorter than 2 characters', () => {
      const invalidContact = {
        name: 'A',
        phone: '(11) 99999-8888',
        relationship: 'Amigo',
      }

      const result = validateEmergencyContact(invalidContact)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'name')).toBe(true)
    })

    it('should reject name longer than 200 characters', () => {
      const invalidContact = {
        name: 'A'.repeat(201),
        phone: '(11) 99999-8888',
        relationship: 'Amigo',
      }

      const result = validateEmergencyContact(invalidContact)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'name')).toBe(true)
    })

    it('should reject relationship shorter than 2 characters', () => {
      const invalidContact = {
        name: 'Carlos',
        phone: '(11) 99999-8888',
        relationship: 'A',
      }

      const result = validateEmergencyContact(invalidContact)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'relationship')).toBe(true)
    })

    it('should reject relationship longer than 100 characters', () => {
      const invalidContact = {
        name: 'Carlos',
        phone: '(11) 99999-8888',
        relationship: 'A'.repeat(101),
      }

      const result = validateEmergencyContact(invalidContact)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'relationship')).toBe(true)
    })
  })

  describe('validateEmergencyCard', () => {
    const validCard = {
      emergency_contacts: [
        {
          name: 'Maria Silva',
          phone: '(11) 99999-8888',
          relationship: 'Esposa',
        },
      ],
      allergies: ['Penicilina', 'Dipirona'],
      blood_type: 'A+',
      notes: 'Paciente com hipertensão',
    }

    it('should pass validation with valid data', () => {
      const result = validateEmergencyCard(validCard)

      expect(result.success).toBe(true)
      expect(result.data.emergency_contacts).toHaveLength(1)
      expect(result.data.allergies).toHaveLength(2)
      expect(result.data.blood_type).toBe('A+')
    })

    it('should add default last_updated timestamp', () => {
      const result = validateEmergencyCard(validCard)

      expect(result.success).toBe(true)
      expect(result.data.last_updated).toBeDefined()
    })

    it('should accept empty allergies array', () => {
      const cardWithEmptyAllergies = {
        ...validCard,
        allergies: [],
      }

      const result = validateEmergencyCard(cardWithEmptyAllergies)

      expect(result.success).toBe(true)
      expect(result.data.allergies).toEqual([])
    })

    it('should accept null notes', () => {
      const cardWithNullNotes = {
        ...validCard,
        notes: null,
      }

      const result = validateEmergencyCard(cardWithNullNotes)

      expect(result.success).toBe(true)
      expect(result.data.notes).toBeNull()
    })

    it('should accept undefined notes (converted to null)', () => {
      const { notes, ...cardWithoutNotes } = validCard

      const result = validateEmergencyCard(cardWithoutNotes)

      expect(result.success).toBe(true)
      expect(result.data.notes).toBeNull()
    })

    it('should reject missing emergency_contacts', () => {
      const { emergency_contacts, ...cardWithoutContacts } = validCard

      const result = validateEmergencyCard(cardWithoutContacts)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should reject empty emergency_contacts array', () => {
      const cardWithEmptyContacts = {
        ...validCard,
        emergency_contacts: [],
      }

      const result = validateEmergencyCard(cardWithEmptyContacts)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'emergency_contacts')).toBe(true)
    })

    it('should reject more than 5 emergency contacts', () => {
      const cardWithTooManyContacts = {
        ...validCard,
        emergency_contacts: Array(6)
          .fill(null)
          .map((_, i) => ({
            name: `Contact ${i}`,
            phone: `(11) 9999${i}-8888`,
            relationship: 'Friend',
          })),
      }

      const result = validateEmergencyCard(cardWithTooManyContacts)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'emergency_contacts')).toBe(true)
    })

    it('should accept exactly 5 emergency contacts', () => {
      const cardWith5Contacts = {
        ...validCard,
        emergency_contacts: Array(5)
          .fill(null)
          .map((_, i) => ({
            name: `Contact ${i}`,
            phone: `(11) 9999${i}-8888`,
            relationship: 'Friend',
          })),
      }

      const result = validateEmergencyCard(cardWith5Contacts)

      expect(result.success).toBe(true)
      expect(result.data.emergency_contacts).toHaveLength(5)
    })

    it('should reject invalid blood type', () => {
      const cardWithInvalidBloodType = {
        ...validCard,
        blood_type: 'X+',
      }

      const result = validateEmergencyCard(cardWithInvalidBloodType)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'blood_type')).toBe(true)
    })

    it('should accept all valid blood types', () => {
      BLOOD_TYPES.forEach((bloodType) => {
        const card = {
          ...validCard,
          blood_type: bloodType,
        }

        const result = validateEmergencyCard(card)

        expect(result.success).toBe(true)
        expect(result.data.blood_type).toBe(bloodType)
      })
    })

    it('should reject notes longer than 1000 characters', () => {
      const cardWithLongNotes = {
        ...validCard,
        notes: 'A'.repeat(1001),
      }

      const result = validateEmergencyCard(cardWithLongNotes)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'notes')).toBe(true)
    })

    it('should reject more than 20 allergies', () => {
      const cardWithTooManyAllergies = {
        ...validCard,
        allergies: Array(21)
          .fill(null)
          .map((_, i) => `Allergy ${i}`),
      }

      const result = validateEmergencyCard(cardWithTooManyAllergies)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.field === 'allergies')).toBe(true)
    })

    it('should reject empty allergy string', () => {
      const cardWithEmptyAllergy = {
        ...validCard,
        allergies: ['Penicilina', ''],
      }

      const result = validateEmergencyCard(cardWithEmptyAllergy)

      expect(result.success).toBe(false)
    })

    it('should reject allergy longer than 200 characters', () => {
      const cardWithLongAllergy = {
        ...validCard,
        allergies: ['A'.repeat(201)],
      }

      const result = validateEmergencyCard(cardWithLongAllergy)

      expect(result.success).toBe(false)
    })

    it('should reject invalid contact within emergency_contacts', () => {
      const cardWithInvalidContact = {
        ...validCard,
        emergency_contacts: [
          {
            name: 'A', // Too short
            phone: 'invalid', // Invalid format
            relationship: 'B', // Too short
          },
        ],
      }

      const result = validateEmergencyCard(cardWithInvalidContact)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('validateEmergencyCardCreate', () => {
    it('should behave the same as validateEmergencyCard', () => {
      const validCard = {
        emergency_contacts: [
          {
            name: 'Maria Silva',
            phone: '(11) 99999-8888',
            relationship: 'Esposa',
          },
        ],
        allergies: ['Penicilina'],
        blood_type: 'O+',
      }

      const result = validateEmergencyCardCreate(validCard)

      expect(result.success).toBe(true)
    })
  })

  describe('validateEmergencyCardUpdate', () => {
    it('should accept partial data', () => {
      const partialData = {
        blood_type: 'B-',
      }

      const result = validateEmergencyCardUpdate(partialData)

      expect(result.success).toBe(true)
      expect(result.data.blood_type).toBe('B-')
    })

    it('should accept empty object', () => {
      const result = validateEmergencyCardUpdate({})

      expect(result.success).toBe(true)
    })

    it('should still validate provided fields', () => {
      const invalidPartialData = {
        blood_type: 'Invalid',
      }

      const result = validateEmergencyCardUpdate(invalidPartialData)

      expect(result.success).toBe(false)
    })
  })

  describe('emergencyContactSchema', () => {
    it('should trim whitespace from name and relationship', () => {
      const contactWithWhitespace = {
        name: '  Maria Silva  ',
        phone: '(11) 99999-8888',
        relationship: '  Esposa  ',
      }

      const result = emergencyContactSchema.safeParse(contactWithWhitespace)

      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Maria Silva')
      expect(result.data.relationship).toBe('Esposa')
    })
  })

  describe('emergencyCardSchema', () => {
    it('should trim whitespace from allergy strings', () => {
      const cardWithWhitespaceAllergies = {
        emergency_contacts: [
          {
            name: 'Maria Silva',
            phone: '(11) 99999-8888',
            relationship: 'Esposa',
          },
        ],
        allergies: ['  Penicilina  ', '  Dipirona  '],
        blood_type: 'A+',
      }

      const result = emergencyCardSchema.safeParse(cardWithWhitespaceAllergies)

      expect(result.success).toBe(true)
      expect(result.data.allergies).toEqual(['Penicilina', 'Dipirona'])
    })
  })
})
