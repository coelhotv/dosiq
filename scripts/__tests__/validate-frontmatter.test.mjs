/**
 * Caracterização + extração do núcleo de validação de frontmatter de memória (spec 079, Slice A).
 *
 * `scripts/**` é globalmente ignorado no eslint.config.js:24, então a rede aqui é `node --test`.
 * ⚠️ Rodar com glob: `node --test scripts/__tests__/*.mjs`. Sem o glob, o Node 22 trata o
 * diretório como módulo e sai MODULE_NOT_FOUND (medido em 22.22.3).
 *
 * Por que existe: os dois validadores de memória divergiram em silêncio — o do compile parava no
 * primeiro erro do Zod e o standalone já acumulava todos. Estes testes fixam o comportamento ANTES
 * da extração (T010/T011) e depois cobram paridade do núcleo compartilhado (T020+).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { validateFile } from '../compile-memory-index.mjs';
import { validateOneFile } from '../validate-memory-schema.mjs';
import { validateFrontmatter } from '../_memory/validateFrontmatter.mjs';

// O domínio de uma memória é o diretório-pai; precisa estar em DOMAINS para o standalone não
// somar um erro alheio ao que se está medindo.
const DOMAIN = 'data_and_schema';

function writeMemory(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dosiq-079-'));
  const domainDir = path.join(dir, DOMAIN);
  fs.mkdirSync(domainDir);
  const filePath = path.join(domainDir, 'AP-902.md');
  fs.writeFileSync(filePath, body, 'utf-8');
  return filePath;
}

/** Memória com layer VÁLIDO e 3 defeitos — o caso que custou 4 rodadas ao cunhar o AP-348. */
const TRES_DEFEITOS = `---
id: AP-902
title: "titulo qualquer"
category: data_and_schema
layer: warm
status: active
created_at: 2026-09-06
severity: high
keywords: [a, b]
related: [AP-001]
---

# corpo
`;

/** Memória sem defeito nenhum, para provar que o validador não inventa ruído. */
const VALIDA = `---
id: AP-903
title: "titulo qualquer"
summary: "resumo curto o suficiente"
category: data_and_schema
layer: warm
status: active
created_at: 2026-09-06
severity: high
keywords: [a, b]
related:
  anti_patterns: [AP-001]
  rules: [R-001]
applies_to:
  paths:
    - "scripts/**"
---

# corpo
`;

// ---------------------------------------------------------------------------
// T010 — o núcleo puro e seus modos degenerados
// ---------------------------------------------------------------------------

test('nucleo: objeto valido nao produz issue', () => {
  const data = {
    id: 'AP-903',
    title: 'titulo',
    summary: 'resumo',
    category: 'data_and_schema',
    layer: 'warm',
    status: 'active',
    created_at: '2026-09-06',
    severity: 'high',
    keywords: ['a'],
    related: { anti_patterns: [], rules: [] },
    applies_to: { paths: ['scripts/**'] }
  };
  assert.deepEqual(validateFrontmatter(data), []);
});

test('nucleo: 3 defeitos com layer valido devolvem 3 issues, nao 1', () => {
  const data = {
    id: 'AP-902',
    title: 'titulo',
    category: 'data_and_schema',
    layer: 'warm',
    status: 'active',
    created_at: '2026-09-06',
    severity: 'high',
    keywords: ['a'],
    related: ['AP-001'] // array onde se espera objeto
    // summary ausente, applies_to ausente
  };
  const issues = validateFrontmatter(data);
  const campos = issues.map((i) => i.path);
  assert.ok(issues.length >= 3, `esperava >=3 issues, veio ${issues.length}`);
  assert.ok(campos.includes('summary'), `summary ausente nao reportado: ${campos.join(', ')}`);
  assert.ok(campos.includes('applies_to'), `applies_to ausente nao reportado: ${campos.join(', ')}`);
  assert.ok(campos.includes('related'), `related invalido nao reportado: ${campos.join(', ')}`);
});

test('nucleo: entrada degenerada nao lanca — null, undefined, string e array viram issue', () => {
  for (const degenerado of [null, undefined, 'texto', [], 42]) {
    const issues = validateFrontmatter(degenerado);
    assert.ok(Array.isArray(issues), `nao devolveu array para ${JSON.stringify(degenerado)}`);
    assert.ok(issues.length >= 1, `nao reportou issue para ${JSON.stringify(degenerado)}`);
  }
});

test('nucleo: layer ausente/invalido devolve UMA issue no discriminante — limite estrutural do Zod', () => {
  // memoryFrontmatterSchema e z.discriminatedUnion('layer'): sem discriminante valido o Zod nao
  // sabe QUAL branch aplicar e nao avalia os demais campos. "Todos os problemas de uma vez" e
  // impossivel neste caso — limitacao declarada, nao defeito do acumulador.
  const issues = validateFrontmatter({ id: 'AP-902', layer: 'quente' });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, 'layer');
});

