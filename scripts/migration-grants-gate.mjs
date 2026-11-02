#!/usr/bin/env node
// scripts/migration-grants-gate.mjs — spec 108 FR-013 / PO-8: farol de GRANT em migração.
//
// A partir da 108 (ADR-119) todo objeto novo no `public` nasce FECHADO: sem GRANT explícito, o app
// recebe 42501. Falha fechada e barulhenta é o objetivo — mas só é barulhenta no QA se alguém lembrar
// do GRANT. Este gate tira a lembrança da memória do agente (vários agentes, de modelos diferentes,
// escrevem migração) e põe no `npm run lint`.
//
// Regras, por arquivo `.sql` de docs/migrations/ com data ≥ CUTOFF:
//   (a) CREATE [OR REPLACE] FUNCTION x sem GRANT EXECUTE ON FUNCTION x no mesmo arquivo
//   (b) DROP FUNCTION x + CREATE FUNCTION x sem re-GRANT (mudança de assinatura apaga os grants)
//   (c) toca access_hook.capture_access sem GRANT EXECUTE … TO anon, authenticated
//       (hook de pre-request do PostgREST: sem ele TODA requisição cai — spec 108 PO-9)
//   (d) CREATE TABLE/VIEW em `public` sem GRANT nem o comentário `-- grants: nenhum (só service_role)`
//   (e) GRANT a anon fora da ANON_ALLOWLIST
//
// LIBERAÇÃO pontual de (a)/(b)/(d): marcador `migration-grants: ok — <motivo>` num comentário do
// próprio statement (linhas logo acima dele). (c) e (e) não têm liberação: mude a allowlist aqui,
// com revisão, se o caso for legítimo.
//
// Fora do escopo: `*.test.sql` (criam sondas sem GRANT de propósito) e `*_acl_restore_*.sql`
// (reemitem o estado ANTERIOR à 108, aberto por definição). Migrações antigas ficam fora pelo corte.
//
// Uso: node scripts/migration-grants-gate.mjs [arquivo.sql …]   (sem argumentos = varredura padrão)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CUTOFF = '20261031' // data da migração da 108
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'migrations')
// Objetos que anon pode receber (spec 108 INV-5). Mudar isto exige revisão — é a superfície pública.
export const ANON_ALLOWLIST = new Set(['public.app_version_gate', 'public.consent_policy', 'access_hook.capture_access'])
const MARKER = /migration-grants:\s*ok\s*—\s*\S/
const NO_GRANTS = /grants:\s*nenhum\s*\(só service_role\)/i
const HOOK = 'access_hook.capture_access'

/** Divide em statements fora de strings, $tag$ e comentários. `code` tem comentários e literais em branco. */
export function splitStatements(sql) {
  const out = []
  let raw = ''
  let code = ''
  let i = 0
  const push = () => {
    if (code.trim()) out.push({ raw, code })
    else if (out.length) out[out.length - 1].trailing = (out[out.length - 1].trailing ?? '') + raw
    raw = ''
    code = ''
  }
  while (i < sql.length) {
    const ch = sql[i]
    const rest = sql.slice(i)
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i)
      const stop = end === -1 ? sql.length : end
      raw += sql.slice(i, stop)
      code += ' '
      i = stop
      continue
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2)
      const stop = end === -1 ? sql.length : end + 2
      raw += sql.slice(i, stop)
      code += ' '
      i = stop
      continue
    }
    if (ch === "'") {
      let j = i + 1
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1
      raw += sql.slice(i, j + 1)
      code += "''"
      i = j + 1
      continue
    }
    const tag = rest.match(/^\$[A-Za-z_]*\$/)
    if (tag) {
      const end = sql.indexOf(tag[0], i + tag[0].length)
      const stop = end === -1 ? sql.length : end + tag[0].length
      raw += sql.slice(i, stop)
      code += ' $body$ '
      i = stop
      continue
    }
    if (ch === ';') {
      raw += ch
      push()
      i++
      continue
    }
    raw += ch
    code += ch
    i++
  }
  push()
  return out
}

