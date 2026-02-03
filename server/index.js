import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import TelegramBot from 'node-telegram-bot-api';
import { handleStart } from './bot/commands/start.js';
import { handleStatus } from './bot/commands/status.js';
import { handleEstoque } from './bot/commands/estoque.js';
import { handleHoje } from './bot/commands/hoje.js';
import { handleProxima } from './bot/commands/proxima.js';
import { handleHistorico } from './bot/commands/historico.js';
import { handleAjuda } from './bot/commands/ajuda.js';
import { handleRegistrar } from './bot/commands/registrar.js';
import { handleAdicionarEstoque, handleReporShortcut } from './bot/commands/adicionar_estoque.js';
import { handlePausar, handleRetomar } from './bot/commands/protocols.js';
import { handleCallbacks } from './bot/callbacks/doseActions.js';
import { handleConversationalCallbacks } from './bot/callbacks/conversational.js';
import { handleInlineQueries } from './bot/inlineQuery.js';
import { startScheduler, startDailyDigest } from './bot/scheduler.js';
import { startStockAlerts, startAdherenceReports, startTitrationAlerts, startMonthlyReport } from './bot/alerts.js';
import { startAutoCleanup } from './services/sessionManager.js';

// Validate environment
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('ERRO: TELEGRAM_BOT_TOKEN não definido no .env');
  process.exit(1);
}

// Initialize bot
const bot = new TelegramBot(token, { polling: true });

console.log('🚀 Bot de Remédios iniciado com sucesso!');
console.log('📋 Comandos disponíveis: /start, /status, /estoque, /hoje, /proxima, /historico, /ajuda, /registrar, /adicionar_estoque, /repor, /pausar, /retomar');

// Register command handlers
bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.onText(/\/status/, (msg) => handleStatus(bot, msg));
bot.onText(/\/estoque/, (msg) => handleEstoque(bot, msg));
bot.onText(/\/hoje/, (msg) => handleHoje(bot, msg));
bot.onText(/\/proxima/, (msg) => handleProxima(bot, msg));
bot.onText(/\/historico/, (msg) => handleHistorico(bot, msg));
bot.onText(/\/ajuda/, (msg) => handleAjuda(bot, msg));
bot.onText(/\/registrar/, (msg) => handleRegistrar(bot, msg));
bot.onText(/\/adicionar_estoque/, (msg) => handleAdicionarEstoque(bot, msg));
bot.onText(/\/repor\s+(.+)\s+(\d+[.,]?\d*)/, (msg, match) => handleReporShortcut(bot, msg, match));
bot.onText(/\/pausar(?:\s+(.+))?/, (msg, match) => handlePausar(bot, msg, match));
bot.onText(/\/retomar(?:\s+(.+))?/, (msg, match) => handleRetomar(bot, msg, match));

// Register callback handlers
handleCallbacks(bot);
handleConversationalCallbacks(bot);

// Register inline query handler (Phase 2.2)
handleInlineQueries(bot);

// Start scheduler
startScheduler(bot);
startDailyDigest(bot);

// Start intelligent alerts (Phase 4)
startStockAlerts(bot);
startAdherenceReports(bot);
startTitrationAlerts(bot);
startMonthlyReport(bot);

// Start session cleanup for persistent sessions
startAutoCleanup();
