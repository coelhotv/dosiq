#!/usr/bin/env node
/**
 * Create Issues - Workflow Intelligence v2.0
 *
 * Cria GitHub Issues para reviews MEDIUM com deduplicação via Supabase.
 * Integração com persist-reviews.cjs para eliminar duplicatas.
 *
 * Fluxo:
 * 1. Persiste reviews no Supabase (com deduplicação por hash)
 * 2. Busca issues pendentes (status='detected', priority='media')
 * 3. Cria issues no GitHub
 * 4. Atualiza Supabase com github_issue_number
 *
 * @module create-issues
 * @version 2.0.0
 * @requires ./persist-reviews.cjs
 * @requires @supabase/supabase-js
 * @requires zod
 */

const { persistReviews, calculateIssueHash } = require('./persist-reviews.cjs');
const { createClient } = require('@supabase/supabase-js');
const { z } = require('zod');
const fs = require('fs');

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Labels para issues de refactoring
const REFACTOR_LABELS = {
  GEMINI_REFACTOR: '🤖 gemini-refactor',
  REFACTORING: 'refactoring',
  TECH_DEBT: 'tech-debt'
};

// ============================================================================
// SCHEMAS ZOD
// ============================================================================

/**
 * Schema para dados de entrada do review
 */
const reviewDataSchema = z.object({
  pr_number: z.number().int().positive('Número do PR deve ser positivo'),
  commit_sha: z.string().min(1, 'Commit SHA é obrigatório'),
  issues: z.array(z.object({
    file_path: z.string().optional(),
    file: z.string().optional(),
    line_start: z.number().int().optional(),
    line: z.number().int().optional(),
    line_end: z.number().int().optional(),
    title: z.string().optional(),
    issue: z.string().optional(),
    description: z.string().optional(),
    suggestion: z.string().optional(),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    category: z.string().optional(),
    auto_fixable: z.boolean().optional()
  })).min(0)
});

/**
 * Schema para registro do Supabase
 */
const pendingIssueSchema = z.object({
  id: z.string().uuid(),
  pr_number: z.number().int().positive(),
  file_path: z.string(),
  line_start: z.number().int().nullable().optional(),
  line_end: z.number().int().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  suggestion: z.string().nullable().optional(),
  priority: z.enum(['critica', 'alta', 'media', 'baixa']),
  category: z.enum(['estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade', 'general']),
  issue_hash: z.string().length(64),
  status: z.string(),
  github_issue_number: z.number().int().positive().nullable().optional()
});

// ============================================================================
// FUNÇÕES PRINCIPAIS
// ============================================================================

/**
 * Cria GitHub Issues para reviews MEDIUM não-auto-fixable
 * COM deduplicação via hash no Supabase
 *
 * @param {Object} reviewData - Dados do review
 * @param {number} reviewData.pr_number - Número do PR
 * @param {string} reviewData.commit_sha - SHA do commit
 * @param {Array<Object>} reviewData.issues - Lista de issues
 * @param {number} prNumber - Número do PR (redundante, para compatibilidade)
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto do GitHub Actions
 * @returns {Promise<number[]>} Números das issues criadas
 */
async function createIssuesFromReview(reviewData, prNumber, github, context) {
  // Validar entrada
  const validation = reviewDataSchema.safeParse(reviewData);
  if (!validation.success) {
    console.error('❌ Erro de validação dos dados de review:', validation.error.format());
    throw new Error(`Dados de review inválidos: ${validation.error.message}`);
  }

  const validatedData = validation.data;
  console.log(`🔄 Criando issues para PR #${validatedData.pr_number}...`);

  // 1. PRIMEIRO: Persistir reviews no Supabase (com deduplicação)
  console.log('  Passo 1: Persistindo no Supabase...');
  const persistResult = await persistReviews(validatedData, {
    pr_number: validatedData.pr_number,
    commit_sha: validatedData.commit_sha
  });

  console.log(`  Resultado: ${persistResult.created} criadas, ${persistResult.updated} atualizadas, ${persistResult.skipped} ignoradas, ${persistResult.reactivated} reativadas`);

  // 2. Buscar issues que precisam ser criadas no GitHub
  // Apenas: status='detected' + priority='media' + sem github_issue_number
  console.log('  Passo 2: Buscando issues pendentes...');
  const pendingIssues = await fetchPendingIssues(validatedData.pr_number);

  if (pendingIssues.length === 0) {
    console.log('  ℹ️  Nenhuma issue pendente para criar');
    return [];
  }

  console.log(`  ${pendingIssues.length} issues pendentes encontradas`);

  // 3. Criar issues no GitHub
  const createdIssues = [];
  for (const issue of pendingIssues) {
    try {
      // Validar issue do Supabase
      const issueValidation = pendingIssueSchema.safeParse(issue);
      if (!issueValidation.success) {
        console.error(`    ❌ Issue ${issue.id} com dados inválidos:`, issueValidation.error.message);
        continue;
      }

      console.log(`  Criando issue: ${issue.title.substring(0, 50)}...`);

      const githubIssue = await createGitHubIssue(issue, validatedData.pr_number, github, context);

      // 4. Atualizar Supabase com referência
      await updateReviewStatus(issue.id, githubIssue.number);

      createdIssues.push(githubIssue.number);
      console.log(`    ✅ Issue #${githubIssue.number} criada`);

    } catch (error) {
      console.error(`    ❌ Erro ao criar issue para ${issue.title}:`, error.message);
    }
  }

  console.log(`\n✅ ${createdIssues.length} issues criadas no GitHub`);
  return createdIssues;
}

