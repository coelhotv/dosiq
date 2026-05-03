import { createLogger } from '../logger.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { supabase } from '../../services/supabase.js';

const logger = createLogger('CommandWrapper');

/**
 * Wrapper para comandos do bot que:
 * 1. Valida se usuário está vinculado
 * 2. Obtém user_id real do chat_id
 * 3. Trata erros de forma padronizada
 */
export function createCommandHandler(handler) {
  return async (bot, msg, ...args) => {
    const chatId = msg.chat.id;
    const commandName = handler.name || 'unknown';
    
    logger.info(`Executing command: ${commandName}`, { chatId, username: msg.from?.username });

    try {
      // Validar vinculação do usuário
      let userId;
      try {
        userId = await getUserIdByChatId(chatId);
        logger.debug(`User validated`, { userId, chatId });
      } catch {
        logger.warn(`User not linked`, { chatId });
        return await bot.sendMessage(chatId,
          '⚠️ *Conta não vinculada*\n\n' +
          'Você precisa conectar sua conta primeiro:\n\n' +
          '1. Abra o app Dosiq\n' +
          '2. Vá em *Configurações > Integração Telegram*\n' +
          '3. Clique em "Gerar Código"\n' +
          '4. Envie o código aqui: `/start SEU_CODIGO`',
          { parse_mode: 'Markdown' }
        );
      }

      // Executar handler com userId e supabase
      await handler(bot, msg, userId, supabase, ...args);
      
      logger.info(`Command completed: ${commandName}`, { chatId });
    } catch (error) {
      logger.error(`Command failed: ${commandName}`, error, { chatId });
      
      // Mensagem amigável para o usuário
      await bot.sendMessage(chatId,
        '❌ *Ocorreu um erro*\n\n' +
        'Não foi possível processar seu comando. Tente novamente mais tarde.\n\n' +
        'Se o problema persistir, use `/ajuda` para ver os comandos disponíveis.',
        { parse_mode: 'Markdown' }
      );
    }
  };
}

/**
 * Wrapper simplificado para callbacks
 */
export function createCallbackWrapper(handler) {
  return async (bot, callbackQuery, ...args) => {
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data;
    
    logger.debug(`Processing callback`, { chatId, data });

    try {
      await handler(bot, callbackQuery, ...args);
    } catch (error) {
      logger.error(`Callback failed`, error, { chatId, data });
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Erro ao processar ação',
        show_alert: true
      });
    }
  };
}