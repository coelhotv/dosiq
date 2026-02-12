import cron from 'node-cron';
import { createLogger } from './logger.js';
import { checkReminders, runDailyDigest } from './tasks.js';

const logger = createLogger('Scheduler');

/**
 * Wrapper para cron jobs com tratamento de erro padronizado
 * @param {string} name - Nome do job para logging
 * @param {string} schedule - Expressão cron
 * @param {Function} task - Função async a ser executada
 */
function scheduleTask(name, schedule, task) {
  cron.schedule(schedule, async () => {
    try {
      logger.debug(`Starting scheduled task: ${name}`);
      await task();
      logger.debug(`Completed scheduled task: ${name}`);
    } catch (error) {
      logger.error(`Scheduled task failed: ${name}`, error);
    }
  });
  logger.info(`Scheduled task registered: ${name}`, { schedule });
}

export function startScheduler(bot) {
  // Main notification scheduler - runs every minute
  scheduleTask('checkReminders', '* * * * *', () => checkReminders(bot));
  console.log('✅ Notificador de lembretes iniciado');
}

export function startDailyDigest(bot) {
  scheduleTask('runDailyDigest', '0 23 * * *', () => runDailyDigest(bot));
  console.log('✅ Resumo diário configurado (diariamente às 23h)');
}

// Re-export for compatibility if needed elsewhere
export { checkReminders, runDailyDigest };
