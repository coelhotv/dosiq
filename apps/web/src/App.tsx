import { useState, useEffect, lazy, Suspense } from 'react'
import '@shared/styles/index.css'
import Loading from '@shared/components/ui/Loading'
import AppErrorBoundary from '@shared/components/ui/AppErrorBoundary'
import { handleChunkError } from '@shared/utils/chunkReload'
import { hasAuthSignal } from '@utils/authSignal'

const AuthenticatedShell = lazy(() => import('./AuthenticatedShell'))
const Landing = lazy(() => import('./views/landing/Landing'))
const Auth = lazy(() => import('./views/Auth'))

function AppLoading() {
  return (
    <div
      className="app-container"
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
    >
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
          window.history.replaceState(
            {},
            '',
            url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash
          )
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
      <a href="#main-content" className="skip-to-content">
        Ir para conteúdo principal
      </a>
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
          <footer
            style={{
              textAlign: 'center',
              marginTop: 'var(--space-8)',
              paddingBottom: 'var(--space-8)',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {' '}
          </footer>
        </main>
      </div>
    </>
  )
}

function readAuthSignal(): boolean {
  if (typeof window === 'undefined') return false
  let storage: Storage | undefined
  try {
    storage = window.localStorage
  } catch {
    storage = undefined
  }
  return hasAuthSignal(storage, window.location)
}

function AppInner() {
  const [session, setSession] = useState<any>(null)
  const [showAuth, setShowAuth] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const params = new URLSearchParams(window.location.search)
      return params.has('login') || params.has('signup') || params.has('auth')
    } catch {
      return false
    }
  })
  // Spec 112 (PO-112-2): o runtime Supabase só carrega com sinal de sessão ou ao abrir o Auth
  const [authEnabled, setAuthEnabled] = useState(() => readAuthSignal() || showAuth)
  const [isLoading, setIsLoading] = useState(authEnabled)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  // Abrir o Auth liga o gate (sticky): o listener fica registrado antes do submit do login
  const handleShowAuth = (show: boolean) => {
    if (show) setAuthEnabled(true)
    setShowAuth(show)
  }

  useEffect(() => {
    if (!authEnabled) return
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    import('@shared/utils/supabase')
      .then(({ getCurrentUser, onAuthStateChange, supabase }) => {
        if (cancelled) return

        getCurrentUser()
          .then((user) => {
            if (!cancelled) {
              setSession(user)
              setIsLoading(false)
            }
          })
          .catch(() => {
            if (!cancelled) {
              setSession(null)
              setIsLoading(false)
            }
          })

        const {
          data: { subscription },
        } = onAuthStateChange(async (event, session) => {
          const isRecoveryFlow = localStorage.getItem('@dosiq/recovery-flow')
          if (event === 'PASSWORD_RECOVERY' || isRecoveryFlow === 'true') {
            localStorage.removeItem('@dosiq/recovery-flow')
            setIsPasswordRecovery(true)
            setSession(session?.user ?? null)

            // Limpar o hash da URL para evitar re-gatilhos do fluxo de recuperação em reloads/signouts
            if (window.history && window.history.replaceState) {
              window.history.replaceState(
                null,
                null,
                window.location.pathname + window.location.search
              )
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
                window.history.replaceState(
                  null,
                  null,
                  window.location.pathname + window.location.search
                )
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
            const {
              data: { session: latestSession },
            } = await supabase.auth.getSession()
            setSession(latestSession?.user ?? null)
            return
          }
          setSession(session?.user ?? null)
        })
        unsubscribe = () => subscription.unsubscribe()
      })
      .catch((error) => {
        if (cancelled) return
        // Chunk do Supabase indisponível (deploy novo, offline): 1 reload protegido; se já
        // recarregou nesta janela, segue como anônimo em vez de prender no spinner.
        if (handleChunkError()) return
        console.error('Falha ao carregar o módulo de autenticação:', error)
        setSession(null)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [authEnabled])

  if (isLoading) {
    return <AppLoading />
  }

  if (!session) {
    return (
      <PublicShell
        showAuth={showAuth}
        setShowAuth={handleShowAuth}
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
