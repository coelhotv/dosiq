#!/usr/bin/env node

/**
 * TESTE: Valida script de população de classe terapêutica
 *
 * Simula dados de medicamentos e valida o matching com ANVISA.
 * Útil para testar o script antes de rodar no banco de produção.
 *
 * Uso: node test-therapeutic-class.mjs [--verbose]
 */

import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isVerbose = process.argv.includes('--verbose')

// ============================================================================
// HELPERS (copiadas do script principal)
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

  try {
    const content = readFileSync(csvPath, 'utf-8')
    const records = parseCsv(content)
    return records
  } catch (error) {
    console.error(`❌ Erro ao ler CSV: ${error.message}`)
    process.exit(1)
  }
}

function buildAnvisaMap(anvisaRecords) {
  const map = new Map()

  anvisaRecords.forEach((record) => {
    const normalized = normalizeIngredient(record.PRINCIPIO_ATIVO)
    const therapeuticClass = record.CLASSE_TERAPEUTICA?.trim() || null

    if (normalized && therapeuticClass) {
      if (!map.has(normalized)) {
        map.set(normalized, therapeuticClass)
      }
    }
  })

  return map
}

// ============================================================================
// TEST DATA
// ============================================================================

/**
 * Medicamentos de teste baseados em dados reais da ANVISA
 */
const mockMedicines = [
  {
    id: 'med-001',
    user_id: 'user-001',
    name: 'Dipirona 500mg',
    active_ingredient: 'Dipirona',
    therapeutic_class: null,
    expected_class: 'ANALGÉSICO E ANTIPIRÉTICO'
  },
  {
    id: 'med-002',
    user_id: 'user-001',
    name: 'Aspirina',
    active_ingredient: 'Ácido Acetilsalicílico',
    therapeutic_class: null,
    expected_class: 'ANTIAGREGANTE PLAQUETÁRIO'
  },
  {
    id: 'med-003',
    user_id: 'user-001',
    name: 'Amoxicilina 500mg',
    active_ingredient: 'Amoxicilina',
    therapeutic_class: null,
    expected_class: 'ANTIBIÓTICO BETALACTÂMICO'
  },
  {
    id: 'med-004',
    user_id: 'user-001',
    name: 'Paracetamol 750mg',
    active_ingredient: 'Paracetamol',
    therapeutic_class: null,
    expected_class: 'ANALGÉSICO E ANTIPIRÉTICO'
  },
  {
    id: 'med-005',
    user_id: 'user-001',
    name: 'Ibuprofeno 400mg',
    active_ingredient: 'Ibuprofeno',
    therapeutic_class: null,
    expected_class: 'ANTI-INFLAMATÓRIO NÃO ESTEROIDE'
  },
  {
    id: 'med-006',
    user_id: 'user-001',
    name: 'Omeprazol 20mg',
    active_ingredient: 'Omeprazol',
    therapeutic_class: null,
    expected_class: 'INIBIDOR DE BOMBA DE PRÓTONS'
  },
  {
    id: 'med-007',
    user_id: 'user-001',
    name: 'Metformina 500mg',
    active_ingredient: 'Metformina',
    therapeutic_class: 'ANTIDIABÉTICO',  // Já tem classe - não deve mudar
    expected_class: 'ANTIDIABÉTICO'
  },
  {
    id: 'med-008',
    user_id: 'user-001',
    name: 'Losartana 50mg',
    active_ingredient: 'Losartana Potássica',
    therapeutic_class: null,
    expected_class: 'ANTAGONISTA DO RECEPTOR AT1 DA ANGIOTENSINA II'
  },
  {
    id: 'med-009',
    user_id: 'user-001',
    name: 'Atorvastatina 20mg',
    active_ingredient: 'Atorvastatina',
    therapeutic_class: null,
    expected_class: 'INIBIDOR DA HMG-CoA REDUTASE (ESTATINA)'
  },
  {
    id: 'med-010',
    user_id: 'user-001',
    name: 'Vitamina D 1000UI',
    active_ingredient: 'Colecalciferol',
    therapeutic_class: null,
    expected_class: 'VITAMINA D'
  },
  {
    id: 'med-011',
    user_id: 'user-001',
    name: 'Antibiótico desconhecido',
    active_ingredient: 'Ingrediente Inexistente 2026',
    therapeutic_class: null,
    expected_class: null  // Não terá match
  },
  {
    id: 'med-012',
    user_id: 'user-001',
    name: 'Medicamento sem princípio ativo',
    active_ingredient: null,
    therapeutic_class: null,
    expected_class: null  // Será pulado (sem princípio ativo)
  }
]

