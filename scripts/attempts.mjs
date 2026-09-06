#!/usr/bin/env node
/**
 * attempts.mjs — o ledger de conhecimento NEGATIVO do DEVFLOW (spec 078 §US7, ADR-098).
 *
 * O DEVFLOW registra o que deu certo (AP, R, ADR, CON) e não tinha caminho nenhum para
 * "tentei, medi, não funcionou, reverti". Este script é esse caminho: um `.jsonl` append-only
 * em `.agent/memory/attempts.jsonl`, uma linha por INTERVENÇÃO — não por defeito.
 *
 * As três propriedades vêm do ADR-098 e cada uma responde a uma falha específica:
 *   1. ALCANCE POR FONTE DIRETA — quem lê o ledger é o `--find-similar` do C5, direto do arquivo.
 *      Estendê-lo pelo `compiled_rules_index.json` alcançaria a busca ao preço de inflar o
 *      preâmbulo do RC6 (`select-rules.mjs:345` lê o MESMO índice), que é o problema que a 078 ataca.
 *   2. A OBRIGAÇÃO É DERIVADA DO GIT — `--check` lista os reverts do `git log` e exige entrada.
 *      Auto-relato de rejeição é a família do AP-325; o que resolve não é quem escreve, é quem cobra.
 *   3. APPEND-ONLY CONFERIDO CONTRA O REMOTO — entrada nascida no MESMO commit da intervenção
 *      morre no `git revert` junto com ela. `--check` compara com `origin/main` e reprova se
 *      alguma linha sumiu: monotonicidade verificada, não prometida.
 *
 * ⚠️ LIMITE DECLARADO (analysis.md §Slice 5, G5-1): reversão feita NA ÁRVORE DE TRABALHO, antes de
 * qualquer commit, não deixa traço em `git log` — e é assim que os dois casos do backfill (060/T034
 * e 060/T035b) morreram. O gate torna impossível REVERTER POR COMMIT sem registrar; não torna
 * impossível esquecer. O passo do C5 é o único mecanismo para o caso em árvore.
 *
 * Uso:
 *   node scripts/attempts.mjs --list
 *   node scripts/attempts.mjs --check          # exit != 0 quando falta entrada ou linha sumiu
 *   node scripts/attempts.mjs --add '<json>'   # valida o esquema e faz APPEND
 *
 * ⚠️ Medir o exit code SEM PIPE: `node scripts/attempts.mjs --check; echo $?`. Medir através de
 * `| tail` já devolveu 0 de comando que saía 1 nesta mesma spec.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_REL = path.join('.agent', 'memory', 'attempts.jsonl');

/**
 * O repo cobrado é o do DIRETÓRIO DE TRABALHO, não o do script.
 *
 * Derivar do `__dirname` amarrava as consultas ao git ao dosiq mesmo quando o ledger vinha de
 * outro lugar (`--file`) — split-brain silencioso: o gate lia um ledger e cobrava os reverts de
 * outro repo. Pego pelos próprios testes, que passaram pelo motivo ERRADO enquanto o defeito
 * existia (o dosiq tem 2 reverts antigos, e eram eles que faziam a asserção fechar).
 */
function resolveRepoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return path.resolve(__dirname, '..');
  }
}

const REPO_ROOT = resolveRepoRoot();

/**
 * Âncora da cobrança. Reverts ANTERIORES a este commit não são cobrados: o ledger nasce aqui
 * (commit do ADR-098) e cobrar retroativamente toda a história transformaria o gate num débito
 * impagável — que é como um gate morre (alguém o afrouxa, AP-325).
 */
const LEDGER_SINCE = process.env.ATTEMPTS_SINCE || '5a029b56';

/**
 * Ref contra a qual a monotonicidade é conferida. `origin/main` é o default de produção; a env var
 * existe para que a PROVA da PO-27 possa rodar em branch descartável — um gate cuja checagem só
 * roda em produção é um gate que ninguém consegue ver reprovar (AP-325).
 */
const BASE_REF = process.env.ATTEMPTS_BASE_REF || 'origin/main';

const REQUIRED = ['id', 'what', 'measured', 'baseline', 'verdict', 'cause', 'sha', 'spec', 'terms'];
const VERDICTS = new Set(['rejected', 'accepted', 'inconclusive']);
const ID_RE = /^ATT-\d{4}-\d{3}$/;

