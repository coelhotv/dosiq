#!/usr/bin/env node
/**
 * migrate-memory-frontmatter.mjs — 060 Fase A.
 *
 * Leva os 605 arquivos de `.agent/memory/{rules,anti-patterns}/**` ao schema do
 * `memory-frontmatter.schema.mjs` SEM LLM, derivando cada campo de uma fonte
 * verificável dentro do próprio repositório:
 *
 *   title          <- o `# H1` do arquivo (252 de 253 sem-frontmatter têm)
 *   summary        <- a LINHA CURADA do índice .md (605/605 cobertos), 1ª frase, <=250c
 *   domain         <- o diretório
 *   layer          <- `warm` (nunca `hot`: hot é orçamento de bytes, decisão humana)
 *   applies_to     <- piso por domínio (inversão do map_path_to_packs do ai-review.sh)
 *   diff_triggers  <- identificadores em backtick no corpo
 *   keywords       <- tokens do título
 *   legacy_tags    <- o applies_to legado (array de tags), MOVIDO
 *
 * 🔴 O `summary` não é gerado, é EXTRAÍDO. As linhas de RULES_INDEX.md e
 * ANTI_PATTERNS_INDEX.md já são resumos escritos à mão, um por memória — mandar um
 * modelo reescrever o que um humano já escreveu é pagar para perder informação.
 *
 * 🔴 O corpo do arquivo NUNCA é tocado: o script só substitui (ou insere) o bloco de
 * frontmatter. Isso é o que torna o diff de 593 arquivos auditável.
 *
 * Uso:
 *   node scripts/migrate-memory-frontmatter.mjs            # dry-run (default)
 *   node scripts/migrate-memory-frontmatter.mjs --report   # o que cada arquivo ganharia
 *   node scripts/migrate-memory-frontmatter.mjs --apply    # escreve
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { memoryFrontmatterSchema, parseFrontmatter } from './schemas/memory-frontmatter.schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const MEM = path.join(REPO, '.agent/memory');
const CATALOGS = [
  { dir: path.join(MEM, 'rules'), index: path.join(MEM, 'RULES_INDEX.md') },
  { dir: path.join(MEM, 'anti-patterns'), index: path.join(MEM, 'ANTI_PATTERNS_INDEX.md') }
];

// Inversão do map_path_to_packs() (ai-review.sh:314-328). É um PISO: garante que toda
// regra seja alcançável pelo seletor. Não é o alvo — glob de domínio tem especificidade
// baixa e pontua pouco; quem discrimina são diff_triggers (+8) e keywords (+2).
// Piso por domínio. 🔴 DELIBERADAMENTE RASO. O score de caminho do seletor é
// 10 x (nº de segmentos do glob), então `apps/web/src/features/**` — que é a UI web
// INTEIRA — valia 40 pontos, os mesmos de `packages/core/src/utils/**`, que é
// específico de verdade. Glob derivado por script não pode parecer mais específico do
// que é: ele afirma só "esta regra é deste domínio", e é isso que deve pontuar.
// Quem discrimina é `diff_triggers` (+8 cada) e `keywords` (+2), não o piso.
// Medido: com piso profundo, recall@5 nos PRs #812/#801/#768 foi 1/6.
const DOMAIN_PATH_FLOOR = {
  data_and_schema: ['packages/**', '**/schemas/**'],
  react_and_ui: ['apps/web/**'],
  mobile_and_platform: ['apps/mobile/**'],
  infra_and_deploy: ['api/**'],
  notifications: ['server/**'],
  process_and_testing: ['scripts/**', 'docs/**'],
  test_hygiene: ['**/__tests__/**'],
  tooling_and_build: ['packages/config/**', 'packages/design-tokens/**']
};


const STOPWORDS = new Set([
  'a','o','as','os','de','da','do','das','dos','em','no','na','nos','nas','um','uma','para','por',
  'que','com','sem','ao','aos','e','ou','se','the','of','to','in','on','is','are','not','and','or',
  'nao','não','é','ser','tem','the','por','pelo','pela','mais','menos','como','quando','onde','que'
]);

// Tokens em backtick que não discriminam nada — apareceriam em quase todo arquivo.
const TRIGGER_NOISE = new Set([
  'true','false','null','undefined','string','number','boolean','object','array','void','any',
  'const','let','var','function','return','async','await','import','export','default','type',
  'R-221','TODO','FIXME','npm','node','git','bash','json','yaml','md','ts','tsx','js','mjs'
]);

function readIndexSummaries(indexPath) {
  const map = new Map();
  if (!fs.existsSync(indexPath)) return map;
  for (const raw of fs.readFileSync(indexPath, 'utf-8').split(/\r?\n/)) {
    const m = raw.trim().match(/^-\s+\*\*\[([A-Z]+-[A-Z0-9-]+)\]\*\*\s*(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

/** Prosa do índice -> summary <=250c: tira o link final, a marcação e corta na 1ª frase. */
export function summaryFromIndexLine(line) {
  if (!line) return '';
  let s = line
    .replace(/\s*->\s*\[`[^`]*`\]\([^)]*\)\s*$/, '')   // link do arquivo no fim
    .replace(/\[\[([^\]]+)\]\]/g, '$1')                 // wikilinks
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')            // links markdown
    .replace(/[*_`]/g, '')                              // ênfase e code spans
    .replace(/[🔴🟡🟢⚠️📌🚀💧🎯🎉📏🔻]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  // corta na 1ª sentença, mas só se ela já for substancial — frases curtas demais
  // ("Não fazer X.") perderiam o que vem depois, que é onde mora o porquê.
  const firstStop = s.search(/[.;·](\s|$)/);
  if (firstStop > 60) s = s.slice(0, firstStop + 1);
  if (s.length > 250) s = s.slice(0, 247).replace(/\s+\S*$/, '') + '…';
  return s.trim();
}

