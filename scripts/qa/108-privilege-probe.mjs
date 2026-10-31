#!/usr/bin/env node
// Spec 108 · T015 / PO-2 — prova R-295 dos privilégios no QA, por PostgREST (o caminho real do app).
// Cria um usuário fictício (admin API), faz login por senha, consulta cada relação da matriz como
// `anon` e como `authenticated`, compara com o esperado e apaga o usuário no fim.
// Só QA (CON-044): aborta se a URL não for do dosiq-qa. Uso: node scripts/qa/108-privilege-probe.mjs
import { readFileSync } from 'node:fs'

const QA_REF = 'ikcvwxyohmntncanclze'
const env = Object.fromEntries(
  readFileSync(new URL('../../apps/web/.env.qa', import.meta.url), 'utf8')
    .split('\n').map((l) => l.match(/^([A-Z_]+)=["']?(.*?)["']?\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
)
const URL_ = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_?.includes(QA_REF) || !ANON || !SERVICE) throw new Error('108-probe: env do QA ausente ou não é o dosiq-qa')

// Matriz (docs/migrations/20261031_108_matrix.md). `select` = o select exato do código quando o grant é por coluna.
const VERSION_GATE_CLIENT_COLUMNS = 'platform,min_supported_version,is_active,message,store_url'
const CONSENT_COLUMNS = 'id,consent_type,action,policy_version,platform,created_at'
const AUTH_READ = ['biomarkers_log', 'consent_copy', 'consent_policy', 'device_activity', 'dose_critical_events',
  'dose_instances', 'failed_notification_queue', 'feedbacks', 'in_app_nudges', 'medicine_logs', 'medicines',
  'notification_devices', 'notification_log', 'protocols', 'purchases', 'stock', 'titration_steps', 'titrations',
  'treatment_plans', 'user_settings', 'medicine_stock_summary', 'v_adherence_heatmap', 'v_daily_adherence']
const AUTH_NONE = ['stock_adjustments', 'stock_consumptions', 'v_dose_critical_summary', 'v_dose_critical_trace',
  'user_emails', 'feedback_stats', 'beta_signups', 'bot_sessions', 'consent_copy_history', 'notification_outbox',
  'prune_queue', 'prune_queue_audit']

const cases = [
  ...AUTH_READ.map((t) => ({ t, select: '*', anon: t === 'consent_policy' ? 200 : 'denied', auth: 200 })),
  ...AUTH_NONE.map((t) => ({ t, select: '*', anon: 'denied', auth: 'denied' })),
  { t: 'app_version_gate', select: VERSION_GATE_CLIENT_COLUMNS, anon: 200, auth: 200 },
  { t: 'app_version_gate', select: '*', anon: 'denied', auth: 'denied' }, // updated_by etc. sem grant
  { t: 'consent_log', select: CONSENT_COLUMNS, anon: 'denied', auth: 200 },
  { t: 'consent_log', select: '*', anon: 'denied', auth: 'denied' }, // seq/user_id/subject_hash sem grant
]

async function rest(path, token, init = {}) {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  const body = await res.text()
  let code = null
  try { code = JSON.parse(body).code ?? null } catch { /* corpo não-JSON */ }
  return { status: res.status, code }
}

const denied = (r) => r.code === '42501' || r.status === 401 || r.status === 403
const ok = (r, want) => (want === 'denied' ? denied(r) : r.status === want)

const email = `spec108-probe-${Date.now()}@example.invalid`
const password = `p-${crypto.randomUUID()}`
const created = await fetch(`${URL_}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then((r) => r.json())
if (!created?.id) throw new Error(`108-probe: criação do usuário falhou: ${JSON.stringify(created)}`)

let failures = 0
try {
  const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  }).then((r) => r.json())
  if (!session?.access_token) throw new Error('108-probe: login falhou')

  console.log('| relação | select | anon (esperado → real) | authenticated (esperado → real) | |')
  console.log('|---|---|---|---|---|')
  for (const c of cases) {
    const path = `/rest/v1/${c.t}?select=${encodeURIComponent(c.select)}&limit=1`
    const a = await rest(path, ANON)
    const u = await rest(path, session.access_token)
    const pass = ok(a, c.anon) && ok(u, c.auth)
    if (!pass) failures++
    const fmt = (r) => `${r.status}${r.code ? ` ${r.code}` : ''}`
    console.log(`| ${c.t} | ${c.select === '*' ? '*' : 'cód.'} | ${c.anon} → ${fmt(a)} | ${c.auth} → ${fmt(u)} | ${pass ? '✅' : '❌'} |`)
  }
  // RPC da matriz como authenticated (EXECUTE explícito sobreviveu à revogação de PUBLIC).
  const rpc = await rest('/rest/v1/rpc/get_my_deletion_notice', session.access_token, { method: 'POST', body: '{}' })
  const rpcAnon = await rest('/rest/v1/rpc/get_my_deletion_notice', ANON, { method: 'POST', body: '{}' })
  const rpcPass = rpc.status === 200 && denied(rpcAnon)
  if (!rpcPass) failures++
  console.log(`| rpc get_my_deletion_notice | — | denied → ${rpcAnon.status} ${rpcAnon.code ?? ''} | 200 → ${rpc.status} | ${rpcPass ? '✅' : '❌'} |`)
} finally {
  await fetch(`${URL_}/auth/v1/admin/users/${created.id}`, {
    method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  })
}
console.log(`\nRESULT ${cases.length + 1 - failures}/${cases.length + 1}`)
if (failures) process.exitCode = 1
