#!/usr/bin/env node
// Consome o índice compilado por scripts/compile-memory-index.mjs e devolve as regras
// relevantes para um diff/lista de caminhos alterados. Ver spec 060 para o algoritmo de score.
//
// Fail-safe (FR-007): índice ausente/ilegível/JSON inválido NUNCA quebra o RC6 — imprime
// "fail-safe 056 ativado" em stderr e devolve os domínios dos caminhos alterados, exit 0.

import fs from 'fs';
import path from 'path';
import { fileURLToPath , pathToFileURL } from 'url';
import { DOMAIN_PATH_MARKERS } from './schemas/memory-frontmatter.schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const WEIGHT_TRIGGER = 8;
const WEIGHT_KEYWORD = 2;
const WEIGHT_DOMAIN = 1;
const WEIGHT_PATH_UNIT = 10;
const MAX_PER_DOMAIN = 2;

function parseArgs(argv) {
  const args = {
    root: null,
    index: null,
    paths: [],
    diffFile: null,
    format: 'full',
    json: false,
    id: null,
    limit: 5
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') {
      args.root = argv[++i];
    } else if (arg === '--index') {
      args.index = argv[++i];
    } else if (arg === '--paths') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args.paths.push(argv[++i]);
      }
    } else if (arg === '--diff-file' || arg === '--diff-fixture') {
      args.diffFile = argv[++i];
    } else if (arg === '--format') {
      args.format = argv[++i];
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--id') {
      args.id = argv[++i];
    } else if (arg === '--limit') {
      // parseInt("abc") => NaN, e `selected.length >= NaN` é sempre falso: o limite sumiria
      // e o prompt receberia o catálogo inteiro — exatamente o que esta spec existe para evitar.
      const parsed = parseInt(argv[++i], 10);
      args.limit = Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
    }
  }
  return args;
}

// --- glob matching (implementação própria, sem dependência: só '*' e '**') -----------------

