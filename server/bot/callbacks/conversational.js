import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { getSession, setSession, clearSession } from '../state.js';
import { calculateStreak } from '../../utils/formatters.js';
import { createLogger } from '../logger.js';

const logger = createLogger('ConversationalCallbacks');

export async function handleConversationalCallbacks(bot) {
  bot.on('callback_query', async (callbackQuery) => {
    const { data, message, id } = callbackQuery;
    const chatId = message.chat.id;

    if (data.startsWith('reg_med:')) {
      await handleRegistrarMedSelected(bot, callbackQuery);
    } else if (data.startsWith('reg_qty:')) {
      await handleRegistrarQtySelected(bot, callbackQuery);
    } else if (data.startsWith('add_stock_med:')) {
      await handleAddStockMedSelected(bot, callbackQuery);
    } else if (data.startsWith('add_stock_med_val:')) {
      const [_, index, qty] = data.split(':');
      try {
        const session = getSession(chatId);
        
        if (!session || !session.medicineMap || !session.medicineMap[index]) {
          return bot.answerCallbackQuery(id, { text: 'Sessão expirada. Tente novamente.', show_alert: true });
        }
        
        const { medicineId, medicineName } = session.medicineMap[index];
        const userId = await getUserIdByChatId(chatId);
        await processAddStock(bot, chatId, userId, medicineId, parseFloat(qty), medicineName);
        await bot.deleteMessage(chatId, message.message_id);
        await bot.answerCallbackQuery(id);
      } catch (err) {
        if (err.message === 'User not linked') {
          return bot.answerCallbackQuery(id, { text: 'Conta não vinculada.', show_alert: true });
        }
        throw err;
      }
    } else if (data.startsWith('pause_prot:') || data.startsWith('resume_prot:')) {
      await handleProtocolCallback(bot, callbackQuery);
    } else if (data.startsWith('conv_cancel')) {
      await handleCancel(bot, callbackQuery);
    } else if (data === 'quick_status') {
      await handleQuickStatus(bot, callbackQuery);
    } else if (data === 'quick_stock') {
      await handleQuickStock(bot, callbackQuery);
    } else if (data === 'quick_register') {
      await handleQuickRegister(bot, callbackQuery);
    }
  });

  // Handle manual text input for quantities/values
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    // Skip if message is a command
    if (msg.text?.startsWith('/')) return;
    
    const session = getSession(chatId);
    
    if (session && session.waitingForInput) {
      if (session.action === 'registrar_dose' && session.step === 'waiting_qty') {
        await handleManualQuantityInput(bot, msg, session);
      } else if (session.action === 'adicionar_estoque' && session.step === 'waiting_stock_qty') {
        await handleManualStockInput(bot, msg, session);
      }
    }
  });
}

import { processAddStock } from '../commands/adicionar_estoque.js';
import { handleProtocolCallback } from '../commands/protocols.js';

async function handleAddStockMedSelected(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  const index = parseInt(data.split(':')[1]);
  
  // Get session to retrieve medicine map
  const session = getSession(chatId);
  
  if (!session || !session.medicineMap || !session.medicineMap[index]) {
    return bot.answerCallbackQuery(id, { text: 'Sessão expirada. Tente novamente.', show_alert: true });
  }
  
  const { medicineId, medicineName, dosageUnit } = session.medicineMap[index];

  setSession(chatId, { 
    action: 'adicionar_estoque', 
    step: 'waiting_stock_qty', 
    medicineId, 
    medicineName,
    dosageUnit,
    waitingForInput: true 
  });

  await bot.editMessageText(`📦 *${medicine?.name}*\nDigite a quantidade a ser adicionada ao estoque:`, {
    chat_id: chatId,
    message_id: message.message_id,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'conv_cancel' }]]
    }
  });

  await bot.answerCallbackQuery(id);
}

async function handleManualStockInput(bot, msg, session) {
  const chatId = msg.chat.id;
  const text = msg.text.replace(',', '.');
  const quantity = parseFloat(text);

  if (isNaN(quantity) || quantity <= 0) {
    return bot.sendMessage(chatId, '⚠️ Por favor, digite um número válido.');
  }

  await processAddStock(bot, chatId, session.medicineId, quantity, session.medicineName);
  clearSession(chatId);
}

