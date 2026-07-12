// StockTrackingProvider — revalidação multi-device da preferência de estoque (spec 044).
//
// Cenário que motiva o teste (smoke da F4a): o usuário desliga o controle de estoque na web
// enquanto a outra superfície está aberta em segundo plano. A preferência é uma POLÍTICA DE
// CONTA — quando a aba volta ao foco, as superfícies de estoque precisam obedecer à escolha
// feita no OUTRO device. O `refresh()` do AP-281 só cobre a escrita feita nesta superfície.

import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getStockTracking = vi.fn()

vi.mock('@dosiq/core', () => ({
  createProfileRepository: () => ({ getStockTracking }),
}))

vi.mock('@shared/utils/supabase', () => ({ supabase: {}, getUserId: vi.fn() }))

const { StockTrackingProvider, useStockTracking } = await import('../useStockTracking')

function Probe() {
  const { enabled, ready } = useStockTracking()
  return <span data-testid="state">{!ready ? 'loading' : enabled ? 'on' : 'off'}</span>
}

function renderProvider() {
  return render(
    <StockTrackingProvider session={{ user: { id: 'u1' } }}>
      <Probe />
    </StockTrackingProvider>,
  )
}

describe('StockTrackingProvider — revalidação multi-device', () => {
  beforeEach(() => {
    getStockTracking.mockResolvedValue({ stock_tracking_enabled: true, stock_paused_at: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('reflete o desligamento feito em OUTRO device quando a aba volta ao foco', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('on'))

    // O outro device (mobile) desligou o controle de estoque.
    getStockTracking.mockResolvedValue({
      stock_tracking_enabled: false,
      stock_paused_at: '2026-07-12T10:00:00Z',
    })

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('off'))
  })

  it('revalida no visibilitychange apenas quando a aba está visível', async () => {
    renderProvider()
    await waitFor(() => expect(getStockTracking).toHaveBeenCalledTimes(1))

    // Aba indo para segundo plano: não gasta query.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(getStockTracking).toHaveBeenCalledTimes(1)

    // Aba retomada: revalida.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(getStockTracking).toHaveBeenCalledTimes(2))
  })

  it('falha de rede na revalidação NÃO esconde o estoque de quem o usa (fail-safe AP-277)', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('on'))

    getStockTracking.mockRejectedValue(new Error('rede caiu'))
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(getStockTracking).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('state')).toHaveTextContent('on')
  })

  it('sem sessão não consulta o backend', async () => {
    render(
      <StockTrackingProvider>
        <Probe />
      </StockTrackingProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('on'))
    expect(getStockTracking).not.toHaveBeenCalled()
  })
})
