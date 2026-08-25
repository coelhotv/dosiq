// Spec 050 (PR 1b/PR 2) — enfileiramento dos alertas de estoque na notification_outbox com FAN-OUT.
//
// Diferença estrutural em relação a `enqueueReports` (043): aqui há UMA linha por ASSUNTO, não uma
// por usuário/período. É o que a coluna `subject_id` + a UNIQUE (user_id, kind, period_key,
// subject_id) do PR 1a passaram a expressar. São DOIS eixos, com assuntos diferentes:
//   `stock_alert`        → volume baixo    · subject_id = medicine_id (agrega os lotes)
//   `stock_expiry_alert` → validade (D-3/D-0) · subject_id = stock.id (o LOTE, 012 Fase A/ADR-059)
//
// Os dois eixos vivem no MESMO job legado (`checkStockAlerts` faz volume e validade na mesma
// chamada), então migram juntos no cutover — daí os dois kinds no mesmo módulo.
//
// SEC-1 (ADR-078): a fila guarda SÓ referências — nome do medicamento, saldo e dias nascem no
// envio (`stockAlertContent.ts`), nunca aqui.
//
// 🔴 GATE DA FLAG: sem `kinds.has(...)` este módulo manda alerta EM DOBRO no próprio
// deploy. O claim (`claim_notification_outbox(batch_limit)`) NÃO filtra kind e o drain envia toda
// linha que tenha builder registrado; o legado (`api/notify.ts`, guard `!OUTBOX_KINDS.has(...)`)
// continua ligado enquanto o cutover (PR 2) não acontecer. Enfileirar sem gate = os dois caminhos
// entregando o mesmo alerta, todo dia, sem ninguém tocar em env nenhuma.

import { periodKey } from '../../notifications/outbox/periodKey.js';
import {
  _fetchStockTrackingUsers,
  _scanStockAlertCandidates,
  _computeStockAlertPayload,
  _biologicalExpiryDaysLeft,
} from '../reminders/stockAlerts.js';

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

/** Eixo VOLUME: 1 linha por MEDICAMENTO com saldo baixo (assunto = `medicine_id`). */
function buildVolumeEntries(
  { protocolsByMedicine, stockByMedicine, now, tzOf }:
  { protocolsByMedicine: any; stockByMedicine: any; now: Date; tzOf: (u: string) => string }
): any[] {
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
      periodKey: periodKey('stock_alert', now, tzOf(userId)),
      subjectId: medicineId,
    });
  }
  return entries;
}

/**
 * Eixo VALIDADE: 1 linha por LOTE em D-3 ou no dia do vencimento (assunto = `stock.id`).
 *
 * Independente do volume (012 Fase A/ADR-059): um lote pode vencer com o saldo do medicamento
 * alto, e um medicamento pode ter vários lotes vencendo em dias diferentes — daí o assunto ser o
 * LOTE. Dois alertas do MESMO lote no MESMO dia são impossíveis por construção: `daysLeft` é UM
 * valor por lote/dia, e a UNIQUE (user, kind, dia, lote) cuida da reexecução dentro da janela.
 */
function buildExpiryEntries(
  { allStock, now, tzOf }: { allStock: any[]; now: Date; tzOf: (u: string) => string }
): any[] {
  const entries: any[] = [];
  for (const lot of allStock || []) {
    // Lote consumido não interessa (mesmo predicado do legado).
    if (Number(lot.quantity || 0) <= 0) continue;
    // Mesmo cálculo do legado (`_biologicalExpiryDaysLeft`): diferença por data-calendário e não
    // por janelas de 24h sobre o instante do cron (review Gemini #658 — um atraso do cron fazia
    // o D-3 virar D-2 e o alerta sumir).
    const daysLeft = _biologicalExpiryDaysLeft(lot);
    if (daysLeft === null) continue;
    // Cadência D-3 + vencimento (FR-004b): cada condição ocorre em UM dia só. Lote vencido há
    // dias (daysLeft < 0) não re-alerta — sem spam retroativo.
    if (daysLeft !== 3 && daysLeft !== 0) continue;
    // Sem `id` no lote não há assunto: enfileirar com `undefined` faria TODAS as linhas do dia
    // colidirem como (user, kind, dia, NULL) e o usuário receberia 1 alerta em vez de N.
    if (!lot.id) continue;

    entries.push({
      userId: lot.user_id,
      kind: 'stock_expiry_alert',
      periodKey: periodKey('stock_expiry_alert', now, tzOf(lot.user_id)),
      subjectId: lot.id,
    });
  }
  return entries;
}

