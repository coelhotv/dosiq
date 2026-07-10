// Spec 043 (Slice A) — repositório da notification_outbox (ADR-078).
//
// Factory (injeta client → testável com mock). Quatro operações:
//   enqueue   → INSERT ON CONFLICT (user_id,kind,period_key) DO NOTHING (idempotência por constraint)
//   claim     → RPC claim_notification_outbox (FOR UPDATE SKIP LOCKED + attempts++, atômico)
//   markSent  → status='sent' + channel_results (SEM tokens — SEC-3)
//   markFailed→ 'failed' ao atingir cap de tentativas (ENG-5), senão volta a 'pending' p/ retry
//
// A fila guarda SÓ referências (SEC-1): enqueue recebe user_id+kind+period_key, nunca payload.

import type { OutboxKind } from './periodKey.js';

// Cap de tentativas antes de marcar 'failed' definitivamente (ENG-5). attempts é incrementado
// no claim (RPC), então ao chamar markFailed o valor já reflete a tentativa corrente.
export const MAX_OUTBOX_ATTEMPTS = 3;

export interface OutboxRow {
  id: string;
  user_id: string;
  kind: OutboxKind;
  period_key: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  attempts: number;
  channel_results: ChannelResult[] | null;
  created_at: string;
  claimed_at: string | null;
  sent_at: string | null;
}

// Resultado por canal gravado em channel_results — contagens/device_id, NUNCA token bruto (SEC-3).
export interface ChannelResult {
  channel: string;
  attempted: number;
  delivered: number;
  failed: number;
  deactivated_count?: number;
}

export interface EnqueueEntry {
  userId: string;
  kind: OutboxKind;
  periodKey: string;
}

// Contrato mínimo do client (subset do SupabaseClient) — mantém o mock de teste enxuto.
export interface OutboxSupabaseClient {
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): any;
}

export interface OutboxRepository {
  enqueue(entries: EnqueueEntry[]): Promise<number>;
  claim(batchLimit?: number): Promise<OutboxRow[]>;
  markSent(id: string, channelResults: ChannelResult[]): Promise<void>;
  markFailed(id: string, attempts: number, channelResults?: ChannelResult[]): Promise<void>;
  // Reverte o attempts++ do claim quando a linha foi reivindicada mas NÃO processada (deadline).
  // Sem isso, um row sempre-no-fim-do-lote acumula attempts sem nunca ser tentado → falha prematura.
  revertClaim(id: string, currentAttempts: number): Promise<void>;
}

export function createOutboxRepository(
  // eslint-disable-next-line no-restricted-syntax -- timestamp UTC absoluto de envio, não parse de date-string
  { client, now = () => new Date().toISOString() }:
  { client: OutboxSupabaseClient; now?: () => string }
): OutboxRepository {
  return {
    // Enfileira em lote. ON CONFLICT DO NOTHING (ignoreDuplicates) → re-enfileirar o mesmo
    // (user,kind,período) é no-op: a idempotência vive na UNIQUE, não na aplicação.
    async enqueue(entries) {
      if (!entries.length) return 0;
      const rows = entries.map((e) => ({
        user_id: e.userId,
        kind: e.kind,
        period_key: e.periodKey,
      }));
      const { error } = await client
        .from('notification_outbox')
        .upsert(rows, { onConflict: 'user_id,kind,period_key', ignoreDuplicates: true });
      if (error) throw new Error(`outbox.enqueue: ${error.message}`);
      // Não retornamos "quantas de fato inseriram" (ignoreDuplicates não expõe isso de forma
      // confiável); retornamos o total tentado — o log agregado (FR-007) usa o count do drain.
      return rows.length;
    },

    // Reivindica um lote atômico via RPC (SKIP LOCKED). attempts já vem incrementado.
    async claim(batchLimit = 25) {
      const { data, error } = await client.rpc('claim_notification_outbox', { batch_limit: batchLimit });
      if (error) throw new Error(`outbox.claim: ${error.message}`);
      return (data ?? []) as OutboxRow[];
    },

    async markSent(id, channelResults) {
      const { error } = await client
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: now(), channel_results: channelResults })
        .eq('id', id);
      if (error) throw new Error(`outbox.markSent: ${error.message}`);
    },

    // Reverte o claim de uma linha reivindicada mas pulada por deadline (Gemini #734): volta a
    // 'pending' (senão fica presa em 'processing') + limpa claimed_at + decrementa o attempts++.
    async revertClaim(id, currentAttempts) {
      const { error } = await client
        .from('notification_outbox')
        .update({ status: 'pending', claimed_at: null, attempts: Math.max(0, currentAttempts - 1) })
        .eq('id', id);
      if (error) throw new Error(`outbox.revertClaim: ${error.message}`);
    },

    // Fronteira DLQ/retry (ENG-5): >= cap → 'failed' (para de reciclar); senão fica 'pending'
    // e o próximo drain tenta de novo (o claim voltará a incrementar attempts).
    async markFailed(id, attempts, channelResults) {
      const status = attempts >= MAX_OUTBOX_ATTEMPTS ? 'failed' : 'pending';
      // claimed_at=null: sai de 'processing' → linha volta a pending limpa (re-claimable) ou failed.
      const patch: Record<string, unknown> = { status, claimed_at: null };
      if (channelResults) patch.channel_results = channelResults;
      const { error } = await client
        .from('notification_outbox')
        .update(patch)
        .eq('id', id);
      if (error) throw new Error(`outbox.markFailed: ${error.message}`);
    },
  };
}
