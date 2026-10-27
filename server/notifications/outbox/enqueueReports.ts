// Spec 043 (Slice A) — enfileiramento de relatórios por RANGE (ADR-078, FR-004).
//
// Substitui o gatilho minuto-exato dos relatórios (família AP-259: `hhmm !== '09:00' continue`
// perde o alvo se o tick pular o minuto) por elegibilidade por JANELA. A UNIQUE
// (user_id,kind,period_key) garante que enfileirar o mesmo período várias vezes na janela é
// no-op → "exatamente-uma notificação por período". A fila guarda SÓ referências (SEC-1).
//
// Cutover kind-a-kind: só processa kinds presentes em `kinds` (derivado de OUTBOX_KINDS).
// Legado dos kinds NÃO migrados segue rodando em tasks.ts.

import { periodKey, type OutboxKind } from './periodKey.js';
import type { OutboxRepository, EnqueueEntry } from './outboxRepository.js';
// 109 (E-2): regras de janela em fonte única — o gate do tick lê as MESMAS.
import { localParts, isReportEligible, REPORT_KINDS, DEFAULT_TIMEZONE } from '../windows.js';

export interface EnqueueUserRow {
  user_id: string;
  timezone?: string | null;
  display_name?: string | null;
  // 043 T023b (daily_digest): a âncora do digest NÃO é 09:00 — é o horário escolhido pelo
  // usuário, e só vale p/ quem está em `digest_morning`. Ambos vêm no MESMO select.
  notification_mode?: string | null;
  digest_time?: string | null;
  // Hook coord 046 (LGPD consent): quando 046 Slice B estiver em prod, este campo passa a existir
  // e usuários `revoked` são pulados no enqueue (suspensão de pushes de saúde). Enquanto 046 não
  // mergeia, a coluna não é selecionada (não existe) e o filtro é inerte. Ver TODO(046) abaixo.
  consent_status?: string | null;
}

// Busca todos os user_settings paginado (AP-186 — PostgREST trunca em ~1000 sem erro).
async function fetchAllUserSettings(supabase: any): Promise<EnqueueUserRow[]> {
  const pageSize = 1000;
  const out: EnqueueUserRow[] = [];
  for (let page = 0; ; page++) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from('user_settings')
      // notification_mode + digest_time: elegibilidade do daily_digest (T023b) no MESMO select.
      .select('user_id, timezone, display_name, notification_mode, digest_time')
      .order('user_id')  // ordenação estável: sem ela .range() é não-determinístico (pula/duplica) — Gemini #734
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`enqueueReports.fetchAllUserSettings: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

export interface EnqueueReportsResult {
  enqueuedByKind: Record<string, number>;
  usersScanned: number;
}

/**
 * Enfileira relatórios elegíveis para os kinds migrados neste tick.
 * @param kinds  kinds migrados (subset de OUTBOX_KINDS) — vazio → no-op
 */
export async function enqueueEligibleReports(
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto do tick, tz aplicada via Intl
  { repo, supabase, kinds, now = new Date() }:
  { repo: OutboxRepository; supabase: any; kinds: Set<string>; now?: Date }
): Promise<EnqueueReportsResult> {
  const enqueuedByKind: Record<string, number> = {};
  const migrated = [...kinds].filter((k): k is OutboxKind => (REPORT_KINDS as readonly string[]).includes(k));
  if (migrated.length === 0) return { enqueuedByKind, usersScanned: 0 };

  const users = await fetchAllUserSettings(supabase);

  for (const kind of migrated) {
    const entries: EnqueueEntry[] = [];
    for (const u of users) {
      // Isola por usuário: tz corrompida no DB → Intl lança RangeError; sem try/catch derrubaria
      // o enqueue de TODOS os outros usuários (Gemini #734).
      try {
        // TODO(046): quando consent_status existir, pular `revoked` aqui (suspensão de push de saúde).
        // if (u.consent_status === 'revoked') continue;
        const tz = u.timezone || DEFAULT_TIMEZONE;
        const p = localParts(now, tz);
        if (!isReportEligible(kind, p, u)) continue;
        entries.push({ userId: u.user_id, kind, periodKey: periodKey(kind, now, tz) });
      } catch (err: any) {
        console.error(`[enqueueEligibleReports] elegibilidade falhou p/ user ${u.user_id}:`, err?.message);
      }
    }
    if (entries.length > 0) {
      await repo.enqueue(entries);
      enqueuedByKind[kind] = entries.length;
    }
  }

  return { enqueuedByKind, usersScanned: users.length };
}