function globToRegExp(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 2;
        // engole uma barra seguinte opcional, p/ "apps/**/*.ts" casar "apps/x.ts" tb
        if (glob[i] === '/') i += 1;
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += `\\${c}`;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

function matchGlob(glob, filePath) {
  return globToRegExp(glob).test(filePath);
}

function specificity(glob) {
  return glob.split('/').filter((seg) => seg.length > 0 && !seg.includes('*')).length;
}

// --- domínio a partir de caminho (heurística compartilhada com o validador) ----------------

function domainsForPath(filePath) {
  const matched = new Set();
  for (const [domain, markers] of Object.entries(DOMAIN_PATH_MARKERS)) {
    if (markers.some((marker) => filePath.includes(marker))) {
      matched.add(domain);
    }
  }
  return matched;
}

function domainsForPaths(paths) {
  const all = new Set();
  for (const p of paths) {
    for (const d of domainsForPath(p)) all.add(d);
  }
  return all;
}

// --- diff parsing ---------------------------------------------------------------------------

function parseDiff(diffText) {
  const lines = diffText.split(/\r?\n/);
  const changedPaths = [];
  const addedLines = [];
  for (const line of lines) {
    const m = line.match(/^\+\+\+ b\/(.+)$/);
    if (m) {
      changedPaths.push(m[1]);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines.push(line.slice(1));
    }
  }
  return { changedPaths, addedLines };
}

// --- fail-safe --------------------------------------------------------------------------

function failSafe(changedPaths) {
  console.error('fail-safe 056 ativado');
  const domains = Array.from(domainsForPaths(changedPaths)).sort();
  console.log(domains.join('\n'));
  process.exitCode = 0;
}

function loadIndex(indexPath) {
  const raw = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(raw);
}

// --- scoring ------------------------------------------------------------------------------

function scoreRule(id, rule, ctx) {
  let pathScore = 0;
  let pathReason = null;
  for (const glob of rule.paths) {
    for (const cp of ctx.changedPaths) {
      if (matchGlob(glob, cp)) {
        const spec = specificity(glob);
        const s = WEIGHT_PATH_UNIT * spec;
        if (s > pathScore) {
          pathScore = s;
          pathReason = { type: 'path', glob, path: cp, specificity: spec, score: s };
        }
      }
    }
  }

  let triggerScore = 0;
  let triggerReason = null;
  for (const trigger of rule.diff_triggers || []) {
    if (ctx.addedLines.some((l) => l.includes(trigger))) {
      triggerScore = WEIGHT_TRIGGER;
      triggerReason = { type: 'diff_trigger', trigger, score: WEIGHT_TRIGGER };
      break;
    }
  }

  let keywordScore = 0;
  let keywordReason = null;
  for (const keyword of rule.keywords || []) {
    const inDiff = ctx.addedLines.some((l) => l.includes(keyword));
    const inPath = ctx.changedPaths.some((p) => p.includes(keyword));
    if (inDiff || inPath) {
      keywordScore = WEIGHT_KEYWORD;
      keywordReason = { type: 'keyword', keyword, score: WEIGHT_KEYWORD, where: inDiff ? 'diff' : 'path' };
      break;
    }
  }

  let domainScore = 0;
  let domainReason = null;
  if (ctx.changedDomains.has(rule.domain)) {
    domainScore = WEIGHT_DOMAIN;
    domainReason = { type: 'domain', domain: rule.domain, score: WEIGHT_DOMAIN };
  }

  const total = pathScore + triggerScore + keywordScore + domainScore;
  const reasons = [pathReason, triggerReason, keywordReason, domainReason].filter(Boolean);
  const bestSpecificity = pathReason ? pathReason.specificity : 0;

  return { id, domain: rule.domain, title: rule.title, summary: rule.summary, score: total, specificity: bestSpecificity, reasons };
}

function selectRules(index, ctx, limit) {
  const scored = [];
  for (const [id, rule] of Object.entries(index.rules)) {
    if (rule.layer === 'hot') continue; // hot sai por fora do orçamento, sempre
    const s = scoreRule(id, rule, ctx);
    if (s.score > 0) scored.push(s);
  }

  // Desempate determinístico: score desc, especificidade desc, id asc.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Teto por domínio é SOFT, em duas passadas. Como teto duro ele limitava a seleção a
  // MAX_PER_DOMAIN x (nº de domínios do diff): um diff de UM domínio — o caso comum — devolvia
  // no máximo 2 regras, contra as "3 a 5" que FR-004/SC-003 prometem. O teto existe para impedir
  // que um domínio tome as vagas quando HÁ disputa, não para deixar vaga vazia quando não há.
  const selected = [];
  const perDomain = {};
  const deferred = [];

  // Passada 1 — respeita o teto por domínio.
  for (const candidate of scored) {
    if (selected.length >= limit) break;
    const count = perDomain[candidate.domain] || 0;
    if (count >= MAX_PER_DOMAIN) {
      deferred.push(candidate);
      continue;
    }
    perDomain[candidate.domain] = count + 1;
    selected.push(candidate);
  }

  // Passada 2 — sobrou vaga: preenche na MESMA ordem determinística, ignorando o teto.
  for (const candidate of deferred) {
    if (selected.length >= limit) break;
    selected.push(candidate);
  }

  return selected;
}

function reasonToText(reason) {
  if (reason.type === 'path') return `path:${reason.glob} (spec=${reason.specificity}) +${reason.score}`;
  if (reason.type === 'diff_trigger') return `trigger:"${reason.trigger}" +${reason.score}`;
  if (reason.type === 'keyword') return `keyword:"${reason.keyword}" (${reason.where}) +${reason.score}`;
  if (reason.type === 'domain') return `domain:${reason.domain} +${reason.score}`;
  return JSON.stringify(reason);
}

function formatHotBlock(id, rule) {
  return [
    `## [HOT] ${id} — ${rule.title}`,
    rule.summary,
    `domain: ${rule.domain}`
  ].join('\n');
}

function formatFullBlock(item, rule) {
  return [
    `## ${item.id} — ${rule.title} (score=${item.score})`,
    rule.summary,
    `domain: ${rule.domain}`,
    `motivo: ${item.reasons.map(reasonToText).join('; ')}`
  ].join('\n');
}

function printResults({ index, hotIds, selected, format, json, changedDomains }) {
  if (json) {
    const out = {
      hot: hotIds.map((id) => ({ id, ...index.rules[id] })),
      selected: selected.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        domain: item.domain,
        score: item.score,
        specificity: item.specificity,
        reasons: item.reasons
      })),
      changedDomains: Array.from(changedDomains).sort()
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (format === 'brief') {
    for (const id of hotIds) {
      const rule = index.rules[id];
      console.log(`[HOT] ${id} — ${rule.summary}`);
    }
    for (const item of selected) {
      console.log(`${item.id} — ${item.summary} (${item.reasons.map(reasonToText).join('; ')})`);
    }
    return;
  }

  // format === 'full' (default)
  const blocks = [];
  for (const id of hotIds) {
    blocks.push(formatHotBlock(id, index.rules[id]));
  }
  for (const item of selected) {
    blocks.push(formatFullBlock(item, index.rules[item.id]));
  }
  console.log(blocks.join('\n\n'));
}

