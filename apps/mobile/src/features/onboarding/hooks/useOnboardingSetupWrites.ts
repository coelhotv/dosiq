// useOnboardingSetupWrites — as escritas do setup do onboarding (spec 096 B3, T040a).
//
// Movidas do passo de estoque SEM reescrever a lógica: remédio → tratamento → preferência de estoque.
// O que mudou é QUANDO rodam: só no S1 (`OnboardingConsentStep`), depois do consentimento A — antes
// dele nada é gravado (guarda 6 do brief, PO-UX-2).
//
// Chamado no `OnboardingNavigator`, não na tela: os guardas de idempotência (`createdMedicineId`,
// `protocolCreated`, escrita em voo) precisam sobreviver ao S1 desmontar (voltar ao S4 e confirmar de
// novo), senão o retry criaria um 2º remédio/tratamento (classe do AP-283).

import { useCallback, useRef } from 'react'
import { chooseStockModeInOnboarding } from '@profile/services/stockPreferenceService'
import { protocolService } from '@treatments/services/protocolService'
import { medicineService } from '@medications/services/medicineService'
import { SURFACES, ENTRY_POINTS } from '@platform/analytics/analyticsEvents'
import { withTimeout } from '@shared/utils/withTimeout'

// 066 E (C-4, smoke 2026-10-18): cada escrita tem prazo; estourado, a pessoa vê o motivo e tenta de novo.
export const WRITE_TIMEOUT_MS = 20_000
const TIMEOUT_MESSAGE = 'A conexão está demorando. Verifique a internet e toque em Salvar de novo.'

export function timed<T>(promise: Promise<T>): Promise<T> {
  return withTimeout(promise, WRITE_TIMEOUT_MS, TIMEOUT_MESSAGE)
}

// Reaproveita a escrita ainda em voo: o prazo não cancela a requisição, e ela pode gravar depois.
// Falhou de verdade ⇒ esquece, e a próxima tentativa começa outra.
function inFlight<T>(ref: { current: Promise<T> | null }, start: () => Promise<T>): Promise<T> {
  if (!ref.current) {
    const pending = start()
    ref.current = pending
    pending.catch(() => {
      if (ref.current === pending) ref.current = null
    })
  }
  return ref.current
}

export interface SetupWritesInput {
  medicine: Record<string, unknown> | null
  medicineSource: string | null
  treatment: (Record<string, unknown> & { _remind?: boolean }) | null
  stockTracking: boolean
}

export function useOnboardingSetupWrites() {
  const createdMedicineId = useRef<string | null>(null)
  const protocolCreated = useRef(false)
  const createdProtocolId = useRef<string | null>(null)
  // O que já foi gravado (referência do objeto do contexto). Voltar e editar depois de uma falha
  // parcial troca o objeto: aí o registro existente é ATUALIZADO, em vez de pulado (RC6 #900) ou
  // duplicado (comportamento antigo, estado local do passo de estoque).
  const writtenMedicine = useRef<Record<string, unknown> | null>(null)
  const writtenTreatment = useRef<Record<string, unknown> | null>(null)
  const pendingMedicine = useRef<Promise<any> | null>(null)
  const pendingProtocol = useRef<Promise<any> | null>(null)

  const writeSetup = useCallback(async ({ medicine, medicineSource, treatment, stockTracking }: SetupWritesInput) => {
    if (!medicine || !treatment) {
      throw new Error('Dados do onboarding não encontrados. Volte e revise os passos.')
    }

    let medicineId = createdMedicineId.current
    if (!medicineId) {
      // 066 E: `source` diz se o 1º remédio veio da caixa, da busca ou digitado (TRACKING_PLAN §5.3).
      const createdMedicine = await timed(
        inFlight(pendingMedicine, () =>
          medicineService.create(medicine, { surface: SURFACES.MOBILE, source: medicineSource }),
        ),
      )
      medicineId = createdMedicine.id
      createdMedicineId.current = medicineId
      writtenMedicine.current = medicine
    } else if (writtenMedicine.current !== medicine) {
      await timed(medicineService.update(medicineId, medicine, { surface: SURFACES.MOBILE }))
      writtenMedicine.current = medicine
    }

    const { _remind, ...protocolData } = treatment
    if (!protocolCreated.current) {
      const createdProtocol = await timed(
        inFlight(pendingProtocol, () =>
          protocolService.create(
            { ...protocolData, medicine_id: medicineId },
            { surface: SURFACES.MOBILE, entryPoint: ENTRY_POINTS.ONBOARDING },
          ),
        ),
      )
      protocolCreated.current = true
      createdProtocolId.current = createdProtocol?.id ?? null
      writtenTreatment.current = treatment
    } else if (writtenTreatment.current !== treatment && createdProtocolId.current) {
      await timed(protocolService.update(createdProtocolId.current, protocolData, { surface: SURFACES.MOBILE }))
      writtenTreatment.current = treatment
    }

    await timed(chooseStockModeInOnboarding(stockTracking))
    return { remind: Boolean(_remind) }
  }, [])

  return { writeSetup }
}
