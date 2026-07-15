// ConsentRegularizationSheet.test.tsx — nudge de política nova (spec 046, T011/T007).
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as WebBrowser from 'expo-web-browser'

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }))

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
  const mockOpenBrowser = WebBrowser.openBrowserAsync as jest.Mock

  beforeEach(() => {
    mockGrant.mockReset()
    mockGrant.mockResolvedValue({ ok: true })
    mockOpenBrowser.mockReset()
    mockOpenBrowser.mockResolvedValue({ type: 'dismiss' })
  })

  // Helper: cumpre o gate de leitura (abre + fecha a webview da política) antes de aceitar.
  // Espera o rótulo "Política lida ✓" — só aparece DEPOIS do setHasRead (pós-await do
  // openBrowserAsync). Sem isso, o aceite pode ser pressionado com o botão ainda disabled.
  async function readPolicy() {
    fireEvent.press(screen.getByLabelText('Ler a nova política de privacidade'))
    expect(await screen.findByText('Política lida ✓')).toBeTruthy()
    expect(mockOpenBrowser).toHaveBeenCalledWith('https://dosiq.app/politica-de-privacidade')
  }

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

  it('não deixa aceitar antes de abrir a política (não se pede aceite sem via de ler)', async () => {
    const onConfirmed = jest.fn()
    render(<ConsentRegularizationSheet visible onDismiss={jest.fn()} onConfirmed={onConfirmed} />)

    // Aceitar está travado (disabled) — a pressão não dispara o grant.
    fireEvent.press(screen.getByLabelText('Aceitar a nova versão'))

    expect(mockGrant).not.toHaveBeenCalled()
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('"Ler a nova política" abre a webview e destrava o aceite', async () => {
    render(<ConsentRegularizationSheet visible onDismiss={jest.fn()} onConfirmed={jest.fn()} />)

    await readPolicy()

    expect(mockOpenBrowser).toHaveBeenCalledWith('https://dosiq.app/politica-de-privacidade')
    expect(screen.getByText('Política lida ✓')).toBeTruthy()
  })

  it('"Aceitar a nova versão" (após ler) chama consent_grant (RPC), nunca insert direto', async () => {
    const onConfirmed = jest.fn()
    render(<ConsentRegularizationSheet visible onDismiss={jest.fn()} onConfirmed={onConfirmed} />)

    await readPolicy()
    fireEvent.press(screen.getByLabelText('Aceitar a nova versão'))

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(mockGrant).toHaveBeenCalledWith('health_data', 'mobile')
  })

  it('mostra erro e não chama onConfirmed quando o grant falha', async () => {
    mockGrant.mockResolvedValueOnce({ ok: false, error: 'boom' })
    const onConfirmed = jest.fn()
    render(<ConsentRegularizationSheet visible onDismiss={jest.fn()} onConfirmed={onConfirmed} />)

    await readPolicy()
    fireEvent.press(screen.getByLabelText('Aceitar a nova versão'))

    expect(await screen.findByText(/Não foi possível registrar/)).toBeTruthy()
    expect(onConfirmed).not.toHaveBeenCalled()
  })
})
