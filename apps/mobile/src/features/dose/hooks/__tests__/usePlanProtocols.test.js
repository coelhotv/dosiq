// usePlanProtocols.test.js — testes unitários para usePlanProtocols hook
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { renderHook, waitFor } from '@testing-library/react-native'
import { usePlanProtocols } from '../usePlanProtocols'
import { getActiveTreatments } from '../../../treatments/services/treatmentsService'

jest.mock('../../../treatments/services/treatmentsService', () => ({
  getActiveTreatments: jest.fn(),
}))

jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  getTodayLocal: () => '2026-05-27',
}))

const MOCK_TREATMENTS = [
  {
    id: 't1',
    name: 'Aspirina',
    active: true,
    start_date: '2026-05-01',
    end_date: null,
    time_schedule: ['08:00'],
    treatment_plan: { id: 'plan-1', name: 'Plano Cardio' },
    medicine_id: 'med-1',
  },
  {
    id: 't2',
    name: 'Paracetamol',
    active: false, // Pausado
    start_date: '2026-05-01',
    end_date: null,
    time_schedule: ['12:00'],
    treatment_plan: { id: 'plan-1', name: 'Plano Cardio' },
    medicine_id: 'med-2',
  },
  {
    id: 't3',
    name: 'Ibuprofeno',
    active: true,
    start_date: '2026-05-01',
    end_date: '2026-05-20', // Finalizado (assumindo hoje = 2026-05-27)
    time_schedule: ['20:00'],
    treatment_plan: null,
    medicine_id: 'med-3',
  },
  {
    id: 't4',
    name: 'Vitamina C',
    active: true,
    start_date: '2026-05-01',
    end_date: null,
    time_schedule: ['08:00'],
    treatment_plan: null,
    medicine_id: 'med-4',
  },
]

describe('usePlanProtocols', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getActiveTreatments.mockResolvedValue({
      success: true,
      data: MOCK_TREATMENTS,
    })
  })

  it('no modo plan, filtra por planId e janela de horário', async () => {
    const { result } = renderHook(() =>
      usePlanProtocols({
        mode: 'plan',
        planId: 'plan-1',
        scheduledTime: '08:00',
        userId: 'user-123',
      })
    )

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Deve retornar apenas t1 (ativo, no plan-1 e na janela das 08:00)
    expect(result.current.protocols).toHaveLength(1)
    expect(result.current.protocols[0].id).toBe('t1')
  })

  it('no modo plan, exclui prescrição encerrada do mesmo plano (bug prod 039)', async () => {
    // t5: finalizado (end_date < hoje), mesmo plan-1 e mesma janela das 08:00 que t1.
    // Sem o filtro de status, vazaria para a modal bulk junto com t1.
    getActiveTreatments.mockResolvedValue({
      success: true,
      data: [
        ...MOCK_TREATMENTS,
        {
          id: 't5',
          name: 'Selozok (prescrição antiga)',
          active: true,
          start_date: '2026-01-01',
          end_date: '2026-05-20', // finalizado (hoje = 2026-05-27)
          time_schedule: ['08:00'],
          treatment_plan: { id: 'plan-1', name: 'Plano Cardio' },
          medicine_id: 'med-5',
        },
      ],
    })

    const { result } = renderHook(() =>
      usePlanProtocols({
        mode: 'plan',
        planId: 'plan-1',
        scheduledTime: '08:00',
        userId: 'user-123',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Só t1 (ativo); t5 finalizado é excluído mesmo na janela/plano.
    expect(result.current.protocols).toHaveLength(1)
    expect(result.current.protocols[0].id).toBe('t1')
  })

  it('no modo plan, exclui prescrição FUTURA do mesmo plano (start_date > hoje)', async () => {
    getActiveTreatments.mockResolvedValue({
      success: true,
      data: [
        ...MOCK_TREATMENTS,
        {
          id: 't6',
          name: 'Novo tratamento (começa amanhã)',
          active: true,
          start_date: '2026-05-28', // futuro (hoje = 2026-05-27)
          end_date: null,
          time_schedule: ['08:00'],
          treatment_plan: { id: 'plan-1', name: 'Plano Cardio' },
          medicine_id: 'med-6',
        },
      ],
    })

    const { result } = renderHook(() =>
      usePlanProtocols({ mode: 'plan', planId: 'plan-1', scheduledTime: '08:00', userId: 'user-123' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.protocols).toHaveLength(1)
    expect(result.current.protocols[0].id).toBe('t1')
  })

  it('no modo misc, filtra pelos protocolIds explícitos', async () => {
    const { result } = renderHook(() =>
      usePlanProtocols({
        mode: 'misc',
        protocolIds: ['t1', 't4'],
        userId: 'user-123',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.protocols).toHaveLength(2)
    expect(result.current.protocols.map(p => p.id)).toEqual(['t1', 't4'])
  })

  it('no novo modo active, retorna todos os tratamentos operacionalmente ativos hoje', async () => {
    const { result } = renderHook(() =>
      usePlanProtocols({
        mode: 'active',
        userId: 'user-123',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Deve retornar t1 e t4 (ativos hoje). 
    // t2 está pausado (active=false) e t3 está finalizado (end_date < hoje).
    expect(result.current.protocols).toHaveLength(2)
    expect(result.current.protocols.map(p => p.id)).toEqual(['t1', 't4'])
  })
})
