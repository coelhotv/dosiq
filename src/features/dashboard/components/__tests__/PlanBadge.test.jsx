import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlanBadge from '../PlanBadge'

afterEach(() => {
  vi.clearAllMocks()
})

describe('PlanBadge', () => {
  it('renderiza emoji correto', () => {
    render(<PlanBadge emoji="🫀" color="var(--color-error)" />)
    expect(screen.getByText('🫀')).toBeInTheDocument()
  })

  it('aplica cor como CSS custom property', () => {
    const { container } = render(<PlanBadge emoji="🫀" color="var(--color-error)" />)
    const badge = container.querySelector('.plan-badge')
    expect(badge.style.getPropertyValue('--badge-color')).toBe('var(--color-error)')
  })

  it('mostra title com planName', () => {
    const { container } = render(
      <PlanBadge emoji="🫀" color="var(--color-error)" planName="Cardiovascular" />
    )
    expect(container.querySelector('[title="Cardiovascular"]')).toBeTruthy()
  })

  it('chama onClick ao clicar', () => {
    const onClick = vi.fn()
    render(<PlanBadge emoji="🫀" color="var(--color-error)" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('sem role=button quando não tem onClick', () => {
    render(<PlanBadge emoji="🫀" color="var(--color-error)" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('aplica tamanho sm e md via classe CSS', () => {
    const { container: c1 } = render(<PlanBadge emoji="🫀" color="red" size="sm" />)
    const { container: c2 } = render(<PlanBadge emoji="🫀" color="red" size="md" />)
    expect(c1.querySelector('.plan-badge--sm')).toBeTruthy()
    expect(c2.querySelector('.plan-badge--md')).toBeTruthy()
  })
})
