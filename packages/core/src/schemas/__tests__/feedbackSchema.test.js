import { describe, it, expect } from 'vitest'
import { validateFeedbackCreate } from '../feedbackSchema.js'

describe('Feedback Schema Validation', () => {
  it('validates a minimum correct feedback payload', () => {
    const result = validateFeedbackCreate({
      subject: 'Problema no login',
      comment: 'Estava tentando logar e deu um erro inesperado ao digitar a senha.',
      rating: 4,
      platform: 'ios'
    })
    expect(result.success).toBe(true)
    expect(result.data.subject).toBe('Problema no login')
  })

  it('accepts other and android as platforms and optional fields', () => {
    const result = validateFeedbackCreate({
      subject: 'Sugestão de funcionalidade',
      comment: 'Gostaria de ver suporte a mais idiomas.',
      rating: 5,
      platform: 'android',
      device: 'Samsung Galaxy S21',
      app_version: '3.3.0'
    })
    expect(result.success).toBe(true)
    expect(result.data.device).toBe('Samsung Galaxy S21')
    expect(result.data.app_version).toBe('3.3.0')
  })

  it('rejects empty subject', () => {
    const result = validateFeedbackCreate({
      subject: '',
      comment: 'Comentário legal',
      rating: 3,
      platform: 'other'
    })
    expect(result.success).toBe(false)
    expect(result.errors.some(e => e.field === 'subject')).toBe(true)
  })

  it('rejects subject longer than 100 characters', () => {
    const result = validateFeedbackCreate({
      subject: 'a'.repeat(101),
      comment: 'Comentário legal',
      rating: 3,
      platform: 'other'
    })
    expect(result.success).toBe(false)
    expect(result.errors.find(e => e.field === 'subject').message).toContain('mais de 100 caracteres')
  })

  it('rejects empty comment', () => {
    const result = validateFeedbackCreate({
      subject: 'Assunto',
      comment: '',
      rating: 3,
      platform: 'other'
    })
    expect(result.success).toBe(false)
    expect(result.errors.some(e => e.field === 'comment')).toBe(true)
  })

  it('rejects comment longer than 2000 characters', () => {
    const result = validateFeedbackCreate({
      subject: 'Assunto',
      comment: 'a'.repeat(2001),
      rating: 3,
      platform: 'other'
    })
    expect(result.success).toBe(false)
    expect(result.errors.find(e => e.field === 'comment').message).toContain('mais de 2000 caracteres')
  })

  it('rejects invalid rating values', () => {
    const lowerRating = validateFeedbackCreate({
      subject: 'Assunto',
      comment: 'Comentário',
      rating: 0,
      platform: 'ios'
    })
    expect(lowerRating.success).toBe(false)

    const higherRating = validateFeedbackCreate({
      subject: 'Assunto',
      comment: 'Comentário',
      rating: 6,
      platform: 'ios'
    })
    expect(higherRating.success).toBe(false)

    const nonIntRating = validateFeedbackCreate({
      subject: 'Assunto',
      comment: 'Comentário',
      rating: 4.5,
      platform: 'ios'
    })
    expect(nonIntRating.success).toBe(false)
  })

  it('rejects unsupported platform values', () => {
    const result = validateFeedbackCreate({
      subject: 'Assunto',
      comment: 'Comentário',
      rating: 3,
      platform: 'web'
    })
    expect(result.success).toBe(false)
    expect(result.errors.some(e => e.field === 'platform')).toBe(true)
  })
})
