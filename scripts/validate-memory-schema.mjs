import fs from 'fs';
import path from 'path';
import { fileURLToPath , pathToFileURL } from 'url';
import {
  DOMAINS,
  DOMAIN_PATH_MARKERS,
  ID_PATTERN,
  memoryFrontmatterSchema,
  parseFrontmatter
} from './schemas/memory-frontmatter.schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MEMORY_ROOTS = [
  path.join(rootDir, '.agent/memory/rules'),
  path.join(rootDir, '.agent/memory/anti-patterns')
];

const CLAUDE_MD_PATH = path.join(rootDir, 'CLAUDE.md');

const ERROR_CLASSES = [
  'sem_frontmatter',
  'frontmatter_invalido',
  'applies_to_legado',
  'hot_sem_hot_reason',
  'o4',
  'filtro_zero',
  'status_invalido',
  'outros'
];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

function getFilesRecursively(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const entryPath = path.join(dir, entry);
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      getFilesRecursively(entryPath, fileList);
    } else if (entry.endsWith('.md')) {
      fileList.push(entryPath);
    }
  }
  return fileList;
}

function domainsForGlob(glob) {
  const matched = new Set();
  for (const [domain, markers] of Object.entries(DOMAIN_PATH_MARKERS)) {
    if (markers.some((marker) => glob.includes(marker))) {
      matched.add(domain);
    }
  }
  return matched;
}

function domainsReachedByPaths(paths) {
  const reached = new Set();
  for (const glob of paths) {
    if (typeof glob !== 'string') continue;
    for (const domain of domainsForGlob(glob)) {
      reached.add(domain);
    }
  }
  return reached;
}

// Checa se `id` aparece no CLAUDE.md como TOKEN próprio, não como substring de outro id
// (ex.: "R-069" não deve casar dentro de "ADR-069"). Não usa \b do JS pois '-' não é \w.
function idAppearsAsTokenIn(content, id) {
  let fromIndex = 0;
  while (true) {
    const idx = content.indexOf(id, fromIndex);
    if (idx === -1) return false;
    const before = idx > 0 ? content[idx - 1] : '';
    const after = idx + id.length < content.length ? content[idx + id.length] : '';
    const beforeOk = !/[A-Za-z0-9]/.test(before);
    const afterOk = !/[A-Za-z0-9]/.test(after);
    if (beforeOk && afterOk) return true;
    fromIndex = idx + id.length;
  }
}

// Extrai o primeiro número presente no id (após o prefixo R-/AP-), para o filtro --batch 1.
// Ex.: R-283 -> 283, AP-W15 -> 15, AP-LOG-001 -> 1, R-025-1 -> 25 (primeiro número encontrado).
// Ids sem número extraível (nenhum caso hoje, mas hipoteticamente) retornam null e são
// excluídos do batch 1 (não dá pra afirmar se são >=250).
function extractIdNumber(id) {
  const match = id.match(/\d+/);
  if (!match) return null;
  return parseInt(match[0], 10);
}

function makeReport() {
  return {
    checked: 0,
    ok: 0,
    withErrors: 0,
    errorClassCounts: Object.fromEntries(ERROR_CLASSES.map((c) => [c, 0])),
    files: []
  };
}

function addError(fileReport, errorClass, message) {
  fileReport.errors.push({ class: errorClass, message });
}

function addWarning(fileReport, message) {
  fileReport.warnings.push(message);
}

function validateOneFile(filePath, { strict, claudeMdContent }) {
  const id = path.basename(filePath, '.md');
  const domain = path.basename(path.dirname(filePath));
  const relPath = path.relative(rootDir, filePath);

  const fileReport = { path: relPath, id, domain, errors: [], warnings: [] };

  if (!ID_PATTERN.test(id)) {
    addError(fileReport, 'outros', `id inválido: "${id}" não casa com ID_PATTERN`);
  }

  if (!DOMAINS.includes(domain)) {
    addError(fileReport, 'outros', `domain inválido: diretório-pai "${domain}" não está em DOMAINS`);
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    addError(fileReport, 'outros', `falha ao ler arquivo: ${e.message}`);
    return fileReport;
  }

  const parsed = parseFrontmatter(content);
  if (!parsed.ok) {
    const errorClass = parsed.code === 'invalid_yaml' ? 'frontmatter_invalido' : 'sem_frontmatter';
    addError(fileReport, errorClass, parsed.error);
    return fileReport;
  }

  const data = parsed.data;

  // FR-020 (crítico): applies_to legado como array de tags.
  let skipZod = false;
  if (Array.isArray(data.applies_to)) {
    addError(
      fileReport,
      'applies_to_legado',
      'applies_to legado (array de tags) é incompatível com applies_to.paths (objeto de globs) — mover para legacy_tags'
    );
    skipZod = true;
  }

  // FR-022: layer vazado em status / status obsoleto.
  let statusHandledExplicitly = false;
  if (['hot', 'warm', 'cold'].includes(data.status)) {
    addError(
      fileReport,
      'status_invalido',
      `status "${data.status}" é layer vazado em status — status deve ser active/archived/superseded, layer é campo separado`
    );
    statusHandledExplicitly = true;
  } else if (data.status === 'obsolete') {
    addError(
      fileReport,
      'status_invalido',
      'status "obsolete" deve ser normalizado para "archived"'
    );
    statusHandledExplicitly = true;
  }

  if (!skipZod) {
    const result = memoryFrontmatterSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const fieldPath = issue.path.join('.');
        if (statusHandledExplicitly && issue.path[0] === 'status') {
          // já reportado com mensagem dedicada acima — evita duplicar o mesmo defeito.
          continue;
        }
        if (issue.path[0] === 'hot_reason') {
          addError(fileReport, 'hot_sem_hot_reason', `Campo "${fieldPath}": ${issue.message}`);
        } else {
          addError(fileReport, 'outros', `Campo "${fieldPath || '(raiz)'}": ${issue.message}`);
        }
      }
    }
  }

  // FR-011c / O4: cobertura de domínios para layer hot.
  if (data.layer === 'hot') {
    const paths = Array.isArray(data.applies_to?.paths) ? data.applies_to.paths : [];
    const reached = domainsReachedByPaths(paths);
    if (reached.size < 3) {
      const msg = `O4: applies_to.paths alcança apenas ${reached.size}/8 domínios (mínimo 3 para layer hot)`;
      if (strict) {
        addError(fileReport, 'o4', msg);
      } else {
        addWarning(fileReport, msg);
      }
    }

    // FR-011d: filtro zero — hot redundante com CLAUDE.md.
    if (idAppearsAsTokenIn(claudeMdContent, id)) {
      addError(
        fileReport,
        'filtro_zero',
        `hot redundante: ${id} já é injetado inteiro pelo CLAUDE.md`
      );
    }
  }

  return fileReport;
}

