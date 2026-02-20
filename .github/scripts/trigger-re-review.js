/**
 * Script para decidir se deve solicitar re-review automático do Gemini
 * 
 * Este módulo analisa as mudanças em um PR e decide se deve
 * automaticamente postar um comentário `/gemini review` para
 * solicitar uma nova análise do Gemini Code Assist.
 * 
 * Critérios para re-review:
 * - Arquivos críticos modificados (src/services/, src/schemas/, server/bot/, api/)
 * - Mais de 50 linhas alteradas no total
 * 
 * @module trigger-re-review
 * @version 1.0.0
 * @created 2026-02-20
 */

// Padrões de arquivos críticos que devem sempre trigger re-review
const CRITICAL_PATTERNS = [
  /^src\/services\//,
  /^src\/schemas\//,
  /^server\/bot\//,
  /^api\//
];

// Threshold de linhas alteradas para trigger re-review
const CHANGES_THRESHOLD = 50;

/**
 * Decide se deve solicitar re-review do Gemini baseado nas mudanças
 * 
 * Critérios para re-review:
 * - Arquivos críticos modificados (src/services/, src/schemas/, server/bot/, api/)
 * - Mais de 50 linhas alteradas
 * 
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto
 * @returns {Promise<boolean>} Se deve trigger re-review
 */
async function shouldTriggerRereview(prNumber, github, context) {
  const { owner, repo } = context.repo;

  // Buscar timestamp do último review do Gemini
  const lastReviewTimestamp = await getLastGeminiReviewTimestamp(
    github,
    owner,
    repo,
    prNumber
  );

  if (!lastReviewTimestamp) {
    console.log('Nenhum review do Gemini encontrado no PR');
    return false;
  }

  // Buscar commits desde o último review
  const newCommits = await getCommitsSinceTimestamp(
    github,
    owner,
    repo,
    prNumber,
    lastReviewTimestamp
  );

  if (newCommits.length === 0) {
    console.log('Sem novos commits desde o último review do Gemini');
    return false;
  }

  console.log(`${newCommits.length} novos commits desde o último review`);

  // Buscar arquivos alterados
  const changedFiles = await getChangedFiles(github, owner, repo, prNumber);

  if (changedFiles.length === 0) {
    console.log('Sem arquivos alterados nos novos commits');
    return false;
  }

  // Verificar se há arquivos críticos modificados
  const hasCriticalChanges = changedFiles.some(file =>
    CRITICAL_PATTERNS.some(pattern => pattern.test(file.filename))
  );

  if (hasCriticalChanges) {
    console.log('Arquivos críticos modificados detectados');
  }

  // Calcular total de linhas alteradas
  const totalChanges = changedFiles.reduce((sum, file) => {
    return sum + (file.additions || 0) + (file.deletions || 0);
  }, 0);

  console.log(`Total de linhas alteradas: ${totalChanges}`);

  // Retorna true se tem mudanças críticas OU passou do threshold
  return hasCriticalChanges || totalChanges > CHANGES_THRESHOLD;
}

/**
 * Posta comentário para trigger do Gemini
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto
 */
async function triggerRereview(prNumber, github, context) {
  const { owner, repo } = context.repo;

  const commentBody = `<!-- TRIGGER_REREVIEW_AUTOMATIC -->
Alterações significativas detectadas após o último review. Solicitando re-análise automática.

/gemini review`;

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: commentBody
  });

  console.log(`Re-review triggered para PR #${prNumber}`);
}

/**
 * Busca o timestamp do último review do Gemini no PR
 * @param {Object} github - Cliente GitHub
 * @param {string} owner - Owner do repo
 * @param {string} repo - Nome do repo
 * @param {number} prNumber - Número do PR
 * @returns {Promise<Date|null>} Timestamp do último review ou null
 */
async function getLastGeminiReviewTimestamp(github, owner, repo, prNumber) {
  // Buscar reviews do PR (com paginação)
  const reviews = await fetchAllPages(
    ({ page, per_page }) => github.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
      page,
      per_page
    })
  );

  // Buscar comentários do PR (com paginação)
  const comments = await fetchAllPages(
    ({ page, per_page }) => github.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      page,
      per_page
    })
  );

  // Filtrar reviews do Gemini
  const geminiReviews = reviews.filter(
    review => review.user && review.user.login === 'gemini-code-assist[bot]'
  );

  // Filtrar comentários do Gemini
  const geminiComments = comments.filter(
    comment => comment.user && comment.user.login === 'gemini-code-assist[bot]'
  );

  // Buscar comentários inline (review comments) com paginação
  const reviewComments = await fetchAllPages(
    ({ page, per_page }) => github.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
      page,
      per_page
    })
  );

  const geminiReviewComments = reviewComments.filter(
    comment => comment.user && comment.user.login === 'gemini-code-assist[bot]'
  );

  // Coletar todos os timestamps
  const timestamps = [
    ...geminiReviews.map(r => new Date(r.submitted_at)),
    ...geminiComments.map(c => new Date(c.created_at)),
    ...geminiReviewComments.map(c => new Date(c.created_at))
  ];

  if (timestamps.length === 0) {
    return null;
  }

  // Retorna o timestamp mais recente
  const latestTimestamp = new Date(Math.max(...timestamps));
  console.log(`Último review do Gemini: ${latestTimestamp.toISOString()}`);

  return latestTimestamp;
}

/**
 * Busca commits desde um determinado timestamp
 * @param {Object} github - Cliente GitHub
 * @param {string} owner - Owner do repo
 * @param {string} repo - Nome do repo
 * @param {number} prNumber - Número do PR
 * @param {Date} sinceTimestamp - Timestamp de referência
 * @returns {Promise<Array>} Lista de commits
 */
async function getCommitsSinceTimestamp(github, owner, repo, prNumber, sinceTimestamp) {
  // Buscar todos os commits do PR (com paginação)
  const commits = await fetchAllPages(
    ({ page, per_page }) => github.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
      page,
      per_page
    })
  );

  // Filtrar commits após o timestamp
  return commits.filter(commit => {
    const commitDate = new Date(commit.commit.committer.date);
    return commitDate > sinceTimestamp;
  });
}

/**
 * Busca arquivos alterados no PR
 * @param {Object} github - Cliente GitHub
 * @param {string} owner - Owner do repo
 * @param {string} repo - Nome do repo
 * @param {number} prNumber - Número do PR
 * @returns {Promise<Array>} Lista de arquivos alterados
 */
async function getChangedFiles(github, owner, repo, prNumber) {
  // Buscar arquivos alterados no PR (com paginação)
  const files = await fetchAllPages(
    ({ page, per_page }) => github.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      page,
      per_page
    })
  );

  return files;
}

/**
 * Busca todos os itens de uma API paginada do GitHub
 * @param {Function} fetchFn - Função que faz a chamada à API (deve aceitar { page, per_page })
 * @param {number} perPage - Quantidade de itens por página (default: 100)
 * @returns {Promise<Array>} Lista completa de itens
 */
async function fetchAllPages(fetchFn, perPage = 100) {
  const allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data } = await fetchFn({ page, per_page: perPage });
    allItems.push(...data);

    // Se retornou menos itens que o perPage, chegamos ao fim
    if (data.length < perPage) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allItems;
}

module.exports = {
  shouldTriggerRereview,
  triggerRereview,
  // Exportações internas para testes
  CRITICAL_PATTERNS,
  CHANGES_THRESHOLD,
  getLastGeminiReviewTimestamp,
  getCommitsSinceTimestamp,
  getChangedFiles
};
