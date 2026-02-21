/**
 * Script para criar GitHub Issues automaticamente a partir do review do Gemini
 *
 * Este módulo cria issues para issues MEDIUM que não podem ser auto-fixados,
 * movendo discussões de refactoring para fora da timeline do PR.
 *
 * @module create-issues
 * @version 1.0.0
 * @created 2026-02-20
 */

// Labels para issues de refactoring do Gemini
const REFACTOR_LABELS = {
  GEMINI_REFACTOR: '🤖 gemini-refactor',
  REFACTORING: 'refactoring',
  TECH_DEBT: 'tech-debt'
};

// Keywords que indicam itens acionáveis
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

// Keywords que indicam elogios (devem ser filtrados)
const COMPLIMENT_KEYWORDS = [
  'excelente', 'excellent', 'ótimo', 'otimo', 'great',
  'muito bom', 'very good', 'eficaz', 'effective',
  'essencial', 'essential', 'crucial', 'crucial',
  'inteligente', 'intelligent', 'smart',
  'bem implementado', 'well implemented',
  'boa prática', 'good practice'
];

/**
 * Determina se uma issue deve ser criada baseada na análise do conteúdo
 *
 * @param {Object} issue - A issue do review do Gemini
 * @returns {boolean} True se a issue deve ser criada
 */
function shouldCreateIssue(issue) {
  const text = (issue.issue || '').toLowerCase();

  // Deve ter keyword acionável
  const hasActionable = ACTIONABLE_KEYWORDS.some(kw => text.includes(kw));
  if (!hasActionable) return false;

  // Não deve ser elogio puro (verifica se começa com ou contém frases de elogio)
  const isCompliment = COMPLIMENT_KEYWORDS.some(kw =>
    text.startsWith(kw) ||
    text.includes(`é ${kw}`) ||
    text.includes(`é uma ${kw}`) ||
    text.includes(`é uma solução ${kw}`)
  );
  if (isCompliment) return false;

  // Deve ter sugestão real de código (não vazia ou placeholder)
  const hasRealSuggestion = issue.suggestion &&
    issue.suggestion.trim().length > 20 &&
    !issue.suggestion.includes('Nenhuma sugestão');

  return hasRealSuggestion;
}

/**
 * Cria GitHub Issues para issues não-críticos
 *
 * @param {Object} reviewData - Dados do review
 * @param {number} reviewData.pr_number - Número do PR
 * @param {Array<Object>} reviewData.issues - Lista de issues
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto
 * @returns {Promise<number[]>} IDs das issues criadas
 */
async function createIssuesFromReview(reviewData, prNumber, github, context) {
  const createdIssues = [];

  // Filtrar apenas issues MEDIUM que não são auto-fixáveis e são acionáveis
  const mediumIssues = reviewData.issues?.filter(
    issue => issue.severity === 'MEDIUM' &&
             !issue.auto_fixable &&
             shouldCreateIssue(issue)
  ) || [];

  if (mediumIssues.length === 0) {
    console.log('Nenhum issue MEDIUM não-auto-fixável encontrado');
    return createdIssues;
  }

  console.log(`Criando issues para ${mediumIssues.length} issues MEDIUM...`);

  for (const issue of mediumIssues) {
    try {
      // Verificar se já existe issue similar
      const existingIssue = await findSimilarIssue(issue, github, context);

      if (existingIssue) {
        console.log(`Issue similar já existe: #${existingIssue.number}`);
        continue;
      }

      // Criar nova issue
      const newIssue = await createIssue(issue, prNumber, github, context);
      createdIssues.push(newIssue.number);

      console.log(`Issue criada: #${newIssue.number} - ${newIssue.title}`);
    } catch (error) {
      console.error(`Erro ao criar issue para ${issue.file}:${issue.line}:`, error.message);
    }
  }

  return createdIssues;
}

/**
 * Cria uma nova issue no GitHub
 *
 * @param {Object} issue - Dados do issue
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto
 * @returns {Promise<Object>} Issue criada
 */
async function createIssue(issue, prNumber, github, context) {
  const { owner, repo } = context.repo;

  // Gerar título da issue
  const title = generateIssueTitle(issue);

  // Gerar corpo da issue
  const body = generateIssueBody(issue, prNumber);

  // Determinar labels
  const labels = [
    REFACTOR_LABELS.GEMINI_REFACTOR,
    REFACTOR_LABELS.REFACTORING
  ];

  // Adicionar label da categoria se existir
  if (issue.category && issue.category !== 'general') {
    labels.push(issue.category);
  }

  const { data: newIssue } = await github.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels
  });

  return newIssue;
}

