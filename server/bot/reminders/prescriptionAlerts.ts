import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { parseLocalDate, getTodayLocal, addDays } from '../../utils/dateUtils.js';
import { _fetchAllPages } from './_pagination.js';
import { logSuccessfulNotification } from '../../services/notificationDeduplicator.js';

const logger = createLogger('PrescriptionAlerts');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Degraus de aviso (dias restantes até `end_date`). Ordenados do menor pro maior: o menor
// `band` cujo limiar `daysRemaining` já alcançou é a janela ativa.
const ALERT_BANDS = [1, 7, 30];

// Menor band tal que `daysRemaining <= band` (076/FR-006). `daysRemaining < 0` (receita já
// vencida) e `> 30` (ainda longe) ⇒ null (nada a disparar). Substitui o `includes()` de
// igualdade EXATA do legado: um run perdido não perde mais o aviso do ciclo — a dedup por
// `notification_log` (`_alreadyAlerted`) é o que impede o disparo diário dentro da mesma band.
function _bandFor(daysRemaining: number): number | null {
  if (daysRemaining < 0) return null;
  for (const band of ALERT_BANDS) {
    if (daysRemaining <= band) return band;
  }
  return null;
}

/**
 * Já avisou este protocolo DENTRO da band atual? Janela = `[end_date - band dias, agora]`.
 *
 * Um send de band maior (ex. band 30, disparado ~23 dias antes de `end_date - 7`) fica FORA
 * da janela da band menor ⇒ não casa ⇒ a band 7 dispara. Um send da MESMA band cai dentro ⇒
 * suprime. Sem coluna nova: usa só `sent_at` (076 não altera schema).
 *
 * Fail-open (paridade com `shouldSendNotification`): erro na consulta ⇒ `false` (não suprime).
 * Duplicar um aviso é melhor que silenciá-lo — o oposto do bug que a 076 conserta (AP-340).
 */
async function _alreadyAlerted(userId: string, protocolId: string, sinceIso: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('protocol_id', protocolId)
    .eq('notification_type', 'prescription_alert')
    .gte('sent_at', sinceIso)
    .limit(1);

  if (error) {
    logger.error('Falha ao consultar notification_log para dedup de prescription_alert', error, { userId, protocolId });
    return false;
  }
  return !!(data && data.length > 0);
}

type ProcessOutcome = 'dispatched' | 'deduped' | 'skipped';

async function _processPrescriptionProtocol(
  protocol: any,
  todayDate: Date,
  dispatcher: any,
  correlationId: string,
): Promise<ProcessOutcome> {
  const endDate = parseLocalDate(protocol.end_date);
  const daysRemaining = Math.ceil((endDate.getTime() - todayDate.getTime()) / MS_PER_DAY);

  const band = _bandFor(daysRemaining);
  if (band === null) return 'skipped';

  // Âncora ABSOLUTA da janela de dedup: a data em que `daysRemaining` valia exatamente `band`.
  // RC6 #3: `endDate` é meia-noite no TZ do runtime; no Vercel (TZ=UTC) isso é 00:00Z, e o cron
  // grava os logs ~8h depois (11:00Z), então há folga de sobra. Se o TZ do runtime algum dia
  // virar America/Sao_Paulo a âncora vira 03:00Z do dia — ainda dentro da folga, mas é
  // dependência implícita: revisar esta linha se o TZ do serverless mudar.
  const sinceIso = addDays(endDate, -band).toISOString();
  if (await _alreadyAlerted(protocol.user_id, protocol.id, sinceIso)) return 'deduped';

  const result = await dispatcher.dispatch({
    userId: protocol.user_id,
    kind: 'prescription_alert',
    data: {
      medicineName: protocol.medicine?.name || 'Medicamento',
      endDate: protocol.end_date,
      daysRemaining,
    },
    context: { correlationId, jobType: 'prescription_alert' },
  });

  // Só registra em `notification_log` quando o envio de fato saiu — senão a dedup passa a
  // mentir (suprimiria o retry legítimo de um dispatch que falhou).
  if (result?.success) {
    // RC6 #2: `logSuccessfulNotification` NÃO lança — engole o erro do insert e devolve false.
    // Sem esta checagem, um insert falho deixaria o alerta re-disparando TODO dia até o fim da
    // band (até ~22 duplicados no band 30), porque a dedup nunca acharia a linha.
    const logged = await logSuccessfulNotification(protocol.user_id, protocol.id, 'prescription_alert');
    if (!logged) {
      logger.error(
        'prescription_alert despachado mas NÃO registrado em notification_log — a dedup vai falhar e o alerta pode repetir',
        null,
        { userId: protocol.user_id, protocolId: protocol.id, correlationId },
      );
    }
    return 'dispatched';
  }

  logger.warn('Dispatch de prescription_alert não confirmou sucesso — não registrado, seguirá elegível', {
    userId: protocol.user_id, protocolId: protocol.id, correlationId,
  });
  return 'skipped';
}

export async function checkPrescriptionAlertsViaDispatcher(dispatcher: any, correlationId: string) {
  try {
    // 076/FR-001+FR-004: varredura dirigida por `protocols`, UMA query paginada (AP-186).
    // O legado filtrava `user_settings.notifications_enabled` — coluna INEXISTENTE ⇒ 42703 ⇒ o
    // job morria antes do primeiro usuário, em todo run, desde sempre (AP-340). A preferência de
    // canal/quiet-hours/consentimento é resolvida pelo dispatcher (`resolveChannelsForUser`),
    // não replicada aqui. `getTodayLocal()` é SP-only e basta: aviso 30/7/1 tolera ±1 dia.
    const protocols = await _fetchAllPages(
      'protocols',
      'id, user_id, end_date, medicine:medicines(name, dosage_unit)',
      (q) => q.eq('active', true).not('end_date', 'is', null),
      'id',
    );

    if (protocols.length === 0) {
      logger.info('[prescription_alert] run: nenhum protocolo ativo com end_date', { correlationId });
      return;
    }

    const todayDate = parseLocalDate(getTodayLocal());

    let dispatched = 0;
    let deduped = 0;
    let skipped = 0;

    for (const protocol of protocols) {
      try {
        const outcome = await _processPrescriptionProtocol(protocol, todayDate, dispatcher, correlationId);
        if (outcome === 'dispatched') dispatched++;
        else if (outcome === 'deduped') deduped++;
        else skipped++;
      } catch (err) {
        // Best-effort por protocolo (R-245): um erro não derruba a varredura dos demais.
        skipped++;
        logger.error('Erro ao processar alerta de prescrição de um protocolo', err, {
          userId: protocol?.user_id, protocolId: protocol?.id, correlationId,
        });
      }
    }

    // 076/FR-003: sinal de "rodou". Sem isto, "nenhum alerta hoje" e "o job quebrou" são o
    // mesmo silêncio.
    logger.info('[prescription_alert] run', {
      correlationId,
      elegiveis: protocols.length,
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
