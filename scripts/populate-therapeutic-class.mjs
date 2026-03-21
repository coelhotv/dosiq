#!/usr/bin/env node

/**
 * SCRIPT: Popula classe terapêutica dos medicamentos
 *
 * Lê dados da ANVISA (public/medicamentos-ativos-anvisa.csv) e
 * atualiza medicamentos existentes no Supabase usando princípio ativo como chave.
 *
 * Uso:
 *   node populate-therapeutic-class.mjs [--user-id=XXX] [--dry-run] [--verbose]
 *
 * Parâmetros:
 *   --user-id=XXX    UUID do usuário Supabase (OBRIGATÓRIO)
 *   --dry-run        Simula updates sem fazer alterações no banco
 *   --verbose        Exibe detalhes de cada medicamento processado
 *
 * Exemplos:
 *   # Via argumento CLI
 *   node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run
 *
 *   # Via variável de ambiente
 *   SUPABASE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26 node populate-therapeutic-class.mjs --dry-run
 *
 *   # Via .env.local
 *   # VITE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26
 *   node populate-therapeutic-class.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

// Setup
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDryRun = process.argv.includes('--dry-run')
const isVerbose = process.argv.includes('--verbose')

// Carregar .env.local se existir
config({ path: path.join(__dirname, '.env.local') })

// Configurar Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''

// Preferência: service key > anon key (service key ignora RLS)
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''

const isServiceKey = !!(process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY)

if (!supabaseKey || !supabaseUrl) {
  console.error('❌ ERRO: Configure credenciais Supabase em .env.local ou variáveis de ambiente:')
  console.error('   VITE_SUPABASE_URL=https://your-project.supabase.co')
  console.error('   VITE_SUPABASE_SERVICE_KEY=sbp_xxxxxx (recomendado)')
  console.error('   ou')
  console.error('   VITE_SUPABASE_ANON_KEY=eyJxxx (menos permissões)')
  process.exit(1)
}

// Obter user_id (com prioridade: CLI > env var > .env.local)
let userId = null
const userIdArg = process.argv.find(arg => arg.startsWith('--user-id='))
if (userIdArg) {
  userId = userIdArg.split('=')[1]
} else {
  userId = process.env.SUPABASE_USER_ID || process.env.VITE_USER_ID || ''
}

if (!userId) {
  console.error('❌ ERRO: Configure user_id via:')
  console.error('   1. Variável env: SUPABASE_USER_ID=xxx node populate-therapeutic-class.mjs')
  console.error('   2. Argumento CLI: node populate-therapeutic-class.mjs --user-id=xxx')
  console.error('   3. Em .env.local: VITE_USER_ID=xxx')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normaliza princípio ativo para comparação
 * @param {string} ingredient - Princípio ativo bruto
 * @returns {string}
 */
