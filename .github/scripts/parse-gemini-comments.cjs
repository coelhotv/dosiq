/**
 * Parser de comentários do Gemini Code Assist
 * 
 * Este módulo parseia comentários do Gemini Code Assist e os estrutura
 * para consumo por agentes coder ou auto-fix.
 * 
 * Formato real do Gemini (validado em PR #25):
 * - Prioridade via image badges: ![critical](...critical.svg), ![high](...high-priority.svg), ![medium](...medium-priority.svg)
 * - Sugestões em blocco ```suggestion
 * - Comentários inline com path, line, diff_hunk
 * 
 * @module parse-gemini-comments
 * @version 1.1.0
 * @created 2026-02-19
 * @updated 2026-02-19
 */

/**
 * Parseia um comentário do Gemini Code Assist
 * 
 * Formato real do Gemini (validado em PR #25):
 * - Prioridade: ![critical](https://www.gstatic.com/codereviewagent/critical.svg)
 * - Prioridade: ![high](https://www.gstatic.com/codereviewagent/high-priority.svg)
 * - Prioridade: ![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)
 * 
 * @param {Object} comment - Comentário do GitHub API
 * @param {string} comment.body - Corpo do comentário
 * @param {string} comment.path - Caminho do arquivo
 * @param {number} [comment.line] - Linha do comentário
 * @param {number} [comment.original_line] - Linha original (para reviews)
 * @param {number} comment.id - ID do comentário
 * @param {string} [comment.html_url] - URL do comentário
 * @returns {Object} Dados estruturados do comentário
 */
function parseGeminiComment(comment) {
  const body = comment.body || '';
  
  // Gemini usa image badges para prioridade (formato real validado em PR #25)
  // ![critical](https://www.gstatic.com/codereviewagent/critical.svg)
  // ![high](https://www.gstatic.com/codereviewagent/high-priority.svg)
  // ![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)
  const priorityMatch = body.match(/!\[(critical|high|medium)\]\([^)]+\)/i);
  
  // Extrai sugestão de código (bloco ```suggestion)
  const suggestionMatch = body.match(/```suggestion\n([\s\S]*?)```/);
  
  // Extrai descrição do issue (texto após o badge de prioridade)
  const issueText = extractIssueFromText(body);
  
  return {
    id: comment.id,
    file: comment.path,
    line: comment.line || comment.original_line || null,
    issue: issueText,
    suggestion: suggestionMatch ? suggestionMatch[1].trim() : null,
    priority: normalizePriority(priorityMatch ? priorityMatch[1] : 'medium'),
    raw: body,
    url: comment.html_url || null
  };
}

/**
 * Normaliza prioridade do Gemini para formato padrão
 * 
 * Gemini usa: "medium priority", "high priority", "critical"
 * 
 * @param {string} priority - Prioridade extraída do comentário
 * @returns {string} Prioridade normalizada (MEDIUM, HIGH, CRITICAL)
 */
function normalizePriority(priority) {
  const p = priority.toLowerCase().trim();
  if (p === 'critical') return 'CRITICAL';
  if (p === 'high') return 'HIGH';
  if (p === 'medium') return 'MEDIUM';
  if (p === 'low') return 'LOW';
  return 'MEDIUM'; // default (threshold é MEDIUM)
}

/**
 * Extrai descrição do issue do texto do comentário
 * 
 * Formato real do Gemini (validado em PR #25):
 * ```
 * ![critical](https://www.gstatic.com/codereviewagent/critical.svg)
 * 
 * A função `escapeMarkdownV2` não está escapando os caracteres...
 * 
 * ```suggestion
 * ...
 * ```
 * ```
 * 
 * @param {string} body - Corpo do comentário
 * @returns {string} Descrição do issue
 */
function extractIssueFromText(body) {
  // Remove o badge de prioridade (primeira linha)
  let text = body.replace(/!\[(critical|high|medium)\]\([^)]+\)/gi, '');
  
  // Remove blocos de código (suggestions)
  text = text.replace(/```[\s\S]*?```/g, '');
  
  // Remove linhas vazias e extrai primeira linha de texto
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  
  // Retorna a primeira linha não-vazia como descrição do issue
  return lines[0] || 'Issue não identificado';
}

/**
 * Verifica se um issue é auto-fixable
 * 
 * @param {Object} comment - Comentário parseado
 * @returns {boolean} True se pode ser auto-corrigido
 */
function isAutoFixable(comment) {
  const autoFixableKeywords = [
    'formatting',
    'style',
    'unused',
    'naming',
    'whitespace',
    'indentation',
    'semicolon',
    'quote',
    'spacing',
    'trailing',
    'missing semicolon'
  ];
  
  const issue = comment.issue?.toLowerCase() || '';
  return autoFixableKeywords.some(kw => issue.includes(kw));
}

