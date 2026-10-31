// TreatmentMeasureSlot.tsx — qual card de medida o detalhe do tratamento mostra (spec 100 B · FR-006/FR-009).
//
// Obedece a medida efetiva — a MESMA regra do pedido pós-dose (`measureOfItem`). 'nenhum' e chave ausente
// (falha fechada, RC3 E-1) ⇒ sem card. O detalhe lê `*` (protocolService), então a chave sempre chega.

import TreatmentWeightCard from '@treatments/components/TreatmentWeightCard'
import TreatmentMeasureCard from '@treatments/components/TreatmentMeasureCard'
import { measureOfItem } from '@dose/services/measurePrompt'

export default function TreatmentMeasureSlot({ protocol }: { protocol: any }) {
  const measure = measureOfItem({ protocol })
  if (measure === 'peso') return <TreatmentWeightCard protocol={protocol} />
  if (measure === 'glicemia' || measure === 'pressao_arterial') return <TreatmentMeasureCard key={measure} measure={measure} />
  return null
}
