import { Request, Response, NextFunction } from 'express';
import { FileFlowError, ValidationError, NotFoundError } from '../types';
import { logger } from '../utils/logger';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  code?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle known error types
  if (err instanceof FileFlowError) {
    statusCode = err.statusCode;
    code = err.code || 'FILEFLOW_ERROR';
    message = err.message;
    details = err.details;
  } else if (err instanceof ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
    details = err.details;
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = err.message;
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    code = 'FILE_UPLOAD_ERROR';
    message = getMulterErrorMessage(err as any);
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'SyntaxError') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }

  // Log the error
  logger.error('Error handled by error middleware', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    request: {
      id: (req as any).id,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
    statusCode,
    code,
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: code,
    message,
    statusCode,
    code,
    timestamp: new Date().toISOString(),
    requestId: (req as any).id,
  };

  // Include details only in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = details || {
      stack: err.stack,
      name: err.name,
    };
  }

  res.status(statusCode).json(errorResponse);
};

function getMulterErrorMessage(err: any): string {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return 'File size exceeds the maximum allowed limit';
    case 'LIMIT_FILE_COUNT':
      return 'Too many files uploaded';
    case 'LIMIT_FIELD_KEY':
      return 'Field name too long';
    case 'LIMIT_FIELD_VALUE':
      return 'Field value too long';
    case 'LIMIT_FIELD_COUNT':
      return 'Too many fields';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Unexpected file field';
    case 'MISSING_FIELD_NAME':
      return 'Missing field name';
    default:
      return 'File upload error';
  }
}

// Async error wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 Not Found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};