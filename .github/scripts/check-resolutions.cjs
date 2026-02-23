/**
 * Verifica resoluções de comentários do Gemini Code Assist
 *
 * Este módulo verifica se os issues apontados pelo Gemini em comentários
 * inline foram resolvidos em novos commits e responde em threads
 * sem poluir a timeline principal do PR.
 *
 * Workflow Intelligence v2.0:
 * - Integração com Supabase para persistência de estado
 * - Detecção de "Fixes #X" nos commits
 * - Verificação de resolução parcial vs completa
 * - Estados expandidos: resolved, partial, wontfix, duplicate
 *
 * @module check-resolutions
 * @version 2.0.0
 * @created 2026-02-22
 * @updated 2026-02-23
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Marcador para identificar nossas replies (evita duplicatas)
 * @constant {string}
 */
const COMMENT_MARKER = '<!-- AUTO_REPLY_CHECK_RESOLUTIONS -->';

/**
 * Regex para detectar Fixes #X, Fixed #X, Close #X, etc. nos commits
 * @constant {RegExp}
 */
const FIXES_REGEX = /(?:fixes|fixed|closes|closed|resolves|resolved)\s+#(\d+)/gi;

/**
 * Estados expandidos para Workflow Intelligence
 * @constant {Array<string>}
 */
const EXPANDED_STATUSES = [
  'detected',   // Detectado pelo Gemini
  'reported',   // Reportado ao GitHub (issue criada)
  'assigned',   // Atribuído a agent
  'resolved',   // Completamente resolvido
  'partial',    // Parcialmente resolvido
  'wontfix',    // Ignorado/falso positivo
  'duplicate'   // Duplicata de outra issue
];

/**
 * Tipos de resolução suportados
 * @constant {Array<string>}
 */
const RESOLUTION_TYPES = ['fixed', 'rejected', 'partial'];

/**
 * Inicializa o cliente Supabase
 * @returns {Object|null} Cliente Supabase ou null se variáveis não configuradas
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️ Variáveis Supabase não configuradas, modo offline');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Atualiza o status de uma review no Supabase
 *
 * @param {string} reviewId - UUID da review no Supabase
 * @param {string} status - Novo status (resolved, partial, wontfix, etc.)
 * @param {string|null} resolutionType - Tipo de resolução (fixed, rejected, partial)
 * @param {string|null} commitSha - SHA do commit que resolveu
 * @param {Object|null} supabase - Cliente Supabase
 * @returns {Promise<Object>} Resultado da atualização
 */
