// authService.test.js — testes unitários para signUpWithEmail e sendPasswordReset
import { jest } from '@jest/globals'

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      signOut: jest.fn(),
    },
  },
}))

import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { signInWithEmail, signUpWithEmail, sendPasswordReset, signOut } from '../authService'

describe('authService', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('signInWithEmail', () => {
    it('retorna erro quando email é inválido', async () => {
      const result = await signInWithEmail('email-invalido', 'senha123')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email inválido')
    })

    it('retorna erro quando senha está vazia', async () => {
      const result = await signInWithEmail('test@example.com', '')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Senha é obrigatória')
    })

    it('retorna erro traduzido para credenciais inválidas', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      })
      const result = await signInWithEmail('test@example.com', 'senhaerrada')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email ou senha inválidos')
    })

    it('retorna success em login bem-sucedido', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      const result = await signInWithEmail('test@example.com', 'Senha123!')
      expect(result.success).toBe(true)
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Senha123!',
      })
    })

    it('trata erro de rede inesperado com fallback', async () => {
      supabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'))
      const result = await signInWithEmail('test@example.com', 'Senha123!')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Erro inesperado ao fazer login')
    })
  })

  describe('signUpWithEmail', () => {
    it('retorna erro quando email é inválido', async () => {
      const result = await signUpWithEmail('email-invalido', 'Senha123!', 'Senha123!')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email inválido')
    })

    it('retorna erro quando senha tem menos de 8 caracteres', async () => {
      const result = await signUpWithEmail('test@example.com', 'curta', 'curta')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Senha deve ter no mínimo 8 caracteres')
    })

    it('retorna erro quando confirmação de senha é vazia', async () => {
      const result = await signUpWithEmail('test@example.com', 'Senha123!', '')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Confirmação de senha é obrigatória')
    })

    it('retorna erro quando senhas não coincidem', async () => {
      const result = await signUpWithEmail('test@example.com', 'Senha123!', 'SenhaDiferente!')
      expect(result.success).toBe(false)
      expect(result.error).toBe('As senhas não coincidem')
    })

    it('retorna erro PT-BR quando email já está cadastrado', async () => {
      supabase.auth.signUp.mockResolvedValue({
        error: { message: 'User already registered' },
      })
      const result = await signUpWithEmail('test@example.com', 'Senha123!', 'Senha123!')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email já cadastrado. Faça login.')
    })

    it('retorna success em cadastro bem-sucedido', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'novo@example.com' } },
        error: null,
      })
      const result = await signUpWithEmail('novo@example.com', 'Senha123!', 'Senha123!')
      expect(result.success).toBe(true)
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'novo@example.com',
        password: 'Senha123!',
      })
    })

    it('trata erro de rede inesperado com fallback', async () => {
      supabase.auth.signUp.mockRejectedValue(new Error('Network error'))
      const result = await signUpWithEmail('test@example.com', 'Senha123!', 'Senha123!')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Erro inesperado ao criar conta')
    })
  })

  describe('sendPasswordReset', () => {
    it('retorna erro quando email é inválido', async () => {
      const result = await sendPasswordReset('email-invalido')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email inválido')
    })

    it('retorna success após envio de reset (Supabase não revela se email existe)', async () => {
      supabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      })
      const result = await sendPasswordReset('test@example.com')
      expect(result.success).toBe(true)
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com')
    })

    it('retorna erro traduzido para rate limit', async () => {
      supabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'rate limit exceeded' },
      })
      const result = await sendPasswordReset('test@example.com')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Muitas tentativas. Tente novamente mais tarde.')
    })

    it('trata erro de rede inesperado com fallback', async () => {
      supabase.auth.resetPasswordForEmail.mockRejectedValue(new Error('Network error'))
      const result = await sendPasswordReset('test@example.com')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Erro inesperado ao enviar email de recuperação')
    })
  })

  describe('signOut', () => {
    it('retorna success em logout bem-sucedido', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: null })
      const result = await signOut()
      expect(result.success).toBe(true)
    })

    it('retorna failure quando Supabase retorna erro', async () => {
      supabase.auth.signOut.mockResolvedValue({
        error: { message: 'Logout failed' },
      })
      const result = await signOut()
      expect(result.success).toBe(false)
    })

    it('trata exceção inesperada', async () => {
      supabase.auth.signOut.mockRejectedValue(new Error('Network error'))
      const result = await signOut()
      expect(result.success).toBe(false)
    })
  })
})
