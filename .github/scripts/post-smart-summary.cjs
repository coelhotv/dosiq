/**
 * Script para postar ou atualizar o resumo de review do Gemini Code Assist
 *
 * Estratégia: Um comentário editável por PR
 * - Verifica se já existe um comentário de resumo (marcador GEMINI_REVIEW_SUMMARY)
 * - Se existir → atualiza o comentário existente
 * - Se não existir → cria um novo comentário
 * - Mantém a timeline do PR limpa com apenas UM resumo
 *
 * @module post-smart-summary
 * @version 1.0.0
 * @created 2026-02-20
 * @updated 2026-02-20
 */

// Marcador para identificar o comentário de resumo
const SUMMARY_MARKER = '<!-- GEMINI_REVIEW_SUMMARY -->';

/**
 * Posta ou atualiza o resumo de review no PR
 *
 * @param {Object} reviewData - Dados do review parseado
 * @param {Object} reviewData.summary - Resumo estatístico
 * @param {number} reviewData.summary.total_issues - Total de issues
 * @param {number} reviewData.summary.auto_fixable - Issues auto-fixable
 * @param {number} reviewData.summary.needs_agent - Issues que requerem agente
 * @param {number} reviewData.summary.critical - Issues críticos
 * @param {Array} reviewData.issues - Lista de issues
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente do GitHub Actions
 * @param {Object} context - Contexto do GitHub Actions
 * @returns {Promise<Object>} Resultado da operação
 */
async function postOrUpdateSummary(reviewData, prNumber, github, context) {
  // Buscar comentários existentes no PR
  // Nota: per_page=100 é suficiente para a maioria dos casos.
  // PRs com >100 comentários são raros; se necessário, implementar paginação futuramente.
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
    per_page: 100
  });

  // Encontrar comentário de resumo existente (marcador + autor github-actions)
  const existingComment = comments.find(
    (comment) =>
      comment.body &&
      comment.body.includes(SUMMARY_MARKER) &&
      comment.user.login === 'github-actions[bot]'
  );

  // Gerar corpo do resumo
  const summaryBody = generateSummaryBody(reviewData, prNumber);

  if (existingComment) {
    // Atualizar comentário existente
    const { data: updatedComment } = await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existingComment.id,
      body: summaryBody
    });

    console.log(`✅ Resumo atualizado: ${updatedComment.html_url}`);
    return {
      action: 'updated',
      commentId: updatedComment.id,
      url: updatedComment.html_url
    };
  } else {
    // Criar novo comentário
    const { data: newComment } = await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: summaryBody
    });

    console.log(`✅ Resumo criado: ${newComment.html_url}`);
    return {
      action: 'created',
      commentId: newComment.id,
      url: newComment.html_url
    };
  }
}

/**
 * Gera o corpo do resumo em formato markdown
 *
 * @param {Object} reviewData - Dados do review
 * @param {number} prNumber - Número do PR
 * @returns {string} Corpo do resumo em markdown
 */
function generateSummaryBody(reviewData, prNumber) {
  const summary = reviewData.summary || {};
  const issues = reviewData.issues || [];

  // Timestamp da atualização (UTC ISO 8601 para consistência cross-platform)
  const timestamp = new Date().toISOString();

  // Estatísticas
  const totalIssues = summary.total_issues || 0;
  const autoFixable = summary.auto_fixable || 0;
  const needsAgent = summary.needs_agent || 0;
  const critical = summary.critical || 0;

  // Top 10 issues
  const topIssues = issues
    .slice(0, 10)
    .map(
      (issue) =>
        `| ${escapeMarkdown(issue.file ? issue.file.split('/').pop() : 'N/A')} | ${issue.line || '-'} | ${escapeMarkdown(issue.severity)} | ${escapeMarkdown(issue.category || issue.priority || 'N/A')} |`
    )
    .join('\n');

  const body = `${SUMMARY_MARKER}
## 🤖 Gemini Code Review - Resumo

*Última atualização: ${timestamp}*

### 📊 Estatísticas

| Categoria | Quantidade |
|-----------|------------|
| Total de Issues | ${totalIssues} |
| Auto-fixable | ${autoFixable} |
| Requer Agente | ${needsAgent} |
| Críticos | ${critical} |

### 📋 Issues Principais

| Arquivo | Linha | Severidade | Categoria |
|---------|-------|------------|-----------|
${topIssues || '| Nenhum issue encontrado | - | - | - |'}

### 📁 Output Estruturado

O arquivo \`.gemini-output/review-${prNumber}.json\` foi gerado com todos os issues parseados.

---
💡 *Este comentário é atualizado automaticamente a cada review.*
`;

  return body;
}

/**
 * Escapa caracteres especiais do markdown
 *
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto escapado
 */
function escapeMarkdown(text) {
  if (!text) return '';
  // Escapar caracteres especiais do markdown para tabelas
  // Inclui: pipe, underscore, asterisco, backtick, colchetes, parenteses,
  // hash, plus, minus, dot, exclamation, tilde
  // eslint-disable-next-line no-useless-escape
  return text.replace(/[|_*`\[\]()#+\-.!~]/g, '\\$&');
}

module.exports = {
  postOrUpdateSummary,
  generateSummaryBody,
  SUMMARY_MARKER
};
