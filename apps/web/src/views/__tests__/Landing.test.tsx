import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'
import Landing from '../landing/Landing'

describe('Landing — rodapé S11 (spec 096)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('identifica a PJ operadora com razão social, CNPJ, sede e contato', () => {
    const { container } = render(
      <Landing isAuthenticated={false} onOpenAuth={() => {}} onContinue={() => {}} />
    )
    const legal = container.querySelector('.lp-footer__legal') as HTMLElement

    expect(legal?.textContent).toContain('DOSIQ DIGITAL HEALTH WEB DESIGN LTDA')
    expect(legal?.textContent).toContain('CNPJ 68.335.606/0001-11')
    expect(legal?.textContent).toContain('Rua Pais Leme, 215, cj 1713')
    expect(within(legal).getByRole('link', { name: 'privacidade@dosiq.app' })).toHaveAttribute(
      'href',
      'mailto:privacidade@dosiq.app'
    )
    for (const [name, href] of [
      ['Política de Privacidade', '/politica-de-privacidade.html'],
      ['Termos de Uso', '/termos-de-uso.html'],
    ]) {
      const link = within(legal).getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})
