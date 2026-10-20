// Import modules directly (no dynamic imports)
import { createLogger } from '../server/bot/logger.js';
import { withCorrelation, generateCorrelationId } from '../server/bot/correlationLogger.js';
import {
  checkReminders,
  runDailyDigest,
  runDailyAdherenceReport,
  checkStockAlerts,
  checkAdherenceReports,
  checkTitrationAlerts,
  checkPrescriptionAlerts,
  checkMonthlyReport,
  sendDLQDigest
} from '../server/bot/tasks.js';
import { runOutboxCycle } from '../server/notifications/outbox/runOutboxCycle.js';
import { createOutboxRepository } from '../server/notifications/outbox/outboxRepository.js';
import { enqueueStockAlerts } from '../server/bot/outbox/enqueueStockAlerts.js';
import { buildStockExpiryContent } from '../server/bot/outbox/stockExpiryContent.js';
import { buildStockAlertContent } from '../server/bot/outbox/stockAlertContent.js';
import {
  buildDailyAdherenceData,
  buildWeeklyAdherenceData,
  buildMonthlyReportData
} from '../server/bot/_adherenceHelpers.js';
import { buildDailyDigestData } from '../server/bot/reminders/dailyDigest.js';
import { createCronDispatcher, createNotifyBotAdapter } from './_shared/cronDispatcher.js';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { Expo } from 'expo-server-sdk';
import { getServerTimestamp, getSaoPauloTime, getRawNow } from '../server/utils/dateUtils.js';
import {
  initSentry,
  captureServerException,
  flushSentry,
  withServerIsolation,
  withServerMonitor,
  CRITICAL_DELIVERY_AUDIT_MONITOR,
} from '../server/observability/sentry.js';
import { runCriticalDeliveryAudit } from '../server/observability/criticalDeliveryAudit.js';
import { runAccessLogHealth } from '../server/observability/accessLogHealth.js';

const logger = createLogger('CronNotify');

