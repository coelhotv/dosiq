// ConsentRegularizationModal.test.tsx — nudge de política nova (spec 046, T011/T007).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { grantMock } = vi.hoisted(() => ({ grantMock: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@shared/hooks/useConsentGate', () => ({
  useConsentGate: () => ({ grant: grantMock }),
}))

import ConsentRegularizationModal from '../ConsentRegularizationModal'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('ConsentRegularizationModal', () => {
  it('não renderiza nada quando visible=false', () => {
    const { container } = render(
      <ConsentRegularizationModal visible={false} onDismiss={vi.fn()} onConfirmed={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('"Agora não" dispensa sem chamar grant (não escreve nada)', () => {
    const onDismiss = vi.fn()
    render(<ConsentRegularizationModal visible onDismiss={onDismiss} onConfirmed={vi.fn()} />)

    fireEvent.click(screen.getByText('Agora não'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(grantMock).not.toHaveBeenCalled()
  })

  it('"Aceitar a nova versão" chama o grant do gate e onConfirmed em sucesso', async () => {
    const onConfirmed = vi.fn()
    render(<ConsentRegularizationModal visible onDismiss={vi.fn()} onConfirmed={onConfirmed} />)

    fireEvent.click(screen.getByText('Aceitar a nova versão'))

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(grantMock).toHaveBeenCalledTimes(1)
  })

  it('mostra erro e NÃO chama onConfirmed quando o grant falha', async () => {
    grantMock.mockResolvedValueOnce({ ok: false, error: 'boom' })
    const onConfirmed = vi.fn()
    render(<ConsentRegularizationModal visible onDismiss={vi.fn()} onConfirmed={onConfirmed} />)

    fireEvent.click(screen.getByText('Aceitar a nova versão'))

    expect(await screen.findByText(/Não foi possível registrar/)).toBeTruthy()
    expect(onConfirmed).not.toHaveBeenCalled()
  })
})
