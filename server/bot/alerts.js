import cron from 'node-cron';
import { createLogger } from './logger.js';
import {
  checkStockAlerts,
  checkAdherenceReports,
  checkTitrationAlerts,
  checkMonthlyReport
} from './tasks.js';

const logger = createLogger('Alerts');

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

export function startStockAlerts(bot) {
  // Run daily at 9:00 AM
  scheduleTask('checkStockAlerts', '0 9 * * *', () => checkStockAlerts(bot));
  console.log('✅ Alertas de estoque configurados (diariamente às 9h)');
}

export function startAdherenceReports(bot) {
  // Run every Sunday at 10:00 PM
  scheduleTask('checkAdherenceReports', '0 22 * * 0', () => checkAdherenceReports(bot));
  console.log('✅ Relatórios de adesão configurados (domingos às 22h)');
}

export function startTitrationAlerts(bot) {
  // Run daily at 8:00 AM
  scheduleTask('checkTitrationAlerts', '0 8 * * *', () => checkTitrationAlerts(bot));
  console.log('✅ Alertas de titulação configurados (diariamente às 8h)');
}

export function startMonthlyReport(bot) {
  scheduleTask('checkMonthlyReport', '0 10 1 * *', () => checkMonthlyReport(bot));
  console.log('✅ Relatórios mensais configurados (dia 1 às 10h)');
}

// Re-export for compatibility
export {
  checkStockAlerts,
  checkAdherenceReports,
  checkTitrationAlerts,
  checkMonthlyReport
};
