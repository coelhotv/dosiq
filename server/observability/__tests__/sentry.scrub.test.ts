import { describe, it, expect, afterEach, vi } from 'vitest'
import { scrubEvent, redactText, type SentryEventLike } from '../sentry.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('redactText', () => {
  it('redige e-mail, sequências longas de dígitos e token de bot do Telegram', () => {
    expect(redactText('contato paciente@exemplo.com.br falhou')).toBe('contato [email] falhou')
    expect(redactText('chat_id 123456789 sem canal')).toBe('chat_id [num] sem canal')
    expect(redactText('token 8123456789:AAH1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7')).toBe('token [tg-token]')
  })

  it('trunca texto em 2000 caracteres', () => {
    expect(redactText('x'.repeat(5000))).toHaveLength(2000)
  })

  it('não altera texto sem PII', () => {
    expect(redactText('ETIMEDOUT ao falar com Expo')).toBe('ETIMEDOUT ao falar com Expo')
  })
})

describe('scrubEvent', () => {
  it('devolve null/undefined intactos', () => {
    expect(scrubEvent(null)).toBeNull()
    expect(scrubEvent(undefined)).toBeUndefined()
  })

  it('remove request por completo (headers/cookies/body do webhook do bot)', () => {
    const ev: SentryEventLike = { request: { data: 'tomei 2 comprimidos de Rivotril 08:00', headers: { authorization: 'Bearer x' } } }
    expect(scrubEvent(ev).request).toBeUndefined()
  })

  it('reduz user ao id interno e descarta o resto', () => {
    expect(scrubEvent({ user: { id: 42, email: 'p@x.com', username: 'paciente' } }).user).toEqual({ id: '42' })
  })

  it('descarta user sem id', () => {
    expect(scrubEvent({ user: { email: 'p@x.com' } }).user).toBeUndefined()
  })

  it('aplica allowlist estrita em extra (mantém correlationId, dropa domínio clínico)', () => {
    const ev: SentryEventLike = {
      extra: { correlationId: 'abc-123', job: 'reminders', medicationName: 'Insulina', doseTime: '08:00', body: 'texto' },
    }
    expect(scrubEvent(ev).extra).toEqual({ correlationId: 'abc-123', job: 'reminders' })
  })

  it('aplica allowlist em tags', () => {
    expect(scrubEvent({ tags: { kind: 'dose', patientName: 'Maria' } }).tags).toEqual({ kind: 'dose' })
  })

  it('mantém contextos padrão do SDK e remove contexto custom', () => {
    const ev: SentryEventLike = { contexts: { runtime: { name: 'node' }, patient: { name: 'Maria', dose: '5mg' } } }
    expect(scrubEvent(ev).contexts).toEqual({ runtime: { name: 'node' } })
  })

  it('remove breadcrumbs por completo', () => {
    const ev: SentryEventLike = { breadcrumbs: [{ message: 'registrou dose de Rivotril' }] }
    expect(scrubEvent(ev).breadcrumbs).toBeUndefined()
  })

  it('redige PII residual em message e exception.values[].value', () => {
    const ev: SentryEventLike = {
      message: 'falha ao notificar paciente@x.com',
      exception: { values: [{ value: 'chat_id 987654321 rejeitado' }] },
    }
    const out = scrubEvent(ev)
    expect(out.message).toBe('falha ao notificar [email]')
    expect(out.exception?.values?.[0]?.value).toBe('chat_id [num] rejeitado')
  })

  it('remove código-fonte (pre/post_context, context_line) e vars locais dos frames', () => {
    const ev: SentryEventLike = {
      exception: {
        values: [{
          value: 'boom',
          stacktrace: {
            frames: [{
              filename: 'x.ts',
              context_line: "  const medicationName = 'Insulina'",
              pre_context: ['linha antes com dose 5mg'],
              post_context: ['linha depois'],
              vars: { medicationName: 'Insulina', doseTime: '08:00' },
            }],
          },
        }],
      },
    }
    const frame = scrubEvent(ev).exception!.values![0].stacktrace!.frames![0]
    expect(frame.context_line).toBeUndefined()
    expect(frame.pre_context).toBeUndefined()
    expect(frame.post_context).toBeUndefined()
    expect(frame.vars).toBeUndefined()
    expect(frame.filename).toBe('x.ts')
  })

  it('evento sem campos sensíveis passa sem alteração de conteúdo', () => {
    const ev: SentryEventLike = { message: 'ETIMEDOUT', extra: { correlationId: 'x' }, level: 'error' }
    expect(scrubEvent(ev)).toEqual({ message: 'ETIMEDOUT', extra: { correlationId: 'x' }, level: 'error' })
  })
})
