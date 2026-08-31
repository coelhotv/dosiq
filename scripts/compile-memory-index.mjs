#!/usr/bin/env node
// Compila .agent/memory/{rules,anti-patterns}/**/*.md num índice único, minificado,
// para consumo por scripts/select-rules.mjs (RC6). Ver spec 060.
//
// Reusa DOMAINS/ID_PATTERN/parseFrontmatter/memoryFrontmatterSchema de
// scripts/schemas/memory-frontmatter.schema.mjs — não duplica a lógica de validação de campo,
// só orquestra o walk + filtro + serialização que o validador (scripts/validate-memory-schema.mjs)
// não faz.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath , pathToFileURL } from 'url';
import {
  DOMAINS,
  ID_PATTERN,
  memoryFrontmatterSchema,
  parseFrontmatter
} from './schemas/memory-frontmatter.schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const HOT_MAX_ENTRIES = parseInt(process.env.RC6_HOT_MAX_ENTRIES || '15', 10);
const HOT_MAX_BYTES = parseInt(process.env.RC6_HOT_MAX_BYTES || '8192', 10);

const SUBDIRS = ['rules', 'anti-patterns'];

function parseArgs(argv) {
  const args = { root: null, out: null, check: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') {
      args.root = argv[++i];
    } else if (arg.startsWith('--root=')) {
      args.root = arg.split('=').slice(1).join('=');
    } else if (arg === '--out') {
      args.out = argv[++i];
    } else if (arg.startsWith('--out=')) {
      args.out = arg.split('=').slice(1).join('=');
    } else if (arg === '--check') {
      args.check = true;
    }
  }
  return args;
}

function walkMd(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const entry of fs.readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      walkMd(entryPath, fileList);
    } else if (entry.endsWith('.md')) {
      fileList.push(entryPath);
    }
  }
  return fileList;
}

// Diretórios de domínio imediatos sob um MEMORY_ROOT (rules/ ou anti-patterns/).
function listDomainDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((entry) => fs.statSync(path.join(dir, entry)).isDirectory());
}

/**
 * Computa o sourceHash: sha256 sobre a lista ORDENADA de "caminho relativo:mtimeMs:tamanho"
 * de TODOS os .md em rules/ e anti-patterns/, válidos ou não — é o gate de frescor (FR-014),
 * não depende de terem passado o validador.
 */
function computeSourceHash(root) {
  const entries = [];
  for (const sub of SUBDIRS) {
    const files = walkMd(path.join(root, sub));
    for (const filePath of files) {
      const rel = path.relative(root, filePath);
      const stat = fs.statSync(filePath);
      entries.push(`${rel}:${stat.mtimeMs}:${stat.size}`);
    }
  }
  entries.sort();
  const hash = crypto.createHash('sha256');
  hash.update(entries.join('\n'));
  return hash.digest('hex');
}

/**
 * Valida um arquivo de memória (mesma lógica de scripts/validate-memory-schema.mjs, reimplementada
 * aqui em forma de função pura porque aquele script não exporta a checagem de arquivo único).
 * @returns {{ ok: true, data: object } | { ok: false, reason: string }}
 */
function validateFile(filePath, domain) {
  const id = path.basename(filePath, '.md');

  if (!ID_PATTERN.test(id)) {
    return { ok: false, reason: `id inválido: "${id}" não casa com ID_PATTERN` };
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return { ok: false, reason: `falha ao ler arquivo: ${e.message}` };
  }

  const parsed = parseFrontmatter(content);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.error };
  }

  const data = parsed.data;

  if (Array.isArray(data.applies_to)) {
    return {
      ok: false,
      reason: 'applies_to legado (array de tags) — incompatível com applies_to.paths'
    };
  }

  const result = memoryFrontmatterSchema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const fieldPath = first.path.join('.');
    return { ok: false, reason: `Campo "${fieldPath || '(raiz)'}": ${first.message}` };
  }

  return { ok: true, data: result.data };
}

