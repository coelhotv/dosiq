// Spec 050 (PR 1b) — enfileiramento do `stock_alert` na notification_outbox com FAN-OUT.
//
// Diferença estrutural em relação a `enqueueReports` (043): aqui há UMA linha por MEDICAMENTO
// (subject_id = medicine_id), não uma por usuário/período. É o que a coluna `subject_id` +
// a UNIQUE (user_id, kind, period_key, subject_id) do PR 1a passaram a expressar.
//
// SEC-1 (ADR-078): a fila guarda SÓ referências — nome do medicamento, saldo e dias nascem no
// envio (`stockAlertContent.ts`), nunca aqui.
//
// 🔴 GATE DA FLAG: sem `kinds.has('stock_alert')` este módulo manda alerta EM DOBRO no próprio
// deploy. O claim (`claim_notification_outbox(batch_limit)`) NÃO filtra kind e o drain envia toda
// linha que tenha builder registrado; o legado (`api/notify.ts`, guard `!OUTBOX_KINDS.has(...)`)
// continua ligado enquanto o cutover (PR 2) não acontecer. Enfileirar sem gate = os dois caminhos
// entregando o mesmo alerta, todo dia, sem ninguém tocar em env nenhuma.

import { periodKey } from '../../notifications/outbox/periodKey.js';
import {
  _fetchStockTrackingUsers,
  _scanStockAlertCandidates,
  _computeStockAlertPayload,
} from '../_reminderHelpers.js';

// Âncora do alerta de volume: 10:00–10:09 na TZ DO USUÁRIO.
// - `minute < 10` em vez de `minute === 0` (o do legado): família AP-259 — um tick que pule o
//   minuto exato perde o dia inteiro. A UNIQUE dá a idempotência dentro da janela.
// - Janela estreita (e não "todo tick"): a fila resolve idempotência, não CUSTO — varrer
//   protocols+stock 1440×/dia seriam duas queries pesadas por minuto.
const ALERT_HOUR = 10;
const WINDOW_MINUTES = 10;

/** Hora/minuto locais do usuário para um instante absoluto (Intl — DST-safe, R-254). */
function localHourMinute(now: Date, tz: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const val = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  let hour = parseInt(val('hour'), 10);
  if (hour === 24) hour = 0; // en-US hour12:false pode emitir '24' à meia-noite
  return { hour, minute: parseInt(val('minute'), 10) || 0 };
}

function isInAlertWindow(now: Date, tz: string): boolean {
  const { hour, minute } = localHourMinute(now, tz);
  return hour === ALERT_HOUR && minute < WINDOW_MINUTES;
}

export interface EnqueueStockAlertsResult {
  usersInWindow: number;
  // Linhas TENTADAS, não inseridas: o upsert com ignoreDuplicates não expõe quantas de fato
  // entraram. Dentro da janela de 10min os ticks seguintes repetem as mesmas linhas (no-op na
  // UNIQUE) — ler este número como "envios" superestimaria em ~10×.
  attempted: number;
}

/**
 * Enfileira um `stock_alert` por medicamento com estoque baixo, para os usuários cuja hora local
 * está na janela do alerta.
 *
 * @param kinds kinds servidos pela outbox (OUTBOX_KINDS). Sem `stock_alert` → NO-OP total.
 */
export async function enqueueStockAlerts(
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto do tick, tz aplicada via Intl
  { repo, kinds, now = new Date(), correlationId, logger }:
  {
    repo: { enqueue(entries: any[]): Promise<number> };
    kinds: Set<string>;
    now?: Date;
    correlationId?: string;
    logger?: { info: (...a: any[]) => void; error: (...a: any[]) => void };
  }
): Promise<EnqueueStockAlertsResult> {
  const empty: EnqueueStockAlertsResult = { usersInWindow: 0, attempted: 0 };
  if (!kinds.has('stock_alert')) return empty;

  const users = await _fetchStockTrackingUsers(correlationId);
  if (users.length === 0) return empty;

  // Filtra ANTES da varredura: fora da janela, nenhuma das duas queries pesadas roda.
  const usersInWindow = users.filter((u: any) => {
    try {
      return isInAlertWindow(now, u.timezone || 'America/Sao_Paulo');
    } catch (err: any) {
      // tz corrompida no DB → Intl lança RangeError. Isolar por usuário (Gemini #734): um
      // registro inválido não pode derrubar o enqueue de todos os outros.
      // Assinatura do logger do bot: (mensagem, erro, dados) — metadados no 3º argumento.
      logger?.error('[enqueueStockAlerts] tz inválida — usuário pulado', err, {
        userId: u.user_id, correlationId,
      });
      return false;
    }
  });
  if (usersInWindow.length === 0) return empty;

  const { protocolsByMedicine, stockByMedicine } =
    await _scanStockAlertCandidates(usersInWindow, correlationId);

  const tzByUser = new Map<string, string>(
    usersInWindow.map((u: any) => [u.user_id, u.timezone || 'America/Sao_Paulo'])
  );

  const entries: any[] = [];
  for (const key in stockByMedicine) {
    // UUID não contém '_', então a chave `${user_id}_${medicine_id}` é separável (mesma
    // convenção do caminho legado, `_buildProtocolsAndStockMaps`).
    const [userId, medicineId] = key.split('_');
    const protocols = protocolsByMedicine[key] || [];
    if (protocols.length === 0) continue;

    // Mesmo predicado do legado (daysRemaining < 7, consumo diário > 0) — uma implementação só.
    const payload = _computeStockAlertPayload(medicineId, stockByMedicine[key], protocols);
    if (!payload) continue;

    entries.push({
      userId,
      kind: 'stock_alert',
      periodKey: periodKey('stock_alert', now, tzByUser.get(userId) || 'America/Sao_Paulo'),
      subjectId: medicineId,
    });
  }

  if (entries.length === 0) return { usersInWindow: usersInWindow.length, attempted: 0 };

  await repo.enqueue(entries);
  logger?.info('[enqueueStockAlerts] linhas tentadas na fila', {
    correlationId, usersInWindow: usersInWindow.length, attempted: entries.length,
  });
  return { usersInWindow: usersInWindow.length, attempted: entries.length };
}
