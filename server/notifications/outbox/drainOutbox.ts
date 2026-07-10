// Spec 043 (Slice A) — drenador genérico da notification_outbox (ADR-078, FR-002/003/007).
//
// Roda a cada tick (api/notify.ts), DEPOIS de checkReminders e do enqueue:
//   1. claim de um lote (FOR UPDATE SKIP LOCKED via RPC — retomada K/N segura)
//   2. batch fetch de settings dos usuários do lote (1 query, paginada — AP-186, FR-003)
//   3. constrói o conteúdo NO ENVIO (SEC-1: a fila só tinha referências) via contentBuilders[kind]
//   4. dispara com paralelismo limitado (pool allSettled — R-281/FR-002), respeitando deadline (ENG-7)
//   5. markSent (channel_results SEM tokens — SEC-3) ou markFailed (fronteira DLQ/retry — ENG-5)
//   6. log agregado único (FR-007)
//
// Estrutural: sem consumidor até um kind entrar em OUTBOX_KINDS. Injeta tudo (testável).

import type { OutboxRepository, OutboxRow, ChannelResult } from './outboxRepository.js';

// O drenador só reivindica e finaliza linhas — nunca enfileira (enqueue é do caminho de entrada).
type DrainRepo = Pick<OutboxRepository, 'claim' | 'markSent' | 'markFailed' | 'revertClaim'>;

// Settings mínimos que o builder precisa (o dispatcher busca devices internamente).
export interface UserSettings {
  user_id: string;
  timezone?: string | null;
  display_name?: string | null;
  [key: string]: unknown;
}

// Constrói o payload de um kind a partir de dados FRESCOS. Retorna null quando o usuário
// deixou de ser elegível no momento do envio (ex.: 0 doses no período) → nada a enviar.
export type ContentBuilder = (args: {
  userId: string;
  periodKey: string;
  settings: UserSettings | undefined;
}) => Promise<Record<string, unknown> | null>;

export interface DrainDeps {
  repo: DrainRepo;
  // dispatcher.dispatch → { success, channels: [{channel, delivered, failed, deactivatedTokens,...}], ... }
  dispatcher: { dispatch(input: any): Promise<any> };
  contentBuilders: Partial<Record<OutboxRow['kind'], ContentBuilder>>;
  // Mapa outbox-kind → kind de dispatch quando divergem (ex.: 'daily_adherence' persiste na
  // fila mas o dispatcher/payload usa 'adherence_report'). Ausente → usa o próprio row.kind.
  dispatchKind?: Partial<Record<OutboxRow['kind'], string>>;
  // Busca settings em lote por lista de userIds (paginado internamente — AP-186).
  fetchSettings: (userIds: string[]) => Promise<Map<string, UserSettings>>;
  correlationId?: string;
  logger?: { info: (...a: any[]) => void; error: (...a: any[]) => void };
  now?: () => number;
  // Orçamento de tempo do drain (ENG-7). Padrão 40s — margem sob maxDuration 60s da Vercel.
  deadlineMs?: number;
  // Concorrência intra-lote (FR-002/R-281). Padrão 8 (faixa 5-10).
  poolSize?: number;
  batchLimit?: number;
}

export interface DrainSummary {
  claimed: number;
  sent: number;
  failed: number;
  skippedNoContent: number;
  deadlineHit: boolean;
  durationMs: number;
}

// Mapeia o resultado do dispatcher para o shape persistido SEM tokens (SEC-3):
// deactivatedTokens (array de tokens brutos) → apenas deactivated_count.
function toChannelResults(dispatchResult: any): ChannelResult[] {
  const channels = Array.isArray(dispatchResult?.channels) ? dispatchResult.channels : [];
  return channels.map((c: any) => ({
    channel: String(c.channel ?? 'unknown'),
    attempted: Number(c.attempted ?? 0),
    delivered: Number(c.delivered ?? 0),
    failed: Number(c.failed ?? 0),
    deactivated_count: Array.isArray(c.deactivatedTokens) ? c.deactivatedTokens.length : 0,
  }));
}

