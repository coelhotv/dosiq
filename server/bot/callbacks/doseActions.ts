import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { medicineLogService } from '../../services/medicineLogService.js';
import { calculateDaysRemaining, escapeMarkdownV2 } from '../../utils/formatters.js';
import { setState, getState, clearState } from '../state.js';
import { partitionDoses } from '../utils/partitionDoses.js';
import { getServerTimestamp, addDays, addMinutes, parseISO } from '../../utils/dateUtils.js';
import { createDoseInstanceRepository, computeStreakFromInstances } from '@dosiq/core';
import { createLogger } from '../logger.js';

const SKIP_CONFIRMATION_TIMEOUT_MS = 30000; // 30 seconds

const logger = createLogger('DoseActions');
// Mesmo client service_role do bot; o snap/markTaken escopam por protocol_id (AP-A03).
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase as any }); // TODO(040-strict): dual @supabase/supabase-js version (server 2.90.1 vs root 2.105.4)

/**
 * Âncora de log → instância (S2.6/ADR-048, best-effort). Snap por tolerância (escopo
 * protocol_id), marca a instância `taken` + grava o elo bidirecional. NUNCA lança: o
 * log já está persistido; falha de âncora deixa a dose avulsa (reconciliável por backfill).
 * @param {string} userId
 * @param {string} protocolId
 * @param {string} logId
 * @param {string} takenAt - mesmo timestamp usado no insert do log
 * @returns {Promise<void>}
 */
