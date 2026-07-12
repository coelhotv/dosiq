// stockCommandsDoseOnly.test.ts — spec 044 T012
//
// Comando de estoque para usuário em modo dose-only responde CONVITE DE ATIVAÇÃO —
// nunca dados vazios / "estoque 0" (afirmação falsa sobre um dado que ele optou por não ter).
// Guard: usuário com tracking ON continua vendo o estoque normalmente.
// Fail-safe (AP-277): coluna NULL/erro de leitura → tratado como ON.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDataQueue: any[] = [];

const { mockSupabase } = vi.hoisted(() => {
  const m: any = {
    _tables: [] as string[],
    from: vi.fn(function (this: any, table: string) { m._tables.push(table); return this; }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve(mockDataQueue.shift() || { data: null, error: null })),
    then: vi.fn((onFulfilled: any) =>
      Promise.resolve(mockDataQueue.shift() || { data: [], error: null }).then(onFulfilled)),
  };
  return { mockSupabase: m };
});

vi.mock('../../services/supabase.js', () => ({ supabase: mockSupabase }));
vi.mock('../../services/userService.js', () => ({
  getUserIdByChatId: vi.fn(async () => 'user-1'),
}));

const { handleEstoque } = await import('../commands/estoque.js');
const { STOCK_DISABLED_INVITE } = await import('../services/stockTrackingGuard.js');

const CHAT_ID = 999;
const msg = { chat: { id: CHAT_ID } };

function makeBot() {
  // Assinatura explícita: sem ela `mock.calls` vira tupla vazia e o índice [1] (o texto)
  // não existe no tipo.
  return {
    sendMessage: vi.fn(async (_chatId: number, _text: string, _opts?: unknown) => ({})),
  };
}

/** Medicamento com protocolo ativo e saldo — o caminho "tem estoque para mostrar". */
const medicineWithStock = {
  id: 'med-1',
  name: 'Entresto',
  dosage_unit: 'cp',
  stock: [{ quantity: 20 }],
  protocols: [{ active: true, time_schedule: ['08:00'], dosage_per_intake: 1, frequency: 'diario', medicine_id: 'med-1' }],
};

beforeEach(() => {
  mockDataQueue.length = 0;
  mockSupabase._tables.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('/estoque em modo dose-only (T012)', () => {
  it('responde convite de ativação quando o controle de estoque está OFF', async () => {
    const bot = makeBot();
    mockDataQueue.push({ data: { stock_tracking_enabled: false }, error: null });

    await handleEstoque(bot, msg);

    expect(bot.sendMessage).toHaveBeenCalledTimes(1);
    expect(bot.sendMessage).toHaveBeenCalledWith(CHAT_ID, STOCK_DISABLED_INVITE);
    // Nunca afirma saldo: a mensagem não fala em "0", nem imprime a tabela de estoque.
    const [, text] = bot.sendMessage.mock.calls[0];
    expect(text).not.toMatch(/Estoque de Medicamentos/);
    expect(text).not.toMatch(/\b0\b/);
    // E não chegou a consultar medicamentos (curto-circuito antes do fetch).
    expect(mockSupabase._tables).toEqual(['user_settings']);
  });

  it('mostra o estoque normalmente quando o controle está ON (guard de não-regressão)', async () => {
    const bot = makeBot();
    mockDataQueue.push({ data: { stock_tracking_enabled: true }, error: null });
    mockDataQueue.push({ data: [medicineWithStock], error: null });

    await handleEstoque(bot, msg);

    const [, text] = bot.sendMessage.mock.calls[0];
    expect(text).toMatch(/Estoque de Medicamentos/);
    expect(text).not.toContain(STOCK_DISABLED_INVITE);
  });

  it('trata preferência ausente (linha sem a coluna) como ON — fail-safe AP-277', async () => {
    const bot = makeBot();
    mockDataQueue.push({ data: null, error: null });
    mockDataQueue.push({ data: [medicineWithStock], error: null });

    await handleEstoque(bot, msg);

    const [, text] = bot.sendMessage.mock.calls[0];
    expect(text).toMatch(/Estoque de Medicamentos/);
  });

  it('trata erro de leitura da preferência como ON — nunca desliga o estoque por omissão', async () => {
    const bot = makeBot();
    mockDataQueue.push({ data: null, error: { message: 'boom' } });
    mockDataQueue.push({ data: [medicineWithStock], error: null });

    await handleEstoque(bot, msg);

    const [, text] = bot.sendMessage.mock.calls[0];
    expect(text).toMatch(/Estoque de Medicamentos/);
  });
});
