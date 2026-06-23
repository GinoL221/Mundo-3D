import { Request, Response, NextFunction } from 'express';
import { logger } from '../logging/logger';

interface AppError {
  name?: string;
  message?: string;
  stack?: string;
  status?: number;
  statusCode?: number;
}

const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const error = (err && typeof err === 'object' ? err : {}) as AppError;
  const errMessage = error.message || String(err);

  // Log the error for debugging
  logger.error('[ERROR] ' + errMessage);
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    logger.error(error.stack);
  }

  let statusCode = error.status || error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  if (error.name === 'CartValidationException') {
    statusCode = 400;
  } else if (error.name === 'MulterError' || error.message === 'Invalid file format or size limit exceeded') {
    statusCode = 400;
    message = 'Invalid file format or size limit exceeded';
  } else if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Algo salió mal. Intente nuevamente más tarde.';
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
};

export default errorHandler;
