import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { setSession } from '../state.js';

export async function handleRegistrar(bot, msg) {
  const chatId = msg.chat && msg.chat.id;

  if (!chatId) return;

  try {
    // Get actual user ID from chat ID
    const userId = await getUserIdByChatId(chatId);
    
    // Fetch protocols for the linked user
    const { data: protocols, error } = await supabase
      .from('protocols')
      .select('id, medicine:medicines(id, name, dosage_unit)')
      .eq('user_id', userId)
      .eq('active', true);

    if (error) throw error;

    if (!protocols || protocols.length === 0) {
      return bot.sendMessage(chatId, 'Você não possui protocolos ativos no momento. Use o app web para cadastrar.');
    }

    // Create keyboard with medicine names using indices to avoid 64-byte limit
    const protocolMap = protocols.map((p, index) => ({
      index,
      medicineId: p.medicine.id,
      protocolId: p.id,
      medicineName: p.medicine.name
    }));
    
    const keyboard = protocols.map((p, index) => ([
      {
        text: p.medicine.name,
        callback_data: `reg_med:${index}`
      }
    ]));

    setSession(chatId, { 
      action: 'registrar_dose',
      protocolMap
    });

    await bot.sendMessage(chatId, '💊 Registrar dose manual\nQual medicamento você tomou?', {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (err) {
    console.error('Erro ao iniciar registro:', err);
    
    // Handle unlinked user case
    if (err.message === 'User not linked') {
      return bot.sendMessage(chatId, '❌ Conta não vinculada. Use /start para vincular.');
    }
    
    bot.sendMessage(chatId, '❌ Ocorreu um erro ao buscar seus medicamentos.');
  }
}