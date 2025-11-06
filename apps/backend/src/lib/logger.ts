import pino from 'pino';

/**
 * Centralized logger using Pino
 *
 * Features:
 * - Pretty printing in development
 * - JSON output in production
 * - Structured logging with context
 * - Performance optimized
 * - Console-compatible API
 *
 * Usage:
 * logger.info('Server started on port', 4000);
 * logger.error('Database error:', error);
 * logger.debug('Processing request:', { requestId, data });
 */
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Console-compatible logger interface
 * Allows gradual migration from console.log to structured logging
 */
export const logger = {
  /**
   * Log informational messages
   * Compatible with console.log signature
   */
  info: (...args: any[]) => {
    if (args.length === 1) {
      pinoLogger.info(args[0]);
    } else if (typeof args[args.length - 1] === 'object' && !Array.isArray(args[args.length - 1])) {
      const context = args[args.length - 1];
      const message = args.slice(0, -1).join(' ');
      pinoLogger.info(context, message);
    } else {
      pinoLogger.info(args.join(' '));
    }
  },

  /**
   * Log error messages
   * Compatible with console.error signature
   */
  error: (...args: any[]) => {
    // Check if last argument is an Error object
    const lastArg = args[args.length - 1];
    if (lastArg instanceof Error) {
      const message = args.slice(0, -1).join(' ');
      pinoLogger.error({ err: lastArg }, message);
    } else if (args.length === 1) {
      pinoLogger.error(args[0]);
    } else if (typeof lastArg === 'object' && !Array.isArray(lastArg)) {
      const context = lastArg;
      const message = args.slice(0, -1).join(' ');
      pinoLogger.error(context, message);
    } else {
      pinoLogger.error(args.join(' '));
    }
  },

  /**
   * Log warning messages
   * Compatible with console.warn signature
   */
  warn: (...args: any[]) => {
    if (args.length === 1) {
      pinoLogger.warn(args[0]);
    } else if (typeof args[args.length - 1] === 'object' && !Array.isArray(args[args.length - 1])) {
      const context = args[args.length - 1];
      const message = args.slice(0, -1).join(' ');
      pinoLogger.warn(context, message);
    } else {
      pinoLogger.warn(args.join(' '));
    }
  },

  /**
   * Log debug messages
   * Compatible with console.debug signature
   */
  debug: (...args: any[]) => {
    if (args.length === 1) {
      pinoLogger.debug(args[0]);
    } else if (typeof args[args.length - 1] === 'object' && !Array.isArray(args[args.length - 1])) {
      const context = args[args.length - 1];
      const message = args.slice(0, -1).join(' ');
      pinoLogger.debug(context, message);
    } else {
      pinoLogger.debug(args.join(' '));
    }
  },

  /**
   * Create a child logger with specific context
   * Useful for adding consistent context to all logs in a service/module
   *
   * Example:
   * const formLogger = logger.child({ service: 'formService' });
   * formLogger.info('Form created', { formId });
   */
  child: (context: Record<string, any>) => {
    const childLogger = pinoLogger.child(context);
    return {
      info: (...args: any[]) => childLogger.info(args.join(' ')),
      error: (...args: any[]) => childLogger.error(args.join(' ')),
      warn: (...args: any[]) => childLogger.warn(args.join(' ')),
      debug: (...args: any[]) => childLogger.debug(args.join(' ')),
    };
  },
};

export default logger;
