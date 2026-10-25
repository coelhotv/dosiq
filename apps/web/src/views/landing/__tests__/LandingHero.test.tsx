import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LandingHero from '../LandingHero'

describe('LandingHero — App-First (Spec 111 PO-111-1 / PO-111-4)', () => {
  it('renderiza os 2 links de loja com ct=atf e utm_campaign=atf e NÃO renderiza "Criar conta grátis" como primário', () => {
    const onOpenAuth = vi.fn()
    render(<LandingHero isAuthenticated={false} onOpenAuth={onOpenAuth} />)

    // Não pode ter "Criar conta grátis"
    expect(screen.queryByRole('button', { name: /Criar conta grátis/i })).toBeNull()

    // Links de loja no Hero ATF
    const iosLink = screen.getByRole('link', { name: /Baixar na App Store/i })
    const androidLink = screen.getByRole('link', { name: /Disponível no Google Play/i })

    expect(iosLink.getAttribute('href')).toContain('pt=128807500')
    expect(iosLink.getAttribute('href')).toContain('ct=landing_home_atf')
    expect(iosLink.getAttribute('href')).not.toContain('utm_source=')

    expect(androidLink.getAttribute('href')).toContain(
      'referrer=utm_source%3Dlanding_home%26utm_campaign%3Datf',
    )
    expect(androidLink.getAttribute('href')).not.toMatch(/[?&]utm_source=/)

    // Link secundário para versão web chama onOpenAuth('login')
    const webFallbackBtn = screen.getByRole('button', { name: /Acesse a versão web →/i })
    fireEvent.click(webFallbackBtn)
    expect(onOpenAuth).toHaveBeenCalledWith('login')
  })

  it('renderiza o QR bridge desktop com a imagem estática gerada', () => {
    const { container } = render(<LandingHero isAuthenticated={false} />)

    const qrBridge = container.querySelector('.lp-qr-bridge')
    expect(qrBridge).toBeTruthy()

    const qrImg = qrBridge?.querySelector('img')
    expect(qrImg?.getAttribute('src')).toBe('/badges/qr-baixar.svg')
    expect(qrBridge?.textContent).toContain('Instale no celular')
    expect(qrBridge?.textContent).toContain('Aponte a câmera para baixar o app')
  })

  it('preserva o botão "Abrir meu painel" quando autenticado', () => {
    const onContinue = vi.fn()
    render(<LandingHero isAuthenticated onContinue={onContinue} />)

    const btn = screen.getByRole('button', { name: /Abrir meu painel/i })
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onContinue).toHaveBeenCalled()
  })
})
