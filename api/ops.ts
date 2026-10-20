// api/ops.ts — endpoint operacional dos jobs que NÃO são notificação (spec 107 FR-001b, ADR-111).
//
// Um ping por job no cron-job.org (`?job=<nome>`), cada um com histórico de falha próprio.
// Contrato (CON-043): allowlist de jobs (fora dela ⇒ 400), segredo de cron em tempo constante
// (⇒ 401, header nunca logado — S-4), e job que lança ou aborta ⇒ 5xx para o cron-job.org alertar.
// Função Vercel 8/12 (R-090); utilitários em api/_ops/.

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { Expo } from 'expo-server-sdk';
import { createLogger } from '../server/bot/logger.js';
import { generateCorrelationId } from '../server/bot/correlationLogger.js';
import { initSentry, captureServerException, flushSentry } from '../server/observability/sentry.js';
import { isCronAuthorized } from './_ops/auth.js';
import { runPruneEnqueue } from './_ops/pruneEnqueue.js';
import { runPruneExecute } from './_ops/pruneExecute.js';
import { createCronDispatcher, createNotifyBotAdapter } from './_shared/cronDispatcher.js';

const logger = createLogger('Ops');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, { realtime: { transport: /* TODO(040-strict): typar transport supabase realtime */ ws as any } })
  : null;

type JobResult = { aborted?: boolean | string; reason?: string };
type Job = (correlationId: string) => Promise<JobResult>;

function dispatcher() {
  const bot = createNotifyBotAdapter(process.env.TELEGRAM_BOT_TOKEN);
  const expoClient = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
  return createCronDispatcher({ supabase, expoClient, bot });
}

/** Allowlist. Job novo entra AQUI, com ping próprio no cron-job.org (runbook). */
export const OPS_JOBS: Record<string, Job> = {
  prune_enqueue: (correlationId) => runPruneEnqueue({
    supabase: supabase as any,
    dispatcher: dispatcher(),
    adminUserId: process.env.ADMIN_USER_ID,
    correlationId,
    capture: (error, context) => captureServerException(error, context as any),
  }),
  prune_execute: (correlationId) => runPruneExecute({ supabase: supabase as any, correlationId }),
};

export default async function handler(req, res) {
  initSentry();
  const correlationId = generateCorrelationId();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isCronAuthorized(req.headers['authorization'], process.env.CRON_SECRET)) {
    logger.warn('ops: requisição sem segredo válido', { correlationId });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const job = typeof req.query?.job === 'string' ? req.query.job : '';
  if (!Object.prototype.hasOwnProperty.call(OPS_JOBS, job)) {
    return res.status(400).json({ error: 'Unknown job' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const result = await OPS_JOBS[job](correlationId);
    if (result?.aborted) {
      captureServerException(new Error(`ops:${job} abortado (${String(result.reason ?? result.aborted)})`), { job, correlationId });
      await flushSentry();
      return res.status(500).json({ status: 'aborted', job, result, correlationId });
    }
    await flushSentry();
    return res.status(200).json({ status: 'ok', job, result, correlationId });
  } catch (err) {
    logger.error(`ops:${job} falhou`, err, { correlationId });
    captureServerException(err, { job, correlationId });
    await flushSentry();
    return res.status(500).json({ status: 'error', job, correlationId });
  }
}
