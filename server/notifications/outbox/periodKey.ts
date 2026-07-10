// Spec 043 (Slice A) — chave de período da notification_outbox (ENG-3, ADR-078).
//
// Função ÚNICA de definição de `period_key` — o segundo componente da UNIQUE
// (user_id, kind, period_key) que garante "exatamente-uma notificação por período".
// A granularidade do período vem do `kind`:
//   daily  → 'YYYY-MM-DD' (data local do usuário, R-254 — mesmo tz do dono)
//   weekly → 'YYYY-Www'   (semana ISO-8601, segunda como início)
//   monthly→ 'YYYY-MM'    (mês local do usuário)
//
// Server-only (server/notifications/outbox/): web/mobile não consomem. A chave é derivada
// SEMPRE do tz do usuário — nunca do wall-clock do servidor — para que a fronteira de dia/
// semana/mês case com a experiência do usuário (mata a fatia minuto-exato, família AP-259).
//
// Determinística e pura: mesmo (kind, date, tz) → mesma chave. Testável com Intl (DST/tz-boundary).

export type OutboxKind =
  | 'daily_adherence'
  | 'weekly_adherence'
  | 'monthly_report'
  | 'daily_digest'
  | 'stock_alert';

type Granularity = 'daily' | 'weekly' | 'monthly';

// Granularidade do período por kind. daily_digest e stock_alert reiniciam a cada dia local.
const KIND_GRANULARITY: Record<OutboxKind, Granularity> = {
  daily_adherence: 'daily',
  daily_digest: 'daily',
  stock_alert: 'daily',
  weekly_adherence: 'weekly',
  monthly_report: 'monthly',
};

/**
 * Extrai ano/mês/dia do calendário local do usuário (no tz dado) para um instante absoluto.
 * Usa Intl (en-CA → YYYY-MM-DD estável) para respeitar DST sem aritmética manual de offset.
 */
function localYMD(date: Date, userTz: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: userTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * Semana ISO-8601 (segunda=início; semana 1 contém a primeira quinta-feira do ano) a partir
 * de uma data local Y/M/D. Retorna { isoYear, isoWeek } — o isoYear pode diferir do ano civil
 * na virada (ex.: 2027-01-01 pode cair na semana 53 de 2026).
 */
function isoWeek(year: number, month: number, day: number): { isoYear: number; isoWeek: number } {
  // UTC puro como aritmética de calendário — sem influência de tz/DST (Y/M/D já é local).
  // eslint-disable-next-line no-restricted-syntax -- Date.UTC(Y,M,D) numérico, não parse de string
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7; // 1=seg..7=dom (ISO)
  // Desloca para a quinta-feira da mesma semana ISO — âncora que define o ano/semana ISO.
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return { isoYear, isoWeek: week };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Chave de período para a outbox. Determinística por (kind, date, userTz).
 * @param kind   kind da notificação (define a granularidade)
 * @param date   instante absoluto de referência (default: agora)
 * @param userTz IANA tz do usuário (default: America/Sao_Paulo — fallback R-254)
 */
export function periodKey(
  kind: OutboxKind,
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto "agora", não parse de date-string
  date: Date = new Date(),
  userTz = 'America/Sao_Paulo'
): string {
  const granularity = KIND_GRANULARITY[kind];
  const { year, month, day } = localYMD(date, userTz);

  switch (granularity) {
    case 'daily':
      return `${year}-${pad2(month)}-${pad2(day)}`;
    case 'monthly':
      return `${year}-${pad2(month)}`;
    case 'weekly': {
      const { isoYear, isoWeek: wk } = isoWeek(year, month, day);
      return `${isoYear}-W${pad2(wk)}`;
    }
  }
}
