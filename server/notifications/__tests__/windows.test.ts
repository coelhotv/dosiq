// Spec 109 Slice A — regras de janela em fonte única (PO-3). Instantes em UTC absoluto; SP = UTC−3.
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  localParts,
  isReportEligible,
  isDailyDigestEligible,
  isInStockAlertWindow,
  hhmmInTimezone,
  isLegacyDigestMinute,
} from '../windows.js';

const SP = 'America/Sao_Paulo';
// 2026-10-27 é terça; 2026-11-01 é domingo E dia 1; 2026-10-25 é domingo.
const at = (iso: string) => new Date(iso);

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('windows — relatórios (09:00–09:09 local)', () => {
  it('diário: 09:00 e 09:09 dentro; 08:59 e 09:10 fora', () => {
    expect(isReportEligible('daily_adherence', localParts(at('2026-10-27T12:00:00Z'), SP), {})).toBe(true);
    expect(isReportEligible('daily_adherence', localParts(at('2026-10-27T12:09:59Z'), SP), {})).toBe(true);
    expect(isReportEligible('daily_adherence', localParts(at('2026-10-27T11:59:59Z'), SP), {})).toBe(false);
    expect(isReportEligible('daily_adherence', localParts(at('2026-10-27T12:10:00Z'), SP), {})).toBe(false);
  });

  it('semanal só domingo; diário cede ao semanal', () => {
    const sun = localParts(at('2026-10-25T12:05:00Z'), SP);
    expect(isReportEligible('weekly_adherence', sun, {})).toBe(true);
    expect(isReportEligible('daily_adherence', sun, {})).toBe(false);
  });

  it('mensal no dia 1; semanal e diário cedem', () => {
    const first = localParts(at('2026-11-01T12:05:00Z'), SP);
    expect(isReportEligible('monthly_report', first, {})).toBe(true);
    expect(isReportEligible('weekly_adherence', first, {})).toBe(false);
    expect(isReportEligible('daily_adherence', first, {})).toBe(false);
  });

  it('stock_alert nunca é kind de relatório', () => {
    expect(isReportEligible('stock_alert' as never, localParts(at('2026-10-27T12:00:00Z'), SP), {})).toBe(false);
  });
});

describe('windows — digest da outbox [digest_time, +10min)', () => {
  const p = (iso: string) => localParts(at(iso), SP);
  it('só digest_morning; digest_time NULL ⇒ 07:00 (FM-3)', () => {
    expect(isDailyDigestEligible({ notification_mode: 'digest_morning', digest_time: null }, p('2026-10-27T10:00:00Z'))).toBe(true);
    expect(isDailyDigestEligible({ notification_mode: 'realtime', digest_time: '07:00' }, p('2026-10-27T10:00:00Z'))).toBe(false);
  });
  it('aceita "HH:MM:SS" do banco e cruza a hora (08:55 → 09:04)', () => {
    const u = { notification_mode: 'digest_morning', digest_time: '08:55:00' };
    expect(isDailyDigestEligible(u, p('2026-10-27T12:04:00Z'))).toBe(true);
    expect(isDailyDigestEligible(u, p('2026-10-27T12:05:00Z'))).toBe(false);
  });
});

describe('windows — estoque (10:00–10:09 local)', () => {
  it('dentro e fora; fuso diferente desloca a janela', () => {
    expect(isInStockAlertWindow(at('2026-10-27T13:00:00Z'), SP)).toBe(true);
    expect(isInStockAlertWindow(at('2026-10-27T13:10:00Z'), SP)).toBe(false);
    expect(isInStockAlertWindow(at('2026-10-27T13:00:00Z'), 'America/Manaus')).toBe(false);
    expect(isInStockAlertWindow(at('2026-10-27T14:00:00Z'), 'America/Manaus')).toBe(true);
  });
  it('tz inválida lança (o chamador isola por perfil — FM-2)', () => {
    expect(() => isInStockAlertWindow(at('2026-10-27T13:00:00Z'), 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('windows — digest legado (minuto exato)', () => {
  it('HH:MM igual ao digest_time (formato do banco) e NULL ⇒ 07:00', () => {
    const hhmm = hhmmInTimezone(at('2026-10-27T10:00:30Z'), SP);
    expect(hhmm).toBe('07:00');
    expect(isLegacyDigestMinute(hhmm, null)).toBe(true);
    expect(isLegacyDigestMinute(hhmm, '07:00:00')).toBe(true);
    expect(isLegacyDigestMinute(hhmmInTimezone(at('2026-10-27T10:01:00Z'), SP), '07:00')).toBe(false);
  });
});
