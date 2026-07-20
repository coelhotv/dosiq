// Bolas de progresso da escada no card da Evolução (form de tratamento).
//
// POR QUE ESTE TESTE EXISTE: o card era uma linha de 48px ao lado do seletor de horários — alto e
// visualmente pesado — e sumia num scan da tela; o PO descobriu no smoke que ninguém acharia a
// titulação. As bolas resolvem isso mostrando quantas etapas existem e ONDE o tratamento está.
//
// O risco que ele trava é o da etapa vigente: `findIndex(s => s.status === 'current')` pegaria a
// PRIMEIRA linha `current`, e o banco não impede um resíduo numa posição anterior — a bola cheia
// apareceria na etapa errada, em silêncio (achado do RC6 na 029 F4, mesma razão de a
// `TitrationTimeline` usar `resolveCurrentStep`). Um teste que só contasse bolas passaria com o
// bug; este verifica QUAL bola está marcada.

import React from 'react'
import { render } from '@testing-library/react-native'
import ProtocolFormBody from '../ProtocolFormBody'

jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  return actual
})

/** Form mínimo — o componente só lê `values` para os campos que não estão sob teste. */
function makeForm(values = {}) {
  return {
    values: { name: '', dosage_per_intake: 1, time_schedule: ['08:00'], frequency: 'diário', ...values },
    errors: {},
    touched: {},
    setValue: jest.fn(),
    setFieldValue: jest.fn(),
    handleChange: jest.fn(),
    handleBlur: jest.fn(),
  }
}

const baseProps = {
  medicine: { id: 'm1', name: 'Mounjaro', dosage_unit: 'mg', presentation: 'injetavel' },
  onOpenMedicineSheet: jest.fn(),
  onOpenTitration: jest.fn(),
  isEditMode: true,
  plans: [],
  // Mesma forma inicial de `useProtocolFormState` — `null` aqui quebraria no PlanSelectField,
  // que lê `value.inline`, e o teste falharia por fixture, não por comportamento.
  planField: { mode: 'select', planId: null, inline: null },
  onPlanFieldChange: jest.fn(),
  onDoseChange: jest.fn(),
  onStartDateChange: jest.fn(),
  onEndDateChange: jest.fn(),
}

function step(id, position, status, extra = {}) {
  return {
    id,
    position,
    status,
    dose: 1,
    intake_unit: null,
    duration_days: 28,
    started_at: status === 'current' || status === 'completed' ? '2026-07-01T08:00:00' : null,
    ended_at: status === 'completed' ? '2026-07-28T08:00:00' : null,
    medicine: { id: 'm1', name: 'Mounjaro' },
    ...extra,
  }
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('ProtocolFormBody — bolas da Evolução', () => {
  it('empty state: sem etapas, mostra as duas interrogações e nenhuma bola', () => {
    const { getByLabelText, queryByLabelText } = render(
      <ProtocolFormBody {...baseProps} form={makeForm()} titrationStepCount={0} titrationSteps={[]} />
    )
    expect(getByLabelText('Nenhuma etapa cadastrada')).toBeTruthy()
    expect(queryByLabelText(/Etapa \d+ de \d+/)).toBeNull()
  })

  it('anuncia a posição na escada (etapa vigente de N)', () => {
    const steps = [
      step('s1', 0, 'completed'),
      step('s2', 1, 'current'),
      step('s3', 2, 'upcoming'),
    ]
    const { getByLabelText } = render(
      <ProtocolFormBody {...baseProps} form={makeForm()} titrationStepCount={3} titrationSteps={steps} />
    )
    expect(getByLabelText('Etapa 2 de 3')).toBeTruthy()
  })

  it('resíduo `current` numa posição anterior NÃO desloca a vigente (AP do RC6)', () => {
    // s1 ficou com status='current' sem ser a vigente real (resíduo que o banco não impede).
    // `findIndex` diria "Etapa 1 de 3"; `resolveCurrentStep` mantém a âncora correta.
    const steps = [
      step('s1', 0, 'current', { started_at: '2026-06-01T08:00:00', ended_at: '2026-06-28T08:00:00' }),
      step('s2', 1, 'current'),
      step('s3', 2, 'upcoming'),
    ]
    const { getByLabelText } = render(
      <ProtocolFormBody {...baseProps} form={makeForm()} titrationStepCount={3} titrationSteps={steps} />
    )
    expect(getByLabelText('Etapa 2 de 3')).toBeTruthy()
  })

  it('escada longa não estoura a linha — mostra o teto e o excedente', () => {
    const steps = Array.from({ length: 11 }, (_, i) => step(`s${i}`, i, i === 0 ? 'current' : 'upcoming'))
    const { getByLabelText, getByText } = render(
      <ProtocolFormBody {...baseProps} form={makeForm()} titrationStepCount={11} titrationSteps={steps} />
    )
    expect(getByLabelText('Etapa 1 de 11')).toBeTruthy()
    expect(getByText('+3')).toBeTruthy()
  })

  it('🔴 vigente ALÉM do teto continua marcada — a janela acompanha, não corta as 8 primeiras', () => {
    // O bug (RC6 #763): `slice(0, 8)` pegava sempre as 8 PRIMEIRAS e `index === currentIndex`
    // comparava índice da JANELA com índice ABSOLUTO. Com a vigente na 10ª de 11, nenhuma bola era
    // marcada — e o accessibilityLabel seguia dizendo "Etapa 10 de 11", então um teste de label
    // passava com o bug intacto. Por isso a asserção é sobre a BOLA, via testID.
    const steps = Array.from({ length: 11 }, (_, i) =>
      step(`s${i}`, i, i === 9 ? 'current' : i < 9 ? 'completed' : 'upcoming')
    )
    const { getByLabelText, getByTestId } = render(
      <ProtocolFormBody {...baseProps} form={makeForm()} titrationStepCount={11} titrationSteps={steps} />
    )
    expect(getByLabelText('Etapa 10 de 11')).toBeTruthy()
    expect(getByTestId('evo-dot-current-s9')).toBeTruthy()
  })

  it('vigente dentro do teto é marcada na bola certa (não na primeira `current`)', () => {
    // Resíduo em s0: a bola cheia tem de ser a de s1, não a de s0.
    const steps = [step('s0', 0, 'current'), step('s1', 1, 'current'), step('s2', 2, 'upcoming')]
    const { getByTestId, queryByTestId } = render(
      <ProtocolFormBody {...baseProps} form={makeForm()} titrationStepCount={3} titrationSteps={steps} />
    )
    expect(getByTestId('evo-dot-current-s1')).toBeTruthy()
    expect(queryByTestId('evo-dot-current-s0')).toBeNull()
  })

  it('ordena por position, não pela ordem de chegada do array', () => {
    const steps = [step('s3', 2, 'upcoming'), step('s1', 0, 'completed'), step('s2', 1, 'current')]
    const { getByLabelText } = render(
      <ProtocolFormBody {...baseProps} form={makeForm()} titrationStepCount={3} titrationSteps={steps} />
    )
    expect(getByLabelText('Etapa 2 de 3')).toBeTruthy()
  })
})
