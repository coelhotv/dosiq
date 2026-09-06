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
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectRules } from './select-rules.mjs';

/**
 * Casa TODAS as formas de ID que o acervo usa, inclusive as legadas — `R-025-1`, `AP-97`,
 * `AP-LOG-001`, `AP-SL01`, `AP-H04`. Um padrão de citação mais estreito que o de arquivo
 * (`MEMORY_FILE_RE`) deixa a memória legada presa em 0 para sempre E credita as citações de
 * `R-025-1` ao `R-025`, porque o `\b` casa antes do `-1`: contagem errada num contador.
 * Achado do RC6 no PR #819.
 */
const RULE_ID_RE = /\b(?:R|AP)-(?:[A-Z]{1,3}-?)?\d{2,3}(?:-\d+)?\b/g;
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
    findSimilar: null,
    threshold: null,
    skillsLayer: false,
    diffAgainst: null,
    estimateBytes: false,
    severityCandidates: false,
    measureLog: null,
    pr: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report') opts.report = true;
    else if (arg === '--skills-layer') opts.skillsLayer = true;
    else if (arg === '--diff-against') opts.diffAgainst = argv[++i];
    else if (arg === '--estimate-bytes') opts.estimateBytes = true;
    else if (arg === '--severity-candidates') opts.severityCandidates = true;
    else if (arg === '--measure-log') opts.measureLog = argv[++i];
    else if (arg === '--pr') opts.pr = argv[++i];
    else if (arg === '--threshold') {
      // FR-008: este caminho existe SÓ para ser REJEITADO. Sem ele não há o que reprovar e o guard
      // da PO-9 não pode falhar — guard que não pode reprovar é AP-325. A rejeição é resolvida no
      // `main`, DEPOIS do recount, para que o custo do limiar seja MEDIDO na hora e não citado de
      // memória (medido 2026-09-04: 311/611; a spec dizia 334/55% — o número anda, R-320).
      opts.threshold = Number(argv[++i]);
      if (!Number.isInteger(opts.threshold)) throw new Error('--threshold exige um inteiro');
    }
    else if (arg === '--id') opts.id = argv[++i];
    else if (arg === '--promote-candidates') opts.promoteCandidates = true;
    else if (arg === '--post-birth-json') opts.postBirthJson = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--find-similar') opts.findSimilar = argv[++i];
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
  // Toda flag que consome o próximo argumento precisa reclamar quando ele não vem: sem isto o
  // `undefined` só explode lá adiante, num `path.join`, com mensagem que não diz o que faltou.
  for (const [flag, val] of [['--diff-against', opts.diffAgainst], ['--measure-log', opts.measureLog], ['--pr', opts.pr]]) {
    if (val !== null && !val) throw new Error(`${flag} exige um valor`);
  }
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


/**
 * Busca por CLASSE de padrão, para o C5 cumprir a PO-8 sem depender de boa vontade: antes de
 * cunhar AP novo, `--find-similar "<descrição do bug>"` devolve os candidatos mais próximos.
 *
 * Reusa o índice compilado da 060 e o `selectRules` do seletor — nada de terceiro matcher (F2).
 * O seletor pontua diff (path/trigger/keyword) e a keyword é BINÁRIA, então sozinho devolve
 * pouco para texto livre; a sobreposição de termos sobre título+resumo entra como desempate,
 * não como índice novo.
 */
function tokenize(query) {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 4))];
}

function findSimilar(repo, query, limit) {
  const indexPath = path.join(repo, '.agent', 'memory', 'compiled_rules_index.json');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`índice compilado ausente (${indexPath}) — rode compile-memory-index.mjs`);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const terms = tokenize(query);
  if (terms.length === 0) throw new Error('--find-similar exige ao menos um termo com 4+ caracteres');

  const bySelector = new Map(
    selectRules(index, { changedPaths: [], addedLines: [query], changedDomains: new Set() }, 1000).map(
      (r) => [r.id, r.score],
    ),
  );

  const scored = [];
  for (const [id, rule] of Object.entries(index.rules)) {
    const haystack = `${rule.title ?? ''} ${rule.summary ?? ''} ${(rule.keywords ?? []).join(' ')}`.toLowerCase();
    const hits = terms.filter((t) => haystack.includes(t));
    const overlap = hits.length;
    const selector = bySelector.get(id) ?? 0;
    const score = overlap * 10 + selector;
    if (score > 0) scored.push({ id, score, overlap, selector, hits, title: rule.title, domain: rule.domain });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.slice(0, limit);
}