async function updateReviewStatus(reviewId, status, resolutionType = null, commitSha = null, supabase = null) {
  if (!supabase) {
    console.log(`  [OFFLINE] Update review ${reviewId}: ${status} (${resolutionType || 'no type'})`);
    return { success: true, offline: true };
  }

  try {
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (resolutionType && RESOLUTION_TYPES.includes(resolutionType)) {
      updateData.resolution_type = resolutionType;
    }

    if (commitSha) {
      updateData.resolved_at = new Date().toISOString();
      // resolved_by seria preenchido via contexto do GitHub Actions
    }

    const { data, error } = await supabase
      .from('gemini_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error(`  ❌ Erro ao atualizar review ${reviewId}:`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`  ✅ Review ${reviewId} atualizado: ${status}`);
    return { success: true, data };
  } catch (error) {
    console.error(`  ❌ Erro ao atualizar review:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Busca review no Supabase pelo número da issue do GitHub
 *
 * @param {number} issueNumber - Número da issue no GitHub
 * @param {Object|null} supabase - Cliente Supabase
 * @returns {Promise<Object|null>} Dados da review ou null
 */
async function findReviewByIssueNumber(issueNumber, supabase = null) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('gemini_reviews')
      .select('*')
      .eq('github_issue_number', issueNumber)
      .maybeSingle();

    if (error) {
      console.error(`  ❌ Erro ao buscar review pela issue #${issueNumber}:`, error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`  ❌ Erro ao buscar review:`, error.message);
    return null;
  }
}

/**
 * Extrai números de issues referenciados em mensagens de commit
 *
 * @param {string} commitMessage - Mensagem do commit
 * @returns {Array<number>} Array de números de issues
 */
function parseFixesFromCommit(commitMessage) {
  if (!commitMessage) return [];

  const issues = [];
  let match;

  // Reset regex state
  FIXES_REGEX.lastIndex = 0;

  while ((match = FIXES_REGEX.exec(commitMessage)) !== null) {
    const issueNumber = parseInt(match[1], 10);
    if (!isNaN(issueNumber) && !issues.includes(issueNumber)) {
      issues.push(issueNumber);
    }
  }

  return issues;
}

/**
 * Verifica a completude da resolução comparando código antes/depois
 *
 * @param {Object} issue - Dados da issue (do Gemini ou Supabase)
 * @param {string} commitSha - SHA do commit atual
 * @param {Object} github - Cliente GitHub API
 * @param {Object} context - Contexto do GitHub Actions
 * @returns {Promise<'complete'|'partial'|'none'>} Tipo de resolução
 */
async function checkResolutionCompleteness(issue, commitSha, github, context) {
  try {
    const filePath = issue.file_path || issue.file;
    const lineStart = issue.line_start || issue.line;
    const lineEnd = issue.line_end || lineStart;

    if (!filePath) {
      console.log(`  ⚠️ Caminho do arquivo não disponível`);
      return 'none';
    }

    // Buscar o conteúdo atual do arquivo no commit
    const { data: fileData } = await github.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: filePath,
      ref: commitSha
    });

    if (!fileData.content) {
      console.log(`  ⚠️ Não foi possível obter conteúdo do arquivo`);
      return 'none';
    }

    // Decodificar conteúdo
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const lines = content.split('\n');

    // Extrair linhas relevantes
    const relevantLines = [];
    for (let i = (lineStart || 1) - 1; i < (lineEnd || lineStart || 1) && i < lines.length; i++) {
      if (lines[i] !== undefined) {
        relevantLines.push(lines[i].trim());
      }
    }

    const currentCode = relevantLines.join('\n');

    // Analisar se a issue foi resolvida baseado na descrição e código atual
    const description = (issue.description || issue.issue || '').toLowerCase();
    const suggestion = (issue.suggestion || '').toLowerCase();

    // Critérios para resolução completa
    const completeIndicators = [
      // Se havia sugestão de código e o código mudou significativamente
      suggestion && currentCode.toLowerCase().includes(suggestion.substring(0, 50)),
      // Se era sobre remover código e as linhas foram removidas ou alteradas
      description.includes('remover') && relevantLines.length === 0,
      // Se era sobre adicionar e o código agora existe
      description.includes('adicionar') && relevantLines.length > 0,
      // Se menciona validação e agora há validação
      description.includes('validação') && currentCode.toLowerCase().includes('zod'),
      description.includes('validação') && currentCode.toLowerCase().includes('validate'),
      // Se menciona error handling
      description.includes('error') && currentCode.toLowerCase().includes('try'),
      description.includes('erro') && currentCode.toLowerCase().includes('catch'),
    ];

    const completeCount = completeIndicators.filter(Boolean).length;

    // Critérios para resolução parcial
    const partialIndicators = [
      // Se menciona TODO ou FIXME ainda presente
      currentCode.toLowerCase().includes('todo'),
      currentCode.toLowerCase().includes('fixme'),
      // Se menciona refatorar E nenhum indicador completo foi atendido
      // (evita marcar como 'partial' refatorações que já estão completas)
      description.includes('refatorar') && completeCount === 0,
      // Se há comentários indicando trabalho pendente
      currentCode.toLowerCase().includes('// not implemented'),
      currentCode.toLowerCase().includes('// implementar'),
    ];

    const partialCount = partialIndicators.filter(Boolean).length;

    if (completeCount > 0 && partialCount === 0) {
      return 'complete';
    } else if (partialCount > 0 || (completeCount > 0 && partialCount > 0)) {
      return 'partial';
    }

    return 'none';
  } catch (error) {
    console.error(`  ❌ Erro ao verificar completude:`, error.message);
    return 'none';
  }
}

/**
 * Determina a transição de estado baseada no contexto atual
 *
 * @param {string} currentStatus - Status atual da review
 * @param {string} completeness - Resultado da verificação (complete, partial, none)
 * @param {boolean} isWontFix - Se foi marcado como wontfix
 * @returns {Object} Novo status e tipo de resolução
 */
function determineStateTransition(currentStatus, completeness, isWontFix = false) {
  // Se é wontfix, vai direto para estado final
  if (isWontFix) {
    return { status: 'wontfix', resolutionType: 'rejected' };
  }

  // Transições baseadas na completude
  switch (completeness) {
    case 'complete':
      return { status: 'resolved', resolutionType: 'fixed' };
    case 'partial':
      return { status: 'partial', resolutionType: 'partial' };
    default:
      // Se não detectou mudança, mantém estado atual ou marca como parcial
      if (currentStatus === 'assigned') {
        return { status: 'partial', resolutionType: 'partial' };
      }
      return { status: currentStatus, resolutionType: null };
  }
}

