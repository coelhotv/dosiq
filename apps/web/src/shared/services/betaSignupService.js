// betaSignupService.js — captura de e-mail para o closed testing do app Android.
// Insert-only (a landing é pública; role anon só tem INSERT na tabela beta_signups).
import { supabase } from '@shared/utils/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Registra um e-mail interessado no beta de uma plataforma.
 * @param {string} email
 * @param {'android'|'ios'|'other'} [platform='android']
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function signupForBeta(email, platform = 'android') {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) {
    return { success: false, error: 'E-mail inválido' }
  }

  const { error } = await supabase
    .from('beta_signups')
    .insert([{ email: normalized, platform }])

  if (error) {
    // 23505 = unique_violation → e-mail já cadastrado: tratamos como sucesso
    // (idempotente do ponto de vista do usuário, sem revelar a lista).
    if (error.code === '23505') return { success: true, error: null }
    return { success: false, error: 'Não foi possível registrar agora. Tente mais tarde.' }
  }

  return { success: true, error: null }
}
