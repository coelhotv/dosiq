import { Component, type ErrorInfo, type ReactNode } from 'react'
import './AppErrorBoundary.css'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AppErrorBoundary] Erro capturado na árvore React:', error, errorInfo)
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div role="alert" className="app-error-boundary">
          <div className="app-error-boundary__card">
            <div className="app-error-boundary__icon" aria-hidden="true">
              ⚠️
            </div>
            <h2 className="app-error-boundary__title">
              Não foi possível carregar esta tela
            </h2>
            <p className="app-error-boundary__message">
              Pode ter ocorrido uma atualização recente no sistema ou uma oscilação na conexão com a internet.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="app-error-boundary__btn"
            >
              Recarregar página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AppErrorBoundary
