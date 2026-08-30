import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { parseLocalDate, getTodayLocal, addDays, parseISO } from '../../utils/dateUtils.js';
import { _fetchAllPages } from './_pagination.js';

const logger = createLogger('PrescriptionAlerts');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Degraus de aviso (dias restantes até `end_date`). Ordenados do menor pro maior: o menor
// `band` cujo limiar `daysRemaining` já alcançou é a janela ativa.
const ALERT_BANDS = [1, 7, 30];
const MAX_BAND = ALERT_BANDS[ALERT_BANDS.length - 1];

// Lote do `.in('protocol_id', …)` da dedup. PostgREST manda a lista na URL: sem teto, uma base
// grande estoura o limite de tamanho da querystring.
const DEDUP_CHUNK_SIZE = 500;

// Menor band tal que `daysRemaining <= band` (076/FR-006). `daysRemaining < 0` (receita já
// vencida) e `> 30` (ainda longe) ⇒ null (nada a disparar). Substitui o `includes()` de
// igualdade EXATA do legado: um run perdido não perde mais o aviso do ciclo — a dedup por
// `notification_log` é o que impede o disparo diário dentro da mesma band.
function _bandFor(daysRemaining: number): number | null {
  if (daysRemaining < 0) return null;
  for (const band of ALERT_BANDS) {
    if (daysRemaining <= band) return band;
  }
  return null;
}

interface Candidate {
  protocol: any;
  band: number;
  daysRemaining: number;
  /** Início da janela de dedup: a data em que `daysRemaining` valia exatamente `band`. */
  sinceIso: string;
  sinceMs: number;
}

/**
 * Envio mais recente de `prescription_alert` por protocolo, em UMA query (antes: uma por
 * protocolo elegível).
 *
 * Só conta log com `status = 'enviada'`. `silenciada` (quiet hours) e `falhou` NÃO suprimem —
 * o usuário não recebeu nada, então o aviso segue elegível no run seguinte.
 *
 * Fail-open (paridade com `shouldSendNotification`): erro na consulta ⇒ mapa vazio ⇒ nada é
 * suprimido. Duplicar um aviso é melhor que silenciá-lo — o oposto do bug que a 076 conserta
 * (AP-340).
 */
async function _fetchLastAlertByProtocol(protocolIds: string[], earliestIso: string): Promise<Map<string, number>> {
  const lastSentAt = new Map<string, number>();

  for (let i = 0; i < protocolIds.length; i += DEDUP_CHUNK_SIZE) {
    const chunk = protocolIds.slice(i, i + DEDUP_CHUNK_SIZE);
    const { data, error } = await supabase
      .from('notification_log')
      .select('protocol_id, sent_at')
      .in('protocol_id', chunk)
      .eq('notification_type', 'prescription_alert')
      .eq('status', 'enviada')
      .gte('sent_at', earliestIso);

    if (error) {
      logger.error('Falha ao consultar notification_log para dedup de prescription_alert', error, {
        protocolos: chunk.length,
      });
      continue; // fail-open: este lote não suprime nada
    }

    for (const row of data || []) {
      const ts = parseISO(row.sent_at).getTime();
      const known = lastSentAt.get(row.protocol_id);
      if (known === undefined || ts > known) lastSentAt.set(row.protocol_id, ts);
    }
  }

  return lastSentAt;
}

type ProcessOutcome = 'dispatched' | 'skipped';

async function _dispatchPrescriptionAlert(
  candidate: Candidate,
  dispatcher: any,
  correlationId: string,
): Promise<ProcessOutcome> {
  const { protocol, daysRemaining } = candidate;

  const result = await dispatcher.dispatch({
    userId: protocol.user_id,
    kind: 'prescription_alert',
    data: {
      // `protocolId` NÃO é lido pelo builder do texto — ele viaja até `metadata.protocolId`, e é
      // de lá que `logNotificationEvent` preenche `notification_log.protocol_id`. Sem este campo
      // o log do dispatcher sairia com `protocol_id = null` e a dedup não teria em que se ancorar.
      protocolId: protocol.id,
      medicineName: protocol.medicine?.name || 'Medicamento',
      endDate: protocol.end_date,
      daysRemaining,
    },
    context: { correlationId, jobType: 'prescription_alert' },
  });

  // O próprio `dispatchNotification` grava a linha de `notification_log` (com `status` real:
  // enviada/silenciada/falhou). A 076 chegou a gravar uma SEGUNDA linha aqui via
  // `logSuccessfulNotification` — removido: duplicava o log, saía sempre como 'enviada' mesmo
  // com o envio suprimido por quiet hours, e criava duas fontes de verdade para a mesma dedup.
  if (result?.success) return 'dispatched';

  logger.warn('Dispatch de prescription_alert não confirmou sucesso — seguirá elegível no próximo run', {
    userId: protocol.user_id, protocolId: protocol.id, correlationId,
  });
  return 'skipped';
}

