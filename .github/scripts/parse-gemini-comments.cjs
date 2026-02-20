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
  const categorized = categorizeIssues(parsedComments);
  
  return {
    pr_number: prNumber,
    review_id: reviewId,
    timestamp: new Date().toISOString(),
    summary: {
      total_issues: parsedComments.length,
      auto_fixable: categorized.autoFixable.length,
      needs_agent: categorized.needsAgent.length,
      critical: categorized.critical.length
    },
    issues: parsedComments.map(c => ({
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

// Exporta funções para uso em workflows (CommonJS)
module.exports = {
  parseGeminiComment,
  categorizeIssues,
  normalizePriority,
  isAutoFixable,
  isSecurityIssue,
  generateStructuredOutput,
  categorizeIssue,
  generateAutoFixCommands
};