/**
 * Busca issues pendentes no Supabase
 * Critérios: status='detected', priority='media', sem github_issue_number
 *
 * @param {number} prNumber - Número do PR
 * @returns {Promise<Array<Object>>} Lista de issues pendentes
 * @throws {Error} Se houver erro na consulta
 */
async function fetchPendingIssues(prNumber) {
  const { data, error } = await supabase
    .from('gemini_reviews')
    .select('*')
    .eq('pr_number', prNumber)
    .eq('status', 'detected')
    .eq('priority', 'media')
    .is('github_issue_number', null)
    .limit(10); // Limitar para não sobrecarregar

  if (error) {
    console.error('Erro ao buscar issues pendentes:', error);
    throw new Error(`Falha ao buscar issues pendentes: ${error.message}`);
  }

  return data || [];
}

/**
 * Verifica se uma issue existe no Supabase pelo hash
 * Usado para deduplicação
 *
 * @param {string} hash - Hash SHA-256 da issue
 * @returns {Promise<Object|null>} Registro existente ou null
 * @throws {Error} Se houver erro na consulta
 */
async function checkExistingIssue(hash) {
  const { data, error } = await supabase
    .from('gemini_reviews')
    .select('id, status, github_issue_number, created_at, updated_at')
    .eq('issue_hash', hash)
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar hash existente:', error);
    throw new Error(`Falha ao verificar issue existente: ${error.message}`);
  }

  return data;
}

/**
 * Cria uma issue no GitHub
 *
 * @param {Object} issue - Dados da issue do Supabase
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto
 * @returns {Promise<Object>} Issue criada
 * @throws {Error} Se houver erro na criação
 */
async function createGitHubIssue(issue, prNumber, github, context) {
  const { owner, repo } = context.repo;

  // Construir corpo da issue
  const body = buildIssueBody(issue, prNumber);

  // Criar issue
  const { data: githubIssue } = await github.rest.issues.create({
    owner,
    repo,
    title: `[Refactor] ${issue.title}`,
    body: body,
    labels: [
      REFACTOR_LABELS.GEMINI_REFACTOR,
      REFACTOR_LABELS.REFACTORING,
      `priority:${issue.priority}`
    ]
  });

  // Comentar no PR linkando a issue
  try {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `🤖 **Gemini Code Assist** criou issue #${githubIssue.number} para tracking desta sugestão de refactoring.`
    });
  } catch (commentError) {
    // Não falhar se o comentário não puder ser criado
    console.warn(`  ⚠️  Não foi possível comentar no PR: ${commentError.message}`);
  }

  return githubIssue;
}

/**
 * Atualiza o status da review no Supabase após criar issue
 *
 * @param {string} id - UUID da review
 * @param {number} issueNumber - Número da issue no GitHub
 * @returns {Promise<void>}
 * @throws {Error} Se houver erro na atualização
 */