export async function drainOutbox(deps: DrainDeps): Promise<DrainSummary> {
  const {
    repo, dispatcher, contentBuilders, dispatchKind = {}, fetchSettings,
    correlationId,
    logger = { info: () => {}, error: () => {} },
    now = () => Date.now(),
    deadlineMs = 40_000,
    poolSize = 8,
    batchLimit = 25,
  } = deps;

  const start = now();
  const summary: DrainSummary = {
    claimed: 0, sent: 0, failed: 0, skippedNoContent: 0, deadlineHit: false, durationMs: 0,
  };

  const rows = await repo.claim(batchLimit);
  summary.claimed = rows.length;
  if (rows.length === 0) {
    summary.durationMs = now() - start;
    return summary;
  }

  // Batch fetch settings (FR-003): 1 query para todos os userIds do lote (AP-186 — paginado
  // dentro de fetchSettings). O dispatcher busca devices por usuário internamente.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const settingsMap = await fetchSettings(userIds);

  // Processa uma linha (envia + finaliza). Sem checagem de deadline aqui — o deadline é avaliado
  // por LOTE antes de iniciar (ver loop abaixo), evitando iniciar workers só p/ pular.
  const processRow = async (row: OutboxRow) => {
    try {
      const builder = contentBuilders[row.kind];
      if (!builder) {
        // Kind sem builder (não deveria acontecer — enqueue só ocorre para kinds migrados).
        await repo.markFailed(row.id, row.attempts);
        summary.failed += 1;
        return;
      }
      const settings = settingsMap.get(row.user_id);
      const data = await builder({ userId: row.user_id, periodKey: row.period_key, settings });
      if (data === null) {
        // Deixou de ser elegível no envio → marca como enviado (nada a fazer), sem reciclar.
        await repo.markSent(row.id, []);
        summary.skippedNoContent += 1;
        return;
      }
      const result = await dispatcher.dispatch({
        userId: row.user_id,
        kind: dispatchKind[row.kind] ?? row.kind,
        data,
        context: { correlationId, jobType: `outbox_${row.kind}` },
      });
      await repo.markSent(row.id, toChannelResults(result));
      summary.sent += 1;
    } catch (err: any) {
      // Falha na construção/dispatch → attempts (já incrementado no claim) decide 'failed' vs retry.
      logger.error('[drainOutbox] falha ao processar linha', { id: row.id, kind: row.kind, error: err?.message });
      try {
        await repo.markFailed(row.id, row.attempts);
      } catch (markErr: any) {
        logger.error('[drainOutbox] falha ao marcar linha como failed', { id: row.id, error: markErr?.message });
      }
      summary.failed += 1;
    }
  };

  // Loop por LOTE (poolSize em voo, allSettled). Deadline (ENG-7) avaliado ANTES de cada lote:
  // se estourou, reverte TODAS as linhas restantes de uma vez (não gasta tentativa — attempts++
  // do claim revertido) e interrompe — evita iniciar dezenas de workers/reverts espalhados só
  // p/ pular (Gemini #734).
  for (let i = 0; i < rows.length; i += poolSize) {
    if (now() - start > deadlineMs) {
      summary.deadlineHit = true;
      const remaining = rows.slice(i);
      await Promise.allSettled(remaining.map(async (row) => {
        try {
          await repo.revertClaim(row.id, row.attempts);
        } catch (revertErr: any) {
          logger.error('[drainOutbox] falha ao reverter claim por deadline', { id: row.id, error: revertErr?.message });
        }
      }));
      break;
    }
    await Promise.allSettled(rows.slice(i, i + poolSize).map(processRow));
  }

  summary.durationMs = now() - start;
  // Log agregado único (FR-007): um registro por drain, não por usuário.
  logger.info('[drainOutbox] concluído', { correlationId, ...summary });
  return summary;
}
