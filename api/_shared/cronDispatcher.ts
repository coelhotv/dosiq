// cronDispatcher.ts — dispatcher de notificação dos jobs de cron (notify + ops, spec 107).
// Extraído de api/notify.ts SEM mudança de comportamento: o api/ops (spec 107) precisa do mesmo
// dispatcher (push dos avisos D+60/D+83 e do alerta ao admin), e duas cópias seriam duas fontes
// do mesmo contrato — a lição do preferencesRepo abaixo.

import { createLogger } from '../../server/bot/logger.js';
import { dispatchNotification } from '../../server/notifications/dispatcher/dispatchNotification.js';
import { notificationPreferenceRepository } from '../../server/notifications/repositories/notificationPreferenceRepository.js';
import { getServerTimestamp } from '../../server/utils/dateUtils.js';

const logger = createLogger('CronNotify');

// === HELPER: isRetryableError ===

function isRetryableError(error) {
  const retryableCodes = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'Socket hang up',
    'ECONNABORTED',
    'Network Error'
  ];

  if (retryableCodes.some(code =>
    error.message?.includes(code) ||
    error.code === code
  )) {
    return true;
  }

  if (error.response?.status === 429) {
    return true;
  }

  if (error.response?.status >= 500) {
    return true;
  }

  return false;
}

// --- Bot Adapter (Minimal for Notifications) ---
export function createNotifyBotAdapter(token) {
  const telegramFetch = async (method, body) => {
    let res;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.ok) {
        logger.error(`Erro na API do Telegram (${method})`, null, { error: data });
        const error = new Error(`Erro Telegram API: ${data.error_code} - ${data.description}`) as any; // TODO(040-strict): tipar erro custom
        error.response = { status: res.status };
        error.statusCode = res.status;
        throw error;
      }

      return data.result;
    } catch (err: any) {
      if (!err.response && res) {
        err.response = { status: res.status };
        err.statusCode = res.status;
      }
      logger.error(`Erro de fetch (${method})`, err);
      throw err;
    }
  };

  return {
    sendMessage: async (chatId, text, options = {}) => {
      const maxAttempts = 2; // Simple: just 2 attempts
      let lastError;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await telegramFetch('sendMessage', { chat_id: chatId, text, ...options });

          logger.debug(`Mensagem Telegram enviada`, {
            chatId,
            messageId: result.message_id,
            attempt
          });

          return {
            success: true,
            messageId: result.message_id,
            timestamp: getServerTimestamp(),
            attempts: attempt
          };
        } catch (err) {
          lastError = err;

          // Only retry on network/retryable errors
          if (!isRetryableError(err) || attempt === maxAttempts) {
            break;
          }

          // Simple delay: 1 second
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.error(`Falha ao enviar mensagem Telegram após ${maxAttempts} tentativas`, lastError, { chatId });

      return {
        success: false,
        error: {
          code: lastError.name || 'SEND_FAILED',
          message: lastError.message,
          retryable: isRetryableError(lastError)
        },
        timestamp: getServerTimestamp(),
        attempts: maxAttempts
      };
    }
  };
}


/** Dispatcher do ciclo de cron sobre o client service-role e o Expo do chamador. `label` = rótulo no log. */
export function createCronDispatcher({ supabase, expoClient, bot, label = 'CronNotify' }) {
  // Rótulo do chamador no log: `api/ops` não é o cron de notificações (smoke 107: o alerta do
  // prune saía como [CronNotify] e confundia a busca no log da Vercel).
  const log = createLogger(label);
// === HELPERS: Repository factories ===

// 🔴 046 T014 — o repo de preferências É o canônico, não uma cópia local.
//
// Até 2026-08-21 este arquivo montava o seu próprio `preferencesRepo`, e o `select` dele não
// trazia `consent_revoked_at`. Como `isConsentSuppressed` decide por esse campo, ele chegava
// `undefined` e a supressão do consentimento revogado ficava INERTE exatamente no caminho que
// dispara lembrete de dose — o cron. Nada quebrava: o campo ausente num `select` não falha em
// tsc, lint ou teste (a suíte do dispatcher recebe as settings já montadas, então prova a
// política, não a query). É a classe da R-295, e o preço de duas implementações do mesmo
// contrato: a que tinha o campo era usada só pelo `server/index.ts`.
//
// Descoberto ao executar as provas do PO-5 em produção. A correção não é "adicionar a coluna
// aqui" — é não ter duas fontes: um contrato, um escritor.
const preferencesRepo = notificationPreferenceRepository;

const devicesRepo = {
  async listActiveByUser(userId, provider) {
    const { data } = await supabase.from('notification_devices').select('*').eq('user_id', userId).eq('provider', provider).eq('is_active', true);
    return data || [];
  },
  async deactivateByToken(token) {
    const { error } = await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: getServerTimestamp() })
      .eq('push_token', token);
    if (error) log.error('Falha ao desativar device por token', null, { error: error.message });
  }
};

const dlqRepo = {
  async enqueue(notificationData, error, retryCount, correlationId) {
    const { error: upsertError } = await supabase
      .from('failed_notification_queue')
      .upsert({
        user_id: notificationData.userId,
        protocol_id: notificationData.protocolId,
        notification_type: notificationData.type,
        notification_payload: notificationData,
        error_code: error?.code || error?.error_code,
        error_message: error?.message || 'Unknown error',
        retry_count: retryCount,
        correlation_id: correlationId,
        status: 'pending'
      }, {
        onConflict: 'correlation_id',
        ignoreDuplicates: false
      });
    if (upsertError) throw upsertError;
  }
};


  return {
    async dispatch({ userId, kind, data, context }) {
      try {
        const result = await dispatchNotification({
          userId,
          kind,
          data,
          channels: undefined, // TODO(040-strict): canais explícitos por chamada
          context,
          repositories: {
            preferences: preferencesRepo,
            devices: devicesRepo,
            dlq: dlqRepo
          },
          bot,
          expoClient
        });

        log.info('[notificationDispatcher] Resultado do envio', {
          userId,
          kind,
          success: result.success,
          totalDelivered: result.totalDelivered,
          totalFailed: result.totalFailed,
          correlationId: context?.correlationId
        });

        return result;
      } catch (error) {
        log.error('[notificationDispatcher] Erro ao enviar notificação', error, { userId, kind, correlationId: context?.correlationId });
        return { success: false, channels: [], totalDelivered: 0, totalFailed: 1, deactivatedTokens: [], errors: [{ message: error.message }] };
      }
    }
  };
}
