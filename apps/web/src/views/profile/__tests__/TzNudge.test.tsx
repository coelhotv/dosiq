// TzNudge.test.jsx — convite passivo de fuso horário (F4.3f.0)
// Framework: Vitest (@dosiq/web)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TzNudgeBase from '../TzNudge'
const TzNudge = TzNudgeBase as any

describe('TzNudge', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('isDismissed reflete a flag de localStorage', () => {
    expect(TzNudge.isDismissed()).toBe(false)
    localStorage.setItem(TzNudge.DISMISS_KEY, '1')
    expect(TzNudge.isDismissed()).toBe(true)
  })

  it('CTA navega para as Configurações da conta', () => {
    const onNavigate = vi.fn()
    render(<TzNudge onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Ajustar fuso horário'))
    expect(onNavigate).toHaveBeenCalledWith('account-settings')
  })

  it('dispensar persiste a flag e chama onDismiss', () => {
    const onDismiss = vi.fn()
    render(<TzNudge onNavigate={vi.fn()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('Dispensar aviso'))
    expect(onDismiss).toHaveBeenCalled()
    expect(localStorage.getItem(TzNudge.DISMISS_KEY)).toBe('1')
  })
})
