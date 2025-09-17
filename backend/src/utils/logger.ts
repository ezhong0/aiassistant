/**
 * Winston Logger Configuration and Setup
 * 
 * This module provides a centralized logging solution using Winston with
 * comprehensive features including daily log rotation, structured logging,
 * and environment-specific formatting. The logger is configured for both
 * development and production environments with appropriate log levels.
 * 
 * Features:
 * - Console logging with colorized output for development
 * - JSON structured logging for production
 * - Daily log rotation with compression
 * - Separate error and combined log files
 * - Exception and rejection handling
 * - Configurable log levels via environment variables
 * 
 * @example
 * ```typescript
 * import logger from './utils/logger';
 * 
 * // Basic logging
 * logger.info('Application started');
 * logger.error('Database connection failed', { error: error.message });
 * 
 * // Structured logging with metadata
 * logger.info('User action', { 
 *   userId: '123', 
 *   action: 'login', 
 *   timestamp: Date.now() 
 * });
 * ```
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, errors, printf, colorize, json } = winston.format;

/**
 * Custom log format for development environment
 * Provides human-readable output with timestamps and metadata
 */
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}: ${stack || message}${metaStr}`;
});

/**
 * Winston logger instance with comprehensive configuration
 * 
 * Configuration includes:
 * - Environment-based log levels (info for dev, warn for prod)
 * - Multiple transports: console, error files, combined files
 * - Daily log rotation with compression
 * - Exception and rejection handling
 * - Structured JSON logging for production
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'production' ? json() : logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      )
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: json(),
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: json(),
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  ],
  exceptionHandlers: [
    new DailyRotateFile({ 
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({ 
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  ]
});

/**
 * Default logger instance for application-wide logging
 * 
 * This logger provides structured logging capabilities with:
 * - Multiple log levels (error, warn, info, debug)
 * - Environment-specific formatting
 * - File rotation and compression
 * - Exception handling
 * 
 * @example
 * ```typescript
 * import logger from './utils/logger';
 * 
 * // Log levels
 * logger.error('Critical error occurred', { error: error.message });
 * logger.warn('Deprecated API used', { endpoint: '/old-api' });
 * logger.info('User logged in', { userId: '123' });
 * logger.debug('Debug information', { data: someData });
 * ```
 */
export default logger;