/**
 * Verifica resoluções de comentários do Gemini em um PR
 * e atualiza o Supabase com os novos estados
 *
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub API
 * @param {Object} context - Contexto do GitHub Actions
 * @returns {Promise<Object>} Resultado da verificação
 */
async function checkResolutionsAndUpdate(prNumber, github, context) {
  console.log(`🔍 Verificando resoluções no PR #${prNumber} (Workflow Intelligence v2.0)...`);

  const supabase = getSupabaseClient();
  const isOffline = !supabase;

  if (isOffline) {
    console.log('⚠️ Modo offline - apenas verificando GitHub');
  }

  // Buscar comentários de review do Gemini
  const { data: reviewComments } = await github.rest.pulls.listReviewComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
    per_page: 100
  });

  // Filtrar apenas comentários do Gemini (nossas replies)
  const geminiComments = reviewComments.filter(
    c => c.user.login === 'gemini-code-assist[bot]'
  );

  // Filtrar nossas replies existentes
  const ourReplies = reviewComments.filter(
    c => c.body?.includes(COMMENT_MARKER)
  );

  // Buscar commits do PR
  const { data: commits } = await github.rest.pulls.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
    per_page: 100
  });

  if (commits.length === 0) {
    console.log('⚠️ Nenhum commit encontrado no PR');
    return { checked: 0, resolved: 0, partial: 0, rejected: 0, updated: [] };
  }

  // Pegar o commit mais recente
  const latestCommit = commits[commits.length - 1];
  console.log(`📌 Último commit: ${latestCommit.sha.substring(0, 7)}`);

  // Analisar mensagens de commit para detectar "Fixes #X"
  const fixedIssues = new Set();
  for (const commit of commits) {
    const message = commit.commit.message;
    const issues = parseFixesFromCommit(message);
    issues.forEach(issue => fixedIssues.add(issue));
  }

  if (fixedIssues.size > 0) {
    console.log(`🔧 Issues mencionadas nos commits: #${Array.from(fixedIssues).join(', #')}`);
  }

  // Pegar o penúltimo commit para comparação (se existir)
  const baseCommit = commits.length > 1 ? commits[commits.length - 2] : commits[0];

  // Resultados
  const results = {
    checked: geminiComments.length,
    resolved: 0,
    partial: 0,
    rejected: 0,
    replies: [],
    updated: []
  };

  // Verificar cada comentário do Gemini
  for (const comment of geminiComments) {
    // Pular se já existe nossa reply para este comentário
    const hasExistingReply = ourReplies.some(
      r => r.in_reply_to_id === comment.id
    );

    if (hasExistingReply) {
      console.log(`⏭️ Comentário #${comment.id} já tem reply, pulando...`);
      continue;
    }

    console.log(`📋 Verificando comentário #${comment.id} em ${comment.path}:${comment.line}`);

    // Buscar review no Supabase se disponível
    let review = null;
    if (supabase) {
      // Tentar buscar pelo file_path e line
      const { data: reviewData } = await supabase
        .from('gemini_reviews')
        .select('*')
        .eq('file_path', comment.path)
        .eq('line_start', comment.line)
        .eq('pr_number', prNumber)
        .maybeSingle();
      review = reviewData;
    }

    // Verificar se a linha foi modificada
    const lineChanged = await checkIfLineChanged(
      comment.path,
      comment.line,
      comment.original_line,
      baseCommit.sha,
      latestCommit.sha,
      github,
      context
    );

    if (lineChanged) {
      // Verificar completude da resolução
      const completeness = await checkResolutionCompleteness(
        review || { file_path: comment.path, line_start: comment.line },
        latestCommit.sha,
        github,
        context
      );

      // Determinar tipo de resolução baseado no conteúdo e completude
      const resolution = determineResolutionType(comment, completeness);

      let message;
      switch (resolution) {
        case 'partial':
          message = `🔄 **Parcialmente resolvido** em ${latestCommit.sha.substring(0, 7)}\n\n_Issue requer atenção adicional._`;
          results.partial++;
          break;
        case 'rejected':
          message = `ℹ️ **Não aplicado** (falso positivo)\n\n_Alteração não necessária após análise._`;
          results.rejected++;
          break;
        default:
          message = `✅ **Corrigido** em ${latestCommit.sha.substring(0, 7)}\n\n_Issue resolvido automaticamente._`;
          results.resolved++;
      }

      // Adicionar marcador
      message = `${COMMENT_MARKER}\n${message}`;

      // Postar reply
      const reply = await postReplyToComment(
        prNumber,
        comment.id,
        message,
        github,
        context
      );

      if (reply) {
        results.replies.push({
          commentId: comment.id,
          resolution: resolution,
          url: reply.html_url
        });
      }

      // Atualizar Supabase se tivermos a review
      if (review && supabase) {
        const isWontFix = resolution === 'rejected';
        const { status, resolutionType } = determineStateTransition(
          review.status,
          completeness,
          isWontFix
        );

        const updateResult = await updateReviewStatus(
          review.id,
          status,
          resolutionType,
          latestCommit.sha,
          supabase
        );

        if (updateResult.success) {
          results.updated.push({
            reviewId: review.id,
            status,
            resolutionType
          });
        }
      }
    } else {
      console.log(`  ❌ Linha não foi modificada no último commit`);
    }
  }

  // Processar issues mencionadas nos commits que podem não ter comentários inline
  for (const issueNumber of fixedIssues) {
    const review = await findReviewByIssueNumber(issueNumber, supabase);
    if (review && review.status !== 'resolved' && review.status !== 'wontfix') {
      console.log(`📝 Atualizando review da issue #${issueNumber} (detectada via commit message)`);

      const updateResult = await updateReviewStatus(
        review.id,
        'resolved',
        'fixed',
        latestCommit.sha,
        supabase
      );

      if (updateResult.success) {
        results.updated.push({
          reviewId: review.id,
          status: 'resolved',
          resolutionType: 'fixed',
          via: 'commit_message'
        });
      }
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`  Total verificado: ${results.checked}`);
  console.log(`  Resolvidos: ${results.resolved}`);
  console.log(`  Parciais: ${results.partial}`);
  console.log(`  Rejeitados: ${results.rejected}`);
  console.log(`  Replies enviadas: ${results.replies.length}`);
  console.log(`  Reviews atualizadas no Supabase: ${results.updated.length}`);

  return results;
}

