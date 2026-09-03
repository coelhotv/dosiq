#!/usr/bin/env node
/**
 * recount-memory.mjs — contador de recorrência das memórias DEVFLOW (spec 078, Slice 1).
 *
 * DERIVA `incident_count` e `last_referenced` dos traços que o repo já produz, em vez de confiar
 * no frontmatter (hoje: `incident_count` ausente em 454/598, `last_referenced` ausente ou `None`
 * em 564/608 — a `R-221` é citada 80x no journal e diz `incident_count: 0`).
 *
 * ⚠️ ESTE ARQUIVO NÃO ESCREVE — nenhuma chamada de escrita de arquivo existe aqui, e é de
 * propósito (o `grep` do guard do PO-4 procura exatamente por isso, então nem em comentário): a
 * propriedade central do Slice 1 é "não escreve", e como restrição ESTRUTURAL ela é verificável
 * por `grep`, não por confiança numa flag de runtime. A escrita de volta é o Slice 2, em
 * `migrate-memory-frontmatter.mjs --lifecycle`. Toda saída daqui vai para stdout.
 *
 * ⚠️ `git` é chamado por `execFileSync`, nunca pela shell: o wrapper `rtk` do ambiente TRUNCA
 * `git log` em 50 linhas e a contagem sairia de uma amostra, sem erro nenhum (AP-345).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RULE_ID_RE = /\b(?:R|AP)-(?:\d{3}|[A-Z]{1,3}\d{2,3})\b/g;
/** Nome de arquivo de memória: permissivo de propósito — o acervo tem IDs legados fora do padrão
 *  (`R-025-1`, `AP-SL01`, `AP-LOG-001`, `AP-97`) e ignorá-los subconta o acervo em silêncio. */
const MEMORY_FILE_RE = /^(?:R|AP)-[A-Za-z0-9-]+$/;
const MEMORY_ROOTS = ['rules', 'anti-patterns'];
const REVERT_RE = /\b(?:revert|reverte|revertido|rollback)\b/i;

/**
 * Cobertura em PROSA: o `CLAUDE.md` carrega o conteúdo destas regras sem citar o ID, então o
 * `grep` de cobertura as reporta como buracos sem que sejam. Não é derivável — a checagem é
 * semântica —, então vive declarada aqui, com a linha que a comprova. Rever quando o CLAUDE.md
 * mudar; entrada sem evidência de linha é o começo do drift.
 */
const PROSE_COVERED = new Map([
  ['R-010', 'CLAUDE.md:47 — "Ordem React (TDZ): States → Memos → Effects → Handlers"'],
  ['R-001', 'CLAUDE.md:82 — seção "Antes de modificar arquivo" (find duplicatas + grep de quem importa)'],
]);

/** Os 5 traços. `sessions/events.jsonl` entra declarado (C1.5 Gap-5) e aparece quebrado no relatório. */
const TRACES = [
  { id: 'journal', kind: 'jsonl-dir', dir: '.agent/memory/journal' },
  { id: 'events-memory', kind: 'jsonl', file: '.agent/memory/events.jsonl' },
  { id: 'events-sessions', kind: 'jsonl', file: '.agent/sessions/events.jsonl' },
  { id: 'measurement-034', kind: 'text', file: 'plans/specs/034-gemini-sunset/measurement.md' },
];

function parseArgs(argv) {
  const opts = {
    repo: process.cwd(),
    report: false,
    id: null,
    promoteCandidates: false,
    postBirthJson: false,
    k: 12,
    json: false,
    excludeTraces: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report') opts.report = true;
    else if (arg === '--id') opts.id = argv[++i];
    else if (arg === '--promote-candidates') opts.promoteCandidates = true;
    else if (arg === '--post-birth-json') opts.postBirthJson = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--exclude-trace') {
      // Permite reproduzir a visão de 4 traços da spec (o `sessions/events.jsonl` entrou no
      // Slice 1, C1.5 Gap-5) e medir o efeito da inclusão em vez de afirmá-lo.
      opts.excludeTraces.push(argv[++i]);
    }
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg === '--k') {
      opts.k = Number(argv[++i]);
      if (!Number.isInteger(opts.k) || opts.k < 1) throw new Error('--k exige inteiro >= 1');
    } else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`flag desconhecida: ${arg}`);
  }
  if (opts.id !== null && !opts.id) throw new Error('--id exige um ID (ex.: R-221)');
  return opts;
}

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
}

/**
 * Resolve cada memória pelo CAMINHO do arquivo, não pelo ID solto: `AP-341` já existiu em dois
 * diretórios ao mesmo tempo (AP-343), e ali o ID não identifica nada.
 */
