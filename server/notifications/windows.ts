// Spec 109 Slice A (E-2) — regras PURAS de janela dos jobs agendados, fonte ÚNICA (INV-4).
//
// Antes viviam nos próprios jobs (`enqueueReports`, `enqueueStockAlerts`, `dailyDigest`); o gate do
// tick (`tick/tickGate.ts`, nível A) precisa das MESMAS regras para decidir se o enfileiramento roda.
// Duplicar seria abrir um falso-negativo silencioso (relatório perdido) no dia em que uma divergir.
// Os jobs passam a importar daqui; as regras foram movidas sem alteração.
//
// Nível A (server/notifications): sem import de server/bot (R-283/R-284).

import type { OutboxKind } from './outbox/periodKey.js';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
export const DEFAULT_DIGEST_TIME = '07:00';

/** Campos de `user_settings` que as regras de janela leem. */
export interface WindowUserRow {
  notification_mode?: string | null;
  digest_time?: string | null;
}

export interface LocalParts {
  hour: number;
  minute: number;
  weekday: number;
  dayOfMonth: number;
}

// Partes do calendário local do usuário para um instante absoluto (sem aritmética manual — DST-safe).
export function localParts(now: Date, tz: string): LocalParts {
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

/**
 * Elegibilidade do daily_digest (043 T023b) — extraída de isEligible p/ reduzir complexidade
 * (R-122). Duas diferenças em relação aos relatórios: 1. só quem escolheu o modo digest (o
 * resto recebe lembrete por dose); 2. a âncora é o `digest_time` DO USUÁRIO, não 09:00.
 * O legado comparava `HH:MM` exato (família AP-259: tick que pula o minuto perde o dia
 * inteiro). Aqui a janela é [digest_time, +10min) e a UNIQUE dá a idempotência.
 */
export function isDailyDigestEligible(u: WindowUserRow, p: { hour: number; minute: number }): boolean {
  if (u.notification_mode !== 'digest_morning') return false;
  const [dh, dm] = String(u.digest_time || DEFAULT_DIGEST_TIME).slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(dh) || !Number.isFinite(dm)) return false;
  // Janela em MINUTOS DESDE A MEIA-NOITE local — cruza a fronteira de hora de propósito
  // (review #742): prender a janela na mesma hora truncaria o horário quebrado (08:55 teria
  // 5min, 08:59 teria 1min) e reabriria exatamente a perda que a janela existe p/ evitar.
  // A data local só vira à MEIA-NOITE, então cruzar 09:59→10:00 não muda o period_key.
  // Sem wrap por design: digest às 23:5x não "vaza" p/ o dia seguinte (o period_key já seria
  // outro dia — enfileiraria o digest errado).
  const diff = (p.hour * 60 + p.minute) - (dh * 60 + dm);
  return diff >= 0 && diff < 10;
}

// Elegibilidade por RANGE por kind — mesma âncora dos jobs legados (09:00 tz do usuário),
// mas por JANELA de hora local em vez de minuto exato. Supressão hierárquica mensal>semanal>
// diário preservada (dia 1 cede ao mensal; domingo cede ao semanal).
export function isReportEligible(kind: OutboxKind, p: LocalParts, u: WindowUserRow): boolean {
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
    case 'daily_digest':
      return isDailyDigestEligible(u, p);
    default:
      // stock_alert: NÃO migra aqui. É fan-out (1 alerta por MEDICAMENTO, + stock_expiry_alert
      // por LOTE) e a UNIQUE (user_id, kind, period_key) só expressa 1 linha por usuário/dia —
      // enfileirar o 2º medicamento seria recusado pela constraint e o alerta sumiria em
      // silêncio. Precisa de `subject_id` no modelo (spec própria). Legado segue rodando e já
      // carrega o filtro dose-only (044/T005).
      return false;
  }
}

/** Kinds enfileirados por `enqueueEligibleReports` (por range, 1 linha por usuário/período). */
export const REPORT_KINDS: readonly OutboxKind[] = [
  'daily_adherence', 'weekly_adherence', 'monthly_report', 'daily_digest',
];

// Âncora do alerta de volume: 10:00–10:09 na TZ DO USUÁRIO.
// - `minute < 10` em vez de `minute === 0` (o do legado): família AP-259 — um tick que pule o
//   minuto exato perde o dia inteiro. A UNIQUE dá a idempotência dentro da janela.
// - Janela estreita (e não "todo tick"): a fila resolve idempotência, não CUSTO — varrer
//   protocols+stock 1440×/dia seriam duas queries pesadas por minuto.
export const STOCK_ALERT_HOUR = 10;
export const STOCK_ALERT_WINDOW_MINUTES = 10;

export function isInStockAlertWindow(now: Date, tz: string): boolean {
  const { hour, minute } = localParts(now, tz);
  return hour === STOCK_ALERT_HOUR && minute < STOCK_ALERT_WINDOW_MINUTES;
}

/** `HH:MM` local no MESMO formato de `getCurrentTimeInTimezone` (server/utils/dateUtils). */
export function hhmmInTimezone(now: Date, tz: string): string {
  return now.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Digest LEGADO (`runDailyDigestViaDispatcher`, quando `daily_digest` não está em OUTBOX_KINDS):
 * minuto EXATO `HH:MM === digest_time` (AP-259 conhecido — o caminho da outbox usa janela de 10 min).
 */
export function isLegacyDigestMinute(currentHHMM: string, digestTime: string | null | undefined): boolean {
  return currentHHMM === String(digestTime || DEFAULT_DIGEST_TIME).slice(0, 5);
}