/**
 * Verifica se uma linha específica foi modificada entre dois commits
 *
 * @param {string} path - Caminho do arquivo
 * @param {number} line - Número da linha atual
 * @param {number} originalLine - Número da linha original (para reviews)
 * @param {string} baseSha - SHA do commit base
 * @param {string} headSha - SHA do commit head
 * @param {Object} github - Cliente GitHub API
 * @param {Object} context - Contexto do GitHub Actions
 * @returns {Promise<boolean>} True se a linha foi modificada
 */
async function checkIfLineChanged(path, line, originalLine, baseSha, headSha, github, context) {
  try {
    // Comparar commits para verificar mudanças
    const { data: comparison } = await github.rest.repos.compareCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      base: baseSha,
      head: headSha
    });

    // Verificar se o arquivo está nos arquivos modificados
    const fileChange = comparison.files.find(f => f.filename === path);

    if (!fileChange) {
      console.log(`  📄 Arquivo ${path} não foi modificado`);
      return false;
    }

    // Se o arquivo foi modificado, verificar se a linha específica mudou
    // Usar o patch para identificar linhas modificadas
    if (fileChange.patch) {
      const changedLines = parseChangedLines(fileChange.patch);
      const targetLine = originalLine || line;

      const wasChanged = changedLines.some(
        range => targetLine >= range.start && targetLine <= range.end
      );

      if (wasChanged) {
        console.log(`  ✅ Linha ${targetLine} foi modificada`);
      }

      return wasChanged;
    }

    // Se não tem patch (ex: arquivo binário), considerar como modificado
    console.log(`  ⚠️ Arquivo modificado sem patch disponível`);
    return true;
  } catch (error) {
    console.error(`  ❌ Erro ao comparar commits:`, error.message);
    // Em caso de erro, assumir que pode ter mudado para ser seguro
    return true;
  }
}

/**
 * Parseia o patch de um arquivo para identificar linhas modificadas
 *
 * @param {string} patch - Patch do Git
 * @returns {Array<{start: number, end: number}>} Ranges de linhas modificadas
 */
function parseChangedLines(patch) {
  const lines = patch.split('\n');
  const ranges = [];
  let currentLine = 0;

  for (const line of lines) {
    // Linhas de hunk: @@ -start,count +start,count @@
    const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
    if (hunkMatch) {
      const newStart = parseInt(hunkMatch[3], 10);
      const newCount = parseInt(hunkMatch[4] || '1', 10);
      currentLine = newStart;

      if (newCount > 0) {
        ranges.push({
          start: newStart,
          end: newStart + newCount - 1
        });
      }
      continue;
    }

    // Linhas adicionadas (+)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      // Esta linha foi adicionada/modificada
      // O range já cobre esta linha pelo hunk
    }

    // Linhas de contexto ou removidas
    if (!line.startsWith('-') && !line.startsWith('+') && !line.startsWith('@@')) {
      currentLine++;
    }
  }

  return ranges;
}

