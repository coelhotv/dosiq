import { createLogger } from '../logger.js';

const logger = createLogger('commandWrapper');

/**
 * Standard error messages for bot commands
 */
export const ERROR_MESSAGES = {
  USER_NOT_LINKED: '❌ Conta não vinculada. Use /start TOKEN para vincular sua conta.\n\nVocê pode gerar um token no aplicativo web em Configurações.',
  GENERIC_ERROR: '❌ Ocorreu um erro ao processar seu comando. Por favor, tente novamente.',
  NO_PROTOCOLS: 'Você não possui protocolos ativos no momento. Use o app web para cadastrar.',
  NO_MEDICINES: 'Você não possui medicamentos cadastrados. Use o app web para cadastrar.',
  INVALID_INPUT: '❌ Entrada inválida. Por favor, verifique e tente novamente.',
};

/**
 * Wrapper for bot command handlers with standardized error handling
 * @param {string} commandName - Name of the command for logging
 * @param {Function} handler - Command handler function
 * @param {Object} options - Options for command behavior
 * @param {boolean} options.logUsage - Whether to log command usage (default: true)
 * @returns {Function} Wrapped command handler
 */
export function commandWrapper(commandName: string, handler: (...args: any[]) => any, options: { logUsage?: boolean } = {}) {
  const { logUsage = true } = options;
  
  return async (bot, msg, ...args) => {
    const chatId = msg.chat?.id;
    const userId = msg.from?.id;
    const username = msg.from?.username || 'unknown';
    
    if (!chatId) {
      logger.error(`[${commandName}] No chat ID in message`);
      return;
    }
    
    try {
      if (logUsage) {
        logger.info(`[${commandName}] Command invoked by user ${userId} (@${username})`);
      }
      
      await handler(bot, msg, ...args);
      
    } catch (err) {
      logger.error(`[${commandName}] Error:`, err);
      
      // Handle specific error types
      if (err.message === 'User not linked') {
        return bot.sendMessage(chatId, ERROR_MESSAGES.USER_NOT_LINKED);
      }
      
      if (err.message === 'No protocols found') {
        return bot.sendMessage(chatId, ERROR_MESSAGES.NO_PROTOCOLS);
      }
      
      if (err.message === 'No medicines found') {
        return bot.sendMessage(chatId, ERROR_MESSAGES.NO_MEDICINES);
      }
      
      if (err.message === 'Invalid input') {
        return bot.sendMessage(chatId, ERROR_MESSAGES.INVALID_INPUT);
      }
      
      // Generic error for unknown cases
      try {
        await bot.sendMessage(chatId, ERROR_MESSAGES.GENERIC_ERROR);
      } catch (sendErr) {
        logger.error(`[${commandName}] Failed to send error message:`, sendErr);
      }
    }
  };
}

/**
 * Wrapper for callback query handlers with standardized error handling
 * @param {string} callbackName - Name of the callback for logging
 * @param {Function} handler - Callback handler function
 * @returns {Function} Wrapped callback handler
 */
export function callbackWrapper(callbackName, handler) {
  return async (bot, callbackQuery) => {
    const chatId = callbackQuery.message?.chat?.id;
    const userId = callbackQuery.from?.id;
    const callbackId = callbackQuery.id;
    
    if (!chatId) {
      logger.error(`[${callbackName}] No chat ID in callback query`);
      return;
    }
    
    try {
      logger.debug(`[${callbackName}] Callback invoked by user ${userId}`);
      
      await handler(bot, callbackQuery);
      
    } catch (err) {
      logger.error(`[${callbackName}] Error:`, err);
      
      // Handle specific error types
      if (err.message === 'User not linked') {
        return bot.answerCallbackQuery(callbackId, {
          text: 'Conta não vinculada. Use /start para vincular.',
          show_alert: true
        });
      }
      
      // Generic error for unknown cases
      try {
        await bot.answerCallbackQuery(callbackId, {
          text: 'Erro ao processar ação.',
          show_alert: true
        });
      } catch (sendErr) {
        logger.error(`[${callbackName}] Failed to send error callback:`, sendErr);
      }
    }
  };
}

/**
 * Compose multiple middleware functions
 * @param  {...Function} middlewares - Middleware functions to compose
 * @returns {Function} Composed middleware
 */
export function compose(...middlewares) {
  return (handler) => {
    return middlewares.reduceRight((wrapped, middleware) => {
      return middleware(wrapped);
    }, handler);
  };
}
