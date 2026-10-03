// 094 PO-3 (parte servidor) — o gerador de doses do cron NUNCA renova janela de tratamento
// arquivado. Mecanismo: excluir ⇒ `active=false` (CHECK `protocols_archived_inactive_check`,
// INV-6) e o gerador só lê `active=true`. Este teste prova o lado do código (filtro no select);
// o lado do banco (CHECK + remoção das futuras) está em
// `docs/migrations/20261002_archive_on_delete.test.sql` (casos 3 e 10). Os lembretes saem de
// `dose_instances` (reminderFromInstances), cujas futuras o arquivamento remove.

import { describe, it, expect, vi, afterEach } from 'vitest';

const calls: Array<[string, unknown[]]> = [];
const renew = vi.fn(async (..._args: unknown[]) => 0);

vi.mock('../../services/supabase.js', () => {
  const builder: any = {};
  for (const m of ['select', 'eq', 'or']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  builder.range = (...args: unknown[]) => {
    calls.push(['range', args]);
    return Promise.resolve({ data: [], error: null });
  };
  return { supabase: { from: () => builder } };
});

vi.mock('@dosiq/core', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@dosiq/core')),
  createDoseInstanceRepository: vi.fn(() => ({})),
  renewProtocolWindow: (...args: unknown[]) => renew(...args),
  resolveUserTzMap: vi.fn(async () => new Map()),
}));

import { generateDoseInstances } from '../doseInstanceScheduler.js';

describe('generateDoseInstances — 094 arquivado não gera doses', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    calls.length = 0;
  });

  it('lê só protocolos active=true (arquivado ⇒ inativo pelo CHECK)', async () => {
    await generateDoseInstances();
    expect(calls).toContainEqual(['eq', ['active', true]]);
    expect(renew).not.toHaveBeenCalled();
  });
});
