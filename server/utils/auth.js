// server/utils/auth.js
// Utilitário compartilhado de verificação de acesso administrativo
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../bot/logger.js';

const logger = createLogger('AdminAuth');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const adminChatId = process.env.ADMIN_CHAT_ID;

/**
 * Verifica se o usuário autenticado é um administrador
 * @param {string} authHeader - Header de autorização com Bearer token
 * @returns {Promise<{authorized: boolean, error?: string, userId?: string}>}
 */
export async function verifyAdminAccess(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Token de autorização não fornecido' };
  }

  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { authorized: false, error: 'Token inválido ou expirado' };
    }

    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('telegram_chat_id')
      .eq('user_id', user.id)
      .single();

    if (settingsError || !userSettings?.telegram_chat_id) {
      return { authorized: false, error: 'Configurações de usuário não encontradas' };
    }

    if (String(userSettings.telegram_chat_id) !== String(adminChatId)) {
      return { authorized: false, error: 'Acesso negado. Apenas administradores podem acessar.' };
    }

    return { authorized: true, userId: user.id };
  } catch (err) {
    logger.error('Erro na verificação de admin', err);
    return { authorized: false, error: 'Erro interno na verificação de acesso' };
  }
}
