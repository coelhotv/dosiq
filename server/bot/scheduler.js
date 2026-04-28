import cron from 'node-cron';
import { createLogger } from './logger.js';
import { checkReminders, runDailyDigest, checkPrescriptionAlerts } from './tasks.js';

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

export function startScheduler(bot, options = {}) {
  // Main notification scheduler - runs every minute
  scheduleTask('checkReminders', '* * * * *', () => checkReminders(bot, options));
  console.log('✅ Notificador de lembretes iniciado');
}

export function startDailyDigest(bot, options = {}) {
  // Bug B-cron: digest precisa rodar a cada minuto para honrar o digest_time por usuário
  // A função runDailyDigestViaDispatcher filtra internamente quem está no horário correto
  scheduleTask('runDailyDigest', '* * * * *', () => runDailyDigest(bot, options));
  console.log('✅ Resumo diário configurado (verifica a cada minuto, envia no horário do usuário)');
}

export function startPrescriptionAlerts(bot, options = {}) {
  // Run once daily at 8h to check for prescription alerts
  scheduleTask('checkPrescriptionAlerts', '0 8 * * *', () => checkPrescriptionAlerts(bot, options));
  console.log('✅ Alertas de prescrição configurados (diariamente às 8h)');
}
