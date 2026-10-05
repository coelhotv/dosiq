#!/usr/bin/env node
/**
 * specs-board — visão canônica do status das specs, derivada de plans/specs/README.md.
 *
 *   node scripts/specs-board.mjs --write   gera plans/specs/STATUS_BOARD.md (nunca editar à mão)
 *   node scripts/specs-board.mjs --check   reconcilia índice × headers × docs de estratégia (distill D5)
 *
 * plans/ é local-only: se o diretório não existir (CI), sai 0 sem fazer nada.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SPECS = join(ROOT, 'plans/specs')
const STRATEGY = join(ROOT, 'plans/strategy-2026')
const STRATEGY_DOCS = ['BACKLOG_ORDER_2026H2.md', 'PLANO_EXECUCAO_TESE_2026_v2.md', 'TESE_PLAYBOOK_v2.md']

const STATUSES = ['draft', 'specified', 'planned', 'in-progress', 'delivered', 'superseded']
const TRAVAS = ['loja-0.34', 'adoção', 'gate-LGPD', 'PO', 'congelada']
const TRAVA_DEP = /^dep:[\w.-]+$/
const EMPTY = '—'

const SYNONYMS = [
  [/^(entregue|complete|delivered|done)/, 'delivered'],
  [/^in[ -]progress/, 'in-progress'],
  [/^(draft|specified|planned|superseded)/, null], // já canônicos: devolve o próprio token
]

function normalizeStatus(raw) {
  const t = raw.toLowerCase().replace(/[*`✅:_]/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [re, mapped] of SYNONYMS) {
    const m = t.match(re)
    if (m) return mapped ?? m[1]
  }
  return null
}

function parseIndex() {
  const rows = []
  for (const line of readFileSync(join(SPECS, 'README.md'), 'utf8').split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (!/^\d{3}$/.test(cells[1] ?? '') || cells.length < 8) continue
    rows.push({
      num: cells[1],
      name: cells[2],
      status: cells[3].replace(/\*/g, ''),
      falta: cells[4],
      trava: cells[5],
      nota: cells.slice(6, -1).join('|'),
    })
  }
  return rows
}

function headerStatus(num) {
  const dir = readdirSync(SPECS).find((d) => d.startsWith(`${num}-`))
  const file = dir && join(SPECS, dir, 'spec.md')
  if (!file || !existsSync(file)) return { dir, status: undefined }
  const m = readFileSync(file, 'utf8').split('\n').slice(0, 15).join('\n').match(/Status\**\s*:\**\s*(.+)/i)
  return { dir, status: m ? normalizeStatus(m[1]) : null }
}

const travas = (r) => (r.trava === EMPTY ? [] : r.trava.split(',').map((t) => t.trim()))

function check(rows) {
  const errors = []
  const warns = []
  for (const r of rows) {
    if (!STATUSES.includes(r.status)) errors.push(`${r.num}: status "${r.status}" fora do vocabulário`)
    for (const t of travas(r)) {
      if (!TRAVAS.includes(t) && !TRAVA_DEP.test(t)) errors.push(`${r.num}: Trava "${t}" fora do vocabulário`)
    }
    if (r.status === 'superseded' && !/^\*?\*?(superseded)/.test(r.status)) continue
    const h = headerStatus(r.num)
    if (h.status === undefined) warns.push(`${r.num}: sem spec.md (header não conferido)`)
    else if (h.status === null) warns.push(`${r.num}: header sem Status reconhecível`)
    else if (h.status !== r.status) errors.push(`${r.num}: header "${h.status}" ≠ índice "${r.status}"`)
  }
  // spec superseded citada como candidata nos docs de estratégia
  const OK = /supersed|substitu|ex-\d{3}|→|encerrad/i
  for (const r of rows.filter((x) => x.status === 'superseded')) {
    for (const doc of STRATEGY_DOCS) {
      const p = join(STRATEGY, doc)
      if (!existsSync(p)) continue
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes(`\`${r.num}\``) && !OK.test(line)) {
          errors.push(`${doc}:${i + 1}: cita a ${r.num} (superseded) sem apontar o sucessor`)
        }
      })
    }
  }
  return { errors, warns }
}

function board(rows) {
  const open = (r) => r.status !== 'delivered' && r.status !== 'superseded'
  const group = (title, list, cols) => {
    if (!list.length) return ''
    const head = `| # | Spec | ${cols.map((c) => c[0]).join(' | ')} |\n|---|---|${cols.map(() => '---').join('|')}|`
    const body = list.map((r) => `| ${r.num} | ${r.name} | ${cols.map((c) => c[1](r)).join(' | ')} |`)
    return `## ${title} (${list.length})\n\n${head}\n${body.join('\n')}\n`
  }
  const st = (r) => r.status
  const f = (r) => r.falta
  const t = (r) => r.trava
  const frozen = (r) => travas(r).includes('congelada')
  const blocked = (r) => travas(r).length > 0 && !frozen(r)
  const sections = [
    group('Pronta para pegar (sem trava)', rows.filter((r) => open(r) && !frozen(r) && !blocked(r) && r.status !== 'draft'), [['Status', st], ['Falta', f]]),
    group('Travada', rows.filter((r) => open(r) && blocked(r)), [['Status', st], ['Falta', f], ['Trava', t]]),
    group('Congelada', rows.filter((r) => open(r) && frozen(r)), [['Status', st], ['Falta', f]]),
    group('Draft (sem trava)', rows.filter((r) => r.status === 'draft' && !frozen(r) && !blocked(r)), [['Falta', f]]),
    group('Entregue — aguardando embarque/adoção', rows.filter((r) => r.status === 'delivered' && travas(r).length), [['Trava', t], ['Dívida', f]]),
    group('Entregue — com dívida conhecida', rows.filter((r) => r.status === 'delivered' && !travas(r).length && r.falta !== EMPTY), [['Dívida', f]]),
  ]
  const delivered = rows.filter((r) => r.status === 'delivered' && !travas(r).length && r.falta === EMPTY)
  const sup = rows.filter((r) => r.status === 'superseded')
  const counts = STATUSES.map((s) => `${s} ${rows.filter((r) => r.status === s).length}`).join(' · ')
  return [
    '# STATUS_BOARD — specs',
    '',
    '> **Gerado** por `node scripts/specs-board.mjs --write` a partir de `README.md` (índice canônico). Não editar.',
    `> ${rows.length} specs — ${counts}`,
    '',
    ...sections,
    `## Entregue e pronto (${delivered.length})\n\n${delivered.map((r) => r.num).join(' · ')}\n`,
    sup.length ? `## Superseded (${sup.length})\n\n${sup.map((r) => `${r.num} ${r.name}`).join(' · ')}\n` : '',
  ].join('\n')
}

if (!existsSync(join(SPECS, 'README.md'))) {
  console.log('specs-board: plans/specs/ ausente (local-only) — nada a fazer')
  process.exit(0)
}
const rows = parseIndex()
const mode = process.argv[2]
if (mode === '--write') {
  writeFileSync(join(SPECS, 'STATUS_BOARD.md'), board(rows))
  console.log(`specs-board: STATUS_BOARD.md gerado (${rows.length} specs)`)
} else if (mode === '--check') {
  const { errors, warns } = check(rows)
  warns.forEach((w) => console.log(`aviso  ${w}`))
  errors.forEach((e) => console.log(`ERRO   ${e}`))
  console.log(`specs-board --check: ${rows.length} specs, ${errors.length} erro(s), ${warns.length} aviso(s)`)
  process.exit(errors.length ? 1 : 0)
} else {
  console.error('uso: specs-board.mjs --write | --check')
  process.exit(2)
}
