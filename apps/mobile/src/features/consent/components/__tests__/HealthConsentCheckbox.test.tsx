// HealthConsentCheckbox.test.tsx — opt-in destacado mobile (spec 046, T006/T007).
import { render, fireEvent, screen } from '@testing-library/react-native'

const mockLogEvent = jest.fn()
jest.mock('../../../../platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

import { Linking } from 'react-native'
import HealthConsentCheckbox from '../HealthConsentCheckbox'

describe('HealthConsentCheckbox', () => {
  let openURLSpy

  beforeEach(() => {
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  })

  afterEach(() => {
    openURLSpy.mockRestore()
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('renderiza a copy canônica', () => {
    render(<HealthConsentCheckbox checked={false} onChange={jest.fn()} />)

    expect(screen.getByText('Consentimento para dados de saúde')).toBeTruthy()
  })

  it('marcar NÃO dispara analytics de recusa', () => {
    const onChange = jest.fn()
    render(<HealthConsentCheckbox checked={false} onChange={onChange} />)

    fireEvent.press(screen.getByRole('checkbox'))

    expect(onChange).toHaveBeenCalledWith(true)
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('desmarcar dispara consent_health_declined sem PII (FR-008)', () => {
    const onChange = jest.fn()
    render(<HealthConsentCheckbox checked onChange={onChange} />)

    fireEvent.press(screen.getByRole('checkbox'))

    expect(onChange).toHaveBeenCalledWith(false)
    expect(mockLogEvent).toHaveBeenCalledWith('consent_health_declined', {})
  })

  it('accessibilityState reflete checked', () => {
    render(<HealthConsentCheckbox checked onChange={jest.fn()} />)

    expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(true)
  })

  it('não reage a toques quando disabled', () => {
    const onChange = jest.fn()
    render(<HealthConsentCheckbox checked={false} onChange={onChange} disabled />)

    fireEvent.press(screen.getByRole('checkbox'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('abre a política via Linking.openURL', () => {
    render(<HealthConsentCheckbox checked={false} onChange={jest.fn()} />)

    fireEvent.press(screen.getByText('Ver política de privacidade'))

    expect(openURLSpy).toHaveBeenCalledWith('https://dosiq.app/politica-de-privacidade')
  })
})
