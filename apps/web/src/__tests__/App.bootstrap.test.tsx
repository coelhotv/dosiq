import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

let mockUser: any = null
let authStateCallback: any = null

vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: mockUser ? { user: mockUser } : null } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  },
  getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
  onAuthStateChange: vi.fn((cb) => {
    authStateCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }),
}))

const dashboardProviderSpy = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="dashboard-provider-mock">{children}</div>
))
vi.mock('@dashboard/hooks/useDashboardContext', () => ({
  DashboardProvider: (props: any) => dashboardProviderSpy(props),
  useDashboard: vi.fn(() => ({})),
}))

const onboardingProviderSpy = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="onboarding-provider-mock">{children}</div>
))
vi.mock('@shared/components/onboarding', () => ({
  OnboardingProvider: (props: any) => onboardingProviderSpy(props),
  OnboardingWizard: () => null,
}))

vi.mock('@shared/hooks/useNotificationLog', () => ({
  useNotificationLog: vi.fn(() => ({ data: [] })),
}))

vi.mock('@shared/hooks/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: vi.fn(() => ({ unreadCount: 0 })),
}))

vi.mock('@shared/hooks/useConsentGate', () => ({
  useConsentGate: vi.fn(() => ({
    locked: false,
    needsRegularization: false,
    ready: true,
    mode: 'consented',
    refresh: vi.fn(),
  })),
  ConsentGateProvider: ({ children }: any) => <div data-testid="consent-gate-provider">{children}</div>,
  isConsentAllowedView: vi.fn(() => true),
}))

vi.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: vi.fn(() => ({ enabled: true, ready: true })),
  StockTrackingProvider: ({ children }: any) => <div data-testid="stock-tracking-provider">{children}</div>,
}))

vi.mock('@features/measures/services/measuresRepo', () => ({
  measuresRepo: { create: vi.fn() },
}))

vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: () => null,
}))

vi.mock('@shared/components/MobileAppBanner', () => ({
  default: () => null,
}))

// Lazy imports mock/fallback pass-through
vi.mock('@shared/components/ui/BottomNav', () => ({
  default: () => <div data-testid="bottom-nav">BottomNav</div>,
}))
vi.mock('@shared/components/ui/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}))

const installPromptSpy = vi.fn(() => <div data-testid="install-prompt-mock">InstallPrompt</div>)
vi.mock('@shared/components/pwa/InstallPrompt', () => ({
  default: () => installPromptSpy(),
}))

const registerPwaSpy = vi.fn()
vi.mock('@shared/components/pwa/pwaRegistration', () => ({
  registerPwa: () => registerPwaSpy(),
}))

import App from '../App'

describe('App Bootstrap & Gating (Spec 110 / PO-110-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = null
    authStateCallback = null
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

    const existingManifest = document.querySelector('link[rel="manifest"]')
    if (existingManifest) existingManifest.remove()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('quando anônimo (session === null) na Landing, não monta DashboardProvider nem OnboardingProvider', async () => {
    mockUser = null
    render(<App />)

    // Aguarda loading inicial terminar e a Landing aparecer
    await waitFor(() => {
      expect(screen.getByText(/Nunca mais erre uma/i)).toBeInTheDocument()
    })

    // Providers de domínio NÃO devem ter sido montados para anônimo
    expect(dashboardProviderSpy).not.toHaveBeenCalled()
    expect(onboardingProviderSpy).not.toHaveBeenCalled()
  })

  it('quando anônimo (session === null) na Auth (?login), não monta DashboardProvider nem OnboardingProvider', async () => {
    mockUser = null
    window.history.replaceState({}, '', '/?login')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Entrar|Criar conta|Carregando/i)).toBeInTheDocument()
    })

    expect(dashboardProviderSpy).not.toHaveBeenCalled()
    expect(onboardingProviderSpy).not.toHaveBeenCalled()
  })

  it('quando autenticado (session válida), monta a árvore protegida com DashboardProvider e OnboardingProvider', async () => {
    mockUser = { id: 'test-user-uuid', email: 'test@dosiq.app' }
    render(<App />)

    await waitFor(() => {
      expect(dashboardProviderSpy).toHaveBeenCalled()
      expect(onboardingProviderSpy).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('quando em fluxo de recuperação de senha, monta os providers de autenticado', async () => {
    mockUser = { id: 'test-user-uuid', email: 'test@dosiq.app' }
    render(<App />)

    await waitFor(() => {
      expect(dashboardProviderSpy).toHaveBeenCalled()
    })

    // Simula transição para PASSWORD_RECOVERY
    if (authStateCallback) {
      authStateCallback('PASSWORD_RECOVERY', { user: mockUser })
    }

    await waitFor(() => {
      expect(dashboardProviderSpy).toHaveBeenCalled()
      expect(onboardingProviderSpy).toHaveBeenCalled()
    })
  })

  it('quando anônimo (session === null), InstallPrompt não monta e registro do SW / manifesto não é acionado [PO-110-7]', async () => {
    mockUser = null
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Nunca mais erre uma/i)).toBeInTheDocument()
    })

    expect(installPromptSpy).not.toHaveBeenCalled()
    expect(registerPwaSpy).not.toHaveBeenCalled()
    expect(document.querySelector('link[rel="manifest"]')).toBeNull()
  })

  it('quando autenticado (session válida), monta InstallPrompt e chama registro do SW [PO-110-7]', async () => {
    mockUser = { id: 'test-user-uuid', email: 'test@dosiq.app' }
    render(<App />)

    await waitFor(() => {
      expect(installPromptSpy).toHaveBeenCalled()
    })

    expect(registerPwaSpy).toHaveBeenCalledTimes(1)
  })
})
