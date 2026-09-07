/**
 * Gate de frescor do índice compilado — spec 079, Slice B.
 *
 * `scripts/**` é globalmente ignorado no eslint.config.js:24, então a rede aqui é `node --test`.
 * ⚠️ Rodar com glob: `node --test scripts/__tests__/*.mjs` (sem ele o Node 22 sai MODULE_NOT_FOUND).
 *
 * O que estes testes fixam: o `sourceHash` responde a CONTEÚDO e é cego a mtime. Até a 079 ele era
 * `caminho:mtimeMs:tamanho`, e o git reescreve mtime em merge/checkout/clone sem tocar um byte —
 * o gate acusava "desatualizado" com a árvore limpa (AP-349). O par de testes abaixo é o que impede
 * a correção de virar cegueira: um prova que mtime não conta, o outro prova que conteúdo conta.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { computeSourceHash } from '../compile-memory-index.mjs';

const MEMORIA = `---
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

/** Monta um acervo mínimo com a estrutura que o computeSourceHash percorre (rules/ e anti-patterns/). */
function acervo(conteudo = MEMORIA, nome = 'AP-902.md') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dosiq-079b-'));
  const dir = path.join(root, 'anti-patterns', 'data_and_schema');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(root, 'rules', 'data_and_schema'), { recursive: true });
  fs.writeFileSync(path.join(dir, nome), conteudo, 'utf-8');
  return { root, filePath: path.join(dir, nome) };
}

test('hash IGNORA mtime: tocar o arquivo sem mudar conteudo nao muda o hash', () => {
  const { root, filePath } = acervo();
  const antes = computeSourceHash(root);

  // É o mecanismo exato do AP-349: git reescreve mtime em merge/checkout/clone/stash.
  const futuro = new Date(Date.now() + 60_000);
  fs.utimesSync(filePath, futuro, futuro);

  assert.equal(computeSourceHash(root), antes, 'mtime alterado mudou o hash — o sinal voltou a ser metadado');
});

test('hash RESPONDE a conteudo: um byte a mais muda o hash', () => {
  const { root, filePath } = acervo();
  const antes = computeSourceHash(root);

  fs.appendFileSync(filePath, '\n');

  assert.notEqual(
    computeSourceHash(root),
    antes,
    'um byte alterado nao mudou o hash — o gate ficou cego, que e pior que o falso vermelho'
  );
});

test('hash responde ao CAMINHO: rename com conteudo identico invalida', () => {
  const a = acervo(MEMORIA, 'AP-902.md');
  const b = acervo(MEMORIA, 'AP-903.md');
  assert.notEqual(computeSourceHash(a.root), computeSourceHash(b.root));
});

test('hash e estavel entre execucoes sobre o mesmo acervo', () => {
  const { root } = acervo();
  assert.equal(computeSourceHash(root), computeSourceHash(root));
});

test('acervo vazio nao lanca e produz hash estavel', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dosiq-079b-vazio-'));
  assert.equal(typeof computeSourceHash(root), 'string');
  assert.equal(computeSourceHash(root), computeSourceHash(root));
});
