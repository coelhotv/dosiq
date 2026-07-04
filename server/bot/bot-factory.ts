import TelegramBot from 'node-telegram-bot-api';
import { createLogger } from './logger.js';

const logger = createLogger('BotFactory');

export class BotFactory {
  static createPollingBot(token) {
    logger.info('Creating polling bot...');
    
    const bot = new TelegramBot(token, { 
      polling: {
        interval: 300,
        autoStart: true,
        params: {
          timeout: 10
        }
      }
    });

    // Error handling for polling
    bot.on('polling_error', (error) => {
      logger.error('Polling error', error, { code: error.code });
      
      // Auto-reconnect on specific errors
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        logger.info('Attempting to restart polling...');
        setTimeout(() => {
          bot.stopPolling().then(() => {
            bot.startPolling();
            logger.info('Polling restarted');
          });
        }, 5000);
      }
    });

    bot.on('error', (error) => {
      logger.error('Bot error', error);
    });

    logger.info('Polling bot created successfully');
    return bot;
  }

  static async validateToken(token) {
    try {
      const testBot = new TelegramBot(token, { polling: false });
      const me = await testBot.getMe();
      logger.info('Token validated', { username: me.username });
      return { valid: true, botInfo: me };
    } catch (error) {
      logger.error('Token validation failed', error);
      return { valid: false, error: error.message };
    }
  }
}