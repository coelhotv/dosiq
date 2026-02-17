import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { calculateDaysRemaining, calculateStreak, escapeMarkdownV2 } from '../../utils/formatters.js';
import { setState, getState, clearState } from '../state.js';

const SKIP_CONFIRMATION_TIMEOUT_MS = 30000; // 30 seconds

export async function handleCallbacks(bot) {
  bot.on('callback_query', async (callbackQuery) => {
    const { data } = callbackQuery;

    if (data.startsWith('take_')) {
      await handleTakeDose(bot, callbackQuery);
    } else if (data.startsWith('skip_')) {
      await handleSkipDose(bot, callbackQuery);
    } else if (data.startsWith('confirm_skip_')) {
      await handleConfirmSkipDose(bot, callbackQuery);
    } else if (data.startsWith('cancel_skip_')) {
      await handleCancelSkipDose(bot, callbackQuery);
    }
  });
}

async function handleTakeDose(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  // New format: take_:{protocolId}:{quantity}
  const [_, protocolId, quantity] = data.split(':');
  
  try {
    // Get actual user ID from chat ID
    const userId = await getUserIdByChatId(chatId);
    
    // 1. Fetch medicine_id from protocol
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select('medicine_id, medicine:medicines(name, dosage_unit)')
      .eq('id', protocolId)
      .single();

    if (protocolError || !protocol) throw new Error('Protocolo não encontrado');

    const medicineId = protocol.medicine_id;
    const medicineName = protocol.medicine.name;

    // 2. Criar Log
    const { error: logError } = await supabase
      .from('medicine_logs')
      .insert([{
        user_id: userId,
        protocol_id: protocolId,
        medicine_id: medicineId,
        quantity_taken: parseFloat(quantity),
        taken_at: new Date().toISOString()
      }]);

    if (logError) throw logError;

    // 3. Decrementar Estoque
    const { data: stockEntries, error: fetchError } = await supabase
      .from('stock')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .gt('quantity', 0)
      .order('purchase_date', { ascending: true });
    
    if (!fetchError && stockEntries.length > 0) {
      let remaining = parseFloat(quantity);
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

    // 4. Check stock levels and warn if low
    const { data: updatedStock } = await supabase
      .from('stock')
      .select('quantity')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .gt('quantity', 0);

    const totalQuantity = updatedStock?.reduce((sum, s) => sum + s.quantity, 0) || 0;
    
    // Get daily usage for this medicine
    const { data: activeProtocols } = await supabase
      .from('protocols')
      .select('time_schedule, dosage_per_intake')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .eq('active', true);

    const dailyUsage = activeProtocols?.reduce((sum, p) => {
      const timesPerDay = p.time_schedule?.length || 0;
      const dosagePerIntake = p.dosage_per_intake || 0;
      return sum + (timesPerDay * dosagePerIntake);
    }, 0) || 0;

    const daysRemaining = calculateDaysRemaining(totalQuantity, dailyUsage);
    
    // Get all logs to calculate streak
    const { data: allLogs } = await supabase
      .from('medicine_logs')
      .select('taken_at')
      .eq('user_id', userId);
    
    const streak = calculateStreak(allLogs);

    // Update the message
    let confirmMsg = `✅ Dose de *${escapeMarkdownV2(medicineName)}* registrada\\!`;
    
    if (streak > 1) {
      confirmMsg += `\n🔥 *${streak} dias seguidos\\!*`;
    }
    
    if (daysRemaining !== null && daysRemaining <= 7) {
      if (daysRemaining <= 0) {
        confirmMsg += `\n\n⚠️ *ATENÇÃO:* Estoque zerado\\!`;
      } else {
        confirmMsg += `\n\n⚠️ Estoque baixo: \~${daysRemaining} dias restantes`;
      }
    }

    // Add quick action buttons
    const quickActions = {
      inline_keyboard: [
        [
          { text: '📊 Ver Hoje', callback_data: 'cmd:hoje' },
          { text: '📦 Ver Estoque', callback_data: 'quick_stock' }
        ],
        [{ text: '📝 Registrar Outra', callback_data: 'quick_register' }]
      ]
    };

    await bot.editMessageText(confirmMsg, {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'MarkdownV2',
      reply_markup: quickActions
    });
    
    await bot.answerCallbackQuery(id, { text: 'Dose registrada!' });
  } catch (err) {
    console.error('Erro ao registrar dose:', err);
    
    // Handle unlinked user case
    if (err.message === 'User not linked') {
      try {
        await bot.answerCallbackQuery(id, {
          text: 'Conta não vinculada. Use /start para vincular.',
          show_alert: true
        });
      } catch { /* ignore */ }
      return;
    }
    
    try {
      await bot.answerCallbackQuery(id, { text: 'Erro ao registrar dose.', show_alert: true });
    } catch { /* ignore */ }
  }
}

async function handleSkipDose(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  // Parse skip data: skip_:{protocolId}
  const [_, protocolId] = data.split(':');
  
  try {
    // Get medicine name for the confirmation message
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select('medicine:medicines(name)')
      .eq('id', protocolId)
      .single();

    if (protocolError || !protocol) {
      await bot.answerCallbackQuery(id, { 
        text: 'Erro: Protocolo não encontrado.', 
        show_alert: true 
      });
      return;
    }

    const medicineName = protocol.medicine?.name || 'Medicamento';
    
    // Store original message state for potential restoration
    const originalState = {
      action: 'skip_confirmation',
      protocolId,
      medicineName,
      originalText: message.text,
      originalReplyMarkup: message.reply_markup,
      timestamp: Date.now()
    };
    
    await setState(chatId, originalState);
    
    // Set up timeout to restore original UI after 30 seconds
    setTimeout(async () => {
      await handleSkipTimeout(bot, chatId, message.message_id);
    }, SKIP_CONFIRMATION_TIMEOUT_MS);
    
    // Show confirmation keyboard
    const confirmKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Confirmar pular', callback_data: `confirm_skip_:${protocolId}` },
          { text: '❌ Cancelar', callback_data: `cancel_skip_:${protocolId}` }
        ]
      ]
    };
    
    const confirmText = `⚠️ *Confirmar ação*\n\n` +
      `Você está prestes a *pular* a dose de *${escapeMarkdownV2(medicineName)}*\\.\n\n` +
      `Esta ação não poderá ser desfeita\\.\n\n` +
      `_Confirme em 30 segundos\\.\\.\\._`;
    
    await bot.editMessageText(confirmText, {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'MarkdownV2',
      reply_markup: confirmKeyboard
    });
    
    await bot.answerCallbackQuery(id, { text: 'Confirme para pular a dose' });
    
  } catch (err) {
    console.error('Erro ao iniciar confirmação de skip:', err);
    await bot.answerCallbackQuery(id, { 
      text: 'Erro ao processar. Tente novamente.', 
      show_alert: true 
    });
  }
}

