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
import { getServerTimestamp, getTodayLocal } from '../utils/dateUtils.js'

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
 *   getDeletionSummary: () => Promise<{activeTreatments:number, medicines:number, doses:number, treatmentPlanNames:string[]}>,
 *   isOnboardingNeeded: () => Promise<boolean>,
 *   completeOnboarding: () => Promise<void>,
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

    async getDeletionSummary() {
      // Contagens para o sheet de exclusão (o que será apagado + bloqueio).
      // activeTreatments espelha o critério do RPC: active=true e dentro do
      // período (end_date nulo ou futuro).
      const userId = await getUserId()
      const today = getTodayLocal()

      const [activeRes, medsRes, dosesRes, plansRes] = await Promise.all([
        client
          .from('protocols')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('active', true)
          .or(`end_date.is.null,end_date.gte.${today}`),
        client
          .from('medicines')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        client
          .from('medicine_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        client
          .from('treatment_plans')
          .select('name')
          .eq('user_id', userId),
      ])

      const firstError = activeRes.error || medsRes.error || dosesRes.error || plansRes.error
      if (firstError) throw firstError

      return {
        activeTreatments: activeRes.count ?? 0,
        medicines: medsRes.count ?? 0,
        doses: dosesRes.count ?? 0,
        treatmentPlanNames: (plansRes.data ?? []).map((p) => p.name).filter(Boolean),
      }
    },

    async isOnboardingNeeded() {
      // Gate de primeiro acesso (Fase 4 S4.2). Sem migration: a flag
      // onboarding_completed manda; na ausência dela, contamos tratamentos —
      // usuários existentes (com protocols) NÃO devem cair no onboarding.
      const userId = await getUserId()
      const { data, error } = await client
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (data?.onboarding_completed === true) return false

      const { count, error: pErr } = await client
        .from('protocols')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (pErr) throw pErr
      return (count ?? 0) === 0
    },

    async captureDeviceTimezone(timezone) {
      // F4.3f.0: captura do fuso real do device no PRIMEIRO ponto determinístico
      // da conta (confirmação de signup), ANTES do onboarding — cobre quem pula o
      // wizard e deixa o tz pronto para a geração do 1º tratamento (passo 3) no
      // fuso correto. Grava só quando vier um tz válido (resolvido pelo caller).
      // GATE de plataforma: chamar SOMENTE no fluxo de signup/confirmação, nunca
      // em SIGNED_IN genérico — login de conta existente não pode sobrescrever a
      // escolha manual (R-253).
      if (!timezone) return
      const userId = await getUserId()
      const { error } = await client
        .from('user_settings')
        .upsert({ user_id: userId, timezone }, { onConflict: 'user_id' })
      if (error) throw error
    },

    async completeOnboarding(timezone) {
      // F4.3f.0: contas novas nascem com o tz real do device (resolvido pelo
      // caller de plataforma via resolveSupportedTz). Só grava se vier um tz
      // válido — ausente mantém o DEFAULT do DB (R-082, sem sobrescrever com SP).
      const userId = await getUserId()
      const row = { user_id: userId, onboarding_completed: true, updated_at: getServerTimestamp() }
      if (timezone) row.timezone = timezone
      const { error } = await client
        .from('user_settings')
        .upsert(row, { onConflict: 'user_id' })
      if (error) throw error
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
