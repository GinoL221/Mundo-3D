import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../logging/logger';

export default function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;
    const { method, url, reqId } = req;
    const { statusCode } = res;

    logger.info(
      {
        reqId,
        method,
        url,
        status: statusCode,
        latencyMs: parseFloat(duration.toFixed(3))
      },
      `${method} ${url} ${statusCode} - ${duration.toFixed(3)}ms`
    );
  });

  next();
}