async function updateReviewStatus(id, issueNumber) {
  const { error } = await supabase
    .from('gemini_reviews')
    .update({
      status: 'reported',
      github_issue_number: issueNumber,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar status da review:', error);
    throw new Error(`Falha ao atualizar review ${id}: ${error.message}`);
  }
}

/**
 * Constrói o corpo da issue no GitHub
 *
 * @param {Object} issue - Dados da issue
 * @param {number} prNumber - Número do PR
 * @returns {string} Corpo formatado em Markdown
 */
function buildIssueBody(issue, prNumber) {
  const lines = [
    `## 📋 Sugestão de Refactoring`,
    ``,
    `**Detectado em:** PR #${prNumber}`,
    `**Arquivo:** \`${issue.file_path}\``,
    `**Linhas:** ${issue.line_start || 'N/A'}-${issue.line_end || 'N/A'}`,
    `**Categoria:** ${issue.category}`,
    `**Prioridade:** ${issue.priority}`,
    `**Hash:** \`${issue.issue_hash?.substring(0, 16)}...\``,
    ``,
    `### Descrição`,
    issue.description || 'Sem descrição detalhada',
    ``,
    `### Sugestão`,
    '```',
    issue.suggestion || 'Nenhuma sugestão específica',
    '```',
    ``,
    `---`,
    `*Esta issue foi criada automaticamente pelo Gemini Code Assist. O hash único garante que não haverá duplicatas.*`,
    `*Para reabrir após correção parcial, use o comando "/gemini reopen".*`
  ];

  return lines.join('\n');
}

// ============================================================================
// FUNÇÕES LEGADAS (mantidas para compatibilidade)
// ============================================================================

/**
 * Determina se uma issue deve ser criada baseada na análise do conteúdo
 * @deprecated Use shouldCreateIssue() com checkExistingIssue()
 * @param {Object} issue - A issue do review do Gemini
 * @returns {boolean} True se a issue deve ser criada
 */
function shouldCreateIssueLegacy(issue) {
  const ACTIONABLE_KEYWORDS = [
    'sugestão', 'sugestao', 'sugerir', 'suggested',
    'bug', 'erro', 'error', 'problem', 'problema',
    'melhoria', 'improvement', 'improve', 'melhorar',
    'crítico', 'critico', 'critical',
    'refatorar', 'refactor', 'refactoring',
    'extrair', 'extract', 'extracting',
    'consolidar', 'consolidate',
    'duplicado', 'duplicated', 'duplicate',
    'complexo', 'complex', 'complexity',
    'considerar', 'consider', 'considering'
  ];

  const COMPLIMENT_KEYWORDS = [
    'excelente', 'excellent', 'ótimo', 'otimo', 'great',
    'muito bom', 'very good', 'eficaz', 'effective',
    'essencial', 'essential', 'crucial',
    'inteligente', 'intelligent', 'smart',
    'bem implementado', 'well implemented',
    'boa prática', 'good practice'
  ];

  const MIN_SUGGESTION_LENGTH = 20;
  const text = (issue.issue || '').toLowerCase();

  // Deve ter keyword acionável
  const hasActionable = ACTIONABLE_KEYWORDS.some(kw => text.includes(kw));
  if (!hasActionable) return false;

  // Não deve ser elogio puro
  const isCompliment = COMPLIMENT_KEYWORDS.some(kw =>
    text.startsWith(kw) ||
    text.includes(`é ${kw}`) ||
    text.includes(`é uma ${kw}`) ||
    text.includes(`é uma solução ${kw}`)
  );
  if (isCompliment) return false;

  // Deve ter sugestão real de código
  const hasRealSuggestion = issue.suggestion &&
    issue.suggestion.trim().length > MIN_SUGGESTION_LENGTH &&
    !issue.suggestion.includes('Nenhuma sugestão');

  return hasRealSuggestion;
}

/**
 * Verifica se existe issue similar já criada (método legado)
 * @deprecated Use checkExistingIssue() com hash SHA-256
 * @param {Object} issue - Issue do review
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto
 * @returns {Promise<Object|null>} Issue existente ou null
 */
async function findSimilarIssue(issue, github, context) {
  const { owner, repo } = context.repo;

  // Buscar issues abertas com label gemini-refactor
  const { data: issues } = await github.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: REFACTOR_LABELS.GEMINI_REFACTOR,
    per_page: 100
  });

  // Verificar se alguma issue menciona o mesmo arquivo e linha similar
  for (const existingIssue of issues) {
    const titleMatch = existingIssue.title.match(/\[Refactor\]\s+([^:]+):/);
    const existingFile = titleMatch ? titleMatch[1] : null;
    const currentFile = issue.file?.split('/').pop();

    if (existingFile && currentFile && existingFile === currentFile) {
      const bodyMatch = existingIssue.body?.match(/linha\s+(\d+)/);
      const existingLine = bodyMatch ? parseInt(bodyMatch[1], 10) : null;

      if (existingLine && issue.line) {
        const lineDiff = Math.abs(existingLine - issue.line);
        if (lineDiff <= 5) {
          return existingIssue;
        }
      }
    }
  }

  return null;
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const reviewFile = args[0];

  if (!reviewFile) {
    console.error('❌ Uso: node create-issues.cjs <review-json-file>');
    console.error('');
    console.error('Exemplo:');
    console.error('  node create-issues.cjs review-data.json');
    process.exit(1);
  }

  try {
    const reviewData = JSON.parse(fs.readFileSync(reviewFile, 'utf-8'));
    console.log('ℹ️  Modo CLI não implementado - usar via GitHub Actions');
    console.log('   Dados carregados:', reviewData.pr_number, reviewData.commit_sha);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Erro ao carregar arquivo ${reviewFile}:`, error.message);
    process.exit(1);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Funções principais (Workflow Intelligence v2.0)
  createIssuesFromReview,
  fetchPendingIssues,
  checkExistingIssue,
  createGitHubIssue,
  updateReviewStatus,
  buildIssueBody,

  // Funções legadas (para compatibilidade)
  findSimilarIssue,

  // Constantes
  REFACTOR_LABELS
};
