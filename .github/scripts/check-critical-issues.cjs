/**
 * Script para verificar issues CRITICAL/HIGH e bloquear workflow
 *
 * Verifica se existem issues de prioridade CRITICAL ou HIGH (segurança/performance)
 * no arquivo de review do Gemini. Se encontrar, bloqueia o workflow e posta
 * um comentário de alerta no PR.
 *
 * @module check-critical-issues
 * @version 1.0.0
 * @created 2026-02-25
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONSTANTES
// ============================================================================

const BLOCKING_PRIORITIES = ['CRITICAL', 'HIGH'];
const BLOCKING_CATEGORIES = ['security', 'performance'];

// ============================================================================
// FUNÇÕES DE LOG
// ============================================================================

/**
 * Log estruturado para GitHub Actions
 * @param {string} level - Nível do log (info, warn, error, debug)
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };

  // GitHub Actions commands
  if (level === 'error') {
    console.log(`::error::${message}`);
  } else if (level === 'warning') {
    console.log(`::warning::${message}`);
  } else if (level === 'debug') {
    console.log(`::debug::${message}`);
  }

  // Log estruturado completo
  console.log(`[check-critical] ${message}`, JSON.stringify(logEntry));
}

function logInfo(message, data) { log('info', message, data); }
function logWarn(message, data) { log('warning', message, data); }
function logError(message, data) { log('error', message, data); }
function logDebug(message, data) { log('debug', message, data); }

// ============================================================================
// FUNÇÕES PRINCIPAIS
// ============================================================================

/**
 * Verifica se um issue deve bloquear o workflow
 *
 * Regras de bloqueio:
 * - CRITICAL: Sempre bloqueia
 * - HIGH + categoria 'security': Bloqueia
 * - HIGH + categoria 'performance': Bloqueia
 * - Outros HIGH: Apenas cria issue (não bloqueia)
 *
 * @param {Object} issue - Issue do review
 * @returns {boolean} True se deve bloquear o workflow
 */
function isBlockingIssue(issue) {
  const severity = (issue.severity || '').toUpperCase();
  const category = (issue.category || '').toLowerCase();

  // CRITICAL sempre bloqueia
  if (severity === 'CRITICAL') {
    return true;
  }

  // HIGH bloqueia apenas se for segurança ou performance
  if (severity === 'HIGH') {
    return BLOCKING_CATEGORIES.includes(category);
  }

  return false;
}

/**
 * Carrega e parseia o arquivo de review
 * @param {string} filePath - Caminho para o arquivo JSON
 * @returns {Object|null} Dados do review ou null em caso de erro
 */
function loadReviewFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      logError(`Arquivo de review não encontrado: ${filePath}`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    logInfo('Arquivo de review carregado', {
      filePath,
      prNumber: data.pr_number,
      totalIssues: data.summary?.total_issues || 0
    });

    return data;
  } catch (error) {
    logError('Erro ao carregar arquivo de review', {
      filePath,
      error: error.message
    });
    return null;
  }
}

/**
 * Extrai issues que devem bloquear o workflow
 * @param {Object} reviewData - Dados do review
 * @returns {Array<Object>} Lista de issues bloqueantes
 */
function extractBlockingIssues(reviewData) {
  if (!reviewData || !Array.isArray(reviewData.issues)) {
    return [];
  }

  const blockingIssues = reviewData.issues.filter(isBlockingIssue);

  logInfo('Análise de issues bloqueantes', {
    totalIssues: reviewData.issues.length,
    blockingIssues: blockingIssues.length,
    criticalCount: blockingIssues.filter(i => i.severity === 'CRITICAL').length,
    highSecurityCount: blockingIssues.filter(i => i.severity === 'HIGH' && i.category === 'security').length,
    highPerformanceCount: blockingIssues.filter(i => i.severity === 'HIGH' && i.category === 'performance').length
  });

  return blockingIssues;
}

/**
 * Gera o corpo do comentário de alerta para o PR
 * @param {Array<Object>} blockingIssues - Issues bloqueantes
 * @returns {string} Corpo do comentário em Markdown
 */
