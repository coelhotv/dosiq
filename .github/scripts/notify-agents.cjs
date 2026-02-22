/**
 * Script de notificação de agents externos via webhook
 *
 * Este módulo envia notificações HTTP POST para agents externos (como Kilocode)
 * quando novas reviews do Gemini Code Assist estão disponíveis.
 *
 * Componente P4.7 da arquitetura de integração Gemini-Agent.
 *
 * @module notify-agents
 * @version 1.0.0
 * @created 2026-02-22
 */

const crypto = require('crypto');

/**
 * Configurações do webhook
 */
const WEBHOOK_CONFIG = {
  TIMEOUT_MS: 10000,           // Timeout de 10 segundos
  MAX_RETRIES: 3,              // Número máximo de tentativas
  RETRY_DELAYS: [1000, 2000, 4000], // Delays exponenciais (1s, 2s, 4s)
};

/**
 * Determina se a notificação deve ser enviada baseado na prioridade dos issues
 * 
 * @param {Object} reviewData - Dados da review do Gemini
 * @param {Object} reviewData.summary - Resumo da review
 * @param {number} reviewData.summary.critical_count - Número de issues CRITICAL
 * @param {number} reviewData.summary.high_count - Número de issues HIGH
 * @param {number} reviewData.summary.total_issues - Número total de issues
 * @param {string} [notifyMode='critical'] - Modo de notificação ('all', 'high', 'critical')
 * @returns {boolean} true se deve notificar, false caso contrário
 */
function shouldNotify(reviewData, notifyMode = 'critical') {
  if (!reviewData || !reviewData.summary) {
    console.log('⚠️ Dados de review inválidos, pulando notificação');
    return false;
  }

  const { critical_count = 0, high_count = 0, total_issues = 0 } = reviewData.summary;

  // Modo 'all': notifica sempre que houver issues
  if (notifyMode === 'all') {
    return total_issues > 0;
  }

  // Modo 'high': notifica se houver HIGH ou CRITICAL
  if (notifyMode === 'high') {
    return high_count > 0 || critical_count > 0;
  }

  // Modo 'critical' (padrão): notifica apenas se houver CRITICAL
  return critical_count > 0;
}

/**
 * Formata o payload padronizado para o webhook
 * 
 * Conforme protocolo P4.2, o payload inclui:
 * - event: tipo do evento
 * - pr_number: número do PR
 * - branch: nome da branch
 * - commit_sha: SHA do commit
 * - issue_count: total de issues
 * - critical_count: issues CRITICAL
 * - high_count: issues HIGH
 * - api_endpoint: endpoint para buscar detalhes
 * - timestamp: ISO 8601 UTC
 * 
 * @param {Object} reviewData - Dados da review do Gemini
 * @param {number} prNumber - Número do PR
 * @param {string} branch - Nome da branch
 * @param {string} commitSha - SHA do commit
 * @param {string} [apiBaseUrl] - URL base da API
 * @returns {Object} Payload formatado
 */
function formatWebhookPayload(reviewData, prNumber, branch, commitSha, apiBaseUrl = 'https://api.meus-remedios.vercel.app') {
  const timestamp = new Date().toISOString();
  
  const summary = reviewData.summary || {};
  
  return {
    event: 'gemini_review_available',
    pr_number: prNumber,
    branch: branch,
    commit_sha: commitSha,
    issue_count: summary.total_issues || 0,
    critical_count: summary.critical_count || summary.critical || 0,
    high_count: summary.high_count || summary.high || 0,
    api_endpoint: `${apiBaseUrl}/api/gemini-reviews?pr_number=${prNumber}`,
    timestamp: timestamp
  };
}

/**
 * Aguarda um período de tempo
 * 
 * @param {number} ms - Milissegundos para aguardar
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Envia requisição POST para um webhook com retry e timeout
 * 
 * @param {string} webhookUrl - URL do webhook
 * @param {Object} payload - Dados a serem enviados
 * @param {string} secret - Token de autenticação
 * @param {Object} [options] - Opções adicionais
 * @param {number} [options.timeout] - Timeout em ms (padrão: 10000)
 * @param {number} [options.maxRetries] - Máximo de tentativas (padrão: 3)
 * @returns {Promise<{success: boolean, status?: number, error?: string}>}
 */
