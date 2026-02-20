/**
 * Script para aplicar labels ao PR baseado nos issues do Gemini
 * 
 * Este módulo determina quais labels devem ser aplicadas ao PR
 * baseado nos issues encontrados pelo Gemini Code Assist.
 * 
 * Segue o princípio "anti-noise" - NÃO adiciona comentários ao PR,
 * apenas labels para comunicação visual.
 * 
 * @module apply-labels
 * @version 1.0.0
 * @created 2026-02-20
 */

// Labels disponíveis
const LABELS = {
  GEMINI_REVIEWED: '🤖 gemini-reviewed',
  AUTO_FIX_APPLIED: '🔧 auto-fix-applied',
  NEEDS_HUMAN_REVIEW: '👀 needs-human-review',
  SECURITY_ISSUE: '🔒 security-issue',
  PERFORMANCE_ISSUE: '⚡ performance-issue',
  NEEDS_DOCS_UPDATE: '📚 needs-docs-update'
};

/**
 * Aplica labels ao PR baseado nos issues do Gemini
 * 
 * @param {Object} reviewData - Dados do review parseado
 * @param {number} reviewData.summary.total_issues - Total de issues encontrados
 * @param {number} reviewData.summary.auto_fixable - Issues que podem ser corrigidos automaticamente
 * @param {number} reviewData.summary.critical - Issues críticos
 * @param {Array<Object>} reviewData.issues - Lista de issues
 * @param {number} prNumber - Número do PR
 * @returns {Promise<string[]>} Labels aplicadas
 */
async function applyLabels(reviewData, prNumber) {
  const labels = [];
  
  // 1. SEMPRE adicionar "gemini-reviewed"
  labels.push(LABELS.GEMINI_REVIEWED);
  
  // 2. Adicionar "auto-fix-applied" se houver issues auto-fixable
  if (reviewData.summary.auto_fixable > 0) {
    labels.push(LABELS.AUTO_FIX_APPLIED);
  }
  
  // 3. Adicionar "needs-human-review" se:
  // - Há issues críticos, OU
  // - Qualquer issue tem prioridade HIGH
  const hasCritical = reviewData.summary.critical > 0;
  const hasHighPriority = reviewData.issues?.some(
    issue => issue.severity === 'HIGH'
  );
  
  if (hasCritical || hasHighPriority) {
    labels.push(LABELS.NEEDS_HUMAN_REVIEW);
  }
  
  // 4. Adicionar "security-issue" se há issues de segurança
  const hasSecurity = reviewData.issues?.some(
    issue => issue.category === 'security'
  );
  
  if (hasSecurity) {
    labels.push(LABELS.SECURITY_ISSUE);
  }
  
  // 5. Adicionar "performance-issue" se há issues de performance
  const hasPerformance = reviewData.issues?.some(
    issue => issue.category === 'performance'
  );
  
  if (hasPerformance) {
    labels.push(LABELS.PERFORMANCE_ISSUE);
  }
  
  // 6. Adicionar "needs-docs-update" se há issues de documentação
  const hasDocs = reviewData.issues?.some(
    issue => issue.category === 'documentation'
  );
  
  if (hasDocs) {
    labels.push(LABELS.NEEDS_DOCS_UPDATE);
  }
  
  console.log(`Applying ${labels.length} labels to PR #${prNumber}:`, labels);
  
  return labels;
}

/**
 * Remove labels antigas do PR antes de aplicar novas
 * Usado para manter labels atualizadas (replace, not add)
 * 
 * @param {Object} github - Instância do GitHub API
 * @param {number} prNumber - Número do PR
 * @param {string[]} labelsToKeep - Labels que devem ser mantidas
 * @returns {Promise<void>}
 */
async function removeOldLabels(github, prNumber, labelsToKeep) {
  const { owner, repo } = await github.rest.repos.get();
  
  // Buscar labels atuais do PR
  const { data: issue } = await github.rest.issues.get({
    owner,
    repo,
    issue_number: prNumber
  });
  
  const currentLabels = issue.labels.map(l => 
    typeof l === 'string' ? l : l.name
  );
  
  // Labels do Gemini para remover
  const geminiLabels = Object.values(LABELS);
  
  // Remover apenas labels do Gemini que não devem ser mantidas
  for (const label of currentLabels) {
    if (geminiLabels.includes(label) && !labelsToKeep.includes(label)) {
      try {
        await github.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: prNumber,
          name: label
        });
        console.log(`Removed label: ${label}`);
      } catch (error) {
        // Label pode já ter sido removida
        console.log(`Label ${label} already removed or not found`);
      }
    }
  }
}

/**
 * Aplica labels ao PR, substituindo labels antigas do Gemini
 * 
 * @param {Object} github - Instância do GitHub API
 * @param {Object} reviewData - Dados do review parseado
 * @param {number} prNumber - Número do PR
 * @returns {Promise<string[]>} Labels aplicadas
 */
async function applyLabelsWithReplace(github, reviewData, prNumber) {
  // Determina quais labels aplicar
  const labels = await applyLabels(reviewData, prNumber);
  
  // Remove labels antigas do Gemini primeiro
  await removeOldLabels(github, prNumber, labels);
  
  // Adiciona novas labels (se houver)
  if (labels.length > 0) {
    const { owner, repo } = await github.rest.repos.get();
    
    // Usar setLabels para substituir todas as labels do PR
    // Isso remove labels antigas automaticamente
    await github.rest.issues.setLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: labels
    });
    
    console.log(`Set ${labels.length} labels on PR #${prNumber}`);
  }
  
  return labels;
}

// Exporta funções para uso em workflows (ES Module)
export {
  applyLabels,
  applyLabelsWithReplace,
  removeOldLabels,
  LABELS
};
