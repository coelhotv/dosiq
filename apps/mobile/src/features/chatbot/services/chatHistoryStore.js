// chatHistoryStore.js (mobile) — persistência local do histórico do chat (spec 015 onda 2, FR-007).
//
// AsyncStorage com teto de CHATBOT_MAX_HISTORY mensagens. Degrada gracioso (nunca lança):
// falha de leitura → []; falha de escrita → no-op silencioso.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { CHATBOT_HISTORY_STORAGE_KEY, CHATBOT_MAX_HISTORY } from '../config/chatbotConfig'

/**
 * Carrega o histórico persistido.
 * @returns {Promise<Array<{role:string, content:string, timestamp:number}>>}
 */
export async function loadHistory() {
  try {
    const raw = await AsyncStorage.getItem(CHATBOT_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter((m) => m && m.role && m.content && typeof m.timestamp === 'number' && !m.isError)
  } catch {
    return []
  }
}

/**
 * Persiste o histórico (corta para as últimas CHATBOT_MAX_HISTORY mensagens).
 * @param {Array<{role:string, content:string, timestamp:number}>} messages
 */
export async function saveHistory(messages) {
  try {
    // Filtra mensagens de erro (isError) — falhas transitórias não devem poluir o histórico.
    const trimmed = (messages || []).filter((m) => !m.isError).slice(-CHATBOT_MAX_HISTORY)
    await AsyncStorage.setItem(CHATBOT_HISTORY_STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // no-op: persistência é best-effort
  }
}

/** Limpa o histórico persistido. */
export async function clearHistory() {
  try {
    await AsyncStorage.removeItem(CHATBOT_HISTORY_STORAGE_KEY)
  } catch {
    // no-op
  }
}
