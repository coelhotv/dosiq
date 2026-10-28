import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@shared/utils/supabase', () => ({ supabase: {} }))

import { resetPasswordErrorMessage } from '../ResetPasswordView'

describe('resetPasswordErrorMessage', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('senha repetida → pede senha diferente', () => {
    expect(resetPasswordErrorMessage({ code: 'same_password' })).toMatch(/diferente da senha atual/)
  })

  it('senha fraca → orienta a reforçar', () => {
    expect(resetPasswordErrorMessage({ code: 'weak_password' })).toMatch(/Senha fraca/)
  })

  it('sessão do link expirada → pede novo link', () => {
    expect(resetPasswordErrorMessage({ code: 'session_not_found' })).toMatch(/novo link/)
  })

  it('código desconhecido ou ausente → genérico', () => {
    expect(resetPasswordErrorMessage({ code: 'unexpected_failure' })).toBe(
      'Não foi possível atualizar a senha. Tente de novo.'
    )
    expect(resetPasswordErrorMessage({})).toBe('Não foi possível atualizar a senha. Tente de novo.')
  })
})
