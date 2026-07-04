import { supabase, MOCK_USER_ID } from '../services/supabase.js';
import { calculateDaysRemaining } from '../utils/formatters.js';

export function handleInlineQueries(bot) {
  bot.on('inline_query', async (query) => {
    const searchTerm = query.query.toLowerCase().trim();
    
    try {
      // Search medicines
      const { data: medicines, error } = await supabase
        .from('medicines')
        .select(`
          *,
          stock(*),
          protocols!protocols_medicine_id_fkey(*)
        `)
        .eq('user_id', MOCK_USER_ID)
        .ilike('name', `%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      const results = medicines.map((medicine, index) => {
        // Calculate stock
        const activeStock = (medicine.stock || []).filter(s => s.quantity > 0);
        const totalQuantity = activeStock.reduce((sum, s) => sum + s.quantity, 0);
        
        // Calculate daily usage
        const activeProtocols = (medicine.protocols || []).filter(p => p.active);
        const dailyUsage = activeProtocols.reduce((sum, p) => {
          const timesPerDay = (p.time_schedule as any[])?.length || 0;
          const dosagePerIntake = p.dosage_per_intake || 0;
          return sum + (timesPerDay * dosagePerIntake);
        }, 0);

        const daysRemaining = calculateDaysRemaining(totalQuantity, dailyUsage);

        let description = `${medicine.active_ingredient || 'Sem princípio ativo'} - ${medicine.laboratory || 'Sem laboratório'}`;
        if (totalQuantity > 0) {
          description += `\n📦 Estoque: ${totalQuantity} ${medicine.dosage_unit || 'unidades'}`;
          if (daysRemaining !== null) {
            description += ` (~${daysRemaining} dias)`;
          }
        } else {
          description += '\n⚠️ Sem estoque';
        }

        const messageText = `💊 *${medicine.name}*\n` +
                           `🧪 ${medicine.active_ingredient || 'N/A'}\n` +
                           `🏭 ${medicine.laboratory || 'N/A'}\n` +
                           `📦 Estoque: ${totalQuantity} ${medicine.dosage_unit || 'unidades'}\n` +
                           (daysRemaining !== null ? `⏱️ ~${daysRemaining} dias restantes\n` : '') +
                           (activeProtocols.length > 0 ? `✅ ${activeProtocols.length} protocolo(s) ativo(s)` : '❌ Sem protocolos ativos');

        return {
          type: 'article',
          id: `${index}`,
          title: medicine.name,
          description: description,
          input_message_content: {
            message_text: messageText,
            parse_mode: 'Markdown'
          }
        };
      });

      // If no results, show a helpful message
      if (results.length === 0) {
        results.push({
          type: 'article',
          id: '0',
          title: 'Nenhum medicamento encontrado',
          description: `Nenhum resultado para "${searchTerm}"`,
          input_message_content: {
            message_text: `🔍 Nenhum medicamento encontrado para: *${searchTerm}*`,
            parse_mode: 'Markdown'
          }
        });
      }

      await bot.answerInlineQuery(query.id, results, {
        cache_time: 10,
        is_personal: true
      });
    } catch (err) {
      console.error('Erro no inline query:', err);
      
      // Return error result
      await bot.answerInlineQuery(query.id, [{
        type: 'article',
        id: '0',
        title: 'Erro ao buscar',
        description: 'Ocorreu um erro ao buscar medicamentos',
        input_message_content: {
          message_text: '❌ Erro ao buscar medicamentos. Tente novamente.'
        }
      }]);
    }
  });
}
