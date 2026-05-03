import { createLogger } from './logger.js';
import { getServerTimestamp } from '../utils/dateUtils.js';

const logger = createLogger('HealthCheck');

export class HealthCheck {
  constructor() {
    this.checks = new Map();
    this.lastCheck = null;
  }

  register(name, checkFn) {
    this.checks.set(name, checkFn);
    logger.info(`Health check registered: ${name}`);
  }

  async runAll() {
    const results = {
      timestamp: getServerTimestamp(),
      overall: 'healthy',
      checks: {}
    };

    for (const [name, checkFn] of this.checks) {
      try {
        const result = await checkFn();
        results.checks[name] = {
          status: result.ok ? 'healthy' : 'unhealthy',
          ...result
        };
        if (!result.ok) {
          results.overall = 'unhealthy';
        }
      } catch (error) {
        results.checks[name] = {
          status: 'error',
          error: error.message
        };
        results.overall = 'unhealthy';
        logger.error(`Health check failed: ${name}`, error);
      }
    }

    this.lastCheck = results;
    return results;
  }

  getStatus() {
    return this.lastCheck || { status: 'unknown', timestamp: null };
  }
}

// Singleton instance
export const healthCheck = new HealthCheck();

// Checks predefinidos
export function registerDefaultChecks(bot, supabase) {
  // Check Telegram API
  healthCheck.register('telegram-api', async () => {
    try {
      const me = await bot.getMe();
      return { ok: true, username: me.username, id: me.id };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // Check Supabase Connection
  healthCheck.register('supabase', async () => {
    try {
      const { error } = await supabase.from('user_settings').select('count').limit(1);
      if (error) throw error;
      return { ok: true, connected: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // Check Environment
  healthCheck.register('environment', async () => {
    const required = ['TELEGRAM_BOT_TOKEN', 'VITE_SUPABASE_URL'];
    const missing = required.filter(key => !process.env[key]);
    return {
      ok: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined
    };
  });
}