function mapMemories(repo) {
  const byId = new Map();
  const collisions = [];
  for (const root of MEMORY_ROOTS) {
    const abs = path.join(repo, '.agent', 'memory', root);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const id = entry.name.slice(0, -3);
      if (!MEMORY_FILE_RE.test(id)) continue;
      const rel = path.join(path.relative(repo, entry.parentPath ?? entry.path), entry.name);
      if (byId.has(id)) collisions.push({ id, paths: [byId.get(id), rel] });
      byId.set(id, rel);
    }
  }
  return { byId, collisions };
}

function idsIn(text) {
  const found = String(text).match(RULE_ID_RE) ?? [];
  RULE_ID_RE.lastIndex = 0;
  return new Set(found);
}

/** Evidência = { trace, anchor, date, note }. A chave (trace, anchor) é o que dedupe (Gap-6). */
function gitEvidence(repo, birthByFile) {
  const raw = git(repo, ['log', '--no-merges', '--format=%H%x00%aI%x00%B%x1e']);
  const out = [];
  for (const rec of raw.split('\x1e')) {
    const trimmed = rec.replace(/^\n+/, '');
    if (!trimmed.trim()) continue;
    const [sha, date, body] = trimmed.split('\x00');
    const isRevert = REVERT_RE.test(body);
    for (const id of idsIn(body)) {
      out.push({ id, trace: 'git-log', anchor: sha, date, revert: isRevert, birth: (birthByFile.get(id) ?? new Set()).has(sha) });
    }
  }
  return out;
}

function birthMap(repo, memories) {
  const map = new Map();
  for (const [id, file] of memories) {
    const raw = git(repo, ['log', '--diff-filter=A', '--format=%H', '--', file]).trim();
    map.set(id, new Set(raw ? raw.split('\n') : []));
  }
  return map;
}

