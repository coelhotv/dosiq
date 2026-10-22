// ObservabilitySection.tsx — dispara um erro de teste no Sentry (spec 096 B3, smoke PO-SEC-4).
// Serve para conferir o scrub (`sentryScrub`): o evento chega sem query string, `eq.`/`ilike.`,
// e-mail, apikey nem breadcrumb de console, e com `user` reduzido ao id.

import { Alert } from 'react-native'
import * as Sentry from '@sentry/react-native'
import { DevSection, DevButton } from '@features/_dev/components/DevSection'

export function ObservabilitySection() {
  const fire = () => {
    const id = Sentry.captureException(new Error('[dev] erro de teste do scrub (096 B3)'))
    Alert.alert('Dev — Sentry', `Evento enviado: ${id}`)
  }

  return (
    <DevSection title="Observabilidade" note="Abra antes uma tela com dados (ex.: lista de remédios).">
      <DevButton label="🧪 Enviar erro de teste ao Sentry" onPress={fire} />
    </DevSection>
  )
}
