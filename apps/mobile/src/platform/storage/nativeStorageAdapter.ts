// nativeStorageAdapter.js — persistência geral (não sensível)
// ADR-028: AsyncStorage para dados não sensíveis
// R4-003: AsyncStorage para não sensível, SecureStore para auth
// Implementa a mesma interface StorageAdapter de packages/storage

import AsyncStorage from '@react-native-async-storage/async-storage'

export const nativeStorageAdapter = {
  async getItem(key) {
    return AsyncStorage.getItem(key)
  },
  async setItem(key, value) {
    return AsyncStorage.setItem(key, value)
  },
  async removeItem(key) {
    return AsyncStorage.removeItem(key)
  },
}
