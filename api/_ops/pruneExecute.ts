// pruneExecute.ts — único caminho que APAGA conta pela fila (spec 107 FR-003, INV-1/INV-2).
//
// Apaga só linha `approved` (decided_by = admin), com prazo vencido, reconferindo a condição por
// motivo NO INSTANTE da exclusão (TOCTOU — a aprovação não é cheque em branco):
//   autorizou ⇒ void('granted') · conta sumiu ⇒ void('self_deleted') · não deu para saber ⇒
//   void('unknown') (nunca apaga; o enqueue reabre a linha e o admin decide de novo).
// Freios herdados da 046, todos ativos: CONSENT_PRUNE_ENABLED, CONSENT_PRUNE_MODE (só 'armed'
// apaga) e o teto de 5 por execução (acima dele aborta TUDO — 2º freio, PO-1 guard).
// Legado só com kill switch ≥ 0.34 nas duas plataformas (INV-6).
// Idempotente (F-5): a linha é REIVINDICADA com `executed_at` antes de apagar
// (UPDATE … WHERE executed_at IS NULL); falha na exclusão devolve a reivindicação.

import { createLogger } from '../../server/bot/logger.js';
import {
  checkEligibility,
  executeDeletion,
  isPruneEnabled,
  resolveCap,
  resolvePruneMode,
  PRUNE_DEFAULT_CAP,
  type ConsentPruneClient,
  type ConsentPruneMode,
} from '../../server/bot/consentPrune.js';
import { legacyGateOpen, voidReasonFor } from './pruneRules.js';

const logger = createLogger('PruneExecute');

export interface PruneExecuteDeps {
  supabase: ConsentPruneClient;
  env?: Record<string, string | undefined>;
  now?: Date;
  correlationId?: string;
  cap?: number;
}

export interface PruneExecuteResult {
  mode: ConsentPruneMode;
  enabled: boolean;
  approved: number;
  executed: number;
  voided: number;
  blockedByGate: number;
  dryRunEligible: number;
  aborted: boolean;
  reason?: string;
}

interface ApprovedRow {
  id: string;
  user_id: string;
  reason: 'revoked_90d' | 'legacy_no_consent' | 'onboarding_no_consent';
}

async function audit(supabase: ConsentPruneClient, row: ApprovedRow, action: 'void' | 'execute', detail: object) {
  const { error } = await supabase.from('prune_queue_audit').insert({
    queue_id: row.id, user_id: row.user_id, action, actor: 'job:prune_execute', detail,
  });
  if (error) logger.error('Auditoria da execução falhou', error, { queueId: row.id, action });
}

async function voidRow(supabase: ConsentPruneClient, row: ApprovedRow, voidReason: string): Promise<boolean> {
  const { error } = await supabase
    .from('prune_queue')
    .update({ decision: 'void', void_reason: voidReason })
    .eq('id', row.id)
    .eq('decision', 'approved')
    .is('executed_at', null);
  if (error) {
    logger.error('void da linha falhou', error, { queueId: row.id });
    return false;
  }
  await audit(supabase, row, 'void', { void_reason: voidReason });
  return true;
}

type RowOutcome = 'blocked' | 'voided' | 'dry_run' | 'executed' | 'skipped' | 'trail_failed' | 'delete_failed';

