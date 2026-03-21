#!/usr/bin/env node

/**
 * DEBUG: Verifica quais medicamentos têm active_ingredient preenchido
 * Ajuda a identificar medicamentos que precisam de correção
 */

import { createClient } from '@supabase/supabase-js'
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

if (!supabaseKey || !supabaseUrl) {
  console.error('❌ ERRO: Configure SUPABASE_SERVICE_KEY em .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Obter user_id
const userId = process.env.SUPABASE_USER_ID || 'b0c9746c-c4d9-4954-a198-59856009be26'

async function checkIngredients() {
  console.log('🔍 Verificando active_ingredient dos medicamentos\n')
  console.log(`   User ID: ${userId}\n`)

  const { data: medicines, error } = await supabase
    .from('medicines')
    .select('id, name, active_ingredient, therapeutic_class')
    .eq('user_id', userId)

  if (error) {
    console.error(`❌ Erro: ${error.message}`)
    process.exit(1)
  }

  console.log(`✅ ${medicines.length} medicamentos encontrados\n`)
  console.log('📋 MEDICAMENTOS COM ACTIVE_INGREDIENT PREENCHIDO:\n')

  let withIngredient = 0
  let withoutIngredient = 0

  medicines.forEach((med) => {
    if (med.active_ingredient && med.active_ingredient.trim()) {
      withIngredient++
      console.log(`  ✅ ${med.name}`)
      console.log(`     └─ Princípio ativo: ${med.active_ingredient}`)
      console.log(`     └─ Classe: ${med.therapeutic_class || '(vazio)'}`)
      console.log('')
    } else {
      withoutIngredient++
    }
  })

  if (withoutIngredient > 0) {
    console.log('\n❌ MEDICAMENTOS SEM ACTIVE_INGREDIENT:\n')
    medicines.forEach((med) => {
      if (!med.active_ingredient || !med.active_ingredient.trim()) {
        console.log(`  ❌ ${med.name}`)
        console.log(`     └─ Princípio ativo: ${med.active_ingredient || '(vazio)'}`)
        console.log('')
      }
    })
  }

  console.log('\n' + '='.repeat(60))
  console.log(`\n📊 RESUMO:`)
  console.log(`  ✅ Com active_ingredient: ${withIngredient}`)
  console.log(`  ❌ Sem active_ingredient: ${withoutIngredient}`)
  console.log(`  📦 Total: ${medicines.length}\n`)

  if (withoutIngredient > 0) {
    console.log('⚠️  AÇÃO NECESSÁRIA:')
    console.log('   Preencha o campo "active_ingredient" (princípio ativo)')
    console.log('   para os medicamentos listados acima.\n')
    console.log('   Exemplos:')
    console.log('   - Paracetamol → "Paracetamol"')
    console.log('   - Atorvastatina → "Atorvastatina"')
    console.log('   - SeloZok → "Metoprolol" (nome comercial → princípio ativo)\n')
  }
}

checkIngredients().catch(error => {
  console.error(`❌ Erro: ${error.message}`)
  process.exit(1)
})