async function handleConfirmSkipDose(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  // Parse: confirm_skip_:{protocolId}
  const [_, protocolId] = data.split(':');
  
  try {
    // Verify we have a pending confirmation state
    const state = await getState(chatId);
    
    if (!state || state.action !== 'skip_confirmation' || state.protocolId !== protocolId) {
      await bot.answerCallbackQuery(id, { 
        text: 'Confirmação expirada ou inválida.', 
        show_alert: true 
      });
      return;
    }
    
    // Check if timeout expired
    const elapsed = Date.now() - state.timestamp;
    if (elapsed > SKIP_CONFIRMATION_TIMEOUT_MS) {
      await clearState(chatId);
      await bot.answerCallbackQuery(id, { 
        text: 'Tempo de confirmação expirado.', 
        show_alert: true 
      });
      return;
    }
    
    // Clear the state
    await clearState(chatId);
    
    const medicineName = state.medicineName || 'Medicamento';
    
    // Confirm the skip
    await bot.editMessageText(
      `❌ Dose de *${escapeMarkdownV2(medicineName)}* pulada\\.`,
      {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'MarkdownV2'
      }
    );
    
    await bot.answerCallbackQuery(id, { text: 'Dose pulada.' });
    
  } catch (err) {
    console.error('Erro ao confirmar skip:', err);
    await bot.answerCallbackQuery(id, { 
      text: 'Erro ao pular dose.', 
      show_alert: true 
    });
  }
}

async function handleCancelSkipDose(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  // Parse: cancel_skip_:{protocolId}
  // eslint-disable-next-line no-unused-vars
  const [_, protocolId] = data.split(':');
  
  try {
    // Get state to restore original UI if possible
    const state = await getState(chatId);
    
    // Clear the state
    await clearState(chatId);
    
    // Restore original message or show cancellation message
    if (state && state.originalText && state.originalReplyMarkup) {
      // Restore original UI
      await bot.editMessageText(state.originalText, {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'MarkdownV2',
        reply_markup: state.originalReplyMarkup
      });
    } else {
      // Show cancellation message
      await bot.editMessageText(
        `✅ Ação cancelada\\. Nenhuma dose foi pulada\\.`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'MarkdownV2'
        }
      );
    }
    
    await bot.answerCallbackQuery(id, { text: 'Ação cancelada.' });
    
  } catch (err) {
    console.error('Erro ao cancelar skip:', err);
    await bot.answerCallbackQuery(id, { 
      text: 'Ação cancelada.', 
      show_alert: true 
    });
  }
}

async function handleSkipTimeout(bot, chatId, messageId) {
  try {
    // Check if state still exists (confirmation still pending)
    const state = await getState(chatId);
    
    if (!state || state.action !== 'skip_confirmation') {
      // Already confirmed, cancelled, or handled
      return;
    }
    
    // Clear the state
    await clearState(chatId);
    
    // Restore original UI or show timeout message
    if (state.originalText) {
      try {
        await bot.editMessageText(
          state.originalText + '\n\n_⏱️ Confirmação expirada\\._',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'MarkdownV2',
            reply_markup: state.originalReplyMarkup
          }
        );
      } catch {
        // Message may have been deleted, ignore
      }
    }
    
    console.log(`[SkipConfirmation] Timeout expired for chat ${chatId}`);
    
  } catch (err) {
    console.error('Erro no timeout de skip:', err);
  }
}
