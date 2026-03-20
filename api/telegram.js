import { handleStart } from '../server/bot/commands/start.js';
import { handleStatus } from '../server/bot/commands/status.js';
import { handleEstoque } from '../server/bot/commands/estoque.js';
import { handleHoje } from '../server/bot/commands/hoje.js';
import { handleProxima } from '../server/bot/commands/proxima.js';
import { handleHistorico } from '../server/bot/commands/historico.js';
import { handleAjuda } from '../server/bot/commands/ajuda.js';
import { handleRegistrar } from '../server/bot/commands/registrar.js';
import { handleAdicionarEstoque, handleReporShortcut } from '../server/bot/commands/adicionar_estoque.js';
import { handlePausar, handleRetomar } from '../server/bot/commands/protocols.js';
import { handleCallbacks } from '../server/bot/callbacks/doseActions.js';
import { handleConversationalCallbacks } from '../server/bot/callbacks/conversational.js';
import { createLogger } from '../server/bot/logger.js';

// --- Configuration ---
const token = process.env.TELEGRAM_BOT_TOKEN;
const logger = createLogger('TelegramWebhook');
// Note: Supabase client in this file was unused in previous logic except for /start linking
// The imported commands use their own Supabase client from ../server/services/supabase.js
// which uses dotenv. We rely on process.env being available in Vercel.

// --- Bot Adapter ---
// Creates a mock Bot object that mimics node-telegram-bot-api but uses simple fetch for Vercel
function createBotAdapter(token) {
  const telegramFetch = async (method, body) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error(`Telegram API Error (${method}):`, data);
      }
      return data.result;
    } catch (err) {
      console.error(`Fetch Error (${method}):`, err);
    }
  };

  const listeners = {
    callback_query: [],
    message: [] // conversational callbacks listen to message
  };

  return {
    // Methods used by commands
    sendMessage: async (chatId, text, options = {}) => {
      return telegramFetch('sendMessage', { chat_id: chatId, text, ...options });
    },
    sendChatAction: async (chatId, action) => {
      return telegramFetch('sendChatAction', { chat_id: chatId, action });
    },
    editMessageText: async (text, options = {}) => {
      // Handle overload: (text, options) vs (msgId, text, options) - library has quirks,
      // but our code seems to usage object options with chat_id and message_id inside.
      // Let's check usages.
      // Usage 1: bot.editMessageText(newText, { chat_id, message_id, ... })
      return telegramFetch('editMessageText', { text, ...options });
    },
    answerCallbackQuery: async (callbackQueryId, options = {}) => {
      return telegramFetch('answerCallbackQuery', { callback_query_id: callbackQueryId, ...options });
    },
    deleteMessage: async (chatId, messageId) => {
      return telegramFetch('deleteMessage', { chat_id: chatId, message_id: messageId });
    },
    getMe: async () => {
      return telegramFetch('getMe', {});
    },
    
    // Event listener registration (used by conversational callbacks)
    on: (event, handler) => {
      if (listeners[event]) {
        listeners[event].push(handler);
      }
    },

    // Internal: Trigger event
    _emit: async (event, payload) => {
      if (listeners[event]) {
        await Promise.all(listeners[event].map(handler => handler(payload)));
      }
    }
  };
}

