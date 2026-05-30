/**
 * Simple logger utility for the main process.
 * Wraps console methods with a consistent interface.
 * Can be extended later to write to log files or integrate
 * with electron-log.
 */

export const logger = {
  info(message: string): void {
    console.info(message);
  },

  warn(message: string): void {
    console.warn(message);
  },

  error(message: string): void {
    console.error(message);
  },
};