function generateAlertComment(blockingIssues) {
  const issueRows = blockingIssues.map(issue => {
    const file = issue.file || 'N/A';
    const line = issue.line || '-';
    const severity = issue.severity;
    const category = issue.category || 'general';
    const description = (issue.issue || 'Sem descrição').substring(0, 80);
    const emoji = severity === 'CRITICAL' ? '🚨' : '⚠️';

    return `| ${emoji} ${severity} | ${category} | \`${file}:${line}\` | ${description}... |`;
  }).join('\n');

  return `## 🛑 Workflow Bloqueado - Issues Críticas Detectadas

O Gemini Code Assist encontrou **${blockingIssues.length}** issue(s) que requerem atenção imediata antes de prosseguir:

| Prioridade | Categoria | Localização | Descrição |
|------------|-----------|-------------|-----------|
${issueRows}

### ⚠️ Ação Necessária

**Este workflow está bloqueado** até que todos os issues CRITICAL/HIGH (segurança/performance) sejam resolvidos.

1. Revise os issues listados acima
2. Faça as correções necessárias no código
3. Faça push de um novo commit para re-executar o review

> **Nota:** Issues de prioridade MEDIUM e LOW serão convertidos em GitHub Issues automaticamente após a resolução dos bloqueantes.

---
*Este comentário foi gerado automaticamente pelo workflow de Gemini Code Review.*`;
}

/**
 * Verifica se já existe um comentário de alerta no PR
 * @param {Object} github - Cliente GitHub Actions
 * @param {Object} context - Contexto do GitHub Actions
 * @param {number} prNumber - Número do PR
 * @returns {Promise<boolean>} True se já existe alerta
 */
async function hasExistingAlertComment(github, context, prNumber) {
  try {
    const alertMarker = '🛑 Workflow Bloqueado';

    // Usar paginação para garantir que todos os comentários sejam verificados
    const comments = await github.paginate(github.rest.issues.listComments, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      per_page: 100
    });

    const hasAlert = comments.some(comment =>
      comment.body?.includes(alertMarker)
    );

    if (hasAlert) {
      logInfo('Comentário de alerta já existe no PR', { prNumber });
    }

    return hasAlert;
  } catch (error) {
    logError('Erro ao verificar comentários existentes', {
      prNumber,
      error: error.message
    });
    return false; // Em caso de erro, assume que não existe para tentar postar
  }
}

/**
 * Posta comentário de alerta no PR via GitHub API
 * @param {Object} github - Cliente GitHub Actions
 * @param {Object} context - Contexto do GitHub Actions
 * @param {number} prNumber - Número do PR
 * @param {Array<Object>} blockingIssues - Issues bloqueantes
 */
async function postAlertComment(github, context, prNumber, blockingIssues) {
  try {
    // Verifica se já existe alerta para evitar duplicatas
    const hasExisting = await hasExistingAlertComment(github, context, prNumber);
    if (hasExisting) {
      logInfo('Pulando criação de comentário - alerta já existe', { prNumber });
      return;
    }

    const body = generateAlertComment(blockingIssues);

    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: body
    });

    logInfo('Comentário de alerta postado no PR', { prNumber });
  } catch (error) {
    logError('Erro ao postar comentário de alerta', {
      prNumber,
      error: error.message
    });
    // Não falha o workflow se não conseguir postar comentário
  }
}

/**
 * Encontra e Remove/Atualiza o comentário de bloqueio quando issues são resolvidas
 * @param {Object} github - Cliente GitHub Actions
 * @param {Object} context - Contexto do GitHub Actions
 * @param {number} prNumber - Número do PR
 * @returns {Promise<boolean>} True se removeu/atualizou o comentário
 */
async function clearBlockingComment(github, context, prNumber) {
  try {
    const alertMarker = '🛑 Workflow Bloqueado';

    // Buscar todos os comentários do PR
    const comments = await github.paginate(github.rest.issues.listComments, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      per_page: 100
    });

    // Encontrar o comentário de bloqueio
    const blockingComment = comments.find(comment =>
      comment.body?.includes(alertMarker) &&
      comment.user.login === 'github-actions[bot]'
    );

    if (!blockingComment) {
      logInfo('Nenhum comentário de bloqueio encontrado para remover', { prNumber });
      return false;
    }

    // Atualizar o comentário para indicar resolução
    const resolutionBody = `## ✅ Issues Resolvidas - PR Aprovado pelo Gemini

O Gemini Code Assist revisou as correções aplicadas e **não foram encontradas mais issues bloqueantes**. O PR está aprovado para merge.

---
*Este comentário foi automaticamente atualizado. O resumo de review está disponível abaixo.*`;

    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: blockingComment.id,
      body: resolutionBody
    });

    logInfo('Comentário de bloqueio atualizado para resolução', { prNumber, commentId: blockingComment.id });
    return true;
  } catch (error) {
    logError('Erro ao remover/atualizar comentário de bloqueio', {
      prNumber,
      error: error.message
    });
    return false;
  }
}

/**
 * Define os outputs para o GitHub Actions
 * @param {Object} core - Objeto core do GitHub Actions
 * @param {Object} result - Resultado da verificação
 */
