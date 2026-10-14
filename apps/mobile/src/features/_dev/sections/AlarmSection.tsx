// AlarmSection.tsx — Alarmes: apresentação do alarme nativo de dose (spec 001).
// Id sentinela: Tomei/Pular falham no registro de propósito (foco = notificação, botões, som,
// full-screen). Não grava nada.

import { DevSection, DevButton } from '@features/_dev/components/DevSection'
import { devFireAlarmNow, devScheduleAlarmIn, devClearAlarms } from '@features/_dev/devAlarmTriggers'

export function AlarmSection() {
  return (
    <DevSection
      title="Alarmes"
      note="Spec 001 · id sentinela — Tomei/Pular falham de propósito; foco é a apresentação."
    >
      <DevButton label="⚡ Disparar alarme AGORA (notif + botões + som)" onPress={() => devFireAlarmNow()} />
      <DevButton label="⏱️ Agendar +10s (path real: lock → full-screen)" onPress={() => devScheduleAlarmIn(10)} />
      <DevButton label="🧹 Limpar alarme de teste" onPress={() => devClearAlarms()} />
    </DevSection>
  )
}
