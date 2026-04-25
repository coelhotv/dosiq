import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { medicineLogService } from '../../services/medicineLogService.js';
import { calculateDaysRemaining, calculateStreak, escapeMarkdownV2 } from '../../utils/formatters.js';
import { setState, getState, clearState } from '../state.js';
import { partitionDoses } from '../utils/partitionDoses.js';

const SKIP_CONFIRMATION_TIMEOUT_MS = 30000; // 30 seconds

export async function handleCallbacks(bot) {
  bot.on('callback_query', async (callbackQuery) => {
    const { data } = callbackQuery;
    console.log(`[doseActions] callback_query received: ${data}`);

    if (data.startsWith('take_')) {
      console.log('[doseActions] Routing to handleTakeDose');
      await handleTakeDose(bot, callbackQuery);
    } else if (data.startsWith('skip_')) {
      console.log('[doseActions] Routing to handleSkipDose');
      await handleSkipDose(bot, callbackQuery);
    } else if (data.startsWith('confirm_skip_')) {
      await handleConfirmSkipDose(bot, callbackQuery);
    } else if (data.startsWith('cancel_skip_')) {
      await handleCancelSkipDose(bot, callbackQuery);
    } else if (data.startsWith('takeplan:')) {
      console.log('[doseActions] Routing to handleTakePlan');
      await handleTakePlan(bot, callbackQuery);
    } else if (data.startsWith('takelist:')) {
      console.log('[doseActions] Routing to handleTakeList');
      await handleTakeList(bot, callbackQuery);
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
    const { data: createdLogs, error: logError } = await supabase
      .from('medicine_logs')
      .insert([{
        user_id: userId,
        protocol_id: protocolId,
        medicine_id: medicineId,
        quantity_taken: parseFloat(quantity),
        taken_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (logError) throw logError;

    // 3. Decrementar Estoque via RPC FIFO (overload server-side com p_user_id explícito)
    // Bot usa service_role → auth.uid() = NULL → usar overload de 4 parâmetros
    const { error: consumeError } = await supabase.rpc('consume_stock_fifo', {
      p_user_id: userId,
      p_medicine_id: medicineId,
      p_quantity: parseFloat(quantity),
      p_medicine_log_id: createdLogs.id
    });

    if (consumeError) {
      await supabase
        .from('medicine_logs')
        .delete()
        .eq('id', createdLogs.id)
        .eq('user_id', userId);

      throw consumeError;
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
        confirmMsg += `\n\n⚠️ Estoque baixo: \\~${daysRemaining} dias restantes`;
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

async function handleTakePlan(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;

  const [_, planIdShort, hhmm] = data.split(':');

  try {
    const userId = await getUserIdByChatId(chatId);

    const { data: allActive, error: protocolsError } = await supabase
      .from('protocols')
      .select('id, medicine_id, dosage_per_intake, treatment_plan_id, time_schedule, medicine:medicines(name), treatment_plan:treatment_plans(id, name)')
      .eq('user_id', userId)
      .eq('active', true)
      .contains('time_schedule', [hhmm])
      .not('treatment_plan_id', 'is', null);

    if (protocolsError) throw protocolsError;
    
    // Filter matching the start of planId
    const validProtocols = (allActive || []).filter(p => 
      p.treatment_plan_id?.startsWith(planIdShort)
    );


    if (!validProtocols.length) {
      await bot.answerCallbackQuery(id, { text: 'Nenhuma dose pendente encontrada para este plano e horário.', show_alert: true });
      return;
    }

    const planName = validProtocols[0].treatment_plan?.name || 'Plano';

    const logsToSave = validProtocols.map((p) => ({
      protocol_id: p.id,
      medicine_id: p.medicine_id,
      quantity_taken: p.dosage_per_intake,
      taken_at: new Date().toISOString(),
      notes: `[Plano: ${planName}] Registrar agora (Telegram)`
    }));

    const result = await medicineLogService.createMany(userId, logsToSave);

    if (!result.success) throw new Error('Falha ao registrar doses do plano');

    const confirmMsg = `✅ *${result.count} doses* do plano *${escapeMarkdownV2(planName)}* registradas\\!`;

    await bot.editMessageText(confirmMsg, {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: [] }
    });
    
    await bot.answerCallbackQuery(id, { text: `✅ ${validProtocols.length} doses registradas!` });
  } catch (err) {
    console.error('Erro ao registrar takeplan:', err);
    try {
      await bot.answerCallbackQuery(id, { text: 'Erro ao registrar doses.', show_alert: true });
    } catch { /* ignore */ }
  }
}

async function handleTakeList(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;

  const [_, _type, hhmm] = data.split(':');

  try {
    const userId = await getUserIdByChatId(chatId);

    const { data: allActive, error: protocolsError } = await supabase
      .from('protocols')
      .select('id, user_id, name, time_schedule, medicine_id, dosage_per_intake, treatment_plan_id, medicine:medicines(name), treatment_plan:treatment_plans(id, name)')
      .eq('user_id', userId)
      .eq('active', true)
      .contains('time_schedule', [hhmm]);

    if (protocolsError) throw protocolsError;
    
    const dosesNow = allActive
      .filter(p => (p.time_schedule || []).includes(hhmm))
      .map(p => ({
        protocolId: p.id,
        protocolName: p.name,
        medicineName: p.medicine?.name || 'Medicamento',
        treatmentPlanId: p.treatment_plan_id ?? null,
        treatmentPlanName: p.treatment_plan?.name ?? null,
        dosagePerIntake: p.dosage_per_intake ?? 1,
        medicineId: p.medicine_id,
      }));

    const blocks = partitionDoses(dosesNow);
    const miscBlock = blocks.find(b => b.kind === 'misc');

    if (!miscBlock || !miscBlock.doses.length) {
      await bot.answerCallbackQuery(id, { text: 'Nenhuma dose pendente encontrada para esta lista.', show_alert: true });
      return;
    }

    const logsToSave = miscBlock.doses.map((p) => ({
      protocol_id: p.protocolId,
      medicine_id: p.medicineId,
      quantity_taken: p.dosagePerIntake,
      taken_at: new Date().toISOString(),
      notes: 'Doses avulsas registradas via Telegram'
    }));

    const result = await medicineLogService.createMany(userId, logsToSave);

    if (!result.success) throw new Error('Falha ao registrar doses avulsas');

    const confirmMsg = `✅ *${result.count} doses* avulsas registradas\\!`;

    await bot.editMessageText(confirmMsg, {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: [] }
    });
    
    await bot.answerCallbackQuery(id, { text: `✅ ${miscBlock.doses.length} doses registradas!` });
  } catch (err) {
    console.error('Erro ao registrar takelist:', err);
    try {
      await bot.answerCallbackQuery(id, { text: 'Erro ao registrar doses.', show_alert: true });
    } catch { /* ignore */ }
  }
}

