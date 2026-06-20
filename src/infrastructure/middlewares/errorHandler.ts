import { Request, Response, NextFunction } from 'express';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  // Log the error for debugging
  console.error('[ERROR]', err.message || err);
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    console.error(err.stack);
  }

  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'MulterError' || err.message === 'Invalid file format or size limit exceeded') {
    statusCode = 400;
    message = 'Invalid file format or size limit exceeded';
  } else if (process.env.NODE_ENV === 'production') {
    message = 'Algo salió mal. Intente nuevamente más tarde.';
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

export default errorHandler;
