// localDataWipe.ts — limpeza do armazenamento local por ALLOWLIST (spec 091, FR-001/FR-002/FR-009)
//
// AsyncStorage é do APARELHO, não da pessoa (AP-213). A limpeza antiga era uma denylist em dois
// lugares que já divergiam (`logoutUser` × listener SIGNED_OUT) e nenhum dos dois conhecia o
// histórico do assistente — que ia para o LLM como contexto da conversa da próxima conta.
// Aqui a lógica é invertida, como no ConsentLockedNavigator: tudo o que NÃO está na lista abaixo é
// apagado. Chave nova nasce por-pessoa e apagável; manter é um ato deliberado, com motivo escrito.
//
// A sessão do Supabase mora no SecureStore, fora do alcance desta rotina (INV-2): encerrar sessão é
// sempre `signOut`, nunca apagar storage.
//
// Logs: só contagens. Nome de chave pode carregar id de pessoa (`@dosiq/notif-last-seen:<uuid>`) —
// nunca vai para log (RC-SEC S-3).

import AsyncStorage from '@react-native-async-storage/async-storage'

// Dono do último uso do aparelho. Guarda só o uuid e PRECISA sobreviver ao wipe da saída: é com ele
// que a entrada seguinte decide se o que está no aparelho é de outra pessoa.
export const DEVICE_OWNER_KEY = '@dosiq/device-owner'
// Marca de UI: "sua sessão terminou" para a Landing mostrar depois de um encerramento por sessão
// inválida. Gravada ANTES do signOut (a Landing monta dentro dele) — por isso sobrevive ao wipe.
export const SESSION_ENDED_REASON_KEY = '@dosiq/session-ended-reason'
// Token push-to-start do Live Activity (iOS 17.2+, spec 041). Guardado no registro para o
// `endSession` desativar a linha `apns_liveactivity` — sem ele, o servidor seguia podendo iniciar um
// Live Activity com a dose da conta que saiu (smoke 091, 28/09).
export const LIVE_ACTIVITY_PUSH_TOKEN_KEY = '@dosiq/liveactivity-push-token'

type AllowlistEntry = { key: string; why: string } | { prefix: string; why: string }

// ⚠️ Literais de propósito (sem importar os módulos donos): este arquivo roda no caminho de saída e
// não pode puxar notifee/supabase para o grafo. `localDataWipe.test.ts` confere cada literal contra
// a constante exportada pelo dono — renomear lá sem renomear aqui fica vermelho.
export const DEVICE_KEY_ALLOWLIST: ReadonlyArray<AllowlistEntry> = [
  { key: '@dosiq/anvisa-manifest', why: 'base ANVISA pública (CON-027); apagar força re-download' },
  { key: '@dosiq/anvisa-data', why: 'base ANVISA pública (CON-027); apagar força re-download' },
  { prefix: 'ota_update:', why: 'throttle do checador de OTA — estado do binário, não da pessoa' },
  { key: '@dosiq/alarm-perms-guide-shown', why: 'guia de permissão do SO — a permissão é do aparelho' },
  {
    key: '@dosiq/expo-push-token',
    why: 'token do aparelho; o cleanup do usePushNotifications lê e remove depois que a sessão cai',
  },
  { key: DEVICE_OWNER_KEY, why: 'guarda de dono (FR-009) — precisa sobreviver à saída' },
  { key: SESSION_ENDED_REASON_KEY, why: 'marca de UI lida e apagada pela Landing' },
  {
    key: LIVE_ACTIVITY_PUSH_TOKEN_KEY,
    why: 'token push-to-start do aparelho (iOS); o endSession o lê para desativar a linha no servidor',
  },
]

export function isDeviceKey(key: string): boolean {
  return DEVICE_KEY_ALLOWLIST.some((entry) =>
    'key' in entry ? entry.key === key : key.startsWith(entry.prefix),
  )
}

/**
 * Apaga toda chave local fora da allowlist. Idempotente e fail-safe: erro loga (só contagem) e
 * nunca lança — a saída da conta não pode travar por causa do storage.
 */
export async function wipeLocalUserData(): Promise<{ removed: number }> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const toRemove = (keys ?? []).filter((key) => !isDeviceKey(key))
    if (toRemove.length === 0) return { removed: 0 }
    await AsyncStorage.multiRemove(toRemove)
    return { removed: toRemove.length }
  } catch {
    if (__DEV__) console.warn('[localDataWipe] limpeza local falhou')
    return { removed: 0 }
  }
}

/**
 * Guarda de entrada (FR-009 / AC-1.5): se o aparelho foi usado por outra pessoa — ou não sabemos
 * por quem —, limpa ANTES de qualquer carga de dado e passa o dono para `userId`. Cobre o que a
 * saída não alcança: fetch da conta anterior que regravou cache depois do wipe, saída interrompida,
 * instalação anterior à 091 (sem dono gravado).
 *
 * Fail-CLOSED no dado (RC-SEC S-2): erro ao ler o dono = trata como outra pessoa e limpa. Nunca
 * pula a limpeza porque a leitura falhou.
 */
export async function ensureDeviceOwner(userId: string | null | undefined): Promise<{ wiped: boolean }> {
  if (!userId) return { wiped: false }

  let owner: string | null = null
  try {
    owner = await AsyncStorage.getItem(DEVICE_OWNER_KEY)
  } catch {
    owner = null
  }
  if (owner === userId) return { wiped: false }

  await wipeLocalUserData()
  try {
    await AsyncStorage.setItem(DEVICE_OWNER_KEY, userId)
  } catch {
    // Sem dono gravado, a próxima entrada limpa de novo — custo é re-download de cache, não vazamento.
  }
  return { wiped: true }
}
