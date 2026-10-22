import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('exibe os links oficiais ativos para App Store e Google Play com UTM de atribuição', () => {
    render(<Landing />)
    const iosLink = screen.getByRole('link', { name: /Baixar na App Store/i })
    const androidLink = screen.getByRole('link', { name: /Disponível no Google Play/i })

    expect(iosLink.getAttribute('href')).toContain('apps.apple.com')
    expect(iosLink.getAttribute('href')).toContain('utm_source=landing_home')
    expect(androidLink.getAttribute('href')).toBe(
      'https://play.google.com/store/apps/details?id=com.coelhotv.dosiq&utm_source=landing_home',
    )
  })

  it('não contém strings legadas (WhatsApp, Telegram Bot, Android em breve ou Quero testar)', () => {
    const { container } = render(<Landing />)
    const text = container.textContent || ''

    expect(text).not.toMatch(/WhatsApp/i)
    expect(text).not.toMatch(/Telegram Bot/i)
    expect(text).not.toMatch(/Android em breve/i)
    expect(text).not.toMatch(/Quero testar/i)
  })

  it('dispara onOpenAuth com "signup" ou "login" contextualmente ao clicar nos CTAs', () => {
    const onOpenAuth = vi.fn()
    render(<Landing isAuthenticated={false} onOpenAuth={onOpenAuth} />)

    const loginBtn = screen.getByRole('button', { name: /^Entrar$/i })
    fireEvent.click(loginBtn)
    expect(onOpenAuth).toHaveBeenCalledWith('login')

    const existingAccountBtn = screen.getByRole('button', { name: /Já tenho conta — entrar/i })
    fireEvent.click(existingAccountBtn)
    expect(onOpenAuth).toHaveBeenCalledWith('login')

    const signupBtn = screen.getByRole('button', { name: /^Criar conta$/i })
    fireEvent.click(signupBtn)
    expect(onOpenAuth).toHaveBeenCalledWith('signup')
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
})
