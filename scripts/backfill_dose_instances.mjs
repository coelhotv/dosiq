#!/usr/bin/env node
/**
 * backfill_dose_instances.mjs — Backfill one-shot de dose_instances (S2.7, ADR-048).
 *
 * Materializa ocorrências PASSADAS dos protocolos de UM usuário e casa os logs
 * históricos existentes às instâncias geradas. Fecha a Fase 2 do refactor: depois
 * dele, a camada de leitura (Fase 3) tem passado coerente para consumir.
 *
 * Reusa o core puro (generateInstances) + o repo (upsertMany/findAnchorInstance/
 * markTaken). A marcação de `missed` é inline (lógica one-shot de migração, escopada).
 * NÃO toca `protocols.generated_through` (high-water-mark de FUTURO, do motor).
 *
 * Idempotente: rerun não duplica (upsert ON CONFLICT DO NOTHING; markTaken só pega
 * pending; missed só vira de pending). Escopo: SOMENTE o userId informado (R-179).
 *
 * Uso:
 *   SUPABASE_USER_ID=<uuid> node scripts/backfill_dose_instances.mjs --dry-run
 *   SUPABASE_USER_ID=<uuid> node scripts/backfill_dose_instances.mjs --days 365
 *
 * Env (em scripts/.env.local): VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_KEY (recomendado).
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateInstances } from '../packages/core/src/utils/doseInstanceGenerator.js'
import { createDoseInstanceRepository } from '../packages/core/src/repositories/createDoseInstanceRepository.js'
import { getServerTimestamp, parseTimestamp, parseISO, parseLocalDate } from '../packages/core/src/utils/dateUtils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '.env.local') })

// ── Config ─────────────────────────────────────────────────────────────────
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_MINUTE = 60 * 1000
/** Cutoff conservador de missed: instância só vira missed se o instante + o teto de
 *  tolerância (120min) já passou. Nunca marca algo ainda dentro de qualquer janela. */
const MISSED_SAFETY_MINUTES = 120
const UPSERT_BATCH = 500
const DEFAULT_LOOKBACK_DAYS = 180

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const daysIdx = args.indexOf('--days')
const LOOKBACK_DAYS = daysIdx >= 0 ? Number(args[daysIdx + 1]) : DEFAULT_LOOKBACK_DAYS

const userId = process.env.SUPABASE_USER_ID || process.env.VITE_USER_ID || ''
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''