function specificity(glob) {
  return glob.split('/').filter((seg) => seg.length > 0 && !seg.includes('*')).length;
}

function buildIndex(root) {
  const fatalErrors = [];
  const skipped = [];
  const rules = {};
  const byPath = {};
  const byTrigger = {};
  const hot = [];
  const counts = { total: 0, byDomain: {}, byLayer: { hot: 0, warm: 0, cold: 0 } };

  for (const sub of SUBDIRS) {
    const subDir = path.join(root, sub);
    const domainDirs = listDomainDirs(subDir);
    for (const domain of domainDirs) {
      if (!DOMAINS.includes(domain)) {
        fatalErrors.push(
          `diretório fora de DOMAINS: "${sub}/${domain}" (esperado um de: ${DOMAINS.join(', ')})`
        );
        continue;
      }

      const domainDir = path.join(subDir, domain);
      const files = fs
        .readdirSync(domainDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(domainDir, f));

      for (const filePath of files) {
        const id = path.basename(filePath, '.md');
        const relPath = path.relative(repoRoot, filePath);
        const validated = validateFile(filePath, domain);

        if (!validated.ok) {
          skipped.push({ id, path: relPath, reason: validated.reason });
          continue;
        }

        const data = validated.data;

        if (data.status === 'archived' || data.status === 'superseded') {
          skipped.push({ id, path: relPath, reason: `status: ${data.status} — excluído do índice` });
          continue;
        }

        const paths = data.applies_to.paths;
        const diffTriggers = data.applies_to.diff_triggers || [];
        const keywords = data.applies_to.keywords || [];

        const entry = {
          title: data.title,
          summary: data.summary,
          domain,
          layer: data.layer,
          paths,
          diff_triggers: diffTriggers,
          keywords
        };
        if (data.layer === 'hot') {
          entry.hot_reason = data.hot_reason;
        }

        rules[id] = entry;

        for (const glob of paths) {
          if (!byPath[glob]) byPath[glob] = [];
          byPath[glob].push(id);
        }
        for (const trigger of diffTriggers) {
          if (!byTrigger[trigger]) byTrigger[trigger] = [];
          byTrigger[trigger].push(id);
        }
        if (data.layer === 'hot') {
          hot.push(id);
        }

        counts.total++;
        counts.byDomain[domain] = (counts.byDomain[domain] || 0) + 1;
        counts.byLayer[data.layer] = (counts.byLayer[data.layer] || 0) + 1;
      }
    }
  }

  return { fatalErrors, skipped, rules, byPath, byTrigger, hot, counts };
}

// Escaneia TODO o acervo (rules/ + anti-patterns/, só domínios válidos) por `layer: hot` no
// frontmatter cru — best-effort, sem exigir passagem no validador completo. O teto de hot
// (FR-010) é sobre o que SERIA injetado sempre no prompt hoje, e isso independe de o arquivo
// estar 100% migrado para o schema novo: um arquivo com `layer: hot` mas `applies_to` no
// formato legado ainda É, na prática, hot — ele só não entra no índice COMPILADO (esse sim
// exige o validador completo). Ver spec 060: acervo real tem 605/605 reprovando o validador
// completo, mas ~62 arquivos têm `layer: hot` no frontmatter — o teto tem que enxergar esses.
function collectRawHotCandidates(root) {
  const results = [];
  for (const sub of SUBDIRS) {
    const subDir = path.join(root, sub);
    const domainDirs = listDomainDirs(subDir).filter((d) => DOMAINS.includes(d));
    for (const domain of domainDirs) {
      const domainDir = path.join(subDir, domain);
      const files = fs
        .readdirSync(domainDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(domainDir, f));

      for (const filePath of files) {
        const id = path.basename(filePath, '.md');
        let content;
        try {
          content = fs.readFileSync(filePath, 'utf-8');
        } catch {
          continue;
        }
        const parsed = parseFrontmatter(content);
        if (!parsed.ok) continue;
        const data = parsed.data;
        if (data.layer !== 'hot') continue;
        if (data.status === 'archived' || data.status === 'superseded') continue;

        results.push({
          id,
          domain,
          title: typeof data.title === 'string' ? data.title : id,
          bytes: Buffer.byteLength(content, 'utf-8'),
          path: path.relative(repoRoot, filePath)
        });
      }
    }
  }
  return results;
}

