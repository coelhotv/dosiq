import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { getSession, setSession, clearSession } from '../state.js';
import { calculateStreak, escapeMarkdownV2 } from '../../utils/formatters.js';
import { createLogger } from '../logger.js';
import { handleChatbotMessage } from '../commands/chatbot.js';
import { getServerTimestamp } from '../../utils/dateUtils.js';

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
        const session = await getSession(chatId);
        
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
    } else if (data === 'cmd:hoje') {
      await handleQuickHoje(bot, callbackQuery);
    } else if (data === 'quick_stock') {
      await handleQuickStock(bot, callbackQuery);
    } else if (data === 'quick_register') {
      await handleQuickRegister(bot, callbackQuery);
    }
  });

  // Handle manual text input for quantities/values OR chatbot IA
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    // Skip if message is a command
    if (msg.text?.startsWith('/')) return;

    const session = await getSession(chatId);

    if (session && session.waitingForInput) {
      logger.debug('💬 Processando entrada esperada de session', {
        chatId,
        action: session.action,
        step: session.step
      });

      if (session.action === 'registrar_dose' && session.step === 'waiting_qty') {
        await handleManualQuantityInput(bot, msg, session);
      } else if (session.action === 'adicionar_estoque' && session.step === 'waiting_stock_qty') {
        await handleManualStockInput(bot, msg, session);
      }
    } else {
      // Fallback: não há session ativa → processar como chatbot IA
      logger.info('🤖 Mensagem sem session ativa → chatbot IA', {
        chatId,
        textPreview: msg.text?.substring(0, 50)
      });
      await handleChatbotMessage(bot, msg);
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
  const session = await getSession(chatId);
  
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

  await bot.editMessageText(`📦 *${escapeMarkdownV2(medicineName)}*\nDigite a quantidade a ser adicionada ao estoque:`, {
    chat_id: chatId,
    message_id: message.message_id,
    parse_mode: 'MarkdownV2',
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
    return bot.sendMessage(chatId, '⚠️ Por favor, digite um número válido\\.', { parse_mode: 'MarkdownV2' });
  }

  const userId = await getUserIdByChatId(chatId);
  await processAddStock(bot, chatId, userId, session.medicineId, quantity, session.medicineName);
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

  console.log(`[Conversational] Retrieved from protocolMap:`, { medicineId, protocolId, medicineName });

  // Fetch protocol info to get default dosage
  const { data: protocol } = await supabase
    .from('protocols')
    .select('dosage_per_intake, medicine:medicines(name, dosage_unit, dosage_per_pill)')
    .eq('id', protocolId)
    .single();

  console.log(`[Conversational] Protocol from DB:`, protocol);

  const unit = protocol?.medicine?.dosage_unit || 'x';
  const pillsPerIntake = protocol?.dosage_per_intake || 1;
  const dosagePerPill = protocol?.medicine?.dosage_per_pill || 1;
  
  // Calculate actual dosage: pills per intake * dosage per pill
  const defaultDosage = pillsPerIntake * dosagePerPill;
  
  console.log(`[Conversational] Unit: ${unit}, PillsPerIntake: ${pillsPerIntake}, DosagePerPill: ${dosagePerPill}, DefaultDosage: ${defaultDosage}`);

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
        { text: `${defaultDosage}${unit} (Padrão)`, callback_data: `reg_qty:${defaultDosage}` },
        { text: `${defaultDosage * 2}${unit}`, callback_data: `reg_qty:${defaultDosage * 2}` }
      ],
      [
        { text: '0.5x (Metade)', callback_data: `reg_qty:${defaultDosage * 0.5}` },
        { text: '1.5x', callback_data: `reg_qty:${defaultDosage * 1.5}` }
      ],
      [{ text: '❌ Cancelar', callback_data: 'conv_cancel' }]
    ]
  };

  await bot.editMessageText(`💊 *${escapeMarkdownV2(medicineName)}*\nQual a quantidade tomada?\n\n_Você também pode digitar um valor \\(ex: 1\\.25\\)_`, {
    chat_id: chatId,
    message_id: message.message_id,
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard
  });

  await bot.answerCallbackQuery(id);
}

async function handleRegistrarQtySelected(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  const quantity = parseFloat(data.split(':')[1]);
  const session = await getSession(chatId);

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
    return bot.sendMessage(chatId, '⚠️ Por favor, digite um número válido \\(ex: 1 ou 0\\.5\\)\\.', { parse_mode: 'MarkdownV2' });
  }

  await processDoseRegistration(bot, chatId, session.protocolId, session.medicineId, quantity);
  clearSession(chatId);
}

