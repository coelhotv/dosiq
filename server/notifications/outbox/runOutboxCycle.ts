// Spec 043 (Slice A) — orquestra 1 ciclo da outbox no tick (ADR-078). Chamado por api/notify.ts
// DEPOIS de checkReminders (ADR-057 intacto), isolado por try/catch no chamador (PO-1).
//
// Nível A (server/notifications): NÃO importa código nível-B (evita arrastar subárvore não-tipada
// pro compile strict-A — R-283/R-284). Os content builders (que vivem em server/bot, nível B) são
// INJETADOS pelo chamador (api/notify.ts). Aqui só orquestra enqueue + drain com deps tipadas.

import { createOutboxRepository } from './outboxRepository.js';
import { enqueueEligibleReports } from './enqueueReports.js';
import { drainOutbox, type ContentBuilder, type DrainSummary } from './drainOutbox.js';

export interface OutboxCycleResult {
  enqueuedByKind: Record<string, number>;
  drain: DrainSummary;
}

export async function runOutboxCycle(
  { supabase, dispatcher, outboxKinds, contentBuilders, dispatchKind, correlationId, logger }:
  {
    supabase: any;
    dispatcher: { dispatch(input: any): Promise<any> };
    outboxKinds: Set<string>;
    // Registry outbox-kind → builder puro (injetado pelo chamador nível-B). Só kinds aqui drenam.
    contentBuilders: Partial<Record<string, ContentBuilder>>;
    // outbox kind → kind de dispatch quando divergem (ex.: 'daily_adherence' → 'adherence_report').
    dispatchKind?: Record<string, string>;
    correlationId?: string;
    logger?: { info: (...a: any[]) => void; error: (...a: any[]) => void };
  }
): Promise<OutboxCycleResult> {
  const repo = createOutboxRepository({ client: supabase });

  // 1. Enqueue por range dos kinds migrados (no-op se OUTBOX_KINDS vazio).
  const { enqueuedByKind } = await enqueueEligibleReports({ repo, supabase, kinds: outboxKinds });

  // 2. Drain: constrói conteúdo no envio, pool limitado, deadline, channel_results sem tokens.
  const drain = await drainOutbox({
    repo,
    dispatcher,
    contentBuilders,
    dispatchKind,
    fetchSettings: async (userIds: string[]) => {
      const map = new Map();
      if (userIds.length === 0) return map;
      // Lote ≤ batchLimit (25) → single IN (bem abaixo do teto AP-186 de ~1000).
      const { data } = await supabase
        .from('user_settings')
        .select('user_id, timezone, display_name')
        .in('user_id', userIds);
      (data ?? []).forEach((r: any) => map.set(r.user_id, r));
      return map;
    },
    correlationId,
    logger,
  });

  return { enqueuedByKind, drain };
}
