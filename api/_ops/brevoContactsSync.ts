// brevoContactsSync.ts — mantém a lista "New users" da Brevo (spec 026 Slice 2A, ADR-118).
//
// O dosiq não envia e-mail: inclui a conta nova na lista e o workflow da Brevo dispara as boas-vindas
// (A/B por HAS_APP). Duas etapas por rodada:
//   E1 inclusão  — rpc brevo_sync_candidates ⇒ upsert ⇒ rpc brevo_mark_synced (só após 2xx)
//   E2 exclusão  — rpc brevo_deleted_since(now − 48 h) ⇒ DELETE por ext_id (404 = ok)
// Payload fechado (INV-2A-1): só email, ext_id, listIds, updateEnabled, HAS_APP, SIGNUP_DATE.
// Falha da Brevo nunca lança (FR-2A-07): conta e vai ao Sentry com {job, etapa, status, code} — nada
// de e-mail no resultado, no capture ou no log (RC-SEC S-6). 429 ou deadline encerram a rodada.

import { createLogger } from '../../server/bot/logger.js';
import { BrevoError, createBrevoClient, type BrevoClient, type BrevoContact } from './brevoClient.js';

const logger = createLogger('BrevoContactsSync');

const JOB = 'brevo_contacts_sync';
export const BREVO_INCLUDE_LIMIT = 50;
export const BREVO_DELETE_LIMIT = 100;
export const BREVO_DEADLINE_MS = 45_000;
export const BREVO_TOMBSTONE_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Atributos permitidos — adicionar um aqui é mudar o teste de INV-2A-1 (revisão consciente). */
export const BREVO_ALLOWED_ATTRIBUTES = ['HAS_APP', 'SIGNUP_DATE'] as const;

type RpcResult = { data: unknown; error: unknown };
export interface BrevoSyncSupabase {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
}

export interface BrevoSyncDeps {
  supabase: BrevoSyncSupabase;
  env?: Record<string, string | undefined>;
  /** Injetável nos testes; em produção vem de BREVO_API_KEY. */
  brevo?: BrevoClient;
  now?: Date;
  /** Relógio monotônico do deadline (ms). */
  clock?: () => number;
  deadlineMs?: number;
  correlationId?: string;
  capture?: (error: unknown, context?: Record<string, unknown>) => void;
}

export interface BrevoSyncResult {
  candidates: number;
  included: number;
  includeFailed: number;
  alreadyMarked: number;
  markMissing: number;
  tombstones: number;
  deleted: number;
  deleteFailed: number;
  stoppedBy: 'deadline' | '429' | null;
  aborted?: string;
  reason?: string;
}

export interface Candidate {
  user_id: string;
  email: string;
  created_at: string;
  has_app: boolean;
}

/** Data de cadastro no fuso do produto (YYYY-MM-DD) — formato do atributo date da Brevo. */
export function signupDate(createdAt: string): string {
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto, não data civil (R-020)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(createdAt));
}

/** INV-2A-1: único lugar que monta o que sai para a Brevo. */
export function buildContactPayload(c: Candidate, listId: number): BrevoContact {
  return {
    email: c.email,
    extId: c.user_id,
    attributes: { HAS_APP: c.has_app === true, SIGNUP_DATE: signupDate(c.created_at) },
    listIds: [listId],
  };
}

function readConfig(env: Record<string, string | undefined>) {
  const apiKey = env.BREVO_API_KEY?.trim();
  const listId = Number(env.BREVO_LIST_NEW_USERS);
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto, não data civil (R-020)
  const start = env.BREVO_SYNC_START ? new Date(env.BREVO_SYNC_START) : null;
  if (!apiKey || !Number.isInteger(listId) || listId <= 0 || !start || Number.isNaN(start.getTime())) return null;
  return { apiKey, listId, start };
}

function emptyResult(): BrevoSyncResult {
  return {
    candidates: 0, included: 0, includeFailed: 0, alreadyMarked: 0, markMissing: 0,
    tombstones: 0, deleted: 0, deleteFailed: 0, stoppedBy: null,
  };
}

