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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { validateUserProfile } from '../schemas/userProfileSchema'
import type { StockTrackingPreference } from '../schemas/userSettingsSchema'
import { isNewConsentSession } from '../services/consentGate'
import { getServerTimestamp, getTodayLocal } from '../utils/dateUtils'

// Colunas de perfil lidas/escritas (R-127: só o necessário).
const PROFILE_COLUMNS = 'display_name, birth_date, city, state, phone, complexity_override'

// Spec 044 — preferência de controle de estoque (read-path R-267: schema + este select).
const STOCK_TRACKING_COLUMNS = 'stock_tracking_enabled, stock_paused_at'

// Spec 046 — contador do prompt de consentimento (sessão = bootstrap com gap > 30 min).
const CONSENT_PROMPT_COLUMNS = 'consent_prompt_sessions, consent_prompt_last_seen_at'

// Spec 008 — allowlist do export LGPD. NUNCA incluir `verification_token` (segredo).
// Literal (não `[].join()`): o supabase-js tipa o retorno a partir da STRING do select —
// uma string derivada em runtime derruba a inferência para `GenericStringError`.
// prettier-ignore
const EXPORT_PROFILE_COLUMNS = 'display_name, birth_date, city, state, phone, timezone, complexity_override, onboarding_completed, emergency_card, telegram_chat_id, notification_preference, notification_mode, digest_time, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, channel_mobile_push_enabled, channel_web_push_enabled, channel_telegram_enabled, stock_tracking_enabled, stock_paused_at, created_at, updated_at'

const COMPLEXITY_VALUES = Object.freeze(['simple', 'complex', null])

interface ValidationError {
  field: string
  message: string
}