export default async function handler(req, res) {
  logger.info('📨 Webhook recebido', {
    method: req.method,
    updateType: req.body?.message ? 'message' : req.body?.callback_query ? 'callback_query' : 'unknown'
  });

  if (req.method !== 'POST') {
    logger.warn('❌ Método não permitido', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!token) {
    logger.error('❌ TELEGRAM_BOT_TOKEN ausente');
    return res.status(200).json({ error: 'Bot token not configured' });
  }

  const update = req.body;
  const bot = createBotAdapter(token);

  // Initialize listeners (register callbacks)
  // Note: These functions act as "setup" functions returning nothing or promises
  handleCallbacks(bot);
  handleConversationalCallbacks(bot);

  try {
    // Dispatch based on update type
    if (update.message?.text) {
      const msg = update.message;
      const text = msg.text;
      const chatId = msg.chat.id;

      logger.info('💬 Mensagem de texto recebida', {
        chatId,
        textPreview: text.substring(0, 50),
        textLen: text.length,
        isCommand: text.startsWith('/')
      });

      // Command Routing
      if (text.startsWith('/start')) {
        logger.debug('🔧 Roteando: /start', { chatId });
        await handleStart(bot, msg);
      }
      else if (text.startsWith('/status')) {
        logger.debug('🔧 Roteando: /status', { chatId });
        await handleStatus(bot, msg);
      }
      else if (text.startsWith('/estoque')) {
        logger.debug('🔧 Roteando: /estoque', { chatId });
        await handleEstoque(bot, msg);
      }
      else if (text.startsWith('/hoje')) {
        logger.debug('🔧 Roteando: /hoje', { chatId });
        await handleHoje(bot, msg);
      }
      else if (text.startsWith('/proxima')) {
        logger.debug('🔧 Roteando: /proxima', { chatId });
        await handleProxima(bot, msg);
      }
      else if (text.startsWith('/historico')) {
        logger.debug('🔧 Roteando: /historico', { chatId });
        await handleHistorico(bot, msg);
      }
      else if (text.startsWith('/ajuda')) {
        logger.debug('🔧 Roteando: /ajuda', { chatId });
        await handleAjuda(bot, msg);
      }

      else if (text.startsWith('/registrar')) {
        logger.debug('🔧 Roteando: /registrar', { chatId });
        await handleRegistrar(bot, msg);
      }
      else if (text.startsWith('/adicionar_estoque')) {
        logger.debug('🔧 Roteando: /adicionar_estoque', { chatId });
        await handleAdicionarEstoque(bot, msg);
      }

      // Arguments regex commands
      else if (text.startsWith('/repor')) {
        const match = text.match(/\/repor\s+(.+)\s+(\d+[.,]?\d*)/);
        if (match) {
          logger.debug('🔧 Roteando: /repor', { chatId });
          await handleReporShortcut(bot, msg, match);
        }
        else {
          logger.warn('⚠️ Formato inválido /repor', { chatId, text });
          bot.sendMessage(msg.chat.id, 'Formato inválido. Use: /repor Nome Quantidade');
        }
      }
      else if (text.startsWith('/pausar')) {
        const match = text.match(/\/pausar(?:\s+(.+))?/);
        logger.debug('🔧 Roteando: /pausar', { chatId });
        await handlePausar(bot, msg, match || [text, undefined]);
      }
      else if (text.startsWith('/retomar')) {
        const match = text.match(/\/retomar(?:\s+(.+))?/);
        logger.debug('🔧 Roteando: /retomar', { chatId });
        await handleRetomar(bot, msg, match || [text, undefined]);
      }

      // Fallback: Emit 'message' event for conversational callback listeners (chatbot IA)
      else {
        logger.info('🤖 Emitindo evento "message" para listeners (chatbot IA)', {
          chatId,
          textPreview: text.substring(0, 50)
        });
        await bot._emit('message', msg);
      }
    }
    else if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message?.chat?.id;
      logger.info('🔲 Callback query recebido', {
        chatId,
        callbackData: callbackData.substring(0, 50),
        callbackLen: callbackData.length
      });
      // Dispatch to listeners registered via bot.on('callback_query', ...)
      await bot._emit('callback_query', update.callback_query);
    }
    else {
      logger.warn('⚠️ Update sem tipo identificado', { updateKeys: Object.keys(update) });
    }

    logger.info('✅ Webhook processado com sucesso');
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('❌ Erro no webhook', error, {
      errorMessage: error.message,
      errorName: error.name,
      chatId: update.message?.chat?.id || update.callback_query?.message?.chat?.id
    });
    res.status(200).json({ error: 'Internal Error', details: error.message });
  }
}
