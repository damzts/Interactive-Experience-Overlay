import pino from 'pino';
import logger from './lib/logger.js';


/**
 * Shared structured logger for @ieom/server (overlay/desktop hub).
 * Uses pino with pretty-print in development and JSON in production.
 * All modules should import this instead of using console.log/console.error.
 */

const isProduction = process.env['NODE_ENV'] === 'production';

const logger = pino({
  name: 'ieom-overlay',
  level: process.env['LOG_LEVEL'] ?? (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,name',
          },
        },
      }),
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'token', 'refreshToken', 'secret'],
    censor: '[REDACTED]',
  },
});

export default logger;
