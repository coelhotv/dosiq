import { z } from 'zod'
import {
  userSettingsNotificationSchema,
  createProfileRepository,
  TIMEZONES_BR,
  getDeviceTimezone,
  resolveSupportedTz,
  hasFuturePendingDoses as hasFuturePendingDosesCore,
  regenActiveProtocolsForTz,
} from '@dosiq/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { ALARM_ENABLED_KEY, ALARM_NUDGE_SEEN_KEY } from '@platform/alarms/alarmEnabledStore'

/**
 * Mapeia erros técnicos da API para mensagens amigáveis em Português (R-170)
 * @param {Error|Object} error 
 * @returns {string}
 */
function mapErrorToMessage(error) {
  if (!error) return 'Erro desconhecido'
  const message = error.message || ''
  
  if (message.includes('fetch') || message.includes('network')) return 'Sem ligação à internet.'
  if (message.includes('JWT') || message.includes('session')) return 'Sessão expirada. Faça login novamente.'
  if (message.includes('Invalid path')) return 'Erro interno de rota (API). Contacte o suporte.'
  
  return message || 'Erro ao processar pedido.'
}

/**
 * Obter utilizador actualmente autenticado
 * @returns {Promise<{data: User|null, error: string|null}>}
 */
export async function getCurrentUser() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    let user = session?.user
    if (sessionError || !user) {
      const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      user = verifiedUser
    }
    
    return { data: user ?? null, error: null }
  } catch (err) {
    console.error('[profileService] erro ao obter utilizador:', err)
    return { data: null, error: mapErrorToMessage(err) }
  }
}

/**
 * Fazer logout do utilizador actual
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function logoutUser() {
  try {
    // scope 'local': limpa a sessão local imediatamente e dispara SIGNED_OUT sem
    // depender de chamada de rede (global revoga no servidor e pode pendurar/
    // falhar silenciosamente no simulador iOS → tela não trocava).
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) {
      if (error.message?.includes('session missing') || error.__isAuthError) {
        return { success: true, error: null }
      }
      throw error
    }
    // AsyncStorage é app-scoped, não per-user. Limpar tudo que é específico do
    // usuário anterior: caches de dados + flags de feature (AP-213).
    await AsyncStorage.multiRemove([
      // flags legado de alarme
      ALARM_ENABLED_KEY,
      ALARM_NUDGE_SEEN_KEY,
      // caches de dados do usuário (vazam para o próximo login)
      '@dosiq/medicines-snapshot',
      '@dosiq/protocols-snapshot',
      '@dosiq/purchases-snapshot',
      '@dosiq/stock-snapshot',
      '@dosiq/today-snapshot',
      '@dosiq/treatments-snapshot',
      '@dosiq/recovery-flow',
    ]).catch(() => {})
    return { success: true, error: null }
  } catch (err) {
    console.error('[profileService] erro ao fazer logout:', err)
    return { success: false, error: mapErrorToMessage(err) }
  }
}

/**
 * Buscar as configurações do usuário atual (inclui telegram_chat_id)
 * @returns {Promise<{data: any, error: string|null}>}
 */
export async function getUserSettings() {
  try {
    const { data: user, error: userError } = await getCurrentUser()
    if (userError || !user) throw new Error(userError || 'Utilizador não encontrado')

    // R-121/R-125: Validar userId antes de realizar consulta ao Supabase
    z.string().uuid().parse(user.id)

    const { data, error } = await supabase
      .from('user_settings')
      .select(`
        user_id,
        telegram_chat_id,
        verification_token,
        notification_preference,
        notification_mode,
        quiet_hours_start,
        quiet_hours_end,
        quiet_hours_enabled,
        complexity_override,
        digest_time,
        channel_mobile_push_enabled,
        channel_web_push_enabled,
        channel_telegram_enabled,
        timezone
      `)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    
    const settings = data || { user_id: user.id, telegram_chat_id: null }
    
    const validated = userSettingsNotificationSchema.extend({
      user_id: z.string().uuid(),
      telegram_chat_id: z.string().nullable().optional(),
      verification_token: z.string().nullable().optional()
    }).parse(settings)

    return { data: validated, error: null }
  } catch (err) {
    console.error('[profileService] erro ao buscar definições:', err)
    return { data: null, error: mapErrorToMessage(err) }
  }
}

/**
 * Atualizar configurações de notificação do utilizador (Sprint N2.6)
 * @param {string} userId
 * @param {Object} settings
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function updateNotificationSettings(userId, settings) {
  try {
    z.string().uuid().parse(userId)

    const parsed = userSettingsNotificationSchema.partial().safeParse(settings)
    if (!parsed.success) {
      throw new Error(parsed.error.errors.map(e => e.message).join(', '))
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        ...parsed.data
      }, { onConflict: 'user_id' })

    if (error) throw error
    return { success: true, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao salvar notificações:', err)
    return { success: false, error: mapErrorToMessage(err) }
  }
}

/**
 * Atualizar fuso horário do utilizador (ADR-049 — update isolado, não toca noutros campos).
 *
 * F4.3f.2: `regen=true` ("Me mudei") re-ancora todas as doses futuras no fuso novo
 * (wipe + regeneração por tratamento ativo). `regen=false` ("viagem" ou sem dose
 * futura) só persiste o tz — instante absoluto das doses intacto, muda só o render.
 * A regeneração é best-effort (R-245/246): falha nela não desfaz o persist do tz.
 *
 * @param {string} timezone — IANA tz string (ex: 'America/Sao_Paulo')
 * @param {{regen?: boolean}} [options]
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function updateTimezone(timezone, { regen = false } = {}) {
  try {
    const { data: user, error: userError } = await getCurrentUser()
    if (userError || !user) throw new Error(userError || 'Utilizador não encontrado')

    z.string().uuid().parse(user.id)
    // Valida contra a lista canônica de fusos (rejeita IANA inválido/estrangeiro)
    z.enum(TIMEZONES_BR).parse(timezone)

    const { error } = await supabase
      .from('user_settings')
      .update({ timezone })
      .eq('user_id', user.id)

    if (error) throw error

    if (regen) {
      await regenActiveProtocolsForTz({ client: supabase, userId: user.id, tz: timezone })
    }
    return { success: true, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao salvar fuso horário:', err)
    return { success: false, error: mapErrorToMessage(err) }
  }
}

/**
 * Há doses pendentes futuras? Governa se o prompt de intenção (viagem × mudança)
 * deve aparecer na troca de fuso. Sem dose futura → persiste direto, sem perguntar.
 * Best-effort: erro → false.
 * @returns {Promise<boolean>}
 */
