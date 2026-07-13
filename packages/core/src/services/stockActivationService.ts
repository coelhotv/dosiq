// stockActivationService.ts — Ativação do controle de estoque a partir do saldo inicial
// (spec 044, FR-007 / PO-3). É o caminho de VOLTA do dose-only: o usuário informa quanto tem
// HOJE de cada medicamento e o FIFO passa a valer DAQUI PRA FRENTE.
//
// REGRA DE DADO (PO-3) — sem retro-consumo:
//   O saldo informado é um AJUSTE APPEND-ONLY no presente (`adjustToBalance`, R-226). As doses
//   já registradas NÃO são reprocessadas: nenhum log e nenhuma dose_instance é lido, escrito ou
//   apagado por este serviço. "Contagem de logs antes == depois" é o guard do teste.
//   O que liga o consumo é a PREFERÊNCIA (as 3 RPCs atômicas a leem dentro da transação, F1):
//   dose registrada depois da ativação decrementa; dose de ontem fica exatamente como está.
//
// SKIP POR ITEM: medicamento sem quantidade informada não vira ajuste nenhum — fica sem saldo
// (e, portanto, sem alerta de reposição) até a primeira compra. Ausência de escrita É o skip;
// não existe "skip" persistido em lugar nenhum.
//
// ORDEM (mesma invariante do stockResumeService): saldos PRIMEIRO, preferência DEPOIS. Falha no
// meio deixa o controle OFF — nunca se liga o FIFO sobre um saldo parcialmente informado.

import type { createProfileRepository } from '../repositories/createProfileRepository'
import type { createStockRepository } from '../repositories/createStockRepository'

/**
 * Motivo canônico do ajuste que estabelece o saldo inicial na ativação.
 * Distingue, no histórico de ajustes, uma contagem de opt-in de um acerto de saldo comum.
 */
export const INITIAL_BALANCE_REASON = 'Saldo inicial (ativação do controle de estoque)'

/** Saldo informado para UM medicamento. Item sem entrada na lista = pulado. */
export interface InitialBalanceEntry {
  medicineId: string
  /** Quantidade atual em unidades (comprimidos/ml). Finita e >= 0. */
  quantity: number
}

export interface StockActivationResult {
  /** Medicamentos que receberam ajuste de saldo. */
  countedMedicineIds: string[]
  /** Total de itens da lista que foram descartados por quantidade inválida/ausente. */
  skipped: number
}

interface CreateStockActivationServiceDeps {
  profileRepo: ReturnType<typeof createProfileRepository>
  stockRepo: ReturnType<typeof createStockRepository>
}

export interface StockActivationService {
  activateWithInitialBalance(entries: InitialBalanceEntry[]): Promise<StockActivationResult>
}

export function createStockActivationService({
  profileRepo,
  stockRepo,
}: CreateStockActivationServiceDeps): StockActivationService {
  if (!profileRepo) throw new Error('createStockActivationService: profileRepo é obrigatório')
  if (!stockRepo) throw new Error('createStockActivationService: stockRepo é obrigatório')

  return {
    async activateWithInitialBalance(entries: InitialBalanceEntry[]): Promise<StockActivationResult> {
      const list = Array.isArray(entries) ? entries : []
      const countedMedicineIds: string[] = []
      let skipped = 0

      for (const entry of list) {
        const quantity = Number(entry?.quantity)
        // Pulado é AUSÊNCIA de escrita. Quantidade não-numérica, negativa ou item sem id cai
        // aqui em vez de virar RPC com NaN — o mesmo cuidado do resumeAndZero.
        if (!entry?.medicineId || !Number.isFinite(quantity) || quantity < 0) {
          skipped += 1
          continue
        }

        // adjustToBalance calcula o delta contra o saldo atual e escreve um ajuste append-only.
        // Para quem nasceu dose-only o saldo atual é 0 → delta = quantidade informada.
        // Para quem tinha estoque congelado, o valor informado PREVALECE (é a contagem física
        // que o usuário acabou de fazer).
        await stockRepo.adjustToBalance(entry.medicineId, quantity, INITIAL_BALANCE_REASON)
        countedMedicineIds.push(entry.medicineId)
      }

      // Só agora o FIFO passa a valer — e só para as doses seguintes.
      await profileRepo.setStockTracking(true)

      return { countedMedicineIds, skipped }
    },
  }
}
