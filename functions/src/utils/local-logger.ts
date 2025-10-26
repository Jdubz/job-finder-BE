/**
 * Local File-Based Logger
 *
 * Writes structured JSON logs to centralized /logs directory during development.
 * This logger is used ONLY in local development (Firebase emulator).
 *
 * For staging/production, use cloud-logger.ts which sends to Google Cloud Logging.
 *
 * Features:
 * - Structured JSON conforming to StructuredLogEntry schema
 * - Writes to /logs/backend.log in repository root
 * - Synchronous writes for simplicity (local dev only)
 * - No PII redaction needed (local only)
 * - No cloud integration
 *
 * Usage:
 * ```typescript
 * import { createLocalLogger } from './utils/local-logger'
 *
 * const logger = createLocalLogger()
 * logger.info({
 *   category: 'api',
 *   action: 'request',
 *   message: 'Processing job queue request',
 *   requestId: 'req-123',
 *   details: { jobId: 'job-456' }
 * })
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import type { StructuredLogEntry, LogLevel } from '@jsdubzw/job-finder-shared-types';

// Path to service log file
const LOG_FILE = path.resolve(__dirname, '../../../../logs/backend.log');

// Ensure log directory exists
const ensureLogDirectory = () => {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

/**
 * Map LogLevel to severity
 */
function getSeverity(level: LogLevel): 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' {
  const severityMap: Record<LogLevel, 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'> = {
    debug: 'DEBUG',
    info: 'INFO',
    warning: 'WARNING',
    error: 'ERROR',
  };
  return severityMap[level];
}

/**
 * Format error object for logging
 */
function formatError(error: Error | unknown): { type: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    type: 'UnknownError',
    message: String(error),
  };
}

/**
 * Local Logger interface
 */
export interface LocalLogger {
  debug(entry: Omit<StructuredLogEntry, 'category'> & { category?: StructuredLogEntry['category'] }): void;
  info(entry: Omit<StructuredLogEntry, 'category'> & { category?: StructuredLogEntry['category'] }): void;
  warning(entry: Omit<StructuredLogEntry, 'category'> & { category?: StructuredLogEntry['category'] }): void;
  error(
    entry: Omit<StructuredLogEntry, 'category' | 'error'> & {
      category?: StructuredLogEntry['category'];
      error?: Error | unknown;
    }
  ): void;
}

/**
 * Create a local file-based logger instance
 */
export function createLocalLogger(): LocalLogger {
  // Ensure log directory exists
  ensureLogDirectory();

  /**
   * Write a structured log entry to file
   */
  function writeLog(
    level: LogLevel,
    entry: Omit<StructuredLogEntry, 'category'> & { category?: StructuredLogEntry['category'] }
  ): void {
    // Default category to 'system'
    const fullEntry: StructuredLogEntry = {
      ...entry,
      category: entry.category || 'system',
    };

    // Create log output
    const logOutput = {
      severity: getSeverity(level),
      timestamp: new Date().toISOString(),
      environment: 'development',
      service: 'backend',
      ...fullEntry,
    };

    // Write to file (synchronous for simplicity in dev)
    const logLine = JSON.stringify(logOutput) + '\n';
    try {
      fs.appendFileSync(LOG_FILE, logLine);
    } catch (err) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', err);
      console.log(logLine);
    }
  }

  return {
    debug: (entry) => writeLog('debug', entry),
    info: (entry) => writeLog('info', entry),
    warning: (entry) => writeLog('warning', entry),
    error: (entry) => {
      const errorEntry: StructuredLogEntry = {
        category: entry.category || 'system',
        action: entry.action,
        message: entry.message,
        details: entry.details,
        userId: entry.userId,
        requestId: entry.requestId,
        http: entry.http,
        error: entry.error ? formatError(entry.error) : undefined,
      };
      writeLog('error', errorEntry);
    },
  };
}

/**
 * Create default logger instance (singleton)
 */
let defaultLogger: LocalLogger | null = null;

export function getDefaultLocalLogger(): LocalLogger {
  if (!defaultLogger) {
    defaultLogger = createLocalLogger();
  }
  return defaultLogger;
}

/**
 * Legacy compatibility: Simple logger interface
 * This maintains backward compatibility with existing code.
 */
export type SimpleLogger = {
  info: (message: string, data?: unknown) => void;
  warning: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
};

/**
 * Create a legacy-compatible simple logger
 *
 * This wraps the Local Logger to provide the old SimpleLogger interface.
 * Use this for gradual migration from the old logger.
 */
export function createLegacyLocalLogger(): SimpleLogger {
  const localLogger = getDefaultLocalLogger();

  return {
    info: (message: string, data?: unknown) => {
      localLogger.info({
        category: 'system',
        action: 'log',
        message,
        details: data ? (data as Record<string, string | number | boolean | null | undefined>) : undefined,
      });
    },
    warning: (message: string, data?: unknown) => {
      localLogger.warning({
        category: 'system',
        action: 'log',
        message,
        details: data ? (data as Record<string, string | number | boolean | null | undefined>) : undefined,
      });
    },
    error: (message: string, data?: unknown) => {
      localLogger.error({
        category: 'system',
        action: 'error',
        message,
        details: data ? (data as Record<string, string | number | boolean | null | undefined>) : undefined,
      });
    },
  };
}
