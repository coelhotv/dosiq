import yaml from 'js-yaml';
import { z } from 'zod';

// Domínios reconhecidos para a memória DEVFLOW (.agent/memory/{rules,anti-patterns}/<domain>/).
// Derivado da estrutura real de diretórios do acervo — ver CLAUDE.md §Estrutura.
export const DOMAINS = [
  'data_and_schema',
  'react_and_ui',
  'mobile_and_platform',
  'infra_and_deploy',
  'process_and_testing',
  'notifications',
  'test_hygiene',
  'tooling_and_build'
];

// Critérios de justificativa para layer: hot (O = objetivo/observável, S = subjetivo/sinal).
export const HOT_CRITERIA = ['O1', 'O2', 'O3', 'O4', 'O5', 'S1', 'S2', 'S3'];

// IDs reais do acervo incluem formatos irregulares: AP-W15, AP-H01, AP-LOG-001, R-025-1, AP-97.
// Um padrão \d{3} reprovaria 104 arquivos reais — manter permissivo.
export const ID_PATTERN = /^(R|AP)-[A-Z0-9]+(-\d+)?$/;

// Heurística de mapeamento glob/caminho → domínio (FR-011c e select-rules.mjs). Simples de
// propósito: checa se a string CONTÉM um dos "marcadores" de caminho abaixo. Não é um matcher
// de glob real. Vive aqui (módulo puro, sem side-effects de CLI) para ser importável tanto por
// scripts/validate-memory-schema.mjs quanto por scripts/select-rules.mjs sem disparar main().
export const DOMAIN_PATH_MARKERS = {
  data_and_schema: ['apps/web/src/schemas/', 'packages/core/src/schemas/', 'Schema', 'supabase/', '/services/'],
  react_and_ui: ['apps/web/src/features/', 'apps/web/src/views/', '.tsx'],
  mobile_and_platform: ['apps/mobile/'],
  infra_and_deploy: ['api/', '.github/', 'vercel.json'],
  notifications: ['server/bot/', 'server/notifications/'],
  process_and_testing: ['scripts/', '.agent/', 'docs/'],
  test_hygiene: ['.test.', '__tests__/'],
  tooling_and_build: ['packages/config/', 'packages/design-tokens/', '.config.js']
};

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be in YYYY-MM-DD format');

const appliesToSchema = z.object({
  paths: z.array(z.string()).min(1, 'applies_to.paths must have at least 1 element'),
  diff_triggers: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional()
});

const relatedSchema = z
  .object({
    rules: z.array(z.string()).optional(),
    anti_patterns: z.array(z.string()).optional()
  })
  .passthrough();

const hotReasonSchema = z.object({
  criteria: z
    .array(z.enum(HOT_CRITERIA))
    .min(1, 'hot_reason.criteria must have at least 1 element'),
  evidence: z.string().min(1, 'hot_reason.evidence cannot be empty')
});

// Campos comuns às três layers. `hot_reason` é tratado por branch no discriminatedUnion abaixo
// (obrigatório em hot, proibido em warm/cold) — de propósito não é um campo opcional solto aqui.
const baseFields = {
  title: z.string().min(1, 'title cannot be empty'),
  summary: z
    .string()
    .min(1, 'summary cannot be empty')
    .max(250, 'summary must be at most 250 characters'),
  status: z.enum(['active', 'archived', 'superseded']),
  applies_to: appliesToSchema,
  legacy_tags: z.array(z.string()).optional(),
  related: relatedSchema.optional(),
  origin: z.string().optional(),
  last_updated: dateStringSchema.optional(),
  // Ciclo de vida (078 Slice 2). Derivados dos traços pelo `recount-memory.mjs` e escritos de
  // volta pelo `migrate-memory-frontmatter.mjs --lifecycle`. Tipados de PROPÓSITO antes de existir
  // a escrita: sob `.passthrough()` o `--strict` aceitaria `incident_count: "muitos"` ou
  // `last_referenced: None` (o valor legado literal) e ficaria verde com lixo nos 611 arquivos.
  incident_count: z.number().int().min(0).optional(),
  last_referenced: dateStringSchema.optional()
};

const hotSchema = z
  .object({
    ...baseFields,
    layer: z.literal('hot'),
    hot_reason: hotReasonSchema
  })
  .passthrough();

const warmSchema = z
  .object({
    ...baseFields,
    layer: z.literal('warm'),
    // Presença da chave é proibida — z.never() reprova qualquer valor não-undefined.
    hot_reason: z.never().optional()
  })
  .passthrough();

const coldSchema = z
  .object({
    ...baseFields,
    layer: z.literal('cold'),
    hot_reason: z.never().optional()
  })
  .passthrough();

// .passthrough() em cada branch (não .strict()): o acervo tem dezenas de campos legados
// (incident_count, review_due, trigger_count, bootstrap_default, expiry_date, etc.) que devem
// ser tolerados, não reprovados.
export const memoryFrontmatterSchema = z.discriminatedUnion('layer', [
  hotSchema,
  warmSchema,
  coldSchema
]);

/**
 * Extrai e parseia o frontmatter YAML de um arquivo .md de memória.
 * Reaproveita a lógica de scripts/validate-frontmatter.mjs.
 * @param {string} fileContent
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function parseFrontmatter(fileContent) {
  const lines = fileContent.split(/\r?\n/);

  // code: 'missing_marker' -> não tem "---" (arquivo precisa de frontmatter escrito do zero).
  // code: 'invalid_yaml' -> tem "---" mas o conteúdo não é YAML válido ou não é objeto
  // (arquivo só precisa de correção pontual, ex.: aspas num escalar com ":").
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return {
      ok: false,
      code: 'missing_marker',
      error: 'Missing YAML frontmatter starting marker "---" at line 1'
    };
  }

  const closingIdx = lines.indexOf('---', 1);
  if (closingIdx === -1) {
    return {
      ok: false,
      code: 'missing_marker',
      error: 'Missing YAML frontmatter closing marker "---"'
    };
  }

  const frontmatterYaml = lines.slice(1, closingIdx).join('\n');
  let parsedYaml;
  try {
    parsedYaml = yaml.load(frontmatterYaml);
  } catch (e) {
    const line = typeof e.mark?.line === 'number' ? e.mark.line + 1 : null;
    return {
      ok: false,
      code: 'invalid_yaml',
      error: `Invalid YAML syntax${line !== null ? ` (linha ${line} do bloco frontmatter)` : ''}: ${e.message}`
    };
  }

  if (!parsedYaml || typeof parsedYaml !== 'object') {
    return {
      ok: false,
      code: 'invalid_yaml',
      error: 'Frontmatter must be a valid YAML object'
    };
  }

  return { ok: true, data: parsedYaml };
}
