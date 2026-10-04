// DocumentViewer.test.tsx — spec 097 Slice B (B-1): visualizador único (política + PDF no iOS).
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Linking } from 'react-native'
import DocumentViewer, { shouldLoadInViewer } from '../DocumentViewer'

const POLICY = 'https://dosiq.app/politica-de-privacidade'
const PDF = 'file:///cache/dosiq-relatorio-30d-2026-10-03.pdf'

afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('DocumentViewer', () => {
  it('fechado (source null) não renderiza nada', () => {
    render(<DocumentViewer source={null} title="x" onClose={jest.fn()} />)
    expect(screen.queryByTestId('document-viewer-webview')).toBeNull()
  })

  it('PDF: JavaScript desligado e arquivo local como fonte', () => {
    render(<DocumentViewer source={{ kind: 'pdf', uri: PDF }} title="Relatório" onClose={jest.fn()} />)
    const web = screen.getByTestId('document-viewer-webview')
    expect(web.props.source).toEqual({ uri: PDF })
    expect(web.props.javaScriptEnabled).toBe(false)
    expect(web.props.allowingReadAccessToURL).toBe('file:///cache/')
  })

  it('web: JavaScript ligado (SPA), sem persistir sessão', () => {
    render(<DocumentViewer source={{ kind: 'web', url: POLICY }} title="Política" onClose={jest.fn()} />)
    const web = screen.getByTestId('document-viewer-webview')
    expect(web.props.javaScriptEnabled).toBe(true)
    expect(web.props.incognito).toBe(true)
  })

  it('link externo sai para o navegador do sistema e não carrega no viewer', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<DocumentViewer source={{ kind: 'web', url: POLICY }} title="Política" onClose={jest.fn()} />)
    const web = screen.getByTestId('document-viewer-webview')
    expect(web.props.onShouldStartLoadWithRequest({ url: 'https://www.gov.br/anpd' })).toBe(false)
    expect(openURL).toHaveBeenCalledWith('https://www.gov.br/anpd')
    expect(web.props.onShouldStartLoadWithRequest({ url: `${POLICY}#cookies` })).toBe(true)
  })

  it('Fechar chama onClose (o sheet de consentimento usa isso para destravar o aceite)', () => {
    const onClose = jest.fn()
    render(<DocumentViewer source={{ kind: 'web', url: POLICY }} title="Política" onClose={onClose} presentation="overlay" />)
    fireEvent.press(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledWith({ loaded: false })
  })

  it('onClose informa se o documento carregou: sucesso → true; erro antes do onLoadEnd → false', () => {
    const onClose = jest.fn()
    const { unmount } = render(<DocumentViewer source={{ kind: 'web', url: POLICY }} title="Política" onClose={onClose} />)
    fireEvent(screen.getByTestId('document-viewer-webview'), 'onLoadEnd')
    fireEvent.press(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenLastCalledWith({ loaded: true })
    unmount()

    render(<DocumentViewer source={{ kind: 'web', url: POLICY }} title="Política" onClose={onClose} />)
    const web = screen.getByTestId('document-viewer-webview')
    fireEvent(web, 'onHttpError')
    fireEvent(web, 'onLoadEnd')
    fireEvent.press(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenLastCalledWith({ loaded: false })
  })

  it('erro de carga mostra mensagem na tela', () => {
    render(<DocumentViewer source={{ kind: 'pdf', uri: PDF }} title="Relatório" onClose={jest.fn()} />)
    fireEvent(screen.getByTestId('document-viewer-webview'), 'onError')
    expect(screen.getByText(/Não foi possível abrir o documento/)).toBeTruthy()
  })
})

describe('shouldLoadInViewer', () => {
  it.each([
    [{ kind: 'web', url: POLICY } as const, 'https://dosiq.app/termos', true],
    [{ kind: 'web', url: POLICY } as const, 'https://dosiq.app.evil.com/x', false],
    [{ kind: 'web', url: POLICY } as const, 'http://dosiq.app/x', false],
    [{ kind: 'web', url: POLICY } as const, 'javascript:alert(1)', false],
    [{ kind: 'pdf', uri: PDF } as const, PDF, true],
    [{ kind: 'pdf', uri: PDF } as const, 'https://dosiq.app', false],
    [{ kind: 'pdf', uri: PDF } as const, 'file:///etc/passwd', false],
  ])('%j → %s = %s', (source, url, expected) => {
    expect(shouldLoadInViewer(source, url)).toBe(expected)
  })
})
