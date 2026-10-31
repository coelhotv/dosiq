// TreatmentMeasureSlot.test.tsx — spec 100 B · PO-2 (card): três estados × classe divergente; PO-10 (chave ausente).
import { describe, it, expect, afterEach } from '@jest/globals'
import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('../TreatmentWeightCard', () => () => {
  const { Text } = require('react-native')
  return <Text>card:peso</Text>
})
jest.mock('../TreatmentMeasureCard', () => ({ measure }) => {
  const { Text } = require('react-native')
  return <Text>{`card:${measure}`}</Text>
})
jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }))
jest.mock('@measures/services/measuresRepo', () => ({ measuresRepo: {} }))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: {} } }))

import TreatmentMeasureSlot from '../TreatmentMeasureSlot'

const shown = (protocol) => render(<TreatmentMeasureSlot protocol={protocol} />).toJSON()?.children?.[0] ?? null

afterEach(() => {
  jest.clearAllMocks()
})

describe('TreatmentMeasureSlot', () => {
  it('NULL (legado) segue a 069: semanal ⇒ peso; diário ⇒ nada', () => {
    expect(shown({ frequency: 'semanal', tracked_measure: null, medicine: { therapeutic_class_code: 'A10C5' } })).toBe('card:peso')
    expect(shown({ frequency: 'diário', tracked_measure: null, medicine: { therapeutic_class_code: 'A10C5' } })).toBeNull()
  })
  it("'nenhum' com classe mapeada e semanal ⇒ sem card (AC-5)", () => {
    expect(shown({ frequency: 'semanal', tracked_measure: 'nenhum', medicine: { therapeutic_class_code: 'A10S' } })).toBeNull()
  })
  it('medida escolhida vale contra a classe', () => {
    expect(shown({ frequency: 'diário', tracked_measure: 'glicemia', medicine: { therapeutic_class_code: 'C9A' } })).toBe('card:glicemia')
    expect(shown({ frequency: 'diário', tracked_measure: 'pressao_arterial' })).toBe('card:pressao_arterial')
  })
  it('chave ausente ⇒ sem card (falha fechada)', () => {
    expect(shown({ frequency: 'semanal' })).toBeNull()
  })
})
