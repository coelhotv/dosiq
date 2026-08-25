// Spec 050 (PR 2) — content builder do `stock_expiry_alert` no drain da notification_outbox.
//
// Eixo VALIDADE (012 Fase A / ADR-059): TTL biológico pós-abertura, POR LOTE. O assunto da linha
// é `stock.id` — não `medicine_id`: dois lotes do mesmo medicamento vencem em dias diferentes e
// rendem alertas distintos.
//
// SEC-1 (ADR-078): a fila guarda só REFERÊNCIAS. Nome do medicamento e `daysLeft` são recalculados
// AQUI, no envio. Entre enfileirar (10:00) e drenar, o lote pode ter sido consumido ou apagado —
// nesses casos o builder devolve `null` e o drain marca a linha como `sent` sem enviar nada
// (`skippedNoContent`).

import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { _biologicalExpiryDaysLeft } from '../reminders/stockAlerts.js';

const logger = createLogger('StockExpiryContent');

/**
 * Payload do alerta de validade biológica de UM lote, recalculado agora.
 * @param subjectId `stock.id` do lote (assunto da linha da outbox).
 * @returns `{ medicineName, daysLeft }` ou `null` se o lote deixou de justificar alerta.
 */
export async function buildStockExpiryContent(
  { userId, subjectId }: { userId: string; subjectId: string | null }
): Promise<Record<string, unknown> | null> {
  // Linha sem assunto não é `stock_expiry_alert` válido (o fan-out sempre grava o id do lote).
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

  // `.eq('user_id', userId)` além do id: a linha da fila não pode virar leitura do lote de outro
  // usuário se o `subject_id` vier corrompido.
  const { data: lot, error: lotErr } = await supabase
    .from('stock')
    .select('id, user_id, medicine_id, quantity, opened_at, medicine:medicines(name, shelf_life_days)')
    .eq('id', subjectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (lotErr) throw new Error(`buildStockExpiryContent.stock: ${lotErr.message}`);
  // Lote apagado entre o enqueue e o envio.
  if (!lot) return null;
  // Lote consumido — mesmo predicado do enqueue e do legado.
  if (Number(lot.quantity || 0) <= 0) return null;

  // Mesmo cálculo do enqueue e do legado (uma implementação só — o SC-003 compara caminhos de
  // entrega, não contas diferentes). `null` = eixo inativo (lote fechado, sem TTL, data inválida).
  const daysLeft = _biologicalExpiryDaysLeft(lot);
  if (daysLeft === null) return null;
  // Fora da cadência D-3/D-0 não há alerta. Na prática o drain roda minutos depois do enqueue e
  // o valor não muda; a checagem existe para uma linha represada (retry no dia seguinte) não
  // entregar um alerta que já não corresponde ao lote.
  if (daysLeft !== 3 && daysLeft !== 0) {
    logger.info('Alerta de validade descartado no envio (fora da cadência D-3/D-0)', {
      userId, stockId: subjectId, daysLeft,
    });
    return null;
  }

  return {
    medicineName: (lot as any).medicine?.name || 'Medicamento',
    daysLeft,
  };
}
