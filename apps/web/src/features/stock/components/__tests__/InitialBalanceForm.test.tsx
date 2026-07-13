// InitialBalanceForm — semântica AP-285 (campo vazio = pulado, zero digitado = saldo real),
// vírgula PT-BR, "Cancelar" nunca escreve, "Ativar estoque" chama o service + refresh (AP-281)
// (spec 044, F4b / T020).

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMedicinesWithStockOrActiveProtocol: vi.fn(),
  activateStockWithInitialBalance: vi.fn(),
  refresh: vi.fn(),
}))

// Só o repositório é dublado. Os formatadores de unidade vêm do core REAL — dublá-los faria o
// teste medir o mock, não a regra (AP-279), justo na parte que precisa bater com o form de compra.
vi.mock('@dosiq/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dosiq/core')>()),
  createStockRepository: () => ({
    getMedicinesWithStockOrActiveProtocol: mocks.getMedicinesWithStockOrActiveProtocol,
  }),
}))

vi.mock('@shared/utils/supabase', () => ({
  supabase: {},
  getUserId: vi.fn(),
}))

vi.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: () => ({ refresh: mocks.refresh }),
}))

vi.mock('@features/settings/services/stockPreferenceService', () => ({
  activateStockWithInitialBalance: mocks.activateStockWithInitialBalance,
}))

import InitialBalanceForm from '../InitialBalanceForm'

const MEDICINES = [
  {
    id: 'med-1', name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg',
    concentration_volume_ml: null, presentation: 'comprimido',
    protocols: [{ active: true, dosage_per_intake: 2, intake_unit: null }],
  },
  { id: 'med-2', name: 'Metformina', dosage_per_pill: null, dosage_unit: null, concentration_volume_ml: null },
  // Injetável (GLP-1): comprado e persistido em ML; dose cadastrada em MG → conta aplicações.
  {
    id: 'med-3', name: 'Ozempic', dosage_per_pill: 0.68, dosage_unit: 'mg/ml',
    concentration_volume_ml: 1, presentation: 'injetavel',
    protocols: [{ active: true, dosage_per_intake: 0.25, intake_unit: 'mg' }],
  },
]

async function renderForm() {
  const onDone = vi.fn()
  const onCancel = vi.fn()
  render(<InitialBalanceForm source="upsell" onDone={onDone} onCancel={onCancel} />)
  await waitFor(() => expect(screen.getByText('Losartana')).toBeInTheDocument())
  return { onDone, onCancel }
}

describe('InitialBalanceForm', () => {
  beforeEach(() => {
    mocks.getMedicinesWithStockOrActiveProtocol.mockResolvedValue(MEDICINES)
    mocks.activateStockWithInitialBalance.mockResolvedValue(undefined)
    mocks.refresh.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('campo vazio é pulado (não entra em entries)', async () => {
    await renderForm()

    const inputLosartana = screen.getByLabelText(/Saldo inicial de Losartana/i)
    fireEvent.change(inputLosartana, { target: { value: '10' } })

    fireEvent.click(screen.getByRole('button', { name: 'Ativar estoque' }))

    await waitFor(() => expect(mocks.activateStockWithInitialBalance).toHaveBeenCalledTimes(1))
    expect(mocks.activateStockWithInitialBalance).toHaveBeenCalledWith(
      [{ medicineId: 'med-1', quantity: 10 }],
      'upsell',
    )
  })

  it('zero DIGITADO entra em entries como quantity 0', async () => {
    await renderForm()

    const inputMetformina = screen.getByLabelText(/Saldo inicial de Metformina/i)
    fireEvent.change(inputMetformina, { target: { value: '0' } })

    fireEvent.click(screen.getByRole('button', { name: 'Ativar estoque' }))

    await waitFor(() => expect(mocks.activateStockWithInitialBalance).toHaveBeenCalledTimes(1))
    expect(mocks.activateStockWithInitialBalance).toHaveBeenCalledWith(
      [{ medicineId: 'med-2', quantity: 0 }],
      'upsell',
    )
  })

  it('vírgula decimal PT-BR (1,5 -> 1.5)', async () => {
    await renderForm()

    const inputLosartana = screen.getByLabelText(/Saldo inicial de Losartana/i)
    fireEvent.change(inputLosartana, { target: { value: '1,5' } })

    fireEvent.click(screen.getByRole('button', { name: 'Ativar estoque' }))

    await waitFor(() => expect(mocks.activateStockWithInitialBalance).toHaveBeenCalledTimes(1))
    expect(mocks.activateStockWithInitialBalance).toHaveBeenCalledWith(
      [{ medicineId: 'med-1', quantity: 1.5 }],
      'upsell',
    )
  })

  it('"Ativar estoque" com nenhum campo preenchido chama o service com array vazio', async () => {
    await renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Ativar estoque' }))

    await waitFor(() => expect(mocks.activateStockWithInitialBalance).toHaveBeenCalledTimes(1))
    expect(mocks.activateStockWithInitialBalance).toHaveBeenCalledWith([], 'upsell')
  })

  it('"Cancelar" não chama o service (nenhuma escrita — AP-285)', async () => {
    const { onCancel } = await renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mocks.activateStockWithInitialBalance).not.toHaveBeenCalled()
  })

  it('após ativar com sucesso chama refresh() do useStockTracking (AP-281)', async () => {
    const { onDone } = await renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Ativar estoque' }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

// A unidade da tela TEM que ser a mesma que o cadastro de compra pede (líquido é comprado em
// frascos × volume e persistido em ml). Pedir numa unidade e gravar em outra corrompe o FIFO.
describe('InitialBalanceForm — unidade de estoque e equivalência', () => {
  it('sólido mostra "un." e líquido mostra "ml" (nunca "un.")', async () => {
    await renderForm()

    const ozempicInput = screen.getByLabelText(/Saldo inicial de Ozempic, em mililitros/i)
    expect(ozempicInput).toBeInTheDocument()
    expect(screen.getByLabelText(/Saldo inicial de Losartana, em unidades/i)).toBeInTheDocument()
    expect(screen.getAllByText('ml').length).toBeGreaterThan(0)
  })

  // O hint conta DOSES: é o que responde "quanto tempo de tratamento eu tenho?".
  it('sólido: hint conta doses ao digitar (saldo ÷ dose por tomada)', async () => {
    await renderForm()

    fireEvent.change(screen.getByLabelText(/Saldo inicial de Losartana/i), { target: { value: '24' } })

    expect(await screen.findByText(/Equivale a 12 doses/)).toBeInTheDocument()
  })

  it('injetável: hint conta aplicações e NÃO repete a concentração do rótulo', async () => {
    await renderForm()

    // 10 ml, dose 0,25 mg de uma solução 0,68 mg/ml (≈ 0,37 ml) → 27 aplicações
    fireEvent.change(screen.getByLabelText(/Saldo inicial de Ozempic/i), { target: { value: '10' } })

    expect(await screen.findByText(/Equivale a 27 aplicações/)).toBeInTheDocument()
    expect(screen.queryByText(/0,68 mg em 1 mL/)).not.toBeInTheDocument()
  })
})
