// Spec 050 (PR 1b) — content builder do `stock_alert` no drain da notification_outbox.
//
// SEC-1 (ADR-078): a fila guarda só REFERÊNCIAS (user_id + medicine_id em `subject_id`). Nome do
// medicamento, saldo e dias restantes são recalculados AQUI, no momento do envio — nunca lidos de
// um payload congelado no enqueue. Entre enfileirar (10:00) e drenar, o usuário pode ter reposto o
// estoque, encerrado o tratamento ou apagado o medicamento: nesses casos o builder devolve `null`
// e o drain marca a linha como `sent` sem enviar nada (`skippedNoContent`).

import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { _buildProtocolsAndStockMaps, _computeStockAlertPayload } from '../reminders/stockAlerts.js';

const logger = createLogger('StockAlertContent');

/**
 * Payload do alerta de estoque baixo de UM medicamento, recalculado agora.
 * @returns `{ medicineName, remaining, daysRemaining }` ou `null` se deixou de estar baixo.
 */
export async function buildStockAlertContent(
  { userId, subjectId }: { userId: string; subjectId: string | null }
): Promise<Record<string, unknown> | null> {
  // Linha sem assunto não é `stock_alert` válido (o fan-out sempre grava medicine_id).
  if (!subjectId) return null;

  // Opt-out explícito revalidado NO ENVIO (044/FR-006): quem desligou o controle de estoque entre
  // o enqueue e o drain não recebe o alerta que já estava na fila. Fail-safe AP-277: erro de
  // leitura ou coluna NULL = tracking LIGADO — a ausência de dado nunca silencia alerta.
  const { data: settings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('stock_tracking_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (settingsErr) {
    logger.error('Falha ao reler a preferência de estoque no envio — seguindo como LIGADO (AP-277)', settingsErr, { userId });
  } else if (settings?.stock_tracking_enabled === false) {
    return null;
  }

  // Mesmo predicado de vigência do scan (050 US4/FR-009): tratamento encerrado ou pausado entre
  // o enqueue e o envio não gera alerta. Data local via Intl (R-020/R-254) — `end_date` é `date`
  // e o wall-clock UTC do servidor já é o dia seguinte às 21h em GMT−3.
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
    .format(Date.now());

  const { data: protocols, error: protocolsErr } = await supabase
    .from('protocols')
    .select('id, user_id, medicine_id, time_schedule, dosage_per_intake, intake_unit, frequency, weekdays, active, end_date, paused_at')
    .eq('user_id', userId)
    .eq('medicine_id', subjectId)
    .eq('active', true)
    .is('paused_at', null)
    // `.or` obrigatório: `end_date IS NULL` é a maioria dos protocolos; um `.gte` sozinho
    // silenciaria todos os alertas.
    .or(`end_date.is.null,end_date.gte.${todayLocal}`);

  if (protocolsErr) throw new Error(`buildStockAlertContent.protocols: ${protocolsErr.message}`);
  if (!protocols || protocols.length === 0) return null;

  const { data: stockRows, error: stockErr } = await supabase
    .from('stock')
    .select('user_id, medicine_id, quantity, medicine:medicines(name, units_per_ml, dosage_unit, dosage_per_pill)')
    .eq('user_id', userId)
    .eq('medicine_id', subjectId);

  if (stockErr) throw new Error(`buildStockAlertContent.stock: ${stockErr.message}`);
  if (!stockRows || stockRows.length === 0) return null;

  // Mesma agregação por (usuário, medicamento) do caminho legado — soma dos LOTES.
  const { stockByMedicine } = _buildProtocolsAndStockMaps(protocols, stockRows);
  const stock = stockByMedicine[`${userId}_${subjectId}`];
  if (!stock) return null;

  const payload = _computeStockAlertPayload(subjectId, stock, protocols);
  if (!payload) {
    logger.info('Alerta de estoque descartado no envio (deixou de estar baixo)', { userId, medicineId: subjectId });
    return null;
  }
  return payload as unknown as Record<string, unknown>;
}
