// betaSignupService.js — captura de e-mail para o closed testing do app Android.
// A escrita passa pelo endpoint serverless `api/beta-signup.js` (service_role +
// rate-limit). A tabela beta_signups não tem grant para anon — nada de insert
// direto do client. Coluna `feature` identifica a lista de interesse (ex:
// 'android' = testers Play Store, 'caregiver_mode' = termômetro de demanda).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Registra um e-mail interessado em uma feature/lista.
 * @param {string} email
 * @param {'android'|'ios'|'other'|'caregiver_mode'} [feature='android']
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function signupForBeta(email, feature = 'android') {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) {
    return { success: false, error: 'E-mail inválido' }
  }

  try {
    const res = await fetch('/api/users/beta-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized, feature }),
    })

    if (res.ok) return { success: true, error: null }

    if (res.status === 429) {
      return { success: false, error: 'Muitas tentativas. Tente novamente em instantes.' }
    }
    const body = await res.json().catch(() => ({}))
    return { success: false, error: body.error || 'Não foi possível registrar agora. Tente mais tarde.' }
  } catch (err) {
    if (import.meta.env.DEV) console.error('Erro ao registrar no beta:', err)
    return { success: false, error: 'Falha de conexão. Tente novamente.' }
  }
}