test('nucleo: issue na raiz e rotulada "(raiz)" e nunca string vazia', () => {
  const issues = validateFrontmatter('texto');
  assert.ok(
    issues.every((i) => i.path.length > 0),
    `path vazio encontrado: ${JSON.stringify(issues)}`
  );
});

test('nucleo: applies_to legado (array de tags) e reportado como issue propria', () => {
  const issues = validateFrontmatter({
    id: 'AP-902',
    layer: 'warm',
    applies_to: ['tag-a', 'tag-b']
  });
  assert.ok(
    issues.some((i) => i.path === 'applies_to' && /legado/i.test(i.message)),
    `applies_to legado nao reportado: ${JSON.stringify(issues)}`
  );
});

test('nucleo: status com layer vazado e status obsolete tem mensagem dedicada', () => {
  const vazado = validateFrontmatter({ id: 'AP-902', layer: 'warm', status: 'hot' });
  assert.ok(
    vazado.some((i) => i.path === 'status' && /layer vazado/i.test(i.message)),
    `status layer-vazado nao reportado: ${JSON.stringify(vazado)}`
  );

  const obsoleto = validateFrontmatter({ id: 'AP-902', layer: 'warm', status: 'obsolete' });
  assert.ok(
    obsoleto.some((i) => i.path === 'status' && /archived/i.test(i.message)),
    `status obsolete nao reportado: ${JSON.stringify(obsoleto)}`
  );
  // e nao duplica: o Zod tambem reprova o enum de status, mas so uma linha sai sobre o campo.
  assert.equal(obsoleto.filter((i) => i.path === 'status').length, 1);
});

// ---------------------------------------------------------------------------
// T011 — paridade: o que a extracao pode perder EM SILENCIO
// ---------------------------------------------------------------------------

test('paridade: os DOIS consumidores reportam os 3 defeitos do mesmo arquivo', () => {
  const filePath = writeMemory(TRES_DEFEITOS);

  const doCompile = validateFile(filePath, DOMAIN);
  assert.equal(doCompile.ok, false);
  for (const campo of ['summary', 'applies_to', 'related']) {
    assert.match(
      doCompile.reason,
      new RegExp(campo),
      `compile nao citou "${campo}": ${doCompile.reason}`
    );
  }

  const doStandalone = validateOneFile(filePath, { strict: false, claudeMdContent: '' });
  const texto = doStandalone.errors.map((e) => e.message).join('\n');
  for (const campo of ['summary', 'applies_to', 'related']) {
    assert.match(texto, new RegExp(campo), `standalone nao citou "${campo}": ${texto}`);
  }
});

test('paridade: arquivo valido passa nos dois, sem ruido', () => {
  const filePath = writeMemory(VALIDA);
  assert.equal(validateFile(filePath, DOMAIN).ok, true);
  assert.deepEqual(validateOneFile(filePath, { strict: false, claudeMdContent: '' }).errors, []);
});

test('paridade: applies_to legado NAO interrompe o relatorio do standalone (skipZod)', () => {
  // O compile PARA no applies_to legado (pula o arquivo e segue o indice); o standalone marca
  // skipZod e CONTINUA reportando o resto. Sao propositos diferentes e a extracao tem de
  // preservar os dois.
  const filePath = writeMemory(`---
id: AP-902
layer: warm
status: obsolete
applies_to: [tag-a, tag-b]
---

# corpo
`);

  const doCompile = validateFile(filePath, DOMAIN);
  assert.equal(doCompile.ok, false);
  assert.match(doCompile.reason, /applies_to legado/);

  const doStandalone = validateOneFile(filePath, { strict: false, claudeMdContent: '' });
  const classes = doStandalone.errors.map((e) => e.class);
  assert.ok(classes.includes('applies_to_legado'), `classes: ${classes.join(', ')}`);
  assert.ok(
    classes.includes('status_invalido'),
    `skipZod engoliu o status obsolete — classes: ${classes.join(', ')}`
  );
});

test('paridade: o standalone preserva as CLASSES de erro apos a extracao', () => {
  const semFrontmatter = writeMemory('# sem frontmatter nenhum\n');
  const rep = validateOneFile(semFrontmatter, { strict: false, claudeMdContent: '' });
  assert.deepEqual(
    rep.errors.map((e) => e.class),
    ['sem_frontmatter'],
    'classificacao sem_frontmatter perdida'
  );

  const yamlPodre = writeMemory('---\nid: "AP-902\nlayer: warm\n---\n\n# corpo\n');
  const rep2 = validateOneFile(yamlPodre, { strict: false, claudeMdContent: '' });
  assert.deepEqual(
    rep2.errors.map((e) => e.class),
    ['frontmatter_invalido'],
    'classificacao frontmatter_invalido perdida'
  );
});

test('paridade: o compile PULA o arquivo invalido e nao lanca — semantica de indice preservada', () => {
  const filePath = writeMemory('---\nnada: aqui\n---\n\n# corpo\n');
  const r = validateFile(filePath, DOMAIN);
  assert.equal(r.ok, false);
  assert.equal(typeof r.reason, 'string');
  assert.ok(r.reason.length > 0);
});
