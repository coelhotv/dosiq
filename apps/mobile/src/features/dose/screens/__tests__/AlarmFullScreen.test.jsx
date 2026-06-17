// AlarmFullScreen.test.jsx — auto-dismiss (US2) + transparência clínica (US3) — Spec 036
// Framework: Jest (jest-expo) — rodar em apps/mobile/
//
// jest.mock é hoisted pelo Babel — factories não referenciam vars externas; usar require()
// após o mock pra acessar os spies (padrão AP-116).

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { formatMedicineConcentration, formatDoseItem } from '@dosiq/core'

// --- Mocks de módulo ---

const mockIn = jest.fn()
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({ in: (...a) => mockIn(...a) })),
    })),
  },
}))

const mockCancelAlarm = jest.fn()
jest.mock('@platform/alarms/alarmService', () => ({
  cancelAlarm: (...a) => mockCancelAlarm(...a),
  scheduleSnooze: jest.fn(),
}))

jest.mock('@platform/alarms/quickDoseRegistration', () => ({
  registerTaken: jest.fn(),
  registerSkip: jest.fn(),
}))

jest.mock('lucide-react-native', () => ({
  Check: 'Check',
  X: 'X',
  Pill: 'Pill',
  Clock: 'Clock',
  // Glifos usados por MedicineIcon (ícone contextual da forma/tipo)
  Tablets: 'Tablets',
  Droplets: 'Droplets',
  Syringe: 'Syringe',
  SoapDispenserDroplet: 'SoapDispenserDroplet',
  SprayCan: 'SprayCan',
  PillBottle: 'PillBottle',
}))

import AlarmFullScreen from '../AlarmFullScreen'

function makeNav() {
  return { canGoBack: jest.fn(() => true), goBack: jest.fn(), navigate: jest.fn() }
}

// Params single tal como chegam da notificação (valores string — plumbing 036).
const SINGLE = {
  doseInstanceId: 'inst-1',
  medicineName: 'Selozok',
  quantityTaken: '2',
  dosagePerPill: '25',
  dosageUnit: 'mg',
  concentrationVolumeMl: '',
  intakeUnit: '',
  unitsPerMl: '',
  scheduledTime: '12:15',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockIn.mockResolvedValue({ data: [{ id: 'inst-1', status: 'pending' }], error: null })
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('AlarmFullScreen — auto-dismiss (US2/FR-004)', () => {
  it('status ≠ pending → cancela alarme e fecha sozinho', async () => {
    mockIn.mockResolvedValue({ data: [{ id: 'inst-1', status: 'taken' }], error: null })
    const nav = makeNav()
    render(<AlarmFullScreen navigation={nav} route={{ params: SINGLE }} />)
    await waitFor(() => expect(mockCancelAlarm).toHaveBeenCalledWith('inst-1'))
    expect(nav.goBack).toHaveBeenCalled()
  })

  it('status pending → não fecha nem cancela', async () => {
    const nav = makeNav()
    const { getByText } = render(<AlarmFullScreen navigation={nav} route={{ params: SINGLE }} />)
    await waitFor(() => expect(mockIn).toHaveBeenCalled())
    expect(mockCancelAlarm).not.toHaveBeenCalled()
    expect(nav.goBack).not.toHaveBeenCalled()
    expect(getByText('Selozok', { exact: false })).toBeTruthy()
  })

  it('falha de leitura → mantém a tela aberta (não esconde alarme legítimo)', async () => {
    mockIn.mockResolvedValue({ data: null, error: { message: 'net down' } })
    const nav = makeNav()
    render(<AlarmFullScreen navigation={nav} route={{ params: SINGLE }} />)
    await waitFor(() => expect(mockIn).toHaveBeenCalled())
    expect(nav.goBack).not.toHaveBeenCalled()
  })

  it('grupo parcial (1 pending) → mantém a tela', async () => {
    mockIn.mockResolvedValue({
      data: [{ id: 'a', status: 'taken' }, { id: 'b', status: 'pending' }],
      error: null,
    })
    const nav = makeNav()
    const groupParams = {
      isGrouped: 'true',
      doseInstanceIds: 'a,b',
      groupedDoses: JSON.stringify([
        { instanceId: 'a', medicineName: 'A', dosagePerIntake: 1, dosagePerPill: 25, dosageUnit: 'mg' },
        { instanceId: 'b', medicineName: 'B', dosagePerIntake: 1, dosagePerPill: 50, dosageUnit: 'mg' },
      ]),
    }
    render(<AlarmFullScreen navigation={nav} route={{ params: groupParams }} />)
    await waitFor(() => expect(mockIn).toHaveBeenCalled())
    expect(nav.goBack).not.toHaveBeenCalled()
  })
})

describe('AlarmFullScreen — transparência clínica (US3/FR-006/007)', () => {
  it('single sólido → mostra concentração + quantidade a tomar', async () => {
    const nav = makeNav()
    const expectedConc = formatMedicineConcentration({ dosage_per_pill: '25', dosage_unit: 'mg', concentration_volume_ml: '' })
    const expectedQty = formatDoseItem({ dosagePerIntake: 2, intakeUnit: '', dosageUnit: 'mg', dosagePerPill: '25', unitsPerMl: '' })
    const { getByText } = render(<AlarmFullScreen navigation={nav} route={{ params: SINGLE }} />)
    await waitFor(() => expect(mockIn).toHaveBeenCalled())
    expect(getByText(expectedConc)).toBeTruthy()
    expect(getByText(`Dose: ${expectedQty}`)).toBeTruthy()
  })

  it('single injetável → unidade UI, nunca "un."', async () => {
    const nav = makeNav()
    const injectable = {
      ...SINGLE,
      doseInstanceId: 'inst-2',
      medicineName: 'Lantus',
      quantityTaken: '10',
      dosagePerPill: '100',
      dosageUnit: 'ui/ml',
      intakeUnit: 'UI',
      unitsPerMl: '100',
    }
    const expectedQty = formatDoseItem({ dosagePerIntake: 10, intakeUnit: 'UI', dosageUnit: 'ui/ml', dosagePerPill: '100', unitsPerMl: '100' })
    const { getByText } = render(<AlarmFullScreen navigation={nav} route={{ params: injectable }} />)
    await waitFor(() => expect(mockIn).toHaveBeenCalled())
    expect(expectedQty).toMatch(/UI/)
    expect(expectedQty).not.toMatch(/un\./)
    expect(getByText(`Dose: ${expectedQty}`)).toBeTruthy()
  })
})
