import { LoggerPort } from '../../domain/ports/LoggerPort';
import { logger } from './logger';

export class PinoLogger implements LoggerPort {
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
