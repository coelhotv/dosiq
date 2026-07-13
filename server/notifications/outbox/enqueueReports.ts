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

// Partes do calendário local do usuário para um instante absoluto (sem aritmética manual — DST-safe).
function localParts(now: Date, tz: string): { hour: number; minute: number; weekday: number; dayOfMonth: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short', day: 'numeric',
  }).formatToParts(now);
  const val = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = parseInt(val('hour'), 10);
  if (hour === 24) hour = 0; // en-US hour12:false pode emitir '24' à meia-noite
  const minute = parseInt(val('minute'), 10) || 0;
  return { hour, minute, weekday: weekdayMap[val('weekday')] ?? -1, dayOfMonth: parseInt(val('day'), 10) || 0 };
}

// Elegibilidade por RANGE por kind — mesma âncora dos jobs legados (09:00 tz do usuário),
// mas por JANELA de hora local em vez de minuto exato. Supressão hierárquica mensal>semanal>
// diário preservada (dia 1 cede ao mensal; domingo cede ao semanal).
function isEligible(
  kind: OutboxKind,
  p: { hour: number; minute: number; weekday: number; dayOfMonth: number },
  u: EnqueueUserRow
): boolean {
  // Janela ESTREITA 09:00–09:09 local: cron roda 1×/min; a UNIQUE já dá idempotência, mas uma
  // janela larga (1-3h) faria upsert massivo por minuto (WAL/índice) — 10min basta p/ catch-up
  // se um tick pular, cortando ~36× as escritas redundantes (Gemini #734).
  switch (kind) {
    case 'daily_adherence':
      // 09:00-09:09 local; cede ao mensal (dia 1) e ao semanal (domingo).
      return p.hour === 9 && p.minute < 10 && p.weekday !== 0 && p.dayOfMonth !== 1;
    case 'weekly_adherence':
      // Domingo 09:00–09:09 local; cede ao mensal no dia 1.
      return p.weekday === 0 && p.hour === 9 && p.minute < 10 && p.dayOfMonth !== 1;
    case 'monthly_report':
      // Dia 1, 09:00–09:09 local.
      return p.dayOfMonth === 1 && p.hour === 9 && p.minute < 10;
    case 'daily_digest': {
      // 043 T023b. Duas diferenças em relação aos relatórios:
      //   1. só quem escolheu o modo digest (o resto recebe lembrete por dose);
      //   2. a âncora é o `digest_time` DO USUÁRIO, não 09:00.
      // O legado comparava `HH:MM` exato (família AP-259: tick que pula o minuto perde o dia
      // inteiro). Aqui a janela é [digest_time, +10min) e a UNIQUE dá a idempotência.
      if (u.notification_mode !== 'digest_morning') return false;
      const [dh, dm] = String(u.digest_time || '07:00').slice(0, 5).split(':').map(Number);
      if (!Number.isFinite(dh) || !Number.isFinite(dm)) return false;
      // Janela dentro da MESMA hora local: digest_time 09:55 → 09:55-09:59 (não vaza p/ 10:0x,
      // onde a data local já pode ter virado em algum tz).
      return p.hour === dh && p.minute >= dm && p.minute < dm + 10;
    }
    default:
      // stock_alert: NÃO migra aqui. É fan-out (1 alerta por MEDICAMENTO, + stock_expiry_alert
      // por LOTE) e a UNIQUE (user_id, kind, period_key) só expressa 1 linha por usuário/dia —
      // enfileirar o 2º medicamento seria recusado pela constraint e o alerta sumiria em
      // silêncio. Precisa de `subject_id` no modelo (spec própria). Legado segue rodando e já
      // carrega o filtro dose-only (044/T005).
      return false;
  }
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
  const migrated = [...kinds].filter((k): k is OutboxKind =>
    ['daily_adherence', 'weekly_adherence', 'monthly_report', 'daily_digest'].includes(k)
  );
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
        const tz = u.timezone || 'America/Sao_Paulo';
        const p = localParts(now, tz);
        if (!isEligible(kind, p, u)) continue;
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
