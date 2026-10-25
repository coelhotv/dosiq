import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Landing from '../Landing'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('Landing SPA Web (Spec 048 Slice A / v0.34.0)', () => {
  it('renderiza o novo H1 "Nunca mais erre uma dose."', () => {
    render(<Landing />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toContain('Nunca mais erre uma')
    expect(heading.textContent).toContain('dose')
  })

  it('exibe dosagens farmacologicamente precisas no mockup do app (espelhando mobile)', () => {
    render(<Landing />)
    expect(screen.getByText('Semaglutida 1,7 mg')).toBeTruthy()
    expect(screen.getByText('Degrau 4 de 5 · sobe em 2 semanas')).toBeTruthy()
    expect(screen.getByText('Losartana 50 mg')).toBeTruthy()
    expect(screen.getByText('Metformina 850 mg')).toBeTruthy()
    expect(screen.getByText('Sinvastatina 20 mg')).toBeTruthy()
  })

  it('exibe os dois cards de escopo no hero (Comprimidos e Caneta com link /glp-1)', () => {
    render(<Landing />)
    expect(screen.getByText('Comprimidos')).toBeTruthy()
    expect(screen.getByText('Caneta')).toBeTruthy()
    const glp1Link = screen.getAllByRole('link', { name: /Ver como funciona →|Tratamento com caneta/i })
    expect(glp1Link.length).toBeGreaterThanOrEqual(1)
    expect(glp1Link.some((l) => l.getAttribute('href') === '/glp-1')).toBe(true)
  })

  it('renderiza a faixa wedge de canetas injetáveis com CTA para /glp-1', () => {
    render(<Landing />)
    expect(screen.getByText('Faz tratamento com caneta injetável?')).toBeTruthy()
    const cta = screen.getByRole('link', { name: /Entenda o progresso dos tratamentos →/i })
    expect(cta.getAttribute('href')).toBe('/glp-1')
  })

  it('renderiza os 8 diferenciais da v0.34.0 em funcionalidades', () => {
    render(<Landing />)
    expect(screen.getByText('Código de Barras ANVISA')).toBeTruthy()
    expect(screen.getByText('Titulação de Doses')).toBeTruthy()
    expect(screen.getByText('Mapa do Corpo (Rodízio)')).toBeTruthy()
    expect(screen.getByText('Alarme Crítico no Silencioso')).toBeTruthy()
    expect(screen.getByText('PDF Clínico para o Médico')).toBeTruthy()
    expect(screen.getByText('Biomarcadores Integrados')).toBeTruthy()
    expect(screen.getByText('Estoque Opcional pela Caixa')).toBeTruthy()
    expect(screen.getByText('Privacidade & Portabilidade')).toBeTruthy()
  })

  it('exibe os links oficiais ativos para App Store e Google Play no formato D4', () => {
    const { container } = render(<Landing />)
    const iosLinks = screen.getAllByRole('link', { name: /Baixar na App Store/i })
    const androidLinks = screen.getAllByRole('link', { name: /Disponível no Google Play/i })

    expect(iosLinks.length).toBeGreaterThanOrEqual(1)
    expect(androidLinks.length).toBeGreaterThanOrEqual(1)

    // Todos os links da Apple devem ter pt=128807500 e ct=landing_home_...
    for (const link of iosLinks) {
      const href = link.getAttribute('href') || ''
      expect(href).toContain('apps.apple.com/br/app/id6762740948')
      expect(href).toContain('pt=128807500')
      expect(href).toMatch(/ct=landing_home_(atf|section|final|header|sticky|qr)/)
      expect(href).not.toContain('utm_source=')
    }

    // Todos os links da Play devem ter referrer codificado com landing_home e utm_campaign
    for (const link of androidLinks) {
      const href = link.getAttribute('href') || ''
      expect(href).toContain('play.google.com/store/apps/details?id=com.coelhotv.dosiq')
      expect(href).toContain('referrer=utm_source%3Dlanding_home%26utm_campaign%3D')
      expect(href).not.toMatch(/[?&]utm_source=/)
    }

    // Rodapé legal intacto (INV-1 / US3)
    const text = container.textContent || ''
    expect(text).toContain('68.335.606/0001-11')
    expect(text).toContain('DOSIQ DIGITAL HEALTH WEB DESIGN LTDA')
  })

  it('não contém strings legadas (WhatsApp, Telegram Bot, Android em breve ou Quero testar)', () => {
    const { container } = render(<Landing />)
    const text = container.textContent || ''

    expect(text).not.toMatch(/WhatsApp/i)
    expect(text).not.toMatch(/Telegram Bot/i)
    expect(text).not.toMatch(/Android em breve/i)
    expect(text).not.toMatch(/Quero testar/i)
  })

  it('dispara onOpenAuth com "login" contextualmente ao clicar em Acessar Web ou no fallback web', () => {
    const onOpenAuth = vi.fn()
    render(<Landing isAuthenticated={false} onOpenAuth={onOpenAuth} />)

    const accessWebBtn = screen.getByRole('button', { name: /Acessar Web/i })
    fireEvent.click(accessWebBtn)
    expect(onOpenAuth).toHaveBeenCalledWith('login')

    const webFallbackBtn = screen.getByRole('button', { name: /Acesse a versão web →/i })
    fireEvent.click(webFallbackBtn)
    expect(onOpenAuth).toHaveBeenCalledWith('login')
  })

  it('renderiza os links do botão Instalar App no header para desktop e mobile', () => {
    render(<Landing isAuthenticated={false} />)
    const installLinks = screen.getAllByRole('link', { name: /Instalar App/i })
    expect(installLinks.length).toBe(2)

    const desktopLink = installLinks.find((l) =>
      l.classList.contains('lp-btn--header-install-desktop'),
    )
    const mobileLink = installLinks.find((l) =>
      l.classList.contains('lp-btn--header-install-mobile'),
    )

    expect(desktopLink?.getAttribute('href')).toBe('#app')
    expect(mobileLink?.getAttribute('href')).toBe('/baixar?ct=header')
  })

  it('controla a visibilidade da sticky bar mobile através do IntersectionObserver com cleanup', () => {
    let observerCallback: (entries: { isIntersecting: boolean }[]) => void = () => {}
    const disconnectMock = vi.fn()
    const observeMock = vi.fn()

    class MockIntersectionObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        observerCallback = callback
      }
      observe = observeMock
      disconnect = disconnectMock
      unobserve = vi.fn()
    }

    const originalIO = window.IntersectionObserver
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

    try {
      const { container, unmount } = render(<Landing isAuthenticated={false} />)
      const sticky = container.querySelector('.lp-mobile-sticky-bar')
      expect(sticky).toBeTruthy()

      // Inicialmente oculta
      expect(sticky?.classList.contains('lp-mobile-sticky-bar--visible')).toBe(false)
      expect(sticky?.getAttribute('aria-hidden')).toBe('true')

      // Quando o Hero sai da tela (isIntersecting: false), a sticky aparece
      act(() => {
        observerCallback([{ isIntersecting: false }])
      })
      expect(sticky?.classList.contains('lp-mobile-sticky-bar--visible')).toBe(true)
      expect(sticky?.getAttribute('aria-hidden')).toBe('false')

      // Quando o Hero volta (isIntersecting: true), a sticky oculta
      act(() => {
        observerCallback([{ isIntersecting: true }])
      })
      expect(sticky?.classList.contains('lp-mobile-sticky-bar--visible')).toBe(false)
      expect(sticky?.getAttribute('aria-hidden')).toBe('true')

      // Link da sticky aponta para /baixar?ct=sticky
      const stickyBtn = sticky?.querySelector('a')
      expect(stickyBtn?.getAttribute('href')).toBe('/baixar?ct=sticky')

      // Cleanup no unmount (R-078)
      unmount()
      expect(disconnectMock).toHaveBeenCalled()
    } finally {
      window.IntersectionObserver = originalIO
    }
  })

  it('mantém a sticky bar oculta (fail-closed) quando IntersectionObserver é indefinido (RC3 E-5)', () => {
    const originalIO = window.IntersectionObserver
    ;(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = undefined

    try {
      const { container } = render(<Landing isAuthenticated={false} />)
      const sticky = container.querySelector('.lp-mobile-sticky-bar')
      expect(sticky?.classList.contains('lp-mobile-sticky-bar--visible')).toBe(false)
      expect(sticky?.getAttribute('aria-hidden')).toBe('true')
    } finally {
      window.IntersectionObserver = originalIO
    }
  })

  it('dispara onContinue ao clicar nos CTAs quando autenticado', () => {
    const onContinue = vi.fn()
    render(<Landing isAuthenticated onContinue={onContinue} />)

    const buttons = screen.getAllByRole('button', { name: /Abrir painel|Abrir meu painel/i })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(buttons[0])
    expect(onContinue).toHaveBeenCalled()
  })

  it('preserva os dados da pessoa jurídica (Spec 096 B1) com CNPJ no rodapé', () => {
    render(<Landing />)
    expect(
      screen.getByText(/DOSIQ DIGITAL HEALTH WEB DESIGN LTDA · CNPJ 68\.335\.606\/0001-11/),
    ).toBeTruthy()
    expect(
      screen.getByText(/Rua Pais Leme, 215, cj 1713, Pinheiros, São Paulo\/SP, CEP 05424-150/),
    ).toBeTruthy()
  })

  it('exibe a matriz de crosslinks temáticos no rodapé da landing', () => {
    render(<Landing />)
    expect(screen.getByRole('link', { name: /Titulação de Doses GLP-1/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Rodízio de Aplicação/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Dose Semanal Esquecida/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Validade da Caneta Aberta/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Insulina e Diário de Glicemia/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Remédio de 8 em 8 Horas/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Injeção Mensal \(30 dias\)/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Alarme no Silencioso/i })).toBeTruthy()
  })
})