/**
 * SEGUNDA FONTE da busca do C5: o ledger de conhecimento negativo (`attempts.jsonl`, ADR-098).
 *
 * Lido DIRETO do arquivo, de propósito. Estender o `compiled_rules_index.json` para cobri-lo
 * alcançaria esta busca ao preço de inflar o preâmbulo do RC6 — `select-rules.mjs:345` lê o MESMO
 * índice —, que é exatamente o custo que a spec 078 existe para atacar. Aqui o alcance custa zero
 * no revisor: quem lê o ledger é só o C5.
 *
 * Sem isto a busca é cega para o que NÃO deu certo por construção, e a próxima sessão reimplementa
 * a intervenção rejeitada com outro nome (spec 078 §US7, buraco 3).
 */
function findSimilarAttempts(repo, terms, limit) {
  const file = path.join(repo, '.agent', 'memory', 'attempts.jsonl');
  if (!fs.existsSync(file)) return [];
  const scored = [];
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue; // integridade é assunto do `attempts.mjs --check`; a busca não é o lugar de falhar
    }
    // `terms` entra junto com what/cause porque é o campo escrito DE PROPÓSITO para ser achado.
    const haystack = `${e.what ?? ''} ${e.cause ?? ''} ${(e.terms ?? []).join(' ')}`.toLowerCase();
    const hits = terms.filter((t) => haystack.includes(t));
    // Um termo genérico sozinho ("regras") casa com quase toda entrada e transforma o aviso em
    // ruído — e aviso ruidoso é aviso ignorado. Com consulta de 3+ termos, exige 2 casamentos.
    const minHits = terms.length >= 3 ? 2 : 1;
    if (hits.length < minHits) continue;
    scored.push({
      id: e.id,
      score: hits.length * 10,
      hits,
      verdict: e.verdict,
      what: e.what,
      origin: `${e.spec ?? '?'}${e.task ? `/${e.task}` : ''}`,
      measured: e.measured,
    });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.slice(0, limit);
}

/**
 * O CÁLCULO da Skills Layer, num lugar só. O `--promote-candidates` (PR #819), o `--skills-layer`
 * e o `--diff-against` são três SAÍDAS deste mesmo resultado — não três rankings (F2 do RC3).
 */
function skillsLayer(rows, k, repo) {
  const { byId: coveredById, byProse } = claudeMdIds(repo);
  const covered = new Set([...coveredById, ...byProse]);
  const ranked = rows.filter((r) => !r.orphan);
  const topK = ranked.slice(0, k);
  const threshold = topK.length ? topK[topK.length - 1].count : 0;
  const subir = topK.filter((r) => !covered.has(r.id));
  const descer = ranked.filter((r) => covered.has(r.id) && !topK.some((t) => t.id === r.id));
  const tied = ranked.filter((r) => r.count === threshold).length;
  return { topK, subir, descer, threshold, tied, covered, coveredById, byProse };
}

/**
 * Critérios OBJETIVOS de severidade (PO-10) — a 2ª porta de entrada, para o bug que aconteceu
 * UMA vez e ainda assim tem de ser sabido. São casados contra o TEXTO do registro, e a
 * justificativa é a linha casada: candidato sem linha citável não entra (o script reprova).
 * Julgamento ("isso é grave") não é critério — é o que esta lista existe para substituir.
 */
const SEVERITY_CRITERIA = [
  { id: 'producao', re: /\b(em prod(?:u[çc][ãa]o)?|outage|incidente em prod|P0)\b/i },
  { id: 'cross_plataforma', re: null }, // computado abaixo (exige 2+ plataformas distintas)
  // ⚠️ O acervo escreve "passou pelos gates" de PELO MENOS três formas: prosa no passado
  // ("atravessou tsc, lint, 2068 testes"), prosa no presente ("tsc, lint e teste passam todos") e
  // TABELA com ✅ (`| tsc / strict islands | ✅ |`). Reconhecer só a primeira deixava o AP-300 —
  // o caso canônico desta PO — fora do `high` por FORMATAÇÃO do registro, não por mérito.
  {
    id: 'gates_passaram',
    re: /(tsc|lint|testes?|jest|vitest|RC5|RC6|revis[ãa]o)[^.\n]{0,80}(passou|passaram|passam|passa\b|verde|aprov|atravessou|✅)|atravessou[^.\n]{0,80}(tsc|testes?|gates?)|nenhum gate[^.\n]{0,20}(pegou|pega|existia)/i,
  },
];
const PLATFORM_RE = /\b(web|pwa|mobile|android|ios|cron|bot|telegram|api|serverless)\b/gi;

