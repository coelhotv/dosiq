// secureStoreAuthStorage.js — persistência de auth/sessão (dados sensíveis)
// ADR-028: expo-secure-store para tokens de auth
// R4-003: NUNCA usar AsyncStorage para sessão/token de auth
// Implementa a interface AuthStorage compatível com @supabase/supabase-js
//
// NOTA: SecureStore tem limite de 2048 bytes por chave (Expo SDK 53).
// Tokens Supabase excedem esse limite — chunked storage obrigatório.

import * as SecureStore from 'expo-secure-store'

const CHUNK_SIZE = 1800 // margem segura abaixo dos 2048 bytes

// Acessibilidade do Keychain (iOS). Default é WHEN_UNLOCKED → ilegível com a tela
// bloqueada, quebrando handlers em background (ex.: ações do alarme nativo via
// Apple Watch / lock screen → "User interaction is not allowed"). AFTER_FIRST_UNLOCK
// libera leitura em background após o 1º unlock pós-reboot, sem sincronizar com
// iCloud (mantém o token local ao device). Aplicado SÓ na escrita — itens antigos
// migram no próximo refresh/login. No-op no Android (usa Keystore). Spec 001 A2.
const KEYCHAIN_OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }

async function getChunked(key) {
  const countStr = await SecureStore.getItemAsync(`${key}_chunks`)
  if (countStr === null) {
    // fallback: valor armazenado directamente (sessões antigas ou valores pequenos)
    return SecureStore.getItemAsync(key)
  }
  const count = parseInt(countStr, 10)
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}_${i}`))
  )
  if (parts.some(p => p === null)) return null
  return parts.join('')
}

async function setChunked(key, value) {
  if (value.length <= CHUNK_SIZE) {
    // valor pequeno — armazenar directamente, limpar chunks antigos se existirem
    await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTS)
    await cleanChunks(key)
    return
  }
  // dividir em chunks
  const chunks = []
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE))
  }
  await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_${i}`, chunk, KEYCHAIN_OPTS)))
  await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length), KEYCHAIN_OPTS)
  // remover chave directa antiga se existir
  await SecureStore.deleteItemAsync(key).catch(() => {})
}

async function removeChunked(key) {
  await cleanChunks(key)
  await SecureStore.deleteItemAsync(key).catch(() => {})
}

async function cleanChunks(key) {
  const countStr = await SecureStore.getItemAsync(`${key}_chunks`)
  if (countStr === null) return
  const count = parseInt(countStr, 10)
  await Promise.all([
    ...Array.from({ length: count }, (_, i) =>
      SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {})
    ),
    SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {}),
  ])
}

export const secureStoreAuthStorage = {
  async getItem(key) {
    return getChunked(key)
  },
  async setItem(key, value) {
    return setChunked(key, value)
  },
  async removeItem(key) {
    return removeChunked(key)
  },
}