/**
 * Gera o título da issue
 *
 * @param {Object} issue - Dados do issue
 * @returns {string} Título formatado
 */
function generateIssueTitle(issue) {
  const fileName = issue.file?.split('/').pop() || 'arquivo';
  const shortIssue = issue.issue?.substring(0, 60) || 'Refactoring necessário';
  const suffix = issue.issue?.length > 60 ? '...' : '';

  return `[Refactor] ${fileName}: ${shortIssue}${suffix}`;
}

/**
 * Verifica se existe issue similar já criada
 *
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
    // Extrair nome do arquivo do título da issue existente
    const titleMatch = existingIssue.title.match(/\[Refactor\]\s+([^:]+):/);
    const existingFile = titleMatch ? titleMatch[1] : null;
    const currentFile = issue.file?.split('/').pop();

    // Verificar se é o mesmo arquivo
    if (existingFile && currentFile && existingFile === currentFile) {
      // Verificar se a linha é similar (mesma linha ou próxima)
      const bodyMatch = existingIssue.body?.match(/linha\s+(\d+)/);
      const existingLine = bodyMatch ? parseInt(bodyMatch[1], 10) : null;

      if (existingLine && issue.line) {
        const lineDiff = Math.abs(existingLine - issue.line);
        // Considerar similar se estiverem a 5 linhas de diferença
        if (lineDiff <= 5) {
          return existingIssue;
        }
      }
    }

    // Verificar também por similaridade no texto do issue
    const existingIssueText = extractIssueFromBody(existingIssue.body);
    const currentIssueText = issue.issue?.substring(0, 50);

    if (existingIssueText && currentIssueText) {
      const similarity = calculateSimilarity(existingIssueText, currentIssueText);
      if (similarity > 0.8) { // 80% similar
        return existingIssue;
      }
    }
  }

  return null;
}

/**
 * Extrai o texto do issue do corpo da issue
 *
 * @param {string} body - Corpo da issue
 * @returns {string|null} Texto do issue ou null
 */
function extractIssueFromBody(body) {
  if (!body) return null;

  // Procurar por "### Issue" no corpo
  const match = body.match(/### Issue\s*\n([^\n]+)/);
  return match ? match[1].trim().substring(0, 50) : null;
}

/**
 * Calcula similaridade entre duas strings (coeficiente de Jaccard simplificado)
 *
 * @param {string} str1 - Primeira string
 * @param {string} str2 - Segunda string
 * @returns {number} Similaridade entre 0 e 1
 */
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().split(/\s+/);
  const s2 = str2.toLowerCase().split(/\s+/);

  const set1 = new Set(s1);
  const set2 = new Set(s2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Gera o corpo da issue
 *
 * @param {Object} issue - Dados do issue
 * @param {number} prNumber - Número do PR
 * @returns {string} Corpo da issue em Markdown
 */
function generateIssueBody(issue, prNumber) {
  const fileUrl = issue.url || '';
  const filePath = issue.file || 'arquivo não identificado';
  const line = issue.line || 'N/A';
  const suggestion = issue.suggestion || 'Nenhuma sugestão de código fornecida';
  const priority = issue.severity || 'MEDIUM';
  const category = issue.category || 'geral';

  return `## 🤖 Identificado pelo Gemini Code Assist

### Issue
${issue.issue || 'Descrição não disponível'}

### Arquivo
[${filePath}](${fileUrl}) (linha ${line})

### Sugestão
\`\`\`javascript
${suggestion}
\`\`\`

### Contexto
- **PR:** #${prNumber}
- **Prioridade:** ${priority}
- **Categoria:** ${category}

### Checklist
- [ ] Avaliar se a sugestão faz sentido para o projeto
- [ ] Implementar alteração se aprovada
- [ ] Atualizar testes se necessário
- [ ] Marcar como concluída

---
*Issue criada automaticamente pelo Gemini Code Assist Integration*`;
}

// Exporta funções para uso em workflows (CommonJS)
module.exports = {
  createIssuesFromReview,
  createIssue,
  findSimilarIssue,
  generateIssueTitle,
  generateIssueBody,
  extractIssueFromBody,
  calculateSimilarity,
  shouldCreateIssue,
  REFACTOR_LABELS,
  ACTIONABLE_KEYWORDS,
  COMPLIMENT_KEYWORDS
};