function setOutputs(core, result) {
  const { hasBlockingIssues, blockingIssues } = result;

  // Contagens específicas
  const criticalCount = blockingIssues.filter(i => i.severity === 'CRITICAL').length;
  const highSecurityCount = blockingIssues.filter(
    i => i.severity === 'HIGH' && i.category === 'security'
  ).length;
  const highPerformanceCount = blockingIssues.filter(
    i => i.severity === 'HIGH' && i.category === 'performance'
  ).length;

  core.setOutput('has_blocking_issues', hasBlockingIssues.toString());
  core.setOutput('has_critical', (criticalCount > 0).toString());
  core.setOutput('has_high_security', (highSecurityCount > 0).toString());
  core.setOutput('has_high_performance', (highPerformanceCount > 0).toString());
  core.setOutput('blocking_count', blockingIssues.length.toString());
  core.setOutput('critical_count', criticalCount.toString());

  logInfo('Outputs definidos', {
    hasBlockingIssues,
    hasCritical: criticalCount > 0,
    hasHighSecurity: highSecurityCount > 0,
    hasHighPerformance: highPerformanceCount > 0,
    blockingCount: blockingIssues.length
  });
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

/**
 * Verifica issues críticas e bloqueia workflow se necessário
 *
 * @param {Object} options - Opções de execução
 * @param {string} options.reviewFile - Caminho para o arquivo de review
 * @param {Object} options.github - Cliente GitHub Actions
 * @param {Object} options.context - Contexto do GitHub Actions
 * @param {Object} options.core - Objeto core do GitHub Actions
 * @returns {Promise<Object>} Resultado da verificação
 */
async function checkCriticalIssues(options = {}) {
  const {
    reviewFile = process.env.REVIEW_FILE || '.gemini-output/review.json',
    github = null,
    context = null,
    core = null,
    prNumber = null
  } = options;

  logInfo('Iniciando verificação de issues críticas', { reviewFile });

  // Carregar arquivo de review
  const reviewData = loadReviewFile(reviewFile);

  if (!reviewData) {
    // Se não encontrou arquivo, assume que não há issues bloqueantes
    logWarn('Arquivo de review não encontrado ou inválido, assumindo sem issues bloqueantes');
    const result = {
      hasBlockingIssues: false,
      blockingIssues: []
    };
    if (core) setOutputs(core, result);
    return result;
  }

  // Extrair issues bloqueantes
  const blockingIssues = extractBlockingIssues(reviewData);
  const hasBlockingIssues = blockingIssues.length > 0;

  // Preparar resultado
  const result = {
    hasBlockingIssues,
    blockingIssues,
    reviewData
  };

  // Definir outputs
  if (core) {
    setOutputs(core, result);
  }

  // Se tem issues bloqueantes, postar alerta
  if (hasBlockingIssues) {
    logError('ISSUES BLOQUEANTES ENCONTRADOS - Workflow será bloqueado', {
      count: blockingIssues.length,
      issues: blockingIssues.map(i => ({
        severity: i.severity,
        category: i.category,
        file: i.file,
        line: i.line
      }))
    });

    // Postar comentário no PR se temos acesso à API
    if (github && context && (prNumber || reviewData.pr_number)) {
      await postAlertComment(github, context, prNumber || reviewData.pr_number, blockingIssues);
    }

    // Sair com código de erro para bloquear o workflow
    process.exitCode = 1;
  } else {
    logInfo('✅ Nenhum issue bloqueante encontrado - Workflow pode continuar');

    // Se temos acesso à API, verificar e remover comentário de bloqueio antigo
    if (github && context && (prNumber || reviewData.pr_number)) {
      await clearBlockingComment(github, context, prNumber || reviewData.pr_number);
    }

    process.exitCode = 0;
  }

  return result;
}

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

module.exports = {
  checkCriticalIssues,
  isBlockingIssue,
  extractBlockingIssues,
  generateAlertComment,
  clearBlockingComment,
  BLOCKING_PRIORITIES,
  BLOCKING_CATEGORIES
};

// Execução direta (quando chamado via CLI)
if (require.main === module) {
  // Quando executado diretamente, usa variáveis de ambiente
  const reviewFile = process.env.REVIEW_FILE;

  if (!reviewFile) {
    logError('REVIEW_FILE não definido nas variáveis de ambiente');
    process.exit(1);
  }

  checkCriticalIssues({ reviewFile })
    .then(result => {
      process.exit(result.hasBlockingIssues ? 1 : 0);
    })
    .catch(error => {
      logError('Erro inesperado na verificação', { error: error.message });
      process.exit(1);
    });
}