async function handleRegistrarMedSelected(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  const index = parseInt(data.split(':')[1]);
  
  console.log(`[Conversational] handleRegistrarMedSelected called for chat ${chatId}, index: ${index}`);
  
  // Get session to retrieve protocol map
  const session = await getSession(chatId);
  
  console.log(`[Conversational] Session retrieved:`, session);
  
  if (!session || !session.protocolMap || !session.protocolMap[index]) {
    console.log(`[Conversational] Session invalid or protocolMap missing. Session:`, session, `Index: ${index}`);
    return bot.answerCallbackQuery(id, { text: 'Sessão expirada. Tente novamente.', show_alert: true });
  }
  
  const { medicineId, protocolId, medicineName } = session.protocolMap[index];

  // Fetch protocol info to get default dosage
  const { data: protocol } = await supabase
    .from('protocols')
    .select('dosage_per_intake, medicine:medicines(name, dosage_unit)')
    .eq('id', protocolId)
    .single();

  const unit = protocol?.medicine?.dosage_unit || 'x';
  const defaultQty = protocol?.dosage_per_intake || 1;

  setSession(chatId, { 
    action: 'registrar_dose', 
    step: 'waiting_qty', 
    medicineId, 
    protocolId, 
    medicineName,
    waitingForInput: true 
  });

  const keyboard = {
    inline_keyboard: [
      [
        { text: `${defaultQty}${unit} (Padrão)`, callback_data: `reg_qty:${defaultQty}` },
        { text: `${defaultQty * 2}${unit}`, callback_data: `reg_qty:${defaultQty * 2}` }
      ],
      [
        { text: '0.5x (Metade)', callback_data: `reg_qty:0.5` },
        { text: '1.5x', callback_data: `reg_qty:1.5` }
      ],
      [{ text: '❌ Cancelar', callback_data: 'conv_cancel' }]
    ]
  };

  await bot.editMessageText(`💊 *${medicineName}*\nQual a quantidade tomada?\n\n_Você também pode digitar um valor (ex: 1.25)_`, {
    chat_id: chatId,
    message_id: message.message_id,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });

  await bot.answerCallbackQuery(id);
}

async function handleRegistrarQtySelected(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  const quantity = parseFloat(data.split(':')[1]);
  const session = getSession(chatId);

  if (!session || session.action !== 'registrar_dose') {
    return bot.answerCallbackQuery(id, { text: 'Sessão expirada.', show_alert: true });
  }

  await processDoseRegistration(bot, chatId, session.protocolId, session.medicineId, quantity, message.message_id);
  await bot.answerCallbackQuery(id, { text: 'Dose registrada!' });
  clearSession(chatId);
}

async function handleManualQuantityInput(bot, msg, session) {
  const chatId = msg.chat.id;
  const text = msg.text.replace(',', '.');
  const quantity = parseFloat(text);

  if (isNaN(quantity) || quantity <= 0) {
    return bot.sendMessage(chatId, '⚠️ Por favor, digite um número válido (ex: 1 ou 0.5).');
  }

  await processDoseRegistration(bot, chatId, session.protocolId, session.medicineId, quantity);
  clearSession(chatId);
}