function severityCandidates(rows, k, repo) {
  const topIds = new Set(rows.filter((r) => !r.orphan).slice(0, k).map((r) => r.id));
  const out = [];
  for (const r of rows) {
    if (r.orphan || !r.file) continue;
    const abs = path.join(repo, r.file);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf-8');
    const matched = [];
    for (const c of SEVERITY_CRITERIA) {
      if (c.id === 'cross_plataforma') {
        const plats = new Set([...text.matchAll(PLATFORM_RE)].map((m) => m[0].toLowerCase()));
        if (plats.size >= 2) matched.push({ id: c.id, evidence: `plataformas citadas: ${[...plats].sort().join('+')}` });
        continue;
      }
      const m = text.match(c.re);
      if (m) matched.push({ id: c.id, evidence: m[0].replace(/\s+/g, ' ').slice(0, 90) });
    }
    if (matched.length === 0) continue;
    const severity = matched.length === 3 ? 'high' : matched.length === 2 ? 'medium' : 'low';
    out.push({ id: r.id, count: r.count, in_top_k: topIds.has(r.id), severity, matched });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.count - b.count || a.id.localeCompare(b.id));
  return out;
}

/**
 * Projeção de bytes (PO-13). O budget do RC6 NÃO é constante: `CHUNK_BUDGET = CTX_TOTAL_MAX -
 * preâmbulo - 8000`, com piso de 30.000 (`ai-review.sh:428-429`), e o preâmbulo depende do
 * `RC6_IDX_LINE_MAX`. Por isso a conta NÃO é reimplementada aqui: o `ai-review.sh` é EXECUTADO em
 * `RC6_MEASURE=1` (modo que monta tudo, imprime a contabilidade e SAI antes de chamar motor) e a
 * projeção lê o número que ele mesmo calculou. Número copiado à mão é o que esta função existe
 * para não fazer.
 */