export async function hasFuturePendingDoses() {
  try {
    const { data: user, error: userError } = await getCurrentUser()
    if (userError || !user) return false
    return await hasFuturePendingDosesCore(supabase, user.id)
  } catch {
    return false
  }
}

/**
 * Gerar token de verificação via Supabase RPC (Opção A)
 * @returns {Promise<{token: string|null, error: string|null}>}
 */
export async function generateTelegramToken() {
  try {
    // Opção A decidida conforme EXEC_SPEC_HIBRIDO_H5_SPRINT_PLAN.md
    const { data, error } = await supabase.rpc('generate_telegram_token')

    if (error) throw error
    return { token: data, error: null }
  } catch (err) {
    if (__DEV__) console.error('Erro ao gerar token Telegram:', err)
    return { token: null, error: err.message }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Perfil (mini-CRUD Fase 4) — adota createProfileRepository de @dosiq/core (G2)
// ───────────────────────────────────────────────────────────────────────────

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

const profileRepo = createProfileRepository({ client: supabase, getUserId })

/**
 * Buscar dados de perfil (display_name, birth_date, city, state, phone,
 * complexity_override). Default object se ainda não houver linha.
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function getProfile() {
  try {
    const data = await profileRepo.getProfile()
    return { data, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao buscar perfil:', err)
    return { data: null, error: mapErrorToMessage(err) }
  }
}

/**
 * Atualizar dados de perfil (valida via userProfileSchema canônico).
 * @param {Object} input - { display_name, birth_date?, city?, state?, phone? }
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function updateProfile(input) {
  try {
    const data = await profileRepo.updateProfile(input)
    return { data, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao salvar perfil:', err)
    return { data: null, error: mapErrorToMessage(err) }
  }
}

/**
 * Atualizar densidade da interface (mapeada em complexity_override).
 * @param {'simple'|'complex'|null} value
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function updateComplexity(value) {
  try {
    const data = await profileRepo.updateComplexity(value)
    return { data, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao salvar densidade:', err)
    return { data: null, error: mapErrorToMessage(err) }
  }
}

/**
 * Resumo do que será apagado na exclusão de conta (+ bloqueio por tratamentos
 * ativos). Usado pelo sheet de exclusão.
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function getDeletionSummary() {
  try {
    const data = await profileRepo.getDeletionSummary()
    return { data, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao resumir exclusão:', err)
    return { data: null, error: mapErrorToMessage(err) }
  }
}

/**
 * Verifica se o usuário deve passar pelo onboarding (1º acesso sem dados).
 * @returns {Promise<{data: boolean, error: string|null}>}
 */
export async function isOnboardingNeeded() {
  try {
    const data = await profileRepo.isOnboardingNeeded()
    return { data, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao checar onboarding:', err)
    // Em erro, não bloquear o app com o wizard — assume não necessário.
    return { data: false, error: mapErrorToMessage(err) }
  }
}

/**
 * Marca o onboarding como concluído (após concluir ou pular o wizard).
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
/**
 * Captura o fuso do device logo após a confirmação de signup (1º ponto
 * determinístico da conta) — ANTES do onboarding, cobrindo quem pula o wizard e
 * deixando o tz pronto p/ a geração do 1º tratamento. Best-effort: falha não
 * bloqueia o fluxo de cadastro. GATE: chamar SÓ no signup/confirmação (R-253).
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function captureDeviceTimezone() {
  try {
    const timezone = resolveSupportedTz(getDeviceTimezone())
    await profileRepo.captureDeviceTimezone(timezone)
    return { success: true, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao capturar fuso do device:', err)
    return { success: false, error: mapErrorToMessage(err) }
  }
}

export async function completeOnboarding() {
  try {
    // F4.3f.0: captura silenciosa do fuso real do device (Intl/Hermes),
    // normalizado p/ a lista suportada (ADR-053); fora dela → SP. Rede de
    // segurança — a captura primária é no signup (captureDeviceTimezone).
    const timezone = resolveSupportedTz(getDeviceTimezone())
    await profileRepo.completeOnboarding(timezone)
    return { success: true, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao concluir onboarding:', err)
    return { success: false, error: mapErrorToMessage(err) }
  }
}

/**
 * Excluir conta (RPC delete_user_account — bloqueia se tratamentos ativos).
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function deleteAccount() {
  try {
    await profileRepo.deleteAccount()
    return { success: true, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao excluir conta:', err)
    return { success: false, error: mapErrorToMessage(err) }
  }
}