function git(args, { allowFail = false } = {}) {
  try {
    // stderr suprimido quando a falha é ESPERADA (ref ausente): o `fatal:` do git vazando na
    // saída do gate faz um resultado correto parecer erro.
    const stdio = allowFail ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'pipe', 'inherit'];
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8', stdio }).trim();
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

/** Lê o ledger. Ausência NÃO é erro — senão o gate nasce vermelho e morre afrouxado. */
function readLedger(file) {
  if (!fs.existsSync(file)) return { entries: [], raw: [], missing: true };
  const raw = fs.readFileSync(file, 'utf-8').split('\n');
  const entries = [];
  raw.forEach((line, i) => {
    if (!line.trim()) return;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      // Pular linha corrompida em silêncio seria perder registro sem ninguém saber.
      throw new Error(`${LEDGER_REL}:${i + 1} — JSON inválido (linha corrompida, não pulada)`);
    }
    entries.push({ ...obj, __line: i + 1 });
  });
  return { entries, raw, missing: false };
}

/** Valida UMA entrada. Devolve lista de problemas (vazia = ok). */
function validateEntry(e, seenIds) {
  const problems = [];
  const where = e.__line ? `linha ${e.__line}` : (e.id ?? '<sem id>');
  for (const f of REQUIRED) {
    if (e[f] === undefined || e[f] === null || e[f] === '') problems.push(`${where}: campo obrigatório ausente: ${f}`);
  }
  if (e.id && !ID_RE.test(e.id)) problems.push(`${where}: id fora do formato ATT-YYYY-NNN: ${e.id}`);
  if (e.id && seenIds.has(e.id)) problems.push(`${where}: id duplicado: ${e.id} (classe do AP-343)`);
  if (e.id) seenIds.add(e.id);
  if (e.verdict && !VERDICTS.has(e.verdict)) {
    problems.push(`${where}: verdict fora do domínio (${[...VERDICTS].join('|')}): ${e.verdict}`);
  }
  if (e.terms !== undefined && (!Array.isArray(e.terms) || e.terms.length === 0)) {
    problems.push(`${where}: terms deve ser array não-vazio — é o campo que torna a entrada ACHÁVEL`);
  }
  if (e.sha !== undefined && (typeof e.sha !== 'object' || e.sha === null || Array.isArray(e.sha))) {
    problems.push(`${where}: sha deve ser objeto {attempt, revert, trace} — null explícito é válido, ausente não`);
  } else if (e.sha && e.sha.attempt === undefined && e.sha.revert === undefined && e.sha.trace === undefined) {
    problems.push(`${where}: sha vazio — procedência ausente se DECLARA (trace), não se omite (R-307)`);
  }
  return problems;
}

/** Reverts cobráveis: commits `Revert "..."` depois da âncora. */
function revertCommits() {
  const range = git(['rev-parse', '--verify', `${LEDGER_SINCE}^{commit}`], { allowFail: true })
    ? `${LEDGER_SINCE}..HEAD`
    : 'HEAD';
  const out = git(['log', range, '--grep', '^Revert ', '--format=%h\t%s'], { allowFail: true });
  if (!out) return [];
  return out.split('\n').filter(Boolean).map((l) => {
    const [sha, ...rest] = l.split('\t');
    return { sha, subject: rest.join('\t') };
  });
}

/** Monotonicidade: nada que estava em `BASE_REF` (origin/main em produção) pode ter sumido. */
function monotonicity(entries, file) {
  // O caminho conferido sai do arquivo REALMENTE lido, não de uma constante: com `--file` a
  // constante conferiria um arquivo diferente do que foi validado — a mesma classe de split-brain
  // que o REPO_ROOT tinha.
  // `realpathSync` nos dois lados: no macOS o `/tmp` é symlink para `/private/tmp` e o
  // `--show-toplevel` devolve o caminho resolvido — sem isso `path.relative` produz `../../..`
  // e a checagem vira um skip silencioso (pego pelo teste de append-only).
  const realFile = fs.existsSync(file)
    ? fs.realpathSync(file)
    : path.join(fs.realpathSync(path.dirname(file)), path.basename(file)); // ledger ainda não existe
  const rel = path.relative(fs.realpathSync(REPO_ROOT), realFile);
  const remote = git(['show', `${BASE_REF}:${rel}`], { allowFail: true });
  if (remote === null) {
    return { skipped: true, reason: `${BASE_REF} sem \`${rel}\` (primeiro PR) ou ref inalcançável`, missing: [] };
  }
  const here = new Set(entries.map((e) => e.id));
  const missing = [];
  for (const line of remote.split('\n')) {
    if (!line.trim()) continue;
    try {
      const id = JSON.parse(line).id;
      if (!here.has(id)) missing.push(id);
    } catch {
      missing.push(`<linha corrompida em ${BASE_REF}>`);
    }
  }
  return { skipped: false, missing };
}

