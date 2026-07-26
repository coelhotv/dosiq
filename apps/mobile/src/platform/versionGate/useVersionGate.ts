// useVersionGate.ts — hook do kill switch de versão mínima (spec 051-A / CON-033)
//
// O app renderiza NORMAL e esta checagem corre em paralelo — nunca segura a árvore esperando rede
// (sem splash bloqueante). O guard OBEDECE o resolver puro do core; não reintroduz condição própria
// sobre bloquear/abrir (antídoto do AP-303).

import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import Constants from 'expo-constants'
import { resolveVersionGate, type VersionGateDecision, type VersionGatePlatform } from '@dosiq/core'
import { fetchVersionGateRow } from './versionGateService'

// Sem fallback hardcoded (ao contrário de useNudges.ts:11) — versão ausente/malformada é
// indeterminação, o resolver decide ABRE. Um default desatualizado transformaria isso em bloqueio
// falso.
const APP_VERSION = Constants.expoConfig?.version
const CURRENT_PLATFORM: VersionGatePlatform = Platform.OS === 'android' ? 'android' : 'ios'

const OPEN: VersionGateDecision = { blocked: false }

export function useVersionGate(): VersionGateDecision {
  const [decision, setDecision] = useState<VersionGateDecision>(OPEN)

  useEffect(() => {
    let active = true

    async function check() {
      const gateRow = await fetchVersionGateRow(CURRENT_PLATFORM)
      if (!active) return
      setDecision(resolveVersionGate(APP_VERSION, gateRow))
    }

    check()

    // Reavalia no foreground, não só no mount. Boa parte da base deixa o app minimizado por
    // dias/semanas — um gate ativado NESSE meio-tempo (a base já rodando com o app aberto/em
    // background) só seria visto por quem reabrisse o processo do zero. Mesmo padrão do
    // ConsentGateProvider (Navigation.tsx — AppState 'active' → refresh()).
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check()
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return decision
}
