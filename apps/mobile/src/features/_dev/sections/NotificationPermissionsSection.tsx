// NotificationPermissionsSection.tsx — lê as permissões de notificação no device (054 T015b: o PO
// manteve só a leitura do spike). Só leitura: não pede permissão nem agenda nada.

import { useState } from 'react'
import { DevSection, DevButton, DevNote } from '@features/_dev/components/DevSection'
import { readNotificationPermissions } from '@features/_dev/devNotificationPermissions'

export function NotificationPermissionsSection() {
  const [out, setOut] = useState<string | null>(null)

  return (
    <DevSection title="Permissões de notificação" note="Só leitura: SO, push efetivo, canais e faixa do alarme crítico.">
      <DevButton label="🔎 Ler permissões agora" onPress={() => readNotificationPermissions().then(setOut)} />
      {out ? <DevNote>{out}</DevNote> : null}
    </DevSection>
  )
}