function cmdList(file) {
  const { entries, missing } = readLedger(file);
  if (missing || entries.length === 0) {
    console.log(`(ledger vazio — ${LEDGER_REL} ainda não tem entradas)`);
    return 0;
  }
  for (const e of entries) {
    console.log(`\n${e.id}  [${e.verdict}]  ${e.spec}${e.task ? `/${e.task}` : ''}`);
    console.log(`  o que    : ${e.what}`);
    console.log(`  medido   : ${e.measured}`);
    console.log(`  baseline : ${e.baseline}`);
    console.log(`  causa    : ${e.cause}`);
    const sha = e.sha ?? {};
    console.log(`  sha      : tentativa=${sha.attempt ?? 'null'} · reversão=${sha.revert ?? 'null'}${sha.trace ? ` · traço=${sha.trace}` : ''}`);
    console.log(`  termos   : ${(e.terms ?? []).join(' · ')}`);
  }
  // Sem o denominador das aceitas a taxa de rejeição não é interpretável (ADR-098).
  const by = {};
  for (const e of entries) by[e.verdict] = (by[e.verdict] ?? 0) + 1;
  const total = entries.length;
  const rej = by.rejected ?? 0;
  console.log(`\n${total} intervenção(ões): ${Object.entries(by).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  console.log(`taxa de rejeição: ${rej}/${total}`);
  return 0;
}

function cmdCheck(file) {
  const problems = [];
  const { entries, missing } = readLedger(file);
  if (missing) {
    console.log(`✓ ${LEDGER_REL} ausente — nada a conferir (o gate não nasce vermelho).`);
  }
  const seen = new Set();
  for (const e of entries) problems.push(...validateEntry(e, seen));

  const reverts = revertCommits();
  const registered = new Set(entries.map((e) => (e.sha ?? {}).revert).filter(Boolean));
  const orphans = reverts.filter((r) => ![...registered].some((s) => s.startsWith(r.sha) || r.sha.startsWith(s)));
  for (const r of orphans) {
    problems.push(`revert sem entrada no ledger: ${r.sha} ${r.subject}`);
  }

  const mono = monotonicity(entries, file);
  if (mono.skipped) {
    console.log(`⚠️  monotonicidade não conferida: ${mono.reason}`);
  } else {
    for (const id of mono.missing) problems.push(`linha sumiu do ledger (append-only violado): ${id} está em ${BASE_REF} e não aqui`);
  }

  if (problems.length) {
    console.error(`\n✗ ${problems.length} problema(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error(`\nÂncora de cobrança: ${LEDGER_SINCE} · reverts no range: ${reverts.length}`);
    return 1;
  }
  console.log(`✓ ledger íntegro — ${entries.length} entrada(s), ${reverts.length} revert(s) desde ${LEDGER_SINCE}, todos registrados.`);
  return 0;
}

function cmdAdd(file, json) {
  let obj;
  try {
    obj = JSON.parse(json);
  } catch (err) {
    console.error(`--add exige JSON válido: ${err.message}`);
    return 2;
  }
  const { entries, missing } = readLedger(file);
  const seen = new Set(entries.map((e) => e.id));
  const problems = validateEntry(obj, seen);
  if (problems.length) {
    console.error('✗ entrada recusada:');
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const prefix = missing || fs.readFileSync(file, 'utf-8').endsWith('\n') || entries.length === 0 ? '' : '\n';
  fs.appendFileSync(file, `${prefix}${JSON.stringify(obj)}\n`);
  console.log(`✓ ${obj.id} anexado a ${LEDGER_REL}`);
  return 0;
}

function main(argv) {
  const args = argv.slice(2);
  const fileArgIdx = args.indexOf('--file');
  const file = fileArgIdx >= 0 ? path.resolve(args[fileArgIdx + 1]) : path.join(REPO_ROOT, LEDGER_REL);
  if (args.includes('--list')) return cmdList(file);
  if (args.includes('--check')) return cmdCheck(file);
  const addIdx = args.indexOf('--add');
  if (addIdx >= 0) return cmdAdd(file, args[addIdx + 1] ?? '');
  console.error('uso: attempts.mjs --list | --check | --add \'<json>\' [--file <path>]');
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exit(main(process.argv));
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}

export { readLedger, validateEntry, revertCommits, monotonicity, LEDGER_SINCE, BASE_REF };
