// Spec 108 · PO-8 — checador de GRANT em migração (FR-013). Cada regra tem fixture que falha com a
// mensagem do GRANT que falta; a fixture correta passa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.resolve(__dirname, '..');
const fixtures = path.join(scriptsDir, '__fixtures__', 'migration-grants');
const gate = path.join(scriptsDir, 'migration-grants-gate.mjs');

function run(...files) {
  const r = spawnSync(process.execPath, [gate, ...files.map((f) => path.join(fixtures, f))], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test('(a) CREATE FUNCTION sem GRANT falha e diz o GRANT que falta', () => {
  const r = run('a_function_no_grant.sql');
  assert.equal(r.code, 1);
  assert.match(r.out, /\(a\)/);
  assert.match(r.out, /GRANT EXECUTE ON FUNCTION public\.list_things\(\.\.\.\) TO/);
});

test('(b) DROP + CREATE sem re-GRANT falha com a mensagem própria', () => {
  const r = run('b_drop_create.sql');
  assert.equal(r.code, 1);
  assert.match(r.out, /\(b\)/);
  assert.match(r.out, /DROP \+ CREATE apaga os grants/);
  assert.match(r.out, /public\.register_thing/);
});

test('(c) capture_access sem anon falha — e o marcador não libera', () => {
  const r = run('c_capture_access.sql');
  assert.equal(r.code, 1);
  assert.match(r.out, /\(c\)/);
  assert.match(r.out, /GRANT EXECUTE ON FUNCTION access_hook\.capture_access\(\) TO anon, authenticated/);
});

test('(d) CREATE TABLE sem GRANT nem comentário falha; TEMP TABLE fica fora', () => {
  const r = run('d_table_no_grant.sql');
  assert.equal(r.code, 1);
  assert.match(r.out, /\(d\)/);
  assert.match(r.out, /public\.things/);
  assert.doesNotMatch(r.out, /_scratch/);
});

test('(e) GRANT a anon fora da allowlist falha', () => {
  const r = run('e_anon_outside_allowlist.sql');
  assert.equal(r.code, 1);
  assert.match(r.out, /\(e\)/);
  assert.match(r.out, /public\.things/);
});

test('migração correta passa (GRANTs, "grants: nenhum", marcador, allowlist, string com SQL)', () => {
  const r = run('ok.sql');
  assert.equal(r.code, 0, r.out);
});

test('varredura padrão (docs/migrations, data ≥ corte) passa na própria 108', () => {
  const r = spawnSync(process.execPath, [gate], { encoding: 'utf8', cwd: path.resolve(scriptsDir, '..') });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /20261031_108_public_least_privilege\.sql/);
});