function parseArgs(argv) {
  const args = { strict: false, batch: null, json: false, summary: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict') args.strict = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--summary') args.summary = true;
    else if (arg === '--batch') {
      args.batch = parseInt(argv[i + 1], 10);
      i++;
    } else if (arg.startsWith('--batch=')) {
      args.batch = parseInt(arg.split('=')[1], 10);
    }
  }
  return args;
}

function filterByBatch(files, batch) {
  if (batch === null || Number.isNaN(batch)) return files;

  if (batch !== 1) {
    console.log(
      `${colors.yellow}Aviso:${colors.reset} --batch ${batch} não implementado (só --batch 1 é suportado — arquivos são agrupados por domínio no FR-009, não determinável genericamente aqui). Processando TODOS os arquivos, sem filtro de lote.`
    );
    return files;
  }

  return files.filter((filePath) => {
    const id = path.basename(filePath, '.md');
    const num = extractIdNumber(id);
    return num !== null && num >= 250;
  });
}

function printTextReport(report, { summary }) {
  if (!summary) {
    for (const file of report.files) {
      const hasErrors = file.errors.length > 0;
      if (hasErrors) {
        console.error(`${colors.red}${colors.bold}✗ Fail:${colors.reset} ${file.path}`);
        for (const err of file.errors) {
          console.error(`  - [${err.class}] ${err.message}`);
        }
      } else {
        console.log(`${colors.green}✓ OK:${colors.reset} ${file.path}`);
      }
      for (const warn of file.warnings) {
        console.log(`  ${colors.yellow}⚠ Aviso:${colors.reset} ${warn}`);
      }
    }
    console.log('');
  }

  console.log(`${colors.bold}=== Agregado ===${colors.reset}`);
  console.log(`Total verificado: ${report.checked}`);
  console.log(`${colors.green}Total OK: ${report.ok}${colors.reset}`);
  console.log(`${colors.red}Total com erro: ${report.withErrors}${colors.reset}`);
  console.log(`${colors.bold}Por classe de erro:${colors.reset}`);
  for (const cls of ERROR_CLASSES) {
    console.log(`  ${cls}: ${report.errorClassCounts[cls]}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let files = [];
  for (const memoryRoot of MEMORY_ROOTS) {
    files = files.concat(getFilesRecursively(memoryRoot));
  }
  files = Array.from(new Set(files));
  files = filterByBatch(files, args.batch);

  let claudeMdContent = '';
  try {
    claudeMdContent = fs.readFileSync(CLAUDE_MD_PATH, 'utf-8');
  } catch (e) {
    console.error(`${colors.yellow}Aviso:${colors.reset} não foi possível ler CLAUDE.md (${e.message}) — checagem FR-011d (filtro zero) ficará sempre negativa.`);
  }

  const report = makeReport();

  for (const filePath of files) {
    const fileReport = validateOneFile(filePath, { strict: args.strict, claudeMdContent });
    report.checked++;
    report.files.push(fileReport);
    if (fileReport.errors.length > 0) {
      report.withErrors++;
      for (const err of fileReport.errors) {
        report.errorClassCounts[err.class] = (report.errorClassCounts[err.class] || 0) + 1;
      }
    } else {
      report.ok++;
    }
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report, { summary: args.summary });
  }

  if (args.strict && report.withErrors > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

// Só executa a CLI quando o arquivo é o entrypoint. Sem esta guarda, `import` de
// qualquer helper daqui roda o CLI inteiro como efeito colateral (medido: importar
// select-rules.mjs imprimia "fail-safe 056 ativado" e a seleção completa).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
