// TreatmentSection.tsx — Tratamento: estados da evolução por etapas (spec 029 F5).
// Grava na escada REAL da conta logada. Falhas carregam motivo útil (ex.: "escada same-med não
// produz CTA") → Alert, nunca promise solta (o botão pareceria inerte).

import { Alert } from 'react-native'
import { DevSection, DevButton } from '@features/_dev/components/DevSection'
import { devArmPendingSwitch, devResetLadder, devPushLocalSwitch } from '@features/_dev/devTitrationTriggers'

function run(fn: () => Promise<unknown>, okMsg: string) {
  fn()
    .then(() => Alert.alert('Dev — Tratamento', `${okMsg}.\n\nReabra a aba Hoje para ver.`))
    .catch((err: unknown) =>
      Alert.alert('Dev — Tratamento', err instanceof Error ? err.message : 'Falhou.'),
    )
}

export function TreatmentSection() {
  return (
    <DevSection title="Tratamento" note="Spec 029 F5 · exige escada de titulação ativa na conta.">
      <DevButton
        writesData
        label="📊 Troca vence HOJE — card [Iniciar etapa] [Ainda não]"
        onPress={() => run(() => devArmPendingSwitch(0), 'Troca pendente HOJE (dia 0)')}
      />
      <DevButton
        writesData
        label="📊 Pendente há 3 dias — linha neutra + contexto"
        onPress={() => run(() => devArmPendingSwitch(3), 'Pendente há 3 dias')}
      />
      <DevButton
        writesData
        label="📊 Vencida há 12 dias — banner âmbar + [Ajustar duração]"
        onPress={() => run(() => devArmPendingSwitch(12), 'Vencida há 12 dias')}
      />
      <DevButton
        writesData
        label="🔔 Notificação local com as 2 ações (categoria + handler + RPC)"
        onPress={() => run(devPushLocalSwitch, 'Notificação local disparada')}
      />
      <DevButton
        writesData
        label="↩️ Resetar escada (vigente começa hoje)"
        onPress={() => run(devResetLadder, 'Escada restaurada')}
      />
    </DevSection>
  )
}