/**
 * Categoriza issues baseado na prioridade real do Gemini
 * 
 * @param {Array<Object>} parsedComments - Comentários parseados
 * @returns {Object} Issues categorizados
 * @property {Array} autoFixable - Issues que podem ser auto-corrigidos
 * @property {Array} needsAgent - Issues que requerem intervenção de agente
 * @property {Array} critical - Issues críticos ou de segurança
 */
function categorizeIssues(parsedComments) {
  return {
    // Auto-fixable: issues simples de estilo/formatação
    autoFixable: parsedComments.filter(c => 
      c.priority === 'MEDIUM' && isAutoFixable(c)
    ),
    
    // Needs Agent: issues de lógica/arquitetura que requerem intervenção
    needsAgent: parsedComments.filter(c => 
      c.priority === 'HIGH' ||
      (c.priority === 'MEDIUM' && !isAutoFixable(c))
    ),
    
    // Critical: issues de segurança ou críticos
    critical: parsedComments.filter(c => 
      c.priority === 'CRITICAL' || 
      isSecurityIssue(c)
    )
  };
}

/**
 * Verifica se um issue é relacionado a segurança
 * 
 * @param {Object} comment - Comentário parseado
 * @returns {boolean} True se é issue de segurança
 */
function isSecurityIssue(comment) {
  const securityKeywords = [
    'security',
    'vulnerability',
    'injection',
    'xss',
    'csrf',
    'authentication',
    'authorization',
    'sensitive',
    'credential',
    'password',
    'secret',
    'api key',
    'token'
  ];
  
  const issue = comment.issue?.toLowerCase() || '';
  return securityKeywords.some(kw => issue.includes(kw));
}

/**
 * Gera output estruturado para agentes coder
 *
 * @param {number} prNumber - Número do PR
 * @param {string} reviewId - ID do review
 * @param {Array<Object>} parsedComments - Comentários parseados e categorizados
 * @returns {Object} Output estruturado
 */
function generateStructuredOutput(prNumber, reviewId, parsedComments) {
  // P3: Filter out compliments BEFORE categorization
  const filteredComments = filterCompliments(parsedComments);

  const categorized = categorizeIssues(filteredComments);

  return {
    pr_number: prNumber,
    review_id: reviewId,
    timestamp: new Date().toISOString(),
    summary: {
      total_issues: filteredComments.length,
      auto_fixable: categorized.autoFixable.length,
      needs_agent: categorized.needsAgent.length,
      critical: categorized.critical.length,
      filtered_compliments: parsedComments.length - filteredComments.length
    },
    issues: filteredComments.map(c => ({
      id: c.id,
      file: c.file,
      line: c.line,
      severity: c.priority,
      issue: c.issue,
      suggestion: c.suggestion,
      auto_fixable: isAutoFixable(c),
      category: categorizeIssue(c),
      url: c.url
    })),
    auto_fix_commands: generateAutoFixCommands(categorized.autoFixable),
    critical_requires_human: categorized.critical.length > 0
  };
}

/**
 * Categoriza um issue por tipo
 * 
 * @param {Object} comment - Comentário parseado
 * @returns {string} Categoria do issue
 */
function categorizeIssue(comment) {
  if (isSecurityIssue(comment)) return 'security';
  if (isAutoFixable(comment)) return 'style';
  
  const issue = comment.issue?.toLowerCase() || '';
  
  if (issue.includes('error') || issue.includes('exception')) return 'error_handling';
  if (issue.includes('performance') || issue.includes('optimize')) return 'performance';
  if (issue.includes('logic') || issue.includes('algorithm')) return 'logic';
  if (issue.includes('test') || issue.includes('coverage')) return 'testing';
  if (issue.includes('doc') || issue.includes('comment')) return 'documentation';
  
  return 'general';
}

/**
 * Gera comandos de auto-fix para issues auto-fixable
 * 
 * @param {Array<Object>} autoFixableIssues - Issues auto-fixable
 * @returns {Array<string>} Lista de comandos
 */
function generateAutoFixCommands(autoFixableIssues) {
  const commands = [];
  
  if (autoFixableIssues.length > 0) {
    commands.push('npm run lint -- --fix');
    commands.push('npx prettier --write "src/**/*.{js,jsx,css}"');
  }
  
  // Adiciona comandos específicos por arquivo
  const files = [...new Set(autoFixableIssues.map(c => c.file).filter(Boolean))];
  files.forEach(file => {
    if (file) {
      commands.push(`npx prettier --write "${file}"`);
    }
  });
  
  return commands;
}