function findRuleFile(root, id, domain) {
  for (const sub of ['rules', 'anti-patterns']) {
    const candidate = path.join(root, sub, domain, `${id}.md`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ? path.resolve(args.root) : path.join(repoRoot, '.agent/memory');
  const indexPath = args.index ? path.resolve(args.index) : path.join(root, 'compiled_rules_index.json');

  let changedPaths = [...args.paths];
  let addedLines = [];

  if (args.diffFile) {
    let diffText;
    try {
      diffText = fs.readFileSync(path.resolve(args.diffFile), 'utf-8');
    } catch (e) {
      console.error(`erro ao ler diff "${args.diffFile}": ${e.message}`);
      process.exitCode = 1;
      return;
    }
    const parsed = parseDiff(diffText);
    changedPaths = changedPaths.concat(parsed.changedPaths);
    addedLines = parsed.addedLines;
  }

  let index;
  try {
    index = loadIndex(indexPath);
  } catch (e) {
    failSafe(changedPaths);
    return;
  }

  if (!index || typeof index !== 'object' || !index.rules) {
    failSafe(changedPaths);
    return;
  }

  const changedDomains = domainsForPaths(changedPaths);
  const ctx = { changedPaths, addedLines, changedDomains };

  if (args.id) {
    const rule = index.rules[args.id];
    if (!rule) {
      console.error(`id "${args.id}" não encontrado no índice`);
      process.exitCode = 1;
      return;
    }
    const filePath = findRuleFile(root, args.id, rule.domain);
    if (!filePath) {
      console.error(`arquivo de origem de "${args.id}" não encontrado sob ${root}`);
      process.exitCode = 1;
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (args.json) {
      console.log(JSON.stringify({ id: args.id, path: path.relative(repoRoot, filePath), content }, null, 2));
    } else {
      console.log(content);
    }
    process.exitCode = 0;
    return;
  }

  const hotIds = (index.hot || []).slice().sort();
  const selected = selectRules(index, ctx, args.limit);

  printResults({ index, hotIds, selected, format: args.format, json: args.json, changedDomains });
  process.exitCode = 0;
}

// Só executa a CLI quando o arquivo é o entrypoint. Sem esta guarda, `import` de
// qualquer helper daqui roda o CLI inteiro como efeito colateral (medido: importar
// select-rules.mjs imprimia "fail-safe 056 ativado" e a seleção completa).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { globToRegExp, matchGlob, specificity, domainsForPath, domainsForPaths, parseDiff, scoreRule, selectRules };
