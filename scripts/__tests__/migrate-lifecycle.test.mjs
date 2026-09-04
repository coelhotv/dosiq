/**
 * Testes do modo `--lifecycle` do migrate-memory-frontmatter (078 Slice 2).
 *
 * O que este arquivo protege: o modo escreve em 611 arquivos VERSIONADOS de memória, e a única
 * propriedade que importa é NÃO tocar em mais nada. O guard do PO-7 é `git diff --stat`, que é
 * verificação a posteriori; aqui a mesma propriedade é testada no escritor, contra os formatos
 * reais do acervo (chave ausente, chave presente, `None` literal, escalar longo aspeado).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchLifecycleLines } from '../migrate-memory-frontmatter.mjs';

const FM_SEM_CHAVES = ['title: t', 'summary: s', 'layer: warm', 'status: active', 'id: R-900'].join('\n');

test('chave ausente é inserida em posição alfabética entre as chaves fora do KEY_ORDER', () => {
  const out = patchLifecycleLines(FM_SEM_CHAVES, { incident_count: 7, last_referenced: '2026-09-04' });
  const lines = out.split('\n');
  assert.ok(lines.includes('incident_count: 7'));
  assert.ok(lines.includes('last_referenced: "2026-09-04"'));
  // `id` e `incident_count`/`last_referenced` são todos "extras": ordem alfabética entre eles,
  // que é exatamente onde o serialize() os colocaria — os dois caminhos não podem divergir.
  assert.ok(lines.indexOf('id: R-900') < lines.indexOf('incident_count: 7'));
  assert.ok(lines.indexOf('incident_count: 7') < lines.indexOf('last_referenced: "2026-09-04"'));
});

test('chave existente é substituída NO LUGAR: zero movimento das outras linhas', () => {
  const antes = ['title: t', 'incident_count: 0', 'last_referenced: None', 'review_due: "2026-12-31"'].join('\n');
  const depois = patchLifecycleLines(antes, { incident_count: 142, last_referenced: '2026-09-03' });
  assert.equal(
    depois,
    ['title: t', 'incident_count: 142', 'last_referenced: "2026-09-03"', 'review_due: "2026-12-31"'].join('\n'),
  );
});

test('sem data, a chave é REMOVIDA — nunca escrita como None', () => {
  const antes = ['title: t', 'incident_count: 3', 'last_referenced: None'].join('\n');
  const depois = patchLifecycleLines(antes, { incident_count: 0, last_referenced: null });
  assert.equal(/last_referenced/.test(depois), false);
  assert.equal(/None/.test(depois), false);
  assert.match(depois, /^incident_count: 0$/m);
});

test('nenhuma outra linha do frontmatter muda (a propriedade que o PO-7 exige)', () => {
  const antes = [
    'title: t',
    // Escalar longo aspeado: reserializar via js-yaml reembrulharia isto em bloco `>-`. É o
    // colateral medido em 18 arquivos (R-295, AP-300…) que motivou não usar o serialize aqui.
    "summary: 'Hierarquia de verdade: banco > types gerados > Zod > tipo à mão, e o select é string.'",
    'applies_to:',
    '  paths:',
    '    - scripts/**',
    'review_due: "2026-12-31"',
  ].join('\n');
  const depois = patchLifecycleLines(antes, { incident_count: 5, last_referenced: '2026-01-02' });
  const semCicloDeVida = (t) =>
    t.split('\n').filter((l) => !l.startsWith('incident_count:') && !l.startsWith('last_referenced:')).join('\n');
  assert.equal(semCicloDeVida(depois), antes);
});

test('linha aninhada com o mesmo nome NÃO é confundida com a chave de topo', () => {
  // `\b` e `includes` são o erro do AP-346: o casamento tem de ser ancorado no início da linha.
  const antes = ['title: t', 'related:', '  incident_count: nao-sou-eu', 'id: AP-900'].join('\n');
  const depois = patchLifecycleLines(antes, { incident_count: 9, last_referenced: null });
  assert.match(depois, /^ {2}incident_count: nao-sou-eu$/m);
  assert.match(depois, /^incident_count: 9$/m);
});