async function anchorLogToInstance(userId, protocolId, logId, takenAt) {
  if (!protocolId) return;
  try {
    const instance = await doseInstanceRepo.findAnchorInstance({ protocolId, takenAt });
    if (!instance) return;

    // Só grava o elo no log se a reserva da instância pegou (evita elo órfão em corrida).
    const marked = await doseInstanceRepo.markTaken(instance.id, logId);
    if (!marked) return;

    const { error } = await supabase
      .from('medicine_logs')
      .update({ dose_instance_id: instance.id })
      .eq('id', logId)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (anchorError) {
    logger.warn('Falha ao ancorar log à instância (segue avulso)', anchorError);
  }
}

export async function handleCallbacks(bot) {
  bot.on('callback_query', async (callbackQuery) => {
    const { data } = callbackQuery;

    if (data.startsWith('take_')) {
      await handleTakeDose(bot, callbackQuery);
    } else if (data.startsWith('snooze_')) {
      await handleSnoozeDose(bot, callbackQuery);
    } else if (data.startsWith('skip_')) {
      await handleSkipDose(bot, callbackQuery);
    } else if (data.startsWith('confirm_skip_')) {
      await handleConfirmSkipDose(bot, callbackQuery);
    } else if (data.startsWith('cancel_skip_')) {
      await handleCancelSkipDose(bot, callbackQuery);
    } else if (data.startsWith('takeplan:')) {
      await handleTakePlan(bot, callbackQuery);
    } else if (data.startsWith('takelist:')) {
      await handleTakeList(bot, callbackQuery);
    }
  });
}

async function resolveProtocolMedicine(protocolId) {
  const { data: protocol, error } = await supabase
    .from('protocols')
    .select('medicine_id, medicine:medicines(name, dosage_unit)')
    .eq('id', protocolId)
    .single();

  if (error || !protocol) throw new Error('Protocolo não encontrado');
  // TODO(040-strict): tipar o shape do join medicine:medicines na fronteira (nível B — F6)
  return { medicineId: protocol.medicine_id, medicineName: (protocol.medicine as any).name };
}

async function createLogAndConsumeStock(userId, protocolId, medicineId, quantity) {
  // Captura o timestamp UMA vez: mesmo valor no insert e no snap da âncora.
  const takenAt = getServerTimestamp();
  const { data: createdLogs, error: logError } = await supabase
    .from('medicine_logs')
    .insert([{
      user_id: userId,
      protocol_id: protocolId,
      medicine_id: medicineId,
      quantity_taken: quantity,
      taken_at: takenAt
    }])
    .select('id')
    .single();

  if (logError) throw logError;

  const { error: consumeError } = await supabase.rpc('consume_stock_fifo', {
    p_user_id: userId,
    p_medicine_id: medicineId,
    p_quantity: quantity,
    p_medicine_log_id: createdLogs.id
  });

  if (consumeError) {
    await supabase.from('medicine_logs').delete().eq('id', createdLogs.id).eq('user_id', userId);
    throw consumeError;
  }

  // Âncora de log → instância (best-effort, após estoque OK).
  await anchorLogToInstance(userId, protocolId, createdLogs.id, takenAt);
}

async function calculateAdherenceAndStockWarnings(userId, medicineId) {
  const { data: updatedStock } = await supabase
    .from('stock')
    .select('quantity')
    .eq('medicine_id', medicineId)
    .eq('user_id', userId)
    .gt('quantity', 0);

  const totalQuantity = updatedStock?.reduce((sum, s) => sum + s.quantity, 0) || 0;
  
  const { data: activeProtocols } = await supabase
    .from('protocols')
    .select('time_schedule, dosage_per_intake')
    .eq('medicine_id', medicineId)
    .eq('user_id', userId)
    .eq('active', true);

  const dailyUsage = activeProtocols?.reduce((sum, p) => sum + (((p.time_schedule as any[])?.length || 0) * (p.dosage_per_intake || 0)), 0) || 0;
  const daysRemaining = calculateDaysRemaining(totalQuantity, dailyUsage);
  
  // Streak ← dose_instances (S3.7): dias consecutivos ≥80% por status, não infere sobre logs.
  // Janela UTC real via getServerTimestamp (getNow() é wall-clock SP → desloca 3h vs UTC). 1 chamada.
  const nowIso = getServerTimestamp();
  const instances = await doseInstanceRepo.getWindow(
    userId, addDays(nowIso, -90).toISOString(), nowIso
  );
  const streak = computeStreakFromInstances(instances);
  return { daysRemaining, streak };
}

function buildConfirmationMessage(medicineName, streak, daysRemaining) {
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
  return confirmMsg;
}

async function handleTakeDose(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  const [_, protocolId, quantity] = data.split(':');
  
  try {
    const userId = await getUserIdByChatId(chatId);
    const { medicineId, medicineName } = await resolveProtocolMedicine(protocolId);
    
    await createLogAndConsumeStock(userId, protocolId, medicineId, parseFloat(quantity));
    
    const { daysRemaining, streak } = await calculateAdherenceAndStockWarnings(userId, medicineId);
    const confirmMsg = buildConfirmationMessage(medicineName, streak, daysRemaining);

    const quickActions = {
      inline_keyboard: [
        [
          { text: '📊 Ver Hoje', callback_data: 'cmd:hoje' },
          { text: '📦 Ver Estoque', callback_data: 'quick_stock' }
        ]
        // "Registrar Outra" (quick_register) removido — fluxo /registrar desativado (022 Fase C)
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
    if (err.message === 'User not linked') {
      try {
        await bot.answerCallbackQuery(id, { text: 'Conta não vinculada. Use /start para vincular.', show_alert: true });
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

    const medicineName = (protocol.medicine as any)?.name || 'Medicamento';
    
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
    
    // Wire skip to database dose_instances: status = 'skipped_user'
    const nowIso = getServerTimestamp();
    const instance = await doseInstanceRepo.findAnchorInstance({ protocolId, takenAt: nowIso });
    if (instance) {
      const { data: updatedRows, error: updateError } = await supabase
        .from('dose_instances')
        .update({ status: 'skipped_user' })
        .eq('id', instance.id)
        .in('status', ['pending', 'missed'])
        .select('id');
      if (updateError) {
        logger.error('Erro ao marcar dose_instance como skipped_user no Telegram:', updateError);
        throw updateError;
      }
      if (!updatedRows || updatedRows.length === 0) {
        await bot.answerCallbackQuery(id, { text: 'Esta dose já foi registrada ou pulada.', show_alert: true });
        return;
      }
    } else {
      logger.info('Nenhuma dose_instance pendente encontrada para pular no Telegram:', { protocolId });
      await bot.answerCallbackQuery(id, { text: 'Nenhuma dose pendente encontrada para pular.', show_alert: true });
      return;
    }
    
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

async function handleSnoozeDose(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  const [_, protocolId] = data.split(':');

  try {
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

    const medicineName = (protocol.medicine as any)?.name || 'Medicamento';

    // Busca ocorrência pendente ou perdida dentro da janela de tolerância para adiar
    const nowIso = getServerTimestamp();
    const instance = await doseInstanceRepo.findAnchorInstance({ protocolId, takenAt: nowIso });

    if (!instance) {
      await bot.answerCallbackQuery(id, {
        text: 'Nenhuma dose pendente ou em tolerância para adiar.',
        show_alert: true
      });
      return;
    }

    const nextTs = addMinutes(5, parseISO(getServerTimestamp())).toISOString();

    // Atualiza o snoozed_until no banco e reseta notified_at para null para o cron re-alertar
    const { data: updatedRows, error: updateError } = await supabase
      .from('dose_instances')
      .update({
        snoozed_until: nextTs,
        notified_at: null
      })
      .eq('id', instance.id)
      .in('status', ['pending', 'missed'])
      .select('id');

    if (updateError) throw updateError;
    if (!updatedRows || updatedRows.length === 0) {
      await bot.answerCallbackQuery(id, {
        text: 'Esta dose já foi registrada ou não está mais pendente.',
        show_alert: true
      });
      return;
    }

    // Edita a mensagem para confirmar a soneca e remover os botões
    await bot.editMessageText(
      `⏰ Soneca ativada para *${escapeMarkdownV2(medicineName)}*\\. Te lembrarei novamente em 5 minutos\\.`,
      {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] }
      }
    );

    await bot.answerCallbackQuery(id, { text: 'Soneca de 5 minutos ativada!' });
  } catch (err) {
    console.error('Erro ao processar snooze:', err);
    await bot.answerCallbackQuery(id, {
      text: 'Erro ao adiar a dose.',
      show_alert: true
    });
  }
}

async function handleCancelSkipDose(bot, callbackQuery) {
  const { data, message, id } = callbackQuery;
  const chatId = message.chat.id;
  
  // Parse: cancel_skip_:{protocolId}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const parts = data.split(':');
  const planIdShort = parts[1];
  const hhmm = parts.slice(2).join(':'); // '23:15' contém ':', split produz 4 partes

  try {
    const userId = await getUserIdByChatId(chatId);

    const { data: allActive, error: protocolsError } = await supabase
      .from('protocols')
      .select('id, medicine_id, dosage_per_intake, treatment_plan_id, time_schedule, medicine:medicines(name), treatment_plan:treatment_plans(id, name)')
      .eq('user_id', userId)
      .eq('active', true)
      .not('treatment_plan_id', 'is', null);

    if (protocolsError) {
      console.error('[handleTakePlan] Supabase error:', protocolsError);
      throw protocolsError;
    }

    // Filter: horário matches + planId starts with
    const validProtocols = (allActive || []).filter(p =>
      (p.time_schedule as any[] || []).includes(hhmm) &&
      p.treatment_plan_id?.startsWith(planIdShort)
    );
    console.log(`[handleTakePlan] validProtocols: ${validProtocols.length}`);


    if (!validProtocols.length) {
      await bot.answerCallbackQuery(id, { text: 'Nenhuma dose pendente encontrada para este plano e horário.', show_alert: true });
      return;
    }

    const planName = (validProtocols[0].treatment_plan as any)?.name || 'Plano';

    const logsToSave = validProtocols.map((p) => ({
      protocol_id: p.id,
      medicine_id: p.medicine_id,
      quantity_taken: p.dosage_per_intake,
      taken_at: getServerTimestamp(),
      notes: `[Plano: ${planName}] Registrar agora (Telegram)`
    }));

    const result = await medicineLogService.createMany(userId, logsToSave);
    console.log(`[handleTakePlan] success: ${result.count} doses registered for user ${userId}`);

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

  const parts = data.split(':');
  const hhmm = parts.slice(2).join(':');

  try {
    const userId = await getUserIdByChatId(chatId);

    const { data: allActive, error: protocolsError } = await supabase
      .from('protocols')
      .select('id, user_id, name, time_schedule, medicine_id, dosage_per_intake, treatment_plan_id, medicine:medicines(name), treatment_plan:treatment_plans(id, name)')
      .eq('user_id', userId)
      .eq('active', true);

    if (protocolsError) throw protocolsError;

    const dosesNow = (allActive || [])
      .filter(p => (p.time_schedule as any[] || []).includes(hhmm))
      .map(p => ({
        protocolId: p.id,
        protocolName: p.name,
        medicineName: (p.medicine as any)?.name || 'Medicamento',
        treatmentPlanId: p.treatment_plan_id ?? null,
        treatmentPlanName: (p.treatment_plan as any)?.name ?? null,
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
      taken_at: getServerTimestamp(),
      notes: 'Doses avulsas registradas via Telegram'
    }));

    const result = await medicineLogService.createMany(userId, logsToSave);
    console.log(`[handleTakeList] success: ${result.count} doses registradas para user ${userId}`);

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

