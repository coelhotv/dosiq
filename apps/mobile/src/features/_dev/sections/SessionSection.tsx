// SessionSection.tsx — Sessão: chaves do AsyncStorage deste aparelho (spec 091).
// ✓ = chave do aparelho (sobrevive à saída da conta); ✗ = apagada no logout. Só NOMES de chave,
// nunca valores. O console do Hermes roda no escopo global (sem `require`), então o dump mora aqui.

import { useState } from 'react'
import { Alert, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { isDeviceKey } from '@platform/session/localDataWipe'
import { DevSection, DevButton, DevNote } from '@features/_dev/components/DevSection'

export function SessionSection() {
  const [dump, setDump] = useState<string | null>(null)

  const listKeys = () => {
    AsyncStorage.getAllKeys()
      .then((keys) => {
        const lines = [...keys].sort().map((k) => `${isDeviceKey(k) ? '✓' : '✗'} ${k}`)
        const text = `${Platform.OS} · ${lines.length} chaves\n${lines.join('\n')}`
        console.info(`[dev-session]\n${text}`)
        setDump(text)
      })
      .catch((err: unknown) =>
        Alert.alert('Dev — Sessão', err instanceof Error ? err.message : 'Falhou.'),
      )
  }

  return (
    <DevSection title="Sessão" note="Spec 091 · ✓ sobrevive à saída da conta · ✗ apagada.">
      <DevButton label="🗝️ Listar chaves do AsyncStorage" onPress={listKeys} />
      {dump ? <DevNote>{dump}</DevNote> : null}
    </DevSection>
  )
}
