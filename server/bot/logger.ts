import { getServerTimestamp } from '../utils/dateUtils.js';

// Logger estruturado com níveis de log
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

class Logger {
  context: string;

  constructor(context: string) {
    this.context = context;
  }

  formatMessage(level: string, message: string, data: unknown = null) {
    const timestamp = getServerTimestamp();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${dataStr}`;
  }

  error(message: string, error: Error | null = null, data: unknown = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
      if (error) {
        console.error('  Error:', error.message);
        console.error('  Stack:', error.stack);
      }
    }
  }

  warn(message: string, data: unknown = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message: string, data: unknown = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  debug(message: string, data: unknown = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  trace(message: string, data: unknown = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.TRACE) {
      console.log(this.formatMessage('TRACE', message, data));
    }
  }
}

export function createLogger(context: string) {
  return new Logger(context);
}