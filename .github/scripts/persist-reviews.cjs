#!/usr/bin/env node
/**
 * Persist Reviews - Workflow Intelligence
 *
 * Persiste reviews do Gemini no Supabase com deduplicação por hash.
 * Este é o ponto central do sistema de Workflow Intelligence.
 *
 * @module persist-reviews
 * @version 2.0.0
 * @requires @supabase/supabase-js
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Resultado da persistência
 * @typedef {Object} PersistResult
 * @property {number} created - Quantidade de issues criadas
 * @property {number} updated - Quantidade de issues atualizadas
 * @property {number} skipped - Quantidade ignoradas (duplicatas/falso positivo)
 * @property {number} reactivated - Quantidade reativadas (resolved → detected)
 * @property {Array<string>} errors - Erros encontrados
 * @property {Array<Object>} createdIssues - Issues criadas (com IDs)
 */

/**
 * Persiste reviews do Gemini com deduplicação por hash
 *
 * @param {Object} reviewData - Dados do review parseado
 * @param {number} reviewData.pr_number - Número do PR
 * @param {string} reviewData.commit_sha - SHA do commit
 * @param {Array<Object>} reviewData.issues - Lista de issues
 * @param {Object} options - Opções de processamento
 * @param {boolean} [options.dryRun=false] - Simulação sem persistir
 * @returns {Promise<PersistResult>} Resultado da persistência
 */
