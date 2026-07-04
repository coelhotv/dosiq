import { supabase } from './supabase.js';

export async function getUserIdByChatId(chatId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('telegram_chat_id', chatId.toString())
    .single();

  if (error || !data) {
    throw new Error('User not linked');
  }

  return data.user_id;
}
