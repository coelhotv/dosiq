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

  it('DEFAULT explícito (decisão PO 2026-06-29): mostra o nome (iOS não redige a LA)', () => {
    const p = buildLiveActivityStartPayload(item(), { now: NOW }); // sem discreet → default
    expect(p.attributes.medicineName).toBe('Selozok');
    expect(p.attributes.discreet).toBe(false);
  });

  it('fallback do nome: sem medicineLabel derivado usa doseItem.medicineName; senão "Dose"', () => {
    const p = buildLiveActivityStartPayload(item({ medicineName: '' }), { now: NOW });
    expect(p.attributes.medicineName).toBe('Dose');
  });

  it('discreto (opt-in): nome e dose NÃO saem no payload', () => {
    const p = buildLiveActivityStartPayload(item(), { discreet: true, now: NOW });
    expect(p.attributes.medicineName).toBe('');
    expect(p.attributes.doseLabel).toBe('');
    expect(p.attributes.discreet).toBe(true);
    // horário (não-PII) pode permanecer
    expect(p.attributes.scheduledTime).toBe('09:30');
  });

  it('staleEpochSec = boundary de LATE (pula now) — a única transição app-fechado que importa', () => {
    // dose em +30min (upcoming). staleDate deve ir p/ o boundary now→late (scheduled + 10min),
    // NÃO p/ upcoming→now (scheduled − 10min). 'now' é cosmético (push+alarme donos do T0).
    const p = buildLiveActivityStartPayload(item(), { now: NOW });
    const lateBoundarySec = Math.floor((NOW.getTime() + 40 * 60000) / 1000);
    expect(p.staleEpochSec).toBe(lateBoundarySec);
  });

  it('scheduled_for ausente/inválido → null (não elegível)', () => {
    expect(buildLiveActivityStartPayload(item({ scheduledFor: null }), { now: NOW })).toBeNull();
  });

  it('dose distante demais (>240min) → null', () => {
    const far = buildLiveActivityStartPayload(item({ scheduledFor: '2026-07-01T20:00:00.000Z' }), { now: NOW });
    expect(far).toBeNull();
  });
});