// Cutover kind-a-kind (ADR-078): kinds em OUTBOX_KINDS são servidos pela outbox; seu job legado
// é PULADO (evita envio duplo). Ausente/vazio → tudo legado (deploy neutro — ENG-1). Rollback por env.
const OUTBOX_KINDS = new Set(
  (process.env.OUTBOX_KINDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);

// Registry outbox-kind → builder puro (nível B; injetado no ciclo da outbox para não arrastar
// server/bot pro island strict-A — R-283). Só kinds aqui podem ser drenados.
const OUTBOX_CONTENT_BUILDERS = {
  daily_adherence: ({ userId, settings }) => buildDailyAdherenceData(userId, settings?.display_name),
  weekly_adherence: ({ userId, settings }) => buildWeeklyAdherenceData(userId, settings?.display_name),
  monthly_report: ({ userId, settings }) => buildMonthlyReportData(userId, settings?.display_name),
  // 043 T023b: o digest revalida o modo/horário no DB no momento do envio (settings do drain
  // pode estar defasado) e devolve null se o usuário saiu do modo digest.
  daily_digest: ({ userId, settings }) => buildDailyDigestData(userId, settings),
  // 050 PR 1b: fan-out por MEDICAMENTO — o assunto vem em subject_id e o conteúdo (nome/saldo/
  // dias) é recalculado no envio (SEC-1). Registrar o builder é inofensivo enquanto o enqueue
  // estiver atrás do gate OUTBOX_KINDS: sem linhas na fila, nada é drenado.
  stock_alert: ({ userId, subjectId }) => buildStockAlertContent({ userId, subjectId }),
  // 050 PR 2: eixo VALIDADE — fan-out por LOTE (subject_id = stock.id). `daysLeft` é recalculado
  // no envio; lote consumido ou apagado devolve null e a linha é fechada sem envio.
  stock_expiry_alert: ({ userId, subjectId }) => buildStockExpiryContent({ userId, subjectId })
};
// outbox kind → kind de dispatch quando divergem (payload legado usa 'adherence_report').
const OUTBOX_DISPATCH_KIND = { daily_adherence: 'adherence_report' };

// Singleton clients — instanciados no module scope para reuso em warm invocations (R-089)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: /* TODO(040-strict): typar transport supabase realtime */ ws as any } }
);
const expoClient = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// === HELPER: retryPendingDlq ===
// Reprocessa entradas 'pending'/'retrying' da DLQ com retry_count < max_retries (AP a registrar:
// getPendingForRetry/markForRetry em server/services/deadLetterQueue.ts eram código morto — nada
// chamava; sem isso, falhas transitórias (ex.: Expo 503) ficavam presas até retry manual no admin).
async function retryPendingDlq(notificationDispatcher, correlationId) {
  const { data: pendingEntries, error: fetchError } = await supabase
    .from('failed_notification_queue')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .lt('retry_count', 3)
    .order('created_at', { ascending: true })
    .limit(50);

  if (fetchError) {
    logger.error('[dlq_auto_retry] Falha ao buscar pendências', fetchError, { correlationId });
    return { attempted: 0, resolved: 0, failed: 0 };
  }

  let resolved = 0;
  let failedCount = 0;

  for (const entry of pendingEntries || []) {
    const dispatchResult = await notificationDispatcher.dispatch({
      userId: entry.user_id,
      kind: entry.notification_type,
      data: entry.notification_payload || {},
      context: {
        correlationId: entry.correlation_id || `dlq_retry_${entry.id}`,
        isRetry: true,
        details: { originalNotificationId: entry.id }
      }
    });

    if (dispatchResult.success) {
      const { error: updateError } = await supabase
        .from('failed_notification_queue')
        .update({
          status: 'resolved',
          resolved_at: getServerTimestamp(),
          resolution_notes: 'Reprocessado automaticamente via cron dlq_auto_retry'
        })
        .eq('id', entry.id);
      if (updateError) {
        logger.error('[dlq_auto_retry] Falha ao marcar como resolvido no banco', updateError, { entryId: entry.id });
      } else {
        resolved++;
      }
    } else {
      const nextRetryCount = (entry.retry_count || 0) + 1;
      const { error: updateError } = await supabase
        .from('failed_notification_queue')
        .update({
          retry_count: nextRetryCount,
          status: nextRetryCount >= entry.max_retries ? 'failed' : 'retrying',
          updated_at: getServerTimestamp(),
          error_message: dispatchResult.errors?.[0]?.message || entry.error_message
        })
        .eq('id', entry.id);
      if (updateError) {
        logger.error('[dlq_auto_retry] Falha ao atualizar tentativas no banco', updateError, { entryId: entry.id });
      } else {
        failedCount++;
      }
    }
  }

  logger.info('[dlq_auto_retry] Ciclo concluído', {
    correlationId,
    attempted: (pendingEntries || []).length,
    resolved,
    failed: failedCount
  });

  return { attempted: (pendingEntries || []).length, resolved, failed: failedCount };
}

// === HELPER: executeCronJobs ===

