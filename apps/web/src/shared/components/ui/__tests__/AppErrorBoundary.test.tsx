import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppErrorBoundary } from '../AppErrorBoundary'

function ProblemChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Falha simulada de import ou renderização')
  }
  return <div>Conteúdo normal carregado</div>
}

describe('AppErrorBoundary (Spec 110 / AC-4)', () => {
  let originalError: typeof console.error
  let reloadMock: any

  beforeEach(() => {
    originalError = console.error
    console.error = vi.fn()
    reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    })
  })

  afterEach(() => {
    console.error = originalError
  })

  it('renderiza os filhos normalmente quando não há erro', () => {
    render(
      <AppErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </AppErrorBoundary>
    )

    expect(screen.getByText('Conteúdo normal carregado')).toBeInTheDocument()
  })

  it('captura erro de renderização e exibe interface recuperável com botão de recarregar', () => {
    render(
      <AppErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </AppErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível carregar esta tela')).toBeInTheDocument()

    const reloadBtn = screen.getByRole('button', { name: /recarregar página/i })
    expect(reloadBtn).toBeInTheDocument()

    fireEvent.click(reloadBtn)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('renderiza fallback customizado quando fornecido', () => {
    render(
      <AppErrorBoundary fallback={<div>Fallback customizado</div>}>
        <ProblemChild shouldThrow={true} />
      </AppErrorBoundary>
    )

    expect(screen.getByText('Fallback customizado')).toBeInTheDocument()
    expect(screen.queryByText('Não foi possível carregar esta tela')).not.toBeInTheDocument()
  })
})
