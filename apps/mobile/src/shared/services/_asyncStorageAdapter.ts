import AsyncStorage from '@react-native-async-storage/async-storage'

// Storage adapter da base ANVISA para o mobile (CON-027) — AsyncStorage.
//
// Implementa a interface StorageAdapter { read, write } consumida pela orquestração
// on-demand (useMedicineDatabase). Preserva as chaves existentes em produção para não
// invalidar o cache dos usuários já instalados.
//
// Mantém manifest e data em chaves separadas (multiGet/multiSet), espelhando o
// comportamento anterior do hook (paridade 037 Slice 2).

const STORAGE_KEYS = {
  manifest: '@dosiq/anvisa-manifest',
  data: '@dosiq/anvisa-data',
}

export function createAsyncStorageAdapter() {
  return {
    // read(fileKey) → { manifest, data } | null. fileKey ignorado (mobile só medicineDatabase).
    async read() {
      try {
        const entries = await AsyncStorage.multiGet([STORAGE_KEYS.manifest, STORAGE_KEYS.data])
        const [rawManifest, rawData] = entries.map(([, v]) => v)
        if (!rawManifest || !rawData) return null
        return {
          manifest: JSON.parse(rawManifest),
          data: JSON.parse(rawData),
        }
      } catch (cacheErr) {
        console.warn('[asyncStorageAdapter] cache read falhou:', cacheErr?.message)
        return null
      }
    },

    // write(fileKey, { manifest, data }) → void. Persiste ambas as chaves.
    async write(_fileKey: string, { manifest, data }: { manifest: unknown; data: unknown }) {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.manifest, JSON.stringify(manifest)],
        [STORAGE_KEYS.data, JSON.stringify(data)],
      ])
    },
  }
}

export default createAsyncStorageAdapter