export async function checkPrescriptionAlertsViaDispatcher(dispatcher: any, correlationId: string) {
  try {
    const todayLocal = getTodayLocal();
    const todayDate = parseLocalDate(todayLocal);
    // Janela de interesse: só protocolo que vence de hoje até hoje+30. Receita já vencida não
    // recebe aviso retroativo e vencimento distante não tem o que disparar — filtrar no banco
    // evita arrastar o histórico inteiro de `protocols` para dentro do runtime a cada run.
    const horizonLocal = getTodayLocal(addDays(todayDate, MAX_BAND));

    // 076/FR-001+FR-004: varredura dirigida por `protocols`, UMA query paginada (AP-186).
    // O legado filtrava `user_settings.notifications_enabled` — coluna INEXISTENTE ⇒ 42703 ⇒ o
    // job morria antes do primeiro usuário, em todo run, desde sempre (AP-340). A preferência de
    // canal/quiet-hours/consentimento é resolvida pelo dispatcher (`resolveChannelsForUser`),
    // não replicada aqui. `getTodayLocal()` é SP-only e basta: aviso 30/7/1 tolera ±1 dia.
    const protocols = await _fetchAllPages(
      'protocols',
      'id, user_id, end_date, medicine:medicines(name, dosage_unit)',
      (q) => q.eq('active', true).gte('end_date', todayLocal).lte('end_date', horizonLocal),
      'id',
    );

    const candidates: Candidate[] = [];
    for (const protocol of protocols) {
      const endDate = parseLocalDate(protocol.end_date);
      const daysRemaining = Math.ceil((endDate.getTime() - todayDate.getTime()) / MS_PER_DAY);
      const band = _bandFor(daysRemaining);
      if (band === null) continue;

      // Âncora ABSOLUTA da janela de dedup: a data em que `daysRemaining` valia exatamente `band`.
      // Um send de band maior (ex. band 30, ~23 dias antes de `end_date - 7`) fica FORA da janela
      // da band menor ⇒ não suprime ⇒ a band 7 dispara. Um send da MESMA band cai dentro ⇒ suprime.
      // Sem coluna nova: usa só `sent_at` (076 não altera schema).
      //
      // RC6 #3: `endDate` é meia-noite no TZ do runtime; no Vercel (TZ=UTC) isso é 00:00Z, e o cron
      // grava os logs ~8h depois (11:00Z), então há folga de sobra. Se o TZ do runtime algum dia
      // virar America/Sao_Paulo a âncora vira 03:00Z do dia — ainda dentro da folga, mas é
      // dependência implícita: revisar esta linha se o TZ do serverless mudar.
      const since = addDays(endDate, -band);
      candidates.push({
        protocol,
        band,
        daysRemaining,
        sinceIso: since.toISOString(),
        sinceMs: since.getTime(),
      });
    }

    if (candidates.length === 0) {
      logger.info('[prescription_alert] run: nenhum protocolo na janela de aviso', {
        correlationId, varridos: protocols.length,
      });
      return;
    }

    // Menor âncora entre os candidatos: um único `gte('sent_at', …)` cobre todas as janelas, e
    // cada candidato compara depois contra a SUA própria âncora.
    const earliestIso = candidates.reduce(
      (min, c) => (c.sinceIso < min ? c.sinceIso : min),
      candidates[0].sinceIso,
    );
    const lastSentAt = await _fetchLastAlertByProtocol(
      candidates.map((c) => c.protocol.id),
      earliestIso,
    );

    let dispatched = 0;
    let deduped = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      try {
        const last = lastSentAt.get(candidate.protocol.id);
        if (last !== undefined && last >= candidate.sinceMs) {
          deduped++;
          continue;
        }
        const outcome = await _dispatchPrescriptionAlert(candidate, dispatcher, correlationId);
        if (outcome === 'dispatched') dispatched++;
        else skipped++;
      } catch (err) {
        // Best-effort por protocolo (R-245): um erro não derruba a varredura dos demais.
        skipped++;
        logger.error('Erro ao processar alerta de prescrição de um protocolo', err, {
          userId: candidate.protocol?.user_id, protocolId: candidate.protocol?.id, correlationId,
        });
      }
    }

    // 076/FR-003: sinal de "rodou". Sem isto, "nenhum alerta hoje" e "o job quebrou" são o
    // mesmo silêncio.
    logger.info('[prescription_alert] run', {
      correlationId,
      varridos: protocols.length,
      elegiveis: candidates.length,
      despachados: dispatched,
      suprimidos_dedup: deduped,
      ignorados: skipped,
    });
  } catch (err) {
    // 076/FR-002: erro deixa de ser silêncio. `logger.error` + `throw` — o `runJob` de
    // `api/notify.ts` isola e marca `prescription_alerts:failed`. `return` aqui era o bug (AP-298).
    logger.error('Erro em checkPrescriptionAlertsViaDispatcher', err, { correlationId });
    throw err;
  }
}
