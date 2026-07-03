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
  constructor(context) {
    this.context = context;
  }

  formatMessage(level, message, data = null) {
    const timestamp = getServerTimestamp();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${dataStr}`;
  }

  error(message, error = null, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
      if (error) {
        console.error('  Error:', error.message);
        console.error('  Stack:', error.stack);
      }
    }
  }

  warn(message, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  debug(message, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  trace(message, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.TRACE) {
      console.log(this.formatMessage('TRACE', message, data));
    }
  }
}

export function createLogger(context) {
  return new Logger(context);
}