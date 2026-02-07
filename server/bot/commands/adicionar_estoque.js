import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { setSession } from '../state.js';

// Helper function to fetch medicines
async function fetchMedicines(userId, medicineName = null) {
  let query = supabase
    .from('medicines')
    .select('id, name, dosage_unit');

  query = query.eq('user_id', userId);

  if (medicineName) {
    query = query.ilike('name', `%${medicineName}%`);
  } else {
    query = query.order('name'); //Only order when fetching all
  }

  const { data: medicines, error } = await query;
  if (error) throw error;
  return medicines;
}


export async function handleAdicionarEstoque(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const userId = await getUserIdByChatId(chatId);
    const medicines = await fetchMedicines(userId);

    if (!medicines || medicines.length === 0) {
      return bot.sendMessage(chatId, 'Você não possui medicamentos cadastrados. Use o app web para cadastrar.');
    }

    // Create keyboard using indices to avoid 64-byte limit
    const medicineMap = medicines.map((m, index) => ({
      index,
      medicineId: m.id,
      medicineName: m.name,
      dosageUnit: m.dosage_unit
    }));
    
    const keyboard = medicines.map((m, index) => ([
      {
        text: m.name,
        callback_data: `add_stock_med:${index}`
      }
    ]));

    setSession(chatId, { 
      action: 'adicionar_estoque',
      medicineMap
    });

    await bot.sendMessage(chatId, '📦 *Adicionar ao Estoque*\nSelecione o medicamento:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (err) {
    if (err.message === 'User not linked') {
      return bot.sendMessage(chatId, '❌ Conta não vinculada. Use /start para vincular.');
    }
    console.error('Erro ao iniciar adição de estoque:', err);
    bot.sendMessage(chatId, '❌ Ocorreu um erro ao buscar seus medicamentos.');
  }
}

export async function handleReporShortcut(bot, msg, match) {
  const chatId = msg.chat.id;
  const medicineName = match[1]?.trim();
  const quantity = parseFloat(match[2]?.replace(',', '.'));

  if (!medicineName || isNaN(quantity)) {
    return bot.sendMessage(chatId, '⚠️ Uso correto: `/repor NomeDoRemedio Quantidade`\nEx: `/repor Entresto 20`', { parse_mode: 'Markdown' });
  }

  try {
    const userId = await getUserIdByChatId(chatId);
    const medicines = await fetchMedicines(userId, medicineName);

    if (!medicines || medicines.length === 0) {
      return bot.sendMessage(chatId, `❌ Medicamento "${medicineName}" não encontrado.`);
    }

    if (medicines.length > 1) {
      // Multiple matches, ask to select using indices to avoid 64-byte limit
      const medicineMap = medicines.map((m, index) => ({
        index,
        medicineId: m.id,
        medicineName: m.name
      }));
      
      const keyboard = medicines.map((m, index) => ([
        { text: m.name, callback_data: `add_stock_med_val:${index}:${quantity}` }
      ]));
      
      setSession(chatId, { 
        action: 'adicionar_estoque',
        medicineMap
      });
      
      return bot.sendMessage(chatId, 'Foram encontrados vários medicamentos. Selecione um:', {
        reply_markup: { inline_keyboard: keyboard }
      });
    }

    // Single match, add immediately
    await processAddStock(bot, chatId, userId, medicines[0].id, quantity, medicines[0].name);

  } catch (err) {
    if (err.message === 'User not linked') {
      return bot.sendMessage(chatId, '❌ Conta não vinculada. Use /start para vincular.');
    }
    console.error('Erro no atalho de repor:', err);
    bot.sendMessage(chatId, '❌ Ocorreu um erro ao processar sua solicitação.');
  }
}

export async function processAddStock(bot, chatId, userId, medicineId, quantity, medicineName) {
  try {
    const { error } = await supabase
      .from('stock')
      .insert([{
        user_id: userId,
        medicine_id: medicineId,
        quantity: quantity,
        purchase_date: new Date().toISOString().split('T')[0]
      }]);

    if (error) throw error;

    await bot.sendMessage(chatId, `✅ Adicionado *${quantity}x* ao estoque de *${medicineName}*!`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Erro ao adicionar estoque:', err);
    bot.sendMessage(chatId, '❌ Erro ao atualizar estoque.');
  }
}
