// ProfileScreen.reportEntry.test.tsx — spec 097 Slice B (FR-010, PO-3): entrada "Relatório em PDF"
// em Ferramentas e o selo "novo" movido de "Histórico de Medidas".
import { fireEvent, render, screen } from '@testing-library/react-native'

const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useFocusEffect: jest.fn(),
}))
jest.mock('@profile/hooks/useProfile', () => ({
  useProfile: () => ({
    user: { id: 'u1' },
    loading: false,
    error: null,
    refresh: jest.fn(),
    hasProfile: true,
    displayName: 'Ana',
    initials: 'A',
    age: null,
    location: null,
  }),
}))
jest.mock('@profile/hooks/useNudges', () => ({
  useNudges: () => ({ nudge: null, dismiss: jest.fn(), handleAction: jest.fn(), refresh: jest.fn() }),
}))
jest.mock('@shared/hooks/useUnreadBadgeCount', () => ({
  useUnreadBadgeCount: () => ({ unreadCount: 0, refreshBadge: jest.fn() }),
}))
jest.mock('@profile/services/profileService', () => ({ logoutUser: jest.fn() }))
jest.mock('@platform/session/endSession', () => ({ drainAuditQueue: jest.fn() }))
jest.mock('@platform/updates/bundleInfo', () => ({
  getBundleInfo: () => ({}),
  formatBundleLabel: () => '',
  formatChannelLabel: () => '',
}))
jest.mock('@features/_dev/components/DevBadge', () => () => null)
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: {} } }))

import ProfileScreen from '../ProfileScreen'
import { ROUTES } from '@navigation/routes'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('ProfileScreen — Ferramentas (097 B, FR-010)', () => {
  it('"Relatório em PDF" leva à tela do relatório e carrega o selo "novo"', () => {
    render(<ProfileScreen />)
    const row = screen.getByLabelText('Relatório em PDF, novo')
    fireEvent.press(row)
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CLINICAL_REPORT)
  })

  it('o selo "novo" existe uma vez só (saiu de Histórico de Medidas)', () => {
    render(<ProfileScreen />)
    expect(screen.getAllByText('novo')).toHaveLength(1)
    expect(screen.getByText('Histórico de Medidas')).toBeTruthy()
  })
})
