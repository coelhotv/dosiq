// stockResumeService.test.ts — spec 044 T004 (PO-5)
//
// Os 3 caminhos da reativação:
//   (a) gap < 30d  → retoma as-is, silencioso (sem prompt, sem mutação de estoque)
//   (b) gap >= 30d → usuário escolhe RETOMAR → saldo as-is (nada é zerado)
//   (c) gap >= 30d → usuário escolhe ZERAR → adjustment negativo POR MEDICAMENTO,
//                    append-only (nenhuma compra/lote deletado)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  STOCK_RESUME_RECONCILE_DAYS,
  LEGACY_UNRECOVERABLE_REASON,
  computeStockPauseGapDays,
  createStockResumeService,
} from '../stockResumeService'

const NOW = new Date('2026-07-11T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

function makeDeps({ pausedAt, summary }: { pausedAt: string | null; summary?: Record<string, number> }) {
  const profileRepo = {
    getStockTracking: vi.fn(async () => ({ stock_tracking_enabled: false, stock_paused_at: pausedAt })),
    setStockTracking: vi.fn(async (enabled: boolean) => ({
      stock_tracking_enabled: enabled,
      stock_paused_at: enabled ? null : pausedAt,
    })),
  }
  const stockRepo = {
    getStockSummaryMap: vi.fn(async () => summary ?? {}),
    adjustToBalance: vi.fn(async () => ({ delta: 0, before: 0, after: 0 })),
    delete: vi.fn(),
  }
  return { profileRepo: profileRepo as any, stockRepo: stockRepo as any, _profileRepo: profileRepo, _stockRepo: stockRepo }
}

describe('computeStockPauseGapDays', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('sem carimbo → null (sem gap conhecido)', () => {
    expect(computeStockPauseGapDays(null, NOW)).toBeNull()
    expect(computeStockPauseGapDays(undefined, NOW)).toBeNull()
  })

  it('carimbo inválido → null (nunca derruba a reativação)', () => {
    expect(computeStockPauseGapDays('não é data', NOW)).toBeNull()
  })

  it('carimbo no futuro (clock skew) → null, nunca gap negativo', () => {
    expect(computeStockPauseGapDays(daysAgo(-5), NOW)).toBeNull()
  })

  it('conta dias inteiros desde o congelamento', () => {
    expect(computeStockPauseGapDays(daysAgo(0), NOW)).toBe(0)
    expect(computeStockPauseGapDays(daysAgo(29), NOW)).toBe(29)
    expect(computeStockPauseGapDays(daysAgo(30), NOW)).toBe(30)
  })
})

describe('createStockResumeService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('exige os repos', () => {
    expect(() => createStockResumeService({ profileRepo: null } as any)).toThrow(/profileRepo/)
    expect(() => createStockResumeService({ profileRepo: {}, stockRepo: null } as any)).toThrow(/stockRepo/)
  })

  // ── (a) gap < 30d ───────────────────────────────────────────────────────────
  it('(a) gap < 30d: retoma as-is, silencioso — sem reconciliação e sem tocar estoque', async () => {
    const deps = makeDeps({ pausedAt: daysAgo(29), summary: { 'med-1': 12 } })
    const service = createStockResumeService(deps)

    const assessment = await service.assessResume()
    expect(assessment.gapDays).toBe(29)
    expect(assessment.needsReconciliation).toBe(false)

    await service.resumeAsIs()
    expect(deps._profileRepo.setStockTracking).toHaveBeenCalledWith(true)
    expect(deps._stockRepo.adjustToBalance).not.toHaveBeenCalled()
  })

  it('(a) sem carimbo de pausa → retoma silencioso (fail-safe: nunca oferece zerar por engano)', async () => {
    const deps = makeDeps({ pausedAt: null, summary: { 'med-1': 3 } })
    const assessment = await createStockResumeService(deps).assessResume()
    expect(assessment.gapDays).toBeNull()
    expect(assessment.needsReconciliation).toBe(false)
  })

  // ── (b) gap >= 30d, escolhe RETOMAR ─────────────────────────────────────────
  it('(b) gap >= 30d: pede reconciliação; "retomar" mantém o saldo congelado as-is', async () => {
    const deps = makeDeps({ pausedAt: daysAgo(45), summary: { 'med-1': 12, 'med-2': 4 } })
    const service = createStockResumeService(deps)

    const assessment = await service.assessResume()
    expect(assessment.gapDays).toBe(45)
    expect(assessment.needsReconciliation).toBe(true)

    await service.resumeAsIs()
    // Nenhuma reconciliação retroativa: o saldo volta como estava (divergência é aceita).
    expect(deps._stockRepo.adjustToBalance).not.toHaveBeenCalled()
    expect(deps._profileRepo.setStockTracking).toHaveBeenCalledWith(true)
  })

  it('gap exatamente no limiar (30d) já exige reconciliação', async () => {
    const deps = makeDeps({ pausedAt: daysAgo(STOCK_RESUME_RECONCILE_DAYS) })
    const { needsReconciliation } = await createStockResumeService(deps).assessResume()
    expect(needsReconciliation).toBe(true)
  })

  // ── (c) gap >= 30d, escolhe ZERAR ───────────────────────────────────────────
  it('(c) "começar do zero": ajuste legacy_unrecoverable POR MEDICAMENTO, append-only', async () => {
    const deps = makeDeps({ pausedAt: daysAgo(60), summary: { 'med-1': 12, 'med-2': 4, 'med-3': 0 } })
    const service = createStockResumeService(deps)

    const { zeroedMedicineIds } = await service.resumeAndZero()

    // Só medicamentos com saldo > 0 (med-3 zerado não gera ajuste inútil).
    expect(zeroedMedicineIds).toEqual(['med-1', 'med-2'])
    expect(deps._stockRepo.adjustToBalance).toHaveBeenCalledTimes(2)
    expect(deps._stockRepo.adjustToBalance).toHaveBeenCalledWith(
      'med-1', 0, LEGACY_UNRECOVERABLE_REASON, expect.any(String)
    )
    // Append-only (R-226): nenhum DELETE de lote/compra em nenhum caminho.
    expect(deps._stockRepo.delete).not.toHaveBeenCalled()
    expect(deps._profileRepo.setStockTracking).toHaveBeenCalledWith(true)
  })

  it('(c) zerar falhou → preferência continua OFF (nunca liga FIFO sobre saldo meio-zerado)', async () => {
    const deps = makeDeps({ pausedAt: daysAgo(60), summary: { 'med-1': 12 } })
    deps._stockRepo.adjustToBalance.mockRejectedValueOnce(new Error('rpc caiu'))

    await expect(createStockResumeService(deps).resumeAndZero()).rejects.toThrow('rpc caiu')
    expect(deps._profileRepo.setStockTracking).not.toHaveBeenCalled()
  })
})
