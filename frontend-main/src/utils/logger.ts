/**
 * Production-safe logger utility.
 * 
 * ALL console output is SILENT by default.
 * To enable logging, set VITE_DEBUG=true in your .env file.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('debug info');     // silent unless VITE_DEBUG=true
 *   logger.warn('heads up');      // silent unless VITE_DEBUG=true
 *   logger.error('real problem'); // silent unless VITE_DEBUG=true
 */

const isDebug = import.meta.env.VITE_DEBUG === 'true';

/* eslint-disable no-console */
export const logger = {
  log: (...args: unknown[]): void => {
    if (isDebug) console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    if (isDebug) console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    if (isDebug) console.error(...args);
  },
  debug: (...args: unknown[]): void => {
    if (isDebug) console.debug(...args);
  },
  info: (...args: unknown[]): void => {
    if (isDebug) console.info(...args);
  },
};
/* eslint-enable no-console */

export default logger;
