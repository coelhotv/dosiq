// skipdose.test.ts — spec 067 Slice B (T045/T046)
//
// Duas propriedades que este teste segura:
//   1. O skip do bot passa pela RPC canônica com `p_user_id` do BINDING (telegram_chat_id →
//      user_id) — nunca do `callback_data`. Era o IDOR do UPDATE cru anterior, que filtrava só
//      por `protocol_id` vindo do payload, num client `service_role` (RLS bypassada).
//   2. Recusa do banco chega ao paciente com motivo legível (FR-013), nunca "nada aconteceu".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleCallbacks } from '../doseActions.js'
import { getUserIdByChatId } from '../../../services/userService.js'
import { getState, clearState } from '../../state.js'
import { skipDose } from '@dosiq/core'

vi.mock('../../../services/supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve({ data: [], error: null })),
  },
}))

vi.mock('../../../services/userService.js', () => ({ getUserIdByChatId: vi.fn() }))
vi.mock('../../state.js', () => ({
  getState: vi.fn(),
  setState: vi.fn(),
  clearState: vi.fn(),
}))

vi.mock('@dosiq/core', async () => {
  const actual = await vi.importActual<any>('@dosiq/core')
  return {
    ...actual,
    skipDose: vi.fn(),
    // Predicado real é trivial e puro; replicado aqui p/ não depender do build de @dosiq/core.
    isOutOfWindowError: (e: unknown) =>
      String(e instanceof Error ? e.message : e ?? '').includes('Fora da janela da dose'),
    createDoseInstanceRepository: () => ({
      findAnchorInstance: vi.fn(async () => ({ id: 'inst-1' })),
    }),
  }
})

const CHAT_ID = 123
const PROTOCOL_ID = 'proto-1'
const USER_ID = 'user-do-binding'

function makeBot() {
  const handlers: any[] = []
  return {
    handlers,
    on: vi.fn((_evt: string, fn: any) => handlers.push(fn)),
    editMessageText: vi.fn().mockResolvedValue(true),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
  }
}

function confirmSkipQuery() {
  return {
    id: 'cb-1',
    data: `confirm_skip_:${PROTOCOL_ID}`,
    message: { chat: { id: CHAT_ID }, message_id: 9 },
  }
}

async function dispatch(bot: any) {
  handleCallbacks(bot as any)
  for (const fn of bot.handlers) await fn(confirmSkipQuery())
}

beforeEach(() => {
  vi.mocked(getUserIdByChatId).mockResolvedValue(USER_ID as never)
  vi.mocked(getState).mockResolvedValue({
    action: 'skip_confirmation',
    protocolId: PROTOCOL_ID,
    medicineName: 'Losartana',
    timestamp: Date.now(),
  } as never)
  vi.mocked(clearState).mockResolvedValue(undefined as never)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('handleConfirmSkipDose — 067/B', () => {
  it('pula pela RPC com o user_id do BINDING, não do callback_data (FR-028)', async () => {
    vi.mocked(skipDose).mockResolvedValue({ skipped: 1, skippedAt: 'x' } as never)
    const bot = makeBot()
    await dispatch(bot)

    expect(getUserIdByChatId).toHaveBeenCalledWith(CHAT_ID)
    const [, params] = vi.mocked(skipDose).mock.calls[0] as any[]
    expect(params.userId).toBe(USER_ID)
    expect(params.instanceIds).toEqual(['inst-1'])
    expect(typeof params.skippedAt).toBe('string')
  })

  it('recusa por janela vira mensagem legível, sem SQLSTATE nem stack (FR-013/S-8)', async () => {
    vi.mocked(skipDose).mockRejectedValue(
      new Error('Fora da janela da dose (horário previsto: 2026-08-18T16:30:00Z)') as never,
    )
    const bot = makeBot()
    await dispatch(bot)

    const [, opts] = bot.answerCallbackQuery.mock.calls.at(-1) as any[]
    expect(opts.text).toMatch(/fora da janela de registro/i)
    expect(opts.text).not.toMatch(/P0001|plpgsql|skip_dose_atomic/)
    // Não confirma o skip: a mensagem de sucesso não é editada.
    expect(bot.editMessageText).not.toHaveBeenCalled()
  })

  it('recusa por estado (já registrada) tem mensagem própria', async () => {
    vi.mocked(skipDose).mockRejectedValue(
      new Error('Dose indisponível para pular (já registrada, inexistente ou de outro usuário)') as never,
    )
    const bot = makeBot()
    await dispatch(bot)

    const [, opts] = bot.answerCallbackQuery.mock.calls.at(-1) as any[]
    expect(opts.text).toMatch(/já foi registrada ou pulada/i)
  })
})
