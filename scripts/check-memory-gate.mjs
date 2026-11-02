#!/usr/bin/env node
/**
 * Gate de SESSÃO da memória — spec 079, aditivo F2-c/F2-d. Roda no `validate:agent`.
 *
 * O hook de pre-commit barra o commit; este barra a sessão. Existe porque a PO-3 da 079 foi provada
 * com rigor e morreu em 3 dias quando a topologia mudou (cutover do moat): a prova de um gate vale
 * até a topologia mudar. Por isso este script não confere CONFIG — confere EFEITO:
 *
 *   1. acervo válido      — validate-memory-schema --strict (exit 0)
 *   2. índice em dia      — compile-memory-index --check (frescor + 0 inválidas, F2-a)
 *   3. hook no disco      — repo REAL de `.agent` (realpath) tem core.hooksPath com pre-commit
 *                           executável que chama memory-precommit-gate.mjs
 *   4. sonda da classe    — commit de memória inválida num repo temporário, com ESSE hook instalado,
 *                           tem de REPROVAR; e o de memória válida, passar (F2-d)
 *
 * Sem `.agent` (CI, clone sem o moat) não há memória a proteger: imprime SKIP com o motivo e sai 0.
 * Fora de CI a ausência reprova — memória sumida em máquina de dev é defeito, não ambiente.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const agentLink = path.join(repoRoot, '.agent');

let failed = 0;
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed++;
}
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf-8', ...opts });
}

const VALID_MEMORY = `---
id: AP-901
title: "sonda do gate 079"
summary: "memória válida usada só pela sonda"
category: process_and_testing
layer: warm
status: active
created_at: 2026-11-02
severity: low
keywords: [sonda]
related:
  anti_patterns: []
  rules: []
applies_to:
  paths:
    - "scripts/**"
---

# sonda
`;

/** Repo temporário com layout do moat (agent/memory) e o hook REAL instalado via core.hooksPath. */
function probe(hooksDir) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dosiq-079-probe-'));
  const mem = path.join(dir, 'agent', 'memory', 'anti-patterns', 'process_and_testing');
  fs.mkdirSync(mem, { recursive: true });
  fs.mkdirSync(path.join(dir, 'agent', 'memory', 'rules', 'process_and_testing'), { recursive: true });
  const env = { ...process.env, DOSIQ_REPO: repoRoot, GIT_AUTHOR_NAME: 'sonda', GIT_AUTHOR_EMAIL: 's@x', GIT_COMMITTER_NAME: 'sonda', GIT_COMMITTER_EMAIL: 's@x' };
  const git = (...args) => run('git', args, { cwd: dir, env });
  git('init', '-q');
  git('config', 'core.hooksPath', hooksDir);

  try {
    // Inválida: sem frontmatter. Compila o índice antes para isolar a causa (frescor ok, validade não).
    fs.writeFileSync(path.join(mem, 'AP-900.md'), '# sem frontmatter\n');
    run(process.execPath, [path.join(__dirname, 'compile-memory-index.mjs'), '--root', path.join(dir, 'agent', 'memory')]);
    git('add', '-A');
    const bad = git('commit', '-q', '-m', 'sonda inválida');
    // Reprovar não basta: tem de reprovar PELA INVALIDEZ. Hook que não acha o gate também sai 1, e
    // a sonda passaria pelo motivo errado.
    if (bad.status === 0) fail('sonda: commit de memória INVÁLIDA passou — o caminho que reprova sumiu');
    else if (!bad.stderr.includes('frontmatter inválido')) fail(`sonda: reprovou pelo motivo errado:\n${bad.stderr}`);
    else ok('sonda: commit de memória inválida reprovado pelo hook (frontmatter inválido)');

    fs.rmSync(path.join(mem, 'AP-900.md'));
    fs.writeFileSync(path.join(mem, 'AP-901.md'), VALID_MEMORY);
    run(process.execPath, [path.join(__dirname, 'compile-memory-index.mjs'), '--root', path.join(dir, 'agent', 'memory')]);
    git('add', '-A');
    const good = git('commit', '-q', '-m', 'sonda válida');
    if (good.status !== 0) fail(`sonda: commit de memória VÁLIDA reprovou — gate ruidoso:\n${good.stderr}`);
    else ok('sonda: commit de memória válida passou');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  console.log('gate de memória (079 F2):');

  if (!fs.existsSync(agentLink)) {
    if (process.env.CI) {
      console.log('  SKIP: .agent ausente em CI — não há memória a proteger neste ambiente.');
      return;
    }
    fail(`.agent não existe em ${repoRoot} (fora de CI) — memória sumida é defeito, não ambiente`);
    process.exitCode = 1;
    return;
  }

  const schema = run(process.execPath, [path.join(__dirname, 'validate-memory-schema.mjs'), '--strict', '--summary']);
  if (schema.status === 0) ok('acervo válido (validate-memory-schema --strict)');
  else fail(`validate-memory-schema --strict reprovou:\n${schema.stdout.split('\n').slice(-14).join('\n')}`);

  const check = run(process.execPath, [path.join(__dirname, 'compile-memory-index.mjs'), '--check']);
  if (check.status === 0) ok(check.stdout.trim());
  else fail(`compile-memory-index --check reprovou:\n${check.stderr.trim()}`);

  // Repo onde o commit de memória acontece = o do alvo real do symlink, não o do dosiq.
  const memoryRepo = run('git', ['rev-parse', '--show-toplevel'], { cwd: fs.realpathSync(agentLink) }).stdout.trim();
  const hooksPath = run('git', ['config', 'core.hooksPath'], { cwd: memoryRepo }).stdout.trim();
  const hook = hooksPath ? path.resolve(memoryRepo, hooksPath, 'pre-commit') : '';
  const tracked = hooksPath && run('git', ['ls-files', '--error-unmatch', path.join(hooksPath, 'pre-commit')], { cwd: memoryRepo }).status === 0;
  if (!hooksPath) {
    fail(`${memoryRepo} sem core.hooksPath — rode: git -C ${memoryRepo} config core.hooksPath .githooks`);
  } else if (!fs.existsSync(hook) || !(fs.statSync(hook).mode & 0o111)) {
    fail(`hook ausente ou não executável: ${hook}`);
  } else if (!fs.readFileSync(hook, 'utf-8').includes('memory-precommit-gate.mjs')) {
    fail(`${hook} não chama memory-precommit-gate.mjs`);
  } else {
    ok(`hook em disco: ${hook} (core.hooksPath=${hooksPath}, ${tracked ? 'versionado' : 'NÃO versionado'})`);
    if (!tracked) fail(`${hook} não está no git de ${memoryRepo} — some no próximo clone`);
    probe(path.dirname(hook));
  }

  process.exitCode = failed > 0 ? 1 : 0;
  if (failed > 0) console.error(`gate de memória: ${failed} falha(s).`);
}

main();
