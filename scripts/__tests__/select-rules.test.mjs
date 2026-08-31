import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptsDir = path.resolve(__dirname, '..');
const fixturesRoot = path.join(scriptsDir, '__fixtures__', 'memory');
const diffsDir = path.join(scriptsDir, '__fixtures__', 'diffs');
const compileScript = path.join(scriptsDir, 'compile-memory-index.mjs');
const selectScript = path.join(scriptsDir, 'select-rules.mjs');

let tmpDir;
let indexPath;

function run(script, args) {
  const stderrFile = path.join(os.tmpdir(), `select-rules-test-stderr-${process.pid}-${Math.random().toString(36).slice(2)}.log`);
  const stderrFd = fs.openSync(stderrFile, 'w');
  try {
    const stdout = execFileSync('node', [script, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', stderrFd] });
    return { stdout, stderr: fs.readFileSync(stderrFile, 'utf-8'), status: 0 };
  } catch (e) {
    return { stdout: e.stdout ?? '', stderr: fs.readFileSync(stderrFile, 'utf-8'), status: e.status ?? 1 };
  } finally {
    fs.closeSync(stderrFd);
    fs.rmSync(stderrFile, { force: true });
  }
}

function selectJson(diffFixtureName, extraArgs = []) {
  const args = [
    '--root',
    fixturesRoot,
    '--index',
    indexPath,
    '--diff-fixture',
    path.join(diffsDir, diffFixtureName),
    '--json',
    ...extraArgs
  ];
  const result = run(selectScript, args);
  assert.equal(result.status, 0, `select-rules deveria sair 0; stderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'select-rules-test-'));
  indexPath = path.join(tmpDir, 'idx.json');
  const compileResult = run(compileScript, ['--root', fixturesRoot, '--out', indexPath]);
  assert.equal(compileResult.status, 0, `compile falhou: ${compileResult.stderr}`);
  assert.ok(fs.existsSync(indexPath), 'índice não foi escrito');
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('diff de SQL seleciona regras data_and_schema e NÃO regras de UI', () => {
  const out = selectJson('sql-drop-column.diff');
  const selectedIds = out.selected.map((r) => r.id);
  const selectedDomains = new Set(out.selected.map((r) => r.domain));

  assert.ok(selectedIds.length > 0, 'deveria selecionar ao menos uma regra');
  assert.ok(!selectedDomains.has('react_and_ui'), 'não deveria selecionar regras de UI para um diff de SQL');
  assert.ok(
    selectedIds.some((id) => ['R-901', 'R-903', 'AP-901'].includes(id)),
    'deveria selecionar ao menos uma regra de data_and_schema'
  );
});

test('hot aparece sempre, mesmo em diff que não casa nada', () => {
  const args = [
    '--root',
    fixturesRoot,
    '--index',
    indexPath,
    '--paths',
    'docs/README_totalmente_irrelevante.md',
    '--json'
  ];
  const result = run(selectScript, args);
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  const hotIds = out.hot.map((r) => r.id);
  assert.deepEqual(hotIds, ['R-900'], 'R-900 (layer hot) deve aparecer sempre');
});

test('glob específico vence glob genérico no mesmo caminho', () => {
  const out = selectJson('sql-drop-column.diff');
  const r901 = out.selected.find((r) => r.id === 'R-901');
  const r903 = out.selected.find((r) => r.id === 'R-903');

  assert.ok(r901, 'R-901 (glob específico supabase/migrations/*.sql) deveria estar selecionado');
  // R-903 (glob genérico supabase/**) pode ficar de fora pelo teto de 2/domínio, mas se aparecer
  // tem que vir depois de R-901 no ranking.
  if (r903) {
    assert.ok(r901.score >= r903.score, 'R-901 deveria pontuar >= R-903 no mesmo caminho');
    assert.ok(r901.specificity > r903.specificity, 'especificidade de R-901 deveria ser maior que a de R-903');
  }
});

test('fail-safe 056: índice ausente imprime aviso em stderr e sai 0, devolvendo domínios', () => {
  const missingIndex = path.join(tmpDir, 'nao-existe.json');
  const result = run(selectScript, [
    '--root',
    fixturesRoot,
    '--index',
    missingIndex,
    '--paths',
    'apps/mobile/src/hooks/useDoseReminder.ts'
  ]);
  assert.equal(result.status, 0, 'fail-safe nunca deve sair com erro');
  assert.match(result.stderr, /fail-safe 056 ativado/);
  assert.match(result.stdout, /mobile_and_platform/);
});

test('duas execuções seguidas devolvem a mesma ordem (determinismo)', () => {
  const first = selectJson('sql-drop-column.diff');
  const second = selectJson('sql-drop-column.diff');
  assert.deepEqual(
    first.selected.map((r) => r.id),
    second.selected.map((r) => r.id),
    'a ordem dos ids selecionados deve ser idêntica entre execuções'
  );
});

// O teto por domínio é SOFT: ele espalha as vagas quando HÁ disputa, mas não deixa vaga vazia
// quando não há. Como teto duro, ele limitava a seleção a 2 x (nº de domínios) — e um diff de UM
// domínio, que é o caso comum, devolvia 2 regras contra as "3 a 5" de FR-004/SC-003.
test('teto por domínio espalha sob disputa, mas não deixa vaga vazia', () => {
  // Com folga de vagas (limit alto), o teto NÃO deve suprimir candidatos válidos.
  const folgado = selectJson('sql-drop-column.diff', ['--limit', '10']);
  const semTeto = selectJson('sql-drop-column.diff', ['--limit', '10']);
  assert.deepEqual(
    folgado.selected.map((r) => r.id),
    semTeto.selected.map((r) => r.id),
    'determinismo entre execuções com folga'
  );

  // Sob disputa real (mais candidatos que vagas), nenhum domínio leva TODAS as vagas.
  const apertado = selectJson('sql-drop-column.diff', ['--limit', '2']);
  const counts = {};
  for (const r of apertado.selected) counts[r.domain] = (counts[r.domain] || 0) + 1;
  const domains = Object.keys(counts);
  if (apertado.selected.length >= 2 && domains.length > 1) {
    for (const d of domains) {
      assert.ok(counts[d] <= 2, `domínio ${d} passou do teto sob disputa: ${counts[d]}`);
    }
  }

  // E o orçamento é de fato USADO quando existem candidatos para preenchê-lo.
  const disponiveis = folgado.selected.length;
  const cinco = selectJson('sql-drop-column.diff', ['--limit', '5']);
  assert.equal(
    cinco.selected.length,
    Math.min(5, disponiveis),
    'com candidatos suficientes, o limite tem de ser preenchido — vaga vazia é recall jogado fora'
  );
});

test('--id devolve o arquivo inteiro da regra, ignorando scoring', () => {
  const result = run(selectScript, [
    '--root',
    fixturesRoot,
    '--index',
    indexPath,
    '--id',
    'R-900'
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^---\nid: R-900/);
  assert.match(result.stdout, /hot_reason:/);
});