/** Uma linha aprovada: gate do legado → reconferência → (dry-run | reivindica → apaga). */
async function processRow({ supabase, row, gateOpen, mode, now, correlationId }: {
  supabase: ConsentPruneClient;
  row: ApprovedRow;
  gateOpen: boolean;
  mode: ConsentPruneMode;
  now: Date;
  correlationId?: string;
}): Promise<RowOutcome> {
  if (row.reason === 'legacy_no_consent' && !gateOpen) {
    // Fica approved: o admin vê no histórico e o kill switch destrava sem nova decisão.
    return 'blocked';
  }

  const state = await checkEligibility(supabase, { user_id: row.user_id, reason: row.reason });
  if (state !== 'eligible') {
    const voidReason = voidReasonFor(state);
    return (await voidRow(supabase, row, voidReason)) ? 'voided' : 'skipped';
  }

  if (mode === 'dry_run') {
    logger.warn('[dry-run] linha aprovada e elegível — nada foi apagado', { correlationId, queueId: row.id });
    return 'dry_run';
  }

  // Reivindica antes de apagar: um 2º ping simultâneo não acha a linha (F-5).
  const claim = await supabase
    .from('prune_queue')
    .update({ executed_at: now.toISOString() })
    .eq('id', row.id)
    .eq('decision', 'approved')
    .is('executed_at', null)
    .select('id');
  if (claim.error || !Array.isArray(claim.data) || claim.data.length !== 1) return 'skipped';

  const outcome = await executeDeletion(supabase, row.user_id, { correlationId });
  if (outcome !== 'pruned') {
    await supabase.from('prune_queue').update({ executed_at: null }).eq('id', row.id);
    logger.error('Exclusão não concluída — reivindicação desfeita e execução abortada', null, { correlationId, queueId: row.id, outcome });
    return outcome === 'trail_failed' ? 'trail_failed' : 'delete_failed';
  }
  await audit(supabase, row, 'execute', { reason: row.reason });
  return 'executed';
}

export async function runPruneExecute(deps: PruneExecuteDeps): Promise<PruneExecuteResult> {
  const { supabase, correlationId } = deps;
  const env = deps.env ?? process.env;
  // eslint-disable-next-line no-restricted-syntax
  const now = deps.now ?? new Date();
  const cap = deps.cap ?? resolveCap(env.CONSENT_PRUNE_CAP, PRUNE_DEFAULT_CAP);
  const mode = resolvePruneMode(env);
  const result: PruneExecuteResult = {
    mode, enabled: isPruneEnabled(env), approved: 0, executed: 0, voided: 0,
    blockedByGate: 0, dryRunEligible: 0, aborted: false,
  };
  if (!result.enabled) {
    logger.warn('Executor DESLIGADO por kill-switch (CONSENT_PRUNE_ENABLED)', { correlationId });
    return result;
  }

  const { data, error } = await supabase
    .from('prune_queue')
    .select('id, user_id, reason')
    .eq('decision', 'approved')
    .is('executed_at', null)
    .lte('eligible_at', now.toISOString())
    .order('eligible_at', { ascending: true });
  if (error) return { ...result, aborted: true, reason: 'queue_query_failed' };
  const rows = (data ?? []) as ApprovedRow[];
  result.approved = rows.length;
  if (rows.length === 0) return result;

  if (rows.length > cap && mode === 'armed') {
    logger.error('Execução ABORTADA — aprovadas acima do teto (nada apagado; seguem approved)', null, { correlationId, cap, approved: rows.length });
    return { ...result, aborted: true, reason: 'cap_exceeded' };
  }

  let gateOpen = false;
  if (rows.some((r) => r.reason === 'legacy_no_consent')) {
    const gates = await supabase.from('app_version_gate').select('platform, min_supported_version, is_active');
    gateOpen = gates.error ? false : legacyGateOpen(gates.data);
  }

  for (const row of rows) {
    const outcome = await processRow({ supabase, row, gateOpen, mode, now, correlationId });
    if (outcome === 'blocked') result.blockedByGate += 1;
    else if (outcome === 'voided') result.voided += 1;
    else if (outcome === 'dry_run') result.dryRunEligible += 1;
    else if (outcome === 'executed') result.executed += 1;
    else if (outcome === 'trail_failed' || outcome === 'delete_failed') {
      return { ...result, aborted: true, reason: outcome === 'trail_failed' ? 'trail_write_failed' : 'delete_failed' };
    }
  }

  logger.info('prune_execute concluído', { correlationId, ...result });
  return result;
}