export interface EnqueueStockAlertsResult {
  usersInWindow: number;
  // Linhas TENTADAS, não inseridas: o upsert com ignoreDuplicates não expõe quantas de fato
  // entraram. Dentro da janela de 10min os ticks seguintes repetem as mesmas linhas (no-op na
  // UNIQUE) — ler este número como "envios" superestimaria em ~10×.
  attempted: number;        // eixo VOLUME (stock_alert)
  attemptedExpiry: number;  // eixo VALIDADE (stock_expiry_alert)
}

/**
 * Enfileira os alertas de estoque dos usuários cuja hora local está na janela do alerta:
 * um `stock_alert` por MEDICAMENTO com saldo baixo e um `stock_expiry_alert` por LOTE em D-3/D-0.
 *
 * @param kinds kinds servidos pela outbox (OUTBOX_KINDS). Sem NENHUM dos dois → NO-OP total;
 *              cada eixo é enfileirado só se o SEU kind estiver na flag.
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
  const empty: EnqueueStockAlertsResult = { usersInWindow: 0, attempted: 0, attemptedExpiry: 0 };
  // 🔴 Gate TUDO-OU-NADA, espelhando o guard do legado (`api/notify.ts`): o job legado
  // `checkStockAlerts` produz VOLUME e VALIDADE na MESMA chamada, então ele só é desligado quando
  // a outbox atende os DOIS kinds. Enfileirar um eixo com o outro ainda fora do env deixaria o
  // legado ligado despachando ambos + a outbox despachando o migrado = alerta EM DOBRO, todo dia,
  // sem dedup no dispatcher. Os dois kinds entram e saem do env juntos.
  const wantVolume = kinds.has('stock_alert');
  const wantExpiry = kinds.has('stock_expiry_alert');
  if (!wantVolume || !wantExpiry) return empty;

  // ⚠️ ROLLBACK: tirar os kinds do env para o enqueue imediatamente, mas NÃO esvazia a fila — o
  // claim não filtra kind e os builders seguem registrados, então linhas já enfileiradas hoje
  // ainda seriam entregues enquanto o legado volta a rodar. Rollback completo = remover do env
  // E apagar as linhas pendentes do dia:
  //   delete from public.notification_outbox
  //    where kind in ('stock_alert','stock_expiry_alert') and status = 'pending';

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

  const { protocolsByMedicine, stockByMedicine, allStock } =
    await _scanStockAlertCandidates(usersInWindow, correlationId);

  const tzByUser = new Map<string, string>(
    usersInWindow.map((u: any) => [u.user_id, u.timezone || 'America/Sao_Paulo'])
  );

  const tzOf = (userId: string) => tzByUser.get(userId) || 'America/Sao_Paulo';

  const volumeEntries = wantVolume
    ? buildVolumeEntries({ protocolsByMedicine, stockByMedicine, now, tzOf })
    : [];
  const expiryEntries = wantExpiry ? buildExpiryEntries({ allStock, now, tzOf }) : [];

  const entries = [...volumeEntries, ...expiryEntries];
  const result: EnqueueStockAlertsResult = {
    usersInWindow: usersInWindow.length,
    attempted: volumeEntries.length,
    attemptedExpiry: expiryEntries.length,
  };
  if (entries.length === 0) return result;

  await repo.enqueue(entries);
  logger?.info('[enqueueStockAlerts] linhas tentadas na fila', { correlationId, ...result });
  return result;
}
