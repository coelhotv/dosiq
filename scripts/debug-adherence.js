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

/**
 * Copia da função analyzeAdherencePatterns para debug standalone
 */
const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const PERIOD_HOURS = [
  { start: 0, end: 6 },   // Madrugada
  { start: 6, end: 12 },  // Manhã
  { start: 12, end: 18 }, // Tarde
  { start: 18, end: 24 }, // Noite
]

function getPeriodIndex(hour) {
  if (hour < 6) return 0
  if (hour < 12) return 1
  if (hour < 18) return 2
  return 3
}

function getDaysOfWeekForProtocol(frequency) {
  switch (frequency) {
    case 'diário':
      return [0, 1, 2, 3, 4, 5, 6]
    case 'dias_alternados':
      return [0, 2, 4, 6]
    case 'semanal':
      return [0]
    case 'quando_necessário':
    case 'personalizado':
      return []
    default:
      return []
  }
}

function preprocessProtocolsExpected(protocols) {
  const expectedMap = {}
  for (let day = 0; day < 7; day++) {
    expectedMap[day] = { 0: 0, 1: 0, 2: 0, 3: 0 }
  }

  protocols.forEach((protocol) => {
    if (!protocol.time_schedule || protocol.time_schedule.length === 0) {
      return
    }

    const daysOfWeek = getDaysOfWeekForProtocol(protocol.frequency)
    daysOfWeek.forEach((dayIndex) => {
      protocol.time_schedule.forEach((timeStr) => {
        const [hour] = timeStr.split(':').map(Number)
        const periodIndex = getPeriodIndex(hour)
        expectedMap[dayIndex][periodIndex] += 1
      })
    })
  })

  return expectedMap
}

function analyzeAdherencePatterns({ logs, protocols }) {
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 4 }, () => ({ taken: 0, expected: 0, adherence: 0 }))
  )

  const expectedMap = preprocessProtocolsExpected(protocols)

  // Contar doses tomadas (CONTAR REGISTROS, NÃO COMPRIMIDOS)
  // Cada registro = 1 dose tomada (independente de quantity_taken)
  logs.forEach((log) => {
    const logDate = new Date(log.taken_at)
    const dayIndex = logDate.getDay()
    const hour = logDate.getHours()
    const periodIndex = getPeriodIndex(hour)
    grid[dayIndex][periodIndex].taken += 1  // Incrementar 1 por dose, não quantity_taken
  })

  // Contar ocorrências de dias
  const dayOccurrences = [0, 0, 0, 0, 0, 0, 0]
  const uniqueDates = new Set()
  logs.forEach((log) => {
    const logDate = new Date(log.taken_at)
    const dateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`
    if (!uniqueDates.has(dateStr)) {
      uniqueDates.add(dateStr)
      const dayIndex = logDate.getDay()
      dayOccurrences[dayIndex] += 1
    }
  })

  // Calcular adherence
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    for (let periodIndex = 0; periodIndex < 4; periodIndex++) {
      const expectedPerDay = expectedMap[dayIndex][periodIndex]
      const occurrences = dayOccurrences[dayIndex]
      const totalExpected = expectedPerDay * occurrences
      const taken = grid[dayIndex][periodIndex].taken

      grid[dayIndex][periodIndex].expected = expectedPerDay

      if (totalExpected > 0) {
        grid[dayIndex][periodIndex].adherence = Math.min(100, Math.round((taken / totalExpected) * 100))
      } else if (expectedPerDay === 0) {
        grid[dayIndex][periodIndex].adherence = null
      } else if (occurrences === 0) {
        grid[dayIndex][periodIndex].adherence = null
      }
    }
  }

  return { grid, expectedMap, dayOccurrences }
}

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
      const date = new Date(log.taken_at)
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

    // Análise por período
    console.log('\n📊 LOGS POR PERÍODO\n')
    const logsByPeriod = {
      'Madrugada (00-05h)': logs.filter(l => {
        const h = new Date(l.taken_at).getHours()
        return h < 6
      }).length,
      'Manhã (06-11h)': logs.filter(l => {
        const h = new Date(l.taken_at).getHours()
        return h >= 6 && h < 12
      }).length,
      'Tarde (12-17h)': logs.filter(l => {
        const h = new Date(l.taken_at).getHours()
        return h >= 12 && h < 18
      }).length,
      'Noite (18-23h)': logs.filter(l => {
        const h = new Date(l.taken_at).getHours()
        return h >= 18 && h < 24
      }).length,
    }
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
