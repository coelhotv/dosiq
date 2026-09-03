import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(__dirname, '..', 'recount-memory.mjs');

let repo;

function git(args, cwd = repo) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`git ${args.join(' ')} falhou: ${e.stderr ?? ''}${e.stdout ?? ''}`);
  }
}

function write(rel, content) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  return rel;
}

function commit(subject, files = {}) {
  const empty = Object.keys(files).length === 0;
  for (const rel of Object.keys(files)) {
    write(rel, files[rel]);
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
    return { stdout, stderr: '', status: 0 };
  } catch (e) {
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status ?? 1 };
  }
}

const json = (args = []) => JSON.parse(run(['--json', ...args]).stdout);
const rowOf = (id, args = []) => json(args).rows.find((r) => r.id === id);

before(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'recount-'));
  git(['init', '-q', '-b', 'main'], repo);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'test']);

  // R-100 nasce junto com código: o commit de nascimento NÃO conta como recorrência.
  commit('fix(x): corrige e cunha R-100', {
    '.agent/memory/rules/process_and_testing/R-100.md': '# R-100\n',
    'src/a.js': 'a\n',
  });
  commit('feat(x): aplica R-100', { 'src/b.js': 'b\n' });
  commit('revert: reverte o uso de R-100', { 'src/b.js': 'b2\n' });
  // R-101 existe em disco e não é citada em lugar nenhum: precisa aparecer com 0.
  commit('chore: memória sem evidência', {
    '.agent/memory/rules/process_and_testing/R-101.md': '# R-101\n',
  });
  // IDs legados: padrão de citação mais estreito que o de arquivo prendia estes em 0 para sempre
  // e creditava as citações de R-025-1 ao R-025 (achado do RC6 no #819).
  commit('feat(z): cunha legados', {
    '.agent/memory/rules/mobile_and_platform/R-025.md': '# R-025\n',
    '.agent/memory/rules/mobile_and_platform/R-025-1.md': '# R-025-1\n',
    '.agent/memory/anti-patterns/test_hygiene/AP-97.md': '# AP-97\n',
    '.agent/memory/anti-patterns/test_hygiene/AP-LOG-001.md': '# AP-LOG-001\n',
    'src/e.js': 'e\n',
  });
  commit('fix(z): aplica R-025-1, AP-97 e AP-LOG-001', { 'src/f.js': 'f\n' });

  // R-010 existe e é usada, mas o CLAUDE.md do fixture NÃO cita o ID dela — cobertura em prosa.
  commit('feat(y): aplica R-010', {
    '.agent/memory/rules/react_and_ui/R-010.md': '# R-010\n',
    'src/c.js': 'c\n',
  });
  commit('feat(y): aplica R-010 de novo', { 'src/d.js': 'd\n' });

  // journal: NDJSON + um registro pretty-printed + um registro corrompido no meio
  write(
    '.agent/memory/journal/2026-W01.jsonl',
    [
      '{"timestamp":"2026-01-02T10:00:00Z","rules_applied":["R-100"]}',
      '{',
      '  "timestamp": "2026-01-03T10:00:00Z",',
      '  "rules_applied": ["R-100", "AP-200"]',
      '}',
      '{"timestamp":"2026-01-04T10:00:00Z","x":9_bad,"rules":["R-100"]}',
      '{"timestamp":"2026-01-05T10:00:00Z","rules_applied":["AP-200"]}',
      '',
    ].join('\n'),
  );
  write(
    '.agent/memory/events.jsonl',
    '{"timestamp":"2026-01-06T10:00:00Z","event":"x","rules_applied":["R-100"]}\n',
  );
  write(
    '.agent/sessions/events.jsonl',
    '{"timestamp":"2026-01-07T10:00:00Z","event":"y","rules_applied":["AP-200"]}\n',
  );
  write('CLAUDE.md', 'Regra crítica citando R-100.\n');
  git(['add', '-A']);
  git(['commit', '-m', 'chore: traços']);
});

after(() => fs.rmSync(repo, { recursive: true, force: true }));

test('o arquivo NÃO contém chamada de escrita (restrição estrutural, não flag)', () => {
  const src = fs.readFileSync(script, 'utf-8');
  assert.equal(/writeFileSync|appendFileSync|createWriteStream|fs\.write\b/.test(src), false);
});

test('--report não suja .agent/memory', () => {
  run(['--report']);
  assert.equal(git(['status', '--porcelain', '.agent/memory']).trim(), '');
});

test('memória sem nenhuma evidência entra com 0, nunca é omitida', () => {
  const r = rowOf('R-101');
  assert.ok(r, 'R-101 tem de aparecer no relatório');
  assert.equal(r.count, 0);
});

test('o commit de nascimento não conta como recorrência', () => {
  const r = rowOf('R-100');
  assert.equal(r.birth_skipped, 1);
});

test('commit de revert é contado e marcado distintamente', () => {
  const r = rowOf('R-100');
  assert.equal(r.reverts, 1);
});

