import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { calculateDaysRemaining, calculateStreak } from '../../utils/formatters.js';

export async function handleCallbacks(bot) {
  bot.on('callback_query', async (callbackQuery) => {
    const { data } = callbackQuery;

    if (data.startsWith('take_')) {
      await handleTakeDose(bot, callbackQuery);
    } else if (data.startsWith('skip_')) {
      await handleSkipDose(bot, callbackQuery);
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
    let confirmMsg = `✅ Dose de *${medicineName}* registrada!`;
    
    if (streak > 1) {
      confirmMsg += `\n🔥 *${streak} dias seguidos!*`;
    }
    
    if (daysRemaining !== null && daysRemaining <= 7) {
      if (daysRemaining <= 0) {
        confirmMsg += `\n\n⚠️ *ATENÇÃO:* Estoque zerado!`;
      } else {
        confirmMsg += `\n\n⚠️ Estoque baixo: ~${daysRemaining} dias restantes`;
      }
    }

    await bot.editMessageText(confirmMsg, {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'Markdown'
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
  const { message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  await bot.answerCallbackQuery(id, { text: 'Dose pulada.' });
  
  try {
    await bot.editMessageText(`❌ Dose de *${message.text.split('\n')[2]?.replace('💊 ', '') || 'Medicamento'}* pulada.`, {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error('Erro ao editar mensagem de pular:', err);
  }
}
