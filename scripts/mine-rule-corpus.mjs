#!/usr/bin/env node
/**
 * mine-rule-corpus.mjs — minerador do corpus de avaliação da spec 078 (Slice 0).
 *
 * Emite pares `(commit, regra)` a partir das citações `R-NNN` / `AP-NNN` nas MENSAGENS de commit.
 * A unidade é o PAR, não o commit: um commit que cita 3 regras vale 3 linhas do corpus.
 *
 * Dois filtros de contaminação (FR-002 / FR-003):
 *   - `rule-birth`   — o commit que ADICIONA o arquivo da regra é autocitação, não evidência de uso.
 *   - `memory-only`  — commit cujo diff é 100% `.agent/memory/**` casa com o próprio texto da regra.
 *
 * ⚠️ `git` é chamado por `execFileSync`, nunca pela shell: o proxy `rtk` do ambiente TRUNCA
 * `git log` em 50 linhas e o corpus nasceria 20x menor, sem erro nenhum.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RULE_ID_RE = /\b(?:R|AP)-\d{3}\b/g;
const MEMORY_PREFIX = '.agent/memory/';
const REC_SEP = '\x1e';
const FIELD_SEP = '\x00';

const EXCLUSION_REASONS = ['rule-birth', 'memory-only-diff', 'empty-diff'];

function parseArgs(argv) {
  const opts = {
    repo: process.cwd(),
    out: null,
    explainExclusions: false,
    excludeBirth: true,
    minPairs: 30,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg === '--explain-exclusions') opts.explainExclusions = true;
    else if (arg === '--no-exclude-birth') opts.excludeBirth = false;
    else if (arg === '--min-pairs') {
      opts.minPairs = Number(argv[++i]);
      if (!Number.isInteger(opts.minPairs) || opts.minPairs < 0) {
        // NaN passaria pela comparação final e o piso viraria inerte (AP-325).
        throw new Error('--min-pairs exige inteiro >= 0');
      }
    }
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`flag desconhecida: ${arg}`);
  }
  if (opts.out === undefined || (opts.out !== null && !opts.out)) {
    throw new Error('--out exige um caminho');
  }
  return opts;
}

function git(repo, args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf-8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** Mapa ID -> caminho do arquivo da memória, resolvido pelo caminho ATUAL em disco (AP-343). */
function mapRuleFiles(repo) {
  const roots = [
    path.join('.agent', 'memory', 'rules'),
    path.join('.agent', 'memory', 'anti-patterns'),
  ];
  const byId = new Map();
  for (const rel of roots) {
    const abs = path.join(repo, rel);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const id = entry.name.slice(0, -3);
      if (!/^(?:R|AP)-\d{3}$/.test(id)) continue;
      const parentRel = path.relative(repo, entry.parentPath ?? entry.path);
      byId.set(id, path.join(parentRel, entry.name));
    }
  }
  return byId;
}

/** Todos os commits que ADICIONAM o arquivo — conjunto, não "o último" (ver analysis.md Gap-2). */
function birthCommits(repo, filePath) {
  const out = git(repo, ['log', '--diff-filter=A', '--format=%H', '--', filePath]).trim();
  return new Set(out ? out.split('\n') : []);
}

function readCommits(repo) {
  const raw = git(repo, [
    'log',
    '--no-merges',
    '-E',
    '--grep=R-[0-9]{3}|AP-[0-9]{3}',
    '--format=%H%x00%s%x00%aI%x00%B%x1e',
  ]);
  const commits = [];
  for (const rec of raw.split(REC_SEP)) {
    const trimmed = rec.replace(/^\n+/, '');
    if (!trimmed.trim()) continue;
    const [sha, subject, authoredAt, body] = trimmed.split(FIELD_SEP);
    commits.push({ sha, subject, authoredAt, body });
  }
  return commits;
}

function filesOf(repo, sha) {
  const out = git(repo, ['show', '--name-only', '--format=', sha]).trim();
  return out ? out.split('\n').filter(Boolean) : [];
}

/** Prefixo convencional do assunto (`feat`, `fix`, ...). String crua quando não convencional. */
function commitPrefix(subject) {
  const m = /^([A-Za-z]+)(?:\([^)]*\))?!?[:(\s]/.exec(subject);
  return m ? m[1].toLowerCase() : subject.split(/\s+/)[0] || 'sem-prefixo';
}

