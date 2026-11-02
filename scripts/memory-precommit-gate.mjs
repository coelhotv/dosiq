#!/usr/bin/env node
/**
 * Gate de pre-commit da memória — spec 079, aditivo F2-b.
 *
 * Roda NO REPO ONDE O COMMIT DE MEMÓRIA ACONTECE. Desde o cutover do moat (2026-09-09/10) esse repo
 * é o `dosiq-moat`: `dosiq/.agent` é um symlink para `dosiq-moat/agent`, então o glob
 * `.agent/memory/**` do `.lintstagedrc.mjs` do dosiq nunca casa — o git do dosiq não vê os arquivos.
 * O gate ficou provado (PO-3) e morto em 3 dias sem nenhum vermelho.
 *
 * O hook do moat (`.githooks/pre-commit`, ligado por `core.hooksPath`) é um shim que chama este
 * arquivo; a lógica mora aqui para ser testável (`scripts/__tests__/memory-precommit-gate.test.mjs`).
 *
 * Uso: node scripts/memory-precommit-gate.mjs [--repo <dir>]
 *   --repo  repositório cujo índice (staged) é inspecionado. Default: cwd.
 * Aceita os dois layouts: `agent/memory/` (moat, sem o ponto) e `.agent/memory/` (repo com a pasta real).
 *
 * Sem mensagem de sucesso própria quando há memória staged: a saída positiva é a do
 * `compile-memory-index.mjs --check`, que não existe se ele não rodou (AP-325 por construção).
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPILER = path.join(__dirname, 'compile-memory-index.mjs');
const MEMORY_DIRS = ['agent/memory', '.agent/memory'];

/** Caminhos staged que são memória (.md sob um dos MEMORY_DIRS), incluindo deleção e rename. */
export function stagedMemoryFiles(repo) {
  const res = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'], {
    cwd: repo,
    encoding: 'utf-8'
  });
  if (res.status !== 0) {
    throw new Error(`git diff --cached falhou em "${repo}": ${res.stderr.trim()}`);
  }
  return res.stdout
    .split('\n')
    .filter((f) => f.endsWith('.md') && MEMORY_DIRS.some((dir) => f.startsWith(`${dir}/`)));
}

function main() {
  const repoIdx = process.argv.indexOf('--repo');
  const repo = path.resolve(repoIdx !== -1 ? process.argv[repoIdx + 1] : process.cwd());

  const staged = stagedMemoryFiles(repo);
  if (staged.length === 0) {
    process.exitCode = 0;
    return;
  }

  const memoryDir = MEMORY_DIRS.map((dir) => path.join(repo, dir)).find((dir) => fs.existsSync(dir));
  if (!memoryDir) {
    console.error(`memória staged, mas nenhum de ${MEMORY_DIRS.join(' / ')} existe em "${repo}".`);
    process.exitCode = 1;
    return;
  }

  console.log(`gate de memória (079): ${staged.length} arquivo(s) de memória staged → --check em ${memoryDir}`);
  const res = spawnSync(process.execPath, [COMPILER, '--check', '--root', memoryDir], { stdio: 'inherit' });
  process.exitCode = res.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