function jsonlEvidence(repo, traceId, relFile, problems) {
  const abs = path.join(repo, relFile);
  if (!fs.existsSync(abs)) {
    problems.push({ trace: traceId, kind: 'traco-ausente', file: relFile });
    return [];
  }
  const out = [];

  // O acervo de journal NÃO é uniformemente NDJSON: parte dos arquivos traz registros
  // JSON pretty-printed, um por vários blocos de linhas. Ancorar por LINHA daria a um registro
  // indentado dezenas de evidências e a um compacto uma só — o mesmo trabalho pontuando diferente
  // por causa do formatador. Então o leitor acumula linhas até fechar um valor JSON: um REGISTRO,
  // uma âncora, nos dois formatos.
  const lines = fs.readFileSync(abs, 'utf-8').split('\n');
  let buffer = '';
  let bufferStart = 0;
  let recordIndex = 0;
  lines.forEach((line, idx) => {
    if (!buffer && !line.trim()) return;
    if (!buffer) bufferStart = idx + 1;
    buffer += (buffer ? '\n' : '') + line;
    let rec;
    try {
      rec = JSON.parse(buffer);
    } catch {
      // Registro ainda aberto — OU registro corrompido (o acervo tem dois: `"tests":9_cases` e uma
      // string com quebra de linha crua). Sem recuperação, um registro que nunca fecha engole todo
      // o resto do arquivo num único bloco e a contagem despenca em silêncio. Heurística: uma nova
      // linha começando em `{` na coluna 0 abre outro registro ⇒ fecha o anterior como corrompido.
      const bufferedLines = buffer.split('\n').length;
      if (bufferedLines > 1 && /^\{/.test(line)) {
        const broken = buffer.slice(0, buffer.length - line.length - 1);
        problems.push({ trace: traceId, kind: 'registro-corrompido', file: relFile, line: bufferStart });
        for (const id of idsIn(broken)) {
          out.push({ id, trace: traceId, anchor: `${relFile}#quebrado-${bufferStart}`, date: null });
        }
        recordIndex += 1;
        buffer = line;
        bufferStart = idx + 1;
        try {
          rec = JSON.parse(buffer);
        } catch {
          return;
        }
      } else {
        return;
      }
    }
    const date = rec?.timestamp ?? rec?.date ?? null;
    for (const id of idsIn(buffer)) {
      out.push({ id, trace: traceId, anchor: `${relFile}#${recordIndex}`, date });
    }
    recordIndex += 1;
    buffer = '';
  });
  if (buffer.trim()) {
    // Resto que nunca fechou: CONTADO, nunca engolido — `catch {}` silencioso foi o finding do
    // RC5 do #817. As menções ainda entram, ancoradas no bloco, para não subcontar.
    problems.push({ trace: traceId, kind: 'registro-nao-fechado', file: relFile, line: bufferStart });
    for (const id of idsIn(buffer)) {
      out.push({ id, trace: traceId, anchor: `${relFile}#resto-${bufferStart}`, date: null });
    }
  }
  return out;
}

function textEvidence(repo, traceId, relFile, problems) {
  const abs = path.join(repo, relFile);
  if (!fs.existsSync(abs)) {
    problems.push({ trace: traceId, kind: 'traco-ausente', file: relFile });
    return [];
  }
  const out = [];
  fs.readFileSync(abs, 'utf-8')
    .split('\n')
    .forEach((line, idx) => {
      const date = /(\d{4}-\d{2}-\d{2})/.exec(line)?.[1] ?? null;
      for (const id of idsIn(line)) {
        out.push({ id, trace: traceId, anchor: `${relFile}:${idx + 1}`, date });
      }
    });
  return out;
}

export function recount(opts) {
  const { repo, excludeTraces = [] } = opts;
  const skip = new Set(excludeTraces);
  const { byId: memories, collisions } = mapMemories(repo);
  if (collisions.length > 0) {
    // ID resolvendo para 2 caminhos: parar, não escolher um (AP-343).
    throw new Error(
      `ID em mais de um diretório: ${collisions.map((c) => `${c.id} -> ${c.paths.join(' | ')}`).join('; ')}`,
    );
  }

  const problems = [];
  const evidence = skip.has('git-log') ? [] : [...gitEvidence(repo, birthMap(repo, memories))];
  for (const t of TRACES) {
    if (skip.has(t.id)) continue;
    if (t.kind === 'jsonl-dir') {
      const dir = path.join(repo, t.dir);
      if (!fs.existsSync(dir)) {
        problems.push({ trace: t.id, kind: 'traco-ausente', file: t.dir });
        continue;
      }
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
        evidence.push(...jsonlEvidence(repo, t.id, path.join(t.dir, f), problems));
      }
    } else if (t.kind === 'jsonl') {
      evidence.push(...jsonlEvidence(repo, t.id, t.file, problems));
    } else {
      evidence.push(...textEvidence(repo, t.id, t.file, problems));
    }
  }

  const rows = new Map();
  const rowFor = (id) => {
    if (!rows.has(id)) {
      rows.set(id, {
        id,
        file: memories.get(id) ?? null,
        orphan: !memories.has(id),
        count: 0,
        by_trace: {},
        birth_skipped: 0,
        reverts: 0,
        last_referenced: null,
        seen: new Set(),
      });
    }
    return rows.get(id);
  };
  for (const id of memories.keys()) rowFor(id); // memória sem evidência entra com 0, nunca omitida

  for (const e of evidence) {
    const row = rowFor(e.id);
    if (e.birth) {
      // Cunhar a regra não é aplicá-la: o commit que ADICIONA o arquivo não conta (Gap-7).
      row.birth_skipped += 1;
      continue;
    }
    const key = `${e.trace}::${e.anchor}`;
    if (row.seen.has(key)) continue;
    row.seen.add(key);
    row.count += 1;
    row.by_trace[e.trace] = (row.by_trace[e.trace] ?? 0) + 1;
    if (e.revert) row.reverts += 1; // recorrência, não obediência (T1.6)
    const day = e.date ? String(e.date).slice(0, 10) : null;
    if (day && (!row.last_referenced || day > row.last_referenced)) row.last_referenced = day;
  }

  const all = [...rows.values()].map(({ seen, ...r }) => r);
  // Desempate determinístico: sem isso a ordem muda entre runs e o guard do PO-5 vira ruído.
  all.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return { memories_on_disk: memories.size, rows: all, problems };
}