function fail(msg) {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

if (!userId) fail('SUPABASE_USER_ID é obrigatório (escopo de 1 usuário — R-179).')
if (!supabaseUrl || !supabaseKey) fail('Defina VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_KEY em scripts/.env.local.')
if (!Number.isFinite(LOOKBACK_DAYS) || LOOKBACK_DAYS <= 0) fail('--days deve ser um número positivo.')

const supabase = createClient(supabaseUrl, supabaseKey)
const repo = createDoseInstanceRepository({ client: supabase })

// ── Helpers ──────────────────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function getUserTimezone() {
  const { data, error } = await supabase
    .from('user_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) console.warn('[backfill] Falha ao ler timezone (usando default SP):', error.message)
  return data?.timezone || 'America/Sao_Paulo'
}

// ── Pipeline ───────────────────────────────────────────────────────────────
async function run() {
  const nowMs = parseISO(getServerTimestamp()).getTime()
  const lookbackStartMs = nowMs - LOOKBACK_DAYS * MS_PER_DAY
  const nowIso = parseTimestamp(nowMs).toISOString()
  const missedCutoffIso = parseTimestamp(nowMs - MISSED_SAFETY_MINUTES * MS_PER_MINUTE).toISOString()

  const tz = await getUserTimezone()
  console.log(`\n🔧 Backfill dose_instances — user=${userId} | tz=${tz} | lookback=${LOOKBACK_DAYS}d | ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`)

  // 1. Protocolos do usuário (todos os estados — ativos/pausados/finalizados).
  const { data: protocols, error: protoErr } = await supabase
    .from('protocols')
    .select('*')
    .eq('user_id', userId)
  if (protoErr) fail(`Falha ao buscar protocolos: ${protoErr.message}`)
  console.log(`   Protocolos: ${protocols?.length ?? 0}`)

  // 2. Gera instâncias passadas de cada protocolo (janela clampada ao start do protocolo).
  let candidates = []
  for (const protocol of protocols ?? []) {
    // start_date é DATE (YYYY-MM-DD) → parseLocalDate (R-020); parseISO/new Date trataria como UTC midnight (dia anterior em GMT-3).
    const startMs = protocol.start_date ? parseLocalDate(protocol.start_date).getTime() : lookbackStartMs
    const fromMs = Math.max(startMs, lookbackStartMs)
    if (fromMs >= nowMs) continue
    candidates = candidates.concat(
      generateInstances(protocol, parseTimestamp(fromMs), parseTimestamp(nowMs), tz)
    )
  }
  console.log(`   Instâncias passadas candidatas (gerador): ${candidates.length}`)

  // 3. Logs históricos do usuário com protocol_id e ainda sem elo, mais antigos primeiro.
  //    PAGINADO por .range(): PostgREST corta SELECT em ~1000 linhas por padrão —
  //    sem paginar, usuários com >1000 logs ficariam sub-casados (truncados).
  //    Lê TODAS as páginas antes de qualquer escrita (sem drift do filtro dose_instance_id IS NULL).
  const LOG_PAGE = 1000
  const lookbackIso = parseTimestamp(lookbackStartMs).toISOString()
  const logs = []
  for (let from = 0; ; from += LOG_PAGE) {
    const { data: page, error: logErr } = await supabase
      .from('medicine_logs')
      .select('id, protocol_id, taken_at')
      .eq('user_id', userId)
      .not('protocol_id', 'is', null)
      .is('dose_instance_id', null)
      .gte('taken_at', lookbackIso)
      .lte('taken_at', nowIso)
      .order('taken_at', { ascending: true })
      .range(from, from + LOG_PAGE - 1)
    if (logErr) fail(`Falha ao buscar logs: ${logErr.message}`)
    if (!page || page.length === 0) break
    logs.push(...page)
    if (page.length < LOG_PAGE) break
  }
  console.log(`   Logs históricos a casar: ${logs.length}`)

  if (DRY_RUN) {
    console.log('\n📋 DRY-RUN — nada escrito. Estimativa:')
    console.log(`   • upsert idempotente de até ${candidates.length} instâncias (já existentes ignoradas)`)
    console.log(`   • tentativa de casar ${logs?.length ?? 0} logs → taken`)
    console.log(`   • pending com scheduled_for < ${missedCutoffIso} → missed`)
    console.log('\n   Rode sem --dry-run para aplicar.\n')
    return
  }

  // 4. Upsert das instâncias (idempotente, em lotes).
  let upserted = 0
  for (const batch of chunk(candidates, UPSERT_BATCH)) {
    const rows = await repo.upsertMany(batch)
    upserted += rows.length
  }
  console.log(`   ✅ Instâncias novas inseridas: ${upserted} (duplicatas ignoradas)`)

  // 5. Casa logs → marca instância taken + grava elo bidirecional (escopo protocol_id, AP-A03).
  let matched = 0
  for (const log of logs ?? []) {
    const inst = await repo.findAnchorInstance({ protocolId: log.protocol_id, takenAt: log.taken_at })
    if (!inst) continue
    const marked = await repo.markTaken(inst.id, log.id)
    if (!marked) continue
    // .select('id') p/ confirmar a linha afetada — PostgREST não erra em no-op (AP-185).
    const { data: upData, error: upErr } = await supabase
      .from('medicine_logs')
      .update({ dose_instance_id: inst.id })
      .eq('id', log.id)
      .eq('user_id', userId)
      .select('id')
    if (upErr || !upData || upData.length === 0) {
      console.warn(`[backfill] Falha ao gravar elo no log ${log.id}: ${upErr?.message || 'nenhuma linha afetada'}`)
      continue
    }
    matched++
  }
  console.log(`   ✅ Logs casados (taken): ${matched}`)

  // 6. Pending no passado (além do teto de tolerância) sem log → missed.
  const { data: missedRows, error: missedErr } = await supabase
    .from('dose_instances')
    .update({ status: 'missed' })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('scheduled_for', missedCutoffIso)
    .select('id')
  if (missedErr) fail(`Falha ao marcar missed: ${missedErr.message}`)
  console.log(`   ✅ Instâncias passadas sem tomada → missed: ${missedRows?.length ?? 0}`)

  console.log('\n✨ Backfill concluído.\n')
}

run().catch((err) => fail(err?.message || String(err)))
