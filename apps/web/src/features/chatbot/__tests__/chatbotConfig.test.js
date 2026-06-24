import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/features/chatbot/config/chatbotConfig'

// buildPatientContext migrou p/ @dosiq/core (spec 015 onda 1a) — testado em
// packages/core/src/chatbot/__tests__/buildPatientContext.test.js. Aqui fica só o
// system prompt (regras estáticas + injeção do contexto), que segue no web/config.
describe('buildSystemPrompt', () => {
  it('inclui regras absolutas no prompt', () => {
    const result = buildSystemPrompt('contexto teste')
    expect(result).toContain('REGRAS ABSOLUTAS')
    expect(result).toContain('NUNCA')
  })

  it('inclui contexto do paciente', () => {
    const result = buildSystemPrompt('Metformina 500mg')
    expect(result).toContain('Metformina 500mg')
    expect(result).toContain('DADOS DO PACIENTE')
  })
})
