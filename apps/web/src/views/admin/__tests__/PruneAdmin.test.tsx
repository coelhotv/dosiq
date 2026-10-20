import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@services/api/pruneAdminService', () => ({
  pruneAdminService: {
    list: vi.fn(),
    approve: vi.fn(),
    defer: vi.fn(),
    reveal: vi.fn(),
    markNotice: vi.fn(),
    getTexts: vi.fn(),
    updateTexts: vi.fn(),
  },
}))

import PruneAdmin from '../PruneAdmin'
import { pruneAdminService } from '@services/api/pruneAdminService'

const svc = pruneAdminService as any

/** Payload no formato do handler `list` (api/admin/_handlers/prune.ts). */
const LIST = {
  data: [{
    queue_id: 'q1', short_id: 'a9f3e1c2', email_masked: 'ana***@gmail.com', reason: 'revoked_90d',
    scheduled_at: '2026-07-22T12:00:00.000Z', eligible_at: '2026-10-20T12:00:00.000Z', decision: 'pending',
    decided_at: null, note: null, reevaluate_at: null, executed_at: null, void_reason: null,
    notices_sent: ['2026-09-20T12:00:00.000Z'], email_notice_due: null, approvable: true, overdue: true, red: false,
  }],
  summary: { approved_waiting: 1, executed_30d: 4 },
  wave2: [],
}

describe('PruneAdmin (PO-6)', () => {
  beforeEach(() => {
    svc.list.mockResolvedValue(LIST)
    svc.getTexts.mockResolvedValue({ data: { body: 'Sua conta será excluída em {data} sem autorização.', version: 1 } })
    svc.approve.mockResolvedValue({ data: {} })
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('mostra só id curto, e-mail mascarado, motivo e datas; nenhuma ação em lote', async () => {
    render(<PruneAdmin onBack={undefined} />)
    await screen.findByText('ana***@gmail.com')
    expect(screen.getByText(/a9f3e1c2/)).toBeTruthy()
    expect(screen.getByText(/Retirou a autorização/)).toBeTruthy()
    expect(screen.queryByText(/aprovar todas/i)).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Apagar esta conta' })).toHaveLength(1)
  })

  it('Confirmar exclusão fica desabilitado até o prefixo bater; o prefixo vai ao servidor', async () => {
    render(<PruneAdmin onBack={undefined} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar esta conta' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar exclusão' }) as HTMLButtonElement
    const input = screen.getByLabelText(/primeiros caracteres do id/)

    expect(confirmar.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'a9f3e' } })
    expect(confirmar.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'b9f3e1' } })
    expect(confirmar.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'a9f3e1' } })
    expect(confirmar.disabled).toBe(false)

    fireEvent.click(confirmar)
    await waitFor(() => expect(svc.approve).toHaveBeenCalledWith('q1', 'a9f3e1'))
  })

  it('prévia do texto da trava é texto puro com a data no lugar de {data}', async () => {
    render(<PruneAdmin onBack={undefined} />)
    const previa = await screen.findByLabelText('Prévia')
    await waitFor(() => expect(previa.textContent).toBe('Sua conta será excluída em 20/01/2027 sem autorização.'))
    expect(previa.innerHTML).not.toContain('<b>')
  })
})
