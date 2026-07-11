// stockResumeService.ts — Reativação do controle de estoque (spec 044, FR-012 / PO-5).
//
// Semântica fechada pelo PO (NC3 da spec):
//   • opt-out SEMPRE congela — zero mutação de saldo/compras (quem grava a preferência e o
//     `stock_paused_at` é o createProfileRepository; aqui só se LÊ o carimbo).
//   • reativação com gap < 30d  → retoma o saldo as-is, silencioso, sem prompt.
//   • reativação com gap >= 30d → o USUÁRIO escolhe (nunca automático):
//       (a) retomar o saldo congelado as-is — a divergência com o consumo real do período é
//           ACEITA e visível; NUNCA se reconcilia retroativamente contra doses do congelamento;
//       (b) começar do zero — ajuste NEGATIVO `legacy_unrecoverable` POR MEDICAMENTO (R-226),
//           append-only: nenhum DELETE, histórico de compras com contagem inalterada.
//
// Gap avaliado LAZY na reativação (sem cron novo — R-090).

import type { createProfileRepository } from '../repositories/createProfileRepository'
import type { createStockRepository } from '../repositories/createStockRepository'
import { parseISO } from '../utils/dateUtils'

/**
 * Limiar (dias) a partir do qual a reativação pede reconciliação ao usuário.
 * Default de UI parametrizável — NÃO é regra de dado (FR-012).
 */
export const STOCK_RESUME_RECONCILE_DAYS = 30

/**
 * Motivo canônico do ajuste que zera o saldo congelado (R-226): lotes zerados por ajuste
 * negativo, compras preservadas. Nunca DELETE.
 */
export const LEGACY_UNRECOVERABLE_REASON = 'legacy_unrecoverable'

const MS_DAY = 24 * 60 * 60 * 1000

/** Avaliação do congelamento no instante da reativação. */
export interface StockResumeAssessment {
  /** Instante do opt-out (ISO) ou null (nunca congelou / já reativado). */
  pausedAt: string | null
  /** Dias inteiros desde o opt-out; null quando não há carimbo válido. */
  gapDays: number | null
  /** true → gap >= STOCK_RESUME_RECONCILE_DAYS: exige escolha do usuário. */
  needsReconciliation: boolean
}

/**
 * Dias inteiros entre o congelamento e agora.
 * Carimbo ausente/inválido/no futuro (clock skew) → null = "sem gap conhecido" → retoma
 * silencioso. Fail-safe deliberado: na dúvida NÃO se pede reconciliação, porque o caminho
 * de reconciliação é o único que pode ZERAR saldo.
 *
 * ⚠️ Instante ABSOLUTO (`Date.now()`), NUNCA `getNow()`: `getNow()` devolve o relógio
 * DESLOCADO para o fuso do usuário, e `stock_paused_at` é um timestamptz absoluto — misturar
 * os dois subtrai o offset do fuso do gap (em GMT-3 o gap encolhe 3h, e um congelamento de
 * 29d0h vira 28d21h → floor 28: verde em runner GMT-3, vermelho em UTC). O gap aqui é uma
 * duração FÍSICA (quanto tempo o estoque ficou congelado), não uma diferença de calendário —
 * é justamente o caso em que a conversão de fuso do R-020 não se aplica.
 *
 * @param pausedAt - carimbo do opt-out (ISO absoluto)
 * @param now - instante de referência (injetável em teste); default = agora, em ms
 */
export function computeStockPauseGapDays(pausedAt: string | null | undefined, now?: Date): number | null {
  if (!pausedAt) return null
  const paused = parseISO(pausedAt)
  const pausedMs = paused.getTime()
  if (Number.isNaN(pausedMs)) return null
  const diff = (now ? now.getTime() : Date.now()) - pausedMs
  if (diff < 0) return null
  return Math.floor(diff / MS_DAY)
}

interface CreateStockResumeServiceDeps {
  profileRepo: ReturnType<typeof createProfileRepository>
  stockRepo: ReturnType<typeof createStockRepository>
}

export interface StockResumeService {
  assessResume(): Promise<StockResumeAssessment>
  resumeAsIs(): Promise<StockResumeAssessment>
  resumeAndZero(): Promise<{ zeroedMedicineIds: string[] }>
}

/**
 * Cria o serviço de reativação de estoque (web e mobile injetam os repos da sua plataforma).
 */
export function createStockResumeService({
  profileRepo,
  stockRepo,
}: CreateStockResumeServiceDeps): StockResumeService {
  if (!profileRepo) throw new Error('createStockResumeService: profileRepo é obrigatório')
  if (!stockRepo) throw new Error('createStockResumeService: stockRepo é obrigatório')

  const service: StockResumeService = {
    /** Só LÊ — não muda preferência nem saldo. Alimenta o sheet de reconciliação (T016). */
    async assessResume(): Promise<StockResumeAssessment> {
      const { stock_paused_at: pausedAt } = await profileRepo.getStockTracking()
      const gapDays = computeStockPauseGapDays(pausedAt ?? null)
      return {
        pausedAt: pausedAt ?? null,
        gapDays,
        needsReconciliation: gapDays !== null && gapDays >= STOCK_RESUME_RECONCILE_DAYS,
      }
    },

    /**
     * Retoma o saldo congelado as-is. Serve os DOIS caminhos "retomar": gap < 30d (silencioso)
     * e gap >= 30d com o usuário escolhendo "retomar o saldo de {data}". Zero mutação de estoque.
     */
    async resumeAsIs(): Promise<StockResumeAssessment> {
      const before = await service.assessResume()
      await profileRepo.setStockTracking(true)
      return before
    },

    /**
     * "Começar do zero": zera o saldo POR MEDICAMENTO via ajuste negativo (R-226) e só então
     * liga a preferência. Ordem importa — se o zeramento falhar no meio, a preferência continua
     * OFF e o sheet reaparece (nunca liga o FIFO sobre um saldo meio-zerado).
     */
    async resumeAndZero(): Promise<{ zeroedMedicineIds: string[] }> {
      const summary = await stockRepo.getStockSummaryMap()
      const zeroedMedicineIds: string[] = []

      for (const [medicineId, quantity] of Object.entries(summary ?? {})) {
        const qty = Number(quantity)
        // `!== 0` (não `> 0`): saldo NEGATIVO acidental também precisa ser zerado — senão o
        // FIFO religaria sobre um saldo negativo. Saldo já em 0 não gera ajuste inútil;
        // valor não-numérico é ignorado (nunca chamar o RPC com NaN).
        if (!Number.isFinite(qty) || qty === 0) continue
        await stockRepo.adjustToBalance(
          medicineId,
          0,
          LEGACY_UNRECOVERABLE_REASON,
          'Saldo congelado descartado na reativação do controle de estoque (spec 044).',
        )
        zeroedMedicineIds.push(medicineId)
      }

      await profileRepo.setStockTracking(true)
      return { zeroedMedicineIds }
    },
  }

  return service
}