async function _executeCronJobs(notificationDispatcher, bot, correlationId, spDate) {
  const currentHour = spDate.getHours();
  const currentMinute = spDate.getMinutes();
  const currentDay = spDate.getDate();
  const currentWeekDay = spDate.getDay();
  const results = [];

  // Isolamento por job (PO-1/FR-001): a falha de um relatório NÃO propaga — reminders (que já
  // rodou) e os demais jobs seguem. Cada job vira um registro discreto ('<job>' ou '<job>:failed').
  const runJob = async (name, jobType, fn) => {
    try {
      await withCorrelation((context) => fn(context), { correlationId, jobType });
      results.push(name);
    } catch (err) {
      logger.error(`Job '${name}' falhou (isolado — não propaga)`, err, { correlationId, jobType });
      // A falha do job é engolida de propósito (isolamento), mas não pode ficar invisível:
      // é exatamente a classe do incidente que originou a spec 082 (AP-325).
      captureServerException(err, { correlationId, job: name });
      results.push(`${name}:failed`);
    }
  };

  // 1. Reminders — SEMPRE primeiro (ADR-057 intocado), isolado de qualquer relatório.
  await runJob('reminders', 'reminders',
    (context) => checkReminders(bot, { ...context, notificationDispatcher }));

  // 2. Ciclo da outbox (ADR-078): enqueue por range + drain dos kinds migrados. Isolado.
  //    No-op quando OUTBOX_KINDS vazio (deploy neutro). Falha aqui não afeta reminders/legado.
  await runJob('outbox_cycle', 'outbox_cycle', async () => {
    // 050 PR 1b/2: enqueue dos alertas de estoque ANTES do ciclo — fan-out (1 linha por medicamento) que o
    // enqueue por range de relatórios não expressa. 🔴 `kinds: OUTBOX_KINDS` NÃO é decorativo: o
    // claim não filtra kind e o guard do legado (abaixo) segue ligado até o cutover (PR 2), então
    // enfileirar sem esse gate faria legado + outbox entregarem o MESMO alerta.
    // Isolado do resto do ciclo (R-245): uma falha transitória do PostgREST na varredura de
    // estoque não pode impedir o enqueue dos relatórios NEM o DRAIN das linhas já enfileiradas —
    // seria trocar "um alerta atrasado" por "nenhuma notificação neste tick".
    let stockEnqueue = null;
    try {
      stockEnqueue = await enqueueStockAlerts({
        repo: createOutboxRepository({ client: supabase }),
        kinds: OUTBOX_KINDS,
        correlationId,
        logger,
      });
    } catch (err) {
      logger.error('[outbox] enqueue dos alertas de estoque falhou (isolado — ciclo segue)', err, { correlationId });
    }

    const outcome = await runOutboxCycle({
      supabase,
      dispatcher: notificationDispatcher,
      outboxKinds: OUTBOX_KINDS,
      contentBuilders: OUTBOX_CONTENT_BUILDERS,
      dispatchKind: OUTBOX_DISPATCH_KIND,
      correlationId,
      logger,
    });
    logger.info('[outbox] ciclo concluído', { correlationId, stockEnqueue, ...outcome });
  });

  // --- Jobs LEGADOS: pulados quando o kind já é servido pela outbox (evita envio duplo). ---

  // Daily Digest
  if (!OUTBOX_KINDS.has('daily_digest')) {
    await runJob('daily_digest', 'daily_digest',
      (context) => runDailyDigest(bot, { ...context, notificationDispatcher }));
  }

  // Daily Adherence Report
  if (!OUTBOX_KINDS.has('daily_adherence')) {
    await runJob('daily_adherence_report', 'daily_adherence_report',
      (context) => runDailyAdherenceReport(bot, { ...context, notificationDispatcher }));
  }

  // Tasks at 10:00
  if (currentHour === 10 && currentMinute === 0) {
    // 050 PR 2: `checkStockAlerts` faz VOLUME e VALIDADE na mesma chamada, então o guard tem de
    // nomear OS DOIS kinds — desligar o legado com só um deles migrado mataria o outro eixo em
    // silêncio. O legado só sai de cena quando a outbox serve ambos.
    if (!OUTBOX_KINDS.has('stock_alert') || !OUTBOX_KINDS.has('stock_expiry_alert')) {
      await runJob('stock_alerts', 'stock_alerts',
        (context) => checkStockAlerts(bot, { ...context, notificationDispatcher }));
    }
    // 107: o prune saiu daqui — vive em api/ops.ts (prune_enqueue/prune_execute) com aprovação manual.

    await runJob('dlq_auto_retry', 'dlq_auto_retry',
      (context) => retryPendingDlq(notificationDispatcher, context.correlationId));
    await runJob('dlq_digest', 'dlq_digest',
      (context) => sendDLQDigest(notificationDispatcher, context));
  }

  // 082 Slice B — apuração diária da entrega de dose crítica. 1×/dia às 05:00 SP — fora do pico de
  // lembretes das 08:00 (spec 102 FR-007), olhando as 24 h anteriores. Não envia nada ao paciente: emite UM evento ao Sentry do backend
  // quando há não-entrega ou paciente sem canal (FR-009/FR-010).
  if (currentHour === 5 && currentMinute === 0) {
    // 082 D1 · S-3: heartbeat — job que morre ou não roda vira alerta de cron perdido no Sentry, em
    // vez de um silêncio igual ao de "nada a reportar". O monitor fica DENTRO do runJob: vê o erro,
    // e o runJob segue isolando e reportando.
    await runJob('critical_delivery_audit', 'critical_delivery_audit', (context) =>
      withServerMonitor(CRITICAL_DELIVERY_AUDIT_MONITOR, async () => {
        const report = await runCriticalDeliveryAudit({
          supabase,
          logger,
          correlationId: context?.correlationId || correlationId,
        });
        logger.info('[critical_delivery_audit] ciclo concluído', {
          correlationId,
          semEntrega: report.criticalNoDelivery.total,
          semCanal: report.noChannelPatients.total,
        });
      })
    );

    // Spec 106 FR-004 — saúde da guarda dos registros de acesso (Marco Civil art. 15). Monitoramento,
    // não fluxo operacional: runJob próprio, fora do monitor do audit crítico (a falha de um não
    // mascara o outro). Toda a regra mora em `public.access_log_health()`.
    await runJob('access_log_health', 'access_log_health', (context) =>
      runAccessLogHealth({
        supabase,
        logger,
        correlationId: context?.correlationId || correlationId,
      })
    );
  }

  // Titration + Prescription Alerts: Daily at 08:00 (não migram para outbox)
  if (currentHour === 8 && currentMinute === 0) {
    await runJob('titration_alerts', 'titration_alerts',
      (context) => checkTitrationAlerts(bot, { ...context, notificationDispatcher }));
    // 076: até esta spec `checkPrescriptionAlerts` só era chamado pelo node-cron de
    // `server/bot/scheduler.ts` — que NÃO roda no serverless (AP-182). O alerta de renovação
    // de receita nunca executou em produção.
    await runJob('prescription_alerts', 'prescription_alerts',
      (context) => checkPrescriptionAlerts(bot, { ...context, notificationDispatcher }));
  }

  // Adherence Reports: Sunday 09:00-12:00 SP
  if (currentWeekDay === 0 && currentHour >= 9 && currentHour <= 12 && !OUTBOX_KINDS.has('weekly_adherence')) {
    await runJob('adherence_reports', 'adherence_reports',
      (context) => checkAdherenceReports(bot, { ...context, notificationDispatcher }));
  }

  // Monthly Report: 1st of month
  if (currentDay === 1 && !OUTBOX_KINDS.has('monthly_report')) {
    await runJob('monthly_report', 'monthly_report',
      (context) => checkMonthlyReport(bot, { ...context, notificationDispatcher }));
  }

  return results;
}