function normalizeIngredient(ingredient) {
  if (!ingredient) return ''
  return ingredient
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')          // múltiplos espaços → 1
    .replace(/[\u00e0-\u00fc]/g, (c) => {  // remove acentos
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

/**
 * Parser simples para CSV com separador semicolon
 * @param {string} csvContent - Conteúdo do CSV
 * @returns {Array} Array de objetos
 */
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

/**
 * Carrega e parseia CSV da ANVISA
 * @returns {Array} Array de registros {NOME_PRODUTO, CLASSE_TERAPEUTICA, PRINCIPIO_ATIVO, ...}
 */
function loadAnvisaCsv() {
  const csvPath = path.join(__dirname, 'public', 'medicamentos-ativos-anvisa.csv')

  try {
    const content = readFileSync(csvPath, 'utf-8')
    const records = parseCsv(content)
    return records
  } catch (error) {
    console.error(`❌ Erro ao ler CSV: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Cria mapa de princípio ativo → classe terapêutica
 * @param {Array} anvisaRecords - Registros da ANVISA
 * @returns {Array} Array de registros ANVISA normalizados
 */
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

/**
 * Converte texto para Title Case (primeira letra maiúscula, resto minúscula)
 * @param {string} text - Texto a converter
 * @returns {string} Texto em title case
 */
function toTitleCase(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .split(' ')
    .map((word, idx) => {
      // Primeira palavra: primeira letra maiúscula
      if (idx === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1)
      }
      // Restantes: totalmente minúsculas
      return word
    })
    .join(' ')
}

/**
 * Busca classe terapêutica com matching inteligente
 * @param {string} userIngredient - Princípio ativo do usuário
 * @param {Array} anvisaRecords - Registros ANVISA normalizados
 * @returns {string|null} Classe terapêutica encontrada
 */
function findTherapeuticClass(userIngredient, anvisaRecords) {
  if (!userIngredient || !userIngredient.trim()) {
    return null
  }

  const normalized = normalizeIngredient(userIngredient)

  // 1. Busca exata
  const exactMatch = anvisaRecords.find(r => r.normalized === normalized)
  if (exactMatch) return exactMatch.therapeuticClass

  // 2. Busca por palavra chave (primeira palavra)
  const firstWord = normalized.split(' ')[0]
  const firstWordMatch = anvisaRecords.find(
    r => r.normalized.split(' ')[0] === firstWord && r.normalized !== normalized
  )
  if (firstWordMatch) {
    return firstWordMatch.therapeuticClass
  }

  // 3. Busca por substring (o ingrediente do usuário é parte do ANVISA)
  const substringMatch = anvisaRecords.find(
    r => r.normalized.startsWith(normalized) || r.normalized.includes(' ' + normalized)
  )
  if (substringMatch) return substringMatch.therapeuticClass

  // 4. Busca por substring reversa (ANVISA é parte do ingrediente do usuário)
  const reverseMatch = anvisaRecords.find(
    r => normalized.startsWith(r.normalized) || normalized.includes(' ' + r.normalized)
  )
  if (reverseMatch) return reverseMatch.therapeuticClass

  return null
}

// ============================================================================
// MAIN
// ============================================================================

async function populateTherapeuticClass() {
  console.log('🚀 Iniciando população de classe terapêutica\n')
  console.log(`🔐 Autenticação: ${isServiceKey ? '✅ SERVICE KEY (acesso total)' : '⚠️  ANON KEY (RLS ativo)'}`)
  if (!isServiceKey) {
    console.log('   ⚠️  Dica: Use SUPABASE_SERVICE_KEY para melhor desempenho\n')
  }
  console.log(`📋 Modo: ${isDryRun ? '⚠️  DRY RUN (sem alterações)' : '✏️  ESCRITA NO BANCO'}`)
  console.log(`📊 Verbose: ${isVerbose ? 'ativado' : 'desativado'}\n`)

  // 1. Carregar ANVISA
  console.log('📥 Carregando dados da ANVISA...')
  const anvisaRecords = loadAnvisaCsv()
  console.log(`✅ ${anvisaRecords.length} registros carregados\n`)

  // 2. Construir mapa (princípio ativo → classe terapêutica)
  console.log('🗺️  Construindo mapa de princípios ativos...')
  const anvisaMap = buildAnvisaMap(anvisaRecords)
  console.log(`✅ ${anvisaMap.size} princípios ativos únicos\n`)

  // 3. Buscar medicamentos no banco
  console.log('🔍 Buscando medicamentos no banco...')
  console.log(`   User ID: ${userId}\n`)

  const { data: medicines, error: fetchError } = await supabase
    .from('medicines')
    .select('id, name, active_ingredient, therapeutic_class, user_id')
    .eq('user_id', userId)

  if (fetchError) {
    console.error(`❌ Erro ao buscar medicamentos: ${fetchError.message}`)
    process.exit(1)
  }

  console.log(`✅ ${medicines?.length || 0} medicamentos encontrados\n`)

  // 4. Processar medicamentos
  console.log('🔄 Processando medicamentos...\n')

  let matched = 0
  let updated = 0
  let skipped = 0
  const updates = []

  medicines.forEach((med) => {
    if (!med.active_ingredient) {
      skipped++
      if (isVerbose) {
        console.log(`  ⏭️  [${med.name}] Sem princípio ativo`)
      }
      return
    }

    const therapeuticClass = findTherapeuticClass(med.active_ingredient, anvisaMap)

    if (!therapeuticClass) {
      skipped++
      if (isVerbose) {
        console.log(`  ⏭️  [${med.name}] Princípio ativo não encontrado na ANVISA`)
        console.log(`     └─ Procurado: ${med.active_ingredient}`)
      }
      return
    }

    if (med.therapeutic_class === therapeuticClass) {
      matched++
      if (isVerbose) {
        console.log(`  ✓ [${med.name}] Já possui classe correta`)
      }
      return
    }

    updated++
    const titleCaseClass = toTitleCase(therapeuticClass)

    updates.push({
      id: med.id,
      user_id: med.user_id,
      old_class: med.therapeutic_class,
      new_class: titleCaseClass,
      medicine_name: med.name
    })

    if (isVerbose) {
      console.log(`  📝 [${med.name}]`)
      console.log(`     Princípio ativo: ${med.active_ingredient}`)
      console.log(`     Antiga: ${med.therapeutic_class || 'vazio'}`)
      console.log(`     Nova:   ${titleCaseClass}`)
    }
  })

  console.log(`\n📊 Resumo do processamento:`)
  console.log(`  ✓ Já possuem classe correta: ${matched}`)
  console.log(`  📝 Precisam de atualização: ${updated}`)
  console.log(`  ⏭️  Sem match: ${skipped}`)
  console.log(`  📦 Total: ${medicines.length}\n`)

  // 5. Executar updates (se não for dry-run)
  if (updates.length === 0) {
    console.log('✅ Nenhuma atualização necessária!')
    return
  }

  if (isDryRun) {
    console.log('⚠️  Modo DRY RUN: Nenhuma alteração foi feita.')
    console.log('Execute sem --dry-run para aplicar as mudanças.\n')
    return
  }

  console.log(`⚙️  Aplicando ${updates.length} atualizações...\n`)

  let successCount = 0
  let errorCount = 0

  // Fazer updates em lotes (para não sobrecarregar API)
  const batchSize = 10
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)

    for (const update of batch) {
      const { error } = await supabase
        .from('medicines')
        .update({ therapeutic_class: update.new_class })
        .eq('id', update.id)
        .eq('user_id', update.user_id)

      if (error) {
        errorCount++
        console.error(`  ❌ [${update.medicine_name}] Erro: ${error.message}`)
      } else {
        successCount++
        console.log(`  ✅ [${update.medicine_name}] ${update.old_class || 'vazio'} → ${update.new_class}`)
      }
    }

    // Pequena pausa entre lotes para não sobrecarregar
    if (i + batchSize < updates.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log(`\n✅ Atualização concluída!`)
  console.log(`  ✅ Sucesso: ${successCount}`)
  console.log(`  ❌ Erros: ${errorCount}\n`)

  if (errorCount === 0) {
    console.log('🎉 Todos os medicamentos foram atualizados com sucesso!')
  }
}

// ============================================================================
// RUN
// ============================================================================

try {
  await populateTherapeuticClass()
} catch (error) {
  console.error(`\n❌ Erro fatal: ${error.message}`)
  console.error(error.stack)
  process.exit(1)
}
