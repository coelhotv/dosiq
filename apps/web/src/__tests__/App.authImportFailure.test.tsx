import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Spec 112 (E3): chunk do Supabase indisponível não pode prender quem tem sessão no spinner
vi.mock('@shared/utils/supabase', () => {
  throw new TypeError('Failed to fetch dynamically imported module')
})

const handleChunkErrorMock = vi.fn(() => false)
vi.mock('@shared/utils/chunkReload', () => ({
  handleChunkError: () => handleChunkErrorMock(),
}))

vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: () => null,
}))

import App from '../App'

describe('App — falha ao importar o módulo de auth (spec 112 E3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('sb-testref-auth-token', '{}')
    window.history.replaceState({}, '', '/')
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.clearAllTimers()
    window.localStorage.clear()
  })

  it('reload já usado na janela → cai na Landing em vez de spinner eterno', async () => {
    handleChunkErrorMock.mockReturnValue(false)
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Nunca mais erre uma/i)).toBeInTheDocument()
    })
    expect(handleChunkErrorMock).toHaveBeenCalled()
  })

  it('reload disponível → delega ao chunkReload e mantém o spinner até recarregar', async () => {
    handleChunkErrorMock.mockReturnValue(true)
    render(<App />)

    await waitFor(() => {
      expect(handleChunkErrorMock).toHaveBeenCalled()
    })
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })
})
