import { setSession, getSession, clearSession } from '../services/sessionManager.js';

/**
 * Simple state manager for conversational flows.
 * Now backed by Supabase for persistence across restarts.
 */

export async function setState(chatId, data) {
  return setSession(chatId, data);
}

export async function getState(chatId) {
  return getSession(chatId);
}

export async function clearState(chatId) {
  return clearSession(chatId);
}

export { setSession, getSession, clearSession };

