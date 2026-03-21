#!/usr/bin/env node

/**
 * DEBUG: Busca medicamentos no CSV da ANVISA
 * Útil para encontrar a grafia exata e a classe terapêutica
 */

import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function normalizeIngredient(ingredient) {
  if (!ingredient) return ''
  return ingredient
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u00e0-\u00fc]/g, (c) => {
      const map = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
        'é': 'e', 'ê': 'e',
        'í': 'i',
        'ó': 'o', 'ô': 'o', 'õ': 'o',
        'ú': 'u', 'ü': 'u',
        'ç': 'c'
      }
      return map[c] || c
    })
}

function parseCsv(csvContent) {
  const lines = csvContent
    .split('\n')
    .filter(line => line.trim())

  if (lines.length < 2) {
    throw new Error('CSV vazio ou sem cabeçalho')
  }

  const headers = lines[0].split(';').map(h => h.trim())
  const records = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim())
    const record = {}

    headers.forEach((header, idx) => {
      record[header] = values[idx] || ''
    })

    records.push(record)
  }

  return records
}

function loadAnvisaCsv() {
  const csvPath = path.join(__dirname, 'public', 'medicamentos-ativos-anvisa.csv')
  const content = readFileSync(csvPath, 'utf-8')
  return parseCsv(content)
}

// Medicamentos para buscar
const medicamentsToFind = [
  'Paracetamol',
  'Espironolactona',
  'Succinato de Metoprolol',
  'Atorvastatina Cálcica',
  'Dapagliflozina',
  'Acido Acetilsalicilico',
  'Carvedilol',
  'Olmesartana Medoxomila',
  'Clopidogrel',
  'Bissulfato de Clopidogrel',
  'Trimebutina',
  'Maleato de Trimebutina',
  'Buspirona',
  'Cloridrato de Buspirona',
  'Omega 3'
]

async function findInANVISA() {
  console.log('🔎 Buscando medicamentos no CSV da ANVISA\n')

  const anvisaRecords = loadAnvisaCsv()
  console.log(`✅ ${anvisaRecords.length} registros carregados\n`)

  console.log('📋 RESULTADOS DE BUSCA:\n')

  medicamentsToFind.forEach((medicine) => {
    const normalized = normalizeIngredient(medicine)

    // Busca exata (normalizada)
    const exactMatch = anvisaRecords.find(
      r => normalizeIngredient(r.PRINCIPIO_ATIVO) === normalized
    )

    // Busca parcial (contém)
    const partialMatches = anvisaRecords.filter(
      r => normalizeIngredient(r.PRINCIPIO_ATIVO).includes(normalized) ||
            normalized.includes(normalizeIngredient(r.PRINCIPIO_ATIVO))
    )

    if (exactMatch) {
      console.log(`✅ ${medicine}`)
      console.log(`   └─ Encontrado: ${exactMatch.PRINCIPIO_ATIVO}`)
      console.log(`   └─ Classe: ${exactMatch.CLASSE_TERAPEUTICA}`)
      console.log(`   └─ Produto exemplo: ${exactMatch.NOME_PRODUTO}\n`)
    } else if (partialMatches.length > 0) {
      console.log(`⚠️  ${medicine}`)
      console.log(`   └─ Não encontrado exatamente, mas há similares:`)
      partialMatches.slice(0, 3).forEach((match) => {
        console.log(`      • ${match.PRINCIPIO_ATIVO} → ${match.CLASSE_TERAPEUTICA}`)
      })
      if (partialMatches.length > 3) {
        console.log(`      ... e mais ${partialMatches.length - 3}`)
      }
      console.log('')
    } else {
      console.log(`❌ ${medicine}`)
      console.log(`   └─ Não encontrado na ANVISA\n`)
    }
  })
}

findInANVISA().catch(error => {
  console.error(`❌ Erro: ${error.message}`)
  process.exit(1)
})
