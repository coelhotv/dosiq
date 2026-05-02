import { supabase } from '../../services/supabase.js';
import { getServerTimestamp } from '../../utils/dateUtils.js';

export async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const token = msg.text.split(' ')[1]?.trim();
  
  try {
    if (!token) {
      // Check if already linked
      const { data: existing } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (existing) {
        await bot.sendMessage(chatId, '✅ Você já está conectado! Use /ajuda para ver os comandos.');
      } else {
        await bot.sendMessage(chatId, 
          'Olá! 👋 Para conectar o bot à sua conta:\n\n' +
          '1. Abra o app Dosiq\n' +
          '2. Vá em **Configurações > Integração Telegram**\n' +
          '3. Clique em "Gerar Código"\n' +
          '4. Envie o código aqui: `/start SEU_CODIGO`',
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    // Try to link using token
    const { data: linked, error } = await supabase
      .from('user_settings')
      .update({ 
        telegram_chat_id: chatId.toString(),
        verification_token: null, // Consume token
        updated_at: getServerTimestamp()
      })
      .eq('verification_token', token)
      .select()
      .single();

    if (error) {
      console.error('Database error during linking:', error);
      // Check if it's an RLS issue or missing column
      if (error.code === '42703') {
        await bot.sendMessage(chatId, '❌ Erro técnico: Coluna de verificação não encontrada no banco. Execute o SQL de migração.');
      } else {
        await bot.sendMessage(chatId, '❌ Ops! Ocorreu um erro no banco de dados. Contate o suporte.');
      }
      return;
    }

    if (!linked) {
      await bot.sendMessage(chatId, '❌ Código inválido ou expirado. Por favor, gere um novo código no app.');
      return;
    }

    await bot.sendMessage(chatId, 
      `🎉 *Conta vinculada com sucesso!*\n\n` +
      `Agora você receberá notificações e poderá gerenciar seus remédios por aqui.\n\n` +
      `*Comandos úteis:*\n` +
      `/hoje - O que tomar hoje\n` +
      `/status - Status dos tratamentos\n` +
      `/estoque - Compras necessárias`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Erro ao salvar chat_id:', err);
    await bot.sendMessage(chatId, 'Ops, tive um erro ao configurar seu perfil. Tente novamente mais tarde.');
  }
}
