/**
 * Verifica resoluções de comentários do Gemini Code Assist
 *
 * Este módulo verifica se os issues apontados pelo Gemini em comentários
 * inline foram resolvidos em novos commits e responde em threads
 * sem poluir a timeline principal do PR.
 *
 * @module check-resolutions
 * @version 1.0.0
 * @created 2026-02-22
 * @updated 2026-02-22
 */

/**
 * Marcador para identificar nossas replies (evita duplicatas)
 * @constant {string}
 */
const COMMENT_MARKER = '<!-- AUTO_REPLY_CHECK_RESOLUTIONS -->';

/**
 * Verifica resoluções de comentários do Gemini em um PR
 *
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub API
 * @param {Object} context - Contexto do GitHub Actions
 * @returns {Promise<Object>} Resultado da verificação
 */
async function checkResolutions(prNumber, github, context) {
  console.log(`🔍 Verificando resoluções no PR #${prNumber}...`);

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
    return { checked: 0, resolved: 0, partial: 0, rejected: 0 };
  }

  // Pegar o commit mais recente
  const latestCommit = commits[commits.length - 1];
  console.log(`📌 Último commit: ${latestCommit.sha.substring(0, 7)}`);

  // Pegar o penúltimo commit para comparação (se existir)
  const baseCommit = commits.length > 1 ? commits[commits.length - 2] : commits[0];

  // Resultados
  const results = {
    checked: geminiComments.length,
    resolved: 0,
    partial: 0,
    rejected: 0,
    replies: []
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
      // Determinar tipo de resolução baseado no conteúdo do comentário
      const resolution = determineResolutionType(comment);

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
    } else {
      console.log(`  ❌ Linha não foi modificada no último commit`);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`  Total verificado: ${results.checked}`);
  console.log(`  Resolvidos: ${results.resolved}`);
  console.log(`  Parciais: ${results.partial}`);
  console.log(`  Rejeitados: ${results.rejected}`);
  console.log(`  Replies enviadas: ${results.replies.length}`);

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
 * Determina o tipo de resolução baseado no conteúdo do comentário
 *
 * @param {Object} comment - Comentário do Gemini
 * @returns {string} Tipo de resolução: 'resolved', 'partial', 'rejected'
 */
function determineResolutionType(comment) {
  const body = comment.body?.toLowerCase() || '';

  // Se o comentário menciona "TODO", "FIXME", ou sugere melhorias futuras
  // considerar como parcial
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

  // Padrão: resolvido
  return 'resolved';
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
  checkResolutions,
  checkIfLineChanged,
  postReplyToComment,
  parseChangedLines,
  determineResolutionType,
  shouldCheckResolutions,
  COMMENT_MARKER
};
