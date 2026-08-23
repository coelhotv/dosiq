/**
 * @fileoverview Testes do EmergencyCardView — spec 073 PR 2 (Slice D).
 *
 * Cobre o trio de defeitos do cartão: vigência ignorada (F-9), colapso do 2º tratamento
 * do mesmo medicamento (F-10), payload do QR divergindo da tela (F-11) e contagem de
 * tomadas ausente em cadência não-diária (F-12).
 *
 * @module features/emergency/components/__tests__/EmergencyCardView
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  dashboard: {
    medicines: [],
    protocols: [],
    isLoading: false,
  },
  qrProps: null as any,
}))

vi.mock('@dashboard/hooks/useDashboardContext', () => ({
  useDashboard: () => mocks.dashboard,
}))

vi.mock('@features/emergency/services/emergencyCardService', () => ({
  emergencyCardService: {
    getOfflineCard: vi.fn(() => null),
  },
}))

// O QR não é renderizado de verdade: o que interessa é QUAL LISTA ele recebe — é assim
// que se prova que tela e payload saem da mesma fonte (AC-18).
vi.mock('@/features/emergency/components/EmergencyQRCode', () => ({
  default: (props: any) => {
    mocks.qrProps = props
    return <div data-testid="qr-stub" />
  },
}))

import * as core from '@dosiq/core'
import EmergencyCardView from '@/features/emergency/components/EmergencyCardView'
import {
  CLINICAL_MEDICINES,
  CLINICAL_PROTOCOLS,
  MEDICINE_SOLID,
  PROTOCOL_SOLID_MORNING,
  PROTOCOL_LIQUID_WEEKLY,
  PROTOCOL_EXPIRED,
  dateOffset,
} from '@/test/fixtures/clinicalSurfaces'

const CARD_DATA = {
  name: 'Maria de Souza',
  blood_type: 'A+',
  allergies: ['Penicilina'],
  emergency_contacts: [],
  notes: null,
  last_updated: '2026-08-20T10:00:00.000Z',
}

function renderCard() {
  return render(<EmergencyCardView data={CARD_DATA} onEdit={() => {}} />)
}

describe('EmergencyCardView — 073 (cartão de emergência)', () => {
  beforeEach(() => {
    mocks.dashboard = {
      medicines: [...CLINICAL_MEDICINES],
      protocols: [...CLINICAL_PROTOCOLS],
      isLoading: false,
    }
    mocks.qrProps = null
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('AC-16: tratamento com end_date no passado não aparece no cartão', () => {
    renderCard()

    expect(screen.queryByText(/Dipirona/)).not.toBeInTheDocument()
  })

  it('AC-16: tratamento com start_date no futuro também fica fora', () => {
    mocks.dashboard.protocols = [
      { ...PROTOCOL_SOLID_MORNING, id: 'prot-futuro', start_date: dateOffset(3), end_date: dateOffset(60) },
    ]
    renderCard()

    expect(screen.getByText(/Nenhum medicamento ativo/)).toBeInTheDocument()
  })

  it('AC-16: `active` NULL/undefined continua vigente (omissão é a falha cara)', () => {
    mocks.dashboard.protocols = [{ ...PROTOCOL_SOLID_MORNING, active: undefined }]
    renderCard()

    expect(screen.getAllByText(/Paracetamol/)).toHaveLength(1)
  })

  it('AC-17: medicamento com 2 tratamentos vigentes rende DUAS linhas', () => {
    renderCard()

    // Um <li> por tratamento — o Map por medicine_id descartava o segundo.
    expect(screen.getAllByText(/Paracetamol/)).toHaveLength(2)
  })

  it('AC-18: o QR recebe exatamente a mesma lista exibida na tela', () => {
    renderCard()

    const ids = mocks.qrProps.medications.map((m: any) => m.protocolId)
    expect(ids).toEqual([PROTOCOL_SOLID_MORNING.id, 'prot-solid-2', PROTOCOL_LIQUID_WEEKLY.id])
    expect(ids).not.toContain(PROTOCOL_EXPIRED.id)
  })

  it('AC-19: cadência semanal também mostra a contagem de tomadas', () => {
    mocks.dashboard.protocols = [{ ...PROTOCOL_LIQUID_WEEKLY, time_schedule: ['09:00', '21:00'] }]
    renderCard()

    expect(screen.getByText('2x — Semanal')).toBeInTheDocument()
  })

  it('AC-19: diário mantém o rótulo atual', () => {
    mocks.dashboard.protocols = [PROTOCOL_SOLID_MORNING]
    renderCard()

    expect(screen.getByText('2x ao dia')).toBeInTheDocument()
  })

  it('degenerado: sem time_schedule não imprime "0x"', () => {
    mocks.dashboard.protocols = [{ ...PROTOCOL_SOLID_MORNING, time_schedule: null }]
    renderCard()

    expect(screen.queryByText(/0x/)).not.toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(MEDICINE_SOLID.name))).toHaveLength(1)
  })

  it('degenerado: medicamento fora da lista carregada não some do cartão (omissão é a falha cara)', () => {
    mocks.dashboard.protocols = [{ ...PROTOCOL_SOLID_MORNING, medicine_id: 'sumiu' }]
    renderCard()

    // Nome vem do próprio tratamento; sem cadastro não há concentração inventada.
    expect(screen.getByText(/Paracetamol/)).toBeInTheDocument()
    expect(screen.queryByText(/500 mg/)).not.toBeInTheDocument()
  })

  it('RC6: cartão montado atravessa a meia-noite e revalida o dia ao voltar à tela', async () => {
    // O tratamento vence HOJE (end_date inclusiva): agora ele aparece.
    mocks.dashboard.protocols = [{ ...PROTOCOL_SOLID_MORNING, end_date: dateOffset(0) }]
    renderCard()
    expect(screen.getAllByText(/Paracetamol/)).toHaveLength(1)

    // Simula a virada: o relógio do core passa a devolver amanhã, e o app volta ao primeiro plano.
    const amanha = dateOffset(1)
    const spy = vi.spyOn(core, 'getTodayLocal').mockReturnValue(amanha)
    try {
      await act(async () => {
        window.dispatchEvent(new Event('focus'))
      })
      // Sem a revalidação, o dia ficaria congelado na montagem e o vencido seguiria listado.
      expect(screen.queryByText(/Paracetamol/)).not.toBeInTheDocument()
    } finally {
      spy.mockRestore()
    }
  })

  it('degenerado: tratamento vigente sem medicamento e sem nome fica fora (nada a imprimir)', () => {
    mocks.dashboard.protocols = [
      { ...PROTOCOL_SOLID_MORNING, medicine_id: 'sumiu', medicine_name: undefined },
    ]
    renderCard()

    expect(screen.getByText(/Nenhum medicamento ativo/)).toBeInTheDocument()
  })
})
