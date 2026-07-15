// ConsentRegularizationSheet.test.tsx — nudge de política nova (spec 046, T011/T007).
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native'

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

// Mock auto-contido (o spy nasce dentro da factory) — evita ambiguidade de hoisting do
// babel-plugin-jest-hoist com referência a variável externa.
jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  const grantSpy = jest.fn()
  return {
    ...actual,
    __grantSpy: grantSpy,
    createConsentService: () => ({ grant: grantSpy }),
  }
})

const { __grantSpy: mockGrant } = jest.requireMock('@dosiq/core') as { __grantSpy: jest.Mock }
import ConsentRegularizationSheet from '../ConsentRegularizationSheet'

describe('ConsentRegularizationSheet', () => {
  beforeEach(() => {
    mockGrant.mockReset()
    mockGrant.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('não renderiza nada quando visible=false', () => {
    const { toJSON } = render(
      <ConsentRegularizationSheet visible={false} onDismiss={jest.fn()} onConfirmed={jest.fn()} />,
    )
    expect(toJSON()).toBeNull()
  })

  it('"Agora não" dispensa sem chamar grant (não escreve nada)', () => {
    const onDismiss = jest.fn()
    render(<ConsentRegularizationSheet visible onDismiss={onDismiss} onConfirmed={jest.fn()} />)

    fireEvent.press(screen.getByLabelText('Agora não'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(mockGrant).not.toHaveBeenCalled()
  })

  it('"Aceitar a nova versão" chama consent_grant (RPC), nunca insert direto', async () => {
    const onConfirmed = jest.fn()
    render(<ConsentRegularizationSheet visible onDismiss={jest.fn()} onConfirmed={onConfirmed} />)

    fireEvent.press(screen.getByLabelText('Aceitar a nova versão'))

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(mockGrant).toHaveBeenCalledWith('health_data', 'mobile')
  })

  it('mostra erro e não chama onConfirmed quando o grant falha', async () => {
    mockGrant.mockResolvedValueOnce({ ok: false, error: 'boom' })
    const onConfirmed = jest.fn()
    render(<ConsentRegularizationSheet visible onDismiss={jest.fn()} onConfirmed={onConfirmed} />)

    fireEvent.press(screen.getByLabelText('Aceitar a nova versão'))

    expect(await screen.findByText(/Não foi possível registrar/)).toBeTruthy()
    expect(onConfirmed).not.toHaveBeenCalled()
  })
})
