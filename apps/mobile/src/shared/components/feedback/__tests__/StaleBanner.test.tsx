// Spec 091 — PO-7 (AC-3.1): banner offline sem jargão, dizendo o que falta e quando aparece.
import React from 'react'
import { render } from '@testing-library/react-native'
import StaleBanner from '../StaleBanner'

jest.mock('lucide-react-native', () => ({ AlertCircle: () => null }))

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

const JARGON = /logs?\b|sincroniza|cache|snapshot/i

it('texto único, curto e sem jargão técnico', () => {
  const { getByText } = render(<StaleBanner />)
  const text = getByText('Sem internet. Mostrando a última cópia no aparelho; atualiza quando a conexão voltar.')
  expect(String(text.props.children)).not.toMatch(JARGON)
})
