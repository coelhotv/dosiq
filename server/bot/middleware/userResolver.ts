import { getUserIdByChatId } from '../../services/userService.js';

/**
 * Resolve user ID from chat ID
 * @param {number|string} chatId - Telegram chat ID
 * @returns {Promise<string>} User UUID
 * @throws {Error} If user is not linked
 */
export async function resolveUser(chatId) {
  const userId = await getUserIdByChatId(chatId);
  return userId;
}

/**
 * Middleware wrapper that resolves user before executing handler
 * @param {Function} handler - Command handler function (bot, msg, userId, ...args)
 * @param {Object} options - Options for middleware behavior
 * @param {boolean} options.requiresAuth - Whether user must be linked (default: true)
 * @returns {Function} Wrapped handler
 */
export function withUser(handler: (...args: any[]) => any, options: { requiresAuth?: boolean } = {}) {
  const { requiresAuth = true } = options;
  
  return async (bot, msg, ...args) => {
    const chatId = msg.chat?.id;
    
    if (!chatId) {
      console.error('No chat ID found in message');
      return;
    }
    
    try {
      let userId = null;
      
      if (requiresAuth) {
        userId = await resolveUser(chatId);
      }
      
      return await handler(bot, msg, userId, ...args);
      
    } catch (err) {
      if (err.message === 'User not linked') {
        return bot.sendMessage(chatId, 
          '❌ Conta não vinculada. Use /start TOKEN para vincular sua conta.\n\n' +
          'Você pode gerar um token no aplicativo web em Configurações.'
        );
      }
      
      throw err;
    }
  };
}

/**
 * Middleware wrapper for callback queries that resolves user
 * @param {Function} handler - Callback handler function (bot, callbackQuery, userId)
 * @param {Object} options - Options for middleware behavior
 * @param {boolean} options.requiresAuth - Whether user must be linked (default: true)
 * @returns {Function} Wrapped handler
 */
export function withUserCallback(handler: (...args: any[]) => any, options: { requiresAuth?: boolean } = {}) {
  const { requiresAuth = true } = options;
  
  return async (bot, callbackQuery) => {
    const chatId = callbackQuery.message?.chat?.id;
    const callbackId = callbackQuery.id;
    
    if (!chatId) {
      console.error('No chat ID found in callback query');
      return;
    }
    
    try {
      let userId = null;
      
      if (requiresAuth) {
        userId = await resolveUser(chatId);
      }
      
      return await handler(bot, callbackQuery, userId);
      
    } catch (err) {
      if (err.message === 'User not linked') {
        return bot.answerCallbackQuery(callbackId, {
          text: 'Conta não vinculada. Use /start para vincular.',
          show_alert: true
        });
      }
      
      throw err;
    }
  };
}
