import { ILogger } from '../../domain/ports/ILogger';
import { logger } from './logger';

export class PinoLogger implements ILogger {
  info(obj: object, msg?: string): void {
    logger.info(obj, msg);
  }

  warn(obj: object, msg?: string): void {
    logger.warn(obj, msg);
  }

  error(obj: object, msg?: string): void {
    logger.error(obj, msg);
  }
}
