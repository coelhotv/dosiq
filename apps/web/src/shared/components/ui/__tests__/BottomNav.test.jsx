import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BottomNav from '@/shared/components/ui/BottomNavRedesign'

describe('BottomNav', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza 5 tabs principais', () => {
    render(<BottomNav currentView="dashboard" setCurrentView={vi.fn()} />)

    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getByText('Tratamento')).toBeInTheDocument()
    expect(screen.getByText('Estoque')).toBeInTheDocument()
    expect(screen.getByText('Avisos')).toBeInTheDocument()
    expect(screen.getByText('Perfil')).toBeInTheDocument()
  })

  it('marca tab ativa com classe bnr-item--active', () => {
    render(<BottomNav currentView="stock" setCurrentView={vi.fn()} />)

    const stockButton = screen.getByText('Estoque').closest('button')
    const dashboardButton = screen.getByText('Hoje').closest('button')

    expect(stockButton).toHaveClass('bnr-item--active')
    expect(dashboardButton).not.toHaveClass('bnr-item--active')
  })

  it('chama setCurrentView ao clicar em tab', () => {
    const setCurrentView = vi.fn()
    render(<BottomNav currentView="dashboard" setCurrentView={setCurrentView} />)

    fireEvent.click(screen.getByText('Tratamento'))
    expect(setCurrentView).toHaveBeenCalledWith('treatment')
  })

  it('renderiza badge de avisos quando há notificações não lidas', () => {
    render(<BottomNav currentView="dashboard" setCurrentView={vi.fn()} unreadCount={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('nao renderiza tabs antigos (medicines, protocols, history, settings)', () => {
    render(<BottomNav currentView="dashboard" setCurrentView={vi.fn()} />)

    expect(screen.queryByText('Medicamentos')).not.toBeInTheDocument()
    expect(screen.queryByText('Protocolos')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Hist/)).not.toBeInTheDocument()
  })
})
