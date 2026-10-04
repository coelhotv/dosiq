import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTodayLocal, getCurrentTime, getSaoPauloTime } from '../dateUtils.js';

// Spec 077: dia/hora do server saem da Date de parede por getters LOCAIS. Estes casos passam em
// qualquer fuso de runtime — a suíte roda sob UTC (vitest.critical) e sob America/Sao_Paulo
// (vitest.tz-sp, ver tzGuard.tz-sp.test.ts). Leitura UTC (toISOString/getUTC*) só passa no 1º.

// Implementação ANTERIOR congelada (PO-3): só vale em runtime UTC.
/* eslint-disable no-restricted-syntax */
const legacyTodayLocal = (date: Date) => date.toISOString().split('T')[0];
const legacyCurrentTime = (now: Date) => now.toISOString().slice(11, 16);
/* eslint-enable no-restricted-syntax */

const runtimeTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('getTodayLocal / getCurrentTime — parede de SP (AC-1.1, AC-1.2)', () => {
  it.each([
    ['2026-09-02T00:00:00Z', '2026-09-01', '21:00'],
    ['2026-09-02T00:18:00Z', '2026-09-01', '21:18'],
    ['2026-09-02T02:59:00Z', '2026-09-01', '23:59'],
    ['2026-09-02T03:00:00Z', '2026-09-02', '00:00'],
    ['2027-01-01T02:59:00Z', '2026-12-31', '23:59'],
  ])('instante %s → dia %s, hora %s', (iso, day, hhmm) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    expect(getTodayLocal()).toBe(day);
    expect(getTodayLocal(getSaoPauloTime(iso))).toBe(day);
    expect(getCurrentTime()).toBe(hhmm);
  });

  it('Date inválida continua lançando RangeError (contrato anterior)', () => {
    expect(() => getTodayLocal(new Date('x'))).toThrow(RangeError);
  });
});

describe.runIf(runtimeTz === 'UTC')('equivalência com a implementação anterior sob UTC (AC-2.1)', () => {
  it('0 divergências em 24h de SP a cada 15 min + virada de ano', () => {
    const starts = [Date.UTC(2026, 8, 1, 3, 0), Date.UTC(2026, 11, 31, 3, 0)];
    const divergences: string[] = [];
    let samples = 0;
    vi.useFakeTimers();
    for (const start of starts) {
      for (let m = 0; m < 48 * 60; m += 15) {
        const instant = new Date(start + m * 60_000);
        vi.setSystemTime(instant);
        const wall = getSaoPauloTime(instant);
        samples++;
        if (getTodayLocal(wall) !== legacyTodayLocal(wall)) divergences.push(`dia ${instant.toISOString()}`);
        if (getTodayLocal() !== legacyTodayLocal(getSaoPauloTime())) divergences.push(`hoje ${instant.toISOString()}`);
        if (getCurrentTime() !== legacyCurrentTime(getSaoPauloTime())) divergences.push(`hora ${instant.toISOString()}`);
      }
    }
    expect(samples).toBeGreaterThanOrEqual(2 * 48);
    expect(divergences).toEqual([]);
  });
});