/**
 * Determina o tipo de resolução baseado no conteúdo do comentário e completude
 *
 * @param {Object} comment - Comentário do Gemini
 * @param {string} completeness - Resultado da verificação de completude
 * @returns {string} Tipo de resolução: 'resolved', 'partial', 'rejected'
 */
function determineResolutionType(comment, completeness = 'none') {
  const body = comment.body?.toLowerCase() || '';

  // Se a verificação de completude indicou parcial, usar isso
  if (completeness === 'partial') {
    return 'partial';
  }

  // Se a verificação indicou completo
  if (completeness === 'complete') {
    return 'resolved';
  }

  // Se o comentário menciona "TODO", "FIXME", ou sugere melhoras futuras
  // considerar como parcial
  // Nota: 'sugestão' removido por ser excessivamente amplo
  if (body.includes('todo') ||
      body.includes('fixme') ||
      body.includes('melhoria futura') ||
      body.includes('refatoração') ||
      body.includes('considerar')) {
    return 'partial';
  }

  // Se o comentário é sobre estilo/formato e tem sugestão
  // provavelmente foi resolvido
  if (body.includes('```suggestion') &&
      (body.includes('style') || body.includes('format'))) {
    return 'resolved';
  }

  // Se menciona falso positivo ou não aplicável
  if (body.includes('falso positivo') ||
      body.includes('não aplicável') ||
      body.includes('wontfix') ||
      body.includes('não será corrigido')) {
    return 'rejected';
  }

  // Padrão: parcial (mais seguro)
  return 'partial';
}

/**
 * Posta uma resposta a um comentário de review
 *
 * @param {number} prNumber - Número do PR
 * @param {number} commentId - ID do comentário a responder
 * @param {string} message - Mensagem da resposta
 * @param {Object} github - Cliente GitHub API
 * @param {Object} context - Contexto do GitHub Actions
 * @returns {Promise<Object|null>} Dados da reply criada ou null
 */
async function postReplyToComment(prNumber, commentId, message, github, context) {
  try {
    const { data: reply } = await github.rest.pulls.createReplyForReviewComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      comment_id: commentId,
      body: message
    });

    console.log(`  💬 Reply postada: ${reply.html_url}`);
    return reply;
  } catch (error) {
    console.error(`  ❌ Erro ao postar reply:`, error.message);
    return null;
  }
}

/**
 * Verifica se deve rodar a verificação de resoluções
 *
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub API
 * @param {Object} context - Contexto do GitHub Actions
 * @returns {Promise<boolean>} True se deve verificar resoluções
 */
async function shouldCheckResolutions(prNumber, github, context) {
  try {
    // Buscar último comentário do Gemini
    const { data: reviewComments } = await github.rest.pulls.listReviewComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      per_page: 100
    });

    const geminiComments = reviewComments.filter(
      c => c.user.login === 'gemini-code-assist[bot]'
    );

    if (geminiComments.length === 0) {
      console.log('ℹ️ Nenhum comentário do Gemini encontrado');
      return false;
    }

    // Encontrar o comentário mais recente do Gemini
    const latestGeminiComment = geminiComments.reduce((latest, current) => {
      return new Date(current.created_at) > new Date(latest.created_at)
        ? current
        : latest;
    });

    // Buscar commits após o último comentário do Gemini
    const { data: commits } = await github.rest.pulls.listCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      per_page: 100
    });

    const commitsAfterReview = commits.filter(c => {
      const commitDate = new Date(c.commit.committer?.date || c.commit.author?.date);
      const commentDate = new Date(latestGeminiComment.created_at);
      return commitDate > commentDate;
    });

    if (commitsAfterReview.length === 0) {
      console.log('ℹ️ Nenhum novo commit após o último review do Gemini');
      return false;
    }

    console.log(`📊 ${commitsAfterReview.length} novos commits após o último review`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar condições:', error.message);
    return false;
  }
}

// Exportações
module.exports = {
  checkResolutionsAndUpdate,
  checkResolutions: checkResolutionsAndUpdate, // Alias para compatibilidade
  checkIfLineChanged,
  postReplyToComment,
  parseChangedLines,
  determineResolutionType,
  shouldCheckResolutions,
  COMMENT_MARKER,
  // Workflow Intelligence v2.0 - Novas exportações
  updateReviewStatus,
  parseFixesFromCommit,
  checkResolutionCompleteness,
  determineStateTransition,
  findReviewByIssueNumber,
  getSupabaseClient,
  // Constantes
  EXPANDED_STATUSES,
  RESOLUTION_TYPES,
  FIXES_REGEX
};
