#!/usr/bin/env node

/**
 * COMPARAÇÃO: DB vs ANVISA
 * Mostra tabela lado a lado comparando seus medicamentos com a base ANVISA
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Carregar .env.local
config({ path: path.join(__dirname, '.env.local') })

// Configurar Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY ||
  ''

const supabase = createClient(supabaseUrl, supabaseKey)
const userId = 'b0c9746c-c4d9-4954-a198-59856009be26'

// ============================================================================
// HELPERS
// ============================================================================

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
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) throw new Error('CSV vazio')

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

function buildAnvisaMap(anvisaRecords) {
  const seen = new Set()
  const records = []

  anvisaRecords.forEach((record) => {
    const normalized = normalizeIngredient(record.PRINCIPIO_ATIVO)
    const therapeuticClass = record.CLASSE_TERAPEUTICA?.trim() || null

    if (normalized && therapeuticClass && !seen.has(normalized)) {
      seen.add(normalized)
      records.push({
        normalized,
        original: record.PRINCIPIO_ATIVO,
        therapeuticClass
      })
    }
  })

  return records
}

function findTherapeuticClass(userIngredient, anvisaRecords) {
  if (!userIngredient || !userIngredient.trim()) {
    return null
  }

  const normalized = normalizeIngredient(userIngredient)

  // 1. Busca exata
  const exactMatch = anvisaRecords.find(r => r.normalized === normalized)
  if (exactMatch) {
    return { found: true, exact: true, data: exactMatch }
  }

  // 2. Busca por palavra chave (primeira palavra)
  const firstWord = normalized.split(' ')[0]
  const firstWordMatch = anvisaRecords.find(
    r => r.normalized.split(' ')[0] === firstWord && r.normalized !== normalized
  )
  if (firstWordMatch) {
    return { found: true, exact: false, data: firstWordMatch }
  }

  // 3. Busca por substring (o ingrediente do usuário é parte do ANVISA)
  const substringMatch = anvisaRecords.find(
    r => r.normalized.startsWith(normalized) || r.normalized.includes(' ' + normalized)
  )
  if (substringMatch) return { found: true, exact: false, data: substringMatch }

  // 4. Busca por substring reversa (ANVISA é parte do ingrediente do usuário)
  const reverseMatch = anvisaRecords.find(
    r => normalized.startsWith(r.normalized) || normalized.includes(' ' + r.normalized)
  )
  if (reverseMatch) return { found: true, exact: false, data: reverseMatch }

  return { found: false }
}

// ============================================================================
// MAIN
// ============================================================================

async function compareWithANVISA() {
  console.log('📊 COMPARAÇÃO: DB vs ANVISA\n')

  // 1. Carregar ANVISA
  console.log('📥 Carregando dados da ANVISA...')
  const anvisaRecords = loadAnvisaCsv()
  const anvisaMap = buildAnvisaMap(anvisaRecords)
  console.log(`✅ ${anvisaRecords.length} registros, ${anvisaMap.length} únicos\n`)

  // 2. Buscar medicamentos
  console.log('🔍 Buscando medicamentos...')
  const { data: medicines, error } = await supabase
    .from('medicines')
    .select('id, name, active_ingredient, therapeutic_class')
    .eq('user_id', userId)

  if (error) {
    console.error(`❌ Erro: ${error.message}`)
    process.exit(1)
  }

  console.log(`✅ ${medicines.length} medicamentos encontrados\n`)

  // 3. Comparar
  console.log('=' .repeat(140))
  console.log(
    '| ' +
    'MEDICAMENTO (DB)'.padEnd(25) + ' | ' +
    'PRINCÍPIO ATIVO (DB)'.padEnd(30) + ' | ' +
    'PRINCÍPIO ATIVO (ANVISA)'.padEnd(30) + ' | ' +
    'CLASSE TERAPÊUTICA (ANVISA)'.padEnd(30) + ' |'
  )
  console.log('=' .repeat(140))

  const results = []

  medicines.forEach((med) => {
    const result = findTherapeuticClass(med.active_ingredient, anvisaMap)

    let anvisaIngredient = '-'
    let anvisaClass = '-'
    let matchType = 'Sem match'

    if (result.found) {
      anvisaIngredient = result.data.original
      anvisaClass = result.data.therapeuticClass
      matchType = result.exact ? '✅ Exato' : '⚠️  Parcial'
    }

    results.push({
      name: med.name,
      dbIngredient: med.active_ingredient || '(vazio)',
      anvisaIngredient,
      anvisaClass,
      matchType
    })

    // Exibir linha
    const nameTrimmed = med.name.length > 23 ? med.name.substring(0, 20) + '...' : med.name
    const dbIngTrimmed = (med.active_ingredient || '(vazio)').length > 28
      ? (med.active_ingredient || '(vazio)').substring(0, 25) + '...'
      : (med.active_ingredient || '(vazio)')
    const anvisaIngTrimmed = anvisaIngredient.length > 28
      ? anvisaIngredient.substring(0, 25) + '...'
      : anvisaIngredient
    const classTrimmed = anvisaClass.length > 28
      ? anvisaClass.substring(0, 25) + '...'
      : anvisaClass

    console.log(
      '| ' +
      nameTrimmed.padEnd(25) + ' | ' +
      dbIngTrimmed.padEnd(30) + ' | ' +
      anvisaIngTrimmed.padEnd(30) + ' | ' +
      classTrimmed.padEnd(30) + ' |'
    )
  })

  console.log('=' .repeat(140))

  // 4. Resumo
  console.log('\n📋 RESUMO:\n')
  const exactMatches = results.filter(r => r.matchType === '✅ Exato').length
  const partialMatches = results.filter(r => r.matchType === '⚠️  Parcial').length
  const noMatches = results.filter(r => r.matchType === 'Sem match').length

  console.log(`  ✅ Matches exatos:     ${exactMatches}`)
  console.log(`  ⚠️  Matches parciais:   ${partialMatches}`)
  console.log(`  ❌ Sem match:          ${noMatches}`)
  console.log(`  📦 Total:             ${results.length}\n`)

  // 5. Listar diferenças
  if (partialMatches > 0 || noMatches > 0) {
    console.log('⚠️  MEDICAMENTOS COM DIFERENÇAS:\n')

    results.forEach((r, i) => {
      if (r.matchType !== '✅ Exato') {
        console.log(`${i + 1}. ${r.name}`)
        console.log(`   DB:     ${r.dbIngredient}`)
        console.log(`   ANVISA: ${r.anvisaIngredient}`)
        console.log(`   Status: ${r.matchType}`)
        if (r.anvisaClass !== '-') {
          console.log(`   Classe: ${r.anvisaClass}`)
        }
        console.log('')
      }
    })
  }
}

compareWithANVISA().catch(error => {
  console.error(`❌ Erro: ${error.message}`)
  process.exit(1)
})