async function sendWebhookWithRetry(webhookUrl, payload, secret, options = {}) {
  const timeout = options.timeout || WEBHOOK_CONFIG.TIMEOUT_MS;
  const maxRetries = options.maxRetries || WEBHOOK_CONFIG.MAX_RETRIES;
  const retryDelays = WEBHOOK_CONFIG.RETRY_DELAYS;

  // Calculate HMAC signature for webhook authentication
  const signature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📤 Enviando webhook para ${webhookUrl} (tentativa ${attempt}/${maxRetries})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Event': 'review_available',
          'X-Gemini-Signature-256': `sha256=${signature}`,
          'X-Webhook-Attempt': attempt.toString()
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`✅ Webhook enviado com sucesso: ${response.status}`);
        return { success: true, status: response.status };
      }

      // Se não for 2xx, tenta novamente
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(`⚠️ Webhook retornou ${response.status}: ${errorText}`);

      // Se for erro 4xx (client error), não faz retry
      if (response.status >= 400 && response.status < 500) {
        return { 
          success: false, 
          status: response.status, 
          error: `Client error: ${response.status} - ${errorText}` 
        };
      }

      // Para 5xx, faz retry
      if (attempt < maxRetries) {
        const delay = retryDelays[attempt - 1] || retryDelays[retryDelays.length - 1];
        console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await sleep(delay);
      }

    } catch (error) {
      console.log(`❌ Erro na tentativa ${attempt}: ${error.message}`);

      // Se for timeout ou erro de rede, faz retry
      if (attempt < maxRetries) {
        const delay = retryDelays[attempt - 1] || retryDelays[retryDelays.length - 1];
        console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await sleep(delay);
      } else {
        return { 
          success: false, 
          error: error.message 
        };
      }
    }
  }

  return { 
    success: false, 
    error: `Falha após ${maxRetries} tentativas` 
  };
}

/**
 * Notifica todos os agents configurados via webhook
 * 
 * @param {Object} reviewData - Dados da review do Gemini
 * @param {string[]} agentWebhooks - Array de URLs dos webhooks
 * @param {string} secret - Token de autenticação
 * @param {Object} context - Contexto adicional
 * @param {number} context.prNumber - Número do PR
 * @param {string} context.branch - Nome da branch
 * @param {string} context.commitSha - SHA do commit
 * @returns {Promise<{success: boolean, results: Array}>}
 */
async function notifyAgents(reviewData, agentWebhooks, secret, context) {
  if (!agentWebhooks || agentWebhooks.length === 0) {
    console.log('ℹ️ Nenhum webhook configurado, pulando notificação');
    return { success: true, results: [] };
  }

  if (!context || !context.prNumber) {
    console.log('⚠️ Contexto inválido, pulando notificação');
    return { success: false, results: [], error: 'Contexto inválido' };
  }

  const payload = formatWebhookPayload(
    reviewData,
    context.prNumber,
    context.branch,
    context.commitSha
  );

  console.log(`🔔 Notificando ${agentWebhooks.length} agent(s)`);
  console.log(`📊 Payload: ${JSON.stringify(payload, null, 2)}`);

  const results = [];

  for (const webhookUrl of agentWebhooks) {
    try {
      const result = await sendWebhookWithRetry(webhookUrl, payload, secret);
      results.push({
        webhook: webhookUrl,
        ...result
      });

      if (!result.success) {
        console.log(`⚠️ Falha ao notificar ${webhookUrl}: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Erro inesperado ao notificar ${webhookUrl}: ${error.message}`);
      results.push({
        webhook: webhookUrl,
        success: false,
        error: error.message
      });
    }
  }

  const allSuccess = results.every(r => r.success);
  const successCount = results.filter(r => r.success).length;

  console.log(`📊 Resultado: ${successCount}/${agentWebhooks.length} webhooks notificados com sucesso`);

  return {
    success: allSuccess,
    results
  };
}

/**
 * Parser de URLs de webhooks a partir de string JSON ou array
 * 
 * @param {string} webhooksConfig - Configuração de webhooks (JSON string ou comma-separated)
 * @returns {string[]} Array de URLs
 */
function parseWebhookUrls(webhooksConfig) {
  if (!webhooksConfig) {
    return [];
  }

  try {
    // Tenta parsear como JSON array
    const parsed = JSON.parse(webhooksConfig);
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null && typeof item.url === 'string') return item.url;
          return null;
        })
        .filter(url => url && url.startsWith('http'));
    }
  } catch {
    // Não é JSON, tenta split por vírgula
    return webhooksConfig
      .split(',')
      .map(url => url.trim())
      .filter(url => url.startsWith('http'));
  }

  return [];
}

// Exportações para uso em módulos e testes
module.exports = {
  shouldNotify,
  formatWebhookPayload,
  notifyAgents,
  sendWebhookWithRetry,
  parseWebhookUrls,
  WEBHOOK_CONFIG
};

// Execução standalone (quando chamado diretamente via node)
if (require.main === module) {
  // Verifica se está rodando em ambiente GitHub Actions
  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
  
  if (!isGitHubActions) {
    console.log('ℹ️ Modo standalone - para uso em GitHub Actions, use via actions/github-script');
    
    // Exemplo de uso para teste manual
    const testData = {
      summary: {
        total_issues: 3,
        critical_count: 0,
        high_count: 1
      }
    };
    
    console.log('Teste shouldNotify (critical):', shouldNotify(testData, 'critical'));
    console.log('Teste shouldNotify (high):', shouldNotify(testData, 'high'));
    console.log('Teste shouldNotify (all):', shouldNotify(testData, 'all'));
    
    const payload = formatWebhookPayload(testData, 117, 'feature/test', 'abc123');
    console.log('Teste formatWebhookPayload:', JSON.stringify(payload, null, 2));
  }
}
