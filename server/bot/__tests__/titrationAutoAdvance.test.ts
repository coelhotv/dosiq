// 012 Fase B (FR-005b): avanço automático de titulação por cronograma.
// Testa a função pura de detecção de etapa vencida (_titrationDueAdvance);
// o update no banco + dispatch são exercitados via mocks no caller.
import { describe, it, expect, vi } from 'vitest';

// `_titrationDueAdvance` é PURA, mas mora num módulo que instancia o client do Supabase no topo
// (fail-fast: sem env vars, `server/services/supabase.ts` LANÇA). O import da função pura arrasta
// esse efeito colateral, e o CI não tem as env vars — a suíte morria na CARGA, não num assert.
// Mockar o client (mesmo padrão das outras suítes de server/) isola a função pura do módulo.
vi.mock('../../services/supabase.js', () => ({ supabase: {} }));

import { _titrationDueAdvance } from '../_reminderHelpers.js';

const MS_DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-06-01T08:00:00.000Z');

const glp1 = {
  titration_schedule: [
    { days: 28, dosage: 0.25 },
    { days: 28, dosage: 0.5 },
    { days: 28, dosage: 1.0 },
  ],
  current_stage_index: 0,
  stage_started_at: '2026-06-01T08:00:00.000Z',
  titration_status: 'titulando',
};

describe('_titrationDueAdvance', () => {
  it('dentro da etapa atual → null (nada vencido, sem notificação)', () => {
    expect(_titrationDueAdvance(glp1, T0 + 10 * MS_DAY)).toBeNull();
  });

  it('etapa 1 esgotada → avança p/ etapa 2; stage_started_at = fim ACUMULADO (não now)', () => {
    // Cron roda 2 dias atrasado em relação à fronteira (dia 30)
    const out = _titrationDueAdvance(glp1, T0 + 30 * MS_DAY);
    expect(out).toEqual({
      newIndex: 1,
      newStageStartedAt: new Date(T0 + 28 * MS_DAY).toISOString(),
      reachedTarget: false,
    });
  });

  it('múltiplas etapas vencidas (app fechado semanas) → caminha todas de uma vez', () => {
    const out = _titrationDueAdvance(glp1, T0 + 60 * MS_DAY);
    expect(out.newIndex).toBe(2);
    expect(out.newStageStartedAt).toBe(new Date(T0 + 56 * MS_DAY).toISOString());
    expect(out.reachedTarget).toBe(false);
  });

  it('última etapa esgotada → alvo atingido (índice congela na última)', () => {
    const out = _titrationDueAdvance(glp1, T0 + 90 * MS_DAY);
    expect(out.newIndex).toBe(2);
    expect(out.reachedTarget).toBe(true);
  });

  it('status não-titulando → null (estável/alvo_atingido não avançam)', () => {
    expect(_titrationDueAdvance({ ...glp1, titration_status: 'estável' }, T0 + 90 * MS_DAY)).toBeNull();
    expect(_titrationDueAdvance({ ...glp1, titration_status: 'alvo_atingido' }, T0 + 90 * MS_DAY)).toBeNull();
  });

  it('degenerados → null: sem schedule, sem stage_started_at, days inválido, índice fora', () => {
    expect(_titrationDueAdvance(null, T0)).toBeNull();
    expect(_titrationDueAdvance({ ...glp1, titration_schedule: [] }, T0 + 90 * MS_DAY)).toBeNull();
    expect(_titrationDueAdvance({ ...glp1, stage_started_at: null }, T0 + 90 * MS_DAY)).toBeNull();
    expect(_titrationDueAdvance({ ...glp1, titration_schedule: [{ days: 0, dosage: 0.25 }] }, T0 + 90 * MS_DAY)).toBeNull();
    expect(_titrationDueAdvance({ ...glp1, current_stage_index: 9 }, T0 + 90 * MS_DAY)).toBeNull();
  });
});
