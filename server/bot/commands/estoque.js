import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { calculateDaysRemaining, formatStockStatus } from '../../utils/formatters.js';

export async function handleEstoque(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const userId = await getUserIdByChatId(chatId);

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
      const activeProtocols = (medicine.protocols || []).filter(p => p.active);

      // Only show medicines with active protocols
      if (activeProtocols.length === 0) {
        continue;
      }

      hasMedicinesToShow = true;

      // Assuming each entry in stock represents a number of pills
      const totalQuantity = (medicine.stock || []).reduce((sum, s) => sum + s.quantity, 0);


      // Calculate daily usage from active protocols
      const dailyUsage = activeProtocols.reduce((sum, p) => {
        const timesPerDay = p.time_schedule?.length || 0;
        const dosagePerIntake = p.dosage_per_intake || 0;
        return sum + (timesPerDay * dosagePerIntake);
      }, 0);

      const daysRemaining = calculateDaysRemaining(totalQuantity, dailyUsage);

      message += formatStockStatus(medicine, totalQuantity, daysRemaining) + '\n';

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
