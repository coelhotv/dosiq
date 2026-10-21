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

import type {
  AuthError,
  User,
  AuthTokenResponsePassword,
  AuthResponse,
} from '@supabase/supabase-js'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { signInWithEmail, signUpWithEmail, sendPasswordReset, signOut } from '../authService'

const mockedAuth = supabase.auth as jest.Mocked<typeof supabase.auth>

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
      mockedAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' } as AuthError,
      } as AuthTokenResponsePassword)
      const result = await signInWithEmail('test@example.com', 'senhaerrada')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email ou senha inválidos')
    })

    it('retorna success em login bem-sucedido', async () => {
      mockedAuth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123' } as User, session: {} },
        error: null,
      } as AuthTokenResponsePassword)
      const result = await signInWithEmail('test@example.com', 'Senha123!')
      expect(result.success).toBe(true)
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Senha123!',
      })
    })

    it('trata erro de rede inesperado com fallback', async () => {
      mockedAuth.signInWithPassword.mockRejectedValue(new Error('Network error'))
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

    // 046 T005 — o opt-in de dado de saúde é CONDIÇÃO de criação da conta. O gate vive no service,
    // não só na tela: assim nenhum outro caller chega ao signUp sem consentimento.
    it('🔴 sem opt-in de dado de saúde a conta NÃO é criada', async () => {
      const result = await signUpWithEmail('test@example.com', 'Senha123!', 'Senha123!')

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/autorizar o tratamento dos dados de saúde/)
      expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('🔴 o opt-in viaja no user_metadata (carona da intenção — quem grava a trilha é o RPC)', async () => {
      mockedAuth.signUp.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'novo@example.com' } as User, session: {} },
        error: null,
      } as AuthResponse)

      await signUpWithEmail('novo@example.com', 'Senha123!', 'Senha123!', { healthConsent: true })

      const options = mockedAuth.signUp.mock.calls[0][0].options as {
        data: { health_consent: boolean; policy_version: string }
      }
      expect(options.data.health_consent).toBe(true)
      expect(options.data.policy_version).toBeTruthy()
    })

    it('retorna erro PT-BR quando email já está cadastrado', async () => {
      mockedAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' } as AuthError,
      } as AuthResponse)
      const result = await signUpWithEmail('test@example.com', 'Senha123!', 'Senha123!', { healthConsent: true })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email já cadastrado. Faça login.')
    })

    it('em produção usa emailRedirectTo https (Universal Link)', async () => {
      const prevDev = (global as unknown as { __DEV__: boolean }).__DEV__;
      (global as unknown as { __DEV__: boolean }).__DEV__ = false
      try {
        mockedAuth.signUp.mockResolvedValue({
          data: { user: { id: 'user-456', email: 'novo@example.com' } as User, session: {} },
          error: null,
        } as AuthResponse)
        const result = await signUpWithEmail('novo@example.com', 'Senha123!', 'Senha123!', { healthConsent: true })
        expect(result.success).toBe(true)
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'novo@example.com',
          password: 'Senha123!',
          options: expect.objectContaining({ emailRedirectTo: 'https://dosiq.app/auth/callback' }),
        })
      } finally {
        (global as unknown as { __DEV__: boolean }).__DEV__ = prevDev
      }
    })

    it('em dev usa o scheme dosiq:// (abre build de dev direto)', async () => {
      const prevDev = (global as unknown as { __DEV__: boolean }).__DEV__;
      (global as unknown as { __DEV__: boolean }).__DEV__ = true
      try {
        mockedAuth.signUp.mockResolvedValue({
          data: { user: { id: 'user-789', email: 'dev@example.com' } as User, session: {} },
          error: null,
        } as AuthResponse)
        await signUpWithEmail('dev@example.com', 'Senha123!', 'Senha123!', { healthConsent: true })
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'dev@example.com',
          password: 'Senha123!',
          options: expect.objectContaining({ emailRedirectTo: 'dosiq://auth/callback' }),
        })
      } finally {
        (global as unknown as { __DEV__: boolean }).__DEV__ = prevDev
      }
    })

    it('trata erro de rede inesperado com fallback', async () => {
      mockedAuth.signUp.mockRejectedValue(new Error('Network error'))
      const result = await signUpWithEmail('test@example.com', 'Senha123!', 'Senha123!', { healthConsent: true })
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
      mockedAuth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      })
      const result = await sendPasswordReset('test@example.com')
      expect(result.success).toBe(true)
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'dosiq://auth/callback' }
      )
    })

    it('retorna erro traduzido para rate limit', async () => {
      mockedAuth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'rate limit exceeded' } as AuthError,
      })
      const result = await sendPasswordReset('test@example.com')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Muitas tentativas. Tente novamente mais tarde.')
    })

    it('trata erro de rede inesperado com fallback', async () => {
      mockedAuth.resetPasswordForEmail.mockRejectedValue(new Error('Network error'))
      const result = await sendPasswordReset('test@example.com')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Erro inesperado ao enviar email de recuperação')
    })
  })

  describe('signOut', () => {
    it('retorna success em logout bem-sucedido', async () => {
      mockedAuth.signOut.mockResolvedValue({ error: null })
      const result = await signOut()
      expect(result.success).toBe(true)
    })

    it('retorna failure quando Supabase retorna erro', async () => {
      mockedAuth.signOut.mockResolvedValue({
        error: { message: 'Logout failed' } as AuthError,
      })
      const result = await signOut()
      expect(result.success).toBe(false)
    })

    it('trata exceção inesperada', async () => {
      mockedAuth.signOut.mockRejectedValue(new Error('Network error'))
      const result = await signOut()
      expect(result.success).toBe(false)
    })
  })
})