test('registro pretty-printed vale UMA evidência, igual à linha compacta', () => {
  const r = rowOf('R-100');
  // journal: 1 NDJSON + 1 pretty + 1 corrompido = 3 âncoras distintas
  assert.equal(r.by_trace.journal, 3);
});

test('registro corrompido é contado como problema, não engolido', () => {
  const problems = json().problems;
  assert.ok(problems.some((p) => p.kind === 'registro-corrompido' || p.kind === 'registro-nao-fechado'));
});

test('os 5 traços são lidos e reportados separadamente', () => {
  const r = rowOf('R-100');
  assert.deepEqual(Object.keys(r.by_trace).sort(), ['events-memory', 'git-log', 'journal'].sort());
  const ap = rowOf('AP-200');
  assert.ok(ap.by_trace['events-sessions'] >= 1);
});

test('--exclude-trace remove o traço da contagem', () => {
  const comTraco = rowOf('AP-200').count;
  const semTraco = rowOf('AP-200', ['--exclude-trace', 'events-sessions']).count;
  assert.ok(semTraco < comTraco, `${semTraco} deve ser < ${comTraco}`);
});

test('ID citado em traço sem arquivo em disco é órfão, e não derruba o run', () => {
  const ap = rowOf('AP-200');
  assert.equal(ap.orphan, true);
  assert.equal(ap.file, null);
});

test('IDs legados são contados, e R-025-1 não é creditado ao R-025', () => {
  assert.equal(rowOf('R-025-1').count, 1);
  assert.equal(rowOf('AP-97').count, 1);
  assert.equal(rowOf('AP-LOG-001').count, 1);
  // o único commit cita R-025-1, nunca R-025 sozinho
  assert.equal(rowOf('R-025').count, 0);
});

test('--id inexistente sai com erro, não com relatório vazio', () => {
  const r = run(['--id', 'R-999']);
  assert.equal(r.status, 1);
});

test('--id devolve a quebra por traço da memória', () => {
  const out = JSON.parse(run(['--id', 'R-100']).stdout);
  assert.equal(out.id, 'R-100');
  assert.ok(out.count > 0);
  assert.ok(out.last_referenced);
});

test('--promote-candidates separa SUBIR de DESCER usando o CLAUDE.md', () => {
  const out = run(['--promote-candidates', '--k', '1']).stdout;
  assert.match(out, /top-K = 1/);
  assert.match(out, /SUBIR/);
  assert.match(out, /DESCER/);
  assert.match(out, /COBERTURA = ID citado no CLAUDE\.md \+ \d+ declarada/);
});

test('cobertura em prosa conta como coberta e vem com a linha que a comprova', () => {
  // R-010 não é citada por ID em lugar nenhum do fixture; entra por PROSE_COVERED.
  const out = run(['--promote-candidates', '--k', '40']).stdout;
  assert.match(out, /R-010.*\[em prosa: CLAUDE\.md:47/);
});

test('--find-similar devolve candidatos do índice compilado e avisa que não é veredicto', () => {
  const index = {
    rules: {
      'AP-900': {
        title: 'Gate que reporta sucesso de operação que não ocorreu',
        summary: 'hook imprimiu sucesso com o comando comentado',
        domain: 'process_and_testing',
        layer: 'warm',
        paths: [],
        diff_triggers: [],
        keywords: ['gate', 'sucesso'],
      },
      'R-900': { title: 'Outra coisa', summary: 'nada a ver', domain: 'react_and_ui', layer: 'warm', paths: [], diff_triggers: [], keywords: [] },
    },
    byPath: {},
    byTrigger: {},
  };
  write('.agent/memory/compiled_rules_index.json', JSON.stringify(index));
  git(['add', '--', '.agent/memory/compiled_rules_index.json']);
  git(['commit', '-m', 'chore: índice compilado do fixture']);
  const out = run(['--find-similar', 'gate reporta sucesso que não ocorreu']).stdout;
  assert.match(out, /AP-900/);
  assert.doesNotMatch(out, /R-900/);
  assert.match(out, /NÃO PROVA CLASSE NOVA/);
});

test('--find-similar sem termo utilizável sai com erro', () => {
  assert.equal(run(['--find-similar', 'a b c']).status, 1);
});

test('--k inválido sai com erro', () => {
  assert.equal(run(['--promote-candidates', '--k', '0']).status, 2);
});

test('--post-birth-json emite o mapa ID -> contagem em stdout, sem tocar disco', () => {
  const map = JSON.parse(run(['--post-birth-json']).stdout);
  assert.equal(typeof map['R-100'], 'number');
  assert.equal('AP-200' in map, false, 'órfã não entra no mapa');
  assert.equal(git(['status', '--porcelain', '.agent/memory']).trim(), '');
});

test('ordem é determinística: contagem desc, depois ID', () => {
  const a = json().rows.map((r) => r.id);
  const b = json().rows.map((r) => r.id);
  assert.deepEqual(a, b);
});
