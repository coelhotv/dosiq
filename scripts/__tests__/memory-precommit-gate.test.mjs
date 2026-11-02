/**
 * Gate de pre-commit da memória — spec 079, aditivo F2.
 *
 * ⚠️ Rodar com glob: `node --test scripts/__tests__/*.mjs`.
 *
 * Fixa a CLASSE do bug, não o sintoma do cutover: "existe um caminho em que commitar memória
 * inválida reprova". Os testes montam um repo git temporário no layout do moat (`agent/memory`,
 * sem o ponto) e rodam o gate sobre o índice staged — se o gate deixar de enxergar esse layout,
 * ou o `--check` voltar a aceitar inválida, eles ficam vermelhos.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { stagedMemoryFiles } from '../memory-precommit-gate.mjs';

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(scriptsDir, 'memory-precommit-gate.mjs');
const COMPILER = path.join(scriptsDir, 'compile-memory-index.mjs');

const VALIDA = `---
id: AP-902
title: "memoria de teste"
summary: "resumo curto"
category: data_and_schema
layer: warm
status: active
created_at: 2026-09-07
severity: high
keywords: [teste]
related:
  anti_patterns: []
  rules: []
applies_to:
  paths:
    - "scripts/**"
---

# corpo
`;

/** Repo git com `agent/memory/{rules,anti-patterns}/data_and_schema`. */
function repo(layout = 'agent/memory') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dosiq-079f2-'));
  const root = path.join(dir, layout);
  const mem = path.join(root, 'anti-patterns', 'data_and_schema');
  fs.mkdirSync(mem, { recursive: true });
  fs.mkdirSync(path.join(root, 'rules', 'data_and_schema'), { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: dir });
  return { dir, root, mem };
}

const compile = (root) => spawnSync(process.execPath, [COMPILER, '--root', root], { encoding: 'utf-8' });
const gate = (dir) => spawnSync(process.execPath, [GATE, '--repo', dir], { encoding: 'utf-8' });
const add = (dir) => spawnSync('git', ['add', '-A'], { cwd: dir });

test('layout do moat (agent/memory, sem ponto): memoria staged e enxergada', () => {
  const { dir, mem } = repo();
  fs.writeFileSync(path.join(mem, 'AP-902.md'), VALIDA);
  fs.writeFileSync(path.join(dir, 'README.md'), 'x');
  add(dir);
  assert.deepEqual(stagedMemoryFiles(dir), ['agent/memory/anti-patterns/data_and_schema/AP-902.md']);
});

test('memoria INVALIDA staged com indice em dia: gate reprova', () => {
  const { dir, root, mem } = repo();
  fs.writeFileSync(path.join(mem, 'AP-900.md'), '# sem frontmatter\n');
  compile(root); // frescor ok — isola a causa na validade
  add(dir);
  const res = gate(dir);
  assert.equal(res.status, 1, `esperava exit 1, veio ${res.status}: ${res.stdout}${res.stderr}`);
  assert.match(res.stderr, /frontmatter inválido/);
});

test('memoria valida com indice em dia: gate passa', () => {
  const { dir, root, mem } = repo();
  fs.writeFileSync(path.join(mem, 'AP-902.md'), VALIDA);
  compile(root);
  add(dir);
  const res = gate(dir);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /0 inválida\(s\)/);
});

test('memoria valida com indice VELHO: gate reprova (frescor segue valendo)', () => {
  const { dir, root, mem } = repo();
  fs.writeFileSync(path.join(mem, 'AP-902.md'), VALIDA);
  compile(root);
  fs.appendFileSync(path.join(mem, 'AP-902.md'), '\nmais\n');
  add(dir);
  assert.equal(gate(dir).status, 1);
});

test('commit sem memoria staged: gate passa sem rodar o --check', () => {
  const { dir } = repo();
  fs.writeFileSync(path.join(dir, 'README.md'), 'x');
  add(dir);
  const res = gate(dir);
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
});

test('indice compilado separa arquivadas de invalidas na meta', () => {
  const { root, mem } = repo();
  fs.writeFileSync(path.join(mem, 'AP-900.md'), '# sem frontmatter\n');
  fs.writeFileSync(path.join(mem, 'AP-902.md'), VALIDA.replace('status: active', 'status: archived'));
  compile(root);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'compiled_rules_index.json'), 'utf-8')).meta;
  assert.equal(meta.skippedCount, 2);
  assert.equal(meta.skippedArchived, 1);
  assert.equal(meta.skippedInvalid, 1);
});
