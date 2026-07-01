import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildLiveActivityStartPayload } from '../buildLiveActivityPayload.js';

// now fixo p/ estado determinístico. Dose em +30min → upcoming (10..60).
const NOW = new Date('2026-07-01T12:00:00.000Z');
const inUpcoming = '2026-07-01T12:30:00.000Z'; // +30min

function item(overrides = {}) {
  return {
    instanceId: 'inst-1',
    scheduledFor: inUpcoming,
    critical_alarm: true,
    medicineName: 'Selozok',
    doseLabel: '25mg • 2 un.',
    scheduledTime: '09:30',
    treatmentPlanId: 'plan-1',
    ...overrides,
  };
}

describe('buildLiveActivityStartPayload', () => {
  afterEach(() => vi.clearAllMocks());

  it('estado recomputado no disparo (upcoming) + content-state casa o struct', () => {
    const p = buildLiveActivityStartPayload(item(), { discreet: false, now: NOW });
    expect(p).not.toBeNull();
    expect(p.contentState.state).toBe('upcoming');
    expect(p.contentState).toHaveProperty('scheduledAt');
    expect(p.contentState.doneAtLabel).toBe('');
    expect(p.attributes.medicineName).toBe('Selozok');
    expect(p.attributes.instanceId).toBe('inst-1');
  });

  it('discreto (S-3): nome e dose NÃO saem no payload', () => {
    const p = buildLiveActivityStartPayload(item(), { discreet: true, now: NOW });
    expect(p.attributes.medicineName).toBe('');
    expect(p.attributes.doseLabel).toBe('');
    expect(p.attributes.discreet).toBe(true);
    // horário (não-PII) pode permanecer
    expect(p.attributes.scheduledTime).toBe('09:30');
  });

  it('scheduled_for ausente/inválido → null (não elegível)', () => {
    expect(buildLiveActivityStartPayload(item({ scheduledFor: null }), { now: NOW })).toBeNull();
  });

  it('dose distante demais (>240min) → null', () => {
    const far = buildLiveActivityStartPayload(item({ scheduledFor: '2026-07-01T20:00:00.000Z' }), { now: NOW });
    expect(far).toBeNull();
  });
});