export async function runBrevoContactsSync(deps: BrevoSyncDeps): Promise<BrevoSyncResult> {
  const env = deps.env ?? process.env;
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto, não data civil (R-020)
  const now = deps.now ?? new Date();
  const clock = deps.clock ?? (() => Date.now());
  const deadlineMs = deps.deadlineMs ?? BREVO_DEADLINE_MS;
  const capture = deps.capture ?? (() => {});
  const { correlationId } = deps;
  const result = emptyResult();

  const config = readConfig(env);
  if (!config) return { ...result, aborted: 'config', reason: 'BREVO_API_KEY/BREVO_LIST_NEW_USERS/BREVO_SYNC_START' };
  const brevo = deps.brevo ?? createBrevoClient(config.apiKey);

  const startedAt = clock();
  const outOfTime = () => clock() - startedAt >= deadlineMs;
  const report = (etapa: string, err: unknown) => {
    const status = err instanceof BrevoError ? err.status : null;
    const code = err instanceof BrevoError ? err.code : null;
    capture(err instanceof BrevoError ? err : new Error(`${JOB}:${etapa} falhou`), { job: JOB, etapa, status, code, correlationId });
  };
  // Para a rodada: 429 é limite da conta inteira, não só da etapa.
  const stopOn429 = (err: unknown) => {
    if (err instanceof BrevoError && err.status === 429) { result.stoppedBy = '429'; return true; }
    return false;
  };

  // ─── E1 inclusão ──────────────────────────────────────────────────────────────────────────
  const cand = await deps.supabase.rpc('brevo_sync_candidates', { p_since: config.start.toISOString(), p_limit: BREVO_INCLUDE_LIMIT });
  if (cand.error) {
    report('candidates', null);
    result.aborted = 'rpc';
    result.reason = 'brevo_sync_candidates';
  } else {
    const rows = (Array.isArray(cand.data) ? cand.data : []) as Candidate[];
    result.candidates = rows.length;
    for (const row of rows) {
      if (outOfTime()) { result.stoppedBy = 'deadline'; break; }
      try {
        await brevo.upsertContact(buildContactPayload(row, config.listId));
      } catch (err) {
        if (stopOn429(err)) break;
        result.includeFailed++;
        report('include', err);
        continue;
      }
      const mark = await deps.supabase.rpc('brevo_mark_synced', { p_user_id: row.user_id });
      if (!mark.error && mark.data === 1) result.included++;
      else if (!mark.error && mark.data === 0) result.alreadyMarked++;
      else { result.markMissing++; report('mark', null); }
    }
  }

  // ─── E2 exclusão espelhada pela lápide ────────────────────────────────────────────────────
  if (result.stoppedBy === null) {
    // eslint-disable-next-line no-restricted-syntax -- instante absoluto, não data civil (R-020)
    const since = new Date(now.getTime() - BREVO_TOMBSTONE_WINDOW_MS).toISOString();
    const del = await deps.supabase.rpc('brevo_deleted_since', { p_since: since });
    if (del.error) {
      report('deleted_since', null);
      result.aborted = result.aborted ?? 'rpc';
      result.reason = result.reason ?? 'brevo_deleted_since';
    } else {
      const ids = (Array.isArray(del.data) ? del.data : []).slice(0, BREVO_DELETE_LIMIT) as Array<{ user_id: string }>;
      result.tombstones = ids.length;
      for (const { user_id } of ids) {
        if (outOfTime()) { result.stoppedBy = 'deadline'; break; }
        try {
          await brevo.deleteByExtId(user_id);
          result.deleted++;
        } catch (err) {
          if (stopOn429(err)) break;
          result.deleteFailed++;
          report('delete', err);
        }
      }
    }
  }

  logger.info('brevo_contacts_sync concluído', { correlationId, ...result });
  return result;
}