// ============================================================================
// FILTRO DE COMPLIMENTS (P3: Ghost Issues Prevention)
// ============================================================================

/**
 * Padrões de comentários que NÃO são problemas
 * Inclui elogios, reconhecimentos de correção e feedback não-acionável
 *
 * IMPORTANTE: Gemini usa badges de prioridade para issues reais.
 * Comentários sem badge são tipicamente acknowledgments/compliments.
 */
const COMPLIMENT_PATTERNS = [
  // Elogios gerais (Português)
  /ótimo\s*(trabalho|job)/i,
  /excelente/i,
  /fico\s*feliz/i,
  /bom\s*trabalho/i,
  /muito\s*bom/i,
  /boa\s*(implementação|correção|solução)/i,

  // Elogios gerais (Inglês)
  /good\s*(catch|job|work|point|find)/i,
  /nice\s*(fix|work|job|catch|solution)/i,
  /well\s*(done|spotted|found)/i,
  /great\s*(job|work|fix|solution)/i,
  /thanks?\s*(for|to)/i,
  /thank\s*you/i,

  // Reconhecimento de correção
  /correção\s*(foi|aplicada)/i,
  /i\s*see\s*(you|this|that)\s*(have|has|'ve)\s*(fixed|corrected|addressed)/i,
  /this\s*(has\s*been|is)\s*(fixed|corrected|addressed|resolved)/i,
  /already\s*(fixed|corrected|addressed)/i,
  /looks\s*(good|better|correct)/i,
  /properly\s*(fixed|handled|implemented)/i,

  // Confirmação não-acionável
  /^correct$/i,
  /^agreed$/i,
  /makes\s*sense/i,
  /reasonable/i,
  /acceptable/i,

  // Marcadores de aprovação
  /^lgtm$/i,
  /^sgtm$/i,
  /^looks good to me$/i,
  /^seems good to me$/i,
  /^approved$/i,
];

/**
 * Verifica se um comentário é um elogio ou reconhecimento
 * e não deve ser transformado em issue
 *
 * @param {string} body - Corpo do comentário
 * @returns {boolean} True se é um comentário não-acionável
 */
function isCompliment(body) {
  if (!body) return false;

  // KEY INSIGHT: Gemini issues reais SEMPRE têm badge de prioridade
  // ![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)
  // Comentários sem badge são tipicamente compliments/acknowledgments
  const hasPriorityBadge = /!\[(critical|high|medium|low)\]\([^)]+\)/i.test(body);

  if (!hasPriorityBadge) {
    console.log(`[FILTER] No priority badge - likely compliment: "${body.substring(0, 50)}..."`);
    return true;
  }

  const normalizedBody = body
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove badges
    .replace(/```[\s\S]*?```/g, '')   // Remove code blocks
    .trim();

  // Se o corpo está vazio após limpeza, não é elogio
  if (!normalizedBody) return false;

  // Verificar padrões de elogio
  for (const pattern of COMPLIMENT_PATTERNS) {
    if (pattern.test(normalizedBody)) {
      console.log(`[FILTER] Compliment detected: "${normalizedBody.substring(0, 50)}..."`);
      return true;
    }
  }

  // Verificar se o comentário é muito curto (< 20 chars) e positivo
  if (normalizedBody.length < 20) {
    const positiveWords = ['good', 'nice', 'ok', 'done', 'fixed', 'correct', 'bom', 'ótimo'];
    const hasPositive = positiveWords.some(w => normalizedBody.toLowerCase().includes(w));
    if (hasPositive) {
      console.log(`[FILTER] Short positive comment: "${normalizedBody}"`);
      return true;
    }
  }

  return false;
}

/**
 * Filtra comentários que são elogios ou não-acionáveis
 *
 * @param {Array<Object>} comments - Comentários parseados
 * @returns {Array<Object>} Comentários filtrados
 */
function filterCompliments(comments) {
  const filtered = comments.filter(c => !isCompliment(c.raw || c.issue));

  const removed = comments.length - filtered.length;
  if (removed > 0) {
    console.log(`[FILTER] Removed ${removed} compliment(s) from ${comments.length} total comments`);
  }

  return filtered;
}

// Exporta funções para uso em workflows (CommonJS)
module.exports = {
  parseGeminiComment,
  categorizeIssues,
  normalizePriority,
  isAutoFixable,
  isSecurityIssue,
  generateStructuredOutput,
  categorizeIssue,
  generateAutoFixCommands,
  // New exports for P3
  isCompliment,
  filterCompliments,
  COMPLIMENT_PATTERNS
};