function checkHotBudget(rawHotCandidates) {
  const details = rawHotCandidates;
  const totalBytes = details.reduce((sum, d) => sum + d.bytes, 0);

  const overEntries = details.length > HOT_MAX_ENTRIES;
  const overBytes = totalBytes > HOT_MAX_BYTES;

  return { details, totalBytes, overEntries, overBytes };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ? path.resolve(args.root) : path.join(repoRoot, '.agent/memory');
  const outPath = args.out ? path.resolve(args.out) : path.join(root, 'compiled_rules_index.json');

  const sourceHash = computeSourceHash(root);

  if (args.check) {
    let existing;
    try {
      existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    } catch (e) {
      console.error(`índice desatualizado: recompile (não foi possível ler "${outPath}": ${e.message})`);
      process.exitCode = 1;
      return;
    }
    if (existing?.meta?.sourceHash !== sourceHash) {
      console.error('índice desatualizado: recompile');
      process.exitCode = 1;
      return;
    }
    console.log(`índice em dia (sourceHash ${sourceHash.slice(0, 12)}…)`);
    process.exitCode = 0;
    return;
  }

  const { fatalErrors, skipped, rules, byPath, byTrigger, hot, counts } = buildIndex(root);

  if (fatalErrors.length > 0) {
    console.error('Falha ao compilar índice — diretório(s) de domínio inválido(s):');
    for (const err of fatalErrors) {
      console.error(`  - ${err}`);
    }
    process.exitCode = 1;
    return;
  }

  const rawHotCandidates = collectRawHotCandidates(root);
  const budget = checkHotBudget(rawHotCandidates);
  if (budget.overEntries || budget.overBytes) {
    console.error(
      `Falha: layer "hot" excede o teto (RC6_HOT_MAX_ENTRIES=${HOT_MAX_ENTRIES}, RC6_HOT_MAX_BYTES=${HOT_MAX_BYTES}).`
    );
    console.error(
      `  Entradas hot: ${budget.details.length} (${budget.overEntries ? 'EXCEDE' : 'ok'}) | Bytes hot: ${budget.totalBytes} (${budget.overBytes ? 'EXCEDE' : 'ok'})`
    );
    console.error('  Entradas hot atuais:');
    for (const d of budget.details.slice().sort((a, b) => b.bytes - a.bytes)) {
      console.error(`    - ${d.id} (${d.bytes}B) — ${d.title}`);
    }
    if (budget.overEntries) {
      console.error(
        `  Despejar ao menos ${budget.details.length - HOT_MAX_ENTRIES} entrada(s) hot para "warm"/"cold".`
      );
    }
    if (budget.overBytes) {
      console.error(
        `  Reduzir ao menos ${budget.totalBytes - HOT_MAX_BYTES} byte(s) do conjunto hot (despejo ou summary mais curto).`
      );
    }
    process.exitCode = 1;
    return;
  }

  const index = {
    rules,
    byPath,
    byTrigger,
    hot,
    meta: {
      generatedAt: new Date().toISOString(),
      sourceHash,
      counts,
      skipped
    }
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(index));

  console.log(
    `Índice compilado: ${counts.total} regra(s) válida(s), ${skipped.length} pulada(s), ${hot.length} hot. -> ${outPath}`
  );
  process.exitCode = 0;
}

// Só executa a CLI quando o arquivo é o entrypoint. Sem esta guarda, `import` de
// qualquer helper daqui roda o CLI inteiro como efeito colateral (medido: importar
// select-rules.mjs imprimia "fail-safe 056 ativado" e a seleção completa).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { specificity, computeSourceHash, validateFile };