async function handleCancel(bot, callbackQuery) {
  const { message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  clearSession(chatId);
  await bot.editMessageText('Operação cancelada.', {
    chat_id: chatId,
    message_id: message.message_id
  });
  await bot.answerCallbackQuery(id);
}

async function processDoseRegistration(bot, chatId, protocolId, medicineId, quantity, editMessageId = null) {
  try {
    // Get actual user ID from chat ID
    const userId = await getUserIdByChatId(chatId);
    
    // 1. Criar Log
    const { error: logError } = await supabase
      .from('medicine_logs')
      .insert([{
        user_id: userId,
        protocol_id: protocolId,
        medicine_id: medicineId,
        quantity_taken: quantity,
        taken_at: new Date().toISOString()
      }]);

    if (logError) {
      logger.error('Erro ao criar log de dose:', logError, { 
        chatId, 
        userId, 
        protocolId, 
        medicineId, 
        quantity 
      });
      
      const { data: med } = await supabase
        .from('medicines')
        .select('name')
        .eq('id', medicineId)
        .single();
      
      const message = `❌ Erro ao registrar dose de *${med?.name || 'Desconhecido'}*.\n\n` +
        `Detalhes do erro: ${logError.message || 'Erro desconhecido'}\n\n` +
        `Por favor, tente novamente ou contate o suporte.`;
      
      if (editMessageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'Markdown'
        });
      } else {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
      return;
    }

    // 2. Decrementar Estoque
    const { data: stockEntries, error: fetchError } = await supabase
      .from('stock')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .gt('quantity', 0)
      .order('purchase_date', { ascending: true });
    
    // Validar se há estoque suficiente
    const totalStock = stockEntries?.reduce((sum, entry) => sum + entry.quantity, 0) || 0;
    if (totalStock < quantity) {
      const { data: med } = await supabase
        .from('medicines')
        .select('name')
        .eq('id', medicineId)
        .single();
      
      const message = `⚠️ Estoque insuficiente!\n\n` +
        `Medicamento: ${med?.name || 'Desconhecido'}\n` +
        `Quantidade solicitada: ${quantity}\n` +
        `Estoque disponível: ${totalStock}\n\n` +
        `Por favor, adicione estoque antes de registrar a dose.`;
      
      if (editMessageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId
        });
      } else {
        await bot.sendMessage(chatId, message);
      }
      return;
    }
    
    if (!fetchError && stockEntries.length > 0) {
      let remaining = quantity;
      for (const entry of stockEntries) {
        if (remaining <= 0) break;
        const toDecrease = Math.min(entry.quantity, remaining);
        await supabase
          .from('stock')
          .update({ quantity: entry.quantity - toDecrease })
          .eq('id', entry.id);
        remaining -= toDecrease;
      }
    }

    // 3. Fetch name for summary
    const { data: med } = await supabase
      .from('medicines')
      .select('name')
      .eq('id', medicineId)
      .single();

    // Get all logs to calculate streak
    const { data: allLogs } = await supabase
      .from('medicine_logs')
      .select('taken_at')
      .eq('user_id', userId);
    
    const streak = calculateStreak(allLogs);

    let message = `✅ Dose de *${quantity}x ${med?.name || ''}* registrada com sucesso!`;
    
    if (streak > 1) {
      message += `\n🔥 *${streak} dias seguidos!*`;
    }

    if (editMessageId) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'Markdown'
      });
    } else {
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    logger.error('Erro ao registrar dose manual:', err, { 
      chatId, 
      protocolId, 
      medicineId, 
      quantity 
    });
    
    // Handle unlinked user case
    if (err.message === 'User not linked') {
      await bot.sendMessage(chatId, '❌ Conta não vinculada. Use /start para vincular.');
      return;
    }
    
    bot.sendMessage(chatId, '❌ Erro ao registrar a dose. Tente novamente.');
  }
}

// Quick action handlers
async function handleQuickStatus(bot, callbackQuery) {
  const { message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  await bot.answerCallbackQuery(id);
  
  // Import and call status handler
  const { handleStatus } = await import('../commands/status.js');
  await handleStatus(bot, { chat: { id: chatId } });
}

async function handleQuickStock(bot, callbackQuery) {
  const { message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  await bot.answerCallbackQuery(id);
  
  // Import and call stock handler
  const { handleEstoque } = await import('../commands/estoque.js');
  await handleEstoque(bot, { chat: { id: chatId } });
}

async function handleQuickRegister(bot, callbackQuery) {
  const { message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  await bot.answerCallbackQuery(id);
  
  // Import and call register handler
  const { handleRegistrar } = await import('../commands/registrar.js');
  await handleRegistrar(bot, { chat: { id: chatId } });
}