// ============================================================================
// MAIN TEST
// ============================================================================

async function runTest() {
  console.log('🧪 TESTE DE POPULAÇÃO DE CLASSE TERAPÊUTICA\n')
  console.log(`📋 Modo: SIMULAÇÃO COM DADOS MOCK`)
  console.log(`📊 Verbose: ${isVerbose ? 'ativado' : 'desativado'}\n`)

  // 1. Carregar ANVISA
  console.log('📥 Carregando dados da ANVISA...')
  const anvisaRecords = loadAnvisaCsv()
  console.log(`✅ ${anvisaRecords.length} registros carregados\n`)

  // 2. Construir mapa
  console.log('🗺️  Construindo mapa de princípios ativos...')
  const anvisaMap = buildAnvisaMap(anvisaRecords)
  console.log(`✅ ${anvisaMap.size} princípios ativos únicos\n`)

  // 3. Processar medicamentos de teste
  console.log('🔄 Processando medicamentos de teste...\n')

  let matched = 0
  let updated = 0
  let skipped = 0
  let correct = 0
  const results = []

  mockMedicines.forEach((med) => {
    if (!med.active_ingredient) {
      skipped++
      if (isVerbose) {
        console.log(`  ⏭️  [${med.name}] Sem princípio ativo`)
      }
      results.push({
        medicine: med.name,
        status: 'skipped',
        reason: 'Sem princípio ativo'
      })
      return
    }

    const normalized = normalizeIngredient(med.active_ingredient)
    const therapeuticClass = anvisaMap.get(normalized)

    if (!therapeuticClass) {
      skipped++
      if (isVerbose) {
        console.log(`  ⏭️  [${med.name}] Princípio ativo não encontrado na ANVISA`)
      }
      results.push({
        medicine: med.name,
        status: 'skipped',
        reason: 'Sem match na ANVISA'
      })
      return
    }

    if (med.therapeutic_class === therapeuticClass) {
      matched++
      correct++
      if (isVerbose) {
        console.log(`  ✓ [${med.name}] Já possui classe correta`)
      }
      results.push({
        medicine: med.name,
        status: 'correct',
        class: therapeuticClass
      })
      return
    }

    updated++
    if (isVerbose) {
      console.log(`  📝 [${med.name}]`)
      console.log(`     Antiga: ${med.therapeutic_class || 'vazio'}`)
      console.log(`     Nova:   ${therapeuticClass}`)
    }
    results.push({
      medicine: med.name,
      status: 'updated',
      old_class: med.therapeutic_class,
      new_class: therapeuticClass,
      expected: med.expected_class,
      matches_expected: therapeuticClass === med.expected_class
    })
  })

  // 4. Relatório
  console.log(`\n📊 RESULTADO DO TESTE:\n`)
  console.log(`  ✓ Já com classe correta: ${matched}`)
  console.log(`  📝 Precisariam atualizar: ${updated}`)
  console.log(`  ⏭️  Pulados (sem match): ${skipped}`)
  console.log(`  📦 Total: ${mockMedicines.length}\n`)

  // 5. Validação
  console.log(`🔍 VALIDAÇÃO DOS RESULTADOS:\n`)

  const updatedResults = results.filter(r => r.status === 'updated')
  let allCorrect = true

  updatedResults.forEach((result) => {
    const matches = result.matches_expected
    const icon = matches ? '✅' : '⚠️'
    console.log(`  ${icon} ${result.medicine}`)
    console.log(`     Esperado: ${result.expected}`)
    console.log(`     Obtido:   ${result.new_class}`)
    if (!matches) {
      console.log(`     ⚠️  NÃO CORRESPONDE AO ESPERADO`)
      allCorrect = false
    }
    console.log('')
  })

  // 6. Conclusão
  console.log('\n' + '='.repeat(60))
  if (allCorrect && updated > 0) {
    console.log('🎉 TESTE PASSOU! Todas as classes foram encontradas corretamente.')
    console.log('   O script está pronto para usar em produção.')
  } else if (updated === 0) {
    console.log('ℹ️  Nenhuma atualização necessária nos dados de teste.')
    console.log('   (Isso pode significar que todos já têm classe ou nenhum tem match)')
  } else if (!allCorrect) {
    console.log('⚠️  ALGUMAS VALIDAÇÕES FALHARAM.')
    console.log('   Verifique as classes esperadas vs obtidas acima.')
  }
  console.log('='.repeat(60) + '\n')
}

// ============================================================================
// RUN
// ============================================================================

try {
  await runTest()
} catch (error) {
  console.error(`\n❌ Erro fatal: ${error.message}`)
  console.error(error.stack)
  process.exit(1)
}
