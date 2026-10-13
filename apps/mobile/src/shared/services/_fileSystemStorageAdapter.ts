import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File, Paths } from 'expo-file-system'
import { getNow } from '@dosiq/core'

// Storage adapter em disco para bases grandes demais para o AsyncStorage (066 Slice B,
// FR-022, ADR-107). Mesma interface { read, write } do CON-027, isolada por fileKey.
//
// Dado: Paths.cache/anvisa/<fileKey>.<carimbo>.json — cache porque é re-baixável; se o SO
// limpar, read devolve null e o loader baixa de novo.
// Manifest: AsyncStorage `@dosiq/anvisa-file-manifest:<fileKey>` = { manifest, dataFile }.
//
// Por que não "tmp + rename" (C-B2 do analysis-B): o move nativo do expo-file-system 19 lança
// se o destino existe (iOS moveItem, Android Path.moveTo) e, abaixo da API 26, é copyTo +
// delete — não há troca atômica de arquivo. Aqui cada gravação cria um arquivo NOVO e o commit
// é o setItem do manifest apontando para ele. App morto antes do commit deixa só um órfão,
// apagado na gravação seguinte; a leitura segue no arquivo anterior, íntegro.

// ⚠️ localDataWipe.ts preserva esta chave no logout (literal conferido no teste do wipe).
export const FILE_MANIFEST_KEY_PREFIX = '@dosiq/anvisa-file-manifest:'

// Sem ponto: o ponto separa fileKey do carimbo, então 'cmed' não casa arquivos de 'cmedIndex'.
const FILE_KEY_PATTERN = /^[A-Za-z0-9_-]+$/
const DATA_FILE_PATTERN = /^[A-Za-z0-9_-]+\.\d+\.json$/

function anvisaDirectory() {
  return new Directory(Paths.cache, 'anvisa')
}

function belongsTo(fileKey: string, name: string) {
  return DATA_FILE_PATTERN.test(name) && name.startsWith(`${fileKey}.`)
}

export function createFileSystemStorageAdapter() {
  return {
    // read(fileKey) → { manifest, data } | null. Qualquer falha ⇒ null (nunca lança).
    async read(fileKey: string) {
      if (!FILE_KEY_PATTERN.test(fileKey)) return null
      try {
        const raw = await AsyncStorage.getItem(`${FILE_MANIFEST_KEY_PREFIX}${fileKey}`)
        if (!raw) return null
        const stored = JSON.parse(raw) as { manifest?: unknown; dataFile?: unknown }
        if (typeof stored?.dataFile !== 'string' || !belongsTo(fileKey, stored.dataFile)) return null
        const file = new File(anvisaDirectory(), stored.dataFile)
        if (!file.exists) return null
        return { manifest: stored.manifest, data: JSON.parse(await file.text()) }
      } catch (cacheErr) {
        console.warn('[fileSystemStorageAdapter] cache read falhou:', (cacheErr as Error)?.message)
        return null
      }
    },

    // write(fileKey, { manifest, data }) → void. Lança se a gravação falhar (o caller decide).
    async write(fileKey: string, { manifest, data }: { manifest: unknown; data: unknown }) {
      if (!FILE_KEY_PATTERN.test(fileKey)) throw new Error(`fileKey inválido: ${fileKey}`)
      const dir = anvisaDirectory()
      dir.create({ intermediates: true, idempotent: true })
      const dataFile = `${fileKey}.${getNow().getTime()}.json`
      const file = new File(dir, dataFile)
      file.create({ overwrite: true })
      // write() é síncrono (void) no SDK 54/expo-file-system 19 — ver ExportSheet.tsx.
      file.write(JSON.stringify(data))
      await AsyncStorage.setItem(
        `${FILE_MANIFEST_KEY_PREFIX}${fileKey}`,
        JSON.stringify({ manifest, dataFile }),
      )
      // Limpeza best-effort: versões anteriores e órfãos deste fileKey.
      // Já gravou e já comitou: nada daqui pode rejeitar a gravação.
      try {
        for (const entry of dir.list()) {
          if (!(entry instanceof File) || entry.name === dataFile || !belongsTo(fileKey, entry.name)) continue
          try {
            entry.delete()
          } catch {
            // órfão fica para a próxima gravação
          }
        }
      } catch {
        // listagem falhou: órfãos ficam para a próxima gravação
      }
    },
  }
}

export default createFileSystemStorageAdapter
