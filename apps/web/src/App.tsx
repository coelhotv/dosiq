import { useState, useEffect, lazy, Suspense } from 'react'
import { getCurrentUser, onAuthStateChange, supabase } from '@shared/utils/supabase'
import '@shared/styles/index.css'
import Loading from '@shared/components/ui/Loading'
import AppErrorBoundary from '@shared/components/ui/AppErrorBoundary'

const AuthenticatedShell = lazy(() => import('./AuthenticatedShell'))
const Landing = lazy(() => import('./views/landing/Landing'))
const Auth = lazy(() => import('./views/Auth'))

function AppLoading() {
  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Loading text="Carregando..." />
    </div>
  )
}

function PublicShell({
  showAuth,
  setShowAuth,
  onAuthSuccess,
}: {
  showAuth: boolean
  setShowAuth: (show: boolean) => void
  onAuthSuccess: () => void
}) {
  const [authDefaultLogin, setAuthDefaultLogin] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const params = new URLSearchParams(window.location.search)
      return params.has('login') || params.get('auth') === 'login'
    } catch {
      return false
    }
  })

  // Limpeza de parâmetros de autenticação vindos das páginas estáticas (/glp-1, guias)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search)
        if (params.has('login') || params.has('signup') || params.has('auth')) {
          const url = new URL(window.location.href)
          url.searchParams.delete('login')
          url.searchParams.delete('signup')
          url.searchParams.delete('auth')
          const newSearch = url.searchParams.toString()
          window.history.replaceState({}, '', url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash)
        }
      } catch {
        // Fallback silencioso em ambientes de teste
      }
    }
  }, [])

  const handleOpenAuth = (mode?: 'login' | 'signup' | boolean) => {
    setAuthDefaultLogin(mode === 'login' || mode === true)
    setShowAuth(true)
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
    }
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content">Ir para conteúdo principal</a>
      <div className="app-container">
        <main id="main-content" className="app-main">
          {showAuth ? (
            <Suspense fallback={<AppLoading />}>
              <Auth
                defaultLogin={authDefaultLogin}
                onAuthSuccess={onAuthSuccess}
                onClose={() => setShowAuth(false)}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<AppLoading />}>
              <Landing isAuthenticated={false} onOpenAuth={handleOpenAuth} />
            </Suspense>
          )}
          <footer style={{ textAlign: 'center', marginTop: 'var(--space-8)', paddingBottom: 'var(--space-8)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
            {' '}
          </footer>
        </main>
      </div>
    </>
  )
}

function AppInner() {
  const [session, setSession] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const params = new URLSearchParams(window.location.search)
      return params.has('login') || params.has('signup') || params.has('auth')
    } catch {
      return false
    }
  })
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    getCurrentUser()
      .then((user) => { setSession(user); setIsLoading(false) })
      .catch(() => { setSession(null); setIsLoading(false) })

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      const isRecoveryFlow = localStorage.getItem('@dosiq/recovery-flow')
      if (event === 'PASSWORD_RECOVERY' || isRecoveryFlow === 'true') {
        localStorage.removeItem('@dosiq/recovery-flow')
        setIsPasswordRecovery(true)
        setSession(session?.user ?? null)

        // Limpar o hash da URL para evitar re-gatilhos do fluxo de recuperação em reloads/signouts
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, null, window.location.pathname + window.location.search)
        }
        return
      }

      try {
        const isRecoveryFlow = localStorage.getItem('@dosiq/recovery-flow')
        if (isRecoveryFlow === 'true') {
          localStorage.removeItem('@dosiq/recovery-flow')
          setIsPasswordRecovery(true)
          setSession(session?.user ?? null)

          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, null, window.location.pathname + window.location.search)
          }
          return
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao acessar localStorage no fluxo de recuperação:', error)
        }
      }

      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false)
        // Verificar race condition (PWA + aba concorrente) antes de deslogar
        const { data: { session: latestSession } } = await supabase.auth.getSession()
        setSession(latestSession?.user ?? null)
        return
      }
      setSession(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isLoading) {
    return <AppLoading />
  }

  if (!session) {
    return (
      <PublicShell
        showAuth={showAuth}
        setShowAuth={setShowAuth}
        onAuthSuccess={() => setShowAuth(false)}
      />
    )
  }

  return (
    <Suspense fallback={<AppLoading />}>
      <AuthenticatedShell
        session={session}
        isPasswordRecovery={isPasswordRecovery}
        onResetComplete={() => setIsPasswordRecovery(false)}
      />
    </Suspense>
  )
}

function App() {
  return (
    <AppErrorBoundary>
      <AppInner />
    </AppErrorBoundary>
  )
}

export default App
