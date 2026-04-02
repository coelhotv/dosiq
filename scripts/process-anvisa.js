#!/usr/bin/env node

/**
 * ETL-1: Script de Processamento do CSV ANVISA
 *
 * Lê medicamentos-ativos-anvisa.csv, deduplica, normaliza e gera:
 * - medicineDatabase.json (~2.000-4.000 medicamentos unicos)
 * - laboratoryDatabase.json (~200-400 laboratorios unicos)
 *
 * Uso: node scripts/process-anvisa.js
 * Output: src/features/medications/data/{medicineDatabase,laboratoryDatabase}.json
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import iconv from 'iconv-lite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_INPUT = path.join(__dirname, '../public/medicamentos-ativos-anvisa.csv')
const DATA_DIR = path.join(__dirname, '../src/features/medications/data')
const MEDICINE_JSON_OUTPUT = path.join(DATA_DIR, 'medicineDatabase.json')
const LABORATORY_JSON_OUTPUT = path.join(DATA_DIR, 'laboratoryDatabase.json')

/**
 * Normaliza texto: trim, lowercase, remove caracteres especiais
 */
function normalizeForComparison(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Processa o CSV linha por linha e retorna medicines + laboratories deduplicated
 */
async function processCSV() {
  const medicines = new Map() // "nome+principio" → objeto de medicamento
  const laboratories = new Map() // "laboratorio_normalizado" → nome original

  let lineCount = 0
  let medicineDuplicates = 0
  let laboratoryDuplicates = 0

  const fileStream = fs.createReadStream(CSV_INPUT)
  const decodedStream = fileStream.pipe(iconv.decodeStream('mac_roman'))
  const rl = readline.createInterface({
    input: decodedStream,
    crlfDelay: Infinity,
  })

  console.log(`📖 Lendo CSV: ${CSV_INPUT}`)

  for await (const line of rl) {
    lineCount++

    // Pular linha de cabeçalho
    if (lineCount === 1) continue

    // Parse CSV com separador ;
    const parts = line.split(';').map(p => p.trim())
    if (parts.length < 5) continue

    // Colunas do CSV: NOME_PRODUTO;CATEGORIA_REGULATORIA;CLASSE_TERAPEUTICA;PRINCIPIO_ATIVO;EMPRESA_DETENTORA_REGISTRO
    const [
      nomeProduto,
      categoriaRegulatoria,
      classeTerapeutica,
      principioAtivo,
      empresaDetentora,
    ] = parts

    if (!nomeProduto || !principioAtivo) continue

    // ===== DEDUPLICACAO DE MEDICAMENTOS =====
    const medicineDedupeKey = `${normalizeForComparison(nomeProduto)}|${normalizeForComparison(principioAtivo)}`

    if (!medicines.has(medicineDedupeKey)) {
      // Nota: Todos os registros ANVISA mapeiam para "medicamento", não precisa armazenar
      const medicine = {
        name: nomeProduto.trim(),
        activeIngredient: principioAtivo.trim().toLowerCase(),
        therapeuticClass: classeTerapeutica.trim() || null,
        regulatoryCategory: categoriaRegulatoria.trim() || null,
      }
      medicines.set(medicineDedupeKey, medicine)
    } else {
      medicineDuplicates++
    }

    // ===== DEDUPLICACAO DE LABORATORIOS =====
    if (empresaDetentora) {
      const labDedupeKey = normalizeForComparison(empresaDetentora)
      if (!laboratories.has(labDedupeKey)) {
        laboratories.set(labDedupeKey, empresaDetentora.trim())
      } else {
        laboratoryDuplicates++
      }
    }
  }

  const uniqueMedicines = Array.from(medicines.values())
  const uniqueLaboratories = Array.from(laboratories.values()).map(lab => ({ laboratory: lab }))

  console.log(`✅ Processamento concluído`)
  console.log(`   Total de linhas lidas: ${lineCount}`)
  console.log(`   Medicamentos únicos: ${uniqueMedicines.length}`)
  console.log(`   Medicamentos duplicados (removidos): ${medicineDuplicates}`)
  console.log(`   Laboratórios únicos: ${uniqueLaboratories.length}`)
  console.log(`   Laboratórios duplicados (removidos): ${laboratoryDuplicates}`)

  return { medicines: uniqueMedicines, laboratories: uniqueLaboratories }
}

/**
 * Escreve JSON (minificado para economizar espaço em bundle)
 */
function writeJSON(data, outputPath, label) {
  // Criar diretório se não existir
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  // Minificado (sem espaços/quebras) para reduzir tamanho
  const jsonString = JSON.stringify(data)
  fs.writeFileSync(outputPath, jsonString, 'utf8')

  const fileSizeKB = (jsonString.length / 1024).toFixed(2)
  console.log(`📝 ${label} gerado: ${outputPath}`)
  console.log(`   Tamanho: ${fileSizeKB} KB`)

  return parseFloat(fileSizeKB)
}

/**
 * Main
 */
async function main() {
  try {
    const { medicines, laboratories } = await processCSV()

    const medSizeKB = writeJSON(medicines, MEDICINE_JSON_OUTPUT, 'medicineDatabase.json')
    const labSizeKB = writeJSON(laboratories, LABORATORY_JSON_OUTPUT, 'laboratoryDatabase.json')

    const totalSizeKB = medSizeKB + labSizeKB

    console.log(`\n📊 Resumo:`)
    console.log(`   medicineDatabase.json: ${medSizeKB} KB (uncompressed)`)
    console.log(`   laboratoryDatabase.json: ${labSizeKB} KB`)
    console.log(`   Total: ${totalSizeKB.toFixed(2)} KB`)

    // Nota: O arquivo será lazy-loaded via dynamic import, logo não impacta o bundle inicial.
    // Será gzip-comprimido para ~100-120 KB na transferência.
    if (totalSizeKB > 500) {
      console.warn(`\n⚠️  Aviso: Tamanho total ${totalSizeKB.toFixed(2)} KB excede estimativa de 500 KB.`)
      console.warn(`   Motivo: A base ANVISA tem 6.816 medicamentos únicos (não 2.000-4.000 estimados).`)
      console.warn(`   Mitigação: Arquivo será lazy-loaded (dynamic import) + gzip-comprimido (~103 KB).`)
    }

    console.log(`\n✨ Sprint 5.B ETL-1 concluído com sucesso!`)
    process.exit(0)
  } catch (error) {
    console.error(`\n❌ Erro durante processamento:`, error.message)
    console.error(error)
    process.exit(1)
  }
}

main()
