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
  // Hook coord 046 (LGPD consent): quando 046 Slice B estiver em prod, este campo passa a existir
  // e usuários `revoked` são pulados no enqueue (suspensão de pushes de saúde). Enquanto 046 não
  // mergeia, a coluna não é selecionada (não existe) e o filtro é inerte. Ver TODO(046) abaixo.
  consent_status?: string | null;
}

// Partes do calendário local do usuário para um instante absoluto (sem aritmética manual — DST-safe).
function localParts(now: Date, tz: string): { hour: number; weekday: number; dayOfMonth: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', hour12: false, weekday: 'short', day: 'numeric',
  }).formatToParts(now);
  const val = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = parseInt(val('hour'), 10);
  if (hour === 24) hour = 0; // en-US hour12:false pode emitir '24' à meia-noite
  return { hour, weekday: weekdayMap[val('weekday')] ?? -1, dayOfMonth: parseInt(val('day'), 10) || 0 };
}

// Elegibilidade por RANGE por kind — mesma âncora dos jobs legados (09:00 tz do usuário),
// mas por JANELA de hora local em vez de minuto exato. Supressão hierárquica mensal>semanal>
// diário preservada (dia 1 cede ao mensal; domingo cede ao semanal).
function isEligible(kind: OutboxKind, p: { hour: number; weekday: number; dayOfMonth: number }): boolean {
  switch (kind) {
    case 'daily_adherence':
      // Janela 09:xx local; cede ao mensal (dia 1) e ao semanal (domingo).
      return p.hour === 9 && p.weekday !== 0 && p.dayOfMonth !== 1;
    case 'weekly_adherence':
      // Domingo 09:00–11:59 local; cede ao mensal no dia 1.
      return p.weekday === 0 && p.hour >= 9 && p.hour <= 11 && p.dayOfMonth !== 1;
    case 'monthly_report':
      // Dia 1, 09:00–11:59 local.
      return p.dayOfMonth === 1 && p.hour >= 9 && p.hour <= 11;
    default:
      // daily_digest / stock_alert: cutover futuro (mecanismo pronto; janela específica a definir).
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
      .select('user_id, timezone, display_name')
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
    ['daily_adherence', 'weekly_adherence', 'monthly_report'].includes(k)
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
        if (!isEligible(kind, p)) continue;
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
