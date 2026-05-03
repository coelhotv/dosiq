import { describe, it, expect, afterEach, vi } from 'vitest'
import { validateUserMessage, addDisclaimerIfNeeded, DISCLAIMER } from '@/features/chatbot/services/safetyGuard'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('validateUserMessage', () => {
  it('bloqueia pergunta sobre dosagem', () => {
    const result = validateUserMessage('qual dosagem devo tomar?')
    expect(result.blocked).toBe(true)
    expect(result.reason).toBeTruthy()
  })

  it('bloqueia pergunta sobre parar tratamento', () => {
    const result = validateUserMessage('posso parar de tomar esse remedio?')
    expect(result.blocked).toBe(true)
  })

  it('bloqueia pergunta sobre suspender tratamento', () => {
    const result = validateUserMessage('posso suspender de tomar agora?')
    expect(result.blocked).toBe(true)
  })

  it('bloqueia pergunta sobre substituicao', () => {
    const result = validateUserMessage('posso substituir metformina por outro?')
    expect(result.blocked).toBe(true)
  })

  it('bloqueia mensagem com diagnostico', () => {
    const result = validateUserMessage('voce pode me dar um diagnostico?')
    expect(result.blocked).toBe(true)
  })

  it('bloqueia mensagem > 500 caracteres', () => {
    const longMessage = 'a'.repeat(501)
    const result = validateUserMessage(longMessage)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('500')
  })

  it('permite pergunta sobre adesao', () => {
    const result = validateUserMessage('como esta minha adesao?')
    expect(result.blocked).toBe(false)
  })

  it('permite pergunta sobre estoque', () => {
    const result = validateUserMessage('quando preciso repor estoque?')
    expect(result.blocked).toBe(false)
  })

  it('permite saudacao', () => {
    const result = validateUserMessage('ola, tudo bem?')
    expect(result.blocked).toBe(false)
  })

  it('permite mensagem com exatamente 500 caracteres', () => {
    const message = 'a'.repeat(500)
    const result = validateUserMessage(message)
    expect(result.blocked).toBe(false)
  })
})

describe('addDisclaimerIfNeeded', () => {
  it('adiciona disclaimer quando resposta menciona medicamento', () => {
    const result = addDisclaimerIfNeeded('Voce tomou o medicamento hoje.')
    expect(result).toContain(DISCLAIMER)
  })

  it('adiciona disclaimer quando resposta menciona dose', () => {
    const result = addDisclaimerIfNeeded('Sua dose foi registrada.')
    expect(result).toContain(DISCLAIMER)
  })

  it('nao duplica disclaimer se ja presente', () => {
    const response = `Voce tomou o medicamento.\n\n_${DISCLAIMER}_`
    const result = addDisclaimerIfNeeded(response)
    // Disclaimer deve aparecer apenas uma vez
    expect(result.split(DISCLAIMER).length - 1).toBe(1)
  })

  it('nao adiciona disclaimer em resposta generica', () => {
    const result = addDisclaimerIfNeeded('Ola, como posso ajudar?')
    expect(result).not.toContain(DISCLAIMER)
  })

  it('adiciona disclaimer quando menciona tratamento', () => {
    const result = addDisclaimerIfNeeded('Seu tratamento esta em dia.')
    expect(result).toContain(DISCLAIMER)
  })
})