export function titleFromBody(body, id) {
  const m = body.match(/^#\s+(.+)$/m);
  if (!m) return '';
  return m[1]
    .replace(new RegExp(`^\\[?${id}\\]?\\s*[—:–-]?\\s*`), '')
    .replace(/[*_`]/g, '')
    .trim();
}

export function keywordsFromTitle(title) {
  const out = [];
  for (const w of (title || '').toLowerCase().match(/[a-zà-ú][a-zà-ú0-9_]{2,}/gu) || []) {
    if (STOPWORDS.has(w) || out.includes(w)) continue;
    out.push(w);
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Identificadores que de fato apareceriam num diff. Duas fontes: backticks inline
 * (sinal forte — o autor destacou) e blocos de código (sinal fraco, mas é onde moram
 * os nomes reais). O filtro exige SEPARADOR — camelCase, snake_case, ponto ou `(` —
 * porque sem ele entram palavras de prosa em backtick (`with`, `p.m.`), que casam com
 * qualquer diff e destroem a precisão do score (+8 por trigger).
 */
export function triggersFromBody(body) {
  const looksLikeIdentifier = (tok) => {
    if (tok.length < 4 || tok.length > 48) return false;
    if (TRIGGER_NOISE.has(tok)) return false;
    if (/^\.?[A-Za-z_$][A-Za-z0-9_$]*\($/.test(tok)) return true;           // chamada: .select(
    if (/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]+)+$/.test(tok)) return true; // tabela.coluna
    if (/[a-z][A-Z]/.test(tok) && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(tok)) return true;     // camelCase
    if (/^[a-zà-ú][a-zà-ú0-9]*(_[a-zà-ú0-9]+)+$/u.test(tok)) return true;              // snake_case
    if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(tok)) return true;              // CONST_CASE
    return false;
  };

  const freq = new Map();
  const bump = (tok, weight) => {
    const t = tok.trim().replace(/[,;:]+$/, '');
    if (looksLikeIdentifier(t)) freq.set(t, (freq.get(t) || 0) + weight);
  };

  // 1. backticks inline — peso 3 (o autor escolheu destacar)
  const withoutFences = body.replace(/```[\s\S]*?```/g, '');
  for (const m of withoutFences.matchAll(/`([^`\n]{3,60})`/g)) bump(m[1], 3);

  // 2. blocos de código — peso 1
  for (const fence of body.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
    for (const m of fence[1].matchAll(/[A-Za-zà-ú_$][A-Za-zà-ú0-9_$.]{3,47}/gu)) bump(m[0], 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([t]) => t);
}

function splitFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') return { fm: null, body: content };
  const end = lines.indexOf('---', 1);
  if (end === -1) return { fm: null, body: content };
  return { fm: lines.slice(1, end).join('\n'), body: lines.slice(end + 1).join('\n').replace(/^\n/, '') };
}

/** Constrói o frontmatter final. Preserva TODO campo legado (o schema é passthrough). */
export function buildFrontmatter(existing, { id, domain, body, indexLine }) {
  const fm = { ...(existing || {}) };

  // applies_to legado = array de tags -> legacy_tags. Nunca vira glob: a tag `all`
  // viraria "casa com tudo" e o seletor devolveria o catálogo inteiro por dentro.
  if (Array.isArray(fm.applies_to)) {
    fm.legacy_tags = [...new Set([...(fm.legacy_tags || []), ...fm.applies_to.map(String)])];
    delete fm.applies_to;
  }
  // `pack` diverge do diretório em 189 arquivos; o domínio passa a sair do caminho.
  if (fm.pack !== undefined) {
    fm.legacy_pack = fm.pack;
    delete fm.pack;
  }
  if (Array.isArray(fm.related)) {
    const rules = fm.related.filter((r) => /^R-/.test(String(r)));
    const aps = fm.related.filter((r) => /^AP-/.test(String(r)));
    fm.related = {};
    if (rules.length) fm.related.rules = rules;
    if (aps.length) fm.related.anti_patterns = aps;
    if (!rules.length && !aps.length) delete fm.related;
  }

  if (!fm.title) fm.title = titleFromBody(body, id) || id;
  if (typeof fm.summary !== 'string' || !fm.summary.trim() || fm.summary.length > 250) {
    const derived = summaryFromIndexLine(indexLine);
    if (derived) fm.summary = derived;
    else if (typeof fm.summary === 'string' && fm.summary.length > 250) fm.summary = fm.summary.slice(0, 247).replace(/\s+\S*$/, '') + '…';
    else fm.summary = fm.title;
  }
  // `resolved` não existe no enum. Um AP "resolvido" é um padrão que deixou de valer:
  // `archived`. Registrado em legacy_status para a decisão não sumir no diff.
  if (fm.status === 'resolved') { fm.legacy_status = 'resolved'; fm.status = 'archived'; }
  if (!['active', 'archived', 'superseded'].includes(fm.status)) fm.status = 'active';

  if (fm.layer !== 'hot' && fm.layer !== 'cold') fm.layer = 'warm';
  if (fm.layer !== 'hot') delete fm.hot_reason;   // z.never() reprova a chave presente

  const ap = (fm.applies_to && typeof fm.applies_to === 'object') ? { ...fm.applies_to } : {};
  if (!Array.isArray(ap.paths) || ap.paths.length === 0) ap.paths = DOMAIN_PATH_FLOOR[domain] || ['**/*'];
  if (!Array.isArray(ap.diff_triggers) || ap.diff_triggers.length === 0) {
    const t = triggersFromBody(body);
    if (t.length) ap.diff_triggers = t;
  }
  if (!Array.isArray(ap.keywords) || ap.keywords.length === 0) {
    const k = keywordsFromTitle(fm.title);
    if (k.length) ap.keywords = k;
  }
  fm.applies_to = ap;

  return fm;
}

const KEY_ORDER = ['title', 'summary', 'layer', 'status', 'domain', 'applies_to', 'hot_reason', 'related', 'legacy_tags', 'origin', 'last_updated'];
function serialize(fm) {
  const ordered = {};
  for (const k of KEY_ORDER) if (fm[k] !== undefined) ordered[k] = fm[k];
  for (const k of Object.keys(fm).sort()) if (ordered[k] === undefined) ordered[k] = fm[k];
  return yaml.dump(ordered, { lineWidth: 100, noRefs: true, quotingType: '"' });
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const report = args.includes('--report');

  const stats = { total: 0, skipped: 0, migrated: 0, failed: 0, noIndexLine: 0 };
  const failures = [];

  for (const { dir, index } of CATALOGS) {
    const summaries = readIndexSummaries(index);
    for (const domain of fs.readdirSync(dir)) {
      const dpath = path.join(dir, domain);
      if (!fs.statSync(dpath).isDirectory()) continue;
      for (const file of fs.readdirSync(dpath).sort()) {
        if (!file.endsWith('.md')) continue;
        const fpath = path.join(dpath, file);
        const id = file.replace(/\.md$/, '');
        stats.total++;

        const content = fs.readFileSync(fpath, 'utf-8');
        const parsed = parseFrontmatter(content);
        if (parsed.ok && memoryFrontmatterSchema.safeParse(parsed.data).success) { stats.skipped++; continue; }

        const { fm: rawFm, body } = splitFrontmatter(content);
        let existing = null;
        // 🔴 CORE_SCHEMA, não o default: o schema default do js-yaml tem o tipo
        // `timestamp` e converte `created_at: 2026-04-26` num Date, que volta
        // serializado como `2026-04-26T00:00:00.000Z`. São campos LEGADOS que o modelo
        // de ciclo de vida do SKILL.md lê (expiry_date, review_due) — reescrever o
        // formato deles seria mudar dado que este script não tem mandato para tocar.
        if (rawFm !== null) {
          try {
            existing = yaml.load(rawFm, { schema: yaml.CORE_SCHEMA }) || {};
          } catch (e) {
            // 🔴 NÃO cair para `{}`. Frontmatter ilegível com fallback silencioso significa
            // reescrever o arquivo SEM os campos legados — perda de dado que o diff de 593
            // arquivos esconderia. Hoje isto não dispara (auditado: 0 casos), e é justamente
            // por isso que precisa falhar alto se um dia disparar.
            stats.failed++;
            failures.push(`${path.relative(REPO, fpath)} :: frontmatter ilegível (${e.message.slice(0, 60)}) — PULADO para não perder campos`);
            continue;
          }
        }

        const indexLine = summaries.get(id);
        if (!indexLine) stats.noIndexLine++;

        const built = buildFrontmatter(existing, { id, domain, body, indexLine });
        const check = memoryFrontmatterSchema.safeParse(built);
        if (!check.success) {
          stats.failed++;
          failures.push(`${path.relative(REPO, fpath)} :: ${check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ')}`);
          continue;
        }
        stats.migrated++;
        if (report) {
          console.log(`${path.relative(REPO, fpath)}\n  title:   ${built.title}\n  summary: ${built.summary}\n  paths:   ${built.applies_to.paths.join(', ')}\n  trig:    ${(built.applies_to.diff_triggers || []).join(', ') || '—'}`);
        }
        if (apply) fs.writeFileSync(fpath, `---\n${serialize(built)}---\n\n${body.replace(/^\n+/, '')}`, 'utf-8');
      }
    }
  }

  console.log(`\ntotal=${stats.total} já-válidos=${stats.skipped} migráveis=${stats.migrated} SEM-SOLUÇÃO=${stats.failed} sem-linha-de-índice=${stats.noIndexLine}`);
  if (failures.length) {
    console.log('\nnão resolvidos (precisam de mão):');
    for (const f of failures.slice(0, 20)) console.log('  ' + f);
    if (failures.length > 20) console.log(`  … +${failures.length - 20}`);
  }
  if (!apply) console.log('\n(dry-run — nada escrito; use --apply)');
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
