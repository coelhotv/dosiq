// ConsentPrompt.deadline.test.tsx — prazo de exclusão de quem nunca consentiu (spec 107 T051 / PO-SEC-3).
import { render, fireEvent, screen, act } from '@testing-library/react-native'

jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: jest.fn() }))
const mockFetchNotice = jest.fn()
jest.mock('@platform/consent/deletionNoticeService', () => ({
  fetchDeletionNotice: () => mockFetchNotice(),
}))

import ConsentPrompt from '../ConsentPrompt'

const PRAZO = '2027-01-20T15:00:00.000Z'

async function renderBlocking(extra = {}) {
  const onDeleteAccount = jest.fn()
  render(
    <ConsentPrompt blocking source="prompt_blocking" onGrant={jest.fn()} onGranted={jest.fn()} onDeleteAccount={onDeleteAccount} {...extra} />,
  )
  await act(async () => {})
  return { onDeleteAccount }
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('ConsentPrompt — prazo de exclusão (107)', () => {
  it('com data e texto do servidor ⇒ título do prazo, texto com a data e "excluir agora"', async () => {
    mockFetchNotice.mockResolvedValue({ eligibleAt: PRAZO, body: 'Autorize até {data} ou a conta será excluída.' })
    const { onDeleteAccount } = await renderBlocking()
    expect(screen.getByText('Precisamos da sua autorização')).toBeTruthy()
    expect(screen.getByTestId('consent-deadline-text').props.children).toBe('Autorize até 20 jan 2027 ou a conta será excluída.')
    fireEvent.press(screen.getByText('Prefiro excluir minha conta agora'))
    expect(onDeleteAccount).toHaveBeenCalledTimes(1)
  })

  it('texto do servidor inválido (body null) ⇒ fallback embarcado com a data', async () => {
    mockFetchNotice.mockResolvedValue({ eligibleAt: PRAZO, body: null })
    await renderBlocking()
    const txt = screen.getByTestId('consent-deadline-text').props.children as string
    expect(txt).toContain('serão excluídos em 20 jan 2027')
    expect(txt).not.toContain('{data}')
  })

  it('sem data (fora da fila ou offline) ⇒ prompt de sempre, sem "excluir agora"', async () => {
    mockFetchNotice.mockResolvedValue(null)
    await renderBlocking()
    expect(screen.queryByText('Precisamos da sua autorização')).toBeNull()
    expect(screen.getByText(/precisamos da sua autorização para tratar os dados de saúde/)).toBeTruthy()
    expect(screen.queryByTestId('consent-deadline-text')).toBeNull()
    expect(screen.queryByText('Prefiro excluir minha conta agora')).toBeNull()
  })

  it('opt-in voluntário (prompt_navigated) nem consulta o prazo', async () => {
    render(<ConsentPrompt blocking={false} source="prompt_navigated" onGrant={jest.fn()} onGranted={jest.fn()} />)
    await act(async () => {})
    expect(mockFetchNotice).not.toHaveBeenCalled()
  })

  it('sem onDeleteAccount (overlay dispensável) ⇒ mostra a data mas não a saída de exclusão', async () => {
    mockFetchNotice.mockResolvedValue({ eligibleAt: PRAZO, body: null })
    render(<ConsentPrompt blocking={false} source="prompt_dismissible" onGrant={jest.fn()} onGranted={jest.fn()} onDismiss={jest.fn()} />)
    await act(async () => {})
    expect(screen.getByTestId('consent-deadline-text')).toBeTruthy()
    expect(screen.queryByText('Prefiro excluir minha conta agora')).toBeNull()
  })
})
