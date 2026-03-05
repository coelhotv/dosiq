import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdaptiveLayout from '../AdaptiveLayout'

afterEach(() => {
  vi.clearAllMocks()
})

describe('AdaptiveLayout', () => {
  it('aplica classe --simple para modo simple', () => {
    const { container } = render(<AdaptiveLayout mode="simple"><span>filho</span></AdaptiveLayout>)
    expect(container.querySelector('.adaptive-layout--simple')).toBeTruthy()
  })

  it('aplica classe --moderate para modo moderate', () => {
    const { container } = render(<AdaptiveLayout mode="moderate"><span>filho</span></AdaptiveLayout>)
    expect(container.querySelector('.adaptive-layout--moderate')).toBeTruthy()
  })

  it('aplica classe --complex para modo complex', () => {
    const { container } = render(<AdaptiveLayout mode="complex"><span>filho</span></AdaptiveLayout>)
    expect(container.querySelector('.adaptive-layout--complex')).toBeTruthy()
  })

  it('renderiza children corretamente', () => {
    render(<AdaptiveLayout mode="simple"><span>conteúdo</span></AdaptiveLayout>)
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })
})