function formatValidationError(errors: ValidationError[]) {
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

interface CreateProfileRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

/**
 * Cria um repositório de perfil parametrizado por plataforma.
 */
export function createProfileRepository({ client, getUserId }: CreateProfileRepositoryDeps) {
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

    async updateProfile(input: Record<string, unknown>) {
      const validation = validateUserProfile(input)
      if (!validation.success || !validation.data) throw formatValidationError(validation.errors ?? [])

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

    async updateComplexity(value: 'simple' | 'complex' | null) {
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

    async captureDeviceTimezone(timezone: string | null | undefined) {
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

    async completeOnboarding(timezone?: string | null) {
      // F4.3f.0: contas novas nascem com o tz real do device (resolvido pelo
      // caller de plataforma via resolveSupportedTz). Só grava se vier um tz
      // válido — ausente mantém o DEFAULT do DB (R-082, sem sobrescrever com SP).
      const userId = await getUserId()
      const row: Record<string, unknown> = {
        user_id: userId,
        onboarding_completed: true,
        updated_at: getServerTimestamp(),
      }
      if (timezone) row.timezone = timezone
      const { error } = await client
        .from('user_settings')
        .upsert(row as never, { onConflict: 'user_id' })
      if (error) throw error
    },

    /**
     * Perfil + configurações para o export LGPD (spec 008, FR-002/FR-010).
     * Allowlist EXPLÍCITA de colunas: `verification_token` fica fora (segredo do vínculo
     * Telegram, não é dado do titular). `select('*')` aqui seria um vazamento a cada coluna
     * nova — a lista tem que doer para ser revisada.
     */
    async getProfileForExport(): Promise<Record<string, unknown> | null> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('user_settings')
        .select(EXPORT_PROFILE_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    },

    /**
     * Preferência GLOBAL de controle de estoque (spec 044).
     * Fail-safe: sem linha em user_settings → estoque ATIVO (espelha o COALESCE das RPCs
     * atômicas — AP-277: ausência de dado NUNCA desliga o estoque por omissão / FR-009).
     */
    async getStockTracking(): Promise<StockTrackingPreference> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('user_settings')
        .select(STOCK_TRACKING_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      return {
        stock_tracking_enabled: data?.stock_tracking_enabled ?? true,
        stock_paused_at: data?.stock_paused_at ?? null,
      }
    },

    /**
     * Liga/desliga o controle de estoque.
     * off → carimba `stock_paused_at` (instante do congelamento; insumo do gap lazy da
     * reativação — FR-012). on → limpa. Nenhuma mutação de saldo/compras aqui: o opt-out
     * CONGELA (NC3 da spec) — quem zera é o service de reativação, via adjustments.
     *
     * ⚠️ `freeze: false` — desligar SEM carimbar. O carimbo afirma "existe um saldo congelado
     * desde T", e é ele que distingue "congelou" de "nunca teve estoque" (`neverHadStock`).
     * Quando o usuário escolhe dose-only NO ONBOARDING não existe saldo nenhum para congelar:
     * carimbar ali é uma afirmação FALSA, e ela se vinga na reativação — o toggle acha que há
     * saldo a retomar, entra no fluxo de retomada (gap de minutos → silencioso) e NUNCA pergunta
     * o saldo inicial (PO-3). Escolha inicial usa `freeze: false`; opt-out de verdade carimba.
     */
    async setStockTracking(
      enabled: boolean,
      options: { freeze?: boolean } = {},
    ): Promise<StockTrackingPreference> {
      if (typeof enabled !== 'boolean') {
        throw new Error('setStockTracking: enabled deve ser boolean')
      }
      const freeze = options.freeze ?? true

      const userId = await getUserId()
      const { data, error } = await client
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            stock_tracking_enabled: enabled,
            stock_paused_at: enabled || !freeze ? null : getServerTimestamp(),
            updated_at: getServerTimestamp(),
          },
          { onConflict: 'user_id' },
        )
        .select(STOCK_TRACKING_COLUMNS)
        .single()

      if (error) throw error
      return {
        stock_tracking_enabled: data.stock_tracking_enabled ?? true,
        stock_paused_at: data.stock_paused_at ?? null,
      }
    },

    /**
     * Contador de sessões em que o prompt de consentimento apareceu (spec 046, T009).
     * Fail-safe: sem linha em `user_settings` ⇒ zero sessões (titular novo, cortesia intacta).
     */
    async getConsentPrompt(): Promise<{ sessions: number; lastSeenAt: string | null }> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('user_settings')
        .select(CONSENT_PROMPT_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      return {
        sessions: data?.consent_prompt_sessions ?? 0,
        lastSeenAt: data?.consent_prompt_last_seen_at ?? null,
      }
    },

    /**
     * Conta UMA nova sessão de prompt, se o bootstrap atual for mesmo uma sessão nova
     * (gap > 30 min desde o último visto — `isNewConsentSession`).
     *
     * Sem o gap, um refresh de página ou um retorno do background queimaria a cortesia do titular
     * em segundos: ele chegaria ao prompt BLOQUEANTE sem nunca ter tido três oportunidades reais de
     * responder. Idempotente dentro da janela — chamar a cada bootstrap é seguro.
     *
     * ⚠️ SÓ chamar quando o estado do consentimento é `missing` DE FATO (lido com sucesso). Sob
     * estado indeterminado (falha de leitura) o guard não conta sessão — ver `consentGate`.
     */
    async bumpConsentPromptSession(): Promise<{ sessions: number; counted: boolean }> {
      const current = await repo.getConsentPrompt()
      if (!isNewConsentSession(current.lastSeenAt)) {
        return { sessions: current.sessions, counted: false }
      }

      const userId = await getUserId()
      const sessions = current.sessions + 1
      const { error } = await client.from('user_settings').upsert(
        {
          user_id: userId,
          consent_prompt_sessions: sessions,
          consent_prompt_last_seen_at: getServerTimestamp(),
          updated_at: getServerTimestamp(),
        },
        { onConflict: 'user_id' },
      )

      if (error) throw error
      return { sessions, counted: true }
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
