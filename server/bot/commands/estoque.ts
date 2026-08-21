import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { calculateDaysRemaining, formatStockStatus } from '../../utils/formatters.js';
import { calculateDailyIntake, stockDoseMetrics, isProtocolVigentOn, getTodayLocal } from '@dosiq/core';
import { replyIfStockDisabled } from '../services/stockTrackingGuard.js';

export async function handleEstoque(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const userId = await getUserIdByChatId(chatId);

    // Dose-only (spec 044): convite de ativação em vez de saldo vazio / "estoque 0".
    if (await replyIfStockDisabled(bot, chatId, userId)) return;

    // Get all medicines with their stock and active protocols
    const { data: medicines, error: medError } = await supabase
      .from('medicines')
      .select(`
        *,
        stock(*),
        protocols!protocols_medicine_id_fkey(*)
      `)
      .eq('user_id', userId)
      .order('name');

    if (medError) throw medError;

    if (!medicines || medicines.length === 0) {
      return await bot.sendMessage(chatId, 'Você não possui medicamentos cadastrados\\.');
    }

    let message = '📦 *Estoque de Medicamentos:*\n\n';
    let hasLowStock = false;
    let hasMedicinesToShow = false;

    for (const medicine of medicines) {
      // 064: vigência (active + start/end_date). Tratamento encerrado não conta consumo
      // nem mantém o medicamento listado no /estoque.
      const activeProtocols = (medicine.protocols || []).filter(p => isProtocolVigentOn(p, getTodayLocal()));

      // Only show medicines with active protocols
      if (activeProtocols.length === 0) {
        continue;
      }

      hasMedicinesToShow = true;

      // Assuming each entry in stock represents a number of pills
      const totalQuantity = (medicine.stock || []).reduce((sum, s) => sum + s.quantity, 0);


      // 012 B4 / ADR-067 + FR-013c: consumo diário via core (converte líquido p/ ml +
      // aplica frequencyDailyFactor). Antes somava a dose crua (UI/gotas) contra o saldo
      // em ml → "0 dias" falso p/ insulina/GLP-1, igual ao cron (slice 1).
      const dailyUsage = calculateDailyIntake(medicine.id, activeProtocols, medicine);
      const daysRemaining = calculateDaysRemaining(totalQuantity, dailyUsage);
      const doseMetrics = stockDoseMetrics(totalQuantity, activeProtocols, medicine);

      message += formatStockStatus(medicine, totalQuantity, daysRemaining, doseMetrics) + '\n';

      if (daysRemaining !== null && daysRemaining <= 7) {
        hasLowStock = true;
      }
    }

    if (!hasMedicinesToShow) {
      return await bot.sendMessage(chatId, 'Não há medicamentos com protocolos ativos para exibir no estoque\\.');
    }

    if (hasLowStock) {
      message += '\n⚠️ *Atenção:* Alguns medicamentos estão com estoque baixo\\!';
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.error('Erro ao buscar estoque:', err);
    await bot.sendMessage(chatId, 'Erro ao buscar estoque\\.');
  }
}
