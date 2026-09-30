import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createMock = vi.fn((..._args: unknown[]) => Promise.resolve({}))
let savedPayload: Record<string, unknown> = {}

vi.mock('@dashboard/hooks/useDashboardContext', () => ({
  useDashboard: () => ({ protocols: [], refresh: vi.fn() }),
}))
vi.mock('@shared/services', () => ({
  cachedLogService: { create: (...args) => createMock(...args), createBulk: vi.fn() },
  cachedTreatmentPlanService: { getAll: () => Promise.resolve([]) },
}))
vi.mock('@shared/components/ui/Modal', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('@shared/components/log/LogForm', () => ({
  default: ({ onSave }) => (
    <button type="button" onClick={() => onSave(savedPayload)}>
      salvar
    </button>
  ),
}))

import GlobalDoseModal from '@shared/components/ui/GlobalDoseModal'

const initialValues = { type: 'protocol', protocol_id: 'p-inj', instance_id: 'i-inj' }

describe('GlobalDoseModal — ancora na dose_instance do Hoje (071)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('mesmo tratamento do "Tomar": registra com a instanceId recebida', async () => {
    savedPayload = { protocol_id: 'p-inj', injection_site: 'gluteo_e' }
    render(<GlobalDoseModal isOpen onClose={vi.fn()} initialValues={initialValues} />)
    fireEvent.click(screen.getByText('salvar'))
    await waitFor(() => expect(createMock).toHaveBeenCalledWith(savedPayload, { instanceId: 'i-inj' }))
  })

  it('tratamento trocado no formulário: não ancora na instância de outra dose', async () => {
    savedPayload = { protocol_id: 'p-outro' }
    render(<GlobalDoseModal isOpen onClose={vi.fn()} initialValues={initialValues} />)
    fireEvent.click(screen.getByText('salvar'))
    await waitFor(() => expect(createMock).toHaveBeenCalledWith(savedPayload, { instanceId: null }))
  })

  it('aberto sem instância (speed-dial): instanceId null, como antes', async () => {
    savedPayload = { protocol_id: 'p-inj' }
    render(<GlobalDoseModal isOpen onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('salvar'))
    await waitFor(() => expect(createMock).toHaveBeenCalledWith(savedPayload, { instanceId: null }))
  })
})
