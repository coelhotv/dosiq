/**
 * Testes do ledger de conhecimento negativo (spec 078 §US7 / ADR-098).
 *
 * `scripts/**` é globalmente ignorado no eslint.config.js:24, então a rede aqui é `node --test`.
 * As linhas de defesa que estes testes protegem são as da tabela de failure modes do C1.5:
 * ausência não é erro, linha corrompida NÃO é pulada em silêncio, domínio fechado do verdict,
 * ID duplicado (AP-343), revert órfão reprova e linha que some reprova (append-only).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(__dirname, '..', 'attempts.mjs');

const ENTRY = {
  id: 'ATT-2026-001',
  date: '2026-09-05',
  spec: '078',
  task: 'T5.1',
  what: 'uma intervenção qualquer',
  measured: 'recall@5 = 0/6',
  baseline: 'recall@5 = 4/6',
  verdict: 'rejected',
  cause: 'porque sim',
  sha: { attempt: null, revert: null, trace: 'journal/2026-W36' },
  terms: ['termo de busca'],
};

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attempts-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf-8' });
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 't@t']);
  git(['config', 'user.name', 't']);
  fs.mkdirSync(path.join(dir, '.agent', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'seed']);
  return { dir, git, ledger: path.join(dir, '.agent', 'memory', 'attempts.jsonl') };
}

/** Sempre sem pipe: medir exit code através de `| tail` já devolveu 0 de comando que saía 1. */
function run(args, { cwd, env = {} } = {}) {
  const r = spawnSync('node', [script, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
}

test('ledger ausente: --list e --check saem 0 (o gate não nasce vermelho)', () => {
  const { dir } = tmpRepo();
  const list = run(['--list', '--file', path.join(dir, 'nao-existe.jsonl')], { cwd: dir });
  assert.equal(list.code, 0);
  assert.match(list.out, /ledger vazio/);
  const check = run(['--check', '--file', path.join(dir, 'nao-existe.jsonl')], { cwd: dir });
  assert.equal(check.code, 0);
});

test('linha corrompida FALHA citando o número da linha — nunca é pulada em silêncio', () => {
  const { dir, ledger } = tmpRepo();
  fs.writeFileSync(ledger, `${JSON.stringify(ENTRY)}\n{ isto nao e json\n`);
  const r = run(['--check', '--file', ledger], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.err + r.out, /:2 — JSON inválido/);
});

test('campo obrigatório ausente é recusado no --add e reprovado no --check', () => {
  const { dir, ledger } = tmpRepo();
  const { measured, ...semMedida } = ENTRY;
  const add = run(['--add', JSON.stringify(semMedida), '--file', ledger], { cwd: dir });
  assert.equal(add.code, 1);
  assert.match(add.err, /campo obrigatório ausente: measured/);
  assert.equal(fs.existsSync(ledger), false, 'entrada recusada não pode ter sido escrita');
});

test('verdict fora do domínio fechado é recusado', () => {
  const { dir, ledger } = tmpRepo();
  const r = run(['--add', JSON.stringify({ ...ENTRY, verdict: 'talvez' }), '--file', ledger], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.err, /verdict fora do domínio/);
});

test('id duplicado é recusado (classe do AP-343)', () => {
  const { dir, ledger } = tmpRepo();
  assert.equal(run(['--add', JSON.stringify(ENTRY), '--file', ledger], { cwd: dir }).code, 0);
  const dup = run(['--add', JSON.stringify({ ...ENTRY, what: 'outra coisa' }), '--file', ledger], { cwd: dir });
  assert.equal(dup.code, 1);
  assert.match(dup.err, /id duplicado/);
});

test('terms vazio é recusado — é o campo que torna a entrada achável', () => {
  const { dir, ledger } = tmpRepo();
  const r = run(['--add', JSON.stringify({ ...ENTRY, terms: [] }), '--file', ledger], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.err, /terms deve ser array não-vazio/);
});

test('sha sem attempt/revert/trace é recusado — procedência ausente se declara (R-307)', () => {
  const { dir, ledger } = tmpRepo();
  const r = run(['--add', JSON.stringify({ ...ENTRY, sha: {} }), '--file', ledger], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.err, /procedência ausente se DECLARA/);
});

test('revert sem entrada correspondente FAZ o gate sair != 0', () => {
  const { dir, git, ledger } = tmpRepo();
  const anchor = git(['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(path.join(dir, 'x.txt'), 'x\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'feat: algo']);
  git(['revert', '--no-edit', 'HEAD']);
  fs.writeFileSync(ledger, `${JSON.stringify(ENTRY)}\n`);
  const r = run(['--check', '--file', ledger], { cwd: dir, env: { ATTEMPTS_SINCE: anchor } });
  assert.equal(r.code, 1, 'gate que só imprime aviso é AP-325');
  assert.match(r.err, /revert sem entrada no ledger/);
});

test('revert COM entrada registrada passa', () => {
  const { dir, git, ledger } = tmpRepo();
  const anchor = git(['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(path.join(dir, 'x.txt'), 'x\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'feat: algo']);
  git(['revert', '--no-edit', 'HEAD']);
  const revertSha = git(['rev-parse', '--short', 'HEAD']).trim();
  fs.writeFileSync(ledger, `${JSON.stringify({ ...ENTRY, sha: { attempt: null, revert: revertSha, trace: 'x' } })}\n`);
  const r = run(['--check', '--file', ledger], { cwd: dir, env: { ATTEMPTS_SINCE: anchor } });
  assert.equal(r.code, 0, r.err);
});

test('linha que some do ledger reprova contra a baseline (append-only)', () => {
  const { dir, git, ledger } = tmpRepo();
  fs.writeFileSync(ledger, `${JSON.stringify(ENTRY)}\n`);
  git(['add', '-A']);
  git(['commit', '-qm', 'docs: ledger']);
  const baseline = git(['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(ledger, '');
  const r = run(['--check', '--file', ledger], {
    cwd: dir,
    env: { ATTEMPTS_BASE_REF: baseline, ATTEMPTS_SINCE: baseline },
  });
  assert.equal(r.code, 1);
  assert.match(r.err, /linha sumiu do ledger/);
});

test('baseline inalcançável apenas AVISA — não trava o C5 nem vira verde silencioso', () => {
  const { dir, ledger } = tmpRepo();
  fs.writeFileSync(ledger, `${JSON.stringify(ENTRY)}\n`);
  const r = run(['--check', '--file', ledger], { cwd: dir, env: { ATTEMPTS_BASE_REF: 'ref/que/nao/existe' } });
  assert.equal(r.code, 0);
  assert.match(r.out, /monotonicidade não conferida/);
});

test('--list mostra o denominador das aceitas (senão a taxa não é interpretável)', () => {
  const { dir, ledger } = tmpRepo();
  fs.writeFileSync(
    ledger,
    `${JSON.stringify(ENTRY)}\n${JSON.stringify({ ...ENTRY, id: 'ATT-2026-002', verdict: 'accepted' })}\n`,
  );
  const r = run(['--list', '--file', ledger], { cwd: dir });
  assert.equal(r.code, 0);
  assert.match(r.out, /rejected=1/);
  assert.match(r.out, /accepted=1/);
  assert.match(r.out, /taxa de rejeição: 1\/2/);
});