function prNumber(subject) {
  const m = /\(#(\d+)\)\s*$/.exec(subject);
  return m ? Number(m[1]) : null;
}

export function mine(opts) {
  const { repo, excludeBirth } = opts;
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const ruleFiles = mapRuleFiles(repo);
  const birthCache = new Map();
  const commits = readCommits(repo);

  const pairs = [];
  const excluded = [];
  const seen = new Set();

  for (const commit of commits) {
    const ids = [...new Set(String(commit.body).match(RULE_ID_RE) ?? [])].sort();
    if (ids.length === 0) continue;
    const files = filesOf(repo, commit.sha);
    const memoryOnly = files.length > 0 && files.every((f) => f.startsWith(MEMORY_PREFIX));
    const emptyDiff = files.length === 0;
    const pr = prNumber(commit.subject);
    const prefix = commitPrefix(commit.subject);

    for (const id of ids) {
      const ruleFile = ruleFiles.get(id) ?? null;
      let isBirth = false;
      if (ruleFile) {
        if (!birthCache.has(ruleFile)) birthCache.set(ruleFile, birthCommits(repo, ruleFile));
        isBirth = birthCache.get(ruleFile).has(commit.sha);
      }

      let reason = null;
      if (emptyDiff) reason = 'empty-diff';
      else if (memoryOnly) reason = 'memory-only-diff';
      else if (isBirth && excludeBirth) reason = 'rule-birth';

      const record = {
        rule: id,
        rule_file: ruleFile,
        commit_sha: commit.sha,
        pr,
        dedupe_key: pr === null ? commit.sha : `pr-${pr}`,
        commit_prefix: prefix,
        subject: commit.subject,
        authored_at: commit.authoredAt,
        files_total: files.length,
        files_memory: files.filter((f) => f.startsWith(MEMORY_PREFIX)).length,
        is_birth_commit: isBirth,
      };

      if (reason) {
        excluded.push({ ...record, reason });
        continue;
      }
      const key = `${id}::${record.dedupe_key}`;
      if (seen.has(key)) {
        excluded.push({ ...record, reason: 'duplicate-key' });
        continue;
      }
      seen.add(key);
      pairs.push(record);
    }
  }

  const exclusionCounts = Object.fromEntries(
    [...EXCLUSION_REASONS, 'duplicate-key'].map((r) => [r, excluded.filter((e) => e.reason === r).length]),
  );

  return {
    generated_at: new Date().toISOString(),
    head,
    repo_root: repo,
    inclusion_criteria: {
      source: 'citações R-NNN / AP-NNN na MENSAGEM do commit (assunto + corpo)',
      unit: 'par (commit, regra) — um commit que cita 3 regras vale 3 pares',
      dedupe: 'por (regra, PR) quando o assunto traz (#NNN); senão por (regra, sha) — 263 de 472 commits não têm PR',
      merges: 'excluídos (--no-merges): merge + squash contam o mesmo trabalho 2x',
      exclusions: {
        'rule-birth': 'commit que ADICIONA o arquivo da regra (autocitação). LIMITAÇÃO CONHECIDA: regras versionadas em massa pelo unignore 173b92f8 têm esse commit como "nascimento" e não como cunhagem — para elas o filtro não detecta nascimento real.',
        'memory-only-diff': 'commit cujo diff é 100% .agent/memory/** (o texto casa consigo mesmo)',
        'empty-diff': 'commit sem arquivo no diff',
        'duplicate-key': 'mesmo par (regra, dedupe_key) já contado',
      },
      exclude_birth_enabled: excludeBirth,
    },
    counts: {
      commits_scanned: commits.length,
      pairs: pairs.length,
      rules_distinct: new Set(pairs.map((p) => p.rule)).size,
      excluded: exclusionCounts,
      by_prefix: pairs.reduce((acc, p) => {
        acc[p.commit_prefix] = (acc[p.commit_prefix] ?? 0) + 1;
        return acc;
      }, {}),
    },
    pairs,
    excluded,
  };
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
      'uso: node scripts/mine-rule-corpus.mjs [--out <corpus.json>] [--explain-exclusions] [--no-exclude-birth] [--repo <dir>] [--min-pairs N]',
    );
    return;
  }

  const corpus = mine(opts);

  if (opts.explainExclusions) {
    for (const e of corpus.excluded) {
      console.log(`excluded: ${e.reason} ${e.rule} ${e.commit_sha.slice(0, 8)} ${e.subject}`);
    }
  }

  if (opts.out) {
    const dir = path.dirname(path.resolve(opts.repo, opts.out));
    if (!fs.existsSync(dir)) {
      console.error(`erro: diretório inexistente para --out: ${dir}`);
      process.exit(2);
    }
    fs.writeFileSync(path.resolve(opts.repo, opts.out), `${JSON.stringify(corpus, null, 2)}\n`, 'utf-8');
  }

  const { pairs, rules_distinct: rules, commits_scanned: scanned, excluded } = corpus.counts;
  console.error(
    `commits=${scanned} pares=${pairs} regras=${rules} excluidos=${JSON.stringify(excluded)}`,
  );

  // Corpus vazio/curto NÃO é sucesso: um harness que não pode reprovar é a família do AP-325.
  if (pairs < opts.minPairs) {
    console.error(`erro: corpus com ${pairs} pares, abaixo do mínimo ${opts.minPairs}`);
    process.exit(1);
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