const ident = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`
const qname = String.raw`${ident}(?:\s*\.\s*${ident})?`
const norm = (n) => {
  const parts = n.split('.').map((p) => p.trim().replace(/^"|"$/g, '').toLowerCase())
  return parts.length === 1 ? `public.${parts[0]}` : parts.join('.')
}
const rolesOf = (s) => s.split(',').map((r) => r.trim().replace(/^"|"$/g, '').toLowerCase())

export function checkSql(sql) {
  const stmts = splitStatements(sql)
  const created = new Map() // função → índice do statement
  const dropped = new Set()
  const fnGrants = new Map() // função → Set(papéis)
  const relGrants = new Set()
  const tables = [] // { name, idx }
  const hookTouched = []
  const errors = []

  stmts.forEach((s, idx) => {
    const c = s.code.replace(/\s+/g, ' ').trim()
    let m
    if ((m = c.match(new RegExp(String.raw`^CREATE (?:OR REPLACE )?FUNCTION (${qname})`, 'i')))) {
      created.set(norm(m[1]), idx)
      if (norm(m[1]) === HOOK) hookTouched.push(idx)
    }
    if ((m = c.match(new RegExp(String.raw`^DROP FUNCTION (?:IF EXISTS )?(${qname})`, 'i')))) {
      dropped.add(norm(m[1]))
      if (norm(m[1]) === HOOK) hookTouched.push(idx)
    }
    if ((m = c.match(new RegExp(String.raw`^(?:ALTER|REVOKE .* ON) FUNCTION (${qname})`, 'i'))) && norm(m[1]) === HOOK) hookTouched.push(idx)
    if ((m = c.match(new RegExp(String.raw`^CREATE (?:UNLOGGED )?TABLE (?:IF NOT EXISTS )?(${qname})`, 'i')))) tables.push({ name: norm(m[1]), idx })
    if ((m = c.match(new RegExp(String.raw`^CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW (?:IF NOT EXISTS )?(${qname})`, 'i')))) tables.push({ name: norm(m[1]), idx })

    if ((m = c.match(new RegExp(String.raw`^GRANT EXECUTE ON FUNCTION (${qname})\s*(?:\([^)]*\))?\s+TO (.+)$`, 'i')))) {
      const key = norm(m[1])
      const set = fnGrants.get(key) ?? new Set()
      rolesOf(m[2]).forEach((r) => set.add(r))
      fnGrants.set(key, set)
      if (set.has('anon') && !ANON_ALLOWLIST.has(key)) {
        errors.push(`(e) GRANT a anon fora da allowlist: ${key} — anon só recebe ${[...ANON_ALLOWLIST].join(', ')}`)
      }
    } else if ((m = c.match(new RegExp(String.raw`^GRANT .+? ON (?:TABLE )?((?:${qname})(?:\s*,\s*${qname})*)\s+TO (.+)$`, 'i')))) {
      const objs = m[1].split(',').map(norm)
      objs.forEach((o) => relGrants.add(o))
      if (rolesOf(m[2]).includes('anon')) {
        objs.filter((o) => !ANON_ALLOWLIST.has(o)).forEach((o) =>
          errors.push(`(e) GRANT a anon fora da allowlist: ${o} — anon só recebe ${[...ANON_ALLOWLIST].join(', ')}`))
      }
    }
    if (/^ALTER DEFAULT PRIVILEGES .* GRANT .* TO .*\banon\b/i.test(c)) {
      errors.push('(e) ALTER DEFAULT PRIVILEGES … GRANT … TO anon — padrão aberto a anon contraria o ADR-119')
    }
  })

  const marked = (idx) => MARKER.test(stmts[idx].raw)
  for (const [fn, idx] of created) {
    if (fn === HOOK || fnGrants.has(fn) || marked(idx)) continue
    if (dropped.has(fn)) {
      errors.push(`(b) DROP + CREATE apaga os grants de ${fn}: reemita GRANT EXECUTE ON FUNCTION ${fn}(...) TO <papéis>`)
    } else {
      errors.push(`(a) função sem GRANT: falta GRANT EXECUTE ON FUNCTION ${fn}(...) TO <papéis> (objeto novo nasce fechado — ADR-119)`)
    }
  }
  if (hookTouched.length) {
    const roles = fnGrants.get(HOOK) ?? new Set()
    if (!roles.has('anon') || !roles.has('authenticated')) {
      errors.push(`(c) ${HOOK} alterada sem GRANT EXECUTE ON FUNCTION access_hook.capture_access() TO anon, authenticated — sem ele TODA requisição cai`)
    }
  }
  for (const { name, idx } of tables) {
    if (!name.startsWith('public.')) continue
    // o comentário logo abaixo do CREATE vira prefixo do statement seguinte (ou sobra no fim do arquivo)
    const lines = (stmts[idx + 1]?.raw ?? '').split('\n')
    const cut = lines.findIndex((l) => !/^\s*(--.*)?$/.test(l))
    const next = `${stmts[idx].trailing ?? ''}\n${(cut === -1 ? lines : lines.slice(0, cut)).join('\n')}`
    if (relGrants.has(name) || marked(idx) || NO_GRANTS.test(stmts[idx].raw) || NO_GRANTS.test(next)) continue
    errors.push(`(d) ${name} sem GRANT: conceda por papel (ex.: GRANT SELECT ON TABLE ${name} TO authenticated) ou declare "-- grants: nenhum (só service_role)"`)
  }
  return errors
}

function defaultFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.test.sql') && !f.includes('_acl_restore'))
    .filter((f) => /^\d{8}/.test(f) && f.slice(0, 8) >= CUTOFF)
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.length > 2 ? process.argv.slice(2) : defaultFiles()
  let failed = 0
  for (const file of files) {
    const errors = checkSql(fs.readFileSync(file, 'utf8'))
    const name = path.basename(file)
    if (errors.length) {
      failed++
      console.error(`❌ migration-grants: ${name}`)
      errors.forEach((e) => console.error(`   ${e}`))
    } else {
      console.log(`✅ migration-grants: ${name}`)
    }
  }
  if (failed) {
    console.error(`\nmigration-grants: ${failed} arquivo(s) com GRANT faltando. Ver docs/standards/SUPABASE_MIGRATIONS.md.`)
    process.exit(1)
  }
  console.log(`migration-grants: OK (${files.length} arquivo(s), corte ${CUTOFF})`)
}
