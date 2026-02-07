import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { setSession, getSession } from '../state.js';

export async function handlePausar(bot, msg, match) {
  const chatId = msg.chat.id;
  const medicineName = match[1]?.trim();

  try {
    const userId = await getUserIdByChatId(chatId);

    if (!medicineName) {
      // List active protocols to pick one
      const { data: protocols } = await supabase
        .from('protocols')
        .select('id, medicine:medicines(name)')
        .eq('user_id', userId)
        .eq('active', true);

      if (!protocols || protocols.length === 0) {
        return bot.sendMessage(chatId, 'Você não possui protocolos ativos.');
      }

      const protocolMap = protocols.map((p, index) => ({
        index,
        protocolId: p.id,
        medicineName: p.medicine.name
      }));
      
      const keyboard = protocols.map((p, index) => ([
        { text: `Pausar ${p.medicine.name}`, callback_data: `pause_prot:${index}` }
      ]));
      
      setSession(chatId, { protocolMap });

      return bot.sendMessage(chatId, 'Selecione o protocolo para pausar:', {
        reply_markup: { inline_keyboard: keyboard }
      });
    }

    // Handle by name
    await toggleProtocol(bot, chatId, userId, medicineName, false);
  } catch (err) {
    if (err.message === 'User not linked') {
      return bot.sendMessage(chatId, '❌ Conta não vinculada. Use /start para vincular.');
    }
    console.error('Erro em handlePausar:', err);
    bot.sendMessage(chatId, '❌ Ocorreu um erro ao processar sua solicitação.');
  }
}

export async function handleRetomar(bot, msg, match) {
  const chatId = msg.chat.id;
  const medicineName = match[1]?.trim();

  try {
    const userId = await getUserIdByChatId(chatId);

    if (!medicineName) {
      // List paused protocols
      const { data: protocols } = await supabase
        .from('protocols')
        .select('id, medicine:medicines(name)')
        .eq('user_id', userId)
        .eq('active', false);

      if (!protocols || protocols.length === 0) {
        return bot.sendMessage(chatId, 'Você não possui protocolos pausados.');
      }

      const protocolMap = protocols.map((p, index) => ({
        index,
        protocolId: p.id,
        medicineName: p.medicine.name
      }));
      
      const keyboard = protocols.map((p, index) => ([
        { text: `Retomar ${p.medicine.name}`, callback_data: `resume_prot:${index}` }
      ]));
      
      setSession(chatId, { protocolMap });

      return bot.sendMessage(chatId, 'Selecione o protocolo para retomar:', {
        reply_markup: { inline_keyboard: keyboard }
      });
    }

    // Handle by name
    await toggleProtocol(bot, chatId, userId, medicineName, true);
  } catch (err) {
    if (err.message === 'User not linked') {
      return bot.sendMessage(chatId, '❌ Conta não vinculada. Use /start para vincular.');
    }
    console.error('Erro em handleRetomar:', err);
    bot.sendMessage(chatId, '❌ Ocorreu um erro ao processar sua solicitação.');
  }
}

async function toggleProtocol(bot, chatId, userId, medicineName, active) {
  try {
    const { data: medicines } = await supabase
      .from('medicines')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', `%${medicineName}%`);

    if (!medicines || medicines.length === 0) {
      return bot.sendMessage(chatId, `❌ Medicamento "${medicineName}" não encontrado.`);
    }

    const medicineIds = medicines.map(m => m.id);

    const { data: protocol, error } = await supabase
      .from('protocols')
      .update({ active })
      .in('medicine_id', medicineIds)
      .eq('user_id', userId)
      .select('medicine:medicines(name)')
      .single();

    if (error || !protocol) {
      return bot.sendMessage(chatId, `❌ Não foi possível encontrar um protocolo para "${medicineName}".`);
    }

    const statusStr = active ? 'retomado' : 'pausado';
    await bot.sendMessage(chatId, `✅ Protocolo de *${protocol.medicine.name}* foi ${statusStr}.`, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('Erro ao alternar protocolo:', err);
    bot.sendMessage(chatId, '❌ Ocorreu um erro ao processar sua solicitação.');
  }
}

export async function handleProtocolCallback(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  const [action, index] = data.split(':');
  const active = action === 'resume_prot';
  
  // Get session to retrieve protocol map
  const session = await getSession(chatId);
  
  if (!session || !session.protocolMap || !session.protocolMap[index]) {
    return bot.answerCallbackQuery(id, { text: 'Sessão expirada. Tente novamente.', show_alert: true });
  }
  
  const { protocolId } = session.protocolMap[index];

  try {
    const { data: protocol, error } = await supabase
      .from('protocols')
      .update({ active })
      .eq('id', protocolId)
      .select('medicine:medicines(name)')
      .single();

    if (error) throw error;

    const statusStr = active ? 'retomado' : 'pausado';
    await bot.editMessageText(`✅ Protocolo de *${protocol.medicine.name}* foi ${statusStr}.`, {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'Markdown'
    });
    await bot.answerCallbackQuery(id);
  } catch (err) {
    console.error('Erro no callback de protocolo:', err);
    bot.answerCallbackQuery(id, { text: 'Erro ao processar.', show_alert: true });
  }
}
