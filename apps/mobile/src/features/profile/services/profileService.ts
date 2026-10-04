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
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { logEvent } from '@platform/analytics/productAnalytics'
import { endSession } from '@platform/session/endSession'
import { classifyAuthUserResult } from '@platform/session/useSessionVerification'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'

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
  // Spec 091: casca do encerramento único. A ordem (auditoria → push → `logout` → signOut → wipe
  // por allowlist → resetUser) e o motivo de cada passo moram em `endSession`. A denylist que vivia
  // aqui (AP-213) e o retorno cedo SEM limpeza em "session missing" (E-2) morreram com ela.
  try {
    const { success } = await endSession('logout')
    return success ? { success: true, error: null } : { success: false, error: 'Não foi possível sair. Tente de novo.' }
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
 * @param {{previous?: Object|null}} [options] — settings já carregados; sem eles não há como saber
 *   se o canal MUDOU (a tela salva o payload inteiro a cada toque).
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function updateNotificationSettings(userId, settings, { previous = null } = {}) {
  try {
    z.string().uuid().parse(userId)

    const parsed = userSettingsNotificationSchema.partial().safeParse(settings)
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map(e => e.message).join(', '))
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        ...parsed.data
      }, { onConflict: 'user_id' })

    if (error) throw error
    // 065 US5: só o CANAL (enum telegram|mobile_push|both|none), só quando muda e só após gravar.
    const next = parsed.data.notification_preference
    if (next !== undefined && next !== (previous?.notification_preference ?? undefined)) {
      await logEvent(EVENTS.NOTIFICATION_PREFERENCE_CHANGED, { new_preference: next, surface: SURFACES.MOBILE })
    }
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
      await regenActiveProtocolsForTz({ client: supabase as any, userId: user.id, tz: timezone })
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
    return await hasFuturePendingDosesCore(supabase as any, user.id)
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
  const result = await supabase.auth.getUser()
  const user = result.data?.user
  if (result.error || !user) {
    // Spec 091 (AC-2.3, 4º gatilho): o Perfil é quem pergunta ao SERVIDOR pelo usuário. Antes, conta
    // excluída aqui só virava string na tela. Sessão inválida encerra; erro de rede NÃO (`unknown`).
    if (classifyAuthUserResult(result) === 'invalid') void endSession('invalid')
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  return user.id
}

const profileRepo = createProfileRepository({ client: supabase as any, getUserId })

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
    // FR-8/R-042: {} — perfil é a maior superfície de PII do app, zero campo no payload.
    void logEvent(EVENTS.PROFILE_UPDATED, { surface: SURFACES.MOBILE })
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
    // Mesma normalização da super property (setMode): null = 'auto' — null no payload apagaria a densidade.
    void logEvent(EVENTS.MODE_CHANGED, { mode: value || 'auto', surface: SURFACES.MOBILE })
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
 * Preferência global de controle de estoque (spec 044).
 * Propaga o erro: quem trata o fail-safe (ausência → ativo) é o provider da UI.
 */
export async function getStockTracking() {
  return profileRepo.getStockTracking()
}

/**
 * Liga/desliga o controle de estoque. off → congela (carimba stock_paused_at);
 * nenhuma mutação de saldo aqui (NC3 da spec 044).
 */
export async function setStockTracking(enabled) {
  return profileRepo.setStockTracking(enabled)
}

/**
 * Excluir conta (RPC delete_user_account — bloqueia se tratamentos ativos).
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function deleteAccount() {
  try {
    await profileRepo.deleteAccount()
    void logEvent(EVENTS.ACCOUNT_DELETED, { result: 'success', surface: SURFACES.MOBILE })
    return { success: true, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao excluir conta:', err)
    void logEvent(EVENTS.ACCOUNT_DELETED, { result: 'error', surface: SURFACES.MOBILE })
    return { success: false, error: mapErrorToMessage(err) }
  }
}
