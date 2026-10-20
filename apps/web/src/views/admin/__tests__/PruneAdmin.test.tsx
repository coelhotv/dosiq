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
    notices_sent: ['2026-09-20T12:00:00.000Z', '2026-10-13T12:00:00.000Z'], has_reaviso: false, section: 'decide', block: null,
    email_notice_due: null, email_deadline: '2026-10-20T12:00:00.000Z', next_milestone: null,
    approvable: true, overdue: true, red: false,
  }],
  summary: { approved_waiting: 1, executed_30d: 4, by_section: { decide: 1 } },
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

describe('PruneAdmin — aviso por e-mail devido (PO-5)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('linha sem push mostra o texto pronto, com a data e sem dado de saúde', async () => {
    svc.list.mockResolvedValue({ ...LIST, data: [{ ...LIST.data[0], section: 'email', approvable: false, email_notice_due: 'd83' }] })
    svc.getTexts.mockResolvedValue({ data: { body: 'Sua conta será excluída em {data} sem autorização.', version: 1 } })
    render(<PruneAdmin onBack={undefined} />)
    const texto = await screen.findByLabelText('Texto do aviso por e-mail')
    expect(texto.textContent).toContain('Sua conta no dosiq precisa de uma ação')
    expect(texto.textContent).toMatch(/excluídos em \d{2}\/\d{2}\/\d{4}/)
    expect(texto.textContent).not.toContain('{data}')
    expect(texto.textContent).not.toMatch(/remédio|medicament|dose/i)
    expect(screen.getByRole('button', { name: 'Marcar enviado' })).toBeTruthy()
  })
})

describe('PruneAdmin — seções pela próxima ação (FR-014)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('linha bloqueada sem avisos: não oferece Apagar; mostra o reaviso com o prazo novo', async () => {
    svc.list.mockResolvedValue({
      ...LIST,
      data: [{
        ...LIST.data[0], notices_sent: [], section: 'blocked', block: 'missing_notices', approvable: false,
        email_notice_due: 'reaviso', email_deadline: '2026-10-27T12:00:00.000Z',
      }],
      summary: { approved_waiting: 0, executed_30d: 0, by_section: { blocked: 1 } },
    })
    svc.getTexts.mockResolvedValue({ data: { body: 'Sua conta será excluída em {data} sem autorização.', version: 1 } })
    render(<PruneAdmin onBack={undefined} />)
    await screen.findByText(/⛔ Bloqueado/)
    expect(screen.getByText(/Avisos: 0 de 2/)).toBeTruthy()
    expect(screen.getByText(/Sem os 2 avisos da política/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apagar esta conta' })).toBeNull()
    const texto = screen.getByLabelText('Texto do aviso por e-mail')
    expect(texto.textContent).toContain('27/10/2026')
  })

  it('cada linha aparece numa seção só; "em contagem" fica recolhida', async () => {
    svc.list.mockResolvedValue({
      ...LIST,
      data: [
        LIST.data[0],
        { ...LIST.data[0], queue_id: 'q2', short_id: 'b1b2b3b4', email_masked: 'bia***@x.com', section: 'counting',
          approvable: false, next_milestone: { label: 'D+60', at: '2026-11-01T12:00:00.000Z' } },
      ],
      summary: { approved_waiting: 0, executed_30d: 0, by_section: { decide: 1, counting: 1 } },
    })
    svc.getTexts.mockResolvedValue({ data: { body: 'Sua conta será excluída em {data} sem autorização.', version: 1 } })
    render(<PruneAdmin onBack={undefined} />)
    await screen.findByText(/✅ Pronto para decidir/)
    expect(screen.getByText(/1 para decidir/)).toBeTruthy()
    expect(screen.getByText(/🕒 Em contagem/)).toBeTruthy()
    expect(screen.getByText(/Próximo marco: D\+60 em 01\/11\/2026/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Apagar esta conta' })).toHaveLength(1)
  })
})
