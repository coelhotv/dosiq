// resolveSupplyTarget — destino do toque nos avisos de compra (spec 105, FR-019 · PO-105-7).
//
//   monthly_dose / monthly_purchase → detalhe do tratamento de origem
//   step_switch + estoque ligado + escada com troca → estoque do medicamento da PRÓXIMA etapa
//   step_switch nos demais casos (estoque desligado, escada já trocou, leitura falhou) → detalhe do tratamento
//   tratamento inexistente / de outra conta / sem rede para conferir → Hoje (nunca tela quebrada)
//
// O medicamento da próxima etapa sai do `protocolId` + etapas do usuário, pela MESMA regra do core que
// o servidor usou para enviar (`nextStepSwitchMedicineId`, INV-1) — nunca de um id de remédio no push.
// I/O injetada (`deps`) para o teste exercitar a decisão sem mockar o Supabase.

import { nextStepSwitchMedicineId } from '@dosiq/core'
import type { RunwayStep } from '@dosiq/core'
import type { SupplyTarget } from '@navigation/navigateToDose'

export type SupplyDestination =
  | { kind: 'treatment'; protocolId: string }
  | { kind: 'stock'; medicineId: string; medicineName: string }
  | { kind: 'today' }

export interface SupplyTargetDeps {
  getProtocolOrigin: (protocolId: string) => Promise<{ id: string; medicine_id: string } | null>
  getSteps: () => Promise<RunwayStep[]>
  getMedicineName: (medicineId: string) => Promise<string | null>
  /** Preferência de estoque (cache local; sem cache ⇒ true, degrau 3 do AP-277). */
  isStockTrackingEnabled: () => Promise<boolean>
}

export async function resolveSupplyTarget(target: SupplyTarget, deps: SupplyTargetDeps): Promise<SupplyDestination> {
  let origin: { id: string; medicine_id: string } | null
  try {
    origin = await deps.getProtocolOrigin(target.protocolId)
  } catch {
    return { kind: 'today' }
  }
  if (!origin) return { kind: 'today' }

  const treatment: SupplyDestination = { kind: 'treatment', protocolId: origin.id }
  if (target.supply !== 'step_switch') return treatment

  try {
    if (!(await deps.isStockTrackingEnabled())) return treatment
    const nextMedicineId = nextStepSwitchMedicineId(origin, await deps.getSteps())
    if (!nextMedicineId) return treatment
    const name = await deps.getMedicineName(nextMedicineId).catch(() => null)
    return { kind: 'stock', medicineId: nextMedicineId, medicineName: name ?? '' }
  } catch {
    return treatment
  }
}