function measureBudget({ pr, clamps, measureLog, repo }) {
  const parse = (log) => {
    // \s+ e não ' ': o ai-review.sh ALINHA os números (`preamble   110798B`). Com espaço único o
    // parse falha em TODO log real e só passa no fixture — o fixture herda a premissa de quem o
    // escreveu (é a família do AP-346). Reproduzido aqui com o padding do log de verdade.
    const m = log.match(/preamble\s+(\d+)B · chunk budget\s+(\d+)B/);
    if (!m) return null;
    return { preamble: Number(m[1]), budget: Number(m[2]) };
  };
  if (measureLog) {
    const parsed = parse(fs.readFileSync(measureLog, 'utf-8'));
    if (!parsed) throw new Error(`--measure-log sem a linha "preamble …B · chunk budget …B": ${measureLog}`);
    return [{ clamp: 'log', ...parsed, source: measureLog }];
  }
  if (!pr) throw new Error('--estimate-bytes exige --pr <N> (roda o ai-review.sh em RC6_MEASURE=1) ou --measure-log <arquivo>');
  const script = path.join(process.env.HOME ?? '', 'SKILLS', 'devflow', 'scripts', 'ai-review.sh');
  if (!fs.existsSync(script)) throw new Error(`ai-review.sh não encontrado em ${script}`);
  return clamps.map((clamp) => {
    // spawnSync e stdout+stderr CONCATENADOS: o `log()` do ai-review.sh escreve em STDERR, e a
    // contabilidade do MEASURE sai por lá. Ler só o stdout devolveria vazio e a projeção morreria
    // com "não imprimiu a contabilidade" — falha barulhenta, mas pelo motivo errado.
    const r = spawnSync('bash', [script, String(pr)], {
      cwd: repo,
      encoding: 'utf-8',
      env: { ...process.env, RC6_MEASURE: '1', RC6_IDX_LINE_MAX: String(clamp) },
      maxBuffer: 64 * 1024 * 1024,
    });
    const parsed = parse(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
    if (!parsed) throw new Error(`RC6_MEASURE não imprimiu a contabilidade para clamp=${clamp}`);
    return { clamp, ...parsed, source: `ai-review.sh RC6_MEASURE=1 RC6_IDX_LINE_MAX=${clamp} PR ${pr}` };
  });
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

  if (opts.findSimilar) {
    let hits;
    let attempts;
    try {
      hits = findSimilar(opts.repo, opts.findSimilar, 5);
      // 2ª fonte, lida DIRETO do ledger (ADR-098 emenda 1): alcance no C5, custo zero no RC6.
      attempts = findSimilarAttempts(opts.repo, tokenize(opts.findSimilar), 5);
    } catch (e) {
      console.error(`erro: ${e.message}`);
      process.exit(1);
    }
    if (attempts.length > 0) {
      // Vem PRIMEIRO de propósito: reimplementar algo já medido e revertido é mais caro que
      // duplicar um AP — o custo é a medição inteira de novo (spec 078 §US7).
      console.log(`⛔ JÁ TENTADO E MEDIDO — ${attempts.length} intervenção(ões) no ledger:`);
      for (const a of attempts) {
        console.log(`  ${a.id}  [${a.verdict}]  ${a.origin} — ${a.what}`);
        console.log(`     medido: ${a.measured}   (termos: ${a.hits.join(', ')})`);
      }
      console.log('  → leia a causa com: node scripts/attempts.mjs --list\n');
    }
    if (hits.length === 0) {
      console.log(
        'nenhum candidato PELOS TERMOS usados — varie os termos antes de concluir. Ausência aqui NÃO prova classe nova (a busca é por termo, não semântica).',
      );
      return;
    }
    console.log(`candidatos para "${opts.findSimilar}" (incrementar > cunhar):`);
    for (const h of hits) {
      console.log(`  ${h.id.padEnd(9)} score=${String(h.score).padStart(3)} (termos: ${h.hits.join(', ') || '-'}${h.selector ? `, seletor=${h.selector}` : ''})  ${h.domain} — ${h.title ?? ''}`);
    }
    console.log(
      '\n⚠️ A busca é por TERMO sobre título/resumo/keywords, não semântica: casa sinônimo literal, não paráfrase.' +
        '\n   Medido: "gate reporta sucesso sem executar comando" NÃO devolve AP-325/AP-261, que são dessa classe.' +
        '\n   Logo NÃO CASAR AQUI NÃO PROVA CLASSE NOVA — é primeira passada, não veredicto. Varie os termos antes de cunhar.',
    );
    console.log('registre no journal a classe consultada, os termos usados e o resultado (casou <ID> / não casou) — PO-8');
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

  if (opts.threshold !== null) {
    const ranked = rows.filter((r) => !r.orphan);
    const promovidas = ranked.filter((r) => r.count >= opts.threshold).length;
    console.error(
      `erro: --threshold ${opts.threshold} REJEITADO por construção (FR-008). Limiar absoluto é PISO e o ` +
        `acervo cresce por baixo dele: medido AGORA, >=${opts.threshold} promoveria ${promovidas} de ${ranked.length} memórias ` +
        `(${((100 * promovidas) / ranked.length).toFixed(0)}% do acervo), e o CLAUDE.md volta a crescer monotonicamente — que é o problema.\n` +
        '       A Skills Layer tem TETO DURO: use --skills-layer --k N. O limiar sai como OBSERVAÇÃO do corte, nunca como critério.',
    );
    process.exit(2);
  }

  if (opts.severityCandidates) {
    const cands = severityCandidates(rows, opts.k, opts.repo);
    const high = cands.filter((c) => c.severity === 'high');
    console.log(`candidatos por SEVERIDADE (2a porta) — ${cands.length} com ao menos 1 criterio objetivo; ${high.length} high`);
    console.log('criterios: producao · cross_plataforma (2+) · gates_passaram — a justificativa e a LINHA casada no proprio registro\n');
    for (const c of high) {
      console.log(`  ${c.id.padEnd(8)} severity=${c.severity} contador=${String(c.count).padStart(4)} ${c.in_top_k ? '(ja no top-K)' : 'FORA do top-K'}`);
      for (const m of c.matched) console.log(`      ${m.id.padEnd(17)} :: ${m.evidence}`);
    }
    const semJustificativa = cands.filter((c) => c.matched.some((m) => !m.evidence || !m.evidence.trim()));
    if (semJustificativa.length) {
      console.error(`\nerro: ${semJustificativa.length} candidato(s) com criterio casado e justificativa VAZIA — severidade sem linha citavel e julgamento, nao criterio`);
      process.exit(3);
    }
    console.log(`\n⚠️ severidade ENTRA memoria, nao REORDENA o ranking: ${high.length} high, dos quais ${high.filter((c) => !c.in_top_k).length} estao fora do top-${opts.k} por recorrencia.`);
    return;
  }

  if (opts.estimateBytes) {
    const claudeMd = path.join(opts.repo, 'CLAUDE.md');
    const atual = fs.statSync(claudeMd).size;
    const { subir } = skillsLayer(rows, opts.k, opts.repo);
    // Custo de cada regra promovida = a linha do indice que a descreve (e o que entra no CLAUDE.md).
    const { byId: memories } = mapMemories(opts.repo);
    let novos = 0;
    for (const r of subir) {
      const abs = memories.get(r.id) ? path.join(opts.repo, memories.get(r.id)) : null;
      if (!abs || !fs.existsSync(abs)) continue;
      const fm = fs.readFileSync(abs, 'utf-8').split('\n---')[0];
      const sm = fm.match(/^summary: *(?:>-|\|-)?\s*([\s\S]*?)(?=\n[a-z_]+:)/m);
      novos += Buffer.byteLength(`- **[${r.id}]** ${(sm?.[1] ?? r.id).replace(/\s+/g, ' ').trim()}\n`, 'utf-8');
    }
    let medidas;
    try {
      medidas = measureBudget({ pr: opts.pr, clamps: [110, 55], measureLog: opts.measureLog, repo: opts.repo });
    } catch (e) {
      console.error(`erro: ${e.message}`);
      process.exit(1);
    }
    console.log(`CLAUDE.md atual = ${atual}B · projecao com ${subir.length} regra(s) promovida(s) = ${atual + novos}B (+${novos}B)`);
    console.log('budget MEDIDO pelo proprio ai-review.sh (RC6_MEASURE=1), nao copiado a mao:\n');
    for (const m of medidas) {
      const folga = ((1 - (atual + novos) / m.budget) * 100).toFixed(1);
      console.log(
        `  clamp=${String(m.clamp).padStart(4)}  preambulo=${String(m.preamble).padStart(7)}B  chunk budget=${String(m.budget).padStart(7)}B  ` +
          `projecao/budget=${(((atual + novos) / m.budget) * 100).toFixed(1)}%  folga=${folga}%  ${m.budget === 30000 ? '⚠️ budget NO PISO' : ''}`,
      );
    }
    console.log('\n⚠️ O alvo varia por CONFIGURACAO DO REVISOR (RC6_IDX_LINE_MAX), nao por constante: o mesmo CLAUDE.md cabe ou nao conforme o clamp.');
    return;
  }

  if (opts.promoteCandidates || opts.skillsLayer || opts.diffAgainst) {
    const { topK, subir, descer, threshold, tied, covered, coveredById, byProse } = skillsLayer(rows, opts.k, opts.repo);
    if (opts.skillsLayer && !opts.diffAgainst) {
      // Saida PURA: os K IDs. O limiar sai como OBSERVACAO com HEAD+data — travar o valor faz a
      // PO falhar por passagem de tempo, nao por defeito (R-320).
      const head = git(opts.repo, ['rev-parse', '--short', 'HEAD']).trim();
      for (const r of topK) console.log(r.id);
      console.error(
        `# skills layer = top-${opts.k} por recorrencia · limiar IMPLICADO pelo corte = ${threshold} evidencias ` +
          `(observacao em ${new Date().toISOString().slice(0, 10)}, HEAD ${head}) — MOVEL por construcao, nunca criterio de aceite`,
      );
      return;
    }
    if (opts.diffAgainst) {
      // O arquivo é LIDO, nunca escrito: promoção e demoção saem do mesmo relatório e quem edita
      // o CLAUDE.md é gente (guard da PO-12 = `git status --porcelain CLAUDE.md` vazio).
      const target = path.join(opts.repo, opts.diffAgainst);
      if (!fs.existsSync(target)) {
        console.error(`erro: --diff-against ${opts.diffAgainst} não existe`);
        process.exit(1);
      }
      console.log(`diff contra ${opts.diffAgainst} (LEITURA — o arquivo não é modificado)`);
    }
    console.log(`top-K = ${opts.k} · limiar implicado = ${threshold} evidências (OBSERVAÇÃO do corte, não critério — móvel por construção)`);
    console.log(`soma SUBIR(${subir.length}) + JÁ COBERTAS(${topK.length - subir.length}) = ${topK.length} = K (a lista tem tamanho fixo: promover exige demover)`);
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
