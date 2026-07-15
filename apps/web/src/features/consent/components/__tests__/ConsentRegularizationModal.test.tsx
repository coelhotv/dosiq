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

/** Cumpre o gate de leitura (abre a política) antes de aceitar. */
function readPolicy() {
  const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  fireEvent.click(screen.getByText('Ler a nova política'))
  expect(openSpy).toHaveBeenCalledWith('/politica-de-privacidade.html', '_blank', 'noopener,noreferrer')
  return openSpy
}

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

  it('não deixa aceitar antes de abrir a política (não se pede aceite sem via de ler)', () => {
    const onConfirmed = vi.fn()
    render(<ConsentRegularizationModal visible onDismiss={vi.fn()} onConfirmed={onConfirmed} />)

    // Botão de aceitar nasce desabilitado — o click não dispara o grant.
    fireEvent.click(screen.getByText('Aceitar a nova versão'))

    expect(grantMock).not.toHaveBeenCalled()
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('"Ler a nova política" abre a política em nova aba e destrava o aceite', () => {
    render(<ConsentRegularizationModal visible onDismiss={vi.fn()} onConfirmed={vi.fn()} />)

    readPolicy()

    expect(screen.getByText('Política lida ✓')).toBeTruthy()
  })

  it('"Aceitar a nova versão" (após ler) chama o grant do gate e onConfirmed em sucesso', async () => {
    const onConfirmed = vi.fn()
    render(<ConsentRegularizationModal visible onDismiss={vi.fn()} onConfirmed={onConfirmed} />)

    readPolicy()
    fireEvent.click(screen.getByText('Aceitar a nova versão'))

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(grantMock).toHaveBeenCalledTimes(1)
  })

  it('mostra erro e NÃO chama onConfirmed quando o grant falha', async () => {
    grantMock.mockResolvedValueOnce({ ok: false, error: 'boom' })
    const onConfirmed = vi.fn()
    render(<ConsentRegularizationModal visible onDismiss={vi.fn()} onConfirmed={onConfirmed} />)

    readPolicy()
    fireEvent.click(screen.getByText('Aceitar a nova versão'))

    expect(await screen.findByText(/Não foi possível registrar/)).toBeTruthy()
    expect(onConfirmed).not.toHaveBeenCalled()
  })
})
