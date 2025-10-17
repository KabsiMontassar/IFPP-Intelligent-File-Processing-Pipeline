import winston from 'winston';
import { config } from '../config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define the format for console logs
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

// Define the format for file logs
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  
  // File transport for error logs
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: fileFormat,
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: config.logging.file,
    format: fileFormat,
  }),
];

// Create the logger
export const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Stream for Morgan middleware
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const logError = (message: string, error?: Error, metadata?: any) => {
  logger.error(message, {
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : undefined,
    metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logInfo = (message: string, metadata?: any) => {
  logger.info(message, {
    metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logWarn = (message: string, metadata?: any) => {
  logger.warn(message, {
    metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logDebug = (message: string, metadata?: any) => {
  logger.debug(message, {
    metadata,
    timestamp: new Date().toISOString(),
  });
};

export default logger;