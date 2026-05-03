#!/usr/bin/env node

/**
 * Script de DEBUG: Puxa dados do Supabase e valida cálculos de adesão
 *
 * Uso:
 *   node scripts/debug-adherence.js [userId]
 *
 * Se userId não for fornecido, tenta obter do usuário autenticado
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseISO } from '../packages/core/src/utils/dateUtils.js'

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
// Preferir chave de serviço (sem RLS) ou cair para anônima
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas')
  console.error('   Verifique VITE_SUPABASE_URL e uma das:')
  console.error('   - SUPABASE_SERVICE_KEY (para contornar RLS)')
  console.error('   - VITE_SUPABASE_ANON_KEY (usa RLS)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// Importar função do serviço para evitar duplicação de código
import { analyzeAdherencePatterns } from '../src/features/adherence/services/adherencePatternService.js'

const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

async function main() {
  const userIdArg = process.argv[2]

  let userId = userIdArg

  if (!userId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
      if (!userId) throw new Error('Usuário não autenticado')
    } catch (err) {
      console.error('❌ Erro ao obter usuário:', err.message)
      console.log('   Use: node scripts/debug-adherence.js <userId>')
      process.exit(1)
    }
  }

  console.log('\n🔍 DEBUG: Analisando adesão do usuário\n')
  console.log(`📋 User ID: ${userId}\n`)

  try {
    // Buscar logs
    console.log('⏳ Buscando logs...')
    const { data: logs, error: logsError } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('user_id', userId)
      .order('taken_at', { ascending: false })
      .limit(500)

    if (logsError) throw logsError

    console.log(`✅ ${logs.length} logs encontrados\n`)

    // Buscar protocolos ativos
    console.log('⏳ Buscando protocolos ativos...')
    const { data: protocols, error: protError } = await supabase
      .from('protocols')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)

    if (protError) throw protError

    console.log(`✅ ${protocols.length} protocolos ativos\n`)

    // Mostrar resumo de logs por hora
    console.log('📊 ANÁLISE DE LOGS POR HORA\n')
    const logsByHour = new Map()
    logs.forEach(log => {
      const date = parseISO(log.taken_at)
      const hour = date.getHours()
      const key = `${hour}h`
      logsByHour.set(key, (logsByHour.get(key) ?? 0) + 1)
    })

    const hourCounts = Object.fromEntries(
      Array.from(logsByHour.entries()).sort((a, b) => {
        const hA = parseInt(a[0])
        const hB = parseInt(b[0])
        return hA - hB
      })
    )
    console.log(JSON.stringify(hourCounts, null, 2))

    // [DEBUG] Contar quantidade_taken por horário
    console.log('\n📊 QUANTIDADE TOMADA POR HORA (quantity_taken)\n')
    const quantityByHour = new Map()
    logs.forEach(log => {
      const date = new Date(log.taken_at)
      const hour = date.getHours()
      const key = `${hour}h`
      const current = quantityByHour.get(key) ?? { count: 0, total_quantity: 0 }
      quantityByHour.set(key, {
        count: current.count + 1,
        total_quantity: current.total_quantity + (log.quantity_taken || 0)
      })
    })

    const hourQuantities = Object.fromEntries(
      Array.from(quantityByHour.entries())
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([hour, data]) => [
          hour,
          `${data.count} registros × ${(data.total_quantity / data.count).toFixed(2)} avg = ${data.total_quantity.toFixed(1)} total`
        ])
    )
    console.log(JSON.stringify(hourQuantities, null, 2))

    // Análise por período (otimizada para 1 iteração em vez de 4 filter calls)
    console.log('\n📊 LOGS POR PERÍODO\n')
    const logsByPeriod = {
      'Madrugada (00-05h)': 0,
      'Manhã (06-11h)': 0,
      'Tarde (12-17h)': 0,
      'Noite (18-23h)': 0,
    }
    logs.forEach(l => {
      const h = parseISO(l.taken_at).getHours()
      if (h < 6) {
        logsByPeriod['Madrugada (00-05h)']++
      } else if (h < 12) {
        logsByPeriod['Manhã (06-11h)']++
      } else if (h < 18) {
        logsByPeriod['Tarde (12-17h)']++
      } else {
        logsByPeriod['Noite (18-23h)']++
      }
    })
    console.log(JSON.stringify(logsByPeriod, null, 2))

    // Calcular padrão
    console.log('\n⏳ Calculando padrão de adesão...\n')
    const result = analyzeAdherencePatterns({ logs, protocols })

    // Mostrar expectedMap
    console.log('📋 EXPECTED MAP (doses esperadas por dia/período)\n')
    const expectedMapDisplay = {}
    for (let day = 0; day < 7; day++) {
      expectedMapDisplay[DAY_NAMES[day]] = result.expectedMap[day]
    }
    console.log(JSON.stringify(expectedMapDisplay, null, 2))

    // Mostrar dayOccurrences
    console.log('\n📅 DAY OCCURRENCES (quantas vezes cada dia aparece nos logs)\n')
    const dayOccDisplay = {}
    for (let day = 0; day < 7; day++) {
      dayOccDisplay[DAY_NAMES[day]] = result.dayOccurrences[day]
    }
    console.log(JSON.stringify(dayOccDisplay, null, 2))

    // Mostrar grid com detalhes
    console.log('\n🎯 GRID DE ADESÃO (7 dias × 4 períodos)\n')
    console.log('┌─────────┬─────────┬─────────┬─────────┬─────────┐')
    console.log('│ Dia     │ Madrug  │ Manhã   │ Tarde   │ Noite   │')
    console.log('├─────────┼─────────┼─────────┼─────────┼─────────┤')

    for (let day = 0; day < 7; day++) {
      const row = result.grid[day]
      const dayLabel = DAY_NAMES[day].padEnd(7)
      const cells = row.map(cell => {
        if (cell.adherence === null) return '—'.padEnd(7)
        return `${cell.adherence}%`.padEnd(7)
      }).join('│ ')
      console.log(`│ ${dayLabel} │ ${cells} │`)
    }
    console.log('└─────────┴─────────┴─────────┴─────────┴─────────┘')

    // Detalhes por protocolo
    console.log('\n📝 DETALHES POR PROTOCOLO\n')
    console.log('Protocolo | Frequência | Horários | Dose/Intake')
    console.log('─'.repeat(60))
    protocols.forEach(p => {
      const schedule = JSON.stringify(p.time_schedule || [])
      const dosage = p.dosage_per_intake || '?'
      console.log(`${p.name.padEnd(20)} | ${p.frequency.padEnd(10)} | ${schedule.padEnd(20)} | ${dosage}`)
    })

    // Análise Manhã vs Noite
    console.log('\n🔥 ANÁLISE DETALHADA: MANHÃ vs NOITE\n')
    console.log('MANHÃ (período 1):')
    for (let day = 0; day < 7; day++) {
      const cell = result.grid[day][1]
      const occurrences = result.dayOccurrences[day]
      const totalExpected = cell.expected * occurrences
      const formula = totalExpected > 0 ? `(${cell.taken}/${totalExpected})*100=${Math.round((cell.taken / totalExpected) * 100)}%` : 'N/A'
      console.log(`  ${DAY_NAMES[day].padEnd(7)}: taken=${cell.taken}, expected=${cell.expected}, occ=${occurrences}, totalExp=${totalExpected}, ${formula}`)
    }

    console.log('\nNOITE (período 3):')
    for (let day = 0; day < 7; day++) {
      const cell = result.grid[day][3]
      const occurrences = result.dayOccurrences[day]
      const totalExpected = cell.expected * occurrences
      const formula = totalExpected > 0 ? `(${cell.taken}/${totalExpected})*100=${Math.round((cell.taken / totalExpected) * 100)}%` : 'N/A'
      console.log(`  ${DAY_NAMES[day].padEnd(7)}: taken=${cell.taken}, expected=${cell.expected}, occ=${occurrences}, totalExp=${totalExpected}, ${formula}`)
    }

    console.log('\n✅ Debug completo!\n')

  } catch (err) {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  }
}

main()
