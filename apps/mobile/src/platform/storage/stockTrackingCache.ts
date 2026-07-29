// stockTrackingCache.ts — cache local da preferência de estoque (spec 044, 055-W1.7)
//
// Guarda `enabled` + `pausedAt` em AsyncStorage a cada leitura remota bem-sucedida. Serve
// APENAS de degrau 2 da escada de useStockTracking (remoto → cache → default ATIVO): nunca é
// fonte de verdade e nunca ganha da rede (AP-284). É cache da PREFERÊNCIA (política de conta),
// não do saldo — saldo nunca é cacheado aqui (decisão FIFO continua 100% servidor, AP-231).
//
// Invalidado no evento SIGNED_OUT (Navigation.tsx — choke point único; cobre logout via
// authService.signOut E via profileService.logoutUser, os dois caminhos reais da UI):
// preferência da conta A não pode vazar pra B no mesmo aparelho.

import AsyncStorage from '@react-native-async-storage/async-storage'

export const STOCK_TRACKING_CACHE_KEY = '@dosiq/stock-tracking-pref'

export type StockTrackingCache = {
  enabled: boolean
  pausedAt: string | null
}

export async function readStockTrackingCache(): Promise<StockTrackingCache | null> {
  try {
    const raw = await AsyncStorage.getItem(STOCK_TRACKING_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.enabled !== 'boolean') return null
    return { enabled: parsed.enabled, pausedAt: typeof parsed.pausedAt === 'string' ? parsed.pausedAt : null }
  } catch {
    return null
  }
}

export async function writeStockTrackingCache(value: StockTrackingCache): Promise<void> {
  try {
    await AsyncStorage.setItem(STOCK_TRACKING_CACHE_KEY, JSON.stringify(value))
  } catch {
    // best-effort — falha de storage não pode quebrar a leitura remota que já teve sucesso
  }
}

export async function clearStockTrackingCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STOCK_TRACKING_CACHE_KEY)
  } catch {
    // best-effort
  }
}
