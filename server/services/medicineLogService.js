import { supabase } from './supabase.js';
import { validateLogBulkArray } from '../../packages/core/src/schemas/logSchema.js';

/**
 * medicineLogService
 * Porta server-side para operações de logs de medicamentos.
 * Implementa padrão: Gravar logs -> Decrementar estoque (RPC FIFO).
 */
export const medicineLogService = {
  /**
   * Cria múltiplos logs e processa decremento de estoque.
   * @param {string} userId - UUID do usuário
   * @param {Array} logs - Lista de logs (protocol_id, medicine_id, quantity_taken, taken_at, notes)
   */
  async createMany(userId, logs) {
    // 0. Validar entrada (Golden Rule #10)
    const validation = validateLogBulkArray(logs);
    if (!validation.success) {
      console.error('[medicineLogService.createMany] Validation failed:', validation.errors);
      throw new Error(`Dados de log inválidos: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const validLogs = validation.data;
    if (validLogs.length === 0) return { success: true, count: 0 };

    // 1. Inserir logs
    const { data: createdLogs, error: logError } = await supabase
      .from('medicine_logs')
      .insert(validLogs.map(l => ({ ...l, user_id: userId })))
      .select('id, medicine_id, quantity_taken');

    if (logError) {
      console.error('[medicineLogService.createMany] Erro insert logs:', logError);
      throw logError;
    }

    // 2. Decrementar estoque (RPC FIFO) para cada log
    const results = [];
    for (const log of createdLogs) {
      const { error: consumeError } = await supabase.rpc('consume_stock_fifo', {
        p_user_id: userId,
        p_medicine_id: log.medicine_id,
        p_quantity: log.quantity_taken,
        p_medicine_log_id: log.id
      });

      if (consumeError) {
        console.warn(`[medicineLogService.createMany] Falha consume_stock_fifo para log ${log.id}:`, consumeError);
        // Rollback do log específico em caso de falha de estoque (conforme R-023: validar -> gravar -> decrementar)
        await supabase
          .from('medicine_logs')
          .delete()
          .eq('id', log.id)
          .eq('user_id', userId);
        
        results.push({ id: log.id, success: false, error: consumeError });
      } else {
        results.push({ id: log.id, success: true });
      }
    }

    return {
      success: results.some(r => r.success),
      count: results.filter(r => r.success).length,
      logs: createdLogs,
      results
    };
  }
};
