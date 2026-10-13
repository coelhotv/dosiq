import AsyncStorage from '@react-native-async-storage/async-storage'

// Storage adapter da base ANVISA para o mobile (CON-027) — AsyncStorage.
//
// Implementa a interface StorageAdapter { read, write } consumida pela orquestração
// on-demand (useMedicineDatabase). Preserva as chaves existentes em produção para não
// invalidar o cache dos usuários já instalados.
//
// Mantém manifest e data em chaves separadas (multiGet/multiSet), espelhando o
// comportamento anterior do hook (paridade 037 Slice 2).
//
// 066 Slice B (FR-021): o cache é isolado por fileKey. Antes o fileKey era ignorado e
// gravar um segundo arquivo sobrescrevia o medicineDatabase. O medicineDatabase segue nas
// chaves legadas; qualquer outro fileKey ganha sufixo próprio.

const LEGACY_FILE_KEY = 'medicineDatabase'

const STORAGE_KEYS = {
  manifest: '@dosiq/anvisa-manifest',
  data: '@dosiq/anvisa-data',
}

function keysFor(fileKey: string) {
  if (fileKey === LEGACY_FILE_KEY) return STORAGE_KEYS
  return {
    manifest: `${STORAGE_KEYS.manifest}:${fileKey}`,
    data: `${STORAGE_KEYS.data}:${fileKey}`,
  }
}

export function createAsyncStorageAdapter() {
  return {
    // read(fileKey) → { manifest, data } | null.
    async read(fileKey: string) {
      try {
        const keys = keysFor(fileKey)
        const entries = await AsyncStorage.multiGet([keys.manifest, keys.data])
        const [rawManifest, rawData] = entries.map(([, v]) => v)
        if (!rawManifest || !rawData) return null
        return {
          manifest: JSON.parse(rawManifest),
          data: JSON.parse(rawData),
        }
      } catch (cacheErr) {
        console.warn('[asyncStorageAdapter] cache read falhou:', (cacheErr as Error)?.message)
        return null
      }
    },

    // write(fileKey, { manifest, data }) → void. Persiste ambas as chaves do fileKey.
    async write(fileKey: string, { manifest, data }: { manifest: unknown; data: unknown }) {
      const keys = keysFor(fileKey)
      await AsyncStorage.multiSet([
        [keys.manifest, JSON.stringify(manifest)],
        [keys.data, JSON.stringify(data)],
      ])
    },
  }
}

export default createAsyncStorageAdapter