async function persistReviews(reviewData, options = {}) {
  const { pr_number, commit_sha, issues = [] } = reviewData;
  const { dryRun = false } = options;

  console.log(`🔄 Persistindo ${issues.length} issues para PR #${pr_number}...`);

  /** @type {PersistResult} */
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    reactivated: 0,
    errors: [],
    createdIssues: []
  };

  for (const issue of issues) {
    try {
      const issueHash = calculateIssueHash(issue);

      // Verificar se issue já existe
      const existing = await checkExistingHash(issueHash);

      if (existing) {
        const action = await handleExistingIssue(existing, issue, pr_number, commit_sha, dryRun);

        switch (action) {
          case 'skipped':
            results.skipped++;
            console.log(`  ⏭️  Skipped (hash: ${issueHash.substring(0, 16)}...)`);
            break;
          case 'updated':
            results.updated++;
            console.log(`  📝 Updated (id: ${existing.id})`);
            break;
          case 'reactivated':
            results.reactivated++;
            console.log(`  🔄 Reactivated (id: ${existing.id})`);
            break;
        }
        continue;
      }

      // Criar nova issue
      if (!dryRun) {
        const newIssue = await createNewIssue(issue, issueHash, pr_number, commit_sha);
        results.created++;
        results.createdIssues.push(newIssue);
        console.log(`  ✅ Created (id: ${newIssue.id}, hash: ${issueHash.substring(0, 16)}...)`);
      } else {
        results.created++;
        console.log(`  [DRY RUN] Would create issue with hash: ${issueHash.substring(0, 16)}...`);
      }

    } catch (error) {
      console.error(`  ❌ Error processing issue "${issue.title}":`, error.message);
      results.errors.push({
        issue: issue.title,
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Log resumido
  console.log('\n📊 Resumo:');
  console.log(`   Criadas: ${results.created}`);
  console.log(`   Atualizadas: ${results.updated}`);
  console.log(`   Ignoradas: ${results.skipped}`);
  console.log(`   Reativadas: ${results.reactivated}`);
  console.log(`   Erros: ${results.errors.length}`);

  return results;
}

/**
 * Calcula hash SHA-256 para uma issue
 *
 * @param {Object} issue - Dados da issue
 * @returns {string} Hash SHA-256 (64 caracteres hexadecimais)
 */
function calculateIssueHash(issue) {
  const content = JSON.stringify({
    file_path: issue.file_path || issue.file,
    line_start: issue.line_start || issue.line,
    line_end: issue.line_end || issue.line,
    title: issue.title || issue.issue?.substring(0, 100) || 'Untitled',
    description: issue.description || issue.issue || '',
    suggestion: issue.suggestion?.trim() || null
  }, Object.keys({}).sort()); // Ordenar chaves para consistência

  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}

/**
 * Verifica se uma issue já existe no banco
 *
 * @param {string} issueHash - Hash SHA-256
 * @returns {Promise<Object|null>} Registro existente ou null
 */
async function checkExistingHash(issueHash) {
  const { data, error } = await supabase
    .from('gemini_reviews')
    .select('id, status, github_issue_number, created_at, updated_at')
    .eq('issue_hash', issueHash)
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar hash:', error);
    throw error;
  }

  return data;
}

/**
 * Decide ação para issue existente
 *
 * @param {Object} existing - Registro existente
 * @param {Object} newIssue - Nova issue detectada
 * @param {number} prNumber - Número do PR
 * @param {string} commitSha - SHA do commit
 * @param {boolean} dryRun - Modo simulação
 * @returns {Promise<string>} Ação: 'skipped', 'updated', 'reactivated'
 */
async function handleExistingIssue(existing, newIssue, prNumber, commitSha, dryRun) {
  const { id, status } = existing;

  // Estados finais - ignorar
  const finalStatuses = ['wontfix', 'duplicate'];
  if (finalStatuses.includes(status)) {
    return 'skipped';
  }

  // Resolvida - verificar se é re-introdução
  if (status === 'resolved') {
    // Se chegou aqui com mesmo hash, é código idêntico = re-introdução
    if (!dryRun) {
      await supabase
        .from('gemini_reviews')
        .update({
          status: 'detected',
          pr_number: prNumber,
          commit_sha: commitSha,
          updated_at: new Date().toISOString(),
          resolution_type: null,
          resolved_by: null,
          resolved_at: null
        })
        .eq('id', id);
    }
    return 'reactivated';
  }

  // Parcial - reativar para reported
  if (status === 'partial') {
    if (!dryRun) {
      await supabase
        .from('gemini_reviews')
        .update({
          status: 'reported',
          pr_number: prNumber,
          commit_sha: commitSha,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    }
    return 'reactivated';
  }

  // Detected/reported/assigned - atualizar referências
  if (!dryRun) {
    await supabase
      .from('gemini_reviews')
      .update({
        pr_number: prNumber,
        commit_sha: commitSha,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
  }
  return 'updated';
}

/**
 * Cria nova issue no Supabase
 *
 * @param {Object} issue - Dados da issue
 * @param {string} issueHash - Hash SHA-256
 * @param {number} prNumber - Número do PR
 * @param {string} commitSha - SHA do commit
 * @returns {Promise<Object>} Issue criada
 */
async function createNewIssue(issue, issueHash, prNumber, commitSha) {
  const insertData = {
    pr_number: prNumber,
    commit_sha: commitSha,
    file_path: issue.file_path || issue.file,
    line_start: issue.line_start || issue.line || null,
    line_end: issue.line_end || issue.line || null,
    issue_hash: issueHash,
    status: 'detected',
    priority: mapPriority(issue.priority),
    category: mapCategory(issue.category),
    title: issue.title || issue.issue?.substring(0, 200) || 'Sem título',
    description: issue.description || issue.issue || '',
    suggestion: issue.suggestion || null,
    review_data: issue
  };

  const { data, error } = await supabase
    .from('gemini_reviews')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // Tratar violação de UNIQUE constraint
    if (error.code === '23505') {
      throw new Error(`Hash collision detectado: ${issueHash}`);
    }
    throw error;
  }

  return data;
}

/**
 * Mapeia prioridade do Gemini para formato do banco
 *
 * @param {string} priority - Prioridade do Gemini
 * @returns {string} Prioridade mapeada
 */
function mapPriority(priority) {
  const map = {
    'CRITICAL': 'critica',
    'HIGH': 'alta',
    'MEDIUM': 'media',
    'LOW': 'baixa',
    'critical': 'critica',
    'high': 'alta',
    'medium': 'media',
    'low': 'baixa'
  };
  return map[priority] || 'media';
}

/**
 * Mapeia categoria do Gemini para formato do banco
 *
 * @param {string} category - Categoria do Gemini
 * @returns {string} Categoria mapeada
 */
function mapCategory(category) {
  const map = {
    'style': 'estilo',
    'bug': 'bug',
    'security': 'seguranca',
    'performance': 'performance',
    'maintainability': 'manutenibilidade',
    'refactoring': 'manutenibilidade',
    'best-practice': 'manutenibilidade'
  };
  return map[category?.toLowerCase()] || 'geral';
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const reviewFile = args[0];
  const dryRun = args.includes('--dry-run');

  if (!reviewFile) {
    console.error('❌ Uso: node persist-reviews.cjs <review-json-file> [--dry-run]');
    console.error('');
    console.error('Exemplo:');
    console.error('  node persist-reviews.cjs review-data.json');
    console.error('  node persist-reviews.cjs review-data.json --dry-run');
    process.exit(1);
  }

  try {
    const reviewData = require(`./${reviewFile}`);
    persistReviews(reviewData, { dryRun })
      .then(results => {
        console.log('\n✅ Persistência concluída');
        process.exit(results.errors.length > 0 ? 1 : 0);
      })
      .catch(error => {
        console.error('\n❌ Erro fatal:', error);
        process.exit(1);
      });
  } catch (error) {
    console.error(`❌ Erro ao carregar arquivo ${reviewFile}:`, error.message);
    process.exit(1);
  }
}

module.exports = {
  persistReviews,
  calculateIssueHash,
  checkExistingHash
};
