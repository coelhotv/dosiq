import { describe, it, expect } from 'vitest'
import {
  CHATBOT_DISCLAIMER,
  CHATBOT_QUICK_SUGGESTIONS,
  createWelcomeMessage,
} from '../chatbotUiText'
import * as chatbotIndex from '../index'

// FR-013/PO-7 — textos de UI centralizados no core (web+mobile consomem); guardrails NÃO descem.

describe('chatbotUiText (core)', () => {
  it('exporta disclaimer não-vazio', () => {
    expect(typeof CHATBOT_DISCLAIMER).toBe('string')
    expect(CHATBOT_DISCLAIMER.length).toBeGreaterThan(10)
  })

  it('chips de sugestão: array não-vazio de strings', () => {
    expect(Array.isArray(CHATBOT_QUICK_SUGGESTIONS)).toBe(true)
    expect(CHATBOT_QUICK_SUGGESTIONS.length).toBeGreaterThan(0)
    expect(CHATBOT_QUICK_SUGGESTIONS.every((s) => typeof s === 'string' && s.length > 0)).toBe(true)
  })

  it('createWelcomeMessage: role assistant + content + timestamp repassado', () => {
    const msg = createWelcomeMessage(123)
    expect(msg.role).toBe('assistant')
    expect(typeof msg.content).toBe('string')
    expect(msg.content.length).toBeGreaterThan(0)
    expect(msg.timestamp).toBe(123)
  })

  it('createWelcomeMessage: NÃO embute o disclaimer (banner cobre — FR-016)', () => {
    expect(createWelcomeMessage().content).not.toContain(CHATBOT_DISCLAIMER)
  })

  it('reexportado por @dosiq/core/chatbot index', () => {
    expect(chatbotIndex.CHATBOT_DISCLAIMER).toBe(CHATBOT_DISCLAIMER)
    expect(chatbotIndex.createWelcomeMessage).toBe(createWelcomeMessage)
    expect(chatbotIndex.CHATBOT_QUICK_SUGGESTIONS).toBe(CHATBOT_QUICK_SUGGESTIONS)
  })

  it('módulo de UI NÃO vaza guardrails (systemPrompt/safetyGuard/BLOCKED) — AP-237', () => {
    expect((chatbotIndex as any).buildSystemPrompt).toBeUndefined()
    expect((chatbotIndex as any).CHATBOT_BLOCKED_PATTERNS).toBeUndefined()
    expect((chatbotIndex as any).safetyGuard).toBeUndefined()
  })
})
