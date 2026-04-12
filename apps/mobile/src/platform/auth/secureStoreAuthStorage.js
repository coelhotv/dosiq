// secureStoreAuthStorage.js — persistência de auth/sessão (dados sensíveis)
// ADR-028: expo-secure-store para tokens de auth
// R4-003: NUNCA usar AsyncStorage para sessão/token de auth
// Implementa a interface AuthStorage compatível com @supabase/supabase-js

import * as SecureStore from 'expo-secure-store'

export const secureStoreAuthStorage = {
  async getItem(key) {
    return SecureStore.getItemAsync(key)
  },
  async setItem(key, value) {
    return SecureStore.setItemAsync(key, value)
  },
  async removeItem(key) {
    return SecureStore.deleteItemAsync(key)
  },
}
