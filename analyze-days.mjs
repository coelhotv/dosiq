import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function analyzeData() {
  // Buscar TODOS os logs
  const { data: allLogs, error } = await supabase
    .from('medicine_logs')
    .select('taken_at')
    .order('taken_at', { ascending: false })

  if (error) {
    console.error('Erro:', error)
    return
  }

  if (!allLogs || allLogs.length === 0) {
    console.log('❌ Nenhum log encontrado')
    return
  }

  // Contar dias únicos
  const uniqueDays = new Set(
    allLogs.map((log) => {
      const date = new Date(log.taken_at)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
  )

  // Achar data range
  const dates = Array.from(uniqueDays).sort()
  const firstDate = new Date(dates[dates.length - 1] + 'T00:00:00')
  const lastDate = new Date(dates[0] + 'T00:00:00')
  const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1

  console.log('📊 Análise Completa de Logs:')
  console.log(`  Total de logs: ${allLogs.length}`)
  console.log(`  Dias ÚNICOS com logs: ${uniqueDays.size}`)
  console.log(`  Período: ${dates[dates.length - 1]} até ${dates[0]}`)
  console.log(`  Dias totais no período: ${daysDiff}`)
  console.log(`  Status: ${uniqueDays.size >= 21 ? '✅ PASSOU' : '❌ FALHOU'} critério de 21 dias únicos`)

  // Últimos 30 dias
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const last30Days = allLogs.filter(log => {
    const logDate = log.taken_at.split('T')[0]
    return logDate >= thirtyDaysAgoStr
  })

  const uniqueLast30 = new Set(
    last30Days.map((log) => log.taken_at.split('T')[0])
  )

  console.log(`  Últimos 30 dias: ${last30Days.length} logs em ${uniqueLast30.size} dias únicos`)
}

analyzeData()
