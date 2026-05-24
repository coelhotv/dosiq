// createProfileRepository.js — Factory CRUD canônico de perfil (Fase 4 G2).
//
// Perfil vive em public.user_settings (1 linha por user, chave user_id UNIQUE).
// Web e mobile injetam: client Supabase + getUserId. Validação Zod canônica via
// @dosiq/core userProfileSchema.
//
// "Densidade da interface" (Configurações) NÃO tem coluna própria — mapeia em
// `complexity_override` ('simple' | 'complex' | NULL=auto), reusando a persona
// logic existente (R-152/R-183). updateComplexity expõe esse controle.
//
// Métodos:
// - getProfile()              → linha de perfil (default object se ausente)
// - updateProfile(input)      → valida + upsert campos de perfil (onConflict user_id)
// - updateComplexity(value)   → upsert complexity_override ('simple'|'complex'|null)
// - deleteAccount()           → RPC delete_user_account (bloqueia se tratamentos ativos)

import { validateUserProfile } from '../schemas/userProfileSchema.js'
import { getServerTimestamp } from '../utils/dateUtils.js'

// Colunas de perfil lidas/escritas (R-127: só o necessário).
const PROFILE_COLUMNS = 'display_name, birth_date, city, state, phone, complexity_override'

const COMPLEXITY_VALUES = Object.freeze(['simple', 'complex', null])

function formatValidationError(errors) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

function emptyProfile() {
  return {
    display_name: null,
    birth_date: null,
    city: null,
    state: null,
    phone: null,
    complexity_override: null,
  }
}

/**
 * Cria um repositório de perfil parametrizado por plataforma.
 *
 * @param {Object} deps
 * @param {Object} deps.client       Cliente Supabase.
 * @param {Function} deps.getUserId  Async () => string. Resolve user_id da sessão.
 * @returns {{
 *   getProfile: () => Promise<Object>,
 *   updateProfile: (input: Object) => Promise<Object>,
 *   updateComplexity: (value: 'simple'|'complex'|null) => Promise<Object>,
 *   deleteAccount: () => Promise<any>,
 * }}
 */
export function createProfileRepository({ client, getUserId }) {
  if (!client) throw new Error('createProfileRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createProfileRepository: getUserId deve ser função async')
  }

  const repo = {
    async getProfile() {
      const userId = await getUserId()
      const { data, error } = await client
        .from('user_settings')
        .select(PROFILE_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      // Default object quando ainda não há linha (usuário novo sem perfil).
      return data ?? emptyProfile()
    },

    async updateProfile(input) {
      const validation = validateUserProfile(input)
      if (!validation.success) throw formatValidationError(validation.errors)

      const userId = await getUserId()
      const { data, error } = await client
        .from('user_settings')
        .upsert(
          { user_id: userId, ...validation.data, updated_at: getServerTimestamp() },
          { onConflict: 'user_id' },
        )
        .select(PROFILE_COLUMNS)
        .single()

      if (error) throw error
      return data
    },

    async updateComplexity(value) {
      if (!COMPLEXITY_VALUES.includes(value)) {
        throw new Error("complexity_override deve ser 'simple', 'complex' ou null")
      }

      const userId = await getUserId()
      const { data, error } = await client
        .from('user_settings')
        .upsert(
          { user_id: userId, complexity_override: value, updated_at: getServerTimestamp() },
          { onConflict: 'user_id' },
        )
        .select(PROFILE_COLUMNS)
        .single()

      if (error) throw error
      return data
    },

    async deleteAccount() {
      // RPC SECURITY DEFINER: valida posse via auth.uid() e bloqueia se houver
      // tratamentos ativos (ver migration delete_user_account — W3).
      const { data, error } = await client.rpc('delete_user_account')
      if (error) throw error
      return data
    },
  }

  return repo
}
