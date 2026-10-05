// Identificador de instalação (spec 095 / ADR-108, FR-003/FR-011).
//
// Aleatório (UUID v4 em JS), gerado uma vez e guardado no AsyncStorage. Distingue dois apps dosiq no
// mesmo aparelho e sobrevive à atualização do sistema — o fingerprint {os, osVersion, modelo} não faz
// nenhuma das duas coisas. NÃO é segredo: a autorização no servidor é `auth.uid()`.
//
// Gira por sessão (RC-SEC S-4): a chave fica FORA da allowlist do wipe da 091, então o logout a
// apaga e a próxima conta recebe outro id — o servidor nunca liga duas contas pelo mesmo aparelho.
// Por isso também não há cache em memória depois de resolver: ele sobreviveria ao wipe.
//
// Nunca vai para analytics, log ou Sentry (S-7): só para as RPCs de atividade e de registro de push.

import AsyncStorage from '@react-native-async-storage/async-storage'

export const INSTALL_ID_KEY = '@dosiq/install-id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

async function readOrCreate(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(INSTALL_ID_KEY)
    if (stored && UUID_V4.test(stored)) return stored
    const id = uuidV4()
    await AsyncStorage.setItem(INSTALL_ID_KEY, id)
    return id
  } catch {
    // Best-effort (C1.5 K-2): sem storage, a RPC segue pelo caminho legado (sem id).
    return null
  }
}

// Heartbeat e registro de push disparam juntos no login: sem dedupe da promessa em voo, cada um
// gera um id diferente.
let pending: Promise<string | null> | null = null

export function getInstallId(): Promise<string | null> {
  if (pending) return pending
  pending = readOrCreate().finally(() => {
    pending = null
  })
  return pending
}