function claudeMdIds(repo) {
  const abs = path.join(repo, 'CLAUDE.md');
  const byId = fs.existsSync(abs) ? idsIn(fs.readFileSync(abs, 'utf-8')) : new Set();
  return { byId, byProse: new Set(PROSE_COVERED.keys()) };
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`erro: ${e.message}`);
    process.exit(2);
  }
  if (opts.help) {
    console.log(
      'uso: node scripts/recount-memory.mjs [--report] [--id <ID>] [--promote-candidates] [--post-birth-json] [--k N] [--json] [--repo <dir>]\n' +
        'LEITURA APENAS — nada é escrito em .agent/memory. Saída vai para stdout.',
    );
    return;
  }

  let result;
  try {
    result = recount(opts);
  } catch (e) {
    console.error(`erro: ${e.message}`);
    process.exit(1);
  }
  const { rows, problems, memories_on_disk: onDisk } = result;

  if (opts.postBirthJson) {
    const map = Object.fromEntries(rows.filter((r) => !r.orphan).map((r) => [r.id, r.count]));
    console.log(JSON.stringify(map, null, 0));
    return;
  }

  if (opts.id) {
    const row = rows.find((r) => r.id === opts.id);
    if (!row) {
      console.error(`erro: ${opts.id} não encontrado (nem em disco, nem em traço)`);
      process.exit(1);
    }
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify({ memories_on_disk: onDisk, rows, problems }, null, 2));
    return;
  }

  if (opts.promoteCandidates) {
    const { byId: coveredById, byProse } = claudeMdIds(opts.repo);
    const covered = new Set([...coveredById, ...byProse]);
    const topK = rows.filter((r) => !r.orphan).slice(0, opts.k);
    const threshold = topK.length ? topK[topK.length - 1].count : 0;
    const subir = topK.filter((r) => !covered.has(r.id));
    const descer = rows.filter((r) => covered.has(r.id) && !topK.some((t) => t.id === r.id));
    console.log(`top-K = ${opts.k} · limiar implicado = ${threshold} evidências`);
    console.log(`\nSUBIR (no top-${opts.k}, ausente do CLAUDE.md) — ${subir.length}:`);
    for (const r of subir) console.log(`  ${r.id.padEnd(8)} ${String(r.count).padStart(4)}  ${JSON.stringify(r.by_trace)}`);
    console.log(`\nJÁ COBERTAS (no top-${opts.k} e no CLAUDE.md) — ${topK.length - subir.length}:`);
    for (const r of topK.filter((r) => covered.has(r.id))) {
      const how = byProse.has(r.id) && !coveredById.has(r.id) ? `  [em prosa: ${PROSE_COVERED.get(r.id)}]` : '';
      console.log(`  ${r.id.padEnd(8)} ${String(r.count).padStart(4)}${how}`);
    }
    console.log(`\nDESCER (no CLAUDE.md, fora do top-${opts.k}) — ${descer.length}:`);
    for (const r of descer) console.log(`  ${r.id.padEnd(8)} ${String(r.count).padStart(4)}`);
    // Duas ressalvas que mudam a leitura da lista e não são detectáveis por código:
    const tied = rows.filter((r) => !r.orphan && r.count === threshold).length;
    if (tied > 1) {
      console.log(
        `\n⚠️ EMPATE NO CORTE: ${tied} memórias com exatamente ${threshold} evidências — o K=${opts.k} corta DENTRO do empate, então quem entra é decidido pelo desempate por ID, não pela recorrência.`,
      );
    }
    console.log(
      `⚠️ COBERTURA = ID citado no CLAUDE.md + ${byProse.size} declarada(s) EM PROSA (o CLAUDE.md carrega o conteúdo sem citar o ID). A parte em prosa não é derivável — está declarada em PROSE_COVERED, com a linha que a comprova, e envelhece se o CLAUDE.md mudar.`,
    );
    return;
  }

  // --report (default)
  const byTraceTotal = {};
  for (const r of rows) for (const [t, n] of Object.entries(r.by_trace)) byTraceTotal[t] = (byTraceTotal[t] ?? 0) + n;
  const orphans = rows.filter((r) => r.orphan);
  const zero = rows.filter((r) => !r.orphan && r.count === 0);
  console.log(`memórias em disco: ${onDisk}`);
  console.log(`linhas no relatório: ${rows.length} (inclui ${orphans.length} órfãs — ID em traço sem arquivo)`);
  console.log(`memórias sem nenhuma evidência: ${zero.length}`);
  console.log(`evidências por traço: ${JSON.stringify(byTraceTotal)}`);
  if (problems.length) {
    const kinds = problems.reduce((a, p) => ({ ...a, [p.kind]: (a[p.kind] ?? 0) + 1 }), {});
    console.log(`PARCIAL — problemas de traço: ${JSON.stringify(kinds)}`);
  }
  console.log('');
  console.log('ID        cont  reverts  nasc.  last_referenced  traços');
  for (const r of rows) {
    console.log(
      `${(r.orphan ? `${r.id}*` : r.id).padEnd(9)} ${String(r.count).padStart(4)}  ${String(r.reverts).padStart(7)}  ${String(r.birth_skipped).padStart(5)}  ${String(r.last_referenced ?? '-').padEnd(15)}  ${JSON.stringify(r.by_trace)}`,
    );
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