export default async function handler(req, res) {
  initSentry();
  const correlationId = generateCorrelationId();

  logger.info('Ambiente de execução', {
    correlationId,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL ? 'present' : 'absent',
    hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasCronSecret: !!process.env.CRON_SECRET,
    hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
  });

  logger.info('Cron job triggered', {
    correlationId,
    method: req.method,
    url: req.url
  });

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  // Falha-fechado se CRON_SECRET não estiver configurado — sem essa guarda,
  // CRON_SECRET undefined viraria "Bearer undefined" e qualquer requisição com
  // esse header burlaria a autenticação (mesma classe do Gemini #604, security-high).
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron attempt', { correlationId, authHeader });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error('TELEGRAM_BOT_TOKEN not configured', null, { correlationId });
    return res.status(500).json({ error: 'Token missing' });
  }

  const bot = createNotifyBotAdapter(token);
  // 046 T014: a supressão por consentimento revogado vive DENTRO do dispatcher, a partir do fetch de
  // `user_settings` que ele já faz por usuário. Nada a preparar aqui — e nada global a falhar: o
  // estado de um titular não pode derrubar o lembrete de dose dos outros pacientes (R-292).
  const notificationDispatcher = createCronDispatcher({ supabase, expoClient, bot });

  const now = getRawNow();
  const spDate = getSaoPauloTime(now);

  const currentHHMM = spDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  logger.info(`Executing cron jobs`, {
    correlationId,
    time: currentHHMM,
    hour: spDate.getHours(),
    minute: spDate.getMinutes(),
    day: spDate.getDate(),
    weekday: spDate.getDay()
  });

  try {
    const results = await withServerIsolation(() =>
      _executeCronJobs(notificationDispatcher, bot, correlationId, spDate)
    );

    logger.info('Cron jobs completed', {
      correlationId,
      executed: results,
      duration: Date.now() - now.getTime()
    });

    await flushSentry();
    res.status(200).json({
      status: 'ok',
      executed: results,
      time: currentHHMM,
      correlationId
    });

  } catch (error) {
    console.error('[CronNotify] Cron job failed with error:', {
      correlationId,
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    logger.error('Cron job failed', error, { correlationId });
    captureServerException(error, { correlationId, job: 'cron_notify' });
    await flushSentry();
    res.status(500).json({
      error: error.message,
      correlationId,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}