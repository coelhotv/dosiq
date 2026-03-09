/**
 * DEBUG SCRIPT: Testa validação Zod com dados reais do Supabase
 *
 * Uso: node debug-validation.mjs
 *
 * Este script busca logs reais do Supabase e testa a validação,
 * mostrando exatamente qual campo está falhando.
 */

import { createClient } from '@supabase/supabase-js'
import { AnalyzeReminderTimingInputSchema } from './src/schemas/reminderOptimizerSchema.js'
import { z } from 'zod'

// Configurar cliente Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseKey) {
  console.error('❌ ERRO: Configure VITE_SUPABASE_ANON_KEY no .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugValidation() {
  console.log('🔍 Iniciando validação de logs com Zod...\n')

  try {
    // 1. Buscar logs reais
    console.log('📥 Buscando logs do Supabase...')
    const { data: logs, error: logsError } = await supabase
      .from('medicine_logs')
      .select('*')
      .limit(50)

    if (logsError) {
      console.error('❌ Erro ao buscar logs:', logsError)
      process.exit(1)
    }

    console.log(`✅ Recuperados ${logs?.length || 0} logs\n`)

    if (!logs || logs.length === 0) {
      console.log('⚠️  Nenhum log encontrado. Teste com dados fake...')
      testWithMockData()
      return
    }

    // Inspecionar formato dos timestamps
    console.log('📊 Inspeção de timestamps (primeiros 3 logs):')
    logs.slice(0, 3).forEach((log, i) => {
      console.log(`  Log ${i}: ${log.taken_at} (regex check: ${/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/.test(log.taken_at)})`)
    })
    console.log('')

    // 2. Buscar um protocolo
    console.log('📥 Buscando protocolo...')
    const { data: protocols, error: protocolError } = await supabase
      .from('protocols')
      .select('*')
      .eq('active', true)
      .limit(1)

    if (protocolError) {
      console.error('❌ Erro ao buscar protocolo:', protocolError)
      process.exit(1)
    }

    if (!protocols || protocols.length === 0) {
      console.log('⚠️  Nenhum protocolo ativo. Teste com dados fake...')
      testWithMockData()
      return
    }

    const protocol = protocols[0]
    console.log(`✅ Protocolo encontrado: ${protocol.name}\n`)

    // 3. Testar validação
    console.log('🧪 Testando validação Zod...\n')

    const result = AnalyzeReminderTimingInputSchema.safeParse({
      protocol,
      logs
    })

    if (result.success) {
      console.log('✅ VALIDAÇÃO PASSOU!')
      console.log('\nDados validados:')
      console.log(`  - Protocol ID: ${result.data.protocol.id}`)
      console.log(`  - Logs count: ${result.data.logs.length}`)
      console.log(`  - First log taken_at: ${result.data.logs[0].taken_at}`)
    } else {
      console.log('❌ VALIDAÇÃO FALHOU!\n')
      console.log('Erros por campo:')

      const fieldErrors = result.error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.')
        if (!acc[path]) acc[path] = []
        acc[path].push({
          code: issue.code,
          message: issue.message
        })
        return acc
      }, {})

      Object.entries(fieldErrors).forEach(([field, errors]) => {
        console.log(`\n  📍 ${field}:`)
        errors.forEach(err => {
          console.log(`     - [${err.code}] ${err.message}`)
        })
      })

      console.log('\n📊 Amostra de dados:')
      console.log(`  - Protocol:`)
      console.log(`    - id: ${protocol.id}`)
      console.log(`    - frequency: ${protocol.frequency}`)
      console.log(`    - time_schedule: ${JSON.stringify(protocol.time_schedule)}`)
      console.log(`\n  - Primeiro log:`)
      const firstLog = logs[0]
      console.log(`    - id: ${firstLog.id}`)
      console.log(`    - protocol_id: ${firstLog.protocol_id}`)
      console.log(`    - medicine_id: ${firstLog.medicine_id}`)
      console.log(`    - quantity_taken: ${firstLog.quantity_taken} (type: ${typeof firstLog.quantity_taken})`)
      console.log(`    - taken_at: ${firstLog.taken_at} (type: ${typeof firstLog.taken_at})`)
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

function testWithMockData() {
  console.log('\n🧪 Testando com dados mock...\n')

  const mockProtocol = {
    id: 'proto-1',
    medicine_id: 'med-1',
    frequency: 'diário',
    time_schedule: ['08:00', '20:00']
  }

  const mockLogs = Array.from({ length: 5 }, (_, i) => ({
    id: `log-${i}`,
    protocol_id: 'proto-1',
    medicine_id: 'med-1',
    quantity_taken: 1,
    taken_at: `2026-03-0${i + 1}T08:30:00Z` // Teste com Z suffix
  }))

  const result = AnalyzeReminderTimingInputSchema.safeParse({
    protocol: mockProtocol,
    logs: mockLogs
  })

  if (result.success) {
    console.log('✅ Dados mock PASSARAM na validação!')
  } else {
    console.log('❌ Dados mock FALHARAM na validação')
    console.log(result.error.issues)
  }
}

// Executar
debugValidation()