async function handleCancel(bot, callbackQuery) {
  const { message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  clearSession(chatId);
  await bot.editMessageText('Operação cancelada\\.', {
    chat_id: chatId,
    message_id: message.message_id,
    parse_mode: 'MarkdownV2'
  });
  await bot.answerCallbackQuery(id);
}

async function processDoseRegistration(bot, chatId, protocolId, medicineId, quantity, editMessageId = null) {
  try {
    // Get actual user ID from chat ID
    const userId = await getUserIdByChatId(chatId);
    
    // Fetch medicine to get dosage_per_pill for stock calculation
    const { data: medicine } = await supabase
      .from('medicines')
      .select('dosage_per_pill')
      .eq('id', medicineId)
      .single();
    
    const dosagePerPill = medicine?.dosage_per_pill || 1;
    
    // Calculate number of pills to decrease from stock
    const pillsToDecrease = quantity / dosagePerPill;
    
    console.log(`[processDoseRegistration] Dosage: ${quantity}mg, DosagePerPill: ${dosagePerPill}mg, PillsToDecrease: ${pillsToDecrease}`);
    
    // 1. Validar Estoque ANTES de gravar a dose
    const { data: stockEntries, error: fetchError } = await supabase
      .from('stock')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .gt('quantity', 0)
      .order('purchase_date', { ascending: true });
    
    // Validar se há estoque suficiente (usando quantidade de comprimidos)
    const totalStock = stockEntries?.reduce((sum, entry) => sum + entry.quantity, 0) || 0;
    if (totalStock < pillsToDecrease) {
      const { data: med } = await supabase
        .from('medicines')
        .select('name, dosage_unit')
        .eq('id', medicineId)
        .single();
      
      const unit = med?.dosage_unit || 'mg';
      const message = `⚠️ Estoque insuficiente\\!\n\n` +
        `Medicamento: ${escapeMarkdownV2(med?.name || 'Desconhecido')}\n` +
        `Dosagem solicitada: ${quantity}${escapeMarkdownV2(unit)}\n` +
        `Comprimidos necessários: ${pillsToDecrease}\n` +
        `Estoque disponível: ${totalStock} comprimidos\n\n` +
        `Por favor, adicione estoque antes de registrar a dose\\.`;
      
      if (editMessageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'MarkdownV2'
        });
      } else {
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      }
      return;
    }
    
    // 2. Criar Log (só se houver estoque suficiente)
    // quantity_taken deve ser em comprimidos, não em mg
    const { data: createdLog, error: logError } = await supabase
      .from('medicine_logs')
      .insert([{
        user_id: userId,
        protocol_id: protocolId,
        medicine_id: medicineId,
        quantity_taken: pillsToDecrease,
        taken_at: getServerTimestamp()
      }])
      .select('id')
      .single();

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
      
      const message = `❌ Erro ao registrar dose de *${escapeMarkdownV2(med?.name || 'Desconhecido')}*\\.\n\n` +
        `Detalhes do erro: ${escapeMarkdownV2(logError.message || 'Erro desconhecido')}\n\n` +
        `Por favor, tente novamente ou contate o suporte\\.`;
      
      if (editMessageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'MarkdownV2'
        });
      } else {
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      }
      return;
    }

    // 3. Decrementar Estoque via RPC FIFO (só se houver estoque suficiente)
    if (!fetchError && stockEntries.length > 0) {
      const { error: consumeError } = await supabase.rpc('consume_stock_fifo', {
        p_medicine_id: medicineId,
        p_quantity: pillsToDecrease,
        p_medicine_log_id: createdLog.id
      });

      if (consumeError) {
        await supabase
          .from('medicine_logs')
          .delete()
          .eq('id', createdLog.id)
          .eq('user_id', userId);

        throw consumeError;
      }
    }

    // 3. Fetch name for summary
    const { data: med } = await supabase
      .from('medicines')
      .select('name, dosage_unit')
      .eq('id', medicineId)
      .single();

    // Get all logs to calculate streak
    const { data: allLogs } = await supabase
      .from('medicine_logs')
      .select('taken_at')
      .eq('user_id', userId);
    
    const streak = calculateStreak(allLogs);

    const unit = med?.dosage_unit || 'mg';
    let message = `✅ Dose de *${quantity}${escapeMarkdownV2(unit)} ${escapeMarkdownV2(med?.name || '')}* registrada com sucesso\\!`;
    
    if (streak > 1) {
      message += `\n🔥 *${streak} dias seguidos\\!*`;
    }

    if (editMessageId) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'MarkdownV2'
      });
    } else {
      await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
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
      await bot.sendMessage(chatId, '❌ Conta não vinculada\\. Use /start para vincular\\.', { parse_mode: 'MarkdownV2' });
      return;
    }
    
    bot.sendMessage(chatId, '❌ Erro ao registrar a dose\\. Tente novamente\\.', { parse_mode: 'MarkdownV2' });
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

async function handleQuickHoje(bot, callbackQuery) {
  const { message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  await bot.answerCallbackQuery(id);
  
  // Import and call hoje handler
  const { handleHoje } = await import('../commands/hoje.js');
  await handleHoje(bot, { chat: { id: chatId } });
}

async function handleQuickRegister(bot, callbackQuery) {
  const { message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  await bot.answerCallbackQuery(id);
  
  // Import and call register handler
  const { handleRegistrar } = await import('../commands/registrar.js');
  await handleRegistrar(bot, { chat: { id: chatId } });
}
