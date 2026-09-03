import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(__dirname, '..', 'mine-rule-corpus.mjs');

let repo;

function git(args, cwd = repo) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`git ${args.join(' ')} falhou: ${e.stderr ?? ''}${e.stdout ?? ''}`);
  }
}

function commit(subject, files = {}) {
  const empty = Object.keys(files).length === 0;
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
    git(['add', '--', rel]);
  }
  git(['commit', ...(empty ? ['--allow-empty'] : []), '-m', subject]);
}

function run(args) {
  try {
    const stdout = execFileSync('node', [script, '--repo', repo, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (e) {
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status ?? 1 };
  }
}

function mineJson(args = []) {
  const out = path.join(repo, 'corpus.json');
  run(['--out', 'corpus.json', '--min-pairs', '0', ...args]);
  return JSON.parse(fs.readFileSync(out, 'utf-8'));
}

before(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mine-corpus-'));
  git(['init', '-q', '-b', 'main'], repo);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'test']);

  // nascimento da regra: o commit que ADICIONA o arquivo (autocitação)
  // cunhagem junto com o fix que a originou: toca código, então NÃO cai no filtro memory-only —
  // é exatamente o caso que o filtro rule-birth existe para pegar.
  commit('fix(x): corrige e cunha R-100', {
    '.agent/memory/rules/process_and_testing/R-100.md': '# R-100\n',
    'src/z.js': 'z\n',
  });
  // uso legítimo, com PR no assunto
  commit('feat(x): aplica R-100 e AP-200 (#10)', { 'src/a.js': 'a\n' });
  // mesmo PR, outro commit — dedupe por (regra, PR)
  commit('feat(x): mais R-100 (#10)', { 'src/b.js': 'b\n' });
  // memory-only: o texto casa consigo mesmo
  commit('docs(mem): nota sobre R-100', {
    '.agent/memory/rules/process_and_testing/R-100.md': '# R-100\nmais\n',
  });
  // sem PR no assunto -> dedupe_key = sha
  commit('fix: corrige coisa citando R-100', { 'src/c.js': 'c\n' });
  // ID citado 2x + ID inexistente + assunto não convencional
  commit('R-999 e AP-200 AP-200 sem prefixo', { 'src/d.js': 'd\n' });
  // commit vazio
  commit('chore: vazio citando AP-200');
});

after(() => fs.rmSync(repo, { recursive: true, force: true }));

test('exclui o commit de nascimento da regra (rule-birth)', () => {
  const c = mineJson();
  assert.equal(c.counts.excluded['rule-birth'], 1);
  assert.equal(c.pairs.filter((p) => p.is_birth_commit).length, 0);
});

test('--no-exclude-birth produz estritamente mais pares (filtro não é inerte)', () => {
  const withFilter = mineJson().counts.pairs;
  const without = mineJson(['--no-exclude-birth']).counts.pairs;
  assert.ok(without > withFilter, `${without} deve ser > ${withFilter}`);
});

test('exclui commit cujo diff é 100% .agent/memory/**', () => {
  const c = mineJson();
  assert.ok(c.counts.excluded['memory-only-diff'] >= 1);
  assert.equal(
    c.pairs.filter((p) => p.files_total > 0 && p.files_memory === p.files_total).length,
    0,
  );
});

test('commit vazio é excluído como empty-diff, não como memory-only', () => {
  const c = mineJson();
  assert.equal(c.counts.excluded['empty-diff'], 1);
});

test('dedupe por (regra, PR) quando há (#NNN); por sha quando não há', () => {
  const c = mineJson();
  const r100 = c.pairs.filter((p) => p.rule === 'R-100');
  assert.equal(r100.filter((p) => p.pr === 10).length, 1, 'dois commits do PR #10 valem 1 par');
  assert.equal(c.counts.excluded['duplicate-key'], 1);
  const semPr = r100.find((p) => p.pr === null);
  assert.ok(semPr && semPr.dedupe_key === semPr.commit_sha);
});

test('ID citado 2x na mesma mensagem vale 1 par; ID inexistente entra com rule_file null', () => {
  const c = mineJson();
  const semPrefixo = c.pairs.filter((p) => p.subject.startsWith('R-999'));
  assert.equal(semPrefixo.filter((p) => p.rule === 'AP-200').length, 1);
  const r999 = c.pairs.find((p) => p.rule === 'R-999');
  assert.ok(r999);
  assert.equal(r999.rule_file, null);
});

test('commit_prefix nunca é null e cai na string crua quando não convencional', () => {
  const c = mineJson();
  for (const p of c.pairs) assert.ok(p.commit_prefix && typeof p.commit_prefix === 'string');
  assert.ok(c.pairs.some((p) => p.commit_prefix === 'R-999'));
  assert.ok(c.pairs.some((p) => p.commit_prefix === 'feat'));
});

test('corpus abaixo do mínimo sai com exit != 0 (harness pode reprovar)', () => {
  const r = run(['--min-pairs', '9999']);
  assert.equal(r.status, 1);
});

test('--out para diretório inexistente falha explicitamente', () => {
  const r = run(['--out', 'nao/existe/corpus.json', '--min-pairs', '0']);
  assert.equal(r.status, 2);
});

test('corpus grava HEAD e inclusion_criteria (reprodutibilidade)', () => {
  const c = mineJson();
  assert.match(c.head, /^[0-9a-f]{40}$/);
  assert.ok(c.inclusion_criteria.source);
  assert.equal(c.inclusion_criteria.exclude_birth_enabled, true);
});

test('--explain-exclusions imprime uma linha por exclusão', () => {
  const r = run(['--explain-exclusions', '--min-pairs', '0']);
  assert.ok(/excluded: rule-birth /.test(r.stdout));
  assert.ok(/excluded: memory-only-diff /.test(r.stdout));
});
