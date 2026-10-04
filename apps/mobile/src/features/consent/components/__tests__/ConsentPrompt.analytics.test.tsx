// ConsentPrompt.analytics.test.tsx — família consent_* (065 PR D / US9 / PO-12).
//
// O prompt é o ponto comum dos 4 caminhos de consentimento (C1.5 do PR D): shown/dismissed/granted
// nascem aqui, sempre com o `source` de quem montou — nunca default.
import { render, fireEvent, screen, act } from '@testing-library/react-native'

const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

import ConsentPrompt from '../ConsentPrompt'

const consentCalls = () => mockLogEvent.mock.calls.filter(([n]) => String(n).startsWith('consent_'))

function renderPrompt(onGrant: () => Promise<{ ok: boolean }>, extra = {}) {
  const onGranted = jest.fn()
  const onDismiss = jest.fn()
  const utils = render(
    <ConsentPrompt blocking={false} source="prompt_navigated" onGrant={onGrant} onDismiss={onDismiss} onGranted={onGranted} {...extra} />,
  )
  return { ...utils, onGranted, onDismiss }
}

async function checkAndConfirm() {
  fireEvent.press(screen.getByRole('checkbox'))
  await act(async () => {
    fireEvent.press(screen.getByText('Autorizar e continuar'))
  })
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('ConsentPrompt — consent_*', () => {
  it('montagem: consent_prompt_shown{blocking, source} 1× — re-render não re-emite', () => {
    const { rerender } = renderPrompt(jest.fn())
    rerender(<ConsentPrompt blocking={false} source="prompt_navigated" onGrant={jest.fn()} onDismiss={jest.fn()} onGranted={jest.fn()} />)
    expect(consentCalls()).toEqual([['consent_prompt_shown', { blocking: false, source: 'prompt_navigated', surface: 'mobile' }]])
  })

  it('grant ok: consent_granted{source} e onGranted', async () => {
    const { onGranted } = renderPrompt(jest.fn().mockResolvedValue({ ok: true }))
    await checkAndConfirm()
    expect(mockLogEvent).toHaveBeenCalledWith('consent_granted', { source: 'prompt_navigated', surface: 'mobile' })
    expect(onGranted).toHaveBeenCalled()
  })

  it('grant ok:false: sem consent_granted', async () => {
    renderPrompt(jest.fn().mockResolvedValue({ ok: false }))
    await checkAndConfirm()
    expect(mockLogEvent).not.toHaveBeenCalledWith('consent_granted', expect.anything())
  })

  it('grant rejeita (rede): sem consent_granted', async () => {
    renderPrompt(jest.fn().mockRejectedValue(new Error('offline')))
    await checkAndConfirm()
    expect(mockLogEvent).not.toHaveBeenCalledWith('consent_granted', expect.anything())
  })

  it('"Agora não": consent_prompt_dismissed{source} e onDismiss', () => {
    const { onDismiss } = renderPrompt(jest.fn())
    fireEvent.press(screen.getByText('Agora não'))
    expect(mockLogEvent).toHaveBeenCalledWith('consent_prompt_dismissed', { source: 'prompt_navigated', surface: 'mobile' })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('bloqueante: shown{blocking:true} e sem botão de adiar', () => {
    renderPrompt(jest.fn(), { blocking: true, source: 'prompt_blocking', onDismiss: undefined })
    expect(consentCalls()).toEqual([['consent_prompt_shown', { blocking: true, source: 'prompt_blocking', surface: 'mobile' }]])
    expect(screen.queryByText('Agora não')).toBeNull()
  })
